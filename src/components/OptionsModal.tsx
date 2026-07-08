import { useState, useEffect, useRef, useCallback } from "react";
import { loadOpts, resetOpts, keyLabel, getActiveTheme, type GameOpts, GAME_BACKGROUNDS } from "../lib/options";
import { clearCatalogCache } from "../game/api";
import { audioManager } from "../game/audio";
import { logAnalyticsEvent } from "../services/telemetryService";
import { gameSenseService, type GameSenseStatus } from "../services/gameSenseService";
import { useVaultStore } from "../store/useVaultStore";
import { X, Volume2, Key, Info, Palette, Sparkles, Sliders, Check, Lock, Flame, ShieldAlert, Monitor, Sparkle } from "lucide-react";
import type { VaultCard } from "../services/vaultService";
import {
  CardSkinContext,
  CardOriginal, CardGlitch, CardGlass, CardArcade, CardMtg, CardPoker, CardDuelist, CardMonster, CardChrome, CardFantasy, CardCyberpunk, CardAnime,
  BackOriginal, BackGlitch, BackGlass, BackArcade, BackMtg, BackPoker, BackDuelist, BackMonster, BackChrome, BackFantasy, BackCyberpunk, BackAnime
} from '../pages/CardDesignShowcase';

// ── DUMMY PREVIEW CARD FOR SKIN CONFIGS ──
const SAMPLE_PREVIEW_CARD: VaultCard = {
  id: "preview_sample",
  day: 190,
  title: "AESTHETIC ECHOES",
  storageTitle: "aesthetic_echoes",
  mood: "dark",
  rarity: "legendary",
  energy: 0.85,
  valence: 0.72,
  tempo: 128,
  genre: ["ELECTRONIC", "CYBER"],
  tags: ["SYNTH", "NEON", "PREVIEW"],
  coverUrl: "/data/covers/day-190.jpg",
  audioUrl: "",
  description: "A digital hologram synthesized inside the beatstar vault system to preview skins.",
  claimedCount: 42,
  maxSupply: 100,
};

function getSkinComponent(skin: string) {
  if (skin === 'glitch') return CardGlitch;
  if (skin === 'glass') return CardGlass;
  if (skin === 'arcade') return CardArcade;
  if (skin === 'mtg') return CardMtg;
  if (skin === 'poker') return CardPoker;
  if (skin === 'duelist') return CardDuelist;
  if (skin === 'monster') return CardMonster;
  if (skin === 'chrome') return CardChrome;
  if (skin === 'fantasy') return CardFantasy;
  if (skin === 'cyberpunk') return CardCyberpunk;
  if (skin === 'anime') return CardAnime;
  return CardOriginal;
}

function getBackComponent(back: string) {
  if (back === 'glitch') return BackGlitch;
  if (back === 'glass') return BackGlass;
  if (back === 'arcade') return BackArcade;
  if (back === 'mtg') return BackMtg;
  if (back === 'poker') return BackPoker;
  if (back === 'duelist') return BackDuelist;
  if (back === 'monster') return BackMonster;
  if (back === 'chrome') return BackChrome;
  if (back === 'fantasy') return BackFantasy;
  if (back === 'cyberpunk') return BackCyberpunk;
  if (back === 'anime') return BackAnime;
  return BackOriginal;
}

// ── COLOR PRESETS FOR INDIVIDUAL LANES ──
const COLOR_PRESETS: [string[], string[], string[]] = [
  ["#FF1493", "#FF0000", "#FF8C00", "#E5B800", "#FF5400", "#CC2200", "#FF6B6B", "#FFD700"],
  ["#00E5FF", "#6B21A8", "#1E3A8A", "#0891B2", "#7C3AED", "#059669", "#831843", "#374151"],
  ["#39FF14", "#22C55E", "#10B981", "#06B6D4", "#84CC16", "#A78BFA", "#FDE047", "#F0F0F0"],
];

const KEY_ROWS = [
  ["q","w","e","r","t","y","u","i","o","p"],
  ["a","s","d","f","g","h","j","k","l"],
  ["z","x","c","v","b","n","m"],
  ["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"," "],
];

const FRONT_SKINS = [
  { id: 'original', name: 'Original Front', cost: 0, desc: 'Standard editorial layout' },
  { id: 'glitch', name: 'Neon-Brutalist', cost: 0, desc: 'High-contrast cyberpunk glitched borders' },
  { id: 'glass', name: 'Frosted Glass', cost: 0, desc: 'Sleek neon blur glassmorphism' },
  { id: 'arcade', name: 'Retro-Arcade', cost: 50, desc: 'Vintage synthesizer control deck style' },
  { id: 'mtg', name: 'Magic Layout', cost: 100, desc: 'Gilded oval sigils & spellbook details' },
  { id: 'poker', name: 'Classic Poker', cost: 50, desc: 'Symmetrical playing card frame' },
  { id: 'duelist', name: 'Duelist Frame', cost: 75, desc: 'Sacred runic circle portals & orange gems' },
  { id: 'monster', name: 'Pocket Beats', cost: 75, desc: 'Retro pixel pocket battle card layout' },
  { id: 'chrome', name: 'Sports Chrome', cost: 100, desc: 'Highly-polished metallic sports chrome frame' },
  { id: 'fantasy', name: 'Runic Fantasy', cost: 120, desc: 'Enchanted elven runic stone carving' },
  { id: 'cyberpunk', name: 'Cyber Terminal', cost: 120, desc: 'Terminal matrix network circuit interface' },
  { id: 'anime', name: 'Anime Signature', cost: 150, desc: 'Weiss signature layout with stars' }
];

const BACK_SKINS = [
  { id: 'glass', name: 'Frosted Glass', cost: 0, desc: 'Clean translucent blurred pane design' },
  { id: 'glitch', name: 'Neon-Brutalist', cost: 25, desc: 'Scanline terminal scanner grid back' },
  { id: 'arcade', name: 'Retro-Arcade', cost: 40, desc: 'Vintage scrolling horizontal pixels' },
  { id: 'mtg', name: 'Magic Layout', cost: 60, desc: 'Five-color mana runic layout back' },
  { id: 'poker', name: 'Classic Poker', cost: 40, desc: 'Double symmetric playing card back' },
  { id: 'duelist', name: 'Duelist Frame', cost: 50, desc: 'Swirling blue/orange runic portals' },
  { id: 'monster', name: 'Pocket Beats', cost: 50, desc: 'Red/white record-ball back design' },
  { id: 'chrome', name: 'Sports Chrome', cost: 50, desc: 'Beveled steel panel with highlights' },
  { id: 'fantasy', name: 'Runic Fantasy', cost: 60, desc: 'Constellation mystic star map borders' },
  { id: 'cyberpunk', name: 'Cyber Terminal', cost: 60, desc: 'Luminescent terminal network lines back' },
  { id: 'anime', name: 'Anime Signature', cost: 80, desc: 'Cosmic signature starry sky back' }
];

