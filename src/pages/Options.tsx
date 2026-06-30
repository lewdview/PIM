import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { loadOpts, resetOpts, keyLabel, getActiveTheme, type GameOpts, GAME_BACKGROUNDS } from "@/lib/options";
import { clearCatalogCache } from "@/game/api";
import { audioManager } from "@/game/audio";
import { logAnalyticsEvent } from "@/services/telemetryService";
import { useVaultStore } from "@/store/useVaultStore";

// ── colour palette presets (8 per lane, thematically grouped) ────
const COLOR_PRESETS: [string[], string[], string[]] = [
  // Lane 0 — warm / fire
  ["#FF1493", "#FF0000", "#FF8C00", "#E5B800", "#FF5400", "#CC2200", "#FF6B6B", "#FFD700"],
  // Lane 1 — cool / deep
  ["#00E5FF", "#6B21A8", "#1E3A8A", "#0891B2", "#7C3AED", "#059669", "#831843", "#374151"],
  // Lane 2 — fresh / neon
  ["#39FF14", "#22C55E", "#10B981", "#06B6D4", "#84CC16", "#A78BFA", "#FDE047", "#F0F0F0"],
];

// Common keys displayed for mobile remapping
const KEY_ROWS = [
  ["q","w","e","r","t","y","u","i","o","p"],
  ["a","s","d","f","g","h","j","k","l"],
  ["z","x","c","v","b","n","m"],
  ["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"," "],
];

// ── subcomponents ─────────────────────────────────────────────────

function Toggle({ on, onChange, isAvant }: { on: boolean; onChange: () => void; isAvant?: boolean }) {
  if (isAvant) {
    return (
      <button
        onClick={onChange}
        onMouseEnter={() => audioManager.playSfx('tap_nav', 0.1)}
        style={{
          width: 50, height: 18, position: "relative", flexShrink: 0,
          background: on ? "rgba(57,255,20,0.12)" : "rgba(255,255,255,0.02)",
          border: on ? "1px solid #39FF14" : "1px solid rgba(255,255,255,0.15)",
          boxShadow: on ? "0 0 10px rgba(57,255,20,0.2)" : "none",
          transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
          cursor: "pointer",
        }}
      >
        <div style={{
          width: 10, height: 10,
          background: on ? "#39FF14" : "rgba(255,255,255,0.3)",
          boxShadow: on ? "0 0 6px #39FF14" : "none",
          position: "absolute",
          top: 3, left: on ? 35 : 3, transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
        }} />
        <div style={{
          position: "absolute", right: 6, top: 4, fontSize: 7, fontFamily: "monospace",
          color: "#39FF14", opacity: on ? 1 : 0, transition: "opacity 0.2s", fontWeight: "bold"
        }}>ON</div>
        <div style={{
          position: "absolute", left: 6, top: 4, fontSize: 7, fontFamily: "monospace",
          color: "rgba(255,255,255,0.3)", opacity: on ? 0 : 1, transition: "opacity 0.2s"
        }}>OFF</div>
      </button>
    );
  }
  return (
    <button
      onClick={onChange}
      style={{
        width: 44, height: 24, position: "relative", flexShrink: 0,
        background: on ? "#FF1493" : "rgba(255,255,255,0.08)",
        border: on ? "2px solid #FF1493" : "2px solid rgba(255,255,255,0.12)",
        transition: "background 0.15s, border-color 0.15s",
        cursor: "pointer",
      }}
    >
      <div style={{
        width: 14, height: 14, background: "#fff", position: "absolute",
        top: 3, left: on ? 24 : 3, transition: "left 0.15s",
      }} />
    </button>
  );
}

