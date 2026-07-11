import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { audioManager } from '../game/audio';
import { useVaultStore } from '../store/useVaultStore';
import { ArrowLeft, Zap, Tv, Gamepad2, ClipboardList, CheckCircle } from 'lucide-react';

// Cyberpunk Simulated Survey Data
const SURVEY_QUESTIONS = [
  {
    id: 1,
    question: "RATE YOUR CURRENT CEREBRAL NEURAL SHIELDING CONFIRMATION LEVEL",
    options: [
      { key: "A", text: "STANDARD MILITARY GRADE (99.8% GLITCH IMMUNITY)" },
      { key: "B", text: "CORPORATE OVERRIDE ACTIVE (PIM CORP PROTECTED)" },
      { key: "C", text: "NEURAL LEAK DETECTED (FRESH WASTELAND REBEL)" },
      { key: "D", text: "UNSHIELDED (I EMBRACE THE ANTIGRAVITY GLITCH)" }
    ]
  },
  {
    id: 2,
    question: "SELECT YOUR PRIMARY CORTICAL AUDIO SYNAPSE BROKER",
    options: [
      { key: "A", text: "TH3SCR1B3 NEURAL SYNTAX PROTOCOLS" },
      { key: "B", text: "NEON SYNDICATE DECENTRALIZED WAVESTREAM" },
      { key: "C", text: "PIM CORP SECURITY BROADCAST SECTOR" },
      { key: "D", text: "DIRECT CABLE JACK-IN (VINTAGE LO-FI)" }
    ]
  },
  {
    id: 3,
    question: "HAVE YOU EXPERIENCED PHANTOM BEAT ARTIFACTS TODAY?",
    options: [
      { key: "A", text: "YES, MY SYNAPSE IS MERGING WITH THE VAULT" },
      { key: "B", text: "NO, CORTEX DRIVERS ARE FULLY NOMINAL" },
      { key: "C", text: "ONLY WHEN DECRYPTING LEGENDARY AUDIO CARDS" },
      { key: "D", text: "WARNING: ALL RESPONSES RECORDED IN MEMORY" }
    ]
  }
];

// Minigame Hex Options
const HEX_CODES = ["0xAF", "0x3C", "0xD9", "0x4E", "0xB2", "0xF5", "0x1A", "0x88", "0xE3", "0x7F", "0xC4", "0x90", "0x5D", "0x6B", "0x72", "0x8A"];