interface OptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// ── BeatVisualizer component ──
function BeatVisualizer({ offsetMs, isAvant }: { offsetMs: number; isAvant?: boolean }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => (t + 1) % 80), 33);
    return () => clearInterval(id);
  }, []);

  const progress = tick / 80;
  const beatPos = 0.5;
  const drift = offsetMs === 0 ? 0 : Math.sin(progress * Math.PI * 2) * (Math.abs(offsetMs) / 150) * 0.22;
  const tapPos = beatPos + drift;

  if (isAvant) {
    return (
      <div style={{ position: "relative", height: 56, background: "rgba(8,8,12,0.6)", border: "1px solid rgba(57,255,20,0.15)", overflow: "hidden" }}>
        <div style={{
          position: "absolute", top: 0, bottom: 0, left: `${progress * 100}%`, width: 2,
          background: "linear-gradient(90deg, rgba(57,255,20,0.4), transparent)",
          boxShadow: "0 0 8px rgba(57,255,20,0.3)"
        }} />
        {[0.25, 0.5, 0.75].map(x => (
          <div key={x} style={{ position: "absolute", top: 0, bottom: 0, left: `${x * 100}%`, width: 1, background: "rgba(255,255,255,0.06)" }} />
        ))}
        <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1, background: "rgba(255,255,255,0.1)", transform: "translateY(-50%)" }} />
        <div style={{
          position: "absolute", top: "50%", left: `${beatPos * 100}%`,
          transform: "translate(-50%, -50%)",
          width: 10, height: 10, borderRadius: "50%",
          background: "#39FF14", boxShadow: "0 0 12px #39FF14",
        }} />
        <div style={{
          position: "absolute", top: "50%", left: `${tapPos * 100}%`,
          transform: "translate(-50%, -50%)",
          width: 10, height: 10, borderRadius: "50%",
          background: "#FF1493", boxShadow: "0 0 12px #FF1493",
          transition: "left 0.08s linear",
        }} />
        <div style={{ position: "absolute", top: 2, left: 2, fontSize: 6, color: "rgba(57,255,20,0.4)", fontFamily: "monospace" }}>[ CAL_CH.A ]</div>
        <div style={{ position: "absolute", top: 2, right: 2, fontSize: 6, color: "rgba(255,20,147,0.4)", fontFamily: "monospace" }}>[ CAL_CH.B ]</div>
        <div style={{ position: "absolute", bottom: 4, left: `${beatPos * 100}%`, transform: "translateX(-50%)", fontFamily: "monospace", fontSize: 8, fontWeight: "bold", color: "#39FF14", letterSpacing: "0.15em" }}>BEAT</div>
        <div style={{ position: "absolute", top: 4, left: `${tapPos * 100}%`, transform: "translateX(-50%)", fontFamily: "monospace", fontSize: 8, fontWeight: "bold", color: "#FF1493", letterSpacing: "0.15em" }}>TAP</div>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", height: 48, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}>
      {[0.25, 0.5, 0.75].map(x => (
        <div key={x} style={{ position: "absolute", top: 0, bottom: 0, left: `${x * 100}%`, width: 1, background: "rgba(255,255,255,0.04)" }} />
      ))}
      <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1, background: "rgba(255,255,255,0.06)", transform: "translateY(-50%)" }} />
      <div style={{
        position: "absolute", top: "50%", left: `${beatPos * 100}%`,
        transform: "translate(-50%, -50%)",
        width: 12, height: 12, borderRadius: "50%",
        background: "#39FF14", boxShadow: "0 0 10px #39FF14",
      }} />
      <div style={{
        position: "absolute", top: "50%", left: `${tapPos * 100}%`,
        transform: "translate(-50%, -50%)",
        width: 12, height: 12, borderRadius: "50%",
        background: "#FF1493", boxShadow: "0 0 10px #FF1493",
        transition: "left 0.08s linear",
      }} />
      <div style={{ position: "absolute", bottom: 3, left: `${beatPos * 100}%`, transform: "translateX(-50%)", fontFamily: "monospace", fontSize: 7, color: "#39FF14", letterSpacing: "0.1em" }}>BEAT</div>
      <div style={{ position: "absolute", top: 3, left: `${tapPos * 100}%`, transform: "translateX(-50%)", fontFamily: "monospace", fontSize: 7, color: "#FF1493", letterSpacing: "0.1em" }}>TAP</div>
    </div>
  );
}

// ── SvgBlurSlider component ──
function SvgBlurSlider({ value, onChange, isAvant }: { value: number; onChange: (v: number) => void; isAvant?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const width = rect.width;
    const clickX = Math.max(0, Math.min(clientX - rect.left, width));
    const percentage = clickX / width;
    const newValue = Math.round(percentage * 40);
    onChange(newValue);
  }, [onChange]);

  useEffect(() => {
    if (!isDragging) return;
    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX);
    const onMouseUp = () => setIsDragging(false);
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) handleMove(e.touches[0].clientX);
    };
    const onTouchEnd = () => setIsDragging(false);

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("touchmove", onTouchMove);
    window.addEventListener("touchend", onTouchEnd);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [isDragging, handleMove]);

  const pct = (value / 40) * 100;
  const strokeColor = isAvant ? "#39FF14" : "#FF1493";

  return (
    <div className="flex flex-col gap-2 mt-4 select-none animate-in fade-in slide-in-from-top-1 duration-200">
      <div className="flex justify-between font-mono text-[9px] text-zinc-500 uppercase tracking-widest px-1">
        <span>BLUR INTENSITY</span>
        <span style={{ color: strokeColor, fontWeight: "bold" }}>{value}px</span>
      </div>

      <div 
        ref={containerRef}
        className="relative h-6 flex items-center cursor-pointer"
        onMouseDown={(e) => {
          setIsDragging(true);
          handleMove(e.clientX);
        }}
        onTouchStart={(e) => {
          if (e.touches[0]) {
            setIsDragging(true);
            handleMove(e.touches[0].clientX);
          }
        }}
      >
        <svg className="w-full h-4 overflow-visible" xmlns="http://www.w3.org/2000/svg">
          <line 
            x1="0" y1="8" x2="100%" y2="8" 
            stroke="rgba(255,255,255,0.08)" strokeWidth="4" 
            strokeDasharray="4 2" 
          />
          <line 
            x1="0" y1="8" x2={`${pct}%`} y2="8" 
            stroke={strokeColor} strokeWidth="4" 
            style={{ filter: `drop-shadow(0 0 4px ${strokeColor})` }}
          />
          {[0, 25, 50, 75, 100].map((x) => (
            <rect
              key={x}
              x={`${x}%`}
              y="5"
              width="2"
              height="6"
              fill={value >= (x / 100) * 40 ? strokeColor : "rgba(255,255,255,0.18)"}
              transform="translateX(-1px)"
            />
          ))}
        </svg>

        <div 
          style={{
            position: "absolute",
            left: `${pct}%`,
            transform: "translate(-50%, -50%)",
            top: "50%",
            width: 20,
            height: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none"
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" overflow="visible">
            <polygon 
              points="8,1 15,8 8,15 1,8" 
              fill={strokeColor} 
              stroke="#ffffff" 
              strokeWidth="1.5"
              style={{ filter: `drop-shadow(0 0 6px ${strokeColor})` }}
            />
          </svg>
        </div>
      </div>
      
      <div className="flex justify-between font-mono text-[8px] text-zinc-600 tracking-wider px-1">
        <span>0PX (SHARP)</span>
        <span>20PX (BALANCED)</span>
        <span>40PX (MAX BLUR)</span>
      </div>
    </div>
  );
}

// ── SvgLatencySlider component ──
function SvgLatencySlider({ value, onChange, isAvant }: { value: number; onChange: (v: number) => void; isAvant?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const width = rect.width;
    const clickX = Math.max(0, Math.min(clientX - rect.left, width));
    const percentage = clickX / width;
    
    // Map percentage (0..1) to range -150..150 with step 5
    const rawVal = -150 + percentage * 300;
    const steppedValue = Math.round(rawVal / 5) * 5;
    const clampedValue = Math.max(-150, Math.min(150, steppedValue));
    onChange(clampedValue);
  }, [onChange]);

  useEffect(() => {
    if (!isDragging) return;
    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX);
    const onMouseUp = () => setIsDragging(false);
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) handleMove(e.touches[0].clientX);
    };
    const onTouchEnd = () => setIsDragging(false);

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("touchmove", onTouchMove);
    window.addEventListener("touchend", onTouchEnd);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [isDragging, handleMove]);

  // Map value (-150..150) to percentage (0..100)
  const pct = ((value + 150) / 300) * 100;
  const strokeColor = isAvant ? "#39FF14" : "#FF1493";

  return (
    <div className="flex flex-col gap-2 mt-4 select-none animate-in fade-in slide-in-from-top-1 duration-200">
      <div 
        ref={containerRef}
        className="relative h-6 flex items-center cursor-pointer"
        onMouseDown={(e) => {
          setIsDragging(true);
          handleMove(e.clientX);
        }}
        onTouchStart={(e) => {
          if (e.touches[0]) {
            setIsDragging(true);
            handleMove(e.touches[0].clientX);
          }
        }}
      >
        <svg className="w-full h-4 overflow-visible" xmlns="http://www.w3.org/2000/svg">
          <line 
            x1="0" y1="8" x2="100%" y2="8" 
            stroke="rgba(255,255,255,0.08)" strokeWidth="4" 
            strokeDasharray="4 2" 
          />
          <line 
            x1="0" y1="8" x2={`${pct}%`} y2="8" 
            stroke={strokeColor} strokeWidth="4" 
            style={{ filter: `drop-shadow(0 0 4px ${strokeColor})` }}
          />
          {/* Ticks at -150, -75, 0, 75, 150 */}
          {[0, 25, 50, 75, 100].map((x) => (
            <rect
              key={x}
              x={`${x}%`}
              y="5"
              width="2"
              height="6"
              fill={((value + 150) / 300) * 100 >= x ? strokeColor : "rgba(255,255,255,0.18)"}
              transform="translateX(-1px)"
            />
          ))}
        </svg>

        <div 
          style={{
            position: "absolute",
            left: `${pct}%`,
            transform: "translate(-50%, -50%)",
            top: "50%",
            width: 20,
            height: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none"
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" overflow="visible">
            <polygon 
              points="8,1 15,8 8,15 1,8" 
              fill={strokeColor} 
              stroke="#ffffff" 
              strokeWidth="1.5"
              style={{ filter: `drop-shadow(0 0 6px ${strokeColor})` }}
            />
          </svg>
        </div>
      </div>
      
      <div className="flex justify-between font-mono text-[8px] text-zinc-600 tracking-wider px-1">
        <span>−150ms (EARLY)</span>
        <span style={{ color: value === 0 ? "rgba(255,255,255,0.4)" : strokeColor, fontWeight: "bold" }}>
          {value === 0 ? "0ms (SYNCED)" : value > 0 ? `+${value}ms (LATE)` : `${value}ms (EARLY)`}
        </span>
        <span>+150ms (LATE)</span>
      </div>
    </div>
  );
}

// ── Custom SVG Icons for Options Categories ──
function GameplayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 md:w-4 md:h-4 stroke-current fill-none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

function ControlsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 md:w-4 md:h-4 stroke-current fill-none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M18 12h.01M7 16h10" />
    </svg>
  );
}

function ThemesIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 md:w-4 md:h-4 stroke-current fill-none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

function DisplayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 md:w-4 md:h-4 stroke-current fill-none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="12" rx="2" />
      <path d="M9 21h6M12 15v6M3 9h18M12 3v12" />
    </svg>
  );
}

function FrontsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 md:w-4 md:h-4 stroke-current fill-none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M12 8v8M8 12h8" />
      <path d="M12 12l2-2m-4 4l-2 2" />
    </svg>
  );
}

function BacksIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 md:w-4 md:h-4 stroke-current fill-none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M12 3v18M4 12h16M8 7l8 10" />
    </svg>
  );
}

// ── Main Modal Component ──
export default function OptionsModal({ isOpen, onClose }: OptionsModalProps) {
  const [opts, setOpts] = useState<GameOpts>(loadOpts());
  const [activeTab, setActiveTab] = useState<'gameplay' | 'controls' | 'themes' | 'backgrounds' | 'fronts' | 'backs'>('gameplay');
  const [remappingLane, setRemappingLane] = useState<number | null>(null);
  const [resetState, setResetState] = useState<"idle" | "confirm">("idle");
  const [gsStatus, setGsStatus] = useState<GameSenseStatus>("scanning");
  const resetTimer = useRef<NodeJS.Timeout | null>(null);
  const colorRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  // Sync state with useVaultStore
  const { tokenBalance, unlockedSkins, unlockSkin, echoPrestigeScore, updateSettings, updateProgression, updateCheats } = useVaultStore();

  const [activeCardSkin, setActiveCardSkin] = useState('original');
  const [activeCardBack, setActiveCardBack] = useState('classic');
  const [hoveredFrontSkin, setHoveredFrontSkin] = useState<string | null>(null);
  const [hoveredBackSkin, setHoveredBackSkin] = useState<string | null>(null);
  const [previewCard, setPreviewCard] = useState<VaultCard>(SAMPLE_PREVIEW_CARD);

  useEffect(() => {
    if (isOpen) {
      setOpts(loadOpts());
      try {
        setActiveCardSkin(localStorage.getItem('opt_cardSkin') || 'original');
        setActiveCardBack(localStorage.getItem('opt_cardBack') || 'classic');
      } catch (e) {
        // ignore
      }

      gameSenseService.init().then(status => {
        setGsStatus(status);
      });

      // Load current Song of the Day as visual preview card
      import("../utils/dayCalc").then(({ getCurrentDay }) => {
        import("../services/vaultService").then(({ getCardByDay }) => {
          const currentDay = getCurrentDay();
          getCardByDay(currentDay).then(card => {
            if (card) {
              setPreviewCard({
                ...card,
                rarity: "legendary" // Mock to legendary to display active border effects at full fidelity
              });
            }
          });
        });
      });
    }
  }, [isOpen]);

  useEffect(() => {
    const handler = () => {
      setOpts(loadOpts());
    };
    window.addEventListener("cheat_code_activated", handler);
    return () => window.removeEventListener("cheat_code_activated", handler);
  }, []);

  // Handle ESC key to close modal or cancel remapping
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") {
        if (remappingLane !== null) {
          setRemappingLane(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, remappingLane, onClose]);

  // Remap keyboard listener
  useEffect(() => {
    if (remappingLane === null) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      if (e.key === "Escape") {
        setRemappingLane(null);
        return;
      }
      const ok = e.key.length === 1 || e.key.startsWith("Arrow");
      if (!ok) return;
      handleRemapKey(e.key);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [remappingLane]);

  // Save specific settings helper
  const toggleSetting = (k: "missSystem" | "hudMisses" | "comboDisplay" | "judgmentText" | "useLocalFiles" | "bgMusic" | "haptics" | "gameSenseEnabled") => {
    if (k === "missSystem" && localStorage.getItem("opt_unlocked_noclip") !== "true") {
      audioManager.playSfx('locked_out', 0.15);
      return;
    }
    const v = !opts[k];
    localStorage.setItem(`opt_${k}`, String(v));
    setOpts(o => ({ ...o, [k]: v }));
    updateSettings({ [k]: v });
    if (k === "useLocalFiles") clearCatalogCache();
    if (k === "bgMusic") window.dispatchEvent(new Event("bgmusic_toggle"));
    if (k === "gameSenseEnabled") {
      setGsStatus("scanning");
      setTimeout(() => {
        gameSenseService.init().then(status => {
          setGsStatus(status);
        });
      }, 50);
    }
    logAnalyticsEvent('setting_change', { key: k, value: v });
    audioManager.playSfx('tap_nav', 0.1);
  };

  const renderToggle = (k: "missSystem" | "hudMisses" | "comboDisplay" | "judgmentText" | "useLocalFiles" | "bgMusic" | "haptics" | "gameSenseEnabled") => {
    const isNoclipLocked = k === "missSystem" && localStorage.getItem("opt_unlocked_noclip") !== "true";
    if (isNoclipLocked) {
      return (
        <button 
          onClick={() => audioManager.playSfx('locked_out', 0.15)}
          className="w-11 h-5 rounded-full p-0.5 border border-red-500/20 bg-red-950/20 flex items-center justify-center cursor-not-allowed"
          title="LOCKED — Enter code idnoclip in Redeem Center"
        >
          <Lock size={10} className="text-red-500 animate-pulse" />
        </button>
      );
    }
    const val = opts[k];
    const activeColor = isAvant ? "#39FF14" : "#FF1493";
    return (
      <button 
        onClick={() => toggleSetting(k)}
        className={`w-11 h-5 rounded-full p-0.5 transition-all relative cursor-pointer border ${
          val 
            ? isAvant 
              ? 'bg-[#39FF14]/15 border-[#39FF14] shadow-[0_0_8px_rgba(57,255,20,0.25)]' 
              : 'bg-[#FF1493]/15 border-[#FF1493] shadow-[0_0_8px_rgba(255,20,147,0.25)]'
            : 'bg-black/40 border-white/10 hover:border-white/20'
        }`}
      >
        <span 
          className={`w-3.5 h-3.5 rounded-full block transition-all ${
            val 
              ? 'translate-x-[22px]' 
               : 'translate-x-0 bg-zinc-600'
          }`}
          style={{ background: val ? activeColor : undefined }}
        />
      </button>
    );
  };

  const setNoteThemePreset = (themeId: string, colors: string[]) => {
    localStorage.setItem("opt_noteTheme", themeId);
    colors.forEach((c, idx) => {
      localStorage.setItem(`opt_laneColor_${idx}`, c);
    });
    setOpts(o => ({ ...o, noteTheme: themeId, laneColors: colors as [string, string, string] }));
    updateSettings({
      noteTheme: themeId,
      laneColors: colors as [string, string, string],
    });
    logAnalyticsEvent('setting_change', { key: 'noteTheme', value: themeId });
    audioManager.playSfx('tap_nav', 0.1);
  };

  const handleRemapKey = (key: string) => {
    if (remappingLane === null) return;
    const k = key === " " ? " " : key.length === 1 ? key.toLowerCase() : key;
    const nextKeys = [...opts.laneKeys] as [string, string, string];
    nextKeys[remappingLane] = k;
    localStorage.setItem(`opt_laneKey_${remappingLane}`, k);
    setOpts(o => ({ ...o, laneKeys: nextKeys }));
    updateSettings({ laneKeys: nextKeys });
    setRemappingLane(null);
    logAnalyticsEvent('setting_change', { key: `laneKey_${remappingLane}`, value: k });
    audioManager.playSfx('menu_confirm', 0.15);
  };

  const setLaneColor = (lane: number, color: string) => {
    const newColors = [...opts.laneColors] as [string, string, string];
    newColors[lane] = color;
    localStorage.setItem(`opt_laneColor_${lane}`, color);
    localStorage.setItem("opt_noteTheme", "custom");
    setOpts(o => ({ ...o, laneColors: newColors, noteTheme: "custom" }));
    updateSettings({
      laneColors: newColors,
      noteTheme: "custom",
    });
    logAnalyticsEvent('setting_change', { key: `laneColor_${lane}`, value: color });
    audioManager.playSfx('tap_nav', 0.05);
  };

  const handleReset = () => {
    if (resetState === "idle") {
      setResetState("confirm");
      resetTimer.current = setTimeout(() => setResetState("idle"), 2500);
      audioManager.playSfx('tap_nav', 0.1);
    } else {
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetOpts();
      setOpts(loadOpts());
      updateSettings({
        audioOffset: 0,
        laneKeys: ["a", "s", "d"],
        laneColors: ["#FF1493", "#00E5FF", "#39FF14"],
        noteTheme: "classic",
        cardSkin: "original",
        cardBack: "classic",
        gameBackground: "cover_blur",
        backgroundBlur: 18,
        hudMisses: true,
        comboDisplay: true,
        judgmentText: true,
        bgMusic: false,
        haptics: true,
        missSystem: true,
      });
      updateProgression({ noteGenerationSource: "auto" });
      setResetState("idle");
      logAnalyticsEvent('setting_reset');
      audioManager.playSfx('menu_confirm', 0.2);
    }
  };

  // Card fronts select / unlock
  const handleSelectFrontSkin = (skinId: string) => {
    localStorage.setItem('opt_cardSkin', skinId);
    setActiveCardSkin(skinId);
    updateSettings({ cardSkin: skinId });
    window.dispatchEvent(new Event('card_skins_changed'));
    audioManager.playSfx('menu_confirm', 0.15);
  };

  const handleUnlockFrontSkin = async (skinId: string, cost: number) => {
    audioManager.playSfx('tap_nav', 0.12);
    const success = await unlockSkin(skinId, cost);
    if (success) {
      handleSelectFrontSkin(skinId);
    }
  };

  // Card backs select / unlock
  const handleSelectBackSkin = (skinId: string) => {
    localStorage.setItem('opt_cardBack', skinId);
    setActiveCardBack(skinId);
    updateSettings({ cardBack: skinId });
    window.dispatchEvent(new Event('card_skins_changed'));
    audioManager.playSfx('menu_confirm', 0.15);
  };

  const handleUnlockBackSkin = async (skinId: string, cost: number) => {
    audioManager.playSfx('tap_nav', 0.12);
    const success = await unlockSkin('back_' + skinId, cost);
    if (success) {
      handleSelectBackSkin(skinId);
    }
  };

  if (!isOpen) return null;

  const activeTheme = getActiveTheme(opts.noteTheme);
  const isAvant = activeTheme === 'avant-garde';
  const themeColor = isAvant ? "#39FF14" : "#FF1493";

  const NOTE_THEME_PRESETS = [
    { id: 'classic', name: 'Classic Vault', colors: ['#FF1493', '#00E5FF', '#39FF14'] },
    { id: 'cyberpunk', name: 'Cyberpunk Neon', colors: ['#00F0FF', '#FFFF00', '#FF007F'] },
    { id: 'sunset', name: 'Synth Sunset', colors: ['#FF0055', '#7B2CBF', '#FF8C00'] },
    { id: 'acid', name: 'Acid Hazard', colors: ['#39FF14', '#E5B800', '#00E5FF'] },
    { id: 'crimson', name: 'Midnight Crimson', colors: ['#FF0000', '#800000', '#CC2200'] },
    { id: 'gold_prestige', name: 'Gold Prestige', colors: ['#FFD700', '#E5B800', '#FF8C00'] },
    { id: 'ghost', name: 'Void Ghost', colors: ['#D8B4FE', '#374151', '#F3F4F6'] }
  ];

  const STANDARD_CARD_BACKS = [
    { id: 'classic', name: 'Classic Vault', desc: 'Standard rarity-colored core grid', style: { background: '#0c0a07', border: '1px solid rgba(255,255,255,0.1)' } },
    { id: 'holo', name: 'Holo Foil', desc: 'Shimmering rainbow overlay sheen', style: { background: 'linear-gradient(135deg, #0e1b29, #210e29)', border: '1px solid #00ffff' } },
    { id: 'carbon', name: 'Carbon Tech', desc: 'High-tech composite carbon weave', style: { background: '#151619', border: '1.5px solid #00ffff', boxShadow: '0 0 8px #00ffff33' } },
    { id: 'gold_luxe', name: 'Royal Gold', desc: 'Gilded gold leaf frame & starry dust', style: { background: 'linear-gradient(135deg, #1f1a0f, #1c150c)', border: '1px solid #ffd700', boxShadow: '0 0 8px rgba(255,215,0,0.2)' } },
    { id: 'matrix', name: 'Matrix Code', desc: 'Binary rain & console grid lines', style: { background: '#030804', border: '1px solid #39ff14', boxShadow: '0 0 8px rgba(57,255,20,0.2)' } },
    { id: 'th3scr1b3', name: 'th3scr1b3 Signature', desc: 'Abstract red splatters & gothic marks', style: { background: 'radial-gradient(circle, #4a002a, #0d0006)', border: '1px dashed #ff007f' } },
  ];

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-4 bg-black/90 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="w-full h-full md:h-[85vh] md:max-w-5xl bg-[#080808] border-0 md:border flex flex-col md:rounded-lg overflow-hidden shadow-2xl relative"
        style={{ borderColor: isAvant ? "#39FF14" : "rgba(255, 20, 147, 0.4)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Top Header Bar */}
        <div 
          className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-white/10 shrink-0"
          style={{ background: isAvant ? "rgba(57, 255, 20, 0.04)" : "rgba(255, 20, 147, 0.04)" }}
        >
          <div className="flex items-center gap-2.5">
            <Sliders size={18} className={isAvant ? "text-[#39FF14]" : "text-[#FF1493]"} />
            <h1 className="text-sm md:text-base brutalist-menu-title italic tracking-wide" style={{ '--neon-accent': isAvant ? '#39FF14' : '#FF1493' } as any}>
              SYSTEM CONFIG
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Balance Ticker */}
            <div className="flex items-center gap-1 font-mono text-[8.5px] md:text-[9.5px] font-black text-[#ffd700] tracking-wider bg-white/5 border border-white/10 px-2 py-1 rounded">
              <span>BALANCE: {tokenBalance} V⚡</span>
            </div>

            <button 
              onClick={onClose}
              className="p-1 hover:bg-white/10 rounded transition-colors text-white/50 hover:text-white cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Two-Pane Body Layout */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          
          {/* Left Sidebar / Top Mobile Tab Selection */}
          <div className="w-full md:w-[240px] shrink-0 bg-black/35 border-b md:border-b-0 md:border-r border-white/5 flex flex-col justify-between p-2 md:p-4">
            <div 
              className="grid grid-cols-6 md:flex md:flex-col gap-1 md:gap-1.5 w-full pb-1 md:pb-0"
              style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}
            >
              {[
                { id: 'gameplay', label: 'Gameplay Core', short: 'Core', desc: 'Combos, HUD, local library', icon: <GameplayIcon /> },
                { id: 'controls', label: 'Keys & Latency', short: 'Keys', desc: 'Remapping, visual sync', icon: <ControlsIcon /> },
                { id: 'themes', label: 'Note Themes', short: 'Themes', desc: 'Lane colors & presets', icon: <ThemesIcon /> },
                { id: 'backgrounds', label: 'Display & Blur', short: 'Display', desc: 'Background grid options', icon: <DisplayIcon /> },
                { id: 'fronts', label: 'Card Fronts', short: 'Fronts', desc: 'Unlockable custom skins', icon: <FrontsIcon /> },
                { id: 'backs', label: 'Card Backs', short: 'Backs', desc: 'Standard & unlockable backs', icon: <BacksIcon /> }
              ].map(tab => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      audioManager.playSfx('tap_nav', 0.1);
                      setActiveTab(tab.id as any);
                    }}
                    className={`shrink-0 md:shrink-1 text-center md:text-left p-1.5 md:p-2.5 rounded border transition-all flex flex-col items-center md:items-start gap-1 group cursor-pointer ${
                      active
                        ? isAvant 
                          ? 'border-[#39FF14] bg-[#39FF14]/5 text-white shadow-[0_0_8px_rgba(57,255,20,0.05)]' 
                          : 'border-[#FF1493] bg-[#FF1493]/5 text-white shadow-[0_0_8px_rgba(255,20,147,0.05)]'
                        : 'border-transparent hover:bg-white/5 text-white/60 hover:text-white'
                    }`}
                  >
                    {/* SVG Icon */}
                    <div 
                      className={`transition-colors duration-200 ${
                        active 
                          ? isAvant ? 'text-[#39FF14]' : 'text-[#FF1493]' 
                          : 'text-white/35 group-hover:text-white'
                      }`}
                    >
                      {tab.icon}
                    </div>

                    <span className="font-mono text-[6.5px] sm:text-[7.5px] md:text-[10px] font-black uppercase tracking-wider whitespace-nowrap">
                      <span className="md:hidden">{tab.short}</span>
                      <span className="hidden md:inline">{tab.label}</span>
                    </span>
                    <span className="hidden md:inline text-[7.5px] opacity-60 font-mono font-medium">{tab.desc}</span>
                  </button>
                );
              })}
            </div>

            {/* Bottom Reset (Desktop only) */}
            <div className="hidden md:block space-y-3 pt-4 border-t border-white/5">
              <button
                onClick={handleReset}
                className={`w-full text-center py-2 border rounded font-mono text-[8px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                  resetState === "confirm"
                    ? "bg-red-600 border-red-600 text-white animate-pulse"
                    : "border-white/10 text-white/40 hover:text-white hover:border-white/20"
                }`}
              >
                {resetState === "confirm" ? "⚡ CONFIRM RESET" : "RESET CONFIG"}
              </button>
            </div>
          </div>

          {/* Right Panel Tab Content */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-black/10">
            
            {activeTab === 'gameplay' && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h2 className="text-base md:text-lg brutalist-menu-title italic mb-1" style={{ '--neon-accent': isAvant ? '#39FF14' : '#FF1493' } as any}>Gameplay Core Controls</h2>
                  <p className="text-[9px] text-zinc-500 uppercase tracking-wider">Configure visual feedback, scoring mechanisms, and sound overlays</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Combos & HUD Toggle */}
                  <div className="bg-black/40 border border-white/5 p-4 rounded-lg space-y-4">
                    <h3 className="font-mono text-[9px] font-black text-white/40 uppercase tracking-wider border-b border-white/5 pb-1">HUD & SCORING</h3>
                    
                    <div className="flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-white font-mono uppercase">Miss System (Fails)</span>
                        <span className="text-[8px] text-zinc-500 font-mono">Quarantine note lanes and reset multipliers on misses</span>
                      </div>
                      {renderToggle('missSystem')}
                    </div>

                    <div className="flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-white font-mono uppercase">HUD Miss Counters</span>
                        <span className="text-[8px] text-zinc-500 font-mono">Show live miss details at the top bar</span>
                      </div>
                      {renderToggle('hudMisses')}
                    </div>

                    <div className="flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-white font-mono uppercase">Combo Streak Display</span>
                        <span className="text-[8px] text-zinc-500 font-mono">Show combo streak counts overlay in mid panel</span>
                      </div>
                      {renderToggle('comboDisplay')}
                    </div>

                    <div className="flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-white font-mono uppercase">Judgment Text Indicators</span>
                        <span className="text-[8px] text-zinc-500 font-mono">Perfect, Great, and Late markers on note hit timings</span>
                      </div>
                      {renderToggle('judgmentText')}
                    </div>
                  </div>

                  {/* Audio & Network Files */}
                  <div className="bg-black/40 border border-white/5 p-4 rounded-lg space-y-4">
                    <h3 className="font-mono text-[9px] font-black text-white/40 uppercase tracking-wider border-b border-white/5 pb-1">BGM & LOCAL SYSTEM</h3>

                    <div className="flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-white font-mono uppercase">Ambient BGM</span>
                        <span className="text-[8px] text-zinc-500 font-mono">Casette tape radio hum loops in vault directories</span>
                      </div>
                      {renderToggle('bgMusic')}
                    </div>

                    <div className="flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-white font-mono uppercase">Force Local Audio Files</span>
                        <span className="text-[8px] text-zinc-500 font-mono">Read offline local files over slow public URLs</span>
                      </div>
                      {renderToggle('useLocalFiles')}
                    </div>

                    <div className="flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-white font-mono uppercase">System Haptic Vibrations</span>
                        <span className="text-[8px] text-zinc-500 font-mono">Subtle device feedback on hitting notes</span>
                      </div>
                      {renderToggle('haptics')}
                    </div>

                    <div className="flex justify-between items-center border-t border-white/5 pt-3">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-white font-mono uppercase">SteelSeries GameSense</span>
                        <span className="text-[8px] text-zinc-500 font-mono">
                          Sync device LEDs (Status: <span style={{ 
                            color: gsStatus === 'connected' ? '#39FF14' : 
                                   gsStatus === 'scanning' ? '#E5B800' : 
                                   gsStatus === 'disconnected' ? 'rgba(255,255,255,0.4)' : '#FF1493'
                          }}>
                            {gsStatus.toUpperCase()}
                          </span>)
                        </span>
                      </div>
                      {renderToggle('gameSenseEnabled')}
                    </div>
                  </div>
                </div>

                {/* Chart Generation Source Mode */}
                <div className="bg-black/40 border border-white/5 p-4 rounded-lg space-y-3">
                  <h3 className="font-mono text-[9px] font-black text-white/40 uppercase tracking-wider border-b border-white/5 pb-1">CHART GENERATION ENGINE SOURCE</h3>
                  <div className="flex gap-2">
                    {(["auto", "lyrics", "bpm"] as const).map(mode => {
                      const active = opts.noteGenerationSource === mode;
                      const isLocked = (mode === 'lyrics' || mode === 'bpm') && localStorage.getItem("opt_unlocked_iddqd") !== "true";
                      if (isLocked) {
                        return (
                          <button
                            key={mode}
                            onClick={() => {
                              audioManager.playSfx('locked_out', 0.15);
                            }}
                            className="flex-1 py-2 font-mono text-[9px] font-black uppercase rounded border border-red-500/10 bg-red-950/5 text-red-500/30 flex items-center justify-center gap-1 cursor-not-allowed opacity-50"
                            title="LOCKED — Enter code iddqd in Redeem Center"
                          >
                            <Lock size={8} className="text-red-500" />
                            {mode === 'lyrics' ? 'LYRIC' : 'BPM'}
                          </button>
                        );
                      }
                      return (
                        <button
                          key={mode}
                          onClick={() => {
                            localStorage.setItem("opt_noteGenerationSource", mode);
                            setOpts(o => ({ ...o, noteGenerationSource: mode }));
                            updateProgression({ noteGenerationSource: mode });
                            clearCatalogCache();
                            logAnalyticsEvent('setting_change', { key: 'noteGenerationSource', value: mode });
                            audioManager.playSfx('tap_nav', 0.1);
                          }}
                          className={`flex-1 py-2 font-mono text-[9px] font-black uppercase rounded border transition-all cursor-pointer ${
                            active
                              ? isAvant ? 'border-[#39FF14] bg-[#39FF14]/10 text-white' : 'border-[#FF1493] bg-[#FF1493]/10 text-white'
                              : 'border-white/5 bg-black/40 text-white/40 hover:border-white/15'
                          }`}
                        >
                          {mode === 'auto' ? 'AUTOPILOT' : mode === 'lyrics' ? 'LYRICAL DYNAMICS' : 'BPM BEATS'}
                        </button>
                      );
                    })}
                  </div>
                  <p className="font-mono text-[7.5px] text-zinc-500 leading-normal uppercase">
                    AUTOPILOT: COMBINES AUDIO FREQUENCY WITH BEAT TRANSLATIONS · LYRICAL DYNAMICS: SPEECH PATTERNS TRANSLATION · BPM BEATS: METRONOME STEP ALIGNMENTS
                  </p>
                </div>

                {/* Reset Config (Mobile Only Block) */}
                <div className="pt-4 flex md:hidden justify-end border-t border-white/5">
                  <button
                    onClick={handleReset}
                    className={`w-full text-center py-2.5 border rounded font-mono text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                      resetState === "confirm"
                        ? "bg-red-600 border-red-600 text-white animate-pulse"
                        : "border-white/10 text-white/40 hover:text-white"
                    }`}
                  >
                    {resetState === "confirm" ? "⚡ CONFIRM RESET" : "RESET CONFIG"}
                  </button>
                </div>

              </div>
            )}

            {activeTab === 'controls' && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h2 className="text-base md:text-lg brutalist-menu-title italic mb-1" style={{ '--neon-accent': isAvant ? '#39FF14' : '#FF1493' } as any}>Key remap & audio sync</h2>
                  <p className="text-[9px] text-zinc-500 uppercase tracking-wider">Configure physical inputs for note lanes and calibrate latency sync</p>
                </div>

                {/* Key Remappings for 3 lanes */}
                <div className="grid grid-cols-3 gap-2">
                  {([0, 1, 2] as const).map(lane => {
                    const lc = opts.laneColors[lane];
                    const listening = remappingLane === lane;
                    return (
                      <div 
                        key={lane} 
                        className={`border bg-black/40 flex flex-col relative transition-all rounded p-3 select-none ${
                          listening 
                            ? 'border-[#ff5500] bg-[#ff5500]/5 shadow-[0_0_12px_rgba(255,85,0,0.15)] animate-pulse'
                            : 'border-white/5 hover:border-white/15'
                        }`}
                      >
                        <div className="font-mono text-[8px] tracking-[0.25em] text-zinc-500 pb-1 mb-2 border-b border-white/5">
                          {["LEFT LANE", "MID LANE", "RIGHT LANE"][lane]}
                        </div>
                        
                        <div 
                          className="h-0.5 mx-auto w-12 rounded-full mb-3"
                          style={{ background: `linear-gradient(90deg, transparent, ${lc}, transparent)` }}
                        />

                        <button
                          onClick={() => {
                            audioManager.playSfx('tap_nav', 0.12);
                            setRemappingLane(listening ? null : lane);
                          }}
                          className="w-full bg-transparent border-0 cursor-pointer p-0 text-center focus:outline-none"
                        >
                          <div className="font-mono font-black text-3xl tracking-tighter text-white select-none">
                            {listening ? "…" : keyLabel(opts.laneKeys[lane])}
                          </div>
                          <div className="font-mono text-[7px] text-zinc-500 tracking-wider mt-1 uppercase">
                            {listening ? "PRESS KEY" : "CLICK TO REMAP"}
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Keyboard Overlay key selector */}
                {remappingLane !== null && (
                  <div className="p-3 bg-black/60 border border-white/10 rounded-lg flex flex-col items-center gap-2.5 animate-in fade-in duration-200">
                    <span className="font-mono text-[8px] text-[#ffaa00] uppercase font-bold tracking-widest animate-pulse">
                      ⌨ PRESS ANY KEY ON KEYBOARD OR CHOOSE BELOW TO BIND LANE {remappingLane + 1}
                    </span>
                    <div className="flex flex-col gap-1 w-full">
                      {KEY_ROWS.map((row, rowIdx) => (
                        <div key={rowIdx} className="flex gap-1 justify-center">
                          {row.map(k => (
                            <button
                              key={k}
                              onClick={() => handleRemapKey(k)}
                              className="font-mono text-[8.5px] font-bold py-1.5 px-2 bg-white/5 border border-white/10 hover:bg-white/15 text-white/90 rounded cursor-pointer min-w-[32px] text-center"
                            >
                              {keyLabel(k)}
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Calibration Section */}
                <div className="bg-black/40 border border-white/5 p-4 rounded-lg space-y-4">
                  <h3 className="font-mono text-[9px] font-black text-white/40 uppercase tracking-wider border-b border-white/5 pb-1">AUDIO SYNC LATENCY OFFSET</h3>
                  
                  <BeatVisualizer offsetMs={opts.audioOffset} isAvant={isAvant} />

                   <div className="flex items-center justify-between font-mono">
                    <span className="text-[9px] text-zinc-500 tracking-wider">LATENCY COMPENSATION</span>
                  </div>

                  <SvgLatencySlider 
                    value={opts.audioOffset}
                    onChange={v => {
                      localStorage.setItem("opt_audioOffset", String(v));
                      setOpts(o => ({ ...o, audioOffset: v }));
                      updateSettings({ audioOffset: v });
                    }}
                    isAvant={isAvant}
                  />
                  
                  <p className="font-mono text-[7.5px] text-zinc-500 leading-normal uppercase">
                    DRAG LEFT IF NOTES SEEM TO PASS BEFORE THE BEAT SOUNDS · DRAG RIGHT IF BEAT SOUNDS BEFORE NOTES REACH TRIGGER BAR
                  </p>
                </div>

                {/* Gameplay note types guide */}
                <div className="bg-black/40 border border-white/5 p-4 rounded-lg space-y-4">
                  <h3 className="font-mono text-[9px] font-black text-white/40 uppercase tracking-wider border-b border-white/5 pb-1">GAMEPLAY NOTE TYPES GUIDE</h3>
                  <div className="grid gap-3.5 font-mono text-[10px] text-zinc-400">
                    <div className="flex gap-2">
                      <span className="text-[#39FF14] font-bold min-w-[120px] uppercase">■ TAPS:</span>
                      <span>Press lane key when the note matches the bottom glow line.</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-[#00E5FF] font-bold min-w-[120px] uppercase">▬ HOLD RAILS:</span>
                      <span>Hold down lane key until the tail passes the bottom line.</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-[#FF1493] font-bold min-w-[120px] uppercase">➔ SWIPE RELEASES:</span>
                      <span>Hold the rail, then at the arrow release and flick (or press matching Arrow key).</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-[#FFaa00] font-bold min-w-[120px] uppercase">↝ SLIDE TRANSITIONS:</span>
                      <span>Hold starting lane, then shift to the target lane key as the path bends sideways.</span>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {activeTab === 'themes' && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h2 className="text-base md:text-lg brutalist-menu-title italic mb-1" style={{ '--neon-accent': isAvant ? '#39FF14' : '#FF1493' } as any}>Note Themes & Lane Colors</h2>
                  <p className="text-[9px] text-zinc-500 uppercase tracking-wider">Customize note palettes and individual colors for the three lanes</p>
                </div>

                {/* Note themes grid selection */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {NOTE_THEME_PRESETS.map(t => {
                    const active = opts.noteTheme === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setNoteThemePreset(t.id, t.colors)}
                        className={`font-mono text-[9px] py-2 px-2.5 flex flex-col items-center justify-between border cursor-pointer transition-all rounded ${
                          active 
                            ? isAvant 
                              ? 'border-[#39FF14] bg-[#39FF14]/5 text-white' 
                              : 'border-[#FF1493] bg-[#FF1493]/5 text-white'
                            : 'border-white/5 bg-black/40 text-white/50 hover:border-white/15'
                        }`}
                      >
                        <span className="font-black truncate w-full text-center uppercase tracking-wide mb-1.5">{t.name}</span>
                        <div className="flex gap-1">
                          {t.colors.map((c, i) => (
                            <div key={i} className="w-2.5 h-2.5 rounded-full border border-black/40 shadow-sm" style={{ background: c }} />
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Individual color pickers */}
                <div className="bg-black/40 border border-white/5 p-4 rounded-lg space-y-4">
                  <h3 className="font-mono text-[9px] font-black text-white/40 uppercase tracking-wider border-b border-white/5 pb-1">
                    INDIVIDUAL LANE COLOR CUSTOMIZATION
                  </h3>

                  <div className="grid grid-cols-3 gap-3">
                    {([0, 1, 2] as const).map(lane => {
                      const lc = opts.laneColors[lane];
                      return (
                        <div key={lane} className="border border-white/5 rounded p-2.5 bg-black/20 flex flex-col gap-2">
                          <span className="font-mono text-[7.5px] text-zinc-500 uppercase tracking-wider">
                            {["LEFT NOTE COLOR", "MID NOTE COLOR", "RIGHT NOTE COLOR"][lane]}
                          </span>
                          
                          {/* Color stripe */}
                          <div className="h-1 rounded" style={{ background: lc }} />

                          {/* Swatches selector: 8 per lane */}
                          <div className="grid grid-cols-4 gap-1 mt-1">
                            {COLOR_PRESETS[lane].map(c => (
                              <button
                                key={c}
                                onClick={() => setLaneColor(lane, c)}
                                className="aspect-square w-full rounded border-0 cursor-pointer transition-all hover:scale-105"
                                style={{
                                  background: c,
                                  outline: opts.laneColors[lane] === c
                                    ? isAvant ? "1px solid #39FF14" : "1.5px solid #fff"
                                    : "none",
                                  outlineOffset: "1px"
                                }}
                              />
                            ))}
                          </div>

                          {/* HTML Color Input Picker */}
                          <label className="flex items-center gap-2 mt-1 cursor-pointer font-mono text-[7px] text-zinc-500 uppercase hover:text-white">
                            <div 
                              className="w-4 h-4 rounded border border-white/20 relative flex-shrink-0"
                              style={{ background: lc }}
                            >
                              <input
                                ref={colorRefs[lane]}
                                type="color"
                                value={lc}
                                onChange={e => setLaneColor(lane, e.target.value)}
                                className="opacity-0 absolute inset-0 w-full h-full cursor-pointer p-0 border-0"
                              />
                            </div>
                            <span>CUSTOM PICKER</span>
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            )}

            {activeTab === 'backgrounds' && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h2 className="text-base md:text-lg brutalist-menu-title italic mb-1" style={{ '--neon-accent': isAvant ? '#39FF14' : '#FF1493' } as any}>Global Menu Background & Blur</h2>
                  <p className="text-[9px] text-zinc-500 uppercase tracking-wider">Customize backgrounds rendering across dashboard and archive pages</p>
                </div>

                {/* SvgBlurSlider */}
                <div className="bg-black/40 border border-white/5 p-4 rounded-lg">
                  <h3 className="font-mono text-[9px] font-black text-white/40 uppercase tracking-wider border-b border-white/5 pb-1">BACKGROUND BLUR INTENSITY</h3>
                  <SvgBlurSlider 
                    value={opts.backgroundBlur} 
                    onChange={(v) => {
                      localStorage.setItem("opt_backgroundBlur", String(v));
                      setOpts(o => ({ ...o, backgroundBlur: v }));
                      updateSettings({ backgroundBlur: v });
                    }}
                    isAvant={isAvant}
                  />
                </div>

                {/* Backgrounds Selection Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {GAME_BACKGROUNDS.map(bg => {
                    const active = opts.gameBackground === bg.id;
                    const canUnlock = echoPrestigeScore >= bg.unlockScore;
                    return (
                      <button
                        key={bg.id}
                        disabled={!canUnlock}
                        onClick={() => {
                          localStorage.setItem("opt_gameBackground", bg.id);
                          setOpts(o => ({ ...o, gameBackground: bg.id }));
                          updateSettings({ gameBackground: bg.id });
                          window.dispatchEvent(new Event("bgmusic_toggle"));
                          audioManager.playSfx('menu_confirm', 0.1);
                        }}
                        className={`text-left border p-2.5 rounded flex flex-col justify-between min-h-[72px] transition-all relative ${
                          !canUnlock 
                            ? 'opacity-40 border-white/5 bg-black/10 cursor-not-allowed'
                            : active
                              ? isAvant ? 'border-[#39FF14] bg-[#39FF14]/5 text-white' : 'border-[#FF1493] bg-[#FF1493]/5 text-white'
                              : 'border-white/5 bg-black/40 text-white hover:border-white/15 cursor-pointer'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-1">
                          <span className="font-mono text-[10px] font-black uppercase truncate">{bg.name}</span>
                          {!canUnlock && <Lock size={10} className="text-[#ffd700] shrink-0" />}
                        </div>
                        
                        <div className="flex flex-col gap-0.5 mt-2">
                          <span className="text-[7px] text-zinc-500 font-mono leading-tight truncate">{bg.desc.toUpperCase()}</span>
                          <span className="text-[6.5px] font-black font-mono" style={{ color: canUnlock ? themeColor : '#ff9900' }}>
                            {bg.unlockText.toUpperCase()}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'fronts' && (
              <div className="space-y-4 animate-fade-in">
                <div>
                  <h2 className="text-base md:text-lg brutalist-menu-title italic mb-1" style={{ '--neon-accent': isAvant ? '#39FF14' : '#FF1493' } as any}>Card Front Skins Catalog</h2>
                  <p className="text-[9px] text-zinc-500 uppercase tracking-wider">Unlock and select custom card borders for cards in your collection</p>
                </div>

                <div className="flex flex-col lg:flex-row gap-6 items-center lg:items-start relative">
                  
                  {/* Visual Preview Side Column */}
                  <div className="w-full lg:w-[220px] shrink-0 bg-black/95 lg:bg-black/45 border border-white/10 lg:border-white/5 p-3 lg:p-4 rounded-xl flex flex-row lg:flex-col items-center justify-center gap-4 lg:gap-3 sticky lg:relative top-[-16px] lg:top-0 z-20 lg:z-0 shadow-xl lg:shadow-none backdrop-blur-md lg:backdrop-blur-none">
                    <span className="font-mono text-[9px] text-zinc-500 uppercase tracking-wider hidden lg:block">LIVE SKIN PREVIEW</span>
                    <CardSkinContext.Provider value={{ staticFace: 'front', backSkin: activeCardBack }}>
                      <div className="w-[115px] h-[162px] lg:w-[170px] lg:h-[240px] relative rounded-lg lg:rounded-xl overflow-hidden shadow-2xl bg-zinc-950/80 shrink-0">
                        {(() => {
                          const SkinComp = getSkinComponent(hoveredFrontSkin || activeCardSkin);
                          return <SkinComp card={previewCard} />;
                        })()}
                      </div>
                    </CardSkinContext.Provider>
                    <div className="text-left lg:text-center font-mono">
                      <span className="text-[11px] lg:text-[10px] text-white font-black block uppercase">
                        {FRONT_SKINS.find(s => s.id === (hoveredFrontSkin || activeCardSkin))?.name}
                      </span>
                      <span className="text-[7.5px] text-zinc-400 lg:text-zinc-500 uppercase mt-0.5 block">
                        {hoveredFrontSkin ? "PREVIEWING HOVERED" : "CURRENTLY SELECTED"}
                      </span>
                    </div>
                  </div>

                  {/* Grid Selector */}
                  <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-2.5 lg:mt-0 mt-4">
                    {FRONT_SKINS.map(skin => {
                      const isUnlocked = skin.cost === 0 || unlockedSkins.includes(skin.id);
                      const isSelected = activeCardSkin === skin.id;

                      return (
                        <div 
                          key={skin.id}
                          className={`border rounded p-3 flex flex-col justify-between min-h-[96px] transition-all relative select-none ${
                            isSelected 
                              ? isAvant 
                                ? 'border-[#39FF14] bg-[#39FF14]/5 shadow-[0_0_8px_rgba(57,255,20,0.1)]' 
                                : 'border-[#FF1493] bg-[#FF1493]/5 shadow-[0_0_8px_rgba(255,20,147,0.1)]'
                              : isUnlocked 
                                ? 'border-white/5 bg-black/40 hover:border-white/15 cursor-pointer' 
                                : 'border-white/5 bg-black/10 opacity-70'
                          }`}
                          onClick={() => isUnlocked && handleSelectFrontSkin(skin.id)}
                          onMouseEnter={() => setHoveredFrontSkin(skin.id)}
                          onMouseLeave={() => setHoveredFrontSkin(null)}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black font-mono text-white uppercase flex items-center gap-1.5">
                                {skin.name}
                                {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                              </span>
                              <span className="text-[7.5px] text-zinc-500 font-mono mt-1 leading-snug uppercase">{skin.desc}</span>
                            </div>
                            {!isUnlocked && <Lock size={11} className="text-[#ffd700]" />}
                          </div>

                          <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-2">
                            {isUnlocked ? (
                              isSelected ? (
                                <span className="text-[7.5px] text-emerald-400 font-mono font-black uppercase tracking-wider flex items-center gap-1">
                                  <Check size={10} /> ACTIVE SKIN
                                </span>
                              ) : (
                                <span className="text-[7.5px] text-zinc-500 font-mono font-black uppercase tracking-wider">
                                  UNLOCKED
                                </span>
                              )
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUnlockFrontSkin(skin.id, skin.cost);
                                }}
                                className="w-full text-center text-[8px] font-mono font-black uppercase tracking-wider bg-[#ffd700] hover:bg-[#ffe045] text-black py-1 px-2 rounded transition-all flex items-center justify-center gap-1 cursor-pointer"
                              >
                                UNLOCK FOR {skin.cost} V⚡
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'backs' && (
              <div className="space-y-5 animate-fade-in">
                <div>
                  <h2 className="text-base md:text-lg brutalist-menu-title italic mb-1" style={{ '--neon-accent': isAvant ? '#39FF14' : '#FF1493' } as any}>Card Back Skins Catalog</h2>
                  <p className="text-[9px] text-zinc-500 uppercase tracking-wider">Select standard visual backings or unlock special card backings</p>
                </div>

                <div className="flex flex-col lg:flex-row gap-6 items-center lg:items-start relative">
                  
                  {/* Visual Preview Side Column */}
                  <div className="w-full lg:w-[220px] shrink-0 bg-black/95 lg:bg-black/45 border border-white/10 lg:border-white/5 p-3 lg:p-4 rounded-xl flex flex-row lg:flex-col items-center justify-center gap-4 lg:gap-3 sticky lg:relative top-[-16px] lg:top-0 z-20 lg:z-0 shadow-xl lg:shadow-none backdrop-blur-md lg:backdrop-blur-none">
                    <span className="font-mono text-[9px] text-zinc-500 uppercase tracking-wider hidden lg:block">LIVE BACK PREVIEW</span>
                    <CardSkinContext.Provider value={{ staticFace: 'back', backSkin: hoveredBackSkin || activeCardBack }}>
                      <div className="w-[115px] h-[162px] lg:w-[170px] lg:h-[240px] relative rounded-lg lg:rounded-xl overflow-hidden shadow-2xl bg-zinc-950/80 shrink-0">
                        {(() => {
                          const SkinComp = getSkinComponent(activeCardSkin);
                          const BackComp = getBackComponent(hoveredBackSkin || activeCardBack);
                          return <SkinComp card={previewCard} backSide={<BackComp card={previewCard} />} />;
                        })()}
                      </div>
                    </CardSkinContext.Provider>
                    <div className="text-left lg:text-center font-mono">
                      <span className="text-[11px] lg:text-[10px] text-white font-black block uppercase font-mono">
                        {[...STANDARD_CARD_BACKS, ...BACK_SKINS.map(s => ({ id: s.id, name: s.name }))].find(b => b.id === (hoveredBackSkin || activeCardBack))?.name}
                      </span>
                      <span className="text-[7.5px] text-zinc-400 lg:text-zinc-500 uppercase mt-0.5 block">
                        {hoveredBackSkin ? "PREVIEWING HOVERED" : "CURRENTLY SELECTED"}
                      </span>
                    </div>
                  </div>

                  {/* Lists Container */}
                  <div className="flex-1 w-full space-y-5 lg:mt-0 mt-4">
                    {/* Section 1: Standard Card Backs */}
                    <div className="space-y-3">
                      <h3 className="font-mono text-[9px] font-black text-white/40 uppercase tracking-wider border-b border-white/5 pb-1">STANDARD CARD BACKS</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {STANDARD_CARD_BACKS.map(skin => {
                          const isSelected = activeCardBack === skin.id;
                          return (
                            <div 
                              key={skin.id}
                              className={`border rounded p-3 flex flex-col justify-between min-h-[96px] transition-all cursor-pointer select-none ${
                                isSelected 
                                  ? isAvant 
                                    ? 'border-[#39FF14] bg-[#39FF14]/5 shadow-[0_0_8px_rgba(57,255,20,0.1)]' 
                                    : 'border-[#FF1493] bg-[#FF1493]/5 shadow-[0_0_8px_rgba(255,20,147,0.1)]'
                                  : 'border-white/5 bg-black/40 hover:border-white/15'
                              }`}
                              onClick={() => handleSelectBackSkin(skin.id)}
                              onMouseEnter={() => setHoveredBackSkin(skin.id)}
                              onMouseLeave={() => setHoveredBackSkin(null)}
                            >
                              <div className="flex flex-col">
                                <span className="text-[10px] font-black font-mono text-white uppercase flex items-center gap-1.5">
                                  {skin.name}
                                  {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                                </span>
                                <span className="text-[7.5px] text-zinc-500 font-mono mt-1 leading-snug uppercase">{skin.desc}</span>
                              </div>

                              <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-2">
                                {isSelected ? (
                                  <span className="text-[7.5px] text-emerald-400 font-mono font-black uppercase tracking-wider flex items-center gap-1">
                                    <Check size={10} /> ACTIVE BACK
                                  </span>
                                ) : (
                                  <span className="text-[7.5px] text-zinc-500 font-mono font-black uppercase tracking-wider">
                                    UNLOCKED (FREE)
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Section 2: Special Unlockable Card Backs */}
                    <div className="space-y-3 pt-2">
                      <h3 className="font-mono text-[9px] font-black text-white/40 uppercase tracking-wider border-b border-white/5 pb-1">MINT EDITOR UNLOCKABLE BACKS</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {BACK_SKINS.map(skin => {
                          const isUnlocked = unlockedSkins.includes('back_' + skin.id);
                          const isSelected = activeCardBack === skin.id;

                          return (
                            <div 
                              key={skin.id}
                              className={`border rounded p-3 flex flex-col justify-between min-h-[96px] transition-all relative select-none ${
                                isSelected 
                                  ? isAvant 
                                    ? 'border-[#39FF14] bg-[#39FF14]/5 shadow-[0_0_8px_rgba(57,255,20,0.1)]' 
                                    : 'border-[#FF1493] bg-[#FF1493]/5 shadow-[0_0_8px_rgba(255,20,147,0.1)]'
                                  : isUnlocked 
                                    ? 'border-white/5 bg-black/40 hover:border-white/15 cursor-pointer' 
                                    : 'border-white/5 bg-black/10 opacity-70'
                              }`}
                              onClick={() => isUnlocked && handleSelectBackSkin(skin.id)}
                              onMouseEnter={() => setHoveredBackSkin(skin.id)}
                              onMouseLeave={() => setHoveredBackSkin(null)}
                            >
                              <div className="flex justify-between items-start gap-2">
                                <div className="flex flex-col">
                                  <span className="text-[10px] font-black font-mono text-white uppercase flex items-center gap-1.5">
                                    {skin.name}
                                    {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                                  </span>
                                  <span className="text-[7.5px] text-zinc-500 font-mono mt-1 leading-snug uppercase">{skin.desc}</span>
                                </div>
                                {!isUnlocked && <Lock size={11} className="text-[#ffd700]" />}
                              </div>

                              <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-2">
                                {isUnlocked ? (
                                  isSelected ? (
                                    <span className="text-[7.5px] text-emerald-400 font-mono font-black uppercase tracking-wider flex items-center gap-1">
                                      <Check size={10} /> ACTIVE BACK
                                    </span>
                                  ) : (
                                    <span className="text-[7.5px] text-zinc-500 font-mono font-black uppercase tracking-wider">
                                      UNLOCKED
                                    </span>
                                  )
                                ) : (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleUnlockBackSkin(skin.id, skin.cost);
                                    }}
                                    className="w-full text-center text-[8px] font-mono font-black uppercase tracking-wider bg-[#ffd700] hover:bg-[#ffe045] text-black py-1 px-2 rounded transition-all flex items-center justify-center gap-1 cursor-pointer"
                                  >
                                    UNLOCK FOR {skin.cost} V⚡
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            )}

          </div>

        </div>

        {/* Bottom Info Footer */}
        <div className="px-6 py-3 border-t border-white/10 bg-black/60 flex items-center justify-between font-mono text-[7.5px] text-zinc-500 tracking-widest uppercase">
          <span>COGNITIVE LINK: ONLINE // PROTOCOL BUILD_1.5.0</span>
          <span>ESC key to close · click backdrop to return</span>
        </div>
      </div>
    </div>
  );
}