function SectionLabel({ label, sub, isAvant }: { label: string; sub?: string; isAvant?: boolean }) {
  if (isAvant) {
    return (
      <div className="flex items-baseline justify-between py-1.5 px-3"
        style={{ borderLeft: "3px solid #39FF14", background: "linear-gradient(90deg, rgba(57,255,20,0.08), transparent)", borderBottom: "1px solid rgba(57,255,20,0.15)", marginBottom: 4 }}>
        <div className="font-mono font-bold tracking-[0.3em] text-[#39FF14]" style={{ fontSize: 11 }}>{label}</div>
        {sub && <div className="font-mono font-black" style={{ fontSize: 8, color: "rgba(255,255,255,0.45)", letterSpacing: "0.15em" }}>// {sub.toUpperCase()}</div>}
      </div>
    );
  }
  return (
    <div className="flex items-baseline justify-between"
      style={{ borderBottom: "2px solid rgba(255,255,255,0.08)", paddingBottom: 10, marginBottom: 0 }}>
      <div className="font-mono font-bold tracking-[0.35em]" style={{ fontSize: 11, color: "#FF1493" }}>{label}</div>
      {sub && <div className="font-mono" style={{ fontSize: 9, color: "rgba(255,255,255,0.22)", letterSpacing: "0.15em" }}>{sub}</div>}
    </div>
  );
}

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
        {/* sweep */}
        <div style={{
          position: "absolute", top: 0, bottom: 0, left: `${progress * 100}%`, width: 2,
          background: "linear-gradient(90deg, rgba(57,255,20,0.4), transparent)",
          boxShadow: "0 0 8px rgba(57,255,20,0.3)"
        }} />
        {/* grid lines */}
        {[0.25, 0.5, 0.75].map(x => (
          <div key={x} style={{ position: "absolute", top: 0, bottom: 0, left: `${x * 100}%`, width: 1, background: "rgba(255,255,255,0.06)" }} />
        ))}
        {/* track */}
        <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1, background: "rgba(255,255,255,0.1)", transform: "translateY(-50%)" }} />

        {/* BEAT dot */}
        <div style={{
          position: "absolute", top: "50%", left: `${beatPos * 100}%`,
          transform: "translate(-50%, -50%)",
          width: 10, height: 10, borderRadius: "50%",
          background: "#39FF14", boxShadow: "0 0 12px #39FF14",
        }} />
        {/* TAP dot */}
        <div style={{
          position: "absolute", top: "50%", left: `${tapPos * 100}%`,
          transform: "translate(-50%, -50%)",
          width: 10, height: 10, borderRadius: "50%",
          background: "#FF1493", boxShadow: "0 0 12px #FF1493",
          transition: "left 0.08s linear",
        }} />

        {/* corner details */}
        <div style={{ position: "absolute", top: 2, left: 2, fontSize: 6, color: "rgba(57,255,20,0.4)", fontFamily: "monospace" }}>[ CAL_CH.A ]</div>
        <div style={{ position: "absolute", top: 2, right: 2, fontSize: 6, color: "rgba(255,20,147,0.4)", fontFamily: "monospace" }}>[ CAL_CH.B ]</div>

        {/* labels */}
        <div style={{ position: "absolute", bottom: 4, left: `${beatPos * 100}%`, transform: "translateX(-50%)", fontFamily: "monospace", fontSize: 8, fontWeight: "bold", color: "#39FF14", letterSpacing: "0.15em" }}>BEAT</div>
        <div style={{ position: "absolute", top: 4, left: `${tapPos * 100}%`, transform: "translateX(-50%)", fontFamily: "monospace", fontSize: 8, fontWeight: "bold", color: "#FF1493", letterSpacing: "0.15em" }}>TAP</div>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", height: 48, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}>
      {/* grid lines */}
      {[0.25, 0.5, 0.75].map(x => (
        <div key={x} style={{ position: "absolute", top: 0, bottom: 0, left: `${x * 100}%`, width: 1, background: "rgba(255,255,255,0.04)" }} />
      ))}
      {/* track */}
      <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1, background: "rgba(255,255,255,0.06)", transform: "translateY(-50%)" }} />

      {/* BEAT dot — fixed */}
      <div style={{
        position: "absolute", top: "50%", left: `${beatPos * 100}%`,
        transform: "translate(-50%, -50%)",
        width: 12, height: 12, borderRadius: "50%",
        background: "#39FF14", boxShadow: "0 0 10px #39FF14",
      }} />
      {/* TAP dot — drifts */}
      <div style={{
        position: "absolute", top: "50%", left: `${tapPos * 100}%`,
        transform: "translate(-50%, -50%)",
        width: 12, height: 12, borderRadius: "50%",
        background: "#FF1493", boxShadow: "0 0 10px #FF1493",
        transition: "left 0.08s linear",
      }} />

      {/* labels */}
      <div style={{ position: "absolute", bottom: 3, left: `${beatPos * 100}%`, transform: "translateX(-50%)", fontFamily: "monospace", fontSize: 7, color: "#39FF14", letterSpacing: "0.1em" }}>BEAT</div>
      <div style={{ position: "absolute", top: 3, left: `${tapPos * 100}%`, transform: "translateX(-50%)", fontFamily: "monospace", fontSize: 7, color: "#FF1493", letterSpacing: "0.1em" }}>TAP</div>
    </div>
  );
}

