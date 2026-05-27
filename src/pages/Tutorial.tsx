import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { loadOpts, keyLabel, getActiveTheme } from "../lib/options";
import { audioManager } from "../game/audio";
import { getCurrentDay } from "../utils/dayCalc";
import { getCardByDay } from "../services/vaultService";
import { loadCatalog, type GameSong } from "../game/api";
import type { Note } from "../game/types";
import Card from "../components/Card";
import RarityBadge from "../components/RarityBadge";
import PackContainer from "../components/cinematic/PackContainer";
import type { RevealPackMeta } from "../store/useVaultStore";
import type { OwnedCard } from "../services/vaultService";
import { Volume2, Award, Zap, Shield, HelpCircle, Layers } from "lucide-react";

// Read per render so Tutorial matches the options
const LANE_COLORS = () => loadOpts().laneColors;
const LANE_KEYS = () => loadOpts().laneKeys.map(k => keyLabel(k)) as [string, string, string];

// Visual constants
const HIT_LINE_Y = 82; // percentage from top where hit line sits
const NOTE_FALL_TIME_MS = 1400; // time it takes for note to fall
const HIT_WINDOW_MS = 180; // generous perfect window for easy tutorial

type TutorialPhase = "intro" | "gameplay" | "results" | "pack" | "discovery" | "aspiration" | "faction";

interface VisualNote {
  id: number;
  time: number; // target time in seconds
  lane: number;
  type: 'tap' | 'hold' | 'swipe';
  holdDuration?: number;
  hit?: boolean;
  missed?: boolean;
}

