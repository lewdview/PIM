import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Monitor, Layers, Trophy, Wallet, Zap, Clock, Play, Gift, Shield, 
  Sparkles, ChevronRight, ChevronLeft, Volume2, Key, Database, Cpu, 
  ArrowRight, Activity, Flame, Coins, Eye, Terminal, RefreshCw, BarChart2
} from 'lucide-react';
import { useLocation } from 'wouter';
import { haptics } from '../utils/haptics';

// ===== SECTION LABEL =====
function DeckSectionLabel({ label, accent = '#ff3800' }: { label: string; accent?: string }) {
  return (
    <div className="flex items-center gap-3 mb-2">
      <div className="w-1.5 h-6" style={{ background: accent, boxShadow: `0 0 8px ${accent}88` }} />
      <span className="text-[8px] font-mono tracking-[0.4em] uppercase opacity-50">{label}</span>
      <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${accent}20, transparent)` }} />
    </div>
  );
}

export default function PitchDeck() {
  const [, setLocation] = useLocation();
  const [currentSlide, setCurrentSlide] = useState(0);
  const totalSlides = 12;

  // Slide navigation
  const nextSlide = useCallback(() => {
    haptics.lightTap();
    setCurrentSlide((prev) => (prev + 1) % totalSlides);
  }, []);

  const prevSlide = useCallback(() => {
    haptics.lightTap();
    setCurrentSlide((prev) => (prev - 1 + totalSlides) % totalSlides);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') nextSlide();
      if (e.key === 'ArrowLeft') prevSlide();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextSlide, prevSlide]);

  // Slide 2: Retention Loop state
  const [activeLoopStep, setActiveLoopStep] = useState(0);

  // Slide 3: Economy state
  const [activeEconomy, setActiveEconomy] = useState(0);

  // Slide 5: Auth simulation state
  const [authSimStep, setAuthSimStep] = useState<'idle' | 'check_network' | 'personal_sign' | 'eip1271' | 'success'>('idle');
  const [authSimLogs, setAuthSimLogs] = useState<string[]>([]);
  const runAuthSimulation = async () => {
    haptics.lightTap();
    setAuthSimStep('check_network');
    setAuthSimLogs(['[SYSTEM] Initializing wallet check...', '[SYSTEM] Fetching chain ID...']);
    
    await new Promise((r) => setTimeout(r, 800));
    setAuthSimLogs(prev => [...prev, '[WALLET] Connected. Address: 0x86d8b...459e', '[SYSTEM] Chain ID detected: 0x1 (Ethereum). Switch required.']);
    
    await new Promise((r) => setTimeout(r, 600));
    setAuthSimStep('personal_sign');
    setAuthSimLogs(prev => [...prev, '[SYSTEM] Switching to Base Mainnet (0x2105)...', '[WALLET] Switch complete.', '[SYSTEM] Sending signature request challenge...']);
    
    await new Promise((r) => setTimeout(r, 900));
    setAuthSimLogs(prev => [...prev, '[WALLET] User signed message: "Sign in to th3vault on Base. Nonce: 1718293921000"', '[SYSTEM] Signature hash: 0x3d0af8c7b80...']);
    
    await new Promise((r) => setTimeout(r, 700));
    setAuthSimStep('eip1271');
    setAuthSimLogs(prev => [...prev, '[SERVER] Invoking auth-smart-wallet Edge Function...', '[SERVER] Address is Contract: Checking EIP-1271 compatibility...', '[CONTRACT] Calling isValidSignature()...']);
    
    await new Promise((r) => setTimeout(r, 1000));
    setAuthSimStep('success');
    setAuthSimLogs(prev => [...prev, '[CONTRACT] Validation return: valid (0x1626ba7e)', '[SERVER] Creating user profile in profiles table...', '[SYSTEM] JWT Session established successfully! Access granted.']);
  };

  // Slide 6: Canvas Rhythm Engine simulation
  const [rhythmCombo, setRhythmCombo] = useState(0);
  const [rhythmFeedback, setRhythmFeedback] = useState<'PERFECT+' | 'PERFECT' | 'GOOD' | 'MISS' | null>(null);
  const [rhythmPowerUp, setRhythmPowerUp] = useState<'NORMAL' | 'FEVER' | 'SURGE' | 'SIGNAL_LOCK'>('NORMAL');
  const [notes, setNotes] = useState<{ id: number; lane: number; y: number }[]>([]);
  const nextNoteId = useRef(0);

  // Spawn notes periodically for visual simulation
  useEffect(() => {
    if (currentSlide !== 5) return;
    const interval = setInterval(() => {
      setNotes((prev) => {
        // limit to 6 notes
        if (prev.length > 6) return prev;
        const lane = Math.floor(Math.random() * 3);
        const newNote = { id: nextNoteId.current++, lane, y: 0 };
        return [...prev, newNote];
      });
    }, 1200);

    return () => clearInterval(interval);
  }, [currentSlide]);

  // Animate notes scrolling down
  useEffect(() => {
    if (currentSlide !== 5) return;
    const frame = setInterval(() => {
      setNotes((prev) => {
        return prev
          .map((n) => ({ ...n, y: n.y + 2.5 }))
          .filter((n) => {
            if (n.y > 100) {
              // Note missed!
              setRhythmFeedback('MISS');
              setRhythmCombo(0);
              return false;
            }
            return true;
          });
      });
    }, 30);
    return () => clearInterval(frame);
  }, [currentSlide]);

  // Adjust power up state based on combo
  useEffect(() => {
    if (rhythmCombo >= 60) setRhythmPowerUp('SIGNAL_LOCK');
    else if (rhythmCombo >= 40) setRhythmPowerUp('SURGE');
    else if (rhythmCombo >= 20) setRhythmPowerUp('FEVER');
    else setRhythmPowerUp('NORMAL');
  }, [rhythmCombo]);

  const handleKeyPress = (lane: number) => {
    haptics.lightTap();
    // Check if any note in the hit window (y between 78 and 92)
    setNotes((prev) => {
      let hit = false;
      const filtered = prev.filter((n) => {
        if (n.lane === lane && n.y >= 70 && n.y <= 95) {
          hit = true;
          // Calculate rating
          const diff = Math.abs(n.y - 85);
          if (diff <= 3) {
            setRhythmFeedback('PERFECT+');
            setRhythmCombo((c) => c + 1);
          } else if (diff <= 7) {
            setRhythmFeedback('PERFECT');
            setRhythmCombo((c) => c + 1);
          } else {
            setRhythmFeedback('GOOD');
            setRhythmCombo((c) => c + 1);
          }
          return false; // remove note
        }
        return true;
      });
      if (!hit) {
        setRhythmFeedback('MISS');
        setRhythmCombo(0);
      }
      return filtered;
    });
  };

  // Slide 7: Split-band Audio state
  const [bassMuted, setBassMuted] = useState(false);
  const [midMuted, setMidMuted] = useState(false);
  const [trebleMuted, setTrebleMuted] = useState(false);
  const [audioSignalLevel, setAudioSignalLevel] = useState(1.0);

  useEffect(() => {
    let activeBands = 3;
    if (bassMuted) activeBands--;
    if (midMuted) activeBands--;
    if (trebleMuted) activeBands--;
    setAudioSignalLevel(activeBands / 3);
  }, [bassMuted, midMuted, trebleMuted]);

  // Slide 9: Onboarding Ephemeral state
  const [ephemeralSimStep, setEphemeralSimStep] = useState<0 | 1 | 2 | 3>(0);
  const [ephemeralKeyLogs, setEphemeralKeyLogs] = useState<string[]>([]);
  const runEphemeralSimulation = () => {
    haptics.lightTap();
    setEphemeralSimStep(1);
    setEphemeralKeyLogs(['[WEB2] User enters email: collector@cyberpunk.io', '[SERVER] Creating standard Supabase account...']);
    setTimeout(() => {
      setEphemeralSimStep(2);
      setEphemeralKeyLogs(prev => [...prev, '[LOCAL] Email registered successfully.', '[LOCAL] Ephemeral Keypair generated locally.', '[LOCAL] Public Address: 0x91Fda32...2e4f', '[LOCAL] Private Key saved in encrypted LocalStorage: th3vault_ephemeral_pkey_u83...']);
    }, 1200);
    setTimeout(() => {
      setEphemeralSimStep(3);
      setEphemeralKeyLogs(prev => [...prev, '[SERVER] Writing public address to public.profiles table...', '[SYNC] Profile synced.', '[SYSTEM] Ephemeral credentials verified! User ready to claim daily card gaslessly.']);
    }, 2400);
  };

  return (
    <div className="flex-1 w-full min-h-screen relative bg-[#080604] overflow-hidden flex flex-col justify-between">
      {/* SCANLINES & CYBERPUNK STATIC EFFECTS */}
      <div className="scanlines absolute inset-0 opacity-10 pointer-events-none z-10" />

      {/* ambient glows */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[20%] left-[10%] w-[500px] h-[500px] rounded-full blur-[160px] opacity-10"
          style={{ background: 'radial-gradient(circle, #ff3800, transparent 70%)' }} />
        <div className="absolute bottom-[20%] right-[10%] w-[500px] h-[500px] rounded-full blur-[160px] opacity-10"
          style={{ background: 'radial-gradient(circle, #ffb800, transparent 70%)' }} />
      </div>

      {/* HEADER BAR */}
      <header className="px-6 py-4 border-b border-[#ff3800]/25 flex items-center justify-between bg-[#0f0d09]/90 backdrop-blur-md z-20">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#ff3800] flex items-center justify-center rotate-[-4deg] shadow-[2px_2px_0_#000] border-2 border-black">
            <span className="font-mono font-black text-xs text-white">PIM</span>
          </div>
          <div>
            <span className="font-mono font-black text-xs tracking-wider uppercase text-white">PIM // PITCh_DECk</span>
            <span className="block text-[8px] font-mono text-[#ff3800] tracking-widest uppercase">POETRY IN MOTION ECOSYSTEM</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-[9px] font-mono tracking-widest text-[#faf0d8]/40 uppercase">SLIDE {currentSlide + 1} OF {totalSlides}</div>
          <button
            onClick={() => { setLocation('/arcade'); haptics.lightTap(); }}
            className="px-3 py-1 border border-[#ff3800]/50 hover:bg-[#ff3800]/10 text-[#ff3800] text-[9px] font-mono uppercase tracking-wider rounded transition-colors cursor-pointer"
          >
            Launch Arcade
          </button>
        </div>
      </header>

      {/* SLIDE CONTENT AREA */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-6 py-8 flex items-center justify-center z-10 relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.22 }}
            className="w-full h-full min-h-[500px] grid grid-cols-1 md:grid-cols-2 gap-8 items-center"
          >
            
            {/* LEFT SIDE: Description and Details */}
            <div className="space-y-6 flex flex-col justify-center">
              {/* SLIDE 1: INTRO */}
              {currentSlide === 0 && (
                <>
                  <div className="inline-block bg-[#ffb800] text-black px-2.5 py-1 text-[9px] font-mono font-black tracking-widest uppercase rotate-[-2deg] border border-black shadow-[2px_2px_0_#000] w-fit">
                    PRODUCT PITCH DECK
                  </div>
                  <h1 className="text-5xl md:text-7xl font-black brutalist-xl leading-none" style={{ '--neon-accent': '#ff3800' } as any}>
                    POETRY IN MOTION
                  </h1>
                  <p className="font-mono text-xs tracking-widest uppercase text-[#faf0d8]/60">
                    A Hybrid HTML5 Canvas Rhythm Game & Digital Collectible Card Ecosystem Under a Brutalist Cyberpunk Aesthetic.
                  </p>
                  <p className="text-xs text-[#faf0d8]/80 leading-relaxed max-w-md">
                    PIM redirects gaming's retention loop by bridging skill-driven audio action with real-time asset ownership on the Base Mainnet. Live release tracks unlock interactive campaigns, structured token sinks, and community collections.
                  </p>
                  <div className="flex gap-4 pt-2">
                    <div className="flex flex-col border-l-2 border-[#ff3800] pl-3">
                      <span className="text-lg font-black font-mono leading-none">365</span>
                      <span className="text-[8px] font-mono uppercase opacity-50 tracking-wider">DAILY STAGES</span>
                    </div>
                    <div className="flex flex-col border-l-2 border-[#ffb800] pl-3">
                      <span className="text-lg font-black font-mono leading-none">BASE</span>
                      <span className="text-[8px] font-mono uppercase opacity-50 tracking-wider">L2 ETHEREUM</span>
                    </div>
                    <div className="flex flex-col border-l-2 border-[#c44dff] pl-3">
                      <span className="text-lg font-black font-mono leading-none">V⚡</span>
                      <span className="text-[8px] font-mono uppercase opacity-50 tracking-wider">TOKEN ECONOMY</span>
                    </div>
                  </div>
                </>
              )}

              {/* SLIDE 2: RETENTION LOOP */}
              {currentSlide === 1 && (
                <>
                  <DeckSectionLabel label="01 // Engagement Mechanics" accent="#ffb800" />
                  <h2 className="text-3xl md:text-5xl font-black font-mono tracking-tighter uppercase leading-tight">
                    THE THREE-TIERED LOOP
                  </h2>
                  <div className="space-y-4">
                    {[
                      {
                        title: "1. Music Unlocks Gameplay",
                        desc: "Users navigate from TikTok, Spotify, or social channels deep-linked to a free playable arcade level for the daily catalog release."
                      },
                      {
                        title: "2. Gameplay Unlocks Ownership",
                        desc: "Reaching accuracy score thresholds (Bronze, Silver, Gold, Platinum) awards collectible gacha packs containing raw card stems and proof signatures."
                      },
                      {
                        title: "3. Ownership Unlocks Status",
                        desc: "Players display card collections, climb leaderboards, burn items for V⚡ upgrades, and sign in on Base to solidify digital permanence."
                      }
                    ].map((step, idx) => (
                      <div 
                        key={idx}
                        className={`p-3 border transition-all cursor-pointer ${
                          activeLoopStep === idx 
                            ? 'bg-[#faf0d8]/5 border-[#ffb800] shadow-[2px_2px_0_#ffb800]' 
                            : 'border-white/10 opacity-60 hover:opacity-100'
                        }`}
                        onClick={() => { setActiveLoopStep(idx); haptics.lightTap(); }}
                      >
                        <h4 className="text-xs font-mono font-bold text-white uppercase">{step.title}</h4>
                        {activeLoopStep === idx && (
                          <p className="text-[11px] text-[#faf0d8]/75 mt-1 leading-relaxed">{step.desc}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* SLIDE 3: THREE ECONOMIES */}
              {currentSlide === 2 && (
                <>
                  <DeckSectionLabel label="02 // Ecosystem Balance" accent="#c44dff" />
                  <h2 className="text-3xl md:text-5xl font-black font-mono tracking-tighter uppercase leading-tight">
                    THE TRI-ECONOMY
                  </h2>
                  <p className="text-xs text-[#faf0d8]/80 leading-relaxed">
                    Ecosystem long-term viability requires interlocking incentives. PIM bridges skill, scarcity, and social mechanics into a unified loop.
                  </p>
                  
                  <div className="flex gap-2 border-b border-white/10 pb-2">
                    {['SKILL', 'SCARCITY', 'SOCIAL'].map((eco, idx) => (
                      <button
                        key={eco}
                        onClick={() => { setActiveEconomy(idx); haptics.lightTap(); }}
                        className={`px-3 py-1.5 font-mono text-[10px] uppercase font-bold tracking-widest ${
                          activeEconomy === idx 
                            ? 'border-b-2 border-[#c44dff] text-white' 
                            : 'text-white/40 hover:text-white'
                        }`}
                      >
                        {eco} Economy
                      </button>
                    ))}
                  </div>

                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeEconomy}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="space-y-3 p-3 bg-white/[0.02] border border-white/5"
                    >
                      {activeEconomy === 0 && (
                        <>
                          <div className="text-xs font-bold text-[#c44dff] font-mono">DRIVEN BY PERFORMANCE & TIME ACCURACY</div>
                          <p className="text-[11px] text-[#faf0d8]/85 leading-relaxed">
                            Accurate timing yields cards and packs. Audio degrades (Sonic Punishment) in real time on misses, creating deep sensory hooks that value player skill.
                          </p>
                          <div className="text-[9px] font-mono text-white/50 uppercase">Key metrics: Combo Streak, Judgement window ms, Medal reward triggers</div>
                        </>
                      )}
                      {activeEconomy === 1 && (
                        <>
                          <div className="text-xs font-bold text-[#c44dff] font-mono">HARD PRINT SUPPLY LIMITS & SINK MECHANISMS</div>
                          <p className="text-[11px] text-[#faf0d8]/85 leading-relaxed">
                            Enforces absolute scarcity limits (e.g. max 1 Mythic card printed). Users burn duplicate cards in the Forge to generate V⚡ tokens used for targeted card pulls and upgrades.
                          </p>
                          <div className="text-[9px] font-mono text-white/50 uppercase">Key metrics: Card editions, Generational Echo entropy, V⚡ burn ratios</div>
                        </>
                      )}
                      {activeEconomy === 2 && (
                        <>
                          <div className="text-xs font-bold text-[#c44dff] font-mono">LEADERBOARD PRESTIGE & VERIFIED PROVENANCE</div>
                          <p className="text-[11px] text-[#faf0d8]/85 leading-relaxed">
                            Showcases early prestige. Rewards first-discoverers who earn Platinum medals. Tracks verified card histories on-chain, converting status into a social flex.
                          </p>
                          <div className="text-[9px] font-mono text-white/50 uppercase">Key metrics: Leaderboard Rank, First Discoverer badges, Wallet showcases</div>
                        </>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </>
              )}

              {/* SLIDE 4: SYSTEM ARCHITECTURE */}
              {currentSlide === 3 && (
                <>
                  <DeckSectionLabel label="03 // Software Architecture" accent="#00f0ff" />
                  <h2 className="text-3xl md:text-5xl font-black font-mono tracking-tighter uppercase leading-tight">
                    CORE SYSTEM STACK
                  </h2>
                  <p className="text-xs text-[#faf0d8]/85 leading-relaxed">
                    Designed as a modular, lightweight React monorepo using standard tools. All transaction logic is processed server-authoritatively inside sandboxed Edge Functions.
                  </p>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 border border-white/5 bg-[#faf0d8]/5 flex flex-col justify-between">
                      <div className="flex items-center gap-1.5 text-white">
                        <Monitor size={14} className="text-[#00f0ff]" />
                        <span className="font-mono font-bold text-[10px] uppercase">Client Shell</span>
                      </div>
                      <span className="text-[10px] text-[#faf0d8]/60 mt-1">React 19, TypeScript, wouter, Zustand State, TailwindCSS v4, Framer Motion.</span>
                    </div>

                    <div className="p-3 border border-white/5 bg-[#faf0d8]/5 flex flex-col justify-between">
                      <div className="flex items-center gap-1.5 text-white">
                        <Volume2 size={14} className="text-[#00f0ff]" />
                        <span className="font-mono font-bold text-[10px] uppercase">Audio/Canvas</span>
                      </div>
                      <span className="text-[10px] text-[#faf0d8]/60 mt-1">Split-frequency crossover Web Audio nodes (low/band/highpass), Canvas Draw Loops.</span>
                    </div>

                    <div className="p-3 border border-white/5 bg-[#faf0d8]/5 flex flex-col justify-between">
                      <div className="flex items-center gap-1.5 text-white">
                        <Database size={14} className="text-[#00f0ff]" />
                        <span className="font-mono font-bold text-[10px] uppercase">Data Layer</span>
                      </div>
                      <span className="text-[10px] text-[#faf0d8]/60 mt-1">Supabase DB (profiles, collections, game records), strict Row Level Security rules.</span>
                    </div>

                    <div className="p-3 border border-white/5 bg-[#faf0d8]/5 flex flex-col justify-between">
                      <div className="flex items-center gap-1.5 text-white">
                        <Cpu size={14} className="text-[#00f0ff]" />
                        <span className="font-mono font-bold text-[10px] uppercase">Edge Compute</span>
                      </div>
                      <span className="text-[10px] text-[#faf0d8]/60 mt-1">Deno Supabase Edge Functions (`vault-engine`, `auth-smart-wallet`).</span>
                    </div>
                  </div>
                </>
              )}

              {/* SLIDE 5: EVM & SMART WALLET AUTH */}
              {currentSlide === 4 && (
                <>
                  <DeckSectionLabel label="04 // Web3 Integrations" accent="#ff3800" />
                  <h2 className="text-3xl md:text-5xl font-black font-mono tracking-tighter uppercase leading-tight">
                    SMART AUTH PIPELINE
                  </h2>
                  <p className="text-xs text-[#faf0d8]/85 leading-relaxed">
                    Uses cryptographically secure EVM signature flows. Supports standard browser extensions or Coinbase Smart Wallet accounts on the **Base Mainnet (Chain ID 8453)**.
                  </p>
                  
                  <div className="space-y-2 text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center font-mono text-[9px] text-white">1</span>
                      <span className="text-[#faf0d8]/80 font-mono">Personal sign challenge requested from connected wallet</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center font-mono text-[9px] text-white">2</span>
                      <span className="text-[#faf0d8]/80 font-mono">Smart Wallet check triggers contract-based EIP-1271 call</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center font-mono text-[9px] text-white">3</span>
                      <span className="text-[#faf0d8]/80 font-mono">Server parses valid sig & issues JWT credentials</span>
                    </div>
                  </div>

                  <button
                    onClick={runAuthSimulation}
                    className="w-full py-2.5 bg-[#ff3800] text-black font-black uppercase text-xs tracking-wider border-2 border-black shadow-[3px_3px_0_#000] hover:scale-102 transition-transform cursor-pointer"
                  >
                    Run Authentication Simulation
                  </button>
                </>
              )}

              {/* SLIDE 6: 3D Rhythm Game Engine */}
              {currentSlide === 5 && (
                <>
                  <DeckSectionLabel label="05 // Game Mechanics" accent="#ffb800" />
                  <h2 className="text-3xl md:text-5xl font-black font-mono tracking-tighter uppercase leading-tight">
                    PERSPECTIVE RHYTHM LOOP
                  </h2>
                  <p className="text-xs text-[#faf0d8]/85 leading-relaxed">
                    HTML5 canvas loop calculates approach times and maps 3D note coordinates down onto a perspective highway. 
                  </p>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs font-mono border-b border-white/5 pb-1">
                      <span className="opacity-50">Timing Windows:</span>
                      <span className="text-white font-bold">Perfect+ (30ms) · Perfect (55ms) · Good (100ms)</span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-mono border-b border-white/5 pb-1">
                      <span className="opacity-50">Score multiplier:</span>
                      <span className="text-[#ffb800] font-bold">Caps scale by track (LIGHT 3x, DARK 4x, VOID 5x)</span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-mono">
                      <span className="opacity-50">Power-Ups:</span>
                      <span className="text-[#ff007f] font-bold">FEVER (20x Combo) · SURGE (40x Auto-play hold)</span>
                    </div>
                  </div>

                  <div className="p-3 border border-white/10 bg-white/[0.01] rounded">
                    <p className="text-[10px] font-mono text-white/40 uppercase mb-2">Keyboard test controls</p>
                    <div className="flex gap-2">
                      <button onClick={() => handleKeyPress(0)} className="flex-1 py-1.5 bg-white/5 hover:bg-white/15 border border-white/10 rounded font-mono text-[10px] text-white cursor-pointer">Left (A)</button>
                      <button onClick={() => handleKeyPress(1)} className="flex-1 py-1.5 bg-white/5 hover:bg-white/15 border border-white/10 rounded font-mono text-[10px] text-white cursor-pointer">Center (S)</button>
                      <button onClick={() => handleKeyPress(2)} className="flex-1 py-1.5 bg-white/5 hover:bg-white/15 border border-white/10 rounded font-mono text-[10px] text-white cursor-pointer">Right (D)</button>
                    </div>
                  </div>
                </>
              )}

              {/* SLIDE 7: SPLIT-BAND AUDIO */}
              {currentSlide === 6 && (
                <>
                  <DeckSectionLabel label="06 // Audio Processing" accent="#c44dff" />
                  <h2 className="text-3xl md:text-5xl font-black font-mono tracking-tighter uppercase leading-tight">
                    SPLIT-BAND LANE MUTING
                  </h2>
                  <p className="text-xs text-[#faf0d8]/85 leading-relaxed">
                    Master audio runs through a 3-way crossover utilizing Web Audio API nodes. Missing notes degrades audio quality itself—muting components in real time.
                  </p>
                  
                  <div className="space-y-3 font-mono text-[11px]">
                    <div className="flex items-center justify-between p-2 border border-white/5 bg-[#faf0d8]/5">
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${bassMuted ? 'bg-[#ff3800]' : 'bg-[#a855f7]'}`} />
                        <span>LANE 0: BASS (Lowpass Filter, 300Hz)</span>
                      </div>
                      <button 
                        onClick={() => { setBassMuted(!bassMuted); haptics.lightTap(); }} 
                        className={`px-2 py-0.5 text-[9px] uppercase border font-bold cursor-pointer ${bassMuted ? 'border-[#ff3800] text-[#ff3800]' : 'border-white/20 text-white/60'}`}
                      >
                        {bassMuted ? 'Muted' : 'Unmute'}
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-2 border border-white/5 bg-[#faf0d8]/5">
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${midMuted ? 'bg-[#ff3800]' : 'bg-white'}`} />
                        <span>LANE 1: MIDS (Bandpass Filter, 1200Hz)</span>
                      </div>
                      <button 
                        onClick={() => { setMidMuted(!midMuted); haptics.lightTap(); }} 
                        className={`px-2 py-0.5 text-[9px] uppercase border font-bold cursor-pointer ${midMuted ? 'border-[#ff3800] text-[#ff3800]' : 'border-white/20 text-white/60'}`}
                      >
                        {midMuted ? 'Muted' : 'Unmute'}
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-2 border border-white/5 bg-[#faf0d8]/5">
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${trebleMuted ? 'bg-[#ff3800]' : 'bg-[#ffb800]'}`} />
                        <span>LANE 2: TREBLE (Highpass Filter, 3200Hz)</span>
                      </div>
                      <button 
                        onClick={() => { setTrebleMuted(!trebleMuted); haptics.lightTap(); }} 
                        className={`px-2 py-0.5 text-[9px] uppercase border font-bold cursor-pointer ${trebleMuted ? 'border-[#ff3800] text-[#ff3800]' : 'border-white/20 text-white/60'}`}
                      >
                        {trebleMuted ? 'Muted' : 'Unmute'}
                      </button>
                    </div>
                  </div>

                  <p className="text-[10px] opacity-40 leading-relaxed font-mono uppercase">
                    Active hits un-silence bands instantly over a 0.25-second ramp window. If ignored, passive restore initiates after a 3.5s safety threshold.
                  </p>
                </>
              )}

              {/* SLIDE 8: ECONOMY REBALANCE V2.1 */}
              {currentSlide === 7 && (
                <>
                  <DeckSectionLabel label="07 // Tokenomics" accent="#00f0ff" />
                  <h2 className="text-3xl md:text-5xl font-black font-mono tracking-tighter uppercase leading-tight">
                    VELOCITY TOKENOMICS
                  </h2>
                  <p className="text-xs text-[#faf0d8]/85 leading-relaxed">
                    Balance daily farming loops with collector supply preservation. PIM implements separate limits for Gameplay Copies vs Mintable Base tokens.
                  </p>

                  <div className="p-3 border border-white/5 bg-[#0d0d0d] rounded">
                    <span className="text-[9px] font-mono uppercase text-[#00f0ff] font-bold block mb-2">V⚡ TOKEN SINKS</span>
                    <div className="grid grid-cols-3 gap-2 font-mono text-[9px] text-white">
                      <div className="p-2 border border-white/10 rounded">
                        <span className="block font-black text-xs text-[#ffb800]">500 V⚡</span>
                        <span className="opacity-50 uppercase">TARGETED PULL</span>
                      </div>
                      <div className="p-2 border border-white/10 rounded">
                        <span className="block font-black text-xs text-[#ffb800]">150 V⚡</span>
                        <span className="opacity-50 uppercase">RARITY UPGRADE</span>
                      </div>
                      <div className="p-2 border border-white/10 rounded">
                        <span className="block font-black text-xs text-[#ffb800]">3 TO 1</span>
                        <span className="opacity-50 uppercase">DUPLICATE FUSION</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-[10px] opacity-40 leading-relaxed font-mono uppercase">
                    Echo variations split burn yields (50% tokens / 50% prestige). Recursive token generation is balanced via a 3-gen entropy decay cap.
                  </p>
                </>
              )}

              {/* SLIDE 9: TRACTION & PRODUCTION METRICS */}
              {currentSlide === 8 && (
                <>
                  <DeckSectionLabel label="08 // Performance & Traction" accent="#ff3800" />
                  <h2 className="text-3xl md:text-5xl font-black font-mono tracking-tighter uppercase leading-tight">
                    LIVE SERVICE TRACTION
                  </h2>
                  <p className="text-xs text-[#faf0d8]/85 leading-relaxed">
                    PIM operates as a live systems-driven game. The following metrics are aggregated directly from the Base-linked Supabase production database:
                  </p>
                  
                  <div className="grid grid-cols-2 gap-3 font-mono text-[11px]">
                    <div className="p-3 border border-white/5 bg-[#faf0d8]/5 flex flex-col justify-between">
                      <span className="opacity-50 text-[8px] uppercase">Registered Users</span>
                      <span className="text-base font-black text-[#ffb800]">146 PLAYERS</span>
                    </div>
                    <div className="p-3 border border-white/5 bg-[#faf0d8]/5 flex flex-col justify-between">
                      <span className="opacity-50 text-[8px] uppercase">Ecosystem Timeframe</span>
                      <span className="text-base font-black text-white">53 LIVE DAYS</span>
                    </div>
                    <div className="p-3 border border-white/5 bg-[#faf0d8]/5 flex flex-col justify-between">
                      <span className="opacity-50 text-[8px] uppercase">Collectibles Minted</span>
                      <span className="text-base font-black text-[#c44dff]">421 CARDS</span>
                    </div>
                    <div className="p-3 border border-white/5 bg-[#faf0d8]/5 flex flex-col justify-between">
                      <span className="opacity-50 text-[8px] uppercase">Token Velocity</span>
                      <span className="text-base font-black text-[#00f0ff]">31,077 V⚡ CIRC.</span>
                    </div>
                  </div>
                  <p className="text-[9.5px] opacity-40 leading-relaxed font-mono uppercase">
                    Verification: 467 total gacha pulls completed, including 231 V⚡ pack purchases and 1 duplicate fusion processed.
                  </p>
                </>
              )}

              {/* SLIDE 10: THE FOUNDER */}
              {currentSlide === 9 && (
                <>
                  <DeckSectionLabel label="09 // Platform Creator" accent="#ffb800" />
                  <h2 className="text-3xl md:text-5xl font-black font-mono tracking-tighter uppercase leading-tight">
                    THE FOUNDER: TH3SCR1B3
                  </h2>
                  <p className="text-xs text-[#faf0d8]/85 leading-relaxed">
                    PIM is architected and composed by **TH3SCR1B3**, a multi-disciplinary music artist, software engineer, and digital creator.
                  </p>

                  <div className="space-y-3 text-[11px] font-mono leading-relaxed">
                    <div className="border-l-2 border-[#ff3800] pl-3">
                      <strong className="text-white block uppercase">365 Songs in 365 Days</strong>
                      <span className="text-[#faf0d8]/60 text-[10px]">
                        Composing, producing, and releasing a new original track every single day for an entire year, using the PIM game engine as the primary release platform.
                      </span>
                    </div>
                    
                    <div className="border-l-2 border-[#ffb800] pl-3">
                      <strong className="text-white block uppercase">Unified Cyber-Brutalist Vision</strong>
                      <span className="text-[#faf0d8]/60 text-[10px]">
                        Bridging high-fidelity audio engineering, responsive retro-canvas visuals, and signature Web3 smart wallet integration under one cohesive aesthetic.
                      </span>
                    </div>
                  </div>
                </>
              )}

              {/* SLIDE 11: PROGRESSIVE DECENTRALIZATION & FIAT */}
              {currentSlide === 10 && (
                <>
                  <DeckSectionLabel label="10 // User Onboarding" accent="#ff3800" />
                  <h2 className="text-3xl md:text-5xl font-black font-mono tracking-tighter uppercase leading-tight">
                    WEB2 TO WEB3 BRIDGE
                  </h2>
                  <p className="text-xs text-[#faf0d8]/85 leading-relaxed">
                    Eliminates crypto friction. PIM abstracts keys and transaction costs for non-web3 players, routing them through web2 auth, local wallets, and debit/credit checkouts.
                  </p>

                  <div className="space-y-3 font-mono text-[11px]">
                    <div className="p-3 border border-white/5 bg-[#faf0d8]/5 flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 font-bold text-white uppercase">
                        <Key size={12} className="text-[#ff3800]" />
                        <span>LOCAL EPHEMERAL KEYS</span>
                      </div>
                      <span className="text-[10px] text-[#faf0d8]/60 leading-relaxed">
                        Email sign-up automatically creates a local, user-scoped EVM wallet. Keys are stored in browser localStorage. Claims run gaslessly on the backend.
                      </span>
                    </div>

                    <div className="p-3 border border-white/5 bg-[#faf0d8]/5 flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 font-bold text-white uppercase">
                        <Coins size={12} className="text-[#ff3800]" />
                        <span>MOCK STRIPE INTERCEPT</span>
                      </div>
                      <span className="text-[10px] text-[#faf0d8]/60 leading-relaxed">
                        Purchasing packs with credit cards intercepts web3 execution, routing users through a stripe redirect mock checkout to mint assets directly into their local profiles.
                      </span>
                    </div>
                  </div>
                </>
              )}

              {/* SLIDE 12: ROADMAP */}
              {currentSlide === 11 && (
                <>
                  <DeckSectionLabel label="11 // Future Roadmap" accent="#ffb800" />
                  <h2 className="text-3xl md:text-5xl font-black font-mono tracking-tighter uppercase leading-tight">
                    THE ROADMAP
                  </h2>
                  <p className="text-xs text-[#faf0d8]/85 leading-relaxed">
                    Moving from a canvas music portal to an immersive, living virtual collector ecosystem.
                  </p>

                  <div className="relative border-l border-[#ffb800]/30 pl-4 ml-1 space-y-4 font-mono text-[11px]">
                    <div className="relative">
                      <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-[#ffb800] border-2 border-black" />
                      <div className="font-bold text-white uppercase">PHASE 1: ONBOARDING STRATA</div>
                      <span className="text-[9px] text-[#faf0d8]/60">Segmenting game menus to gradually ease user complexity (Casual &gt; Regular &gt; Collector &gt; Hardcore).</span>
                    </div>

                    <div className="relative">
                      <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-[#ffb800] border-2 border-black" />
                      <div className="font-bold text-white uppercase">PHASE 2: PROVENANCE MEMORIES</div>
                      <span className="text-[9px] text-[#faf0d8]/60">Writing permanent discoverer and score stamps into card Metadata parameters.</span>
                    </div>

                    <div className="relative">
                      <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-[#ffb800] border-2 border-black" />
                      <div className="font-bold text-white uppercase">PHASE 3: ASYNC PLAYER GHOSTS</div>
                      <span className="text-[9px] text-[#faf0d8]/60">Generating semi-transparent ghost runners on lanes based on real player telemetry tracks.</span>
                    </div>

                    <div className="relative">
                      <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-[#ffb800] border-2 border-black" />
                      <div className="font-bold text-white uppercase">PHASE 4: THE LIVING VAULT</div>
                      <span className="text-[9px] text-[#faf0d8]/60">Implementing fragmented 3D card shards on background shelves, unlocking hidden passages.</span>
                    </div>
                  </div>
                </>
              )}

            </div>

            {/* RIGHT SIDE: Interactive Simulations and High-Fidelity Mockups */}
            <div className="border-2 border-black bg-[#0f0d09] p-6 rounded-lg relative min-h-[360px] flex flex-col justify-center items-center overflow-hidden shadow-[4px_4px_0_#000]">
              <div className="absolute inset-0 bg-[#faf0d8]/[0.01] pointer-events-none" />
              <div className="absolute top-2 right-3 font-mono text-[8px] opacity-40 uppercase tracking-widest">
                Interactive Panel // Simulation
              </div>

              {/* SLIDE 1 PREVIEW: Logo and Marquee */}
              {currentSlide === 0 && (
                <div className="flex flex-col items-center gap-6 w-full">
                  <div className="w-40 h-40 relative flex items-center justify-center">
                    {/* Spinning ring */}
                    <div className="absolute inset-0 rounded-full border-4 border-dashed border-[#ff3800]/30 animate-[spin-slow_24s_linear_infinite]" />
                    <div className="absolute inset-4 rounded-full border border-double border-[#ffb800]/25 animate-[spin-slow_12s_linear_reverse_infinite]" />
                    
                    {/* Floating Center Badge */}
                    <motion.div
                      animate={{ y: [-5, 5, -5] }}
                      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                      className="w-24 h-24 bg-[#ff3800] flex items-center justify-center rotate-[-4deg] shadow-[4px_4px_0_#000] border-2 border-black"
                    >
                      <span className="font-mono font-black text-4xl text-white select-none brutalist-stroke-md">PIM</span>
                    </motion.div>
                  </div>

                  <div className="w-full bg-[#ffb800] overflow-hidden py-1 border-y border-black">
                    <div className="flex whitespace-nowrap animate-[ticker-scroll_8s_linear_infinite] font-mono font-black text-[9px] text-black">
                      <span className="pr-4">MUSIC UNLOCKS GAMEPLAY · GAMEPLAY UNLOCKS OWNERSHIP · OWNERSHIP UNLOCKS STATUS · </span>
                      <span className="pr-4">MUSIC UNLOCKS GAMEPLAY · GAMEPLAY UNLOCKS OWNERSHIP · OWNERSHIP UNLOCKS STATUS · </span>
                    </div>
                  </div>
                </div>
              )}

              {/* SLIDE 2 PREVIEW: Interactive Loop Diagram */}
              {currentSlide === 1 && (
                <div className="flex flex-col items-center justify-center gap-6 w-full py-4">
                  {[
                    { label: "STAGE 1: MUSIC DISCOVERY", color: "#ff3800", active: activeLoopStep === 0, desc: "TikTok / Spotify deep link redirects to Stage" },
                    { label: "STAGE 2: GAMEPLAY & SKILL", color: "#ffb800", active: activeLoopStep === 1, desc: "Accurate note hits trigger card pack rewards" },
                    { label: "STAGE 3: STATUS & VAULT", color: "#c44dff", active: activeLoopStep === 2, desc: "Showcase streaking, upgrade rarity tiers" }
                  ].map((stage, idx) => (
                    <motion.div
                      key={idx}
                      onClick={() => { setActiveLoopStep(idx); haptics.lightTap(); }}
                      animate={stage.active ? { scale: 1.05 } : { scale: 1 }}
                      className={`w-full max-w-[280px] p-3 border-2 border-black flex flex-col leading-tight cursor-pointer shadow-[3px_3px_0_rgba(0,0,0,0.5)] ${
                        stage.active ? 'bg-white text-black' : 'bg-transparent text-white opacity-45'
                      }`}
                      style={{ transform: `rotate(${(idx - 1) * 2}deg)` }}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center font-mono text-[8px] font-black border border-black"
                             style={{ background: stage.active ? '#000' : stage.color, color: stage.active ? stage.color : '#000' }}>
                          {idx + 1}
                        </div>
                        <span className="font-mono font-black text-xs uppercase tracking-tighter">{stage.label}</span>
                      </div>
                      {stage.active && (
                        <p className="text-[9px] font-mono opacity-80 mt-1 uppercase tracking-wider">{stage.desc}</p>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}

              {/* SLIDE 3 PREVIEW: Economy chart mockup */}
              {currentSlide === 2 && (
                <div className="w-full flex flex-col items-center gap-6 font-mono text-white text-[10px]">
                  <div className="w-full max-w-[280px] border border-white/10 p-3 bg-white/[0.01]">
                    <div className="flex justify-between items-center mb-2">
                      <span className="uppercase tracking-widest text-[#c44dff]">Tri-Economy Sync Ratios</span>
                      <Activity size={12} className="text-[#c44dff]" />
                    </div>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between mb-1">
                          <span>SKILL VELOCITY</span>
                          <span className="font-bold text-[#faf0d8]">88%</span>
                        </div>
                        <div className="w-full h-1 bg-white/10 rounded overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-[#c44dff] to-[#ff3800]" style={{ width: '88%' }} />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between mb-1">
                          <span>SCARCITY RATIOS</span>
                          <span className="font-bold text-[#faf0d8]">54%</span>
                        </div>
                        <div className="w-full h-1 bg-white/10 rounded overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-[#c44dff] to-[#ff3800]" style={{ width: '54%' }} />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between mb-1">
                          <span>SOCIAL PRESTIGE</span>
                          <span className="font-bold text-[#faf0d8]">72%</span>
                        </div>
                        <div className="w-full h-1 bg-white/10 rounded overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-[#c44dff] to-[#ff3800]" style={{ width: '72%' }} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="sticker-gun-tag sticker-slits flex flex-row items-center gap-2 p-2 px-4 shadow-lg rotate-[-2deg] border border-black" style={{ background: '#fff', color: '#000' }}>
                    <Zap size={14} className="text-black" />
                    <div className="leading-none flex flex-col items-start">
                      <span className="text-[7px] font-black opacity-60 uppercase">prestige weight</span>
                      <span className="text-base font-black italic uppercase leading-none font-mono">1.5x MULTIPLIER</span>
                    </div>
                  </div>
                </div>
              )}

              {/* SLIDE 4 PREVIEW: Tech stack diagram */}
              {currentSlide === 3 && (
                <div className="w-full max-w-[285px] flex flex-col gap-2 font-mono text-[9px] text-[#faf0d8]">
                  <div className="p-2.5 border border-[#00f0ff]/30 bg-[#00f0ff]/5 rounded flex justify-between items-center rotate-[-1deg]">
                    <div className="flex items-center gap-1.5">
                      <Monitor size={11} className="text-[#00f0ff]" />
                      <span className="font-bold">CLIENT REACT WEBAPP Shell</span>
                    </div>
                    <span className="opacity-40">beatstar-vault</span>
                  </div>

                  <div className="flex justify-center py-0.5">
                    <div className="w-px h-3 bg-white/20 border-dashed border-l" />
                  </div>

                  <div className="p-2.5 border border-[#00f0ff]/30 bg-[#00f0ff]/5 rounded flex justify-between items-center rotate-[1deg]">
                    <div className="flex items-center gap-1.5">
                      <Volume2 size={11} className="text-[#00f0ff]" />
                      <span className="font-bold">WEB AUDIO FREQ crossover</span>
                    </div>
                    <span className="opacity-40">lane_muting</span>
                  </div>

                  <div className="flex justify-center py-0.5">
                    <div className="w-px h-3 bg-white/20 border-dashed border-l" />
                  </div>

                  <div className="p-2.5 border border-[#00f0ff]/30 bg-[#00f0ff]/5 rounded flex justify-between items-center rotate-[-0.5deg]">
                    <div className="flex items-center gap-1.5">
                      <Cpu size={11} className="text-[#00f0ff]" />
                      <span className="font-bold">SUPABASE DENO Edge server</span>
                    </div>
                    <span className="opacity-40">vault-engine</span>
                  </div>

                  <div className="flex justify-center py-0.5">
                    <div className="w-px h-3 bg-white/20 border-dashed border-l" />
                  </div>

                  <div className="p-2.5 border border-[#00f0ff]/30 bg-[#00f0ff]/5 rounded flex justify-between items-center rotate-[0.8deg]">
                    <div className="flex items-center gap-1.5">
                      <Database size={11} className="text-[#00f0ff]" />
                      <span className="font-bold">SUPABASE POSTGRES Database</span>
                    </div>
                    <span className="opacity-40">rls_profiles</span>
                  </div>
                </div>
              )}

              {/* SLIDE 5 PREVIEW: Auth simulator console */}
              {currentSlide === 4 && (
                <div className="w-full flex flex-col gap-3 font-mono text-[9px] text-[#faf0d8]">
                  <div className="border border-white/10 p-2.5 bg-[#050402] rounded-t flex justify-between items-center">
                    <span className="text-[#ff3800] uppercase font-bold flex items-center gap-1"><Terminal size={10} /> AUTH CONSOLE</span>
                    <div className="flex gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                      <div className="w-2 h-2 rounded-full bg-yellow-500" />
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                    </div>
                  </div>
                  
                  <div className="border-x border-b border-white/10 p-3 bg-black min-h-[160px] flex flex-col justify-between font-mono text-[9px]">
                    <div className="space-y-1.5 max-h-[120px] overflow-y-auto">
                      {authSimLogs.length === 0 ? (
                        <div className="text-white/40 italic">Terminal idle. Click 'Run Authentication Simulation' on the left to begin...</div>
                      ) : (
                        authSimLogs.map((log, idx) => (
                          <div 
                            key={idx}
                            style={{ 
                              color: log.startsWith('[SYSTEM]') ? '#ffb800' : log.startsWith('[WALLET]') ? '#00f0ff' : log.startsWith('[CONTRACT]') ? '#c44dff' : '#4ade80'
                            }}
                          >
                            {log}
                          </div>
                        ))
                      )}
                    </div>
                    
                    {authSimStep !== 'idle' && authSimStep !== 'success' && (
                      <div className="flex items-center gap-2 text-white/50 pt-2 border-t border-white/10 mt-2">
                        <RefreshCw size={10} className="animate-spin" />
                        <span className="uppercase text-[8px]">Processing {authSimStep} steps...</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* SLIDE 6 PREVIEW: Rhythm Game simulator */}
              {currentSlide === 5 && (
                <div className="w-full max-w-[280px] h-[260px] bg-black border-2 border-white/10 rounded relative overflow-hidden flex flex-col justify-between">
                  {/* Highway render canvas mock */}
                  <div className="flex-1 relative border-b border-white/10 bg-[#0f0d09]">
                    
                    {/* Perspective grid lines */}
                    <div className="absolute top-0 bottom-0 left-1/3 w-px bg-white/10" style={{ transform: 'skewX(-15deg)', transformOrigin: 'top' }} />
                    <div className="absolute top-0 bottom-0 right-1/3 w-px bg-white/10" style={{ transform: 'skewX(15deg)', transformOrigin: 'top' }} />
                    
                    {/* Falling notes */}
                    {notes.map((note) => (
                      <motion.div
                        key={note.id}
                        className="absolute w-8 h-8 rounded-full border-2 border-black flex items-center justify-center text-[8px] font-black"
                        style={{
                          left: note.lane === 0 ? '16%' : note.lane === 1 ? '45%' : '74%',
                          top: `${note.y}%`,
                          background: note.lane === 0 ? '#a855f7' : note.lane === 1 ? '#faf0d8' : '#ffb800',
                          boxShadow: `0 0 10px ${note.lane === 0 ? '#a855f7' : note.lane === 1 ? '#faf0d8' : '#ffb800'}88`,
                        }}
                      >
                        {note.lane === 0 ? 'A' : note.lane === 1 ? 'S' : 'D'}
                      </motion.div>
                    ))}

                    {/* Hit judgment line */}
                    <div className="absolute bottom-8 left-0 right-0 h-1 bg-[#ff3800]/50" />
                    <div className="absolute bottom-6 left-0 right-0 h-5 bg-white/5 flex items-center justify-around">
                      <span className="text-[8px] font-mono text-white/20">LANE 0</span>
                      <span className="text-[8px] font-mono text-white/20">LANE 1</span>
                      <span className="text-[8px] font-mono text-white/20">LANE 2</span>
                    </div>

                    {/* Feedback overlay */}
                    {rhythmFeedback && (
                      <motion.div
                        key={rhythmFeedback}
                        initial={{ opacity: 1, scale: 1.2 }}
                        animate={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.6 }}
                        className="absolute inset-0 flex items-center justify-center pointer-events-none"
                      >
                        <span 
                          className="font-black text-2xl italic brutalist-stroke-md"
                          style={{
                            color: rhythmFeedback === 'MISS' ? '#ff3800' : rhythmFeedback === 'PERFECT+' ? '#ffd700' : '#4ade80'
                          }}
                        >
                          {rhythmFeedback}
                        </span>
                      </motion.div>
                    )}
                  </div>

                  {/* Bottom UI bar */}
                  <div className="px-3 py-2 bg-[#0d0d0d] flex justify-between items-center font-mono text-[9px] text-[#faf0d8]">
                    <div className="flex gap-2">
                      <span>COMBO: <strong className="text-[#ff3800]">{rhythmCombo}</strong></span>
                      {rhythmPowerUp !== 'NORMAL' && (
                        <span className="text-[#ffd700] font-black uppercase text-[8px] tracking-wider animate-pulse">{rhythmPowerUp}!</span>
                      )}
                    </div>
                    <span className="opacity-50">SCORE: {(rhythmCombo * 300).toLocaleString()}</span>
                  </div>
                </div>
              )}

              {/* SLIDE 7 PREVIEW: Audio Equalizer mock */}
              {currentSlide === 6 && (
                <div className="w-full max-w-[280px] border border-white/10 p-4 bg-[#0d0d0d] rounded flex flex-col gap-4">
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-[9px] uppercase text-[#c44dff]">Equalizer Output Signal</span>
                    <span className="font-mono text-[8px] opacity-40 uppercase">WEB AUDIO API</span>
                  </div>

                  {/* Equalizer Wave bar simulator */}
                  <div className="h-20 flex items-end gap-1 px-2 border-b border-white/10 bg-[#050402] relative overflow-hidden">
                    {/* Simulated Wave lines */}
                    {[...Array(24)].map((_, idx) => {
                      const isBass = idx < 8;
                      const isMid = idx >= 8 && idx < 16;
                      const isTreble = idx >= 16;

                      let muted = false;
                      if (isBass && bassMuted) muted = true;
                      if (isMid && midMuted) muted = true;
                      if (isTreble && trebleMuted) muted = true;

                      const height = muted ? 2 : Math.floor(Math.random() * 60) + 15;

                      return (
                        <motion.div
                          key={idx}
                          animate={{ height: `${height}%` }}
                          transition={{ repeat: Infinity, duration: 0.15 + (idx % 3) * 0.05, repeatType: "reverse" }}
                          className="flex-1 rounded-t"
                          style={{
                            background: muted 
                              ? '#ff3800' 
                              : isBass ? '#a855f7' : isMid ? '#ffffff' : '#ffb800',
                            opacity: muted ? 0.35 : 0.85
                          }}
                        />
                      );
                    })}
                  </div>

                  <div className="flex justify-between items-center text-[10px] font-mono text-white/50">
                    <span>Active Filters:</span>
                    <span className="text-white font-bold uppercase">{Math.round(audioSignalLevel * 100)}% output gain</span>
                  </div>
                </div>
              )}

              {/* SLIDE 8 PREVIEW: Gacha Balance table mockup */}
              {currentSlide === 7 && (
                <div className="w-full max-w-[290px] border border-white/10 bg-[#0d0d0d] rounded font-mono text-[8px] text-white">
                  <div className="p-2 border-b border-white/10 bg-white/[0.02] flex justify-between items-center">
                    <span className="uppercase text-[#00f0ff] font-bold">REBALANCE V2.1 MATRIX</span>
                    <BarChart2 size={10} className="text-[#00f0ff]" />
                  </div>
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/5 opacity-50 text-[7px]">
                        <th className="p-1.5 uppercase">Rarity</th>
                        <th className="p-1.5 uppercase">Free Gameplay Cap</th>
                        <th className="p-1.5 uppercase">Mintable Cap</th>
                        <th className="p-1.5 uppercase">Burn value</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-white/5">
                        <td className="p-1.5 font-bold text-slate-400">Common</td>
                        <td className="p-1.5">2,000 copies</td>
                        <td className="p-1.5 text-white/40">Off-chain</td>
                        <td className="p-1.5 text-glow text-[#ffb800]">3 V⚡</td>
                      </tr>
                      <tr className="border-b border-white/5">
                        <td className="p-1.5 font-bold text-emerald-400">Uncommon</td>
                        <td className="p-1.5">500 copies</td>
                        <td className="p-1.5">50 printed</td>
                        <td className="p-1.5 text-glow text-[#ffb800]">10 V⚡</td>
                      </tr>
                      <tr className="border-b border-white/5">
                        <td className="p-1.5 font-bold text-blue-400">Rare</td>
                        <td className="p-1.5">100 copies</td>
                        <td className="p-1.5">25 printed</td>
                        <td className="p-1.5 text-glow text-[#ffb800]">30 V⚡</td>
                      </tr>
                      <tr className="border-b border-white/5">
                        <td className="p-1.5 font-bold text-fuchsia-400">Legendary</td>
                        <td className="p-1.5">10 copies</td>
                        <td className="p-1.5">3 printed</td>
                        <td className="p-1.5 text-glow text-[#ffb800]">80 V⚡</td>
                      </tr>
                      <tr>
                        <td className="p-1.5 font-bold text-[#ffd700]">Mythic</td>
                        <td className="p-1.5">1 copy</td>
                        <td className="p-1.5">1 printed</td>
                        <td className="p-1.5 text-glow text-[#ffb800]">200 V⚡</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {/* SLIDE 9 (Index 8) PREVIEW: Analytics stats board */}
              {currentSlide === 8 && (
                <div className="w-full max-w-[280px] border border-white/10 p-4 bg-[#0d0d0d] rounded font-mono text-[9px] text-[#faf0d8] space-y-3">
                  <div className="flex justify-between items-center border-b border-white/10 pb-1.5">
                    <span className="text-[#ff3800] uppercase font-bold flex items-center gap-1"><BarChart2 size={11} /> RARITY DISTRIBUTION</span>
                    <span className="text-[7px] opacity-40">MINTED CARDS</span>
                  </div>
                  
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-[#7a8090]">COMMON</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 bg-white/10 rounded overflow-hidden">
                          <div className="h-full bg-[#7a8090]" style={{ width: '26%' }} />
                        </div>
                        <span className="font-bold">111</span>
                      </div>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-[#00d4aa]">UNCOMMON</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 bg-white/10 rounded overflow-hidden">
                          <div className="h-full bg-[#00d4aa]" style={{ width: '34%' }} />
                        </div>
                        <span className="font-bold">144</span>
                      </div>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-[#4d8fff]">RARE</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 bg-white/10 rounded overflow-hidden">
                          <div className="h-full bg-[#4d8fff]" style={{ width: '21%' }} />
                        </div>
                        <span className="font-bold">89</span>
                      </div>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-[#c44dff]">LEGENDARY</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 bg-white/10 rounded overflow-hidden">
                          <div className="h-full bg-[#c44dff]" style={{ width: '17%' }} />
                        </div>
                        <span className="font-bold">71</span>
                      </div>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-[#ffd700]">MYTHIC</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 bg-white/10 rounded overflow-hidden">
                          <div className="h-full bg-[#ffd700]" style={{ width: '2%' }} />
                        </div>
                        <span className="font-bold">6</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SLIDE 10 (Index 9) PREVIEW: Founder artist badge */}
              {currentSlide === 9 && (
                <div className="flex flex-col items-center gap-4 w-full">
                  <div className="w-40 h-40 relative flex items-center justify-center">
                    {/* Rotating vinyl disk pattern */}
                    <div className="absolute inset-0 rounded-full border border-dashed border-[#ffb800]/25 animate-[spin-slow_16s_linear_infinite]" />
                    <div className="absolute inset-3 rounded-full border border-white/5 bg-[#050402] flex items-center justify-center">
                      <div className="w-24 h-24 rounded-full border-4 border-[#ff3800] bg-black flex items-center justify-center relative overflow-hidden">
                        {/* Audio wave simulation inside founder avatar */}
                        <div className="absolute inset-0 flex items-center justify-center gap-0.5 opacity-20">
                          <div className="w-1 h-12 bg-white rounded animate-pulse" />
                          <div className="w-1 h-8 bg-white rounded animate-pulse" />
                          <div className="w-1 h-14 bg-white rounded animate-pulse" />
                        </div>
                        <span className="font-mono font-black text-[9px] tracking-widest text-[#ff3800] z-10">CREATOR</span>
                      </div>
                    </div>
                  </div>

                  <div className="sticker-gun-tag sticker-slits flex flex-row items-center gap-2 p-2 px-4 shadow-lg rotate-[1.5deg] border border-black" style={{ background: '#fff', color: '#000' }}>
                    <span className="text-[9px] font-black italic uppercase leading-none font-mono">TH3SCR1B3.ART // COMPOSER</span>
                  </div>
                </div>
              )}

              {/* SLIDE 11 PREVIEW: Ephemeral Wallet simulation */}
              {currentSlide === 10 && (
                <div className="w-full flex flex-col gap-3 font-mono text-[9px] text-[#faf0d8]">
                  <div className="border border-white/10 p-2 bg-[#050402] flex justify-between items-center rounded-t">
                    <span className="uppercase text-[#ff3800] font-bold flex items-center gap-1"><Cpu size={10} /> KEYGEN AGENT</span>
                    <span className="text-[8px] opacity-40">LOCAL STORAGE</span>
                  </div>

                  <div className="border-x border-b border-white/10 p-3 bg-black min-h-[140px] flex flex-col justify-between">
                    <div className="space-y-1 overflow-y-auto max-h-[110px]">
                      {ephemeralKeyLogs.length === 0 ? (
                        <div className="text-white/40 italic">Click 'Simulate Ephemeral Generation' below to view key generator flow...</div>
                      ) : (
                        ephemeralKeyLogs.map((log, idx) => (
                          <div 
                            key={idx}
                            style={{ 
                              color: log.startsWith('[WEB2]') ? '#ffb800' : log.startsWith('[LOCAL]') ? '#00f0ff' : '#4ade80'
                            }}
                          >
                            {log}
                          </div>
                        ))
                      )}
                    </div>

                    {ephemeralSimStep === 0 && (
                      <button
                        onClick={runEphemeralSimulation}
                        className="w-full py-1.5 bg-[#faf0d8]/10 hover:bg-[#faf0d8]/25 text-white font-mono text-[9px] uppercase border border-white/20 transition-colors mt-2 cursor-pointer"
                      >
                        Simulate Ephemeral Generation
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* SLIDE 12 PREVIEW: Future roadmap node preview */}
              {currentSlide === 11 && (
                <div className="flex flex-col items-center gap-4 w-full">
                  <div className="w-full max-w-[280px] p-3 border border-[#ffb800]/30 bg-[#ffb800]/5 text-center font-mono text-[10px] uppercase text-[#ffb800] rounded">
                    Living Vault Node Overrides
                  </div>

                  <div className="w-full max-w-[280px] bg-black border border-white/10 p-3 flex flex-col items-center gap-3 relative rounded">
                    <div className="w-16 h-16 relative flex items-center justify-center border border-dashed border-[#ffb800]/30 rounded-full animate-[spin-slow_16s_linear_infinite]">
                      <Eye size={20} className="text-[#ffb800]" />
                    </div>

                    <div className="text-center font-mono text-[9px] text-[#faf0d8]">
                      <span className="block font-black text-[#ffb800] uppercase">3D Fragment Shards</span>
                      <span className="opacity-50">Collect 10 card fragments to visually synthesize card models on shelves. Unlocks hidden pathway directories.</span>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* FOOTER NAVIGATION CONTROLS */}
      <footer className="px-6 py-4 border-t border-[#ff3800]/25 flex items-center justify-between bg-[#0f0d09]/95 backdrop-blur-md z-20">
        <div className="flex items-center gap-4">
          <button
            onClick={prevSlide}
            className="flex items-center justify-center w-10 h-10 border border-white/20 hover:border-white/50 text-white rounded transition-colors active:scale-90 cursor-pointer"
            aria-label="Previous slide"
          >
            <ChevronLeft size={20} />
          </button>

          <button
            onClick={nextSlide}
            className="flex items-center justify-center w-10 h-10 border border-white/20 hover:border-white/50 text-white rounded transition-colors active:scale-90 cursor-pointer"
            aria-label="Next slide"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Slide Dots Indicator */}
        <div className="hidden sm:flex gap-1.5">
          {[...Array(totalSlides)].map((_, idx) => (
            <button
              key={idx}
              onClick={() => { setCurrentSlide(idx); haptics.lightTap(); }}
              className={`w-2 h-2 rounded-full transition-all border cursor-pointer ${
                currentSlide === idx 
                  ? 'bg-[#ff3800] border-[#ff3800] scale-125' 
                  : 'bg-transparent border-white/30 hover:border-white/60'
              }`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>

        <div className="font-mono text-[10px] text-white/50">
          PRESS <kbd className="bg-white/10 px-1 rounded text-white text-[9px]">←</kbd> / <kbd className="bg-white/10 px-1 rounded text-white text-[9px]">→</kbd> TO NAVIGATE
        </div>
      </footer>
    </div>
  );
}
