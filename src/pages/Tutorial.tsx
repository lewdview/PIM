import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { loadOpts, keyLabel } from "../lib/options";
import { audioManager } from "../game/audio";
import { getCurrentDay } from "../utils/dayCalc";
import { getCardByDay, claimDailyCard } from "../services/vaultService";
import { loadCatalog, type GameSong } from "../game/api";
import Card from "../components/Card";
import RarityBadge from "../components/RarityBadge";
import PackContainer from "../components/cinematic/PackContainer";
import type { RevealPackMeta } from "../store/useVaultStore";
import type { OwnedCard } from "../services/vaultService";
import { Volume2, Award, Zap, Shield, HelpCircle, Layers, Lock } from "lucide-react";
import { supabase } from "../services/supabaseClient";
import { useVaultStore } from "../store/useVaultStore";
import { useAuthStore } from "../store/useAuthStore";

type TutorialPhase = "intro" | "gameplay" | "results" | "pack" | "discovery" | "aspiration" | "complete";

export default function Tutorial() {
  const [, setLocation] = useLocation();
  const [tutPhase, setTutPhase] = useState<TutorialPhase>("intro");
  const [dailyCard, setDailyCard] = useState<any>(null);
  const [dailySong, setDailySong] = useState<GameSong | null>(null);
  const [score, setScore] = useState(0);

  // Reward and replay management states
  const [isReplay, setIsReplay] = useState(false);
  const [claimedCard, setClaimedCard] = useState<OwnedCard | null>(null);
  const [hasAttemptedClaim, setHasAttemptedClaim] = useState(false);
  const [claimingStatus, setClaimingStatus] = useState<"idle" | "claiming" | "success" | "skipped" | "error">("idle");

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

    // Check if the tutorial was already completed (replay mode)
    const completed = localStorage.getItem("pim_tutorial_completed") === "true" || useVaultStore.getState().progression.tutorialCompleted;
    setIsReplay(completed);

    // Parse URL query parameters to restore tutorial phase and score
    const params = new URLSearchParams(window.location.search);
    const phaseParam = params.get("phase");
    const scoreParam = params.get("score");
    if (phaseParam === "results") {
      setTutPhase("results");
      if (scoreParam) {
        setScore(parseInt(scoreParam, 10) || 0);
      }
    }
  }, []);

  // Attempt to claim the actual card reward if not a replay and user is authenticated
  useEffect(() => {
    if (tutPhase === "results" && !hasAttemptedClaim && !isReplay) {
      setHasAttemptedClaim(true);
      setClaimingStatus("claiming");
      supabase.auth.getUser().then(async ({ data }) => {
        if (data?.user) {
          const today = getCurrentDay();
          try {
            const owned = await claimDailyCard(today);
            if (owned) {
              setClaimedCard(owned);
              useVaultStore.getState().addToCollection([owned]);
              setClaimingStatus("success");
            } else {
              setClaimingStatus("skipped"); // already claimed on server today
            }
          } catch (err) {
            console.error("Failed to claim daily card in onboarding:", err);
            setClaimingStatus("error");
          }
        } else {
          setClaimingStatus("skipped"); // Guest user, will claim on connect
        }
      });
    }
  }, [tutPhase, hasAttemptedClaim, isReplay]);

  // Start Phase 2 Gameplay in the actual GamePlay engine
  const startGameplay = useCallback(() => {
    if (!dailySong) return;
    
    // Play transition SFX
    audioManager.playSfx("select_start_song", 0.7);

    // Redirect to GamePlay engine with ?tutorial=true
    setLocation(`/play/${dailySong.id}?tutorial=true`);
  }, [dailySong, setLocation]);

  // Mock pack meta for Phase 4 pack opening
  const welcomePackMeta: RevealPackMeta = {
    category: "taste",
    size: "single",
    label: "WELCOME TRANSMISSION",
    icon: "⚡",
    accent: "#39FF14",
    gradient: "linear-gradient(160deg, #050d03 0%, #0d280b 45%, #020702 100%)",
    price: "FREE",
    cardCount: 1,
    revealType: "cinematic",
  };

  // Mock owned card container for guest or replay fallbacks
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
    useVaultStore.getState().updateProgression({ tutorialCompleted: true });
    audioManager.playSfx("tap_nav", 0.15);
    setLocation("/arcade");
  };  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-[#090807] text-white z-[80]">
      {/* CRT Scanline & grid screen effects */}
      <div className="absolute inset-0 pointer-events-none z-[99]" style={{
        backgroundImage: "linear-gradient(rgba(255,20,147,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(0,229,255,0.015) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }} />
      <div className="absolute inset-0 pointer-events-none z-[99]" style={{
        background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 0, 0, 0.2) 2px, rgba(0, 0, 0, 0.2) 4px)"
      }} />

      {/* Decorative stomp headers */}
      <div className="absolute top-4 left-4 pointer-events-none font-mono text-[9px] text-[#00E5FF]/60 font-black tracking-widest z-10 uppercase">
        SYS_VER // PIM_VAULT_v2
      </div>
      <div className="absolute top-4 right-4 pointer-events-none font-mono text-[9px] text-[#FF1493]/60 font-black tracking-widest z-10 uppercase">
        SECTOR // RESONANCE_SYNC
      </div>

      {isReplay && tutPhase !== "complete" && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 bg-amber-500/20 border-2 border-black text-amber-300 font-mono text-[9px] font-black px-4 py-1.5 tracking-widest uppercase rounded-sm z-20 flex items-center gap-1.5 shadow-[4px_4px_0px_#000]">
          <Lock size={10} /> REPLAY MODE — NO REWARDS GRANTED
        </div>
      )}

      <AnimatePresence mode="wait">
        {/* PHASE 1: UNDERGROUND INTRO */}
        {tutPhase === "intro" && (
          <motion.div
            key="intro"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex-1 flex flex-col items-center justify-center p-6 text-center relative z-10"
          >
            <motion.div
              animate={{ opacity: [0.1, 0.25, 0.1], scale: [1, 1.05, 1] }}
              transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
              className="absolute w-[400px] h-[400px] rounded-full bg-gradient-to-tr from-[#FF1493]/10 via-[#00E5FF]/10 to-[#39FF14]/10 blur-3xl pointer-events-none"
            />

            <div className="relative border-4 border-black bg-[#151311] p-8 max-w-sm w-full shadow-[8px_8px_0px_#000] rounded-lg">
              {/* Corner accent bracket blocks */}
              <div className="absolute -top-3.5 -left-3.5 w-6 h-6 bg-[#FF1493] border-4 border-black" />
              <div className="absolute -top-3.5 -right-3.5 w-6 h-6 bg-[#00E5FF] border-4 border-black" />
              <div className="absolute -bottom-3.5 -left-3.5 w-6 h-6 bg-[#39FF14] border-4 border-black" />
              <div className="absolute -bottom-3.5 -right-3.5 w-6 h-6 bg-yellow-400 border-4 border-black" />

              <div className="font-mono text-[9px] text-zinc-400 tracking-[0.4em] mb-3 uppercase font-black">
                // SYSTEM DETECTED //
              </div>
              <h1 className="font-mono text-4xl font-extrabold text-white tracking-tighter mb-6 leading-none uppercase">
                ESTABLISH <br />
                <span className="text-[#FF1493]">SYNC</span>
              </h1>
              
              <div className="space-y-3 font-mono text-[11px] text-zinc-300 leading-relaxed mb-8 border-t-2 border-black pt-4 text-left">
                <p className="text-[#39FF14] font-black tracking-wide animate-pulse">⚡ LINK STABLE. READY FOR TEST RUN.</p>
                <p className="flex justify-between border-b border-black/30 pb-1.5"><span className="text-zinc-500">RELEASE TYPE:</span> <span className="font-black text-[#00E5FF] uppercase">Digital Collectible</span></p>
                <p className="flex justify-between border-b border-black/30 pb-1.5"><span className="text-zinc-500">DIFFICULTY:</span> <span className="font-black text-yellow-400 uppercase">Training Calibrated</span></p>
                <p className="text-[10px] text-zinc-400 mt-2 leading-relaxed">
                  Establish compatibility by playing the trial release. Complete the transmission to integrate your card and unlock profile multipliers.
                </p>
              </div>

              {dailySong ? (
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={startGameplay}
                  className="w-full py-4.5 bg-gradient-to-r from-[#FF1493] to-[#ff3800] text-black font-black text-xs tracking-[0.25em] uppercase hover:opacity-95 transition-all rounded border-2 border-black shadow-[4px_4px_0px_#000] cursor-pointer"
                >
                  PROVE COMPATIBILITY
                </motion.button>
              ) : (
                <div className="font-mono text-[10px] text-zinc-500 animate-pulse py-2">
                  DECRYPTION IN PROGRESS...
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* PHASE 3: ONBOARDING RESULTS */}
        {tutPhase === "results" && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="flex-1 flex flex-col items-center justify-center p-6 text-center relative z-10"
          >
            <div className="relative border-4 border-black bg-[#151311] p-8 max-w-sm w-full shadow-[8px_8px_0px_#000] rounded-lg">
              {/* Corner accent bracket blocks */}
              <div className="absolute -top-3.5 -left-3.5 w-6 h-6 bg-[#FF1493] border-4 border-black" />
              <div className="absolute -top-3.5 -right-3.5 w-6 h-6 bg-[#00E5FF] border-4 border-black" />
              <div className="absolute -bottom-3.5 -left-3.5 w-6 h-6 bg-[#39FF14] border-4 border-black" />
              <div className="absolute -bottom-3.5 -right-3.5 w-6 h-6 bg-yellow-400 border-4 border-black" />

              {/* Massive stomp-style rating badge */}
              <motion.div 
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: -6 }}
                transition={{ type: "spring", stiffness: 200, damping: 12 }}
                className="w-20 h-20 mx-auto rounded-lg bg-gradient-to-br from-[#39FF14] to-[#00E5FF] border-4 border-black shadow-[5px_5px_0px_#000] flex items-center justify-center text-3xl font-black text-black mb-5"
              >
                S+
              </motion.div>

              <div className="font-mono text-[9px] text-[#FF1493] tracking-[0.4em] mb-2 uppercase font-black">
                // DECRYPTION SYNCED //
              </div>
              <h2 className="font-mono text-2xl font-black tracking-tighter text-white uppercase mb-6 leading-none">
                RESONANCE ACQUIRED
              </h2>

              <div className="space-y-3.5 border-y-2 border-black py-4 mb-8 text-left font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-zinc-500">SIGNAL STABILITY</span>
                  <span className="text-white font-bold">100.0% [STABLE]</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">SYNAPSE RESPONSE</span>
                  <span className="text-[#39FF14] font-black uppercase">CONFIRMED</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">ONBOARDING SCORE</span>
                  <span className="text-[#00E5FF] font-black">{score}</span>
                </div>

                {/* Progress decoding bar */}
                <div className="mt-3">
                  <div className="flex justify-between text-[8px] text-zinc-500 mb-1 font-black uppercase">
                    <span>Decrypted File Status:</span>
                    <span>100% SECURE</span>
                  </div>
                  <div className="h-2.5 bg-zinc-950 border-2 border-black relative overflow-hidden rounded-sm">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: "100%" }}
                      transition={{ duration: 1.2 }}
                      className="h-full bg-[#39FF14]"
                    />
                  </div>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  audioManager.playSfx("tap_nav", 0.15);
                  setTutPhase("pack");
                }}
                className="w-full py-4 bg-gradient-to-r from-[#39FF14] to-[#00E5FF] text-black font-black text-xs tracking-[0.2em] uppercase hover:opacity-95 transition-all rounded border-2 border-black shadow-[4px_4px_0px_#000] cursor-pointer"
              >
                CLAIM SIGNAL & CONNECT
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
                cards={claimedCard ? [claimedCard] : getMockOwnedCard()}
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
              <div className="font-mono text-[9px] text-[#00E5FF] tracking-[0.4em] mb-1 uppercase font-black">
                // SYSTEM DECRYPTED //
              </div>
              <h2 className="font-mono text-2xl font-black tracking-widest text-white uppercase">
                COLLECTIBLE SIGNALS
              </h2>
            </div>

            {/* Display Unlocked Card & Details */}
            <div className="w-full max-w-md flex flex-col md:flex-row items-center gap-6 my-4 p-5 border-4 border-black bg-[#151311] shadow-[6px_6px_0px_#000] rounded-lg">
              <div className="w-[170px] flex-shrink-0 relative">
                {dailyCard && <Card card={dailyCard} interactive={false} showAudio={false} />}
                {/* Glow ring */}
                <div className="absolute -inset-2 rounded-lg border-2 border-[#00E5FF]/20 animate-pulse pointer-events-none -z-10" />
              </div>
              
              <div className="flex-1 space-y-4 text-left font-mono">
                <div>
                  <div className="text-[9px] text-zinc-500 font-bold uppercase">SIGNAL ID</div>
                  <div className="text-sm font-black text-white uppercase">{dailySong?.title || "TRANSMISSION 001"}</div>
                </div>
                <div>
                  <div className="text-[9px] text-zinc-500 font-bold uppercase">METADATA SPECS</div>
                  <div className="text-xs text-zinc-300 font-bold">
                    BPM: {dailySong?.bpm || 110} // MOOD: {dailySong?.mood || "dark"}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] text-zinc-500 font-bold uppercase">FACTION LINK</div>
                  <div className="text-xs text-[#39FF14] font-black uppercase">PIM CORE NETWORK</div>
                </div>
                <div className="text-[11px] text-zinc-400 leading-relaxed border-t-2 border-black pt-3">
                  Every release in PIM is a collectible card. Unlocking cards integrates them into your playable library, enabling custom multipliers and score achievements.
                </div>
              </div>
            </div>

            {/* Explainer ecosystem cards - Stomp style */}
            <div className="w-full max-w-md grid grid-cols-1 gap-2.5 my-3">
              {[
                { title: "🎵 DIGITAL COLLECTIBLES", text: "Songs are owned cards. Accessing them builds your playable deck.", accent: "#FF1493" },
                { title: "💎 SCARCITY & PROVENANCE", text: "Limited prints, glitched codes, visual skins, and alt-verse releases.", accent: "#00E5FF" },
                { title: "⚡ VALUE ENGINE MULTIPLIERS", text: "Equipped collections boost score multipliers for leaderboard dominance.", accent: "#39FF14" }
              ].map((item, idx) => (
                <div key={idx} className="p-3 border-2 border-black bg-[#11100f] shadow-[3px_3px_0px_#000] rounded text-left flex items-start gap-3">
                  <div className="w-2 h-full rounded" style={{ background: item.accent }} />
                  <div>
                    <div className="font-mono text-[10px] font-black uppercase text-white" style={{ color: item.accent }}>{item.title}</div>
                    <div className="font-mono text-[10px] text-zinc-400 mt-1 leading-normal">{item.text}</div>
                  </div>
                </div>
              ))}
            </div>

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                audioManager.playSfx("tap_nav", 0.15);
                setTutPhase("aspiration");
              }}
              className="px-10 py-4 bg-gradient-to-r from-[#FF1493] to-[#ff3800] text-black font-black text-xs tracking-[0.25em] uppercase hover:opacity-95 transition-all rounded border-2 border-black shadow-[4px_4px_0px_#000] cursor-pointer"
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
              <div className="font-mono text-[9px] text-[#39FF14] tracking-[0.4em] mb-1.5 uppercase font-black">
                // GLOBAL CODES //
              </div>
              <h2 className="font-mono text-2xl font-black tracking-widest text-white uppercase">
                NETWORK STATUS
              </h2>
            </div>

            <div className="w-full max-w-sm border-4 border-black bg-[#151311] p-6 space-y-4 rounded-lg shadow-[8px_8px_0px_#000]">
              <div className="font-mono text-[9px] text-zinc-500 font-bold tracking-wider pb-2 border-b-2 border-black uppercase">
                Live collector operations
              </div>
              
              <div className="space-y-3 font-mono text-xs">
                {[
                  { rank: "1", color: "#FFD700", name: "0x71a...9bSECURED SCORE", desc: "999,500 on BR34K_OF_LIGHT [MYTHIC]" },
                  { rank: "2", color: "#C0C0C0", name: "cyber_scribePULLED GLITCHED", desc: "TRANSMISSION 001 [ALT VERSE 3/10]" },
                  { rank: "3", color: "#CD7F32", name: "analog_dreamerSHIFTS ALIGN", desc: "Equipped Analog theme skin on all signals" }
                ].map((row, idx) => (
                  <div key={idx} className="flex gap-3 items-center border-b border-black/30 pb-3">
                    <div className="w-7 h-7 flex-shrink-0 border-2 border-black flex items-center justify-center font-black rounded-sm shadow-[2px_2px_0px_#000]" style={{ background: row.color + '20', color: row.color, borderColor: '#000' }}>
                      {row.rank}
                    </div>
                    <div>
                      <div className="text-white font-black text-[11px] uppercase tracking-tighter">{row.name}</div>
                      <div className="text-[9px] text-zinc-400 mt-0.5">{row.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="text-[10px] text-zinc-500 leading-normal border-t-2 border-black pt-3 font-mono">
                The network preserves limited variants, glitched prints, custom remix cuts, and visual skin overhauls to represent your identity on the global stages.
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                audioManager.playSfx("tap_nav", 0.15);
                setTutPhase("complete");
              }}
              className="px-10 py-4 bg-gradient-to-r from-[#39FF14] to-[#00E5FF] text-black font-black text-xs tracking-[0.25em] uppercase hover:opacity-95 transition-all rounded border-2 border-black shadow-[4px_4px_0px_#000] cursor-pointer"
            >
              COMPLETE CONNECTION →
            </motion.button>
          </motion.div>
        )}

        {/* PHASE 7: FACTION SELECT & REGISTRATION LOCK-IN */}
        {tutPhase === "complete" && (
          <motion.div
            key="complete"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="flex-1 flex flex-col items-center justify-between py-6 px-4 overflow-y-auto relative z-10"
          >
            <div className="text-center mt-3">
              <div className="font-mono text-[9px] text-yellow-400 tracking-[0.4em] mb-1.5 uppercase font-black">
                // SYNC SYSTEM COMPLETE //
              </div>
              <h2 className="font-mono text-2xl font-black tracking-widest text-white uppercase">
                CONNECTION SECURED
              </h2>
            </div>

            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-sm border-4 border-black bg-[#151311] p-6 text-center space-y-6 rounded-lg shadow-[8px_8px_0px_#000] relative"
            >
              <div className="absolute inset-0 blur-2xl pointer-events-none rounded-full" style={{
                background: `radial-gradient(circle, #39FF1415 0%, transparent 60%)`
              }} />
              
              <div className="font-mono text-[9px] text-[#00E5FF] uppercase tracking-widest font-black">
                NEURAL LINK ACTIVE
              </div>
              <h3 className="font-mono text-3xl font-extrabold text-white tracking-tight uppercase leading-none">
                ARCHIVE <br />
                <span className="text-[#39FF14]">READY</span>
              </h3>

              <div className="font-mono text-[11px] text-zinc-300 leading-relaxed border-t-2 border-black pt-4">
                Neural link sync protocol completed. Connect your profile wallet address to preserve unlocked signal metadata and write card provenance records.
              </div>

              <div className="space-y-3 pt-2">
                <button
                  onClick={() => {
                    localStorage.setItem("pim_tutorial_completed", "true");
                    useVaultStore.getState().updateProgression({ tutorialCompleted: true });
                    audioManager.playSfx("tap_nav", 0.15);
                    setLocation("/vault");
                    useAuthStore.getState().setShowAuthModal(true);
                  }}
                  className="w-full py-4 bg-gradient-to-r from-yellow-400 to-amber-500 text-black font-black text-xs tracking-[0.2em] uppercase hover:scale-[1.02] transition-all rounded border-2 border-black shadow-[4px_4px_0px_#000] cursor-pointer"
                >
                  SECURE PROFILE / CONNECT
                </button>
                
                <button
                  onClick={handleCompleteTutorial}
                  className="w-full py-3 bg-zinc-950/70 border-2 border-black text-zinc-400 font-mono text-[10px] font-black tracking-[0.2em] uppercase hover:text-white transition-all rounded shadow-[3px_3px_0px_#000] cursor-pointer"
                >
                  PROCEED AS GUEST
                </button>
              </div>
            </motion.div>

            <div className="h-4" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