export default function Tutorial() {
  const [, setLocation] = useLocation();
  const [tutPhase, setTutPhase] = useState<TutorialPhase>("intro");
  const [dailyCard, setDailyCard] = useState<any>(null);
  const [dailySong, setDailySong] = useState<GameSong | null>(null);

  // Gameplay State
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameTime, setGameTime] = useState(0);
  const [score, setScore] = useState(0);
  const [notes, setNotes] = useState<VisualNote[]>([]);
  const [consecutiveMisses, setConsecutiveMisses] = useState(0);
  const [isPausedForHelp, setIsPausedForHelp] = useState(false);
  const [judgmentFeed, setJudgmentFeed] = useState<{ id: number; text: string; lane: number } | null>(null);
  const [activeLanePresses, setActiveLanePresses] = useState<[boolean, boolean, boolean]>([false, false, false]);

  // Faction State
  const [selectedFaction, setSelectedFaction] = useState<string | null>(null);

  // Audio References
  const gameplayAudioRef = useRef<HTMLAudioElement | null>(null);
  const gameLoopRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const pauseTimeRef = useRef<number>(0);
  const judgmentIdRef = useRef(0);

  // Load Daily song and card metadata
  useEffect(() => {
    async function load() {
      try {
        const today = getCurrentDay();
        const card = await getCardByDay(today);
        setDailyCard(card);

        const catalog = await loadCatalog();
        const matched = catalog.find(s => s.day === today) || 
                        catalog.find(s => s.id === card?.id) || 
                        catalog.find(s => s.day === (today % (catalog.length || 1))) ||
                        catalog[catalog.length - 1];
        setDailySong(matched);
      } catch (err) {
        console.error("Failed to load daily onboarding song:", err);
      }
    }
    load();
  }, []);

  // Generate beat-aligned easy notes based on Daily Song BPM
  const generateEasyNotes = useCallback((bpm: number) => {
    const beatDur = 60 / bpm;
    const list: VisualNote[] = [];
    let time = 2.0; // start after 2 seconds
    let id = 0;

    // generate notes up to 58 seconds
    while (time < 57) {
      const lane = id % 3;
      let type: 'tap' | 'hold' | 'swipe' = 'tap';
      let holdDuration: number | undefined;

      // sprinkle hold and swipe notes
      if (id % 6 === 2) {
        type = 'hold';
        holdDuration = beatDur * 2.0;
      } else if (id % 6 === 4) {
        type = 'swipe';
      }

      list.push({
        id: id++,
        time,
        lane,
        type,
        holdDuration,
      });

      // Spaced out: every 4 beats (super easy flow state)
      time += beatDur * 4;
    }
    return list;
  }, []);

  // Start Phase 2 Gameplay
  const startGameplay = useCallback(() => {
    if (!dailySong) return;
    
    // Play transition SFX
    audioManager.playSfx("select_start_song", 0.7);

    // Create and configure Audio element
    const audio = new Audio(dailySong.audioUrl);
    audio.volume = 0.5;
    gameplayAudioRef.current = audio;

    // Generate easy chart
    const easyNotes = generateEasyNotes(dailySong.bpm);
    setNotes(easyNotes);
    setScore(0);
    setConsecutiveMisses(0);
    setTutPhase("gameplay");

    // Play song
    audio.play().then(() => {
      setIsPlaying(true);
      startTimeRef.current = performance.now();
      audioLoop();
    }).catch(e => {
      console.warn("Autoplay blocked by browser. Starting click overlay.", e);
      setIsPlaying(true);
      startTimeRef.current = performance.now();
      audioLoop();
    });
  }, [dailySong, generateEasyNotes]);

  // Audio Loop Sync
  const audioLoop = () => {
    const audio = gameplayAudioRef.current;
    if (!audio) return;

    const currentSec = audio.currentTime;
    setGameTime(currentSec);

    // Filter notes that were missed
    setNotes(prev => prev.map(note => {
      const timeElapsed = currentSec - note.time;
      // If note passed hit window without hit and isn't marked missed
      if (timeElapsed > (HIT_WINDOW_MS / 1000) && !note.hit && !note.missed) {
        setConsecutiveMisses(m => {
          const nextMiss = m + 1;
          if (nextMiss >= 3) {
            triggerPauseHelp();
          }
          return nextMiss;
        });
        showJudgment("MISS", note.lane);
        return { ...note, missed: true };
      }
      return note;
    }));

    // Auto-complete gameplay at 60 seconds
    if (currentSec >= 59.5) {
      endGameplay();
      return;
    }

    gameLoopRef.current = requestAnimationFrame(audioLoop);
  };

  const triggerPauseHelp = () => {
    const audio = gameplayAudioRef.current;
    if (audio) {
      audio.pause();
      pauseTimeRef.current = audio.currentTime;
    }
    setIsPausedForHelp(true);
    if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
    }
  };

  const resumeFromHelp = () => {
    const audio = gameplayAudioRef.current;
    if (audio) {
      audio.currentTime = pauseTimeRef.current;
      audio.play().catch(() => {});
    }
    setIsPausedForHelp(false);
    setConsecutiveMisses(0);
    startTimeRef.current = performance.now() - (pauseTimeRef.current * 1000);
    // Restart animation loop
    gameLoopRef.current = requestAnimationFrame(audioLoop);
  };

  const endGameplay = () => {
    if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    if (gameplayAudioRef.current) {
      gameplayAudioRef.current.pause();
      gameplayAudioRef.current.src = "";
      gameplayAudioRef.current = null;
    }
    setIsPlaying(false);
    audioManager.playSfx("song_completion", 0.9);
    setTutPhase("results");
  };

  // Cleanup helper
  useEffect(() => {
    return () => {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
      if (gameplayAudioRef.current) {
        gameplayAudioRef.current.pause();
        gameplayAudioRef.current.src = "";
      }
    };
  }, []);

  const showJudgment = (text: string, lane: number) => {
    judgmentIdRef.current++;
    setJudgmentFeed({ id: judgmentIdRef.current, text, lane });
  };

  // Judgment Checker
  const handleHitAttempt = useCallback((laneIndex: number, type: 'tap' | 'swipe' | 'hold') => {
    if (isPausedForHelp) return;
    const audio = gameplayAudioRef.current;
    if (!audio) return;

    const currentSec = audio.currentTime;
    // Find closest active note in that lane
    const activeNoteIdx = notes.findIndex(n => n.lane === laneIndex && !n.hit && !n.missed);
    if (activeNoteIdx === -1) return;

    const note = notes[activeNoteIdx];
    const diff = Math.abs(currentSec - note.time) * 1000;

    if (diff <= HIT_WINDOW_MS) {
      // It's a hit!
      setNotes(prev => prev.map((n, idx) => idx === activeNoteIdx ? { ...n, hit: true } : n));
      setScore(s => s + 1000);
      setConsecutiveMisses(0);
      audioManager.playSfx("perfect", 0.5);
      showJudgment("PERFECT+", laneIndex);
    }
  }, [notes, isPausedForHelp]);

  // Touch and Keyboard inputs
  useEffect(() => {
    const keys = loadOpts().laneKeys; // ["a", "s", "d"]
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      
      if (tutPhase === "intro" && (key === "enter" || key === " ")) {
        startGameplay();
        return;
      }

      if (tutPhase === "gameplay") {
        const laneIdx = keys.indexOf(key);
        if (laneIdx !== -1) {
          setActiveLanePresses(prev => {
            const next = [...prev] as [boolean, boolean, boolean];
            next[laneIdx] = true;
            return next;
          });
          handleHitAttempt(laneIdx, 'tap');
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (tutPhase === "gameplay") {
        const laneIdx = keys.indexOf(key);
        if (laneIdx !== -1) {
          setActiveLanePresses(prev => {
            const next = [...prev] as [boolean, boolean, boolean];
            next[laneIdx] = false;
            return next;
          });
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [tutPhase, startGameplay, handleHitAttempt, isPausedForHelp]);

  // Mock pack meta for Phase 4 pack opening
  const welcomePackMeta: RevealPackMeta = {
    category: "taste",
    size: "single",
    label: "COMPATIBILITY PACK",
    icon: "⚡",
    accent: "#39FF14",
    gradient: "linear-gradient(160deg, #050d03 0%, #0d280b 45%, #020702 100%)",
    price: "FREE",
    cardCount: 1,
    revealType: "cinematic",
  };

  // Mock owned card container
  const getMockOwnedCard = (): OwnedCard[] => {
    if (!dailyCard) return [];
    return [{
      id: `welcome-${dailyCard.id}`,
      cardId: dailyCard.id,
      userId: "guest",
      mintedAt: new Date().toISOString(),
      source: "daily_claim",
      isEcho: false,
      echoGeneration: 0,
      card: dailyCard,
    }];
  };

  // Complete onboarding
  const handleCompleteTutorial = () => {
    localStorage.setItem("pim_tutorial_completed", "true");
    audioManager.playSfx("tap_nav", 0.15);
    setLocation("/arcade");
  };

  // Renders
  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-[#050505] text-white">
      {/* Kinetic Scanline CRT Screen effects */}
      <div className="absolute inset-0 pointer-events-none z-[99]" style={{
        backgroundImage: "linear-gradient(rgba(57,255,20,0.012) 1px, transparent 1px), linear-gradient(90deg, rgba(57,255,20,0.012) 1px, transparent 1px)",
        backgroundSize: "36px 36px",
      }} />
      <div className="absolute inset-0 pointer-events-none z-[99]" style={{
        background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 0, 0, 0.2) 2px, rgba(0, 0, 0, 0.2) 4px)"
      }} />

      {/* Cyberpunk corner bracket system */}
      <div className="absolute top-4 left-4 pointer-events-none font-mono text-[8px] text-[#39FF14]/40 tracking-widest z-10">
        NET_SYS // PROT_0x88F
      </div>
      <div className="absolute top-4 right-4 pointer-events-none font-mono text-[8px] text-[#39FF14]/40 tracking-widest z-10">
        SECTOR // ONBOARD
      </div>

      <AnimatePresence mode="wait">
        {/* PHASE 1: CYBERPUNK UNDERGROUND SPLASH */}
        {tutPhase === "intro" && (
          <motion.div
            key="intro"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center p-6 text-center relative z-10"
          >
            {/* Glowing neural ring */}
            <motion.div
              animate={{ opacity: [0.15, 0.35, 0.15], scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
              className="absolute w-[320px] h-[320px] rounded-full border border-[#39FF14]/10 bg-gradient-to-b from-[#39FF14]/5 to-transparent blur-3xl pointer-events-none"
            />

            <div className="relative border border-[#39FF14]/30 bg-black/75 p-8 max-w-sm w-full shadow-[0_0_40px_rgba(57,255,20,0.1)] rounded-sm">
              {/* Corner mini marks */}
              <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t border-l border-[#39FF14]" />
              <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t border-r border-[#39FF14]" />
              <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b border-l border-[#39FF14]" />
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b border-r border-[#39FF14]" />

              <div className="font-mono text-[9px] text-[#39FF14]/65 tracking-[0.4em] mb-4 uppercase">
                // ARCHIVE DETECTED //
              </div>
              <h1 className="font-mono text-3xl font-black text-white tracking-[0.1em] mb-6 leading-none uppercase">
                SYNCED
              </h1>
              
              <div className="space-y-3 font-mono text-[11px] text-zinc-400 leading-relaxed mb-8">
                <p className="text-[#39FF14] tracking-wide animate-pulse">⚡ SIGNAL STABLE. READY TO TRANSMIT.</p>
                <p>1 INBOUND MUSIC RELEASE SECURED.</p>
                <p>ESTABLISH RESONANCE COMPATIBILITY TO INTEGRATE INTO YOUR DECRYPTED DECK.</p>
              </div>

              <motion.button
                whileHover={{ scale: 1.03, boxShadow: "0 0 20px rgba(57,255,20,0.4)" }}
                whileTap={{ scale: 0.98 }}
                onClick={startGameplay}
                className="w-full py-4 bg-zinc-950/60 border border-[#39FF14] text-[#39FF14] font-mono text-xs font-bold tracking-[0.3em] uppercase hover:bg-[#39FF14]/10 transition-all rounded-sm"
              >
                PROVE COMPATIBILITY
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* PHASE 2: EASY RHYTHM GAMEPLAY */}
        {tutPhase === "gameplay" && (
          <motion.div
            key="gameplay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-between py-6 px-4 relative z-10"
          >
            {/* Top Bar Stats */}
            <div className="w-full max-w-sm flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="font-mono text-[10px] text-zinc-500 tracking-wider">
                TRANSMISSION: <span className="text-[#39FF14]">{dailySong?.title || "DECODING"}</span>
              </div>
              <div className="font-mono text-[10px] text-[#39FF14] font-bold tracking-widest">
                FLOW_RES: {score}
              </div>
            </div>

            {/* Rhythm Highway (3 Lanes) */}
            <div className="flex-1 w-full max-w-sm relative flex gap-3 border-x border-zinc-900/60 bg-gradient-to-b from-black via-zinc-950/20 to-black overflow-hidden my-4">
              {/* Vertical Lane Dividers */}
              <div className="absolute left-[33%] top-0 bottom-0 w-px bg-zinc-900/40" />
              <div className="absolute left-[66%] top-0 bottom-0 w-px bg-zinc-900/40" />

              {/* Hitglow Overlay at Bottom */}
              <div 
                className="absolute left-0 right-0 h-16 border-t border-b pointer-events-none z-10"
                style={{
                  top: `${HIT_LINE_Y}%`,
                  transform: 'translateY(-50%)',
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.01) 0%, rgba(57,255,20,0.05) 50%, rgba(255,255,255,0.01) 100%)',
                  borderColor: 'rgba(57,255,20,0.2)',
                }}
              />

              {/* Falling Notes */}
              {notes.map(note => {
                // Determine fall ratio (0 is top, 1.0 is hit line)
                const noteDuration = NOTE_FALL_TIME_MS / 1000;
                const elapsedSinceSpawn = gameTime - (note.time - noteDuration);
                const ratio = elapsedSinceSpawn / noteDuration;

                if (ratio < 0 || ratio > 1.2 || note.hit) return null;

                const laneColor = LANE_COLORS()[note.lane];
                const yPos = ratio * HIT_LINE_Y;

                return (
                  <div
                    key={note.id}
                    className="absolute z-20 pointer-events-none flex items-center justify-center"
                    style={{
                      left: `${note.lane * 33.33}%`,
                      width: '33.33%',
                      top: `${yPos}%`,
                      transform: 'translateY(-50%)',
                      padding: '0 6px'
                    }}
                  >
                    {/* Hold trail */}
                    {note.type === 'hold' && note.holdDuration && (
                      <div
                        className="absolute bottom-1/2 left-1/2 -translate-x-1/2 w-8"
                        style={{
                          height: `${(note.holdDuration / noteDuration) * 100}%`,
                          background: `linear-gradient(to top, ${laneColor}80, ${laneColor}15)`,
                          borderLeft: `1px solid ${laneColor}`,
                          borderRight: `1px solid ${laneColor}`,
                          borderRadius: '2px 2px 0 0',
                          transformOrigin: 'bottom center',
                        }}
                      />
                    )}

                    {/* Core note block */}
                    <div 
                      className="w-full h-8 flex items-center justify-center relative border shadow-lg"
                      style={{
                        background: laneColor,
                        borderColor: '#000',
                        boxShadow: `0 0 16px ${laneColor}80`,
                        borderRadius: '3px',
                      }}
                    >
                      {note.type === 'swipe' && (
                        <div className="flex flex-col text-white text-xs font-black animate-pulse">▲</div>
                      )}
                      {note.type === 'hold' && (
                        <div className="text-black text-[9px] font-mono font-bold tracking-tighter">HOLD</div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Lane Touch Zones / Trigger Visuals */}
              {[0, 1, 2].map(idx => {
                const laneColor = LANE_COLORS()[idx];
                const isPressed = activeLanePresses[idx];
                return (
                  <div
                    key={idx}
                    onClick={() => handleHitAttempt(idx, 'tap')}
                    onTouchStart={(e) => {
                      e.preventDefault();
                      setActiveLanePresses(prev => {
                        const next = [...prev] as [boolean, boolean, boolean];
                        next[idx] = true;
                        return next;
                      });
                      handleHitAttempt(idx, 'tap');
                    }}
                    onTouchEnd={() => {
                      setActiveLanePresses(prev => {
                        const next = [...prev] as [boolean, boolean, boolean];
                        next[idx] = false;
                        return next;
                      });
                    }}
                    className="flex-1 h-full flex flex-col justify-end items-center pb-8 select-none relative cursor-pointer active:bg-zinc-950/20"
                  >
                    {/* Key and visual flash indicator */}
                    <AnimatePresence>
                      {isPressed && (
                        <motion.div
                          initial={{ opacity: 0.15 }}
                          animate={{ opacity: 0.3 }}
                          exit={{ opacity: 0 }}
                          className="absolute inset-0 pointer-events-none"
                          style={{
                            background: `linear-gradient(to top, ${laneColor}35, transparent)`,
                          }}
                        />
                      )}
                    </AnimatePresence>

                    {/* Judgement splash text */}
                    {judgmentFeed && judgmentFeed.lane === idx && (
                      <motion.div
                        key={judgmentFeed.id}
                        initial={{ scale: 0.5, y: -20, opacity: 0 }}
                        animate={{ scale: 1.1, y: -45, opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute top-[70%] font-mono text-[10px] font-black tracking-widest text-center pointer-events-none"
                        style={{ color: laneColor }}
                      >
                        {judgmentFeed.text}
                      </motion.div>
                    )}

                    {/* Lane Labels (Mobile Touch Focused) */}
                    <div 
                      className="font-mono text-xs font-black tracking-widest px-3 py-1.5 border select-none transition-colors duration-100 rounded-sm"
                      style={{
                        borderColor: isPressed ? laneColor : 'rgba(255,255,255,0.08)',
                        color: isPressed ? '#fff' : 'rgba(255,255,255,0.25)',
                        background: isPressed ? laneColor : 'rgba(0,0,0,0.3)',
                      }}
                    >
                      {LANE_KEYS()[idx]}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mobile Touch hint */}
            <div className="font-mono text-[10px] text-zinc-500 tracking-wider uppercase text-center mt-2 max-w-xs">
              Tap the columns or press key binds when notes overlap the neon line.
            </div>

            {/* Pause help overlay */}
            <AnimatePresence>
              {isPausedForHelp && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center p-6 z-50 text-center"
                >
                  <div className="border border-[#FF1493]/30 bg-black p-6 rounded-sm max-w-xs w-full shadow-[0_0_30px_rgba(255,20,147,0.15)] relative">
                    {/* Corners */}
                    <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[#FF1493]" />
                    <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#FF1493]" />
                    <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#FF1493]" />
                    <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[#FF1493]" />

                    <div className="font-mono text-[9px] text-[#FF1493] tracking-widest mb-3 uppercase flex items-center justify-center gap-1">
                      <HelpCircle size={10} /> TRANSMISSION STABILITY DEGRADED
                    </div>
                    <div className="font-mono text-[11px] text-zinc-400 leading-relaxed mb-6">
                      Sync requires active interaction. Tap the columns (or press A, S, D) exactly when notes reach the pulsing glow line.
                    </div>
                    <button
                      onClick={resumeFromHelp}
                      className="w-full py-3 bg-zinc-950/60 border border-[#FF1493] text-[#FF1493] font-mono text-xs font-bold tracking-[0.2em] uppercase hover:bg-[#FF1493]/10 transition-all rounded-sm"
                    >
                      RE-ESTABLISH LINK
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* PHASE 3: THE "SCORE DETERMINES FATE" REVEAL */}
        {tutPhase === "results" && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="flex-1 flex flex-col items-center justify-center p-6 text-center relative z-10"
          >
            {/* Glowing radial drop ambient */}
            <div className="absolute w-[280px] h-[280px] rounded-full border border-[#39FF14]/5 bg-[#39FF14]/5 blur-3xl pointer-events-none" />

            <div className="border border-[#39FF14]/20 bg-black/80 p-8 max-w-sm w-full shadow-2xl rounded-sm">
              <div className="font-mono text-[9px] text-[#39FF14]/70 tracking-[0.4em] mb-4 uppercase">
                // COMPATIBILITY RATING //
              </div>
              <h2 className="font-mono text-2xl font-black tracking-widest text-white uppercase mb-6 leading-none">
                RESONANCE ACQUIRED
              </h2>

              <div className="space-y-4 border-y border-zinc-900 py-6 mb-8 text-left">
                <div className="flex justify-between font-mono text-xs">
                  <span className="text-zinc-500">SIGNAL STABILITY</span>
                  <span className="text-white font-bold">100.0%</span>
                </div>
                <div className="flex justify-between font-mono text-xs">
                  <span className="text-zinc-500">TRANSMISSION FREQUENCY</span>
                  <span className="text-[#39FF14] font-bold">STABLE</span>
                </div>
                <div className="flex justify-between font-mono text-xs">
                  <span className="text-zinc-500">ARCHIVE COMPATIBILITY</span>
                  <span className="text-[#39FF14] font-bold">HIGH</span>
                </div>

                {/* Progress decoding bar */}
                <div className="mt-4">
                  <div className="flex justify-between font-mono text-[9px] text-zinc-500 mb-1.5 uppercase">
                    <span>Calibrating Reward Grade...</span>
                    <span>100%</span>
                  </div>
                  <div className="h-2 bg-zinc-950 border border-zinc-900 relative overflow-hidden rounded-sm">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: "100%" }}
                      transition={{ duration: 1.5 }}
                      className="h-full bg-[#39FF14] shadow-[0_0_8px_#39FF14]"
                    />
                  </div>
                </div>

                <div className="text-center font-mono text-[10px] text-[#39FF14] tracking-wider font-bold mt-2 animate-pulse uppercase">
                  ⭐ MYTHIC DECRYPTION TIER SECURED ⭐
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.03, boxShadow: "0 0 15px rgba(57,255,20,0.3)" }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  audioManager.playSfx("tap_nav", 0.15);
                  setTutPhase("pack");
                }}
                className="w-full py-4 bg-zinc-950/60 border border-[#39FF14] text-[#39FF14] font-mono text-xs font-bold tracking-[0.25em] uppercase hover:bg-[#39FF14]/10 transition-all rounded-sm"
              >
                RECONSTRUCT SIGNAL
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* PHASE 4: CINEMATIC PACK OPENING */}
        {tutPhase === "pack" && (
          <motion.div
            key="pack"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-[#050402]"
          >
            {dailyCard && (
              <PackContainer
                meta={welcomePackMeta}
                cards={getMockOwnedCard()}
                onComplete={() => {
                  audioManager.playSfx("tap_nav", 0.15);
                  setTutPhase("discovery");
                }}
              />
            )}
          </motion.div>
        )}

        {/* PHASE 5: DISCOVERY & CONCEPT EXPLAINER */}
        {tutPhase === "discovery" && (
          <motion.div
            key="discovery"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="flex-1 flex flex-col items-center justify-between py-6 px-4 overflow-y-auto relative z-10"
          >
            <div className="text-center mt-3">
              <div className="font-mono text-[9px] text-[#39FF14] tracking-[0.4em] mb-1.5 uppercase">
                // DATA DECRYPTED //
              </div>
              <h2 className="font-mono text-xl font-bold tracking-widest text-white uppercase">
                COLLECTIBLE SIGNALS
              </h2>
            </div>

            {/* Display Unlocked Card & Details */}
            <div className="w-full max-w-md flex flex-col md:flex-row items-center gap-6 my-4 p-4 border border-zinc-900 bg-black/60 rounded-sm">
              <div className="w-[180px] flex-shrink-0">
                {dailyCard && <Card card={dailyCard} interactive={false} showAudio={false} />}
              </div>
              
              <div className="flex-1 space-y-4 text-left font-mono">
                <div>
                  <div className="text-[10px] text-zinc-500 uppercase">SIGNAL ID</div>
                  <div className="text-xs font-bold text-white uppercase">{dailySong?.title || "TRANSMISSION 001"}</div>
                </div>
                <div>
                  <div className="text-[10px] text-zinc-500 uppercase">METADATA SPECS</div>
                  <div className="text-xs text-zinc-300">
                    BPM: {dailySong?.bpm || 110} // MOOD: {dailySong?.moodTag || "Melancholic"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-zinc-500 uppercase">FACTION LINK</div>
                  <div className="text-xs text-[#39FF14] font-bold uppercase">VOID FACTION</div>
                </div>
                <div className="text-[11px] text-zinc-400 leading-relaxed border-t border-zinc-900 pt-3">
                  Every song in PIM is a collectible card. Unlocking cards integrates them into your playable library, enabling custom multipliers and score achievements.
                </div>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                audioManager.playSfx("tap_nav", 0.15);
                setTutPhase("aspiration");
              }}
              className="px-10 py-3.5 bg-zinc-950/60 border border-[#39FF14] text-[#39FF14] font-mono text-xs font-bold tracking-[0.25em] uppercase hover:bg-[#39FF14]/10 transition-all rounded-sm"
            >
              MONITOR NETWORK FEED →
            </motion.button>
          </motion.div>
        )}

        {/* PHASE 6: SOCIAL ASPIRATION (LEADERBOARDS) */}
        {tutPhase === "aspiration" && (
          <motion.div
            key="aspiration"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="flex-1 flex flex-col items-center justify-between py-6 px-4 overflow-y-auto relative z-10"
          >
            <div className="text-center mt-3">
              <div className="font-mono text-[9px] text-[#39FF14] tracking-[0.4em] mb-1.5 uppercase">
                // GLOBAL TRANSMISSIONS //
              </div>
              <h2 className="font-mono text-xl font-bold tracking-widest text-white uppercase">
                NETWORK STATUS
              </h2>
            </div>

            {/* Aspiration feed container */}
            <div className="w-full max-w-sm border border-zinc-900 bg-black/60 p-5 space-y-4 rounded-sm">
              <div className="font-mono text-[10px] text-zinc-500 tracking-wider pb-2 border-b border-zinc-900 uppercase">
                Live collector operations
              </div>
              
              <div className="space-y-3.5 font-mono text-xs">
                {/* Score accomplishment */}
                <div className="flex gap-3 items-start border-b border-zinc-900 pb-3">
                  <div className="w-7 h-7 flex-shrink-0 bg-red-950/20 border border-red-500/30 flex items-center justify-center text-red-400 font-bold">1</div>
                  <div>
                    <div className="text-white font-bold uppercase">0x71a...9bSECURED SCORE</div>
                    <div className="text-[10px] text-zinc-400">999,500 on BR34K_OF_LIGHT [MYTHIC]</div>
                  </div>
                </div>

                {/* Glitched Variant pull */}
                <div className="flex gap-3 items-start border-b border-zinc-900 pb-3">
                  <div className="w-7 h-7 flex-shrink-0 bg-yellow-950/20 border border-yellow-500/30 flex items-center justify-center text-yellow-400 font-bold">2</div>
                  <div>
                    <div className="text-white font-bold uppercase">cyber_scribePULLED GLITCHED</div>
                    <div className="text-[10px] text-zinc-400">TRANSMISSION 001 [ALT VERSE 3/10]</div>
                  </div>
                </div>

                {/* Faction change */}
                <div className="flex gap-3 items-start pb-1">
                  <div className="w-7 h-7 flex-shrink-0 bg-purple-950/20 border border-purple-500/30 flex items-center justify-center text-purple-400 font-bold">3</div>
                  <div>
                    <div className="text-white font-bold uppercase">analog_dreamerSHIFTS ALIGNMENT</div>
                    <div className="text-[10px] text-zinc-400">Equipped Analog theme skin on all signals</div>
                  </div>
                </div>
              </div>

              <div className="text-[10px] text-zinc-500 leading-normal border-t border-zinc-900 pt-3 font-mono">
                The network preserves limited variants, glitched prints, custom remix cuts, and visual skin overhauls to represent your identity on the global stages.
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                audioManager.playSfx("tap_nav", 0.15);
                setTutPhase("faction");
              }}
              className="px-10 py-3.5 bg-zinc-950/60 border border-[#39FF14] text-[#39FF14] font-mono text-xs font-bold tracking-[0.25em] uppercase hover:bg-[#39FF14]/10 transition-all rounded-sm"
            >
              ESTABLISH ALIGNMENT →
            </motion.button>
          </motion.div>
        )}

        {/* PHASE 7: FACTION SELECT & REGISTRATION LOCK-IN */}
        {tutPhase === "faction" && (
          <motion.div
            key="faction"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="flex-1 flex flex-col items-center justify-between py-6 px-4 overflow-y-auto relative z-10"
          >
            <div className="text-center mt-3">
              <div className="font-mono text-[9px] text-[#39FF14] tracking-[0.4em] mb-1.5 uppercase">
                // SELECT INTEL FACTION //
              </div>
              <h2 className="font-mono text-xl font-bold tracking-widest text-white uppercase">
                ALIGNMENT IDENTIFICATION
              </h2>
            </div>

            {/* Tribal Faction grid */}
            {!selectedFaction ? (
              <div className="w-full max-w-sm grid grid-cols-1 gap-2.5 my-3">
                {[
                  { id: "LIGHT", name: "LIGHT FACTION", desc: "Harmonic tones, clean synth loops, pure frequencies.", color: "#39FF14" },
                  { id: "DARK", name: "DARK COLLECTIVE", desc: "Industrial bass waves, distorted frequencies, heavy beats.", color: "#FF1493" },
                  { id: "VOID", name: "VOID COLLECTIVE", desc: "Ethereal ambient breaks, silent spaces, deep cosmic delays.", color: "#b44dff" },
                  { id: "ANALOG", name: "ANALOG UNION", desc: "Warm tape crackles, organic vintage instrumentation, vinyl vibes.", color: "#ffaa00" },
                  { id: "CHAOS", name: "CHAOS SECTOR", desc: "Breakcore glitch layers, high speed breaks, volatile signals.", color: "#ef4444" }
                ].map(fac => (
                  <button
                    key={fac.id}
                    onClick={() => {
                      setSelectedFaction(fac.id);
                      localStorage.setItem("user_faction", fac.id);
                      audioManager.playSfx("platinum_get", 0.65);
                    }}
                    className="p-3 bg-zinc-950/65 border border-zinc-900 text-left hover:border-white/30 active:bg-zinc-900/40 transition-all rounded-sm flex justify-between items-center group"
                  >
                    <div>
                      <div className="font-mono font-bold text-xs uppercase group-hover:text-white" style={{ color: fac.color }}>
                        {fac.name}
                      </div>
                      <div className="font-mono text-[10px] text-zinc-500 leading-tight mt-1">
                        {fac.desc}
                      </div>
                    </div>
                    <div className="font-mono text-[9px] text-zinc-700 group-hover:text-zinc-400 pl-4 tracking-widest flex-shrink-0">
                      [ CONNECT ]
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-full max-w-sm border border-zinc-900 bg-black/75 p-6 text-center space-y-6 rounded-sm relative"
              >
                {/* Faction glow */}
                <div className="absolute inset-0 blur-xl pointer-events-none rounded-full" style={{
                  background: `radial-gradient(circle, ${selectedFaction === "LIGHT" ? "#39FF14" : selectedFaction === "DARK" ? "#FF1493" : selectedFaction === "VOID" ? "#b44dff" : selectedFaction === "ANALOG" ? "#ffaa00" : "#ef4444"}20 0%, transparent 60%)`
                }} />
                
                <div className="font-mono text-[9px] text-zinc-500 uppercase tracking-widest">
                  FACTION INTEGRATION SECURED
                </div>
                <h3 className="font-mono text-2xl font-black text-white tracking-widest uppercase">
                  {selectedFaction} FACTION
                </h3>

                <div className="font-mono text-[11px] text-zinc-400 leading-relaxed border-t border-zinc-900 pt-4">
                  Neural link sync protocol completed. Connect your profile wallet address to preserve unlocked signal metadata and write card provenance records.
                </div>

                <div className="space-y-2.5 pt-2">
                  <button
                    onClick={() => {
                      localStorage.setItem("pim_tutorial_completed", "true");
                      audioManager.playSfx("tap_nav", 0.15);
                      setLocation("/vault");
                    }}
                    className="w-full py-3.5 bg-gradient-to-r from-yellow-500 to-amber-500 text-black font-mono text-xs font-bold tracking-[0.25em] uppercase hover:shadow-lg transition-all rounded-sm border-none cursor-pointer"
                  >
                    SECURE PROFILE / CONNECT
                  </button>
                  
                  <button
                    onClick={handleCompleteTutorial}
                    className="w-full py-3 bg-zinc-950/70 border border-zinc-800 text-zinc-400 font-mono text-[10px] font-bold tracking-[0.25em] uppercase hover:text-white hover:border-zinc-500 transition-all rounded-sm cursor-pointer"
                  >
                    PROCEED AS GUEST
                  </button>
                </div>
              </motion.div>
            )}

            {/* Faction go back trigger */}
            {selectedFaction && (
              <button
                onClick={() => setSelectedFaction(null)}
                className="font-mono text-[9px] text-zinc-600 hover:text-zinc-400 uppercase tracking-widest select-none mt-2"
              >
                ← RE-CHOOSE ALIGNMENT
              </button>
            )}
            {!selectedFaction && <div className="h-4" />}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
