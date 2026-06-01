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
    const completed = localStorage.getItem("pim_tutorial_completed") === "true";
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
    label: "COMPATIBILITY PACK",
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
    audioManager.playSfx("tap_nav", 0.15);
    setLocation("/arcade");
  };

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-[#050505] text-white z-[80]">
      {/* CRT Scanline screen effects */}
      <div className="absolute inset-0 pointer-events-none z-[99]" style={{
        backgroundImage: "linear-gradient(rgba(57,255,20,0.012) 1px, transparent 1px), linear-gradient(90deg, rgba(57,255,20,0.012) 1px, transparent 1px)",
        backgroundSize: "36px 36px",
      }} />
      <div className="absolute inset-0 pointer-events-none z-[99]" style={{
        background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 0, 0, 0.15) 2px, rgba(0, 0, 0, 0.15) 4px)"
      }} />

      {/* Retro corner bracket design system */}
      <div className="absolute top-4 left-4 pointer-events-none font-mono text-[8px] text-[#39FF14]/40 tracking-widest z-10">
        NET_SYS // PROT_0x88F
      </div>
      <div className="absolute top-4 right-4 pointer-events-none font-mono text-[8px] text-[#39FF14]/40 tracking-widest z-10">
        SECTOR // ONBOARDING
      </div>

      {isReplay && tutPhase !== "complete" && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-[9px] px-3 py-1 tracking-widest uppercase rounded-full z-20 flex items-center gap-1.5 shadow-[0_0_15px_rgba(245,158,11,0.1)]">
          <Lock size={10} /> REPLAY MODE — NO REWARDS CAN BE CLAIMED
        </div>
      )}

      <AnimatePresence mode="wait">
        {/* PHASE 1: UNDERGROUND INTRO */}
        {tutPhase === "intro" && (
          <motion.div
            key="intro"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center p-6 text-center relative z-10"
          >
            {/* Glowing neon ring */}
            <motion.div
              animate={{ opacity: [0.15, 0.35, 0.15], scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
              className="absolute w-[320px] h-[320px] rounded-full border border-[#39FF14]/10 bg-gradient-to-b from-[#39FF14]/5 to-transparent blur-3xl pointer-events-none"
            />

            <div className="relative border border-[#39FF14]/30 bg-black/75 p-8 max-w-sm w-full shadow-[0_0_40px_rgba(57,255,20,0.1)] rounded-sm">
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

              {dailySong ? (
                <motion.button
                  whileHover={{ scale: 1.03, boxShadow: "0 0 20px rgba(57,255,20,0.4)" }}
                  whileTap={{ scale: 0.98 }}
                  onClick={startGameplay}
                  className="w-full py-4 bg-zinc-950/60 border border-[#39FF14] text-[#39FF14] font-mono text-xs font-bold tracking-[0.3em] uppercase hover:bg-[#39FF14]/10 transition-all rounded-sm cursor-pointer"
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

        {/* PHASE 3: THE "SCORE DETERMINES FATE" RESULTS READOUT */}
        {tutPhase === "results" && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="flex-1 flex flex-col items-center justify-center p-6 text-center relative z-10"
          >
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
                  <span className="text-zinc-500">SCORE RECORDED</span>
                  <span className="text-[#39FF14] font-bold">{score}</span>
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
                  {isReplay ? "DEMO PLAYTHROUGH COMPLETED" : "⭐ MYTHIC DECRYPTION TIER SECURED ⭐"}
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.03, boxShadow: "0 0 15px rgba(57,255,20,0.3)" }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  audioManager.playSfx("tap_nav", 0.15);
                  setTutPhase("pack");
                }}
                className="w-full py-4 bg-zinc-950/60 border border-[#39FF14] text-[#39FF14] font-mono text-xs font-bold tracking-[0.25em] uppercase hover:bg-[#39FF14]/10 transition-all rounded-sm cursor-pointer"
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
              className="px-10 py-3.5 bg-zinc-950/60 border border-[#39FF14] text-[#39FF14] font-mono text-xs font-bold tracking-[0.25em] uppercase hover:bg-[#39FF14]/10 transition-all rounded-sm cursor-pointer"
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

            <div className="w-full max-w-sm border border-zinc-900 bg-black/60 p-5 space-y-4 rounded-sm">
              <div className="font-mono text-[10px] text-zinc-500 tracking-wider pb-2 border-b border-zinc-900 uppercase">
                Live collector operations
              </div>
              
              <div className="space-y-3.5 font-mono text-xs">
                <div className="flex gap-3 items-start border-b border-zinc-900 pb-3">
                  <div className="w-7 h-7 flex-shrink-0 bg-red-950/20 border border-red-500/30 flex items-center justify-center text-red-400 font-bold">1</div>
                  <div>
                    <div className="text-white font-bold uppercase">0x71a...9bSECURED SCORE</div>
                    <div className="text-[10px] text-zinc-400">999,500 on BR34K_OF_LIGHT [MYTHIC]</div>
                  </div>
                </div>

                <div className="flex gap-3 items-start border-b border-zinc-900 pb-3">
                  <div className="w-7 h-7 flex-shrink-0 bg-yellow-950/20 border border-yellow-500/30 flex items-center justify-center text-yellow-400 font-bold">2</div>
                  <div>
                    <div className="text-white font-bold uppercase">cyber_scribePULLED GLITCHED</div>
                    <div className="text-[10px] text-zinc-400">TRANSMISSION 001 [ALT VERSE 3/10]</div>
                  </div>
                </div>

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
                setTutPhase("complete");
              }}
              className="px-10 py-3.5 bg-zinc-950/60 border border-[#39FF14] text-[#39FF14] font-mono text-xs font-bold tracking-[0.25em] uppercase hover:bg-[#39FF14]/10 transition-all rounded-sm cursor-pointer"
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
              <div className="font-mono text-[9px] text-[#39FF14] tracking-[0.4em] mb-1.5 uppercase">
                // SYNC SYSTEM COMPLETE //
              </div>
              <h2 className="font-mono text-xl font-bold tracking-widest text-white uppercase">
                CONNECTION SECURED
              </h2>
            </div>

            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-sm border border-zinc-900 bg-black/75 p-6 text-center space-y-6 rounded-sm relative"
            >
              <div className="absolute inset-0 blur-xl pointer-events-none rounded-full" style={{
                background: `radial-gradient(circle, #39FF1420 0%, transparent 60%)`
              }} />
              
              <div className="font-mono text-[9px] text-zinc-500 uppercase tracking-widest">
                NEURAL LINK ACTIVE
              </div>
              <h3 className="font-mono text-2xl font-black text-[#39FF14] tracking-widest uppercase">
                ARCHIVE READY
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

            <div className="h-4" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