function SvgBlurSlider({ value, onChange, isAvant }: { value: number; onChange: (v: number) => void; isAvant?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const width = rect.width;
    const clickX = Math.max(0, Math.min(clientX - rect.left, width));
    const percentage = clickX / width;
    const newValue = Math.round(percentage * 40); // 0px to 40px blur range
    onChange(newValue);
  }, [onChange]);

  useEffect(() => {
    if (!isDragging) return;
    const onMouseMove = (e: MouseEvent) => {
      handleMove(e.clientX);
    };
    const onMouseUp = () => {
      setIsDragging(false);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) handleMove(e.touches[0].clientX);
    };
    const onTouchEnd = () => {
      setIsDragging(false);
    };

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
        {/* Customized SVG Track and Glow */}
        <svg className="w-full h-4 overflow-visible" xmlns="http://www.w3.org/2000/svg">
          {/* Background Track with segmented grid indicators */}
          <line 
            x1="0" y1="8" x2="100%" y2="8" 
            stroke="rgba(255,255,255,0.08)" strokeWidth="4" 
            strokeDasharray="4 2" 
          />
          {/* Active Track (with neon accent color) */}
          <line 
            x1="0" y1="8" x2={`${pct}%`} y2="8" 
            stroke={strokeColor} strokeWidth="4" 
            style={{ filter: `drop-shadow(0 0 4px ${strokeColor})` }}
          />
          
          {/* Segmented notches at 0%, 25%, 50%, 75%, 100% */}
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

        {/* Custom Diamond Thumb */}
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
              style={{
                filter: `drop-shadow(0 0 6px ${strokeColor})`,
              }}
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

// ── main page ─────────────────────────────────────────────────────
export default function Options() {
  const [, setLocation] = useLocation();
  const [opts, setOpts] = useState<GameOpts>(loadOpts);
  const echoPrestigeScore = useVaultStore(state => state.echoPrestigeScore);
  const unlockedSkins = useVaultStore(state => state.unlockedSkins || []);
  const [remapping, setRemapping] = useState<number | null>(null);
  const [resetState, setResetState] = useState<"idle" | "confirm">("idle");
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const colorRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  const isAvant = getActiveTheme() === "avant-garde";

  // Telemetry: Log unmount settings summary for slider adjustments
  const initialOffsetRef = useRef(opts.audioOffset);
  const initialBlurRef = useRef(opts.backgroundBlur);
  const currentOptsRef = useRef(opts);
  currentOptsRef.current = opts;

  useEffect(() => {
    return () => {
      if (currentOptsRef.current.audioOffset !== initialOffsetRef.current) {
        logAnalyticsEvent('setting_change', { key: 'audioOffset', value: currentOptsRef.current.audioOffset });
      }
      if (currentOptsRef.current.backgroundBlur !== initialBlurRef.current) {
        logAnalyticsEvent('setting_change', { key: 'backgroundBlur', value: currentOptsRef.current.backgroundBlur });
      }
    };
  }, []);

  // keyboard listener for remapping
  useEffect(() => {
    if (remapping === null) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      if (e.key === "Escape") { setRemapping(null); return; }
      // Accept single printable chars and arrow keys
      const ok = e.key.length === 1 || e.key.startsWith("Arrow");
      if (!ok) return;
      assignKey(remapping, e.key);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [remapping]); // eslint-disable-line react-hooks/exhaustive-deps

  function assignKey(lane: number, key: string) {
    const k = key === " " ? " " : key.length === 1 ? key.toLowerCase() : key;
    const newKeys = [...opts.laneKeys] as [string, string, string];
    newKeys[lane] = k;
    localStorage.setItem(`opt_laneKey_${lane}`, k);
    setOpts(o => ({ ...o, laneKeys: newKeys }));
    setRemapping(null);
    logAnalyticsEvent('setting_change', { key: `laneKey_${lane}`, value: k });
  }

  function setColor(lane: number, color: string) {
    const newColors = [...opts.laneColors] as [string, string, string];
    newColors[lane] = color;
    localStorage.setItem(`opt_laneColor_${lane}`, color);
    // Custom note color changes customizes the note theme preset to 'custom'
    localStorage.setItem("opt_noteTheme", "custom");
    setOpts(o => ({ ...o, laneColors: newColors, noteTheme: "custom" }));
    logAnalyticsEvent('setting_change', { key: `laneColor_${lane}`, value: color });
  }

  function setCardBack(back: string) {
    localStorage.setItem("opt_cardBack", back);
    setOpts(o => ({ ...o, cardBack: back }));
    logAnalyticsEvent('setting_change', { key: 'cardBack', value: back });
  }

  function selectNoteTheme(themeId: string, colors: string[]) {
    localStorage.setItem("opt_noteTheme", themeId);
    colors.forEach((c, idx) => {
      localStorage.setItem(`opt_laneColor_${idx}`, c);
    });
    setOpts(o => ({ ...o, noteTheme: themeId, laneColors: colors as [string, string, string] }));
    logAnalyticsEvent('setting_change', { key: 'noteTheme', value: themeId });
  }

  function toggle(k: "missSystem" | "hudMisses" | "comboDisplay" | "judgmentText" | "useLocalFiles" | "bgMusic" | "haptics") {
    const v = !opts[k];
    localStorage.setItem(`opt_${k}`, String(v));
    setOpts(o => ({ ...o, [k]: v }));
    
    // Clear catalog cache if we toggled the local files switch
    if (k === "useLocalFiles") {
      clearCatalogCache();
    }
    if (k === "bgMusic") {
      window.dispatchEvent(new Event("bgmusic_toggle"));
    }
    logAnalyticsEvent('setting_change', { key: k, value: v });
  }

  const NOTE_THEME_PRESETS = [
    { id: 'classic', name: 'Classic Vault', colors: ['#FF1493', '#00E5FF', '#39FF14'] },
    { id: 'cyberpunk', name: 'Cyberpunk Neon', colors: ['#00F0FF', '#FFFF00', '#FF007F'] },
    { id: 'sunset', name: 'Synth Sunset', colors: ['#FF0055', '#7B2CBF', '#FF8C00'] },
    { id: 'acid', name: 'Acid Hazard', colors: ['#39FF14', '#E5B800', '#00E5FF'] },
    { id: 'crimson', name: 'Midnight Crimson', colors: ['#FF0000', '#800000', '#CC2200'] },
    { id: 'gold_prestige', name: 'Gold Prestige', colors: ['#FFD700', '#E5B800', '#FF8C00'] },
    { id: 'ghost', name: 'Void Ghost', colors: ['#D8B4FE', '#374151', '#F3F4F6'] }
  ];

  const CARD_BACKS = [
    { id: 'classic', name: 'Classic Vault', desc: 'Standard rarity-colored core grid', style: { background: '#0c0a07', border: '1px solid rgba(255,255,255,0.1)' } },
    { id: 'holo', name: 'Holo Foil', desc: 'Shimmering rainbow overlay sheen', style: { background: 'linear-gradient(135deg, #0e1b29, #210e29)', border: '1px solid #00ffff' } },
    { id: 'carbon', name: 'Carbon Tech', desc: 'High-tech composite carbon weave', style: { background: '#151619', border: '1.5px solid #00ffff', boxShadow: '0 0 8px #00ffff33' } },
    { id: 'gold_luxe', name: 'Royal Gold', desc: 'Gilded gold leaf frame & starry dust', style: { background: 'linear-gradient(135deg, #1f1a0f, #1c150c)', border: '1px solid #ffd700', boxShadow: '0 0 8px rgba(255,215,0,0.2)' } },
    { id: 'matrix', name: 'Matrix Code', desc: 'Binary rain & console grid lines', style: { background: '#030804', border: '1px solid #39ff14', boxShadow: '0 0 8px rgba(57,255,20,0.2)' } },
    { id: 'th3scr1b3', name: 'th3scr1b3 Signature', desc: 'Abstract red splatters & gothic marks', style: { background: 'radial-gradient(circle, #4a002a, #0d0006)', border: '1px dashed #ff007f' } },
  ];

  function handleReset() {
    if (resetState === "idle") {
      setResetState("confirm");
      resetTimer.current = setTimeout(() => setResetState("idle"), 2500);
    } else {
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetOpts();
      setOpts(loadOpts());
      setResetState("idle");
      logAnalyticsEvent('setting_reset');
    }
  }

  const color = (lane: number) => opts.laneColors[lane];

  return (
    <div className="min-h-screen w-full flex flex-col" style={{ background: isAvant ? "#050505" : "#080808" }}>
      {/* bg grid */}
      <div className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: isAvant
            ? "linear-gradient(rgba(57,255,20,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(57,255,20,0.03) 1px,transparent 1px)"
            : "linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.02) 1px,transparent 1px)",
          backgroundSize: "64px 64px"
        }} />
      {isAvant && (
        <div className="fixed inset-0 pointer-events-none opacity-20"
          style={{
            background: "radial-gradient(circle at 50% 50%, transparent 60%, rgba(0,0,0,0.85))"
          }} />
      )}

      {/* sticky header */}
      <div className="sticky top-0 z-40 flex items-center justify-between px-5 py-4 gap-4"
        style={{
          background: isAvant ? "rgba(5,5,5,0.95)" : "rgba(8,8,8,0.95)",
          borderBottom: isAvant ? "1px solid rgba(57,255,20,0.2)" : "2px solid rgba(255,255,255,0.08)",
          backdropFilter: "blur(10px)"
        }}>
        <button
          onClick={() => {
            if (isAvant) audioManager.playSfx('tap_nav', 0.12);
            setLocation("/");
          }}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          <span className="font-mono text-xs tracking-[0.25em] flex items-center gap-1.5 transition-colors"
            style={{ color: isAvant ? "rgba(57,255,20,0.5)" : "rgba(255,255,255,0.4)" }}
            onMouseEnter={e => {
              if (isAvant) audioManager.playSfx('tap_nav', 0.08);
              e.currentTarget.style.color = isAvant ? "#39FF14" : "#FF1493";
            }}
            onMouseLeave={e => (e.currentTarget.style.color = isAvant ? "rgba(57,255,20,0.5)" : "rgba(255,255,255,0.4)")}>
            ← BACK
          </span>
        </button>

        <div className="font-mono font-bold tracking-[0.4em]"
          style={{
            fontSize: 13,
            color: isAvant ? "#39FF14" : "#F2EDE5",
            flexShrink: 0,
            textShadow: isAvant ? "0 0 10px rgba(57,255,20,0.3)" : "none"
          }}>
          PLAYER CONFIG
        </div>

        <button
          onClick={() => {
            if (isAvant) audioManager.playSfx('tap_nav', 0.15);
            handleReset();
          }}
          onMouseEnter={() => { if (isAvant) audioManager.playSfx('tap_nav', 0.08); }}
          className="font-mono text-xs tracking-[0.2em] transition-all"
          style={{
            background: "none",
            border: isAvant
              ? `1px solid ${resetState === "confirm" ? "#FF1493" : "rgba(57,255,20,0.3)"}`
              : `1px solid ${resetState === "confirm" ? "#FF1493" : "rgba(255,20,147,0.25)"}`,
            color: resetState === "confirm"
              ? "#FF1493"
              : (isAvant ? "rgba(57,255,20,0.6)" : "rgba(255,20,147,0.4)"),
            padding: "4px 10px", cursor: "pointer", whiteSpace: "nowrap",
          }}
        >
          {resetState === "confirm" ? "CONFIRM?" : "RESET"}
        </button>
      </div>

      {/* content */}
      <div className="flex-1 w-full max-w-lg mx-auto px-4 py-6 flex flex-col gap-8 relative z-10">

        {/* ── CONTROLS ────────────────────────────────────────── */}
        <section className="flex flex-col gap-3">
          <SectionLabel label="CONTROLS" sub="Key binding & lane colour" isAvant={isAvant} />

          {/* Note Themes Preset Selector */}
          <div className="mb-2">
            <div className="font-mono text-[9px] text-zinc-500 uppercase tracking-widest px-1 mb-2">NOTE COLOR THEMES</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {NOTE_THEME_PRESETS.map(t => {
                const active = opts.noteTheme === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      if (isAvant) audioManager.playSfx('tap_nav', 0.1);
                      selectNoteTheme(t.id, t.colors);
                    }}
                    className="font-mono text-[10px] py-1.5 px-2 flex flex-col items-center justify-between border cursor-pointer transition-all"
                    style={{
                      background: active ? (isAvant ? "rgba(57,255,20,0.12)" : "rgba(255,20,147,0.1)") : "rgba(255,255,255,0.02)",
                      borderColor: active ? (isAvant ? "#39FF14" : "#FF1493") : "rgba(255,255,255,0.08)",
                      color: active ? "#fff" : "rgba(255,255,255,0.55)",
                      boxShadow: active ? `0 0 10px ${isAvant ? "rgba(57,255,20,0.2)" : "rgba(255,20,147,0.2)"}` : "none",
                    }}
                  >
                    <span className="font-bold truncate text-center w-full mb-1">{t.name.toUpperCase()}</span>
                    <div className="flex gap-1">
                      {t.colors.map((c, i) => (
                        <div key={i} style={{ width: 8, height: 8, background: c, borderRadius: '50%' }} />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3 lane cards */}
          <div className="grid grid-cols-3 gap-2 mt-1">
            {([0, 1, 2] as const).map(lane => {
              const lc = color(lane);
              const listening = remapping === lane;
              return (
                <div key={lane} style={{
                  border: isAvant
                    ? `1px solid ${listening ? lc : "rgba(57,255,20,0.15)"}`
                    : `2px solid ${listening ? lc : "rgba(255,255,255,0.08)"}`,
                  background: listening ? `${lc}0f` : (isAvant ? "rgba(5,5,5,0.5)" : "rgba(255,255,255,0.018)"),
                  boxShadow: (isAvant && listening) ? `0 0 15px ${lc}22` : "none",
                  transition: "all 0.15s cubic-bezier(0.16, 1, 0.3, 1)",
                  display: "flex", flexDirection: "column",
                  position: "relative"
                }}>
                  {isAvant && (
                    <div style={{ position: "absolute", top: 0, left: 0, width: 4, height: 4, borderTop: `1px solid ${lc}`, borderLeft: `1px solid ${lc}` }} />
                  )}

                  {/* lane label */}
                  <div className="font-mono px-2 pt-2 pb-1"
                    style={{ fontSize: 8, color: isAvant ? "rgba(57,255,20,0.4)" : "rgba(255,255,255,0.22)", letterSpacing: "0.3em", borderBottom: `1px solid ${lc}28` }}>
                    {["LEFT", "MID", "RIGHT"][lane]}
                  </div>

                  {/* colour stripe */}
                  <div className="mx-2 mt-2 h-0.5"
                    style={{ background: `linear-gradient(90deg, ${lc}00, ${lc}, ${lc}00)` }} />

                  {/* key button */}
                  <button
                    onClick={() => {
                      if (isAvant) audioManager.playSfx('tap_nav', 0.12);
                      setRemapping(listening ? null : lane);
                    }}
                    onMouseEnter={() => { if (isAvant) audioManager.playSfx('tap_nav', 0.08); }}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: "12px 4px 8px" }}
                  >
                    <div className="font-mono font-bold text-center leading-none"
                      style={{
                        fontSize: 30, minHeight: 34, display: "flex", alignItems: "center", justifyContent: "center",
                        color: listening ? lc : (isAvant ? "rgba(255,255,255,0.85)" : "#F2EDE5"),
                        textShadow: listening ? `0 0 18px ${lc}` : "none",
                        transition: "color 0.15s, text-shadow 0.15s",
                      }}>
                      {listening ? "…" : keyLabel(opts.laneKeys[lane])}
                    </div>
                    <div className="font-mono text-center mt-1"
                      style={{ fontSize: 7, letterSpacing: "0.2em", color: listening ? lc : (isAvant ? "rgba(57,255,20,0.4)" : "rgba(255,255,255,0.2)") }}>
                      {listening ? "PRESS KEY" : "TAP·REMAP"}
                    </div>
                  </button>

                  {/* colour swatches: 2 rows × 4 */}
                  <div className="px-1.5 pb-1.5 grid grid-cols-4 gap-1">
                    {COLOR_PRESETS[lane].map(c => (
                      <button
                        key={c}
                        onClick={() => {
                          if (isAvant) audioManager.playSfx('tap_nav', 0.1);
                          setColor(lane, c);
                        }}
                        onMouseEnter={() => { if (isAvant) audioManager.playSfx('tap_nav', 0.05); }}
                        style={{
                          aspectRatio: "1", width: "100%", background: c, border: "none",
                          outline: opts.laneColors[lane] === c
                            ? (isAvant ? "1px solid #39FF14" : "2px solid #fff")
                            : "2px solid transparent",
                          outlineOffset: isAvant ? "1px" : "0px",
                          boxShadow: opts.laneColors[lane] === c ? `0 0 8px ${c}` : "none",
                          cursor: "pointer", transition: "outline 0.1s, box-shadow 0.1s",
                        }}
                      />
                    ))}
                  </div>

                  {/* custom colour picker */}
                  <label className="mx-1.5 mb-1.5 flex items-center gap-1.5 cursor-pointer"
                    onMouseEnter={() => { if (isAvant) audioManager.playSfx('tap_nav', 0.05); }}
                    style={{ fontSize: 7, fontFamily: "monospace", color: isAvant ? "rgba(57,255,20,0.5)" : "rgba(255,255,255,0.28)", letterSpacing: "0.2em" }}>
                    <div style={{
                      width: 14, height: 14, background: lc,
                      border: isAvant ? "1px solid rgba(57,255,20,0.3)" : "1px solid rgba(255,255,255,0.2)",
                      position: "relative", flexShrink: 0
                    }}>
                      <input
                        ref={colorRefs[lane]}
                        type="color"
                        value={lc}
                        onChange={e => setColor(lane, e.target.value)}
                        style={{ opacity: 0, position: "absolute", inset: 0, width: "100%", height: "100%", cursor: "pointer", border: "none", padding: 0 }}
                      />
                    </div>
                    CUSTOM
                  </label>
                </div>
              );
            })}
          </div>

          {/* on-screen key picker — shown when remapping active (works on mobile) */}
          {remapping !== null && (
            <div style={{
              border: isAvant ? `1px solid ${color(remapping)}` : `2px solid ${color(remapping)}`,
              background: isAvant ? `${color(remapping)}0a` : `${color(remapping)}08`,
              padding: "10px 8px 8px"
            }}>
              <div className="font-mono mb-2 text-center"
                style={{ fontSize: 8, color: color(remapping), letterSpacing: "0.25em" }}>
                PICK A KEY FOR {["LEFT", "MID", "RIGHT"][remapping]} LANE
              </div>
              {KEY_ROWS.map((row, ri) => (
                <div key={ri} className="flex justify-center gap-1 mb-1">
                  {row.map(k => (
                    <button
                      key={k}
                      onClick={() => {
                        if (isAvant) audioManager.playSfx('tap_nav', 0.12);
                        assignKey(remapping, k);
                      }}
                      onMouseEnter={() => { if (isAvant) audioManager.playSfx('tap_nav', 0.08); }}
                      className="font-mono font-bold"
                      style={{
                        minWidth: k.startsWith("Arrow") ? 28 : 22, height: 24,
                        background: opts.laneKeys[remapping] === (k === " " ? " " : k.length === 1 ? k.toLowerCase() : k)
                          ? color(remapping) : "rgba(255,255,255,0.06)",
                        border: `1px solid ${opts.laneKeys[remapping] === (k === " " ? " " : k.length === 1 ? k.toLowerCase() : k)
                          ? color(remapping) : "rgba(255,255,255,0.12)"}`,
                        color: "#F2EDE5", fontSize: 10, cursor: "pointer", padding: "0 4px",
                        transition: "background 0.1s",
                      }}
                    >
                      {keyLabel(k)}
                    </button>
                  ))}
                </div>
              ))}
              <div className="font-mono text-center mt-2"
                style={{ fontSize: 8, color: isAvant ? "rgba(57,255,20,0.4)" : "rgba(255,255,255,0.2)", letterSpacing: "0.15em" }}>
                ESC to cancel · physical key also works
              </div>
            </div>
          )}
        </section>

        {/* ── AUDIO SYNC ──────────────────────────────────────── */}
        <section className="flex flex-col gap-3">
          <SectionLabel label="AUDIO SYNC" sub="Compensate for speaker delay" isAvant={isAvant} />
          <div style={{
            border: isAvant ? "1px solid rgba(57,255,20,0.2)" : "2px solid rgba(255,255,255,0.08)",
            background: isAvant ? "rgba(5,5,5,0.4)" : "rgba(255,255,255,0.015)"
          }}>
            <div className="px-4 pt-4 pb-3">
              <BeatVisualizer offsetMs={opts.audioOffset} isAvant={isAvant} />
            </div>
            <div className="px-4 pb-1 flex items-center justify-between">
              <div className="font-mono" style={{ fontSize: 10, color: isAvant ? "rgba(57,255,20,0.5)" : "rgba(255,255,255,0.3)", letterSpacing: "0.25em" }}>
                OFFSET
              </div>
              <div className="font-mono font-bold"
                style={{
                  fontSize: 18,
                  letterSpacing: "0.08em",
                  color: opts.audioOffset === 0 ? "#39FF14" : "#FF1493",
                  textShadow: isAvant ? (opts.audioOffset === 0 ? "0 0 10px #39FF14" : "0 0 10px #FF1493") : "none"
                }}>
                {opts.audioOffset === 0 ? "SYNCED" : opts.audioOffset > 0 ? `+${opts.audioOffset} ms` : `${opts.audioOffset} ms`}
              </div>
            </div>
            <div className="px-4 pb-2">
              <input
                type="range" min={-150} max={150} step={5} value={opts.audioOffset}
                onMouseEnter={() => { if (isAvant) audioManager.playSfx('tap_nav', 0.08); }}
                onChange={e => {
                  const v = parseInt(e.target.value);
                  localStorage.setItem("opt_audioOffset", String(v));
                  setOpts(o => ({ ...o, audioOffset: v }));
                  if (isAvant && Math.abs(v) % 25 === 0) {
                    audioManager.playSfx('tap_nav', 0.05);
                  }
                }}
                style={{
                  width: "100%",
                  accentColor: isAvant ? "#39FF14" : "#FF1493",
                  cursor: "pointer"
                }}
              />
              <div className="flex justify-between font-mono mt-0.5"
                style={{
                  fontSize: 8,
                  color: isAvant ? "rgba(57,255,20,0.4)" : "rgba(255,255,255,0.18)",
                  letterSpacing: "0.05em"
                }}>
                <span>−150 ms (early)</span>
                <span>0</span>
                <span>+150 ms (late)</span>
              </div>
            </div>
            <div className="px-4 pb-4">
              <div className="font-mono" style={{ fontSize: 9, color: isAvant ? "rgba(57,255,20,0.4)" : "rgba(255,255,255,0.2)", letterSpacing: "0.12em", lineHeight: 1.8 }}>
                NOTES PASS BEFORE YOU HEAR THE BEAT → DRAG LEFT<br />
                YOU HEAR THE BEAT BEFORE NOTES PASS → DRAG RIGHT
              </div>
            </div>
          </div>
        </section>

        {/* ── CHART GENERATION ──────────────────────────────────── */}
        <section className="flex flex-col gap-3">
          <SectionLabel label="CHART GENERATION" sub="Note mapping engine" isAvant={isAvant} />
          <div style={{
            border: isAvant ? "1px solid rgba(57,255,20,0.2)" : "2px solid rgba(255,255,255,0.08)",
            background: isAvant ? "rgba(5,5,5,0.4)" : "rgba(255,255,255,0.015)",
            padding: 12
          }}>
            <div className="flex gap-2">
              {(["auto", "lyrics", "bpm"] as const).map(mode => {
                const active = opts.noteGenerationSource === mode;
                return (
                  <button
                    key={mode}
                    onClick={() => {
                      if (isAvant) audioManager.playSfx('tap_nav', 0.12);
                      localStorage.setItem("opt_noteGenerationSource", mode);
                      setOpts(o => ({ ...o, noteGenerationSource: mode }));
                      clearCatalogCache();
                      logAnalyticsEvent('setting_change', { key: 'noteGenerationSource', value: mode });
                    }}
                    onMouseEnter={() => { if (isAvant) audioManager.playSfx('tap_nav', 0.08); }}
                    className="font-mono text-xs font-bold flex-1 py-2.5 transition-all"
                    style={{
                      background: active
                        ? (isAvant ? "rgba(57,255,20,0.15)" : "#FF1493")
                        : "rgba(255,255,255,0.04)",
                      border: active
                        ? (isAvant ? "1px solid #39FF14" : "1px solid #FF1493")
                        : (isAvant ? "1px solid rgba(57,255,20,0.15)" : "1px solid rgba(255,255,255,0.12)"),
                      color: active
                        ? (isAvant ? "#39FF14" : "#fff")
                        : (isAvant ? "rgba(57,255,20,0.4)" : "rgba(255,255,255,0.4)"),
                      boxShadow: (isAvant && active) ? "0 0 10px rgba(57,255,20,0.2)" : "none",
                      cursor: "pointer",
                    }}
                  >
                    {mode.toUpperCase()}
                  </button>
                );
              })}
            </div>
            <div className="font-mono mt-3" style={{ fontSize: 9, color: isAvant ? "rgba(57,255,20,0.4)" : "rgba(255,255,255,0.2)", letterSpacing: "0.12em", lineHeight: 1.6 }}>
              {opts.noteGenerationSource === "auto" && "AUTO: Map from lyrics if available, fallback to BPM rhythm patterns."}
              {opts.noteGenerationSource === "lyrics" && "LYRICS: Force mapping notes synced to song vocal syllables (requires lyrics)."}
              {opts.noteGenerationSource === "bpm" && "BPM: Force mapping notes using structured tempo/BPM patterns."}
            </div>
          </div>
        </section>

        {/* ── GAMEPLAY BACKGROUNDS ────────────────────────────── */}
        <section className="flex flex-col gap-3">
          <SectionLabel label="GAMEPLAY BACKGROUND" sub="Custom visual themes" isAvant={isAvant} />
          <div style={{
            border: isAvant ? "1px solid rgba(57,255,20,0.2)" : "2px solid rgba(255,255,255,0.08)",
            background: isAvant ? "rgba(5,5,5,0.4)" : "rgba(255,255,255,0.015)",
            padding: 12
          }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {GAME_BACKGROUNDS.map(bg => {
                const isUnlocked = echoPrestigeScore >= bg.unlockScore || unlockedSkins.includes(bg.id);
                const active = opts.gameBackground === bg.id;
                
                return (
                  <button
                    key={bg.id}
                    disabled={!isUnlocked}
                    onClick={() => {
                      if (!isUnlocked) return;
                      if (isAvant) audioManager.playSfx('tap_nav', 0.12);
                      localStorage.setItem("opt_gameBackground", bg.id);
                      setOpts(o => ({ ...o, gameBackground: bg.id }));
                      logAnalyticsEvent('setting_change', { key: 'gameBackground', value: bg.id });
                    }}
                    onMouseEnter={() => { if (isAvant && isUnlocked) audioManager.playSfx('tap_nav', 0.08); }}
                    className="font-mono text-left p-3.5 transition-all relative flex flex-col justify-between border select-none"
                    style={{
                      minHeight: 88,
                      cursor: isUnlocked ? "pointer" : "not-allowed",
                      background: active
                        ? (isAvant ? "rgba(57,255,20,0.12)" : "rgba(255,20,147,0.1)")
                        : "rgba(255,255,255,0.02)",
                      border: active
                        ? (isAvant ? "1px solid #39FF14" : "1px solid #FF1493")
                        : (isAvant ? "1px solid rgba(57,255,20,0.12)" : "1px solid rgba(255,255,255,0.08)"),
                      opacity: isUnlocked ? 1 : 0.45,
                      boxShadow: (isAvant && active) ? "0 0 10px rgba(57,255,20,0.15)" : "none",
                    }}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-xs tracking-wider" style={{ color: active ? (isAvant ? "#39FF14" : "#FF1493") : "#ffffff" }}>
                          {bg.name.toUpperCase()}
                        </span>
                        {!isUnlocked && (
                          <span className="text-[9px] bg-zinc-900 text-zinc-500 px-1.5 py-0.5 border border-zinc-800 uppercase tracking-widest font-bold">
                            LOCKED
                          </span>
                        )}
                        {isUnlocked && active && (
                          <span className="text-[9px] px-1.5 py-0.5 uppercase tracking-widest font-bold" style={{ color: isAvant ? "#39FF14" : "#FF1493" }}>
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-zinc-400 mt-1.5 leading-normal">
                        {bg.desc}
                      </div>
                    </div>

                    <div className="text-[9px] mt-2.5 uppercase tracking-wider" style={{ color: isUnlocked ? "rgba(255,255,255,0.3)" : "#FF1493" }}>
                      {isUnlocked ? "UNLOCKED" : bg.unlockText}
                    </div>
                  </button>
                );
              })}
            </div>

            {opts.gameBackground === 'cover_blur' && (
              <SvgBlurSlider
                value={opts.backgroundBlur}
                isAvant={isAvant}
                onChange={(val) => {
                  localStorage.setItem("opt_backgroundBlur", String(val));
                  setOpts(o => ({ ...o, backgroundBlur: val }));
                }}
              />
            )}
          </div>
        </section>

        {/* ── CARD BACK DESIGN ────────────────────────────────── */}
        <section className="flex flex-col gap-3">
          <SectionLabel label="CARD BACK DESIGN" sub="Customize card back faces" isAvant={isAvant} />
          <div style={{
            border: isAvant ? "1px solid rgba(57,255,20,0.2)" : "2px solid rgba(255,255,255,0.08)",
            background: isAvant ? "rgba(5,5,5,0.4)" : "rgba(255,255,255,0.015)",
            padding: 12
          }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {CARD_BACKS.map(cb => {
                const active = opts.cardBack === cb.id;
                return (
                  <button
                    key={cb.id}
                    onClick={() => {
                      if (isAvant) audioManager.playSfx('tap_nav', 0.12);
                      setCardBack(cb.id);
                    }}
                    onMouseEnter={() => { if (isAvant) audioManager.playSfx('tap_nav', 0.08); }}
                    className="font-mono text-left p-3.5 transition-all relative flex gap-3.5 items-center border select-none cursor-pointer"
                    style={{
                      minHeight: 74,
                      background: active
                        ? (isAvant ? "rgba(57,255,20,0.12)" : "rgba(255,20,147,0.1)")
                        : "rgba(255,255,255,0.02)",
                      border: active
                        ? (isAvant ? "1px solid #39FF14" : "1px solid #FF1493")
                        : (isAvant ? "1px solid rgba(57,255,20,0.12)" : "1px solid rgba(255,255,255,0.08)"),
                      boxShadow: (isAvant && active) ? "0 0 10px rgba(57,255,20,0.15)" : "none",
                    }}
                  >
                    {/* card back miniature frame preview */}
                    <div style={{
                      width: 32, height: 44, borderRadius: 4, flexShrink: 0,
                      position: 'relative', overflow: 'hidden',
                      ...cb.style
                    }}>
                      {/* nested pattern design simulation */}
                      {cb.id === 'classic' && (
                        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle, #FF149333, transparent 70%)' }} />
                      )}
                      {cb.id === 'holo' && (
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(120deg, rgba(0,255,255,0.2) 0%, rgba(255,0,255,0.2) 50%, rgba(57,255,20,0.2) 100%)' }} />
                      )}
                      {cb.id === 'carbon' && (
                        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle, #00ffff22, transparent)' }} />
                      )}
                      {cb.id === 'gold_luxe' && (
                        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle, #ffd70033, transparent)' }} />
                      )}
                      {cb.id === 'matrix' && (
                        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle, #39ff1433, transparent)' }} />
                      )}
                      {cb.id === 'th3scr1b3' && (
                        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle, #ff007f33, transparent)' }} />
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-xs tracking-wider" style={{ color: active ? (isAvant ? "#39FF14" : "#FF1493") : "#ffffff" }}>
                          {cb.name.toUpperCase()}
                        </span>
                        {active && (
                          <span className="text-[8px] uppercase tracking-widest font-bold" style={{ color: isAvant ? "#39FF14" : "#FF1493" }}>
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-zinc-400 mt-1 leading-normal">
                        {cb.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── GAMEPLAY ────────────────────────────────────────── */}
        <section className="flex flex-col gap-3">
          <SectionLabel label="GAMEPLAY" sub="Mechanics & display" isAvant={isAvant} />
          <div style={{ border: isAvant ? "1px solid rgba(57,255,20,0.2)" : "2px solid rgba(255,255,255,0.08)", background: isAvant ? "rgba(5,5,5,0.4)" : "transparent" }}>
            {([
              { key: "bgMusic",      label: "BACKGROUND MUSIC", sub: "Ambient music loop in menus" },
              { key: "haptics",      label: "HAPTIC FEEDBACK", sub: "Tactile clicks during navigation & play" },
              { key: "missSystem",   label: "MISS SYSTEM",   sub: "3 strikes trigger SIGNAL LOST" },
              { key: "hudMisses",    label: "HUD MISSES",    sub: "Miss pips shown in HUD" },
              { key: "comboDisplay", label: "COMBO DISPLAY", sub: "Combo counter" },
              { key: "judgmentText", label: "JUDGMENT TEXT", sub: "PERFECT / GOOD popup text" },
            ] as const).map(({ key, label, sub }, i, arr) => {
              const on = opts[key];
              return (
                <div key={key} className="flex items-center justify-between px-4 py-3"
                  onMouseEnter={() => { if (isAvant) audioManager.playSfx('tap_nav', 0.05); }}
                  style={{
                    borderBottom: i < arr.length - 1
                      ? (isAvant ? "1px solid rgba(57,255,20,0.12)" : "1px solid rgba(255,255,255,0.05)")
                      : "none",
                    background: (isAvant && on) ? "rgba(57,255,20,0.02)" : "transparent",
                    transition: "background 0.2s"
                  }}>
                  <div>
                    <div className="font-mono text-xs tracking-[0.15em]"
                      style={{ color: on ? (isAvant ? "#39FF14" : "rgba(255,255,255,0.75)") : "rgba(255,255,255,0.28)" }}>
                      {label}
                    </div>
                    <div className="font-mono mt-0.5"
                      style={{ fontSize: 9, color: isAvant ? "rgba(57,255,20,0.4)" : "rgba(255,255,255,0.18)", letterSpacing: "0.1em" }}>
                      {sub}
                    </div>
                  </div>
                  <Toggle on={on} onChange={() => toggle(key)} isAvant={isAvant} />
                </div>
              );
            })}
          </div>
        </section>

        {/* ── DEVELOPMENT ───────────────────────────────────────── */}
        <section className="flex flex-col gap-3">
          <SectionLabel label="DEVELOPMENT" sub="Debug & local overrides" isAvant={isAvant} />
          <div style={{ border: isAvant ? "1px solid rgba(57,255,20,0.2)" : "2px solid rgba(255,255,255,0.08)", background: isAvant ? "rgba(5,5,5,0.4)" : "transparent" }}>
            {([
              { key: "useLocalFiles", label: "LOCAL RELEASE DATA", sub: "Use local /365-releases when Supabase is down" },
            ] as const).map(({ key, label, sub }, i, arr) => {
              const on = opts[key];
              return (
                <div key={key} className="flex items-center justify-between px-4 py-3"
                  onMouseEnter={() => { if (isAvant) audioManager.playSfx('tap_nav', 0.05); }}
                  style={{
                    borderBottom: i < arr.length - 1
                      ? (isAvant ? "1px solid rgba(57,255,20,0.12)" : "1px solid rgba(255,255,255,0.05)")
                      : "none",
                    background: (isAvant && on) ? "rgba(57,255,20,0.02)" : "transparent",
                    transition: "background 0.2s"
                  }}>
                  <div>
                    <div className="font-mono text-xs tracking-[0.15em]"
                      style={{ color: on ? (isAvant ? "#39FF14" : "#FF1493") : "rgba(255,255,255,0.28)" }}>
                      {label}
                    </div>
                    <div className="font-mono mt-0.5"
                      style={{ fontSize: 9, color: isAvant ? "rgba(57,255,20,0.4)" : "rgba(255,255,255,0.18)", letterSpacing: "0.1em" }}>
                      {sub}
                    </div>
                  </div>
                  <Toggle on={on} onChange={() => toggle(key)} isAvant={isAvant} />
                </div>
              );
            })}
          </div>
        </section>

        {/* footer */}
        <div className="text-center font-mono pb-4"
          style={{ fontSize: 8, color: isAvant ? "rgba(57,255,20,0.3)" : "rgba(255,255,255,0.08)", letterSpacing: "0.35em" }}>
          TH3SCR1B3 · RHYTHM ENGINE · PLAYER CONFIG
        </div>
      </div>
    </div>
  );
}
