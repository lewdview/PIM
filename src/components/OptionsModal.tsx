import { useState, useEffect, useRef, useCallback, useMemo, type ReactNode, type CSSProperties } from "react";
import { loadOpts, resetOpts, keyLabel, normalizeLaneKey, ARROW_LANE_KEYS, getActiveTheme, getEffectiveDpr, type GameOpts, type RenderResolution, type GfxLevel, type FpsTarget, type ParticleDensity, GAME_BACKGROUNDS, GAME_TRACKS, defaultLyricsMode } from "../lib/options";
import { useLocation } from "wouter";
import { clearCatalogCache } from "../game/api";
import { audioManager } from "../game/audio";
import { haptics } from "../utils/haptics";
import { logAnalyticsEvent } from "../services/telemetryService";
import { gameSenseService, type GameSenseStatus } from "../services/gameSenseService";
import { useVaultStore } from "../store/useVaultStore";
import { X, Sparkles, Check, Lock, Flame, Zap, Cpu, Layers } from "lucide-react";
import "../styles/optionsMenu.css";
import { VTokenCrestIcon, RemixDialIcon, HazardWarningIcon, StageCrestIcon } from "./icons/CustomVectorIcons";
import type { VaultCard } from "../services/vaultService";
import { CHART_VARIANT_CHOSEN_KEY, DEFAULT_CHART_VARIANT, resolveChartVariant } from "../lib/chartVariant";
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
  description: "A sample card for previewing skins.",
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
  { id: 'glass', name: 'Frosted Glass', cost: 0, desc: 'Neon-lit frosted glass' },
  { id: 'arcade', name: 'Retro-Arcade', cost: 50, desc: 'Vintage synthesizer control deck style' },
  { id: 'mtg', name: 'Magic Layout', cost: 100, desc: 'Gilded oval sigils & spellbook details' },
  { id: 'poker', name: 'Classic Poker', cost: 50, desc: 'Symmetrical playing card frame' },
  { id: 'duelist', name: 'Duelist Frame', cost: 75, desc: 'Sacred runic circle portals & orange gems' },
  { id: 'monster', name: 'Pocket Beats', cost: 75, desc: 'Retro pixel pocket battle card layout' },
  { id: 'chrome', name: 'Sports Chrome', cost: 100, desc: 'Polished chrome sports-card frame' },
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
    <div className="opt-slider">
      <div className="opt-slider-head">
        <span>Background blur</span>
        <span className="opt-readout">{value}px</span>
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
              transform="translate(-1, 0)"
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
      
      <div className="opt-slider-scale">
        <span>Sharp</span>
        <span>Balanced</span>
        <span>Max blur</span>
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
    <div className="opt-slider">
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
              transform="translate(-1, 0)"
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
      
      <div className="opt-slider-scale">
        <span>−150 ms · early</span>
        <span className="opt-readout">
          {value === 0 ? "0 ms · synced" : value > 0 ? `+${value} ms · late` : `${value} ms · early`}
        </span>
        <span>+150 ms · late</span>
      </div>
    </div>
  );
}

// ── SvgVolumeSlider component ──
function SvgVolumeSlider({ 
  label, 
  value, 
  onChange, 
  isAvant 
}: { 
  label: string; 
  value: number; 
  onChange: (v: number) => void; 
  isAvant?: boolean; 
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const width = rect.width;
    const clickX = Math.max(0, Math.min(clientX - rect.left, width));
    const percentage = clickX / width;
    const newValue = Math.round(percentage * 100) / 100;
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

  const pct = Math.round(value * 100);
  const strokeColor = isAvant ? "#39FF14" : "#FF1493";

  return (
    <div className="opt-slider">
      <div className="opt-slider-head">
        <span>{label}</span>
        <span className="opt-readout">{pct}%</span>
      </div>

      <div 
        ref={containerRef}
        className="relative h-5 flex items-center cursor-pointer"
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
        <svg className="w-full h-3 overflow-visible" xmlns="http://www.w3.org/2000/svg">
          <line 
            x1="0" y1="6" x2="100%" y2="6" 
            stroke="rgba(255,255,255,0.08)" strokeWidth="4" 
            strokeDasharray="4 2" 
          />
          <line 
            x1="0" y1="6" x2={`${pct}%`} y2="6" 
            stroke={strokeColor} strokeWidth="4" 
            style={{ filter: `drop-shadow(0 0 4px ${strokeColor})` }}
          />
          {[0, 25, 50, 75, 100].map((x) => (
            <rect
              key={x}
              x={`${x}%`}
              y="3"
              width="2"
              height="6"
              fill={pct >= x ? strokeColor : "rgba(255,255,255,0.18)"}
              transform="translate(-1, 0)"
            />
          ))}
        </svg>

        <div 
          style={{
            position: "absolute",
            left: `${pct}%`,
            transform: "translate(-50%, -50%)",
            top: "50%",
            width: 16,
            height: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none"
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" overflow="visible">
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
    </div>
  );
}

// ── Custom SVG Icons for Options Categories ──
function GameplayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="stroke-current fill-none" strokeWidth="2.2" strokeLinecap="square" strokeLinejoin="miter">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

function AudioIcon() {
  return (
    <svg viewBox="0 0 24 24" className="stroke-current fill-none" strokeWidth="2.2" strokeLinecap="square" strokeLinejoin="miter">
      <path d="M11 5L6 9H2v6h4l5 4V5z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />
    </svg>
  );
}

function ControlsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="stroke-current fill-none" strokeWidth="2.2" strokeLinecap="square" strokeLinejoin="miter">
      <rect x="2" y="5" width="20" height="14" />
      <path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M18 13h.01M8 16h8" />
    </svg>
  );
}

function GraphicsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="stroke-current fill-none" strokeWidth="2.2" strokeLinecap="square" strokeLinejoin="miter">
      <rect x="2" y="3" width="20" height="14" />
      <path d="M8 21h8M12 17v4" />
      <path d="M12 6.5l1.2 2.3 2.3 1.2-2.3 1.2L12 13.5l-1.2-2.3L8.5 10l2.3-1.2z" />
    </svg>
  );
}

function ThemesIcon() {
  return (
    <svg viewBox="0 0 24 24" className="stroke-current fill-none" strokeWidth="2.2" strokeLinecap="square" strokeLinejoin="miter">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

function StageIcon() {
  return (
    <svg viewBox="0 0 24 24" className="stroke-current fill-none" strokeWidth="2.2" strokeLinecap="square" strokeLinejoin="miter">
      <path d="M2 20L9 4h6l7 16z" />
      <path d="M12 4v16M5.5 12h13" />
    </svg>
  );
}

function FrontsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="stroke-current fill-none" strokeWidth="2.2" strokeLinecap="square" strokeLinejoin="miter">
      <rect x="4" y="3" width="16" height="18" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

function BacksIcon() {
  return (
    <svg viewBox="0 0 24 24" className="stroke-current fill-none" strokeWidth="2.2" strokeLinecap="square" strokeLinejoin="miter">
      <rect x="4" y="3" width="16" height="18" />
      <path d="M4 8l16 10M4 16L20 6" />
    </svg>
  );
}

// ── Menu structure: three groups so players find things by intent (play / look / collect) ──
type ToggleKey = "missSystem" | "hudMisses" | "comboDisplay" | "judgmentText" | "useLocalFiles" | "bgMusic" | "haptics" | "gameSenseEnabled" | "legacyGraphics" | "bloomGlow" | "bgAnimation" | "healingGauge" | "trackLyrics" | "sfxEnabled";

type OptionsTab = 'gameplay' | 'audio' | 'controls' | 'graphics' | 'themes' | 'backgrounds' | 'fronts' | 'backs';

const TAB_GROUPS: { id: string; label: string; tabs: { id: OptionsTab; label: string; desc: string; blurb: string; icon: ReactNode }[] }[] = [
  {
    id: 'play',
    label: 'Play',
    tabs: [
      { id: 'gameplay', label: 'Gameplay', desc: 'HUD, fail rules, charts', blurb: 'What you see while you play, and how each song gets charted.', icon: <GameplayIcon /> },
      { id: 'audio', label: 'Audio & Haptics', desc: 'Volume, vibration, LEDs', blurb: 'Sound effects, menu music, vibration and RGB device sync.', icon: <AudioIcon /> },
      { id: 'controls', label: 'Controls & Sync', desc: 'Lane keys, latency', blurb: 'Rebind your lane keys and line the notes up with your audio.', icon: <ControlsIcon /> },
    ],
  },
  {
    id: 'look',
    label: 'Look',
    tabs: [
      { id: 'graphics', label: 'Graphics', desc: 'Quality, resolution, FPS', blurb: 'Pick a preset, then fine-tune. Lower settings play smoother on older devices.', icon: <GraphicsIcon /> },
      { id: 'themes', label: 'Note Colors', desc: 'Lane palettes', blurb: 'Choose a palette for the three lanes, or mix your own.', icon: <ThemesIcon /> },
      { id: 'backgrounds', label: 'Stage & Camera', desc: 'Backdrops, track, POV', blurb: 'Backdrops, highway style and camera angle. Vault prestige unlocks more.', icon: <StageIcon /> },
    ],
  },
  {
    id: 'collect',
    label: 'Collection',
    tabs: [
      { id: 'fronts', label: 'Card Fronts', desc: 'Frame skins', blurb: 'Frames for every card in your vault. Hover a skin to preview it.', icon: <FrontsIcon /> },
      { id: 'backs', label: 'Card Backs', desc: 'Backs & pack style', blurb: 'Card backs, plus the pack your pulls arrive in.', icon: <BacksIcon /> },
    ],
  },
];

const ALL_TABS = TAB_GROUPS.flatMap(g => g.tabs.map(t => ({ ...t, group: g.label })));

// ── Shared menu primitives (styled in styles/optionsMenu.css) ──
function Panel({ title, hint, children, className }: { title?: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`opt-panel${className ? ` ${className}` : ''}`}>
      {title && (
        <header className="opt-panel-head">
          <h3 className="opt-panel-title">{title}</h3>
          {hint && <span className="opt-panel-hint">{hint}</span>}
        </header>
      )}
      {children}
    </section>
  );
}

function SettingRow({ label, desc, tag, children }: { label: ReactNode; desc?: ReactNode; tag?: ReactNode; children?: ReactNode }) {
  return (
    <div className="opt-row">
      <div className="opt-row-text">
        <span className="opt-row-label">
          {label}
          {tag && <span className="opt-tag">{tag}</span>}
        </span>
        {desc && <span className="opt-row-desc">{desc}</span>}
      </div>
      {children && <div className="opt-row-control">{children}</div>}
    </div>
  );
}

function Switch({ checked, onToggle, label, locked }: { checked: boolean; onToggle: () => void; label: string; locked?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={locked ? false : checked}
      aria-label={locked ? `${label} (locked)` : label}
      title={locked ? 'LOCKED — ???' : undefined}
      className={`opt-switch${locked ? ' is-locked' : ''}`}
      onClick={onToggle}
    >
      {locked ? <Lock size={11} /> : <span className="opt-switch-thumb" />}
    </button>
  );
}

function SegButton({ active, locked, label, sub, icon, onClick }: { active: boolean; locked?: boolean; label: ReactNode; sub?: ReactNode; icon?: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`opt-seg-btn${locked ? ' is-locked' : ''}`}
      onClick={onClick}
      title={locked ? 'LOCKED — ???' : undefined}
    >
      <span className="opt-seg-label">
        <span>{label}</span>
        {locked ? <Lock size={11} /> : icon}
      </span>
      {sub && <span className="opt-seg-sub">{sub}</span>}
    </button>
  );
}