export default function EarnPage() {
  const [, setLocation] = useLocation();
  const { tokenBalance, addTokens } = useVaultStore();

  // Mode Selection: 'menu' | 'ad' | 'game' | 'survey'
  const [activeMode, setActiveMode] = useState<'menu' | 'ad' | 'game' | 'survey'>('menu');
  const [earnFeedback, setEarnFeedback] = useState<{ amount: number; message: string } | null>(null);

  // ── 📺 AD BROADCAST STATE ──────────────────────────────────────
  const [adProgress, setAdProgress] = useState(0);
  const [adMessage, setAdMessage] = useState('Establishing neural link...');
  const adIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startAdBroadcast = () => {
    audioManager.playSfx('menu_confirm', 0.15);
    setActiveMode('ad');
    setAdProgress(0);
    setAdMessage('CONNECTING TO CORRIDOR BROADCAST FEED...');

    const slogans = [
      'DOWNLOADING CORPORATE SPONSOR directive...',
      'BUFFERING NEURAL AUDIO ADVERT...',
      'SYNCING AD FEED WITH CORTICAL IMPLANT...',
      'PIM CORP: SECURITY THROUGH ABSOLUTE SURVEILLANCE...',
      'STABILIZING MEMORY FEED...',
      'DECRYPTING FINAL VERIFICATION KEY...'
    ];

    let currentStep = 0;
    adIntervalRef.current = setInterval(() => {
      setAdProgress((prev) => {
        if (prev >= 100) {
          clearInterval(adIntervalRef.current!);
          completeAdBroadcast();
          return 100;
        }
        
        // Randomly update text slogans during loading
        if (prev % 18 === 0 && currentStep < slogans.length) {
          setAdMessage(slogans[currentStep]);
          currentStep++;
        }
        
        return prev + 1;
      });
    }, 150); // 15 seconds ad broadcast time
  };

  const completeAdBroadcast = async () => {
    clearInterval(adIntervalRef.current!);
    audioManager.playSfx('hidden_secret_found', 0.3);
    await addTokens(100);
    setEarnFeedback({ amount: 100, message: "NEURAL BROADCAST WATCHED successfully" });
    setActiveMode('menu');
  };

  // ── 📋 SURVEY STATE ──────────────────────────────────────────
  const [surveyIndex, setSurveyIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  const handleSurveyAnswer = async () => {
    if (!selectedOption) return;
    audioManager.playSfx('tap_nav', 0.1);

    if (surveyIndex < SURVEY_QUESTIONS.length - 1) {
      setSurveyIndex(surveyIndex + 1);
      setSelectedOption(null);
    } else {
      // Completed survey
      audioManager.playSfx('hidden_secret_found', 0.3);
      await addTokens(150);
      setEarnFeedback({ amount: 150, message: "DIAGNOSTIC COMPLIANCE SURVEY complete" });
      setActiveMode('menu');
      setSurveyIndex(0);
      setSelectedOption(null);
    }
  };

  // ── 🎮 GRID HACK MINIGAME STATE ────────────────────────────────
  const [targetHex, setTargetHex] = useState('');
  const [matrixGrid, setMatrixGrid] = useState<string[]>([]);
  const [hackStreak, setHackStreak] = useState(0);
  const [gameTimer, setGameTimer] = useState(100);
  const gameIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startHackingMiniGame = () => {
    audioManager.playSfx('menu_confirm', 0.15);
    setActiveMode('game');
    setHackStreak(0);
    generateNextHackMatrix();
  };

  const generateNextHackMatrix = () => {
    // Randomize 16 hex codes
    const shuffled = [...HEX_CODES].sort(() => 0.5 - Math.random());
    setMatrixGrid(shuffled);
    // Pick one target
    const target = shuffled[Math.floor(Math.random() * shuffled.length)];
    setTargetHex(target);
    setGameTimer(100);

    // Reset game interval for timeout countdown
    if (gameIntervalRef.current) clearInterval(gameIntervalRef.current);
    gameIntervalRef.current = setInterval(() => {
      setGameTimer((prev) => {
        if (prev <= 0) {
          clearInterval(gameIntervalRef.current!);
          handleHackFailure('TIMEOUT');
          return 0;
        }
        return prev - 2.5; // 4 seconds total response window
      });
    }, 100);
  };

  const handleHexTap = (hex: string) => {
    if (hex === targetHex) {
      audioManager.playSfx('perfect', 0.1);
      const nextStreak = hackStreak + 1;
      setHackStreak(nextStreak);

      if (nextStreak >= 5) {
        clearInterval(gameIntervalRef.current!);
        completeHackGame();
      } else {
        generateNextHackMatrix();
      }
    } else {
      handleHackFailure('WRONG CODE');
    }
  };

  const handleHackFailure = (reason: string) => {
    audioManager.playSfx('miss', 0.2);
    setHackStreak(0);
    generateNextHackMatrix();
  };

  const completeHackGame = async () => {
    if (gameIntervalRef.current) clearInterval(gameIntervalRef.current);
    audioManager.playSfx('hidden_secret_found', 0.3);
    await addTokens(250);
    setEarnFeedback({ amount: 250, message: "CYBER HACK PROTOCOL success" });
    setActiveMode('menu');
  };

  const handleBack = () => {
    audioManager.playSfx('back', 0.4);
    if (activeMode === 'menu') {
      setLocation('/vault');
    } else {
      // Clear timers
      if (adIntervalRef.current) clearInterval(adIntervalRef.current);
      if (gameIntervalRef.current) clearInterval(gameIntervalRef.current);
      setActiveMode('menu');
    }
  };

  useEffect(() => {
    return () => {
      if (adIntervalRef.current) clearInterval(adIntervalRef.current);
      if (gameIntervalRef.current) clearInterval(gameIntervalRef.current);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#07070a] text-white flex flex-col font-sans select-none relative overflow-hidden pb-12">
      {/* Background Grid Lines */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

      {/* Header Bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-black/40 backdrop-blur-md relative z-10">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/5 hover:border-white/20 transition-all font-mono text-[10px] font-black uppercase tracking-wider text-white/60 hover:text-white cursor-pointer"
        >
          <ArrowLeft size={12} />
          {activeMode === 'menu' ? 'Vault' : 'Abort'}
        </button>

        <div className="text-center">
          <h1 className="font-mono text-xs font-black tracking-[0.25em] uppercase text-white/50">
            REWARD_TERMINAL
          </h1>
        </div>

        <div className="flex items-center gap-2 border border-white/5 bg-black/30 px-3 py-1 rounded-lg">
          <Zap size={11} className="text-[#ff9900]" />
          <span className="font-mono text-xs font-black text-white">{tokenBalance} V⚡</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 relative z-10 max-w-lg mx-auto w-full">
        {/* Token Earn Toast Feedback */}
        {earnFeedback && (
          <div className="w-full mb-6 bg-[#39FF14]/10 border border-[#39FF14]/30 rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-1.5 shadow-lg shadow-[#39FF14]/5 relative overflow-hidden animate-pulse">
            <div className="absolute -top-1 left-4 right-4 h-[1px] bg-gradient-to-r from-transparent via-[#39FF14] to-transparent" />
            <div className="flex items-center gap-2 font-mono text-xs font-black text-[#39FF14] tracking-widest uppercase">
              <CheckCircle size={14} />
              {earnFeedback.message}
            </div>
            <span className="font-mono text-lg font-black text-white">
              +{earnFeedback.amount} VAULT TOKENS ACQUIRED
            </span>
            <button
              onClick={() => {
                audioManager.playSfx('tap_nav', 0.1);
                setEarnFeedback(null);
              }}
              className="mt-2 text-[9px] font-mono font-bold uppercase tracking-wider border border-[#39FF14]/25 hover:border-[#39FF14]/60 px-4 py-1.5 rounded-lg text-[#39FF14] bg-transparent cursor-pointer transition-all"
            >
              Acknowledge
            </button>
          </div>
        )}

        {/* ── MODE 1: MAIN MENU CARD CHOICES ─────────────────────────── */}
        {activeMode === 'menu' && (
          <div className="w-full flex flex-col gap-4">
            <div className="text-center mb-2">
              <p className="font-mono text-[9px] text-white/40 uppercase tracking-widest leading-relaxed">
                Choose a neural protocol to bypass token limits. Compliance rewards are synced instantly to your cloud wallet profile.
              </p>
            </div>

            {/* Simulated Ad Button */}
            <button
              onClick={startAdBroadcast}
              className="w-full text-left p-5 rounded-2xl border border-white/5 hover:border-[#39FF14]/35 bg-black/35 hover:bg-black/55 transition-all flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-start gap-4">
                <div className="p-3.5 rounded-xl border border-white/5 bg-white/5 text-[#39FF14] group-hover:scale-105 transition-all">
                  <Tv size={20} />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-xs font-black uppercase tracking-wider group-hover:text-[#39FF14] transition-all">
                    Neural ad Broadcast
                  </span>
                  <p className="text-[9px] text-zinc-500 font-mono leading-tight max-w-[240px]">
                    ESTABLISH UPLINK STREAM OF 15 SECONDS.
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <span className="font-mono text-[10px] font-black text-[#39FF14] tracking-wider">
                  +100 V⚡
                </span>
                <span className="text-[7px] text-zinc-500 font-mono uppercase">Start Feed</span>
              </div>
            </button>

            {/* Diagnostic Survey Button */}
            <button
              onClick={() => {
                audioManager.playSfx('menu_confirm', 0.15);
                setActiveMode('survey');
                setSurveyIndex(0);
                setSelectedOption(null);
              }}
              className="w-full text-left p-5 rounded-2xl border border-white/5 hover:border-[#00F0FF]/35 bg-black/35 hover:bg-black/55 transition-all flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-start gap-4">
                <div className="p-3.5 rounded-xl border border-white/5 bg-white/5 text-[#00F0FF] group-hover:scale-105 transition-all">
                  <ClipboardList size={20} />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-xs font-black uppercase tracking-wider group-hover:text-[#00F0FF] transition-all">
                    Cortex Diagnostics
                  </span>
                  <p className="text-[9px] text-zinc-500 font-mono leading-tight max-w-[240px]">
                    COMPLETE COMPLIANCE SURVEY QUESTIONS.
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <span className="font-mono text-[10px] font-black text-[#00F0FF] tracking-wider">
                  +150 V⚡
                </span>
                <span className="text-[7px] text-zinc-500 font-mono uppercase">Open Diagnostic</span>
              </div>
            </button>

            {/* Reactive Hacking game Button */}
            <button
              onClick={startHackingMiniGame}
              className="w-full text-left p-5 rounded-2xl border border-white/5 hover:border-[#FF1493]/35 bg-black/35 hover:bg-black/55 transition-all flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-start gap-4">
                <div className="p-3.5 rounded-xl border border-white/5 bg-white/5 text-[#FF1493] group-hover:scale-105 transition-all">
                  <Gamepad2 size={20} />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-xs font-black uppercase tracking-wider group-hover:text-[#FF1493] transition-all">
                    Grid Hack Protocol
                  </span>
                  <p className="text-[9px] text-zinc-500 font-mono leading-tight max-w-[240px]">
                    INTERACTIVE MATCHING GAME. STREAK OF 5 WINS.
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <span className="font-mono text-[10px] font-black text-[#FF1493] tracking-wider">
                  +250 V⚡
                </span>
                <span className="text-[7px] text-zinc-500 font-mono uppercase">Connect Hack</span>
              </div>
            </button>
          </div>
        )}

        {/* ── MODE 2: WATCH NEURAL ADVERT ───────────────────────────── */}
        {activeMode === 'ad' && (
          <div className="w-full bg-black/40 border border-white/5 rounded-2xl p-6 flex flex-col items-center justify-center gap-6 relative overflow-hidden min-h-[300px]">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#39FF14] to-transparent" />
            <div className="p-4 rounded-xl border border-[#39FF14]/30 bg-[#39FF14]/5 text-[#39FF14] animate-pulse">
              <Tv size={28} />
            </div>

            <div className="w-full text-center space-y-1.5">
              <span className="font-mono text-[8px] tracking-[0.25em] text-[#39FF14] uppercase font-black">
                Uplink Stream Active
              </span>
              <p className="font-mono text-[10px] text-white/80 uppercase max-w-[320px] mx-auto min-h-[30px] flex items-center justify-center leading-relaxed">
                {adMessage}
              </p>
            </div>

            {/* Progress Loading Bar */}
            <div className="w-full space-y-2">
              <div className="w-full bg-white/5 border border-white/10 rounded-full h-3.5 p-0.5 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-[#39FF14]/60 to-[#39FF14] h-full rounded-full transition-all duration-150"
                  style={{ width: `${adProgress}%` }}
                />
              </div>
              <div className="flex justify-between font-mono text-[8px] text-white/40 uppercase">
                <span>Decrypting feed...</span>
                <span>{adProgress}%</span>
              </div>
            </div>
          </div>
        )}

        {/* ── MODE 3: CORPORATE SURVEY ──────────────────────────────── */}
        {activeMode === 'survey' && (
          <div className="w-full bg-black/40 border border-white/5 rounded-2xl p-6 flex flex-col gap-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#00F0FF] to-transparent" />
            
            {/* Header info */}
            <div className="flex justify-between items-center font-mono text-[8px] tracking-wider text-[#00F0FF] uppercase font-black">
              <span>Diagnostic survey</span>
              <span>Question {surveyIndex + 1} of {SURVEY_QUESTIONS.length}</span>
            </div>

            {/* Question Text */}
            <h3 className="font-mono text-[11px] font-black text-white/90 leading-normal uppercase">
              {SURVEY_QUESTIONS[surveyIndex].question}
            </h3>

            {/* Answer Options list */}
            <div className="flex flex-col gap-2">
              {SURVEY_QUESTIONS[surveyIndex].options.map((opt) => {
                const selected = selectedOption === opt.key;
                return (
                  <button
                    key={opt.key}
                    onClick={() => {
                      audioManager.playSfx('tap_nav', 0.1);
                      setSelectedOption(opt.key);
                    }}
                    className={`text-left p-3.5 rounded-xl border font-mono text-[9px] leading-relaxed transition-all cursor-pointer flex items-center gap-3 ${
                      selected
                        ? 'border-[#00F0FF] bg-[#00F0FF]/10 text-white'
                        : 'border-white/5 bg-black/40 text-white/50 hover:border-white/10 hover:text-white/80'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-md flex items-center justify-center font-black border text-[9.5px] ${
                      selected
                        ? 'border-[#00F0FF] text-[#00F0FF]'
                        : 'border-white/10 text-white/30'
                    }`}>
                      {opt.key}
                    </span>
                    {opt.text}
                  </button>
                );
              })}
            </div>

            {/* Actions button */}
            <button
              onClick={handleSurveyAnswer}
              disabled={!selectedOption}
              className={`w-full py-2.5 rounded-xl font-mono text-[10px] font-black uppercase tracking-widest transition-all ${
                selectedOption
                  ? 'bg-gradient-to-r from-[#00F0FF]/30 to-[#00F0FF]/10 border border-[#00F0FF]/40 text-white hover:from-[#00F0FF]/40 cursor-pointer'
                  : 'bg-white/5 border border-white/5 text-white/20 cursor-not-allowed'
              }`}
            >
              {surveyIndex === SURVEY_QUESTIONS.length - 1 ? "Submit Diagnostic" : "Next Question"}
            </button>
          </div>
        )}

        {/* ── MODE 4: GRID HACK MINIGAME ────────────────────────────── */}
        {activeMode === 'game' && (
          <div className="w-full bg-black/40 border border-white/5 rounded-2xl p-6 flex flex-col gap-5 relative overflow-hidden min-h-[350px]">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#FF1493] to-transparent" />
            
            {/* Header game Info */}
            <div className="flex justify-between items-center font-mono text-[8px] tracking-wider text-[#FF1493] uppercase font-black">
              <span>Hacking Node</span>
              <span>Streak: {hackStreak} / 5</span>
            </div>

            {/* Target Display Panel */}
            <div className="bg-black/50 border border-white/5 p-4 rounded-xl flex flex-col items-center justify-center text-center gap-1.5 relative overflow-hidden">
              <span className="font-mono text-[8px] text-white/40 uppercase tracking-widest">
                TARGET NODE KEY
              </span>
              <span className="font-mono text-2xl font-black text-[#FF1493] tracking-widest uppercase animate-pulse">
                {targetHex}
              </span>
            </div>

            {/* Countdown timer bar */}
            <div className="w-full space-y-1">
              <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                <div 
                  className="bg-[#FF1493] h-full rounded-full transition-all duration-100"
                  style={{ width: `${gameTimer}%` }}
                />
              </div>
            </div>

            {/* 4x4 Grid Matrix */}
            <div className="grid grid-cols-4 gap-2.5">
              {matrixGrid.map((hex, index) => {
                return (
                  <button
                    key={index}
                    onClick={() => handleHexTap(hex)}
                    className="aspect-square bg-black/35 hover:bg-[#FF1493]/10 border border-white/5 hover:border-[#FF1493]/30 active:scale-95 text-white font-mono text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center justify-center cursor-pointer"
                  >
                    {hex}
                  </button>
                );
              })}
            </div>

            {/* Sub-label instructions */}
            <p className="font-mono text-[7px] text-white/30 text-center uppercase tracking-wider leading-relaxed">
              Tap the matching TARGET NODE KEY within the response window. A streak of 5 successful node cracks yields token retrieval.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