function CodeUnlock({ title, body, value, error, placeholder, onChange, onSubmit }: {
  title: string;
  body: string;
  value: string;
  error: string | null;
  placeholder: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="opt-unlock">
      <div className="opt-unlock-head">
        <Lock size={16} className="opt-unlock-icon" />
        <div>
          <div className="opt-unlock-title">{title} <span className="opt-tag opt-tag--muted">ENCRYPTED</span></div>
          <p className="opt-unlock-body">{body}</p>
        </div>
      </div>
      <form
        className="opt-unlock-form"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="opt-input"
          aria-label={`${title} access code`}
        />
        <button type="submit" className="opt-btn opt-btn--acid">Decrypt &amp; unlock</button>
      </form>
      {error && <span className="opt-error">⚠ {error}</span>}
    </div>
  );
}

// ── AutoLatencyCalibrator component ──
function AutoLatencyCalibrator({
  offsetMs,
  onCalibrated,
}: {
  offsetMs: number;
  onCalibrated: (offsetMs: number) => void;
  // Accent now comes from the menu's CSS theme; prop kept for call-site compatibility.
  isAvant?: boolean;
}) {
  const [phase, setPhase] = useState<'idle' | 'countdown' | 'calibrating' | 'done'>('idle');
  const [countdown, setCountdown] = useState(3);
  const [currentBeatIndex, setCurrentBeatIndex] = useState(0);
  const [taps, setTaps] = useState<{ beatIndex: number; deltaMs: number }[]>([]);
  const [liveOffset, setLiveOffset] = useState<number | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const beatTargetTimesRef = useRef<number[]>([]);
  const countTimerRef = useRef<NodeJS.Timeout | null>(null);
  const beatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const doneTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const clearAllTimers = useCallback(() => {
    if (countTimerRef.current) {
      clearInterval(countTimerRef.current);
      countTimerRef.current = null;
    }
    if (beatIntervalRef.current) {
      clearInterval(beatIntervalRef.current);
      beatIntervalRef.current = null;
    }
    if (doneTimeoutRef.current) {
      clearTimeout(doneTimeoutRef.current);
      doneTimeoutRef.current = null;
    }
  }, []);

  // Ensure AudioContext and timers are strictly disposed on unmount to prevent leaks
  useEffect(() => {
    return () => {
      clearAllTimers();
      if (audioCtxRef.current) {
        try {
          audioCtxRef.current.close();
        } catch {}
        audioCtxRef.current = null;
      }
    };
  }, [clearAllTimers]);

  const playClick = useCallback((freq = 1000, duration = 0.04) => {
    try {
      if (!audioCtxRef.current) return;
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      // ignore
    }
  }, []);

  const handleTap = useCallback(() => {
    if (phase !== 'calibrating' || !audioCtxRef.current) return;
    const now = audioCtxRef.current.currentTime;
    const targets = beatTargetTimesRef.current;
    
    let closestIndex = -1;
    let minDelta = Infinity;

    for (let i = 0; i < targets.length; i++) {
      const delta = (now - targets[i]) * 1000;
      if (Math.abs(delta) < Math.abs(minDelta)) {
        minDelta = delta;
        closestIndex = i;
      }
    }

    if (closestIndex !== -1 && Math.abs(minDelta) < 260) {
      const roundedDelta = Math.round(minDelta);
      setTaps(prev => {
        if (prev.some(t => t.beatIndex === closestIndex)) return prev;
        return [...prev, { beatIndex: closestIndex, deltaMs: roundedDelta }];
      });
    }
  }, [phase]);

  const startCalibration = useCallback(() => {
    clearAllTimers();
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch {}
      audioCtxRef.current = null;
    }
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    audioCtxRef.current = ctx;
    
    setPhase('countdown');
    setCountdown(3);
    setTaps([]);
    setLiveOffset(null);
    setCurrentBeatIndex(0);
    beatTargetTimesRef.current = [];

    let count = 3;
    playClick(600, 0.06);
    
    countTimerRef.current = setInterval(() => {
      count--;
      if (count > 0) {
        setCountdown(count);
        playClick(600, 0.06);
      } else {
        if (countTimerRef.current) {
          clearInterval(countTimerRef.current);
          countTimerRef.current = null;
        }
        setPhase('calibrating');
        playClick(1200, 0.08);
        
        const startTime = ctx.currentTime + 0.5;
        const totalBeats = 8;
        const intervalSec = 0.5;

        const targets: number[] = [];
        for (let b = 0; b < totalBeats; b++) {
          targets.push(startTime + b * intervalSec);
        }
        beatTargetTimesRef.current = targets;

        let bIdx = 0;
        beatIntervalRef.current = setInterval(() => {
          bIdx++;
          if (bIdx < totalBeats) {
            setCurrentBeatIndex(bIdx);
            playClick(bIdx === totalBeats - 1 ? 1400 : 1000, 0.05);
          } else {
            if (beatIntervalRef.current) {
              clearInterval(beatIntervalRef.current);
              beatIntervalRef.current = null;
            }
            doneTimeoutRef.current = setTimeout(() => {
              setPhase('done');
              setTaps(recordedTaps => {
                if (recordedTaps.length === 0) return recordedTaps;
                const deltas = recordedTaps.map(t => t.deltaMs);
                const avg = Math.round(deltas.reduce((a, b) => a + b, 0) / deltas.length);
                setLiveOffset(avg);
                onCalibrated(avg);
                return recordedTaps;
              });
            }, 600);
          }
        }, 500);
      }
    }, 500);
  }, [playClick, onCalibrated, clearAllTimers]);

  useEffect(() => {
    if (phase !== 'calibrating') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      handleTap();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, handleTap]);

  const shownOffset = liveOffset !== null ? liveOffset : offsetMs;

  return (
    <div className="opt-calib">
      <div className="opt-calib-head">
        <span>Tap test</span>
        <span className="opt-readout">{shownOffset > 0 ? `+${shownOffset}` : shownOffset} ms</span>
      </div>

      {phase === 'idle' && (
        <div className="opt-calib-stage">
          <p className="opt-calib-copy">
            Tap any key, or this panel, on each of 8 beats. We'll measure your audio delay and set the offset for you.
          </p>
          <button type="button" onClick={startCalibration} className="opt-btn opt-btn--solid">
            Start tap test
          </button>
        </div>
      )}

      {phase === 'countdown' && (
        <div className="opt-calib-stage">
          <div className="opt-calib-count">{countdown}</div>
          <div className="opt-calib-copy">Get ready to tap…</div>
        </div>
      )}

      {phase === 'calibrating' && (
        <div onClick={handleTap} className="opt-calib-stage opt-calib-tapzone">
          <div className="opt-calib-beats">
            {[0, 1, 2, 3, 4, 5, 6, 7].map(idx => (
              <span
                key={idx}
                className={`opt-calib-beat${idx === currentBeatIndex ? ' is-now' : idx < currentBeatIndex ? ' is-past' : ''}`}
              />
            ))}
          </div>
          <div className="opt-calib-prompt">Tap on the beat · {taps.length} recorded</div>
          {taps.length > 0 && (
            <div className="opt-readout">
              Last tap {taps[taps.length - 1].deltaMs > 0 ? `+${taps[taps.length - 1].deltaMs}` : taps[taps.length - 1].deltaMs} ms
            </div>
          )}
        </div>
      )}

      {phase === 'done' && (
        <div className="opt-calib-stage">
          <div className="opt-calib-prompt">Calibrated</div>
          <div className="opt-readout opt-readout--ok">
            Offset {liveOffset !== null && liveOffset > 0 ? `+${liveOffset}` : liveOffset ?? 0} ms · {taps.length} valid taps
          </div>
          <button type="button" onClick={startCalibration} className="opt-btn opt-btn--ghost">
            Run again
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Modal Component ──
export default function OptionsModal({ isOpen, onClose }: OptionsModalProps) {
  const [, setLocation] = useLocation();
  const [opts, setOpts] = useState<GameOpts>(loadOpts());
  const [latencyMode, setLatencyMode] = useState<'auto' | 'manual'>('auto');
  const [activeTab, setActiveTab] = useState<OptionsTab>('gameplay');
  const [remappingLane, setRemappingLane] = useState<number | null>(null);
  const [remapSlot, setRemapSlot] = useState<'primary' | 'alt'>('primary');
  const [resetState, setResetState] = useState<"idle" | "confirm">("idle");
  const [gsStatus, setGsStatus] = useState<GameSenseStatus>("scanning");
  const resetTimer = useRef<NodeJS.Timeout | null>(null);
  const colorRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];
  const [hapticsTestActive, setHapticsTestActive] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  // Keep the active tab visible in the horizontally scrolling mobile nav
  useEffect(() => {
    if (!isOpen) return;
    const el = navRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeTab, isOpen]);

  // Sync state with useVaultStore
  const {
    tokenBalance,
    unlockedSkins,
    unlockSkin,
    echoPrestigeScore,
    prestigeScore,
    totalBurns,
    collection,
    streakCount,
    totalPulls,
    updateSettings,
    updateProgression,
    updateCheats,
    packDesignStyle,
    setPackDesignStyle,
    unlockedCheats,
  } = useVaultStore();

  const activePrestigeScore = prestigeScore ?? echoPrestigeScore ?? 0;
  const echoCardsCount = useMemo(() => (collection || []).filter(c => c.isEcho || (c.echoGeneration && c.echoGeneration > 0)).length, [collection]);
  const nextLockedBg = useMemo(() => GAME_BACKGROUNDS.find(bg => bg.unlockScore > activePrestigeScore && bg.unlockScore < 999999), [activePrestigeScore]);
  const prevUnlockScore = useMemo(() => {
    const unlockedList = GAME_BACKGROUNDS.filter(bg => bg.unlockScore <= activePrestigeScore);
    return unlockedList.length > 0 ? unlockedList[unlockedList.length - 1].unlockScore : 0;
  }, [activePrestigeScore]);
  const bgProgressPct = useMemo(() => {
    if (!nextLockedBg) return 100;
    const range = nextLockedBg.unlockScore - prevUnlockScore;
    if (range <= 0) return 100;
    return Math.min(100, Math.max(0, Math.round(((activePrestigeScore - prevUnlockScore) / range) * 100)));
  }, [activePrestigeScore, nextLockedBg, prevUnlockScore]);

  const [activeCardSkin, setActiveCardSkin] = useState('original');
  const [activeCardBack, setActiveCardBack] = useState('classic');
  const [hoveredFrontSkin, setHoveredFrontSkin] = useState<string | null>(null);
  const [hoveredBackSkin, setHoveredBackSkin] = useState<string | null>(null);
  const [previewCard, setPreviewCard] = useState<VaultCard>(SAMPLE_PREVIEW_CARD);

  const [povInputCode, setPovInputCode] = useState('');
  const [povInputError, setPovInputError] = useState<string | null>(null);
  const [povSuccess, setPovSuccess] = useState(false);

  const [masterInputCode, setMasterInputCode] = useState('');
  const [masterInputError, setMasterInputError] = useState<string | null>(null);
  const [masterSuccess, setMasterSuccess] = useState(false);

  const isPovUnlocked = Boolean(unlockedCheats?.povChanger) || (typeof localStorage !== 'undefined' && localStorage.getItem("opt_unlocked_pov") === "true");
  const isChartEditionsUnlocked = Boolean(unlockedCheats?.chartEditions) || (typeof localStorage !== 'undefined' && localStorage.getItem("opt_unlocked_chart_editions") === "true");

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
  }, [remappingLane, remapSlot]);

  // Save specific settings helper
  const toggleSetting = (k: ToggleKey) => {
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
    if (k === "haptics") {
      if (v) {
        setTimeout(() => haptics.mediumTap(), 50);
      } else {
        haptics.cancel();
      }
    }
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

  const setResolutionOption = (res: RenderResolution) => {
    localStorage.setItem("opt_renderResolution", res);
    setOpts(o => ({ ...o, renderResolution: res }));
    updateSettings({ renderResolution: res });
    logAnalyticsEvent('setting_change', { key: 'renderResolution', value: res });
    audioManager.playSfx('tap_nav', 0.12);
  };

  const setGfxLevelOption = (level: GfxLevel) => {
    localStorage.setItem("opt_gfxLevel", level);
    // Automatically configure sensible preset defaults when changing overall GFX quality
    let res: RenderResolution = opts.renderResolution;
    let particles: ParticleDensity = opts.particleDensity;
    let bloom = opts.bloomGlow;
    let bgAnim = opts.bgAnimation;
    let legacy = false;

    if (level === 'ultra') {
      res = 'native';
      particles = 'full';
      bloom = true;
      bgAnim = true;
      legacy = false;
    } else if (level === 'high') {
      res = 'high';
      particles = 'full';
      bloom = true;
      bgAnim = true;
      legacy = false;
    } else if (level === 'medium') {
      res = 'medium';
      particles = 'half';
      bloom = true;
      bgAnim = true;
      legacy = false;
    } else if (level === 'low') {
      res = 'low';
      particles = 'minimal';
      bloom = false;
      bgAnim = false;
      legacy = true;
    }

    localStorage.setItem("opt_renderResolution", res);
    localStorage.setItem("opt_particleDensity", particles);
    localStorage.setItem("opt_bloomGlow", String(bloom));
    localStorage.setItem("opt_bgAnimation", String(bgAnim));
    localStorage.setItem("opt_legacyGraphics", String(legacy));

    setOpts(o => ({
      ...o,
      gfxLevel: level,
      renderResolution: res,
      particleDensity: particles,
      bloomGlow: bloom,
      bgAnimation: bgAnim,
      legacyGraphics: legacy,
    }));

    updateSettings({
      gfxLevel: level,
      renderResolution: res,
      particleDensity: particles,
      bloomGlow: bloom,
      bgAnimation: bgAnim,
      legacyGraphics: legacy,
    });

    logAnalyticsEvent('setting_change', { key: 'gfxLevel', value: level });
    audioManager.playSfx('tap_nav', 0.15);
  };

  const setFpsTargetOption = (fps: FpsTarget) => {
    localStorage.setItem("opt_fpsTarget", fps);
    setOpts(o => ({ ...o, fpsTarget: fps }));
    updateSettings({ fpsTarget: fps });
    logAnalyticsEvent('setting_change', { key: 'fpsTarget', value: fps });
    audioManager.playSfx('tap_nav', 0.1);
  };

  const setParticleDensityOption = (density: ParticleDensity) => {
    localStorage.setItem("opt_particleDensity", density);
    setOpts(o => ({ ...o, particleDensity: density }));
    updateSettings({ particleDensity: density });
    logAnalyticsEvent('setting_change', { key: 'particleDensity', value: density });
    audioManager.playSfx('tap_nav', 0.1);
  };

  const renderToggle = (k: ToggleKey, label: string) => {
    const isNoclipLocked = k === "missSystem" && localStorage.getItem("opt_unlocked_noclip") !== "true";
    if (isNoclipLocked) {
      return <Switch checked={false} locked label={label} onToggle={() => audioManager.playSfx('locked_out', 0.15)} />;
    }
    return <Switch checked={!!opts[k]} label={label} onToggle={() => toggleSetting(k)} />;
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

  const saveLaneBindings = (laneKeys: [string, string, string], laneAltKeys: [string, string, string]) => {
    laneKeys.forEach((k, i) => localStorage.setItem(`opt_laneKey_${i}`, k));
    laneAltKeys.forEach((k, i) => localStorage.setItem(`opt_laneAltKey_${i}`, k));
    setOpts(o => ({ ...o, laneKeys, laneAltKeys }));
    updateSettings({ laneKeys, laneAltKeys });
  };

  // Binds `key` to the lane/slot being remapped. A key can only drive one lane:
  // a clash with another primary key swaps the two, a clash with an alternate clears it.
  const handleRemapKey = (key: string) => {
    if (remappingLane === null) return;
    const k = normalizeLaneKey(key);
    const nextKeys = [...opts.laneKeys] as [string, string, string];
    const nextAlt = [...opts.laneAltKeys] as [string, string, string];
    if (remapSlot === 'primary') {
      const clash = nextKeys.indexOf(k);
      if (clash >= 0 && clash !== remappingLane) nextKeys[clash] = nextKeys[remappingLane];
      nextKeys[remappingLane] = k;
    } else {
      if (nextKeys.includes(k)) {
        audioManager.playSfx('locked_out', 0.15);
        return;
      }
      nextAlt[remappingLane] = k;
    }
    nextAlt.forEach((ak, i) => {
      if (ak === k && !(remapSlot === 'alt' && i === remappingLane)) nextAlt[i] = "";
    });
    saveLaneBindings(nextKeys, nextAlt);
    setRemappingLane(null);
    logAnalyticsEvent('setting_change', { key: `${remapSlot === 'alt' ? 'laneAltKey' : 'laneKey'}_${remappingLane}`, value: k });
    audioManager.playSfx('menu_confirm', 0.15);
  };

  const clearAltKey = () => {
    if (remappingLane === null) return;
    const nextAlt = [...opts.laneAltKeys] as [string, string, string];
    nextAlt[remappingLane] = "";
    saveLaneBindings(opts.laneKeys, nextAlt);
    setRemappingLane(null);
    audioManager.playSfx('tap_nav', 0.12);
  };

  const setAltPreset = (preset: [string, string, string]) => {
    // Arrows already used as primary keys can't double up: give those lanes the first
    // free key, trying A/S/D before the rest of the keyboard, so no two lanes share one.
    const nextKeys = [...opts.laneKeys] as [string, string, string];
    const fallbacks = ["a", "s", "d", ...KEY_ROWS.flat()];
    nextKeys.forEach((k, i) => {
      if (!preset.includes(k)) return;
      nextKeys[i] = fallbacks.find(f => !preset.includes(f) && !nextKeys.includes(f)) ?? k;
    });
    saveLaneBindings(nextKeys, [...preset] as [string, string, string]);
    setRemappingLane(null);
    logAnalyticsEvent('setting_change', { key: 'laneAltKeys', value: preset.join(',') || 'none' });
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
        laneAltKeys: ["", "", ""],
        laneColors: ["#FF1493", "#00E5FF", "#39FF14"],
        noteTheme: "artwork",
        cardSkin: "original",
        cardBack: "classic",
        gameBackground: "cover_blur",
        gameTrack: "transparent",
        hudStyle: "stanza",
        backgroundBlur: 18,
        hudMisses: true,
        comboDisplay: true,
        judgmentText: true,
        trackLyrics: true,
        lyricsMode: defaultLyricsMode(),
        bgMusic: false,
        sfxEnabled: true,
        sfxVolume: 0.8,
        musicVolume: 0.5,
        haptics: true,
        missSystem: true,
        chartVariant: DEFAULT_CHART_VARIANT,
      });
      clearCatalogCache();
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

  const NOTE_THEME_PRESETS = [
    { id: 'artwork', name: 'Song Artwork', colors: ['#999999', '#999999', '#999999'] },
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
    { id: 'carbon', name: 'Carbon Tech', desc: 'Carbon fiber weave', style: { background: '#151619', border: '1.5px solid #00ffff', boxShadow: '0 0 8px #00ffff33' } },
    { id: 'gold_luxe', name: 'Royal Gold', desc: 'Gilded gold leaf frame & starry dust', style: { background: 'linear-gradient(135deg, #1f1a0f, #1c150c)', border: '1px solid #ffd700', boxShadow: '0 0 8px rgba(255,215,0,0.2)' } },
    { id: 'matrix', name: 'Matrix Code', desc: 'Binary rain & console grid lines', style: { background: '#030804', border: '1px solid #39ff14', boxShadow: '0 0 8px rgba(57,255,20,0.2)' } },
    { id: 'th3scr1b3', name: 'th3scr1b3 Signature', desc: 'Abstract red splatters & gothic marks', style: { background: 'radial-gradient(circle, #4a002a, #0d0006)', border: '1px dashed #ff007f' } },
  ];

  const currentTab = ALL_TABS.find(t => t.id === activeTab) ?? ALL_TABS[0];
  const currentTabIndex = ALL_TABS.indexOf(currentTab);
  const curChartVariant = resolveChartVariant(typeof localStorage !== 'undefined' ? localStorage.getItem('opt_chartVariant') : null, isChartEditionsUnlocked);
  const fmtMs = (v: number) => (v > 0 ? `+${v}` : `${v}`) + ' ms';

  const selectTab = (id: OptionsTab) => {
    audioManager.playSfx('tap_nav', 0.1);
    setActiveTab(id);
  };

  const renderSkinFooter = (isUnlocked: boolean, isSelected: boolean, cost: number, onUnlock: () => void, freeLabel = 'Owned') => (
    <div className="opt-tile-foot">
      {isUnlocked ? (
        isSelected ? (
          <span className="opt-status opt-status--on"><Check size={12} /> Equipped</span>
        ) : (
          <span className="opt-status">{freeLabel}</span>
        )
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onUnlock();
          }}
          className="opt-btn opt-btn--gold opt-btn--block"
        >
          Unlock · {cost} V⚡
        </button>
      )}
    </div>
  );

  return (
    <div className="opt-overlay" onClick={onClose}>
      <div
        className="opt-root"
        data-theme={isAvant ? 'avant' : 'classic'}
        role="dialog"
        aria-modal="true"
        aria-labelledby="opt-title"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <header className="opt-head">
          <div className="opt-head-id">
            <span className="opt-brand">PIM // th3v4ult</span>
            <h1 id="opt-title" className="opt-title">Settings</h1>
          </div>
          <div className="opt-head-actions">
            <span className="opt-chip" title="V-token balance">
              <VTokenCrestIcon size={13} color="#E5B800" />
              {tokenBalance} V⚡
            </span>
            <button type="button" onClick={onClose} className="opt-close" aria-label="Close settings">
              <kbd>ESC</kbd>
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="opt-body">
          {/* ── Navigation ── */}
          <nav ref={navRef} className="opt-nav" role="tablist" aria-label="Settings sections">
            {TAB_GROUPS.map((group, gi) => (
              <div key={group.id} className="opt-nav-group">
                <div className="opt-nav-group-label">
                  <span>0{gi + 1}</span> {group.label}
                </div>
                {group.tabs.map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    className="opt-nav-item"
                    onClick={() => selectTab(tab.id)}
                  >
                    <span className="opt-nav-icon">{tab.icon}</span>
                    <span className="opt-nav-text">
                      <span className="opt-nav-label">{tab.label}</span>
                      <span className="opt-nav-desc">{tab.desc}</span>
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </nav>

          {/* ── Content ── */}
          <main className="opt-content" key={activeTab} role="tabpanel" aria-label={currentTab.label}>
            <div className="opt-page-head">
              <span className="opt-eyebrow">{currentTab.group} / {String(currentTabIndex + 1).padStart(2, '0')}</span>
              <h2 className="opt-page-title">{currentTab.label}</h2>
              <p className="opt-page-blurb">{currentTab.blurb}</p>
            </div>

            {/* ════ GAMEPLAY ════ */}
            {activeTab === 'gameplay' && (
              <div className="opt-stack">
                <Panel title="HUD style" hint="How score, combo and shield are shown in a song">
                  <div className="opt-seg opt-seg--3">
                    {([
                      { id: 'stanza', label: 'Poetic GUI', sub: 'The lyric inks as you play' },
                      { id: 'console', label: 'Console Rail', sub: 'Score and shield panels' },
                      { id: 'beta', label: 'Beta', sub: 'The original dials' },
                    ] as const).map(style => (
                      <SegButton
                        key={style.id}
                        active={opts.hudStyle === style.id}
                        label={style.label}
                        sub={style.sub}
                        onClick={() => {
                          localStorage.setItem("opt_hudStyle", style.id);
                          setOpts(o => ({ ...o, hudStyle: style.id }));
                          updateSettings({ hudStyle: style.id });
                        }}
                      />
                    ))}
                  </div>
                </Panel>

                <Panel title="Lyrics" hint="How the words show during a song">
                  <div className="opt-seg opt-seg--3">
                    {([
                      { id: 'off', label: 'Off', sub: 'No lyrics' },
                      { id: 'track', label: 'Track lyrics', sub: 'Painted on the track' },
                      { id: 'poetic', label: 'Poetic Lines', sub: 'Kinetic lyrics across the sky' },
                    ] as const).map(mode => (
                      <SegButton
                        key={mode.id}
                        active={opts.hudStyle !== 'stanza' && opts.lyricsMode === mode.id}
                        locked={opts.hudStyle === 'stanza'}
                        label={mode.label}
                        sub={mode.sub}
                        onClick={() => {
                          if (opts.hudStyle === 'stanza') return;
                          localStorage.setItem("opt_lyricsMode", mode.id);
                          setOpts(o => ({ ...o, lyricsMode: mode.id }));
                          updateSettings({ lyricsMode: mode.id });
                        }}
                      />
                    ))}
                  </div>
                  <p className="opt-note">
                    {opts.hudStyle === 'stanza'
                      ? 'Poetic GUI shows the lyric line itself, so these modes are off while it is selected.'
                      : 'Phones default to Track lyrics; desktop and tablet default to Poetic Lines.'}
                  </p>
                </Panel>

                <Panel title="HUD & scoring">
                  <SettingRow label="Miss system" desc="Misses mute the lane and reset your multiplier.">
                    {renderToggle('missSystem', 'Miss system')}
                  </SettingRow>
                  <SettingRow label="Miss counter" desc="Shows your miss count in the top bar.">
                    {renderToggle('hudMisses', 'Miss counter')}
                  </SettingRow>
                  <SettingRow label="Healing hold meter" tag="108–162 Hz" desc="Holding long notes refills lost misses.">
                    {renderToggle('healingGauge', 'Healing hold meter')}
                  </SettingRow>
                  <SettingRow label="Combo streak" desc="Combo count in the middle of the screen.">
                    {renderToggle('comboDisplay', 'Combo streak')}
                  </SettingRow>
                  <SettingRow label="Judgment text" desc="Shows PERFECT, GOOD or MISS on each hit.">
                    {renderToggle('judgmentText', 'Judgment text')}
                  </SettingRow>
                </Panel>

                <Panel title="Chart generation" hint="How notes are placed">
                  <div className="opt-seg opt-seg--3">
                    {([
                      { id: 'auto', label: 'Autopilot', sub: 'Audio frequencies + beat grid' },
                      { id: 'lyrics', label: 'Lyrical', sub: 'Follows the vocal phrasing' },
                      { id: 'bpm', label: 'BPM beats', sub: 'Locked to the metronome' },
                    ] as const).map(mode => {
                      const isLocked = (mode.id === 'lyrics' || mode.id === 'bpm') && localStorage.getItem("opt_unlocked_iddqd") !== "true";
                      return (
                        <SegButton
                          key={mode.id}
                          active={!isLocked && opts.noteGenerationSource === mode.id}
                          locked={isLocked}
                          label={mode.label}
                          sub={isLocked ? 'Locked' : mode.sub}
                          onClick={() => {
                            if (isLocked) {
                              audioManager.playSfx('locked_out', 0.15);
                              return;
                            }
                            localStorage.setItem("opt_noteGenerationSource", mode.id);
                            setOpts(o => ({ ...o, noteGenerationSource: mode.id }));
                            updateProgression({ noteGenerationSource: mode.id });
                            clearCatalogCache();
                            logAnalyticsEvent('setting_change', { key: 'noteGenerationSource', value: mode.id });
                            audioManager.playSfx('tap_nav', 0.1);
                          }}
                        />
                      );
                    })}
                  </div>
                </Panel>

                <Panel
                  title="Chart edition"
                  hint={isChartEditionsUnlocked ? <span className="opt-ok">All editions unlocked</span> : '4 editions locked'}
                >
                  {!isChartEditionsUnlocked && (
                    <CodeUnlock
                      title="Classified master editions"
                      body="V5 Flagship, Neural AI, V3 Master and V2 Minimal are locked. The decrypt code is out there…"
                      value={masterInputCode}
                      error={masterInputError}
                      placeholder="ENTER CODE (MASTERREDEEM)"
                      onChange={(v) => {
                        setMasterInputCode(v);
                        setMasterInputError(null);
                      }}
                      onSubmit={async () => {
                        const code = masterInputCode.trim().toUpperCase();
                        if (code === 'MASTERREDEEM' || code === 'CHARTREDEEM' || code === 'EDITIONREDEEM') {
                          localStorage.setItem("opt_unlocked_chart_editions", "true");
                          await updateCheats({ chartEditions: true });
                          window.dispatchEvent(new Event('cheat_code_activated'));
                          audioManager.playSfx('platinum_get', 0.8);
                          setMasterInputError(null);
                          setMasterSuccess(true);
                          setMasterInputCode('');
                        } else {
                          setMasterInputError("INVALID ACCESS CODE — USE \"MASTERREDEEM\"");
                          audioManager.playSfx('locked_out', 0.2);
                        }
                      }}
                    />
                  )}

                  <div className="opt-seg opt-seg--3">
                    {[
                      { id: 'v6_master', label: 'V6 Chart Master', desc: 'Audio-synced beats & drops (default)', locked: false },
                      { id: 'v1_gimmicks', label: 'V1 Classic', desc: 'Mines, stems & drops', locked: false },
                      { id: 'v5_flagship', label: 'V5 Flagship', desc: 'Two-thumb kinesthetics & motifs', locked: !isChartEditionsUnlocked },
                      { id: 'v4_neural', label: 'Neural AI', desc: 'Seq2seq transformer charts', locked: !isChartEditionsUnlocked },
                      { id: 'v3_master', label: 'V3 Master', desc: '8-way swipes & overdrive', locked: !isChartEditionsUnlocked },
                      { id: 'v2_minimal', label: 'V2 Minimal', desc: 'Casual tap flow', locked: !isChartEditionsUnlocked },
                    ].map(edition => (
                      <SegButton
                        key={edition.id}
                        active={!edition.locked && curChartVariant === edition.id}
                        locked={edition.locked}
                        label={edition.label}
                        sub={edition.locked ? 'Code required' : edition.desc}
                        onClick={() => {
                          if (edition.locked) {
                            audioManager.playSfx('locked_out', 0.15);
                            return;
                          }
                          localStorage.setItem("opt_chartVariant", edition.id);
                          localStorage.setItem(CHART_VARIANT_CHOSEN_KEY, "1");
                          clearCatalogCache();
                          setOpts(o => ({ ...o, chartVariant: edition.id as any }));
                          logAnalyticsEvent('setting_change', { key: 'chartVariant', value: edition.id });
                          audioManager.playSfx('tap_nav', 0.1);
                        }}
                      />
                    ))}
                  </div>
                </Panel>
              </div>
            )}

            {/* ════ AUDIO & HAPTICS ════ */}
            {activeTab === 'audio' && (
              <div className="opt-stack">
                <Panel title="Sound">
                  <SettingRow label="Sound effects" desc="Menu clicks and hit sounds.">
                    {renderToggle('sfxEnabled', 'Sound effects')}
                  </SettingRow>
                  {opts.sfxEnabled && (
                    <SvgVolumeSlider
                      label="SFX volume"
                      value={opts.sfxVolume}
                      onChange={(v) => {
                        localStorage.setItem("opt_sfxVolume", String(v));
                        setOpts(o => ({ ...o, sfxVolume: v }));
                        updateSettings({ sfxVolume: v });
                        audioManager.playSfx('tap_nav', 0.1);
                      }}
                      isAvant={isAvant}
                    />
                  )}
                  <SettingRow label="Ambient menu music" desc="Tape hiss and radio hum in the vault menus.">
                    {renderToggle('bgMusic', 'Ambient menu music')}
                  </SettingRow>
                  {opts.bgMusic && (
                    <SvgVolumeSlider
                      label="Music volume"
                      value={opts.musicVolume}
                      onChange={(v) => {
                        localStorage.setItem("opt_musicVolume", String(v));
                        setOpts(o => ({ ...o, musicVolume: v }));
                        updateSettings({ musicVolume: v });
                        window.dispatchEvent(new Event("bgmusic_volume_change"));
                      }}
                      isAvant={isAvant}
                    />
                  )}
                  <SettingRow label="Use local audio files" desc="Play downloaded files instead of streaming.">
                    {renderToggle('useLocalFiles', 'Use local audio files')}
                  </SettingRow>
                </Panel>

                <Panel title="Devices">
                  <SettingRow
                    label="Haptic vibration"
                    tag={haptics.getCapabilities().primaryDriver}
                    desc="Vibrate on hits — phone, gamepad or supported devices."
                  >
                    <button
                      type="button"
                      onClick={() => {
                        haptics.mediumTap();
                        setHapticsTestActive(true);
                        setTimeout(() => setHapticsTestActive(false), 800);
                      }}
                      className={`opt-btn opt-btn--ghost opt-btn--sm${hapticsTestActive ? ' is-ok' : ''}`}
                      title="Test vibration"
                    >
                      {hapticsTestActive ? 'Pulsed' : 'Test'}
                    </button>
                    {renderToggle('haptics', 'Haptic vibration')}
                  </SettingRow>
                  <SettingRow
                    label="SteelSeries GameSense"
                    tag={<span className={`opt-gs opt-gs--${gsStatus}`}>{gsStatus}</span>}
                    desc="Sync keyboard and mouse LEDs with the music."
                  >
                    {renderToggle('gameSenseEnabled', 'SteelSeries GameSense')}
                  </SettingRow>
                </Panel>
              </div>
            )}

            {/* ════ CONTROLS & SYNC ════ */}
            {activeTab === 'controls' && (
              <div className="opt-stack">
                <Panel title="Lane keys" hint={remappingLane !== null ? 'Press a key · ESC to cancel' : 'Click a lane to rebind'}>
                  {(['primary', 'alt'] as const).map(slot => (
                    <div key={slot} className="opt-keyset">
                      <span className="opt-keyset-title">{slot === 'primary' ? 'Main keys' : 'Alternate keys'}</span>
                      <div className="opt-keys">
                        {([0, 1, 2] as const).map(lane => {
                          const listening = remappingLane === lane && remapSlot === slot;
                          const bound = slot === 'primary' ? opts.laneKeys[lane] : opts.laneAltKeys[lane];
                          return (
                            <button
                              key={lane}
                              type="button"
                              aria-pressed={listening}
                              className={`opt-key${listening ? ' is-listening' : ''}`}
                              style={{ '--lane': opts.laneColors[lane] } as CSSProperties}
                              onClick={() => {
                                audioManager.playSfx('tap_nav', 0.12);
                                setRemapSlot(slot);
                                setRemappingLane(listening ? null : lane);
                              }}
                            >
                              <span className="opt-key-lane">{["Left", "Middle", "Right"][lane]} lane</span>
                              <span className="opt-key-cap">{listening ? "…" : keyLabel(bound)}</span>
                              <span className="opt-key-hint">{listening ? "Press a key" : bound ? "Rebind" : "Bind"}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  <div className="opt-keyset-actions">
                    <button type="button" className="opt-btn opt-btn--ghost opt-btn--sm" onClick={() => setAltPreset(ARROW_LANE_KEYS)}>
                      Use arrow keys ← ↓ →
                    </button>
                    {opts.laneAltKeys.some(Boolean) && (
                      <button type="button" className="opt-btn opt-btn--ghost opt-btn--sm" onClick={() => setAltPreset(["", "", ""])}>
                        Clear alternates
                      </button>
                    )}
                  </div>

                  {remappingLane !== null && (
                    <div className="opt-keyboard">
                      <span className="opt-keyboard-title">
                        Press any key, or pick one below, for the {["left", "middle", "right"][remappingLane]} lane{remapSlot === 'alt' ? ' (alternate)' : ''}
                      </span>
                      {KEY_ROWS.map((row, rowIdx) => (
                        <div key={rowIdx} className="opt-keyboard-row">
                          {row.map(k => (
                            <button key={k} type="button" onClick={() => handleRemapKey(k)} className="opt-keyboard-key">
                              {keyLabel(k)}
                            </button>
                          ))}
                        </div>
                      ))}
                      {remapSlot === 'alt' && opts.laneAltKeys[remappingLane] && (
                        <button type="button" onClick={clearAltKey} className="opt-btn opt-btn--ghost opt-btn--sm">
                          Unbind alternate
                        </button>
                      )}
                    </div>
                  )}
                </Panel>

                <Panel title="Audio sync" hint={<span className="opt-readout">Offset {fmtMs(opts.audioOffset)}</span>}>
                  <div className="opt-seg opt-seg--2">
                    <SegButton active={latencyMode === 'auto'} label="Tap test" sub="Recommended · 10 seconds" onClick={() => setLatencyMode('auto')} />
                    <SegButton active={latencyMode === 'manual'} label="Manual" sub="Drag the offset yourself" onClick={() => setLatencyMode('manual')} />
                  </div>

                  <BeatVisualizer offsetMs={opts.audioOffset} isAvant={isAvant} />

                  {latencyMode === 'auto' ? (
                    <AutoLatencyCalibrator
                      offsetMs={opts.audioOffset}
                      isAvant={isAvant}
                      onCalibrated={newOffset => {
                        localStorage.setItem("opt_audioOffset", String(newOffset));
                        setOpts(o => ({ ...o, audioOffset: newOffset }));
                        updateSettings({ audioOffset: newOffset });
                      }}
                    />
                  ) : (
                    <>
                      <SvgLatencySlider
                        value={opts.audioOffset}
                        onChange={v => {
                          localStorage.setItem("opt_audioOffset", String(v));
                          setOpts(o => ({ ...o, audioOffset: v }));
                          updateSettings({ audioOffset: v });
                        }}
                        isAvant={isAvant}
                      />
                      <p className="opt-note">
                        Drag left if notes pass before the beat sounds. Drag right if the beat sounds before notes reach the hit line.
                      </p>
                    </>
                  )}

                  <SettingRow label="In-game auto-sync" desc="Fine-tunes your offset during play based on your hits.">
                    <Switch
                      checked={!!opts.autoLatencyAdjust}
                      label="In-game auto-sync"
                      onToggle={() => {
                        const next = !opts.autoLatencyAdjust;
                        localStorage.setItem("opt_autoLatencyAdjust", String(next));
                        setOpts(o => ({ ...o, autoLatencyAdjust: next }));
                        updateSettings({ autoLatencyAdjust: next });
                        audioManager.playSfx('tap_nav', 0.1);
                      }}
                    />
                  </SettingRow>
                </Panel>

                <Panel title="Note types" hint="Quick reference">
                  <dl className="opt-guide">
                    {[
                      { color: '#39FF14', icon: <span>■</span>, name: 'Taps', text: 'Press the lane key, a controller face button, or tap the screen as the note hits the line.' },
                      { color: '#FFD700', icon: <span>▬</span>, name: 'Hold rails', text: 'Hold the key or button until the gold tail crosses the hit line.' },
                      { color: '#FF1493', icon: <span>➔</span>, name: 'Swipes', text: 'Flick the stick, press an arrow / D-pad, or swipe in the arrow direction.' },
                      { color: '#00FF88', icon: <span>▲</span>, name: 'Lift flicks', text: 'Release a hold with Arrow Up, flick the stick up, or swipe upward.' },
                      { color: '#FF7B00', icon: <VTokenCrestIcon size={14} color="#FF7B00" />, name: 'Break drops', text: 'Big bonus notes on the drop. Hit them clean for extra score.' },
                      { color: '#CCFF00', icon: <StageCrestIcon size={14} color="#CCFF00" />, name: 'Accent stars', text: 'Snare and accent notes. Hit them on beat for a multiplier.' },
                      { color: '#00F5D4', icon: <RemixDialIcon size={14} color="#00F5D4" />, name: 'Remix stems', text: 'Remix the song live: solo the vocals, drop the drums or push the bass.' },
                      { color: '#FF003C', icon: <HazardWarningIcon size={14} color="#FF003C" />, name: 'Mines', text: "Don't hit these. A mine costs 500 points and breaks your combo." },
                    ].map(n => (
                      <div key={n.name} className="opt-guide-row">
                        <dt style={{ color: n.color }}>{n.icon} {n.name}</dt>
                        <dd>{n.text}</dd>
                      </div>
                    ))}
                  </dl>
                </Panel>
              </div>
            )}

            {/* ════ GRAPHICS ════ */}
            {activeTab === 'graphics' && (
              <div className="opt-stack">
                <Panel
                  title="Quality preset"
                  hint={<span className="opt-readout">{getEffectiveDpr(opts.renderResolution).toFixed(2)}× DPR</span>}
                >
                  <p className="opt-note">Sets resolution, glow and particles in one go. Fine-tune below.</p>
                  <div className="opt-seg opt-seg--4">
                    {[
                      { id: 'ultra', label: 'Ultra', desc: 'Native retina · max FX', icon: <Sparkles size={13} /> },
                      { id: 'high', label: 'High', desc: '1080p · standard glow', icon: <Zap size={13} /> },
                      { id: 'medium', label: 'Balanced', desc: '720p · 50% particles', icon: <Layers size={13} /> },
                      { id: 'low', label: 'Performance', desc: '540p · max framerate', icon: <Cpu size={13} /> },
                    ].map(preset => (
                      <SegButton
                        key={preset.id}
                        active={opts.gfxLevel === preset.id}
                        label={preset.label}
                        sub={preset.desc}
                        icon={preset.icon}
                        onClick={() => setGfxLevelOption(preset.id as GfxLevel)}
                      />
                    ))}
                  </div>
                </Panel>

                <Panel title="Render resolution" hint="Lower it for smoother play on slow devices">
                  <div className="opt-seg opt-seg--4">
                    {[
                      { id: 'native', label: 'Native', sub: 'Retina · max DPR' },
                      { id: 'high', label: '1080p', sub: '1.50× scale' },
                      { id: 'medium', label: '720p', sub: '1.00× scale' },
                      { id: 'low', label: '540p', sub: '0.67× scale' },
                    ].map(res => (
                      <SegButton
                        key={res.id}
                        active={opts.renderResolution === res.id}
                        label={res.label}
                        sub={res.sub}
                        onClick={() => setResolutionOption(res.id as RenderResolution)}
                      />
                    ))}
                  </div>
                </Panel>

                <Panel title="Frame rate" hint="Lower it to save battery">
                  <div className="opt-seg opt-seg--4">
                    {[
                      { id: 'auto', label: 'Auto', sub: 'Match display' },
                      { id: '120', label: '120 FPS', sub: 'High refresh' },
                      { id: '60', label: '60 FPS', sub: 'Standard' },
                      { id: '30', label: '30 FPS', sub: 'Battery saver' },
                    ].map(fps => (
                      <SegButton
                        key={fps.id}
                        active={opts.fpsTarget === fps.id}
                        label={fps.label}
                        sub={fps.sub}
                        onClick={() => setFpsTargetOption(fps.id as FpsTarget)}
                      />
                    ))}
                  </div>
                </Panel>

                <Panel title="Effects">
                  <SettingRow label="Neon bloom & glow" desc="Glow around notes and lanes.">
                    {renderToggle('bloomGlow', 'Neon bloom & glow')}
                  </SettingRow>
                  <SettingRow label="Background animation" desc="Backdrops that move with the music.">
                    {renderToggle('bgAnimation', 'Background animation')}
                  </SettingRow>
                  <SettingRow label="Particle density" desc="Sparks and trails on hits.">
                    <div className="opt-mini-seg" role="group" aria-label="Particle density">
                      {(['full', 'half', 'minimal'] as const).map(d => (
                        <button
                          key={d}
                          type="button"
                          aria-pressed={opts.particleDensity === d}
                          onClick={() => setParticleDensityOption(d)}
                        >
                          {d === 'full' ? '100%' : d === 'half' ? '50%' : '25%'}
                        </button>
                      ))}
                    </div>
                  </SettingRow>
                  <SettingRow label="Legacy graphics" desc="Flat visuals for older devices.">
                    {renderToggle('legacyGraphics', 'Legacy graphics')}
                  </SettingRow>
                </Panel>
              </div>
            )}

            {/* ════ NOTE COLORS ════ */}
            {activeTab === 'themes' && (
              <div className="opt-stack">
                <Panel title="Palettes">
                  <div className="opt-grid opt-grid--4">
                    {NOTE_THEME_PRESETS.map(t => (
                      <button
                        key={t.id}
                        type="button"
                        aria-pressed={opts.noteTheme === t.id}
                        className="opt-tile opt-tile--compact"
                        onClick={() => setNoteThemePreset(t.id, t.colors)}
                      >
                        <span className="opt-tile-title">{t.name}</span>
                        <span className="opt-swatches">
                          {t.id === 'artwork' ? (
                            <span className="opt-swatch opt-swatch--wide" style={{ background: 'linear-gradient(90deg, #ff007f, #00f0ff, #39ff14)' }} />
                          ) : (
                            t.colors.map((c, i) => <span key={i} className="opt-swatch" style={{ background: c }} />)
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                </Panel>

                <Panel title="Custom lane colors" hint="Changing a lane switches to a custom palette">
                  <div className="opt-lanes">
                    {([0, 1, 2] as const).map(lane => {
                      const lc = opts.laneColors[lane];
                      return (
                        <div key={lane} className="opt-lane">
                          <span className="opt-lane-name">{["Left", "Middle", "Right"][lane]} lane</span>
                          <span className="opt-lane-bar" style={{ background: lc, boxShadow: `0 0 12px ${lc}` }} />
                          <div className="opt-lane-swatches">
                            {COLOR_PRESETS[lane].map(c => (
                              <button
                                key={c}
                                type="button"
                                aria-label={`Set ${["left", "middle", "right"][lane]} lane to ${c}`}
                                aria-pressed={opts.laneColors[lane] === c}
                                onClick={() => setLaneColor(lane, c)}
                                className="opt-lane-swatch"
                                style={{ background: c }}
                              />
                            ))}
                          </div>
                          <label className="opt-lane-custom">
                            <span className="opt-lane-custom-chip" style={{ background: lc }}>
                              <input
                                ref={colorRefs[lane]}
                                type="color"
                                value={lc}
                                onChange={e => setLaneColor(lane, e.target.value)}
                              />
                            </span>
                            <span>Custom · {lc.toUpperCase()}</span>
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </Panel>
              </div>
            )}

            {/* ════ STAGE & CAMERA ════ */}
            {activeTab === 'backgrounds' && (
              <div className="opt-stack">
                <section className="opt-prestige">
                  <div className="opt-prestige-top">
                    <div>
                      <span className="opt-eyebrow">Vault prestige</span>
                      <div className="opt-prestige-score">
                        {activePrestigeScore.toLocaleString()} <small>pts</small>
                      </div>
                    </div>
                    <div className="opt-prestige-stats">
                      <span className="opt-stat"><Flame size={12} /> Streak <strong>{streakCount || 0}d</strong></span>
                      <span className="opt-stat">Pulls <strong>{totalPulls || 0}</strong></span>
                      <span className="opt-stat">Burns <strong>{totalBurns || 0}</strong> <em>+{((totalBurns || 0) * 150).toLocaleString()}</em></span>
                      <span className="opt-stat">Echo cards <strong>{echoCardsCount}</strong> <em>+{(echoCardsCount * 400).toLocaleString()}</em></span>
                    </div>
                  </div>
                  <div className="opt-progress-label">
                    <span>
                      {nextLockedBg ? (
                        <>Next unlock: <strong>{nextLockedBg.name}</strong> at {nextLockedBg.unlockScore.toLocaleString()} pts</>
                      ) : (
                        <strong className="opt-ok">Every backdrop unlocked</strong>
                      )}
                    </span>
                    <span className="opt-readout">{bgProgressPct}%</span>
                  </div>
                  <div className="opt-progress"><span style={{ width: `${bgProgressPct}%` }} /></div>
                </section>

                <Panel title="Backdrop">
                  <SvgBlurSlider
                    value={opts.backgroundBlur}
                    onChange={(v) => {
                      localStorage.setItem("opt_backgroundBlur", String(v));
                      setOpts(o => ({ ...o, backgroundBlur: v }));
                      updateSettings({ backgroundBlur: v });
                    }}
                    isAvant={isAvant}
                  />
                  <div className="opt-grid opt-grid--3">
                    {GAME_BACKGROUNDS.map(bg => {
                      const canUnlock = activePrestigeScore >= bg.unlockScore;
                      return (
                        <button
                          key={bg.id}
                          type="button"
                          disabled={!canUnlock}
                          aria-pressed={opts.gameBackground === bg.id}
                          className="opt-tile"
                          onClick={() => {
                            localStorage.setItem("opt_gameBackground", bg.id);
                            setOpts(o => ({ ...o, gameBackground: bg.id }));
                            updateSettings({ gameBackground: bg.id });
                            window.dispatchEvent(new Event("bgmusic_toggle"));
                            audioManager.playSfx('menu_confirm', 0.1);
                          }}
                        >
                          <span className="opt-tile-top">
                            <span className="opt-tile-title">{bg.name}</span>
                            {!canUnlock && <Lock size={12} className="opt-gold" />}
                          </span>
                          <span className="opt-tile-desc">{bg.desc}</span>
                          <span className={`opt-tile-meta${canUnlock ? '' : ' is-locked'}`}>{bg.unlockText}</span>
                        </button>
                      );
                    })}
                  </div>
                </Panel>

                <Panel title="Track style">
                  <div className="opt-grid opt-grid--2">
                    {GAME_TRACKS.map(track => {
                      const canUnlock = activePrestigeScore >= track.unlockScore;
                      return (
                        <button
                          key={track.id}
                          type="button"
                          disabled={!canUnlock}
                          aria-pressed={opts.gameTrack === track.id}
                          className="opt-tile"
                          onClick={() => {
                            localStorage.setItem("opt_gameTrack", track.id);
                            setOpts(o => ({ ...o, gameTrack: track.id }));
                            updateSettings({ gameTrack: track.id });
                            audioManager.playSfx('menu_confirm', 0.1);
                          }}
                        >
                          <span className="opt-tile-top">
                            <span className="opt-tile-title">{track.name}</span>
                            {!canUnlock && <Lock size={12} className="opt-gold" />}
                          </span>
                          <span className="opt-tile-desc">{track.desc}</span>
                          <span className={`opt-tile-meta${canUnlock ? '' : ' is-locked'}`}>{track.unlockText}</span>
                          {track.id === 'slideshow' && (
                            <span
                              role="link"
                              tabIndex={0}
                              onClick={(e) => {
                                e.stopPropagation();
                                audioManager.playSfx('menu_confirm', 0.15);
                                onClose();
                                setLocation('/slideshow');
                              }}
                              className="opt-tile-link"
                            >
                              Configure →
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </Panel>

                <Panel
                  title="Camera POV"
                  hint={isPovUnlocked ? <span>Hotkey <kbd className="opt-kbd">V</kbd> / <kbd className="opt-kbd">P</kbd> in game</span> : 'Code required'}
                >
                  {!isPovUnlocked ? (
                    <CodeUnlock
                      title="Classified perspective engine"
                      body="3D Cyber Tunnel, Corkscrew, Wave Coaster, Split Matrix and live stage POV shifts are locked. The decrypt code is out there…"
                      value={povInputCode}
                      error={povInputError}
                      placeholder="ENTER CODE (POVREDEEM)"
                      onChange={(v) => {
                        setPovInputCode(v);
                        setPovInputError(null);
                      }}
                      onSubmit={async () => {
                        const code = povInputCode.trim();
                        if (code.toUpperCase() === 'POVREDEEM') {
                          localStorage.setItem("opt_unlocked_pov", "true");
                          await updateCheats({ povChanger: true });
                          window.dispatchEvent(new Event('cheat_code_activated'));
                          audioManager.playSfx('platinum_get', 0.8);
                          setPovInputError(null);
                          setPovSuccess(true);
                          setPovInputCode('');
                        } else {
                          setPovInputError("INVALID ACCESS CODE — USE \"POVREDEEM\"");
                          audioManager.playSfx('locked_out', 0.2);
                        }
                      }}
                    />
                  ) : (
                    <>
                      <div className="opt-grid opt-grid--3 opt-grid--scroll">
                        {[
                          { id: 'classic', name: '2.5D Classic', desc: 'Standard Beatstar highway perspective', icon: '📐', tag: 'CORE' },
                          { id: 'flat_2d', name: 'Orthographic 2D', desc: 'Equal-width top-down piano roll highway', icon: '🎹', tag: '2D' },
                          { id: 'horizontal_drift', name: 'Side-Scroller', desc: '90° horizontal side-scrolling precision highway', icon: '⏩', tag: 'RETRO' },
                          { id: 'dynamic_stage', name: 'Dynamic Stage', desc: 'Beatsync camera director & stage shifts', icon: '🎥', tag: 'DIRECTOR' },
                          { id: 'cyber_tunnel', name: '3D Cyber Tunnel', desc: 'First-person tunnel vortex with concentric rings', icon: '🌀', tag: 'VORTEX' },
                          { id: 'corkscrew', name: '3D Corkscrew', desc: 'Helical spiral loop slide with 52% precision runway', icon: '🌪️', tag: 'HELIX' },
                          { id: 'rollercoaster', name: 'Wave Coaster', desc: 'Undulating 3D wave coaster with gravity plunge', icon: '🎢', tag: 'GRAVITY' },
                          { id: 'matrix_split', name: 'Split Matrix', desc: 'Detached 3-ribbon split horizon highway matrix', icon: '🔀', tag: 'POLY' },
                          { id: 'cockpit_hud', name: 'Starfighter Cockpit', desc: 'Curved canopy HUD around the highway', icon: '🏎️', tag: 'HUD' },
                          { id: 'hyper_prism', name: 'Prismatic Prism', desc: 'Refracted gemstone prism with faceted mirrors', icon: '🪞', tag: 'REFRACT' },
                          { id: 'dna_helix', name: 'DNA Double-Helix', desc: 'Intertwined quantum ribbon strands with base rungs', icon: '🧬', tag: 'QUANTUM' },
                          { id: 'vertigo_drop', name: 'Skyscraper Vertigo', desc: '90° vertical terminal velocity skyscraper plunge', icon: '🏙️', tag: 'FREEFALL' },
                          { id: 'singularity_void', name: 'Singularity Void', desc: 'Gravitational lensing curvature & accretion disk', icon: '🪐', tag: 'BLACK HOLE' },
                          { id: 'ground_zero', name: 'Ground Zero Bumper', desc: 'Ultra-low asphalt bumper camera with reflections', icon: '🚗', tag: 'LOW-RIDER' },
                          { id: 'orbital_halo', name: 'Stargate Halo', desc: 'Overhead celestial halo arc descending into hit zone', icon: '🌌', tag: 'HALO' },
                          { id: 'mobius_loop', name: 'Möbius Infinity', desc: 'Non-Euclidean topological figure-8 twist highway', icon: '♾️', tag: 'TOPOLOGY' },
                          { id: 'canyon_run', name: 'Canyon Run', desc: 'Desert road sweeping through red-rock S-bends at dusk', icon: '🏜️', tag: 'ROAD TRIP' },
                          { id: 'aurora_bridge', name: 'Aurora Bridge', desc: 'Arched glass bridge over a frozen fjord under the northern lights', icon: '🌉', tag: 'NORTHERN' },
                        ].map(pov => (
                          <button
                            key={pov.id}
                            type="button"
                            aria-pressed={(opts.povMode || 'classic') === pov.id}
                            className="opt-tile"
                            onClick={() => {
                              localStorage.setItem("opt_povMode", pov.id);
                              setOpts(o => ({ ...o, povMode: pov.id as any }));
                              updateSettings({ povMode: pov.id as any });
                              audioManager.playSfx('menu_confirm', 0.1);
                            }}
                          >
                            <span className="opt-tile-top">
                              <span className="opt-tile-title">{pov.name}</span>
                              <span aria-hidden="true">{pov.icon}</span>
                            </span>
                            <span className="opt-tile-desc">{pov.desc}</span>
                            <span className="opt-tile-meta">{pov.tag}</span>
                          </button>
                        ))}
                      </div>

                      <SettingRow label="Dynamic stage transitions" tag="Auto-warp" desc="Camera shifts into tunnel views as the song gets harder.">
                        <Switch
                          checked={opts.stagePovSwitch !== false}
                          label="Dynamic stage transitions"
                          onToggle={() => {
                            const nextVal = !(opts.stagePovSwitch !== false);
                            localStorage.setItem("opt_stagePovSwitch", String(nextVal));
                            setOpts(o => ({ ...o, stagePovSwitch: nextVal }));
                            updateSettings({ stagePovSwitch: nextVal });
                            audioManager.playSfx('menu_confirm', 0.1);
                          }}
                        />
                      </SettingRow>
                    </>
                  )}
                </Panel>
              </div>
            )}

            {/* ════ CARD FRONTS ════ */}
            {activeTab === 'fronts' && (
              <div className="opt-split">
                <aside className="opt-preview">
                  <span className="opt-eyebrow">Live preview</span>
                  <CardSkinContext.Provider value={{ staticFace: 'front', backSkin: activeCardBack }}>
                    <div className="opt-preview-card">
                      {(() => {
                        const SkinComp = getSkinComponent(hoveredFrontSkin || activeCardSkin);
                        return <SkinComp card={previewCard} />;
                      })()}
                    </div>
                  </CardSkinContext.Provider>
                  <div className="opt-preview-caption">
                    <strong>{FRONT_SKINS.find(s => s.id === (hoveredFrontSkin || activeCardSkin))?.name}</strong>
                    <span>{hoveredFrontSkin ? 'Previewing' : 'Equipped'}</span>
                  </div>
                </aside>

                <div className="opt-grid opt-grid--2">
                  {FRONT_SKINS.map(skin => {
                    const isUnlocked = skin.cost === 0 || unlockedSkins.includes(skin.id);
                    const isSelected = activeCardSkin === skin.id;
                    return (
                      <div
                        key={skin.id}
                        role="button"
                        tabIndex={isUnlocked ? 0 : -1}
                        aria-pressed={isSelected}
                        aria-disabled={!isUnlocked}
                        className={`opt-tile${isUnlocked ? '' : ' is-locked'}`}
                        onClick={() => isUnlocked && handleSelectFrontSkin(skin.id)}
                        onKeyDown={(e) => {
                          if (isUnlocked && (e.key === 'Enter' || e.key === ' ')) {
                            e.preventDefault();
                            handleSelectFrontSkin(skin.id);
                          }
                        }}
                        onMouseEnter={() => setHoveredFrontSkin(skin.id)}
                        onMouseLeave={() => setHoveredFrontSkin(null)}
                      >
                        <span className="opt-tile-top">
                          <span className="opt-tile-title">{skin.name}</span>
                          {!isUnlocked && <Lock size={12} className="opt-gold" />}
                        </span>
                        <span className="opt-tile-desc">{skin.desc}</span>
                        {renderSkinFooter(isUnlocked, isSelected, skin.cost, () => handleUnlockFrontSkin(skin.id, skin.cost), skin.cost === 0 ? 'Free' : 'Owned')}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ════ CARD BACKS ════ */}
            {activeTab === 'backs' && (
              <div className="opt-split">
                <aside className="opt-preview">
                  <span className="opt-eyebrow">Live preview</span>
                  <CardSkinContext.Provider value={{ staticFace: 'back', backSkin: hoveredBackSkin || activeCardBack }}>
                    <div className="opt-preview-card">
                      {(() => {
                        const SkinComp = getSkinComponent(activeCardSkin);
                        const BackComp = getBackComponent(hoveredBackSkin || activeCardBack);
                        return <SkinComp card={previewCard} backSide={<BackComp card={previewCard} />} />;
                      })()}
                    </div>
                  </CardSkinContext.Provider>
                  <div className="opt-preview-caption">
                    <strong>{[...STANDARD_CARD_BACKS, ...BACK_SKINS.map(s => ({ id: s.id, name: s.name }))].find(b => b.id === (hoveredBackSkin || activeCardBack))?.name}</strong>
                    <span>{hoveredBackSkin ? 'Previewing' : 'Equipped'}</span>
                  </div>
                </aside>

                <div className="opt-stack">
                  <Panel title="Standard backs" hint="Free">
                    <div className="opt-grid opt-grid--2">
                      {STANDARD_CARD_BACKS.map(skin => {
                        const isSelected = activeCardBack === skin.id;
                        return (
                          <div
                            key={skin.id}
                            role="button"
                            tabIndex={0}
                            aria-pressed={isSelected}
                            className="opt-tile"
                            onClick={() => handleSelectBackSkin(skin.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleSelectBackSkin(skin.id);
                              }
                            }}
                            onMouseEnter={() => setHoveredBackSkin(skin.id)}
                            onMouseLeave={() => setHoveredBackSkin(null)}
                          >
                            <span className="opt-tile-top">
                              <span className="opt-tile-title">{skin.name}</span>
                              <span className="opt-tile-chip" style={skin.style} />
                            </span>
                            <span className="opt-tile-desc">{skin.desc}</span>
                            {renderSkinFooter(true, isSelected, 0, () => {}, 'Free')}
                          </div>
                        );
                      })}
                    </div>
                  </Panel>

                  <Panel title="Unlockable backs" hint={<span className="opt-gold">Spend V⚡</span>}>
                    <div className="opt-grid opt-grid--2">
                      {BACK_SKINS.map(skin => {
                        const isUnlocked = unlockedSkins.includes('back_' + skin.id);
                        const isSelected = activeCardBack === skin.id;
                        return (
                          <div
                            key={skin.id}
                            role="button"
                            tabIndex={isUnlocked ? 0 : -1}
                            aria-pressed={isSelected}
                            aria-disabled={!isUnlocked}
                            className={`opt-tile${isUnlocked ? '' : ' is-locked'}`}
                            onClick={() => isUnlocked && handleSelectBackSkin(skin.id)}
                            onKeyDown={(e) => {
                              if (isUnlocked && (e.key === 'Enter' || e.key === ' ')) {
                                e.preventDefault();
                                handleSelectBackSkin(skin.id);
                              }
                            }}
                            onMouseEnter={() => setHoveredBackSkin(skin.id)}
                            onMouseLeave={() => setHoveredBackSkin(null)}
                          >
                            <span className="opt-tile-top">
                              <span className="opt-tile-title">{skin.name}</span>
                              {!isUnlocked && <Lock size={12} className="opt-gold" />}
                            </span>
                            <span className="opt-tile-desc">{skin.desc}</span>
                            {renderSkinFooter(isUnlocked, isSelected, skin.cost, () => handleUnlockBackSkin(skin.id, skin.cost))}
                          </div>
                        );
                      })}
                    </div>
                  </Panel>

                  <Panel title="Pack style" hint="How new pulls arrive">
                    <div className="opt-grid opt-grid--2">
                      {[
                        { id: 'classic_foil' as const, name: 'Holo foil pack', desc: 'Holographic foil wrapper that catches the light, torn open along the strip', tone: '#E5B800' },
                        { id: 'cyber_cartridge' as const, name: 'Cyber matrix core', desc: 'Hard-shell data capsule, opened by laser', tone: '#00E5FF' },
                      ].map(pack => (
                        <button
                          key={pack.id}
                          type="button"
                          aria-pressed={packDesignStyle === pack.id}
                          className="opt-tile"
                          style={{ '--opt-accent': pack.tone } as CSSProperties}
                          onClick={() => setPackDesignStyle(pack.id)}
                        >
                          <span className="opt-tile-title">{pack.name}</span>
                          <span className="opt-tile-desc">{pack.desc}</span>
                          <span className="opt-tile-foot">
                            {packDesignStyle === pack.id
                              ? <span className="opt-status opt-status--on"><Check size={12} /> Active</span>
                              : <span className="opt-status">Select</span>}
                          </span>
                        </button>
                      ))}
                    </div>
                  </Panel>
                </div>
              </div>
            )}
          </main>
        </div>

        {/* ── Footer ── */}
        <footer className="opt-foot">
          <span className="opt-saved">
            <span className="opt-saved-dot" /> Changes save automatically
          </span>
          <div className="opt-foot-actions">
            <button
              type="button"
              onClick={handleReset}
              className={`opt-btn opt-btn--ghost${resetState === 'confirm' ? ' is-danger' : ''}`}
            >
              {resetState === 'confirm' ? 'Tap again to reset' : 'Reset defaults'}
            </button>
            <button type="button" onClick={onClose} className="opt-btn opt-btn--solid">
              Done
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
