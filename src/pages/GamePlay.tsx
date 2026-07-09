import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { getSongById, saveHighScore, isSongTimeLocked, getModifierForSong } from "@/game/api";
import { saveMedal, saveScoreHistory } from "@/game/progress";
import type { GameSong } from "@/game/api";
import type { Note, JudgmentDisplay, GameState } from "@/game/types";
import { loadOpts, keyLabel, type GameOpts } from "@/lib/options";
import { audioManager } from "@/game/audio";
import { useVaultStore } from "@/store/useVaultStore";
import { haptics } from "../utils/haptics";
import { motion, AnimatePresence } from "framer-motion";
import { Lock } from "lucide-react";
import { logAnalyticsEvent } from "../services/telemetryService";
import { gameSenseService } from "@/services/gameSenseService";


interface GameplayVisualizerProps {
  analyserRef: React.MutableRefObject<AnalyserNode | null>;
  dataArrayRef: React.MutableRefObject<Uint8Array | null>;
  isPlaying: boolean;
}

const GameplayVisualizer: React.FC<GameplayVisualizerProps> = ({ analyserRef, dataArrayRef, isPlaying }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeShape, setActiveShape] = useState<'flower_of_life' | 'sri_yantra' | 'metatrons_cube' | 'bipolar_torus' | 'lakshmi_star'>('flower_of_life');

  useEffect(() => {
    if (!isPlaying) return;
    const shapes: ('flower_of_life' | 'sri_yantra' | 'metatrons_cube' | 'bipolar_torus' | 'lakshmi_star')[] = [
      'flower_of_life', 'sri_yantra', 'metatrons_cube', 'bipolar_torus', 'lakshmi_star'
    ];
    const interval = setInterval(() => {
      setActiveShape(current => {
        const idx = shapes.indexOf(current);
        return shapes[(idx + 1) % shapes.length];
      });
    }, 15000);
    return () => clearInterval(interval);
  }, [isPlaying]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    let animationFrameId: number;
    let rotationAngle = 0;

    const resize = () => {
      canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
      canvas.height = canvas.parentElement?.clientHeight || window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const size = Math.min(w, h) * 0.35;

      ctx.fillStyle = 'rgba(5, 4, 3, 0.15)';
      ctx.fillRect(0, 0, w, h);

      let bass = 0;
      let mid = 0;
      let high = 0;

      if (isPlaying && analyserRef.current && dataArrayRef.current) {
        analyserRef.current.getByteFrequencyData(dataArrayRef.current);
        const data = dataArrayRef.current;
        let bVal = 0;
        let mVal = 0;
        let hVal = 0;
        for (let i = 0; i < data.length; i++) {
          if (i < 10) bVal += data[i];
          else if (i < 50) mVal += data[i];
          else hVal += data[i];
        }
        bass = bVal / 10;
        mid = mVal / 40;
        high = hVal / (data.length - 50);
      } else if (isPlaying) {
        const t = Date.now() / 1000;
        bass = 50 + Math.sin(t * 8) * 25;
        mid = 45 + Math.cos(t * 5) * 15;
        high = 30 + Math.sin(t * 12) * 10;
      }

      const bassN = Math.min(1, bass / 255);
      const midN = Math.min(1, mid / 255);
      const highN = Math.min(1, high / 255);

      const bassScale = 1.0 + bassN * 0.12;
      rotationAngle += 0.002 + midN * 0.005;

      const baseHue = (Date.now() / 80) % 360;
      const getColor = (offset: number, alphaOverride?: number) => {
        return `hsla(${(baseHue + offset) % 360}, 95%, 62%, ${alphaOverride ?? 0.25})`;
      };

      const glowGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, size * 1.5);
      glowGrad.addColorStop(0, getColor(0, 0.04));
      glowGrad.addColorStop(0.6, getColor(120, 0.015));
      glowGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = glowGrad;
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(bassScale, bassScale);
      ctx.rotate(rotationAngle);
      ctx.shadowBlur = 8 + midN * 12;

      const opacityVal = 0.16 + highN * 0.10;

      if (activeShape === 'flower_of_life') {
        const radius = size * 0.22;
        ctx.lineWidth = 1.0;
        for (let i = 0; i < 6; i++) {
          const angle = (i * Math.PI) / 3;
          const ox = Math.cos(angle) * radius;
          const oy = Math.sin(angle) * radius;
          ctx.strokeStyle = getColor(i * 30, opacityVal);
          ctx.shadowColor = getColor(i * 30, opacityVal);
          ctx.beginPath();
          ctx.arc(ox, oy, radius, 0, Math.PI * 2);
          ctx.stroke();

          const outerAngle = angle + Math.PI / 6;
          const oox = Math.cos(outerAngle) * radius * Math.sqrt(3);
          const ooy = Math.sin(outerAngle) * radius * Math.sqrt(3);
          ctx.strokeStyle = getColor(i * 30 + 60, opacityVal);
          ctx.shadowColor = getColor(i * 30 + 60, opacityVal);
          ctx.beginPath();
          ctx.arc(oox, ooy, radius, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.strokeStyle = getColor(0, opacityVal);
        ctx.shadowColor = getColor(0, opacityVal);
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.stroke();

      } else if (activeShape === 'sri_yantra') {
        const scaleFact = size * 0.85;
        ctx.lineWidth = 0.9;
        const drawYantraTriangle = (yCenter: number, r: number, pointingUp: boolean, hueOffset: number) => {
          ctx.strokeStyle = getColor(hueOffset, opacityVal);
          ctx.shadowColor = getColor(hueOffset, opacityVal);
          ctx.beginPath();
          const yTip = pointingUp ? yCenter - r : yCenter + r;
          const yBase = pointingUp ? yCenter + r * 0.5 : yCenter - r * 0.5;
          const xOffset = r * Math.sqrt(3) * 0.5;
          ctx.moveTo(0, yTip);
          ctx.lineTo(xOffset, yBase);
          ctx.lineTo(-xOffset, yBase);
          ctx.closePath();
          ctx.stroke();
        };

        drawYantraTriangle(0, scaleFact * 0.5, true, 0);
        drawYantraTriangle(0, scaleFact * 0.5, false, 40);
        drawYantraTriangle(-scaleFact * 0.05, scaleFact * 0.4, true, 80);
        drawYantraTriangle(scaleFact * 0.05, scaleFact * 0.4, false, 120);
        drawYantraTriangle(scaleFact * 0.03, scaleFact * 0.3, true, 160);
        drawYantraTriangle(-scaleFact * 0.03, scaleFact * 0.3, false, 200);

        ctx.strokeStyle = getColor(180, opacityVal);
        ctx.shadowColor = getColor(180, opacityVal);
        ctx.beginPath();
        ctx.arc(0, 0, scaleFact * 0.58, 0, Math.PI * 2);
        ctx.stroke();

      } else if (activeShape === 'metatrons_cube') {
        const rad = size * 0.22;
        const nodes: {x: number, y: number, color: string}[] = [];
        ctx.lineWidth = 0.7;

        nodes.push({ x: 0, y: 0, color: getColor(0, opacityVal) });
        for (let i = 0; i < 6; i++) {
          const angle = (i * Math.PI) / 3;
          nodes.push({ x: Math.cos(angle) * rad, y: Math.sin(angle) * rad, color: getColor(i * 30, opacityVal) });
          nodes.push({ x: Math.cos(angle) * rad * 2, y: Math.sin(angle) * rad * 2, color: getColor(i * 30 + 60, opacityVal) });
        }

        for (let a = 0; a < nodes.length; a++) {
          for (let b = a + 1; b < nodes.length; b++) {
            ctx.strokeStyle = nodes[a].color.replace(String(opacityVal), String(opacityVal * 0.25));
            ctx.beginPath();
            ctx.moveTo(nodes[a].x, nodes[a].y);
            ctx.lineTo(nodes[b].x, nodes[b].y);
            ctx.stroke();
          }
        }

        nodes.forEach((n) => {
          ctx.strokeStyle = n.color;
          ctx.shadowColor = n.color;
          ctx.beginPath();
          ctx.arc(n.x, n.y, rad * 0.4, 0, Math.PI * 2);
          ctx.stroke();
        });

      } else if (activeShape === 'bipolar_torus') {
        const rad = size * 0.88;
        ctx.lineWidth = 0.9;
        const circlesCount = 8;
        for (let i = 1; i <= circlesCount; i++) {
          const ratio = i / circlesCount;
          const cyOffset = rad * (1 - ratio);
          const currentRad = rad * ratio;

          ctx.strokeStyle = getColor(i * 30, opacityVal);
          ctx.shadowColor = getColor(i * 30, opacityVal);

          ctx.beginPath();
          ctx.arc(0, -cyOffset, currentRad, 0, Math.PI * 2);
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(0, cyOffset, currentRad, 0, Math.PI * 2);
          ctx.stroke();
        }

      } else if (activeShape === 'lakshmi_star') {
        const rad = size * 0.68;
        ctx.lineWidth = 1.0;
        const drawSquare = (angle: number, colorIdx: number) => {
          ctx.save();
          ctx.rotate(angle);
          ctx.strokeStyle = getColor(colorIdx, opacityVal);
          ctx.shadowColor = getColor(colorIdx, opacityVal);
          ctx.beginPath();
          ctx.rect(-rad * 0.5, -rad * 0.5, rad, rad);
          ctx.stroke();
          ctx.restore();
        };

        drawSquare(0, 0);
        drawSquare(Math.PI / 4, 80);

        ctx.strokeStyle = getColor(160, opacityVal);
        ctx.shadowColor = getColor(160, opacityVal);
        ctx.beginPath();
        ctx.arc(0, 0, rad * 0.3, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
    };
  }, [activeShape, isPlaying]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />;
};

// ── constants ────────────────────────────────────────────────────
const LANE_COUNT = 3;

// Approach time scales with difficulty: Level 1 = 2.5 s (easy), Level 10 = 1.35 s (brutal)
function approachTime(diffLevel: number): number {
  return Math.max(1.35, 2.5 - (diffLevel - 1) * 0.128);
}
const HIT_RATIO = 0.7;

// Hit windows scale with difficulty — easier = more forgiving
function perfectPlusWindow(diff: number): number {
  // Level 1: 0.060s, Level 10: 0.030s
  return Math.max(0.030, 0.060 - (diff - 1) * 0.0033);
}
function perfectWindow(diff: number): number {
  // Level 1: 0.110s, Level 10: 0.055s
  return Math.max(0.055, 0.110 - (diff - 1) * 0.0061);
}
function goodWindow(diff: number): number {
  // Level 1: 0.190s, Level 10: 0.100s
  return Math.max(0.100, 0.190 - (diff - 1) * 0.010);
}
function missWindow(diff: number): number {
  // Level 1: 0.360s, Level 10: 0.190s
  return Math.max(0.190, 0.360 - (diff - 1) * 0.019);
}

function getDifficultyLaneColor(baseColor: string, _diffLevel: number, laneIndex?: number): string {
  try {
    const pathParts = window.location.pathname.split('/');
    const songId = pathParts[pathParts.length - 1];
    if (songId) {
      const activeMod = sessionStorage.getItem(`active_modifier_type_${songId}`);
      if (activeMod === 'bass_realm' && laneIndex === 0) {
        return "#a855f7"; // Glowing neon purple
      }
    }
  } catch (e) {
    // Fail silently
  }
  return baseColor;
}

// Perspective highway geometry
const HW_TOP = 0.54;
const HW_BOT = 0.97;

const POWER_UPS = [
  {
    threshold: 20,
    type: "FEVER",
    duration: 9,
    multiplier: 2,
    color: "#E5B800",
    label: "FEVER",
  },
  {
    threshold: 40,
    type: "SURGE",
    duration: 11,
    multiplier: 3,
    color: "#FF1493",
    label: "SURGE",
  },
  {
    threshold: 60,
    type: "SIGNAL_LOCK",
    duration: 14,
    multiplier: 4,
    color: "#39FF14",
    label: "SIGNAL LOCK",
  },
] as const;
type PUType = (typeof POWER_UPS)[number]["type"];

// ── helpers ──────────────────────────────────────────────────────
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

function hwAtProgress(p: number, W: number) {
  const w = W * lerp(HW_TOP, HW_BOT, p);
  const l = (W - w) / 2;
  return { left: l, right: l + w, width: w };
}
function laneAt(lane: number, progress: number, W: number) {
  const { left, width } = hwAtProgress(progress, W);
  const lw = width / LANE_COUNT;
  return { x: left + lane * lw, w: lw };
}

function prerenderStaticTrack(
  W: number,
  H: number,
  dpr: number,
  difficultyLevel: number,
  laneColors: [string, string, string]
): HTMLCanvasElement {
  const off = document.createElement("canvas");
  off.width = W * dpr;
  off.height = H * dpr;
  const ctx = off.getContext("2d");
  if (!ctx) return off;

  ctx.scale(dpr, dpr);

  const hitY = H * HIT_RATIO;
  const hwTop = hwAtProgress(0, W);
  const hwBot = hwAtProgress(1, W);

  const hillCx = W / 2;
  const hillCy = -hitY * 0.09;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(hwTop.left, 0);
  ctx.quadraticCurveTo(hillCx, hillCy, hwTop.right, 0);
  ctx.lineTo(hwBot.right, hitY);
  ctx.lineTo(hwBot.left, hitY);
  ctx.closePath();
  ctx.clip();

  // Track surface: deep gradient for depth
  const trackGrad = ctx.createLinearGradient(0, 0, 0, hitY);
  trackGrad.addColorStop(0, "#08081a");
  trackGrad.addColorStop(0.35, "#0c0c22");
  trackGrad.addColorStop(0.7, "#10102a");
  trackGrad.addColorStop(1, "#141430");
  ctx.fillStyle = trackGrad;
  ctx.fillRect(0, 0, W, hitY);

  // Per-lane colored tint (very subtle accent under each lane)
  for (let i = 0; i < LANE_COUNT; i++) {
    const { x: lx0, w: lw0 } = laneAt(i, 0.3, W);
    const { x: lx1, w: lw1 } = laneAt(i, 1, W);
    const lc = getDifficultyLaneColor(laneColors[i], difficultyLevel, i);
    const lcR = parseInt(lc.slice(1, 3), 16);
    const lcG = parseInt(lc.slice(3, 5), 16);
    const lcB = parseInt(lc.slice(5, 7), 16);
    const laneGrad = ctx.createLinearGradient(0, 0, 0, hitY);
    laneGrad.addColorStop(0, "transparent");
    laneGrad.addColorStop(0.6, `rgba(${lcR},${lcG},${lcB},0.03)`);
    laneGrad.addColorStop(1, `rgba(${lcR},${lcG},${lcB},0.07)`);
    ctx.fillStyle = laneGrad;
    ctx.beginPath();
    ctx.moveTo(lx0, hitY * 0.3);
    ctx.lineTo(lx0 + lw0, hitY * 0.3);
    ctx.lineTo(lx1 + lw1, hitY);
    ctx.lineTo(lx1, hitY);
    ctx.closePath();
    ctx.fill();
  }

  // Subtle perspective horizontal grid lines
  for (let row = 0; row <= 16; row++) {
    const ry = (row / 16) * hitY;
    const rp = ry / hitY;
    const { left, right } = hwAtProgress(rp, W);
    ctx.strokeStyle = `rgba(255,248,235,${0.01 + rp * 0.025})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(left, ry);
    ctx.lineTo(right, ry);
    ctx.stroke();
  }

  // Lane groove dividers — double-line with glow
  for (let l = 1; l < LANE_COUNT; l++) {
    const topPos = laneAt(l, 0, W);
    const botPos = laneAt(l, 1, W);
    // Dark groove
    ctx.strokeStyle = "rgba(0,0,0,0.85)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(topPos.x, 0);
    ctx.lineTo(botPos.x, hitY);
    ctx.stroke();
    // Subtle glow line
    const divGrad = ctx.createLinearGradient(0, 0, 0, hitY);
    divGrad.addColorStop(0, "rgba(255,255,255,0.0)");
    divGrad.addColorStop(0.5, "rgba(255,255,255,0.08)");
    divGrad.addColorStop(1, "rgba(255,255,255,0.14)");
    ctx.strokeStyle = divGrad;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(topPos.x + 1.5, 0);
    ctx.lineTo(botPos.x + 1.5, hitY);
    ctx.stroke();
  }

  ctx.restore();
  return off;
}

function getAccuracy(pp: number, p: number, g: number, m: number) {
  const tot = pp + p + g + m;
  return tot > 0 ? Math.round(((pp + p * 0.9 + g * 0.5) / tot) * 100) : 0;
}
function getMedal(pp: number, p: number, g: number, m: number) {
  const a = getAccuracy(pp, p, g, m);
  return a >= 93
    ? "PLATINUM"
    : a >= 80
      ? "GOLD"
      : a >= 60
        ? "SILVER"
        : a >= 40
          ? "BRONZE"
          : "NONE";
}

// ── rewind sound (Sample based) ──────────────────────────
function playRewindSound() {
  audioManager.playSfx("rewind", 0.8);
}

// ── interfaces ───────────────────────────────────────────────────
interface NoteState {
  note: Note;
  hit: boolean;
  missed: boolean;
  holdActive: boolean;
  holdProgress: number;
  currentLane: number; // For slide notes: tracking which lane the player is currently holding
  originLane: number;  // The lane that started this hold interaction
  visualLane: number;  // For slide notes: tracking smoothly animated visual lane position
  autoplayedBySurge?: boolean;
  touchId?: number;    // Associates this hold note with the active touch event tracking it
}
interface LanePress {
  pressed: boolean;
  touchId?: number;
  isArrow?: string | null;
}
interface PUState {
  active: PUType | null;
  endTime: number;
  startTime: number;
  multiplier: number;
  color: string;
  label: string;
  duration: number;
  triggered: Set<number>;
}
interface HitParticle {
  vx: number;
  vy: number;
  size: number;
  isSwipeLine?: boolean;
}
interface HitEffect {
  lane: number;
  startMs: number;
  cx: number;
  cy: number;
  color: string;
  kind: "PERFECT+" | "PERFECT" | "GOOD" | "SHIELDED";
  particles: HitParticle[];
}
interface AmbientParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
}

// ── component ────────────────────────────────────────────────────
// ── animated score counter ────────────────────────────────────────
function useAnimatedCount(target: number) {
  const [val, setVal] = useState(0);
  const frameRef = useRef(0);
  const baseRef = useRef({ from: 0, to: 0, t0: 0 });
  useEffect(() => {
    cancelAnimationFrame(frameRef.current);
    const from = baseRef.current.to ?? val;
    baseRef.current = { from, to: target, t0: performance.now() };
    const dur = Math.min(250, Math.max(60, Math.abs(target - from) * 0.08));
    const tick = () => {
      const { from, to, t0 } = baseRef.current;
      const pct = Math.min(1, (performance.now() - t0) / dur);
      const ease = 1 - (1 - pct) ** 3;
      setVal(Math.round(from + (to - from) * ease));
      if (pct < 1) frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target]);
  return val;
}

// ── procedural chart generator for empty beatmaps ────────────────
interface Stage {
  stage: number;
  name: string;
  startTime: number;
  endTime: number;
  difficulty: string;
  noteCount: number;
}

function stageifyNotes(notes: Note[], duration: number, bpm: number): { notes: Note[], stages: Stage[] } {
  const beatDuration = 60 / bpm;
  const stageBounds = [
    { stage: 1, name: "Stage 1", startTime: 0, endTime: duration * 0.20, difficulty: "Very Easy", noteCount: 0 },
    { stage: 2, name: "Stage 2", startTime: duration * 0.20, endTime: duration * 0.40, difficulty: "Easy", noteCount: 0 },
    { stage: 3, name: "Stage 3", startTime: duration * 0.40, endTime: duration * 0.65, difficulty: "Medium", noteCount: 0 },
    { stage: 4, name: "Stage 4", startTime: duration * 0.65, endTime: duration * 0.80, difficulty: "Hard", noteCount: 0 },
    { stage: 5, name: "Stage 5", startTime: duration * 0.80, endTime: duration, difficulty: "Expert", noteCount: 0 }
  ];

  const boundaries = [
    duration * 0.20,
    duration * 0.40,
    duration * 0.65,
    duration * 0.80
  ];

  const processed: Note[] = [];

  notes.forEach(note => {
    const isInTransitionGap = boundaries.some(b => note.time >= b + 1.2 && note.time <= b + 4.2);
    if (isInTransitionGap) {
      return;
    }

    let stage = 5;
    for (let i = 0; i < stageBounds.length; i++) {
      if (note.time >= stageBounds[i].startTime && note.time < stageBounds[i].endTime) {
        stage = stageBounds[i].stage;
        break;
      }
    }

    const clone: Note = { ...note, stage };

    if (stage === 1) {
      clone.type = 'tap';
      delete clone.holdDuration;
      delete clone.targetLane;
      delete clone.swipeDirection;
      const lastNote = processed.filter(n => n.stage === 1).pop();
      if (lastNote && clone.time - lastNote.time < beatDuration * 0.85) {
        return;
      }
    } else if (stage === 2) {
      if (clone.type === 'swipe') {
        clone.type = 'tap';
        delete clone.swipeDirection;
      }
      const lastNote = processed.filter(n => n.stage === 2).pop();
      if (lastNote && clone.time - lastNote.time < beatDuration * 0.45) {
        return;
      }
    } else if (stage === 3) {
      const lastNote = processed.filter(n => n.stage === 3).pop();
      if (lastNote && clone.time - lastNote.time < beatDuration * 0.22) {
        return;
      }
    } else if (stage === 4) {
      const lastNote = processed.filter(n => n.stage === 4).pop();
      if (lastNote && clone.time - lastNote.time < beatDuration * 0.15) {
        return;
      }
    } else if (stage === 5) {
      const lastNote = processed.filter(n => n.stage === 5).pop();
      if (lastNote && clone.time - lastNote.time < beatDuration * 0.08) {
        return;
      }
    }

    if (stage <= 3) {
      const duplicateTime = processed.some(n => Math.abs(n.time - clone.time) < 0.02);
      if (duplicateTime) {
        return;
      }
    }

    processed.push(clone);
  });

  const finalNotes = processed.map((note, index) => ({
    ...note,
    id: index
  }));

  const stagesWithCounts = stageBounds.map(sb => {
    const noteCount = finalNotes.filter(n => n.stage === sb.stage).length;
    return {
      ...sb,
      noteCount
    };
  });

  return { notes: finalNotes, stages: stagesWithCounts };
}

function generateProceduralChart(song: any): Note[] {
  const bpm = song.bpm || 120;
  const beatDuration = 60 / bpm;
  const duration = song.duration || 180;
  const difficulty = song.difficultyLevel || 5;

  const notes: Note[] = [];
  let time = 3.5; // Start notes after 3.5 seconds to let the player prepare
  let id = 0;
  let lastLane = 1;

  // Density factor based on difficulty level (1 to 10)
  let stepMultiplier = 4; // default to every 4 beats
  if (difficulty >= 10) stepMultiplier = 0.5; // Every half-beat (extremely dense!)
  else if (difficulty >= 8) stepMultiplier = 1;  // Every beat
  else if (difficulty >= 5) stepMultiplier = 2;  // Every 2 beats
  else if (difficulty >= 3) stepMultiplier = 3;  // Every 3 beats
  
  // Section ranges
  const introEnd = 15;
  const bridgeStart = duration * 0.65;
  const bridgeEnd = duration * 0.8;

  while (time < duration - 4) {
    // Determine dynamic step multiplier based on song section
    let currentMultiplier = stepMultiplier;
    let isChorus = time > 30 && time < bridgeStart && (Math.floor(time / 20) % 2 === 0);

    if (time < introEnd) {
      currentMultiplier = Math.max(4, stepMultiplier * 2); // Slow start
    } else if (time >= bridgeStart && time < bridgeEnd) {
      currentMultiplier = Math.max(4, stepMultiplier * 1.5); // Breather bridge
    } else if (isChorus) {
      currentMultiplier = Math.max(0.5, stepMultiplier * 0.5); // Intense chorus drops
    }

    // Determine target lanes to alternate cleanly and avoid bad patterns
    let lanesToPick = [0, 1, 2].filter(l => l !== lastLane);
    let nextLane = lanesToPick[Math.floor((time * 7 + id) % lanesToPick.length)];
    lastLane = nextLane;

    // Roll note types based on difficulty and time section
    let noteType: 'tap' | 'hold' = 'tap';
    let holdDuration: number | undefined;
    let targetLane: number | undefined;
    let swipeDirection: 'up' | 'down' | 'left' | 'right' | undefined;

    const roll = (time * 13 + id * 7) % 100;
    
    // Tap is standard. Holds/Slides appear at medium/high difficulties
    if (difficulty >= 3 && roll < 30) {
      noteType = 'hold';
      holdDuration = beatDuration * (1.5 + (id % 3));
      
      const slideRoll = (id * 17) % 100;
      if (difficulty >= 5 && slideRoll < 50) {
        // Slide note: switches lanes, no swipe
        targetLane = (nextLane + 1 + (id % 2)) % 3;
      } else {
        // Hold note: same lane, ends/transitions with a swipe
        const dirs: ('up' | 'down' | 'left' | 'right')[] = ['up', 'down', 'left', 'right'];
        swipeDirection = dirs[id % 4];
      }
    }

    notes.push({
      id: id++,
      time: parseFloat(time.toFixed(3)),
      lane: nextLane,
      type: noteType,
      holdDuration: holdDuration ? parseFloat(holdDuration.toFixed(3)) : undefined,
      targetLane,
      swipeDirection
    });

    // Check for double notes (dual inputs) on medium-hard difficulties (difficulty >= 4)
    const canSpawnDual = difficulty >= 4 && noteType !== 'hold';
    if (canSpawnDual) {
      const dualRoll = (time * 17 + id * 3) % 100;
      const dualChance = difficulty >= 7 ? 22 : 12;
      
      if (dualRoll < dualChance) {
        const otherLane = (nextLane + 1 + (id % 2)) % 3;
        
        let secondType: 'tap' | 'hold' = 'tap';
        let secondHoldDuration: number | undefined;
        let secondSwipeDir: 'up' | 'down' | 'left' | 'right' | undefined;
        
        const typeRoll = (id * 11 + Math.floor(time)) % 100;
        if (difficulty >= 6 && typeRoll < 30) {
          secondType = 'hold';
          secondHoldDuration = beatDuration * 1.5;
          const dirs: ('up' | 'down' | 'left' | 'right')[] = ['up', 'down', 'left', 'right'];
          secondSwipeDir = dirs[(id + 2) % 4];
        }
        
        notes.push({
          id: 20000 + id++,
          time: parseFloat(time.toFixed(3)),
          lane: otherLane,
          type: secondType,
          holdDuration: secondHoldDuration ? parseFloat(secondHoldDuration.toFixed(3)) : undefined,
          swipeDirection: secondSwipeDir
        });
      }
    }

    // Advance time by the current beat step duration
    const stepTime = beatDuration * currentMultiplier;
    
    if (noteType === 'hold' && holdDuration) {
      time += holdDuration + beatDuration * 1.5;
    } else {
      time += stepTime;
    }
  }

  const stageified = stageifyNotes(notes, duration, bpm);
  song.stages = stageified.stages;
  console.log(`[Procedural Generator] Generated chart for ${song.title}: ${stageified.notes.length} notes (stages applied), difficulty ${difficulty}`);
  return stageified.notes;
}

// ── Audio Forge: Transient Onset Beatmap Generator ───────────────
async function generateAudioForgeChart(song: any): Promise<Note[]> {
  const audioUrl = song.audioUrl;
  if (!audioUrl) {
    throw new Error("No audioUrl found for song");
  }

  const bpm = song.bpm || 120;
  const beatDuration = 60 / bpm;
  const duration = Math.min(180, song.duration || 120);
  const difficulty = song.difficultyLevel || 5;

  console.log(`[Audio Forge] Running transient onset analysis on: ${audioUrl}`);
  
  const response = await fetch(audioUrl);
  if (!response.ok) {
    throw new Error(`Fetch failed with status ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();

  const sampleRate = 22050;
  const offlineCtx = new (window.OfflineAudioContext || (window as any).webkitOfflineAudioContext)(
    1,
    Math.floor(sampleRate * duration),
    sampleRate
  );

  const audioBuffer = await offlineCtx.decodeAudioData(arrayBuffer);
  const channelData = audioBuffer.getChannelData(0);
  const totalSamples = channelData.length;

  const blockSize = 512;
  const movingAvgWindow = 43;
  const blockEnergies: number[] = [];
  const noteTimes: number[] = [];

  for (let i = 0; i < totalSamples; i += blockSize) {
    let sum = 0;
    const end = Math.min(totalSamples, i + blockSize);
    for (let j = i; j < end; j++) {
      sum += channelData[j] * channelData[j];
    }
    const rms = Math.sqrt(sum / (end - i));
    blockEnergies.push(rms);
  }

  const thresholdRatio = 1.35 - (difficulty * 0.035);
  const minCooldown = Math.max(0.12, 0.45 - (difficulty * 0.035));
  let lastNoteTime = 0;

  for (let b = movingAvgWindow; b < blockEnergies.length; b++) {
    const instantEnergy = blockEnergies[b];

    let windowSum = 0;
    for (let w = b - movingAvgWindow; w < b; w++) {
      windowSum += blockEnergies[w];
    }
    const localAvgEnergy = windowSum / movingAvgWindow;
    const blockTime = (b * blockSize) / sampleRate;

    if (instantEnergy > localAvgEnergy * thresholdRatio && instantEnergy > 0.015) {
      if (blockTime - lastNoteTime >= minCooldown && blockTime >= 3.0 && blockTime < duration - 4) {
        noteTimes.push(blockTime);
        lastNoteTime = blockTime;
      }
    }
  }

  const notes: Note[] = [];
  let lastLane = 1;
  let secondLastLane = 0;

  noteTimes.forEach((time, index) => {
    const availableLanes = [0, 1, 2].filter(l => l !== lastLane && l !== secondLastLane);
    const lane = availableLanes[Math.floor((time * 17) % availableLanes.length)];
    secondLastLane = lastLane;
    lastLane = lane;

    let noteType: 'tap' | 'hold' = 'tap';
    let holdDuration: number | undefined;
    let targetLane: number | undefined;
    let swipeDirection: 'up' | 'down' | 'left' | 'right' | undefined;

    const blockIndex = Math.floor((time * sampleRate) / blockSize);
    const energy = blockEnergies[blockIndex] || 0;

    if (difficulty >= 3 && energy > 0.12 && index % 4 === 1) {
      noteType = 'hold';
      holdDuration = beatDuration * (1.5 + (index % 2));
      
      const slideRoll = (index * 19) % 100;
      if (difficulty >= 5 && slideRoll < 50) {
        // Slide: switches lanes, no swipe
        targetLane = (lane + 1 + (index % 2)) % 3;
      } else {
        // Hold: same lane, ends/transitions with swipe
        const dirs: ('up' | 'down' | 'left' | 'right')[] = ['up', 'down', 'left', 'right'];
        swipeDirection = dirs[(index + Math.round(time)) % dirs.length];
      }
    }

    notes.push({
      id: index,
      time: parseFloat(time.toFixed(3)),
      lane,
      type: noteType,
      holdDuration: holdDuration ? parseFloat(holdDuration.toFixed(3)) : undefined,
      targetLane,
      swipeDirection
    });

    // Check for double notes (dual inputs) on medium-hard difficulties (difficulty >= 4)
    const canSpawnDual = difficulty >= 4 && noteType !== 'hold';
    if (canSpawnDual) {
      const dualRoll = (time * 23 + index * 3) % 100;
      const dualChance = difficulty >= 7 ? 25 : 12;
      
      if (dualRoll < dualChance && energy > 0.12) {
        const otherLane = (lane + 1 + (index % 2)) % 3;
        
        let secondType: 'tap' | 'hold' = 'tap';
        let secondHoldDuration: number | undefined;
        let secondSwipeDir: 'up' | 'down' | 'left' | 'right' | undefined;
        
        const typeRoll = (index * 13 + Math.floor(time)) % 100;
        if (difficulty >= 6 && typeRoll < 30) {
          secondType = 'hold';
          secondHoldDuration = beatDuration * 1.5;
          const dirs: ('up' | 'down' | 'left' | 'right')[] = ['up', 'down', 'left', 'right'];
          secondSwipeDir = dirs[(index + 2) % 4];
        }
        
        notes.push({
          id: 30000 + index,
          time: parseFloat(time.toFixed(3)),
          lane: otherLane,
          type: secondType,
          holdDuration: secondHoldDuration ? parseFloat(secondHoldDuration.toFixed(3)) : undefined,
          swipeDirection: secondSwipeDir
        });
      }
    }
  });

  if (notes.length < 10) {
    console.warn(`[Audio Forge] Only detected ${notes.length} peaks. Falling back to math generation.`);
    return generateProceduralChart(song);
  }

  const stageified = stageifyNotes(notes, duration, bpm);
  song.stages = stageified.stages;
  console.log(`[Audio Forge] Success! Analyzed ${duration}s audio and forged ${stageified.notes.length} notes (stages applied).`);
  return stageified.notes;
}

// ── game options (shared with /options page via @/lib/options) ────

export default function Game() {
  const { songId } = useParams<{ songId: string }>();
  const [, setLocation] = useLocation();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const noteTrailsRef = useRef<{ id: string; x: number; y: number; color: string; size: number; alpha: number; birthTime: number }[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioObjectUrlRef = useRef<string | null>(null);
  const audioOffsetRef = useRef(0);
  const laneColorsRef = useRef<[string, string, string]>(["#FF1493", "#00E5FF", "#39FF14"]);
  const laneKeysRef = useRef<[string, string, string]>(["a", "s", "d"]);
  const rafRef = useRef<number>(0);
  const notesRef = useRef<NoteState[]>([]);
  const laneRef = useRef<LanePress[]>([
    { pressed: false, isArrow: null },
    { pressed: false, isArrow: null },
    { pressed: false, isArrow: null },
  ]);
  const gsRef = useRef<GameState>({
    score: 0,
    combo: 0,
    maxCombo: 0,
    perfectPlus: 0,
    perfects: 0,
    goods: 0,
    misses: 0,
    progress: 0,
  });
  const jRef = useRef<JudgmentDisplay[]>([]);
  const jCounter = useRef(0);
  const songRef = useRef<GameSong | null>(null);
  const modifierRef = useRef<'vocal_isolation' | 'bass_realm' | 'corrupted_signal' | 'none'>('none');
  const [activeModifier, setActiveModifier] = useState<'vocal_isolation' | 'bass_realm' | 'corrupted_signal' | 'none'>('none');
  const phaseRef = useRef<
    | "loading"
    | "buffering"
    | "countdown"
    | "playing"
    | "finished"
    | "continue"
    | "rewinding"
    | "audioError"
    | "loadError"
    | "unmounted"
  >("loading");
  const puRef = useRef<PUState>({
    active: null,
    endTime: 0,
    startTime: 0,
    multiplier: 1,
    color: "#fff",
    label: "",
    duration: 0,
    triggered: new Set(),
  });
  const hitFxRef = useRef<HitEffect[]>([]);
  const shieldChargesRef = useRef<number>(0);
  const lastMissTimeRef = useRef<number>(0);
  const lastMissLaneTimeRef = useRef<number[]>([0, 0, 0]);
  
  // Visual polish tracking refs
  interface MilestoneEffect {
    combo: number;
    startMs: number;
    color: string;
  }
  const lastTapTimeRef = useRef<number[]>([0, 0, 0]);
  const lastMilestoneRef = useRef<number>(0);
  const milestoneFxRef = useRef<MilestoneEffect[]>([]);

  const continueUsedRef = useRef<number>(0); // how many continues the player has used (max 3)
  const coverImgRef = useRef<HTMLImageElement | null>(null);
  const coverBlurRef = useRef<HTMLCanvasElement | null>(null);
  const scanPatternRef = useRef<CanvasPattern | null>(null);
  const lastMedalRef = useRef<string>("NONE");
  const ambientParticlesRef = useRef<AmbientParticle[]>([]);
  const lastFrameTimeRef = useRef<number>(performance.now());
  const medalStampRef = useRef<{ medal: string; startT: number } | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gameplayAnalyserRef = useRef<AnalyserNode | null>(null);
  const gameplayAnalyserDataRef = useRef<Uint8Array | null>(null);
  const gameplaySlideshowFloatersRef = useRef<any[]>([]);
  const audioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const audioFiltersRef = useRef<BiquadFilterNode[]>([]);
  const laneGainsRef = useRef<GainNode[]>([]);
  const laneSilenced = useRef<boolean[]>([false, false, false]);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const laneRestoreTimers = useRef<ReturnType<typeof setTimeout>[]>(
    [] as ReturnType<typeof setTimeout>[],
  );
  const missCountRef = useRef(0); // misses accumulated this attempt (triggers continue at 3)
  const rewindToRef = useRef(0);
  const rewindAnimRef = useRef<{ wallStart: number; fromT: number; toT: number } | null>(null);
  const drawRef = useRef<(() => void) | null>(null);
  const continueTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishGameTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abandonTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const isTutorialRef = useRef(new URLSearchParams(window.location.search).get("tutorial") === "true");
  const isTutorial = isTutorialRef.current;
  const isTutorialCompleted = localStorage.getItem("pim_tutorial_completed") === "true" || useVaultStore.getState().progression.tutorialCompleted;
  const activeTutorial = isTutorial && !isTutorialCompleted;
  const [isTutorialHelpOpen, setIsTutorialHelpOpen] = useState(false);
  const isTutorialHelpOpenRef = useRef(false);

  const [retryCount, setRetryCount] = useState(0);
  const [phase, setPhase] = useState<typeof phaseRef.current>("loading");
  const [countdown, setCountdown] = useState(3);
  const [displayGs, setDisplayGs] = useState<GameState>(gsRef.current);
  const [displayJudge, setDisplayJudge] = useState<JudgmentDisplay[]>([]);
  const [bufferPct, setBufferPct] = useState(0);
  const [loadMsg, setLoadMsg] = useState("FETCHING TRANSMISSION...");
  const [currentStage, setCurrentStage] = useState(1);
  const [stageStingerNumber, setStageStingerNumber] = useState<number | null>(null);
  const [stageStingerPhase, setStageStingerPhase] = useState<'cleared' | 'start'>('cleared');
  const lastDetectedStageRef = useRef(1);
  const stingerTimeout1Ref = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stingerTimeout2Ref = useRef<ReturnType<typeof setTimeout> | null>(null);
  const puPanelRef = useRef<HTMLDivElement | null>(null);
  const puTextRef = useRef<HTMLDivElement | null>(null);
  const puBarRef = useRef<HTMLDivElement | null>(null);
  const gamepadRafRef = useRef<number | null>(null);
  const resolvePendingPromiseRef = useRef<(() => void) | null>(null);
  const usePointerEventsRef = useRef(false);

  const prevPuStateRef = useRef<{
    label: string;
    color: string;
    multiplier: number;
    progress: number;
    visible: boolean;
  }>({
    label: "",
    color: "",
    multiplier: 0,
    progress: -1,
    visible: false,
  });

  const updatePuDisplayDOM = useCallback((
    displayData: {
      label: string;
      color: string;
      multiplier: number;
      progress: number;
    } | null
  ) => {
    const panel = puPanelRef.current;
    const textEl = puTextRef.current;
    const barEl = puBarRef.current;
    if (!panel) return;

    const prev = prevPuStateRef.current;

    if (!displayData) {
      if (prev.visible) {
        panel.style.display = "none";
        prev.visible = false;
      }
      return;
    }

    if (!prev.visible) {
      panel.style.display = "flex";
      prev.visible = true;
    }

    const labelChanged = prev.label !== displayData.label || prev.multiplier !== displayData.multiplier;
    const colorChanged = prev.color !== displayData.color;
    const progressChanged = Math.abs(prev.progress - displayData.progress) > 0.005;

    if (labelChanged || colorChanged) {
      if (textEl) {
        if (labelChanged) {
          textEl.innerText = `${displayData.label} ×${displayData.multiplier}`;
          prev.label = displayData.label;
          prev.multiplier = displayData.multiplier;
        }
        if (colorChanged) {
          textEl.style.color = displayData.color;
          textEl.style.border = `2px solid ${displayData.color}`;
          textEl.style.background = `${displayData.color}18`;
          textEl.style.textShadow = `0 0 20px ${displayData.color}`;
          textEl.style.boxShadow = `0 0 30px ${displayData.color}40`;
        }
      }
    }

    if (progressChanged || colorChanged) {
      if (barEl) {
        if (progressChanged) {
          barEl.style.width = `${displayData.progress * 100}%`;
          prev.progress = displayData.progress;
        }
        if (colorChanged) {
          barEl.style.background = displayData.color;
        }
      }
    }

    if (colorChanged) {
      prev.color = displayData.color;
    }
  }, []);

  const resetPuDisplayDOM = useCallback(() => {
    prevPuStateRef.current = {
      label: "",
      color: "",
      multiplier: 0,
      progress: -1,
      visible: false,
    };
    updatePuDisplayDOM(null);
  }, [updatePuDisplayDOM]);
  const [missCount, setMissCount] = useState(0);
  const [continueCountdown, setContinueCountdown] = useState(10);
  const [opts, setOpts] = useState<GameOpts>(loadOpts);
  const optsRef = useRef(opts);
  useEffect(() => { optsRef.current = opts; }, [opts]);

  // Load and segment slideshow images for track customization
  useEffect(() => {
    if (opts.gameTrack !== 'slideshow') return;

    let active = true;

    const fetchAndSegment = async () => {
      try {
        let imageUrls = ['/data/slideshow/cyber_dancer.jpg', '/data/slideshow/cyber_headphones.jpg'];
        try {
          const res = await fetch('http://localhost:3002/api/slideshow-images')
            .catch(() => fetch('/api/slideshow-images'))
            .catch(() => null);
          if (res && res.ok) {
            const files = await res.json();
            if (files && files.length > 0) {
              imageUrls = files;
            }
          }
        } catch (e) {
          console.warn('[GamePlay Slideshow] API offline, using fallback assets');
        }

        const floaters: any[] = [];
        const colors = ['#00F0FF', '#39FF14', '#FF1493', '#FFD700', '#FF5500'];

        for (let idx = 0; idx < imageUrls.length; idx++) {
          const url = imageUrls[idx];
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = url;

          await new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve(); // skip on error
          });

          if (!active) return;
          if (img.naturalWidth === 0) continue;

          // Run contour scan
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = Math.min(img.naturalWidth, 250); // shrink for gameplay speed
          tempCanvas.height = Math.min(img.naturalHeight, 200);
          const tCtx = tempCanvas.getContext('2d')!;
          tCtx.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height);

          const w = tempCanvas.width;
          const h = tempCanvas.height;
          const imgData = tCtx.getImageData(0, 0, w, h);
          const pixels = imgData.data;

          const segs = [
            { name: 'Core Shape', minL: 38, maxL: 200 },
            { name: 'Neon Detail', minL: 200, maxL: 255 }
          ];

          segs.forEach((seg, sIdx) => {
            const segCanvas = document.createElement('canvas');
            segCanvas.width = w;
            segCanvas.height = h;
            const sCtx = segCanvas.getContext('2d')!;
            sCtx.drawImage(img, 0, 0, w, h);
            const sData = sCtx.getImageData(0, 0, w, h);
            const sPixels = sData.data;

            let minX = w, maxX = 0, minY = h, maxY = 0;
            let found = false;

            for (let y = 0; y < h; y++) {
              for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                const r = sPixels[i];
                const g = sPixels[i + 1];
                const b = sPixels[i + 2];
                const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

                if (luminance >= seg.minL && luminance <= seg.maxL) {
                  found = true;
                  if (x < minX) minX = x;
                  if (x > maxX) maxX = x;
                  if (y < minY) minY = y;
                  if (y > maxY) maxY = y;
                } else {
                  sPixels[i + 3] = 0; // set transparent
                }
              }
            }

            if (found && maxX - minX > 20 && maxY - minY > 20) {
              const bw = maxX - minX;
              const bh = maxY - minY;

              const cropCanvas = document.createElement('canvas');
              cropCanvas.width = bw;
              cropCanvas.height = bh;
              const cropCtx = cropCanvas.getContext('2d')!;

              sCtx.putImageData(sData, 0, 0);
              cropCtx.drawImage(segCanvas, minX, minY, bw, bh, 0, 0, bw, bh);

              const angle = Math.random() * Math.PI * 2;
              const speed = 0.3 + Math.random() * 0.5;

              floaters.push({
                canvas: cropCanvas,
                className: seg.name,
                x: Math.random() * 200 - 100,
                y: Math.random() * 300 - 150,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                scale: 0.30 + Math.random() * 0.20, // smaller for track lanes
                rotation: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 0.012,
                glowColor: colors[(idx * 2 + sIdx) % colors.length],
                width: bw,
                height: bh
              });
            }
          });
        }

        if (active) {
          gameplaySlideshowFloatersRef.current = floaters;
        }
      } catch (e) {
        console.error('[GamePlay Slideshow Loader] Segmentation failed:', e);
      }
    };

    fetchAndSegment();

    return () => {
      active = false;
    };
  }, [opts.gameTrack]);
  // Keep mutable refs current every render so draw/handlers always see latest values
  // without needing to be listed as useCallback dependencies.
  audioOffsetRef.current = opts.audioOffset;
  laneColorsRef.current = opts.laneColors;
  laneKeysRef.current = opts.laneKeys;
  const [showOptions, setShowOptions] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [maxPossibleScore, setMaxPossibleScore] = useState(1);
  const triggeredThresholdsRef = useRef<{ [key: number]: boolean }>({ 50: false, 75: false, 90: false });
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  useEffect(() => {
    const handler = () => {
      setOpts(loadOpts());
    };
    window.addEventListener("cheat_code_activated", handler);
    return () => window.removeEventListener("cheat_code_activated", handler);
  }, []);

  // Sync opts state with useVaultStore settings changes
  const storeSettings = useVaultStore((state) => state.settings);
  useEffect(() => {
    if (storeSettings) {
      setOpts(loadOpts());
    }
  }, [storeSettings]);

  useLayoutEffect(() => {
    if (puPanelRef.current) {
      puPanelRef.current.style.display = "none";
    }
    if (puTextRef.current) {
      Object.assign(puTextRef.current.style, {
        color: "#E5B800",
        border: "2px solid #E5B800",
        background: "#E5B80018",
        textShadow: "0 0 20px #E5B800",
        boxShadow: "0 0 30px #E5B80040",
        clipPath: "polygon(8px 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%)",
      });
    }
    if (puBarRef.current) {
      Object.assign(puBarRef.current.style, {
        width: "0%",
        background: "#E5B800",
      });
    }
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  useEffect(() => {
    // Pre-load all gameplay-critical SFX for zero-latency playback
    audioManager.loadSfx("rewind");
    audioManager.loadSfx("gmeover");
    audioManager.loadSfx("outof_continues");
    audioManager.loadSfx("gameover_countdown");
    audioManager.loadSfx("hidden_secret_found");
    audioManager.loadSfx("song_completion");
    audioManager.loadSfx("select_start_song");
    audioManager.loadSfx("pause_2");
    audioManager.loadSfx("fusion");
  }, []);

  const syncDisplay = useCallback(() => {
    setDisplayGs({ ...gsRef.current });
    setDisplayJudge([...jRef.current]);
  }, []);
  // audioOffset (ms) compensates for speaker latency: subtract it so hits land in time
  // with what the player hears rather than what the audio clock reports.
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);

  const getT = useCallback(() => (audioRef.current?.currentTime ?? 0) - audioOffsetRef.current / 1000, []);

  const calcScore = useCallback(
    (combo: number, j: "PERFECT+" | "PERFECT" | "GOOD") => {
      const pu = puRef.current;
      const puMul = pu.active && getT() < pu.endTime ? pu.multiplier : 1;
      const diff = songRef.current?.difficultyLevel ?? 5;

      let comboMul = 1;
      if (diff <= 3) {
        // LIGHT (Level 1-3): Max 3x
        comboMul = combo < 10 ? 1 : combo < 25 ? 1.5 : combo < 50 ? 2 : 3;
      } else if (diff <= 6) {
        // DARK (Level 4-6): Max 4x
        comboMul = combo < 10 ? 1 : combo < 25 ? 1.5 : combo < 50 ? 2 : combo < 75 ? 3 : 4;
      } else {
        // VOID (Level 7-10): Max 5x
        comboMul = combo < 10 ? 1 : combo < 25 ? 1.5 : combo < 50 ? 2 : combo < 75 ? 3 : combo < 100 ? 4 : 5;
      }

      const base = j === "PERFECT+" ? 500 : j === "PERFECT" ? 300 : 150;
      return Math.round(base * puMul * comboMul);
    },
    [getT],
  );

  const checkPowerUps = useCallback(
    (combo: number) => {
      const pu = puRef.current;
      const t = getT();
      for (const pw of POWER_UPS) {
        if (combo >= pw.threshold && !pu.triggered.has(pw.threshold)) {
          pu.triggered.add(pw.threshold);
          const finalLabel = pw.type === "SIGNAL_LOCK" ? "SIGNAL LOCK (SHIELD x2)" : pw.label;
          Object.assign(pu, {
            active: pw.type,
            endTime: t + pw.duration,
            startTime: t,
            multiplier: pw.multiplier,
            color: pw.color,
            label: finalLabel,
            duration: pw.duration,
          });
          updatePuDisplayDOM({
            label: finalLabel,
            color: pw.color,
            multiplier: pw.multiplier,
            progress: 1,
          });
          const code = pw.type === "FEVER" ? 1 : pw.type === "SURGE" ? 2 : pw.type === "SIGNAL_LOCK" ? 3 : 0;
          gameSenseService.sendPowerup(code);
          if (pw.type === "SIGNAL_LOCK") {
            shieldChargesRef.current = 2;
            // Distinct stinger for the defensive shield power-up
            audioManager.playSfx("hidden_secret_found", 0.9);
            haptics.fusionSuccess();
          } else {
            // Energetic activation for FEVER / SURGE
            audioManager.playSfx("fusion", 0.75);
            haptics.heavyTap();
          }
          break;
        }
      }
    },
    [getT],
  );

  const triggerHitFx = useCallback(
    (lane: number, kind: "PERFECT+" | "PERFECT" | "GOOD" | "SHIELDED", customY?: number, swipeDir?: Note['swipeDirection']) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const W = canvas.width / dpr;
      const H = canvas.height / dpr;
      const hitY = H * HIT_RATIO;
      const { x: lx, w: lw } = laneAt(lane, 1, W);
      const cx = lx + lw / 2;
      const color =
        kind === "SHIELDED"
          ? "#00FFDD"
          : getDifficultyLaneColor(laneColorsRef.current[Math.max(0, Math.min(2, Math.round(lane)))] || "#00E5FF", songRef.current?.difficultyLevel ?? 5, Math.max(0, Math.min(2, Math.round(lane))));

      const count =
        kind === "SHIELDED"
          ? 20
          : kind === "PERFECT+"
            ? 18
            : kind === "PERFECT"
              ? 13
              : 9;

      let swipeAngle: number | null = null;
      if (swipeDir) {
        if (swipeDir === 'up') swipeAngle = -Math.PI / 2;
        else if (swipeDir === 'down') swipeAngle = Math.PI / 2;
        else if (swipeDir === 'left') swipeAngle = Math.PI;
        else if (swipeDir === 'right') swipeAngle = 0;
        else if (swipeDir === 'up-left') swipeAngle = -Math.PI * 0.75;
        else if (swipeDir === 'up-right') swipeAngle = -Math.PI * 0.25;
        else if (swipeDir === 'down-left') swipeAngle = Math.PI * 0.75;
        else if (swipeDir === 'down-right') swipeAngle = Math.PI * 0.25;
      }

      const particles: HitParticle[] = [];
      for (let i = 0; i < count; i++) {
        let angle: number;
        let speed: number;
        let isSwipeLine = false;

        if (swipeAngle !== null) {
          angle = swipeAngle + (Math.random() - 0.5) * 0.45;
          speed = 220 + Math.random() * 220;
          isSwipeLine = true;
        } else {
          angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * (kind === "SHIELDED" ? 0.4 : 0.6);
          speed = kind === "SHIELDED" ? 120 + Math.random() * 200 : 90 + Math.random() * 160;
        }

        particles.push({
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - (swipeAngle !== null ? 0 : (kind === "SHIELDED" ? 40 : 80)),
          size: (kind === "SHIELDED" ? 3 : 2.5) + Math.random() * 4.5,
          isSwipeLine,
        });
      }
      hitFxRef.current.push({
        lane,
        startMs: Date.now(),
        cx,
        cy: customY !== undefined ? customY : hitY,
        color,
        kind,
        particles,
      });
    },
    [],
  );

  const getTargetGainForLane = useCallback((lane: number) => {
    const mod = modifierRef.current;
    if (mod === 'vocal_isolation') {
      if (lane === 0) return 0.15;
      if (lane === 1) return 2.2;
      if (lane === 2) return 0.15;
    } else if (mod === 'bass_realm') {
      if (lane === 0) return 2.6;
      if (lane === 1) return 0.25;
      if (lane === 2) return 0.25;
    }
    return 1.0;
  }, []);

  const muteLane = useCallback((lane: number) => {
    const ctx = audioCtxRef.current;
    const gain = laneGainsRef.current[lane];
    if (!ctx || !gain || laneSilenced.current[lane]) return;
    laneSilenced.current[lane] = true;
    gain.gain.cancelScheduledValues(ctx.currentTime);
    gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 0.12);
    clearTimeout(laneRestoreTimers.current[lane]);
    laneRestoreTimers.current[lane] = setTimeout(() => {
      laneSilenced.current[lane] = false;
      const c = audioCtxRef.current;
      const g = laneGainsRef.current[lane];
      if (!c || !g) return;
      g.gain.cancelScheduledValues(c.currentTime);
      g.gain.setValueAtTime(g.gain.value, c.currentTime);
      g.gain.linearRampToValueAtTime(getTargetGainForLane(lane), c.currentTime + 0.4);
    }, 3500);
  }, [getTargetGainForLane]);

  const restoreLane = useCallback((lane: number) => {
    if (!laneSilenced.current[lane]) return;
    laneSilenced.current[lane] = false;
    clearTimeout(laneRestoreTimers.current[lane]);
    const ctx = audioCtxRef.current;
    const gain = laneGainsRef.current[lane];
    if (!ctx || !gain) return;
    gain.gain.cancelScheduledValues(ctx.currentTime);
    gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(getTargetGainForLane(lane), ctx.currentTime + 0.25);
  }, [getTargetGainForLane]);

  const hitLane = useCallback(
    (lane: number, direction?: Note['swipeDirection'], touchId?: number) => {
      if (phaseRef.current !== "playing") return;
      restoreLane(lane);
      const t = getT();
      const candidates = notesRef.current.filter(
        (ns) => ns.note.lane === lane && !ns.hit && !ns.missed,
      );
      if (!candidates.length) return;
      const ns = candidates.reduce((b, c) =>
        Math.abs(c.note.time - t) < Math.abs(b.note.time - t) ? c : b,
      );
      const diff = Math.abs(ns.note.time - t);
      const dl = songRef.current?.difficultyLevel ?? 5;
      if (diff > missWindow(dl)) return;

      // Swipe check
      if (ns.note.type === "swipe") {
        if (!direction || ns.note.swipeDirection !== direction) return;
      } else if (direction) {
        // If it's not a swipe note, but we got a swipe input, we still allow it as a tap
        // unless it's specifically a hold note start.
      }

      const isFever = puRef.current.active === "FEVER" && t < puRef.current.endTime;
      let j: "PERFECT+" | "PERFECT" | "GOOD" | null =
        diff <= perfectPlusWindow(dl)
          ? "PERFECT+"
          : diff <= perfectWindow(dl)
            ? "PERFECT"
            : diff <= goodWindow(dl)
              ? "GOOD"
              : null;
      if (j === "PERFECT" && isFever) {
        j = "PERFECT+";
      }
      if (!j) return;

      if (ns.note.type === "hold") {
        ns.holdActive = true;
        ns.currentLane = lane;
        ns.originLane = lane;
        ns.touchId = touchId;
      } else ns.hit = true;

      const gs = gsRef.current;
      gs.score += calcScore(gs.combo, j);
      gs.combo++;
      gs.maxCombo = Math.max(gs.maxCombo, gs.combo);
      gameSenseService.sendHit();
      gameSenseService.sendCombo(gs.combo);
      if (j === "PERFECT+") {
        gs.perfectPlus++;
        audioManager.playSfx("tap_nav", 0.15);
      }
      else if (j === "PERFECT") {
        gs.perfects++;
        audioManager.playSfx("tap_nav", 0.12);
      }
      else {
        gs.goods++;
        audioManager.playSfx("tap_nav", 0.1);
      }
      if (ns.note.type === "swipe") {
        haptics.doubleTap();
      } else {
        if (j === "PERFECT+") {
          haptics.mediumTap();
        } else {
          haptics.lightTap();
        }
      }
      checkPowerUps(gs.combo);

      jRef.current = [
        ...jRef.current.filter((x) => Date.now() - x.ts < 600),
        { type: j, lane, id: ++jCounter.current, ts: Date.now() },
      ];

      // ── Hit explosion effect ──
      triggerHitFx(lane, j, undefined, direction || ns.note.swipeDirection);

      syncDisplay();
    },
    [getT, calcScore, checkPowerUps, syncDisplay, restoreLane, triggerHitFx],
  );

  const completeHoldNote = useCallback(
    (ns: NoteState) => {
      const isSurge = puRef.current.active === "SURGE" && getT() < puRef.current.endTime;
      if (isSurge || ns.autoplayedBySurge) return;

      // If it requires a swipe-release, releasing it without swiping is a miss!
      if (ns.note.swipeDirection) {
        ns.holdActive = false;
        ns.missed = true;
        lastMissLaneTimeRef.current[ns.note.lane] = Date.now();
        const gsx = gsRef.current;
        gsx.combo = 0;
        gsx.misses++;
        puRef.current.active = null;
        puRef.current.endTime = 0;
        updatePuDisplayDOM(null);
        gameSenseService.sendPowerup(0);
        puRef.current.triggered.clear();
        haptics.error();

        jRef.current = [
          ...jRef.current.filter((x) => Date.now() - x.ts < 600),
          { type: "MISS", lane: ns.note.lane, id: ++jCounter.current, ts: Date.now() },
        ];
        const now = Date.now();
        if (now - lastMissTimeRef.current > 350) {
          missCountRef.current++;
          lastMissTimeRef.current = now;
        }
        setMissCount(missCountRef.current);
        if (triggerGameFail()) return;

        muteLane(ns.note.lane);
        syncDisplay();
        return;
      }

      // If it's a slide note, it must end in the targetLane
      if (ns.note.targetLane !== undefined && ns.currentLane !== ns.note.targetLane) {
        const isSignalLock = puRef.current.active === "SIGNAL_LOCK" && getT() < puRef.current.endTime && shieldChargesRef.current > 0;
        if (isSignalLock) {
          shieldChargesRef.current--;
          const activeLabel = `SIGNAL LOCK (SHIELD x${shieldChargesRef.current})`;
          puRef.current.label = activeLabel;
          updatePuDisplayDOM({
            label: activeLabel,
            color: puRef.current.color,
            multiplier: puRef.current.multiplier,
            progress: (puRef.current.endTime - getT()) / puRef.current.duration,
          });
          if (shieldChargesRef.current <= 0) {
            puRef.current.endTime = 0;
            puRef.current.active = null;
            updatePuDisplayDOM(null);
            gameSenseService.sendPowerup(0);
          }
          audioManager.playSfx("tap_nav", 0.35);
          triggerHitFx(ns.currentLane, "SHIELDED");

          // Treat as HIT with GOOD
          ns.hit = true;
          ns.holdActive = false;
          const gs = gsRef.current;
          gs.score += calcScore(gs.combo, "GOOD");
          gs.combo++;
          gs.maxCombo = Math.max(gs.maxCombo, gs.combo);
          gameSenseService.sendHit();
          gameSenseService.sendCombo(gs.combo);
          gs.goods++;
          checkPowerUps(gs.combo);
          jRef.current = [
            ...jRef.current.filter((x) => Date.now() - x.ts < 600),
            { type: "SHIELDED", lane: ns.currentLane, id: ++jCounter.current, ts: Date.now() },
          ];
          syncDisplay();
          return;
        } else {
          // Did not finish the slide
          ns.holdActive = false;
          ns.missed = true;
          lastMissLaneTimeRef.current[ns.note.lane] = Date.now();
          const gsx = gsRef.current;
          gsx.combo = 0;
          gsx.misses++;
          gameSenseService.sendMiss();
          gameSenseService.sendCombo(0);
          // Deactivate power up on combo break
          puRef.current.active = null;
          puRef.current.endTime = 0;
          updatePuDisplayDOM(null);
          gameSenseService.sendPowerup(0);
          puRef.current.triggered.clear();
          haptics.error();

          jRef.current = [
            ...jRef.current.filter((x) => Date.now() - x.ts < 600),
            { type: "MISS", lane: ns.note.lane, id: ++jCounter.current, ts: Date.now() },
          ];

          const now = Date.now();
          if (now - lastMissTimeRef.current > 350) {
            missCountRef.current++;
            lastMissTimeRef.current = now;
          }
          setMissCount(missCountRef.current);

          muteLane(ns.note.lane);
          syncDisplay();
          
          if (triggerGameFail()) return;
          return;
        }
      }

      if (ns.note.swipeDirection) {
        // Did not swipe! This is a miss!
        ns.holdActive = false;
        ns.missed = true;
        const gsx = gsRef.current;
        gsx.combo = 0;
        gsx.misses++;
        puRef.current.active = null;
        puRef.current.endTime = 0;
        updatePuDisplayDOM(null);
        gameSenseService.sendPowerup(0);
        puRef.current.triggered.clear();
        haptics.error();

        jRef.current = [
          ...jRef.current.filter((x) => Date.now() - x.ts < 600),
          { type: "MISS", lane: ns.note.lane, id: ++jCounter.current, ts: Date.now() },
        ];

        const now = Date.now();
        if (now - lastMissTimeRef.current > 350) {
          missCountRef.current++;
          lastMissTimeRef.current = now;
        }
        setMissCount(missCountRef.current);
        gameSenseService.sendMiss();
        gameSenseService.sendCombo(0);
        gameSenseService.sendHealth(3 - missCountRef.current);

        muteLane(ns.note.lane);
        syncDisplay();
        
        if (triggerGameFail()) return;
        return;
      }

      ns.hit = true;
      ns.holdActive = false;
      if (ns.holdProgress > 0.6) {
        const gs = gsRef.current;
        gs.score += calcScore(gs.combo, "PERFECT+");
        gs.combo++;
        gs.maxCombo = Math.max(gs.maxCombo, gs.combo);
        gameSenseService.sendHit();
        gameSenseService.sendCombo(gs.combo);
        gs.perfectPlus++;
        checkPowerUps(gs.combo);
        haptics.mediumTap();
        audioManager.playSfx("tap_nav", 0.15);

        // Calculate visual tail Y position (top) at release time to center the explosion
        const dpr = window.devicePixelRatio || 1;
        const H = (canvasRef.current?.height ?? 600) / dpr;
        const hitY = H * HIT_RATIO;
        const AT = approachTime(songRef.current?.difficultyLevel ?? 5);
        const spawnT = ns.note.time - AT;
        const prog = (getT() - spawnT) / AT;
        const holdDur = ns.note.holdDuration || 0.5;
        const headP = Math.max(0, prog - holdDur / AT);
        const headY = headP * hitY;
        const top = lerp(headY, hitY, ns.holdProgress);

        triggerHitFx(ns.currentLane, "PERFECT+", top);

        jRef.current = [
          ...jRef.current.filter((x) => Date.now() - x.ts < 600),
          { type: "PERFECT+", lane: ns.currentLane, id: ++jCounter.current, ts: Date.now() },
        ];
      }
      syncDisplay();
    },
    [getT, calcScore, checkPowerUps, syncDisplay, muteLane, triggerHitFx],
  );

  const releaseLane = useCallback(
    (lane: number) => {
      if (phaseRef.current !== "playing") return;
      const ns = notesRef.current.find(
        (n) =>
          n.note.type === "hold" &&
          n.holdActive &&
          n.currentLane === lane &&
          !n.hit,
      );
      if (!ns) return;
      completeHoldNote(ns);
    },
    [completeHoldNote],
  );

  const hitSwipeRelease = useCallback(
    (ns: NoteState, swipeDir: Note['swipeDirection']) => {
      ns.hit = true;
      ns.holdActive = false;
      const gs = gsRef.current;
      const t = getT();
      const dl = songRef.current?.difficultyLevel ?? 5;
      const diff = Math.abs((ns.note.time + (ns.note.holdDuration || 0.5)) - t);

      let j: "PERFECT+" | "PERFECT" | "GOOD" | null =
        diff <= perfectPlusWindow(dl)
          ? "PERFECT+"
          : diff <= perfectWindow(dl)
            ? "PERFECT"
            : diff <= goodWindow(dl)
              ? "GOOD"
              : null;
      if (!j) j = "GOOD"; // Fallback to GOOD inside miss window bounds

      gs.score += calcScore(gs.combo, j);
      gs.combo++;
      gs.maxCombo = Math.max(gs.maxCombo, gs.combo);
      gameSenseService.sendHit();
      gameSenseService.sendCombo(gs.combo);
      if (j === "PERFECT+") {
        gs.perfectPlus++;
        audioManager.playSfx("tap_nav", 0.15);
      } else if (j === "PERFECT") {
        gs.perfects++;
        audioManager.playSfx("tap_nav", 0.12);
      } else {
        gs.goods++;
        audioManager.playSfx("tap_nav", 0.1);
      }

      checkPowerUps(gs.combo);
      haptics.doubleTap();

      const dpr = window.devicePixelRatio || 1;
      const H = (canvasRef.current?.height ?? 600) / dpr;
      const hitY = H * HIT_RATIO;
      triggerHitFx(ns.currentLane, j, hitY, swipeDir);

      jRef.current = [
        ...jRef.current.filter((x) => Date.now() - x.ts < 600),
        { type: j, lane: ns.currentLane, id: ++jCounter.current, ts: Date.now() },
      ];
      syncDisplay();
    },
    [getT, calcScore, checkPowerUps, syncDisplay, triggerHitFx],
  );

  const moveHold = useCallback(
    (fromLane: number, toLane: number) => {
      if (phaseRef.current !== "playing") return;
      const ns = notesRef.current.find(
        (n) =>
          n.note.type === "hold" &&
          n.holdActive &&
          n.currentLane === fromLane &&
          !n.hit,
      );
      if (!ns) return;

      // Move the interaction to the new lane if it's a slide note
      if (ns.note.targetLane !== undefined) {
        const reachedTarget = toLane === ns.note.targetLane && ns.currentLane !== ns.note.targetLane;
        ns.currentLane = toLane;

        if (reachedTarget) {
          audioManager.playSfx("hidden_secret_found", 0.3);

          // ── Slide success particle effect ──
          const canvas = canvasRef.current;
          if (canvas) {
            const W = canvas.width;
            const H = canvas.height;
            const hitY = H * HIT_RATIO;
            const { x: lx, w: lw } = laneAt(toLane, 1, W);
            const cx = lx + lw / 2;
            const lc = getDifficultyLaneColor(laneColorsRef.current[toLane], songRef.current?.difficultyLevel ?? 5, toLane);
            const particles: HitParticle[] = [];
            for (let i = 0; i < 6; i++) {
              const angle = (Math.random() - 0.5) * Math.PI;
              const speed = 40 + Math.random() * 60;
              particles.push({
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 20,
                size: 2 + Math.random() * 3,
              });
            }
            hitFxRef.current.push({
              lane: toLane,
              startMs: Date.now(),
              cx,
              cy: hitY,
              color: lc,
              kind: "GOOD", // Use GOOD kind for a subtler effect
              particles,
            });
          }
        }
      }
    },
    [],
  );

  const finishGame = useCallback((failed = false) => {
    if (phaseRef.current === "finished") return;
    phaseRef.current = "finished";
    setPhase("finished");
    cancelAnimationFrame(rafRef.current);
    audioRef.current?.pause();
    audioRef.current && (audioRef.current.currentTime = 0);

    const gs = gsRef.current;
    // Medal calculated on complete/clear, even if continues were used
    const continuesUsed = continueUsedRef.current;
    const medal = failed ? "NONE" : getMedal(gs.perfectPlus, gs.perfects, gs.goods, gs.misses);

    if (!failed) {
      audioManager.playSfx("song_completion", 0.8);
      haptics.fusionSuccess();
    } else {
      haptics.error();
    }

    // Save progress with error handling
    try {
      if (songRef.current && !failed) {
        saveHighScore(songRef.current.id, gs.score);
        saveMedal(songRef.current.id, medal);
        saveScoreHistory(songRef.current.id, gs.score);
      }

      sessionStorage.setItem(
        `result_${songId}`,
        JSON.stringify({
          score: gs.score,
          maxCombo: gs.maxCombo,
          perfectPlus: gs.perfectPlus,
          perfects: gs.perfects,
          goods: gs.goods,
          misses: gs.misses,
          medal,
          total: gs.perfectPlus + gs.perfects + gs.goods + gs.misses,
          failed,
          continuesUsed,
        }),
      );
    } catch (err) {
      console.error("Failed to save game results:", err);
    }

    // Shorter delay for a snappier transition to results
    finishGameTimeoutRef.current = setTimeout(() => {
      if (phaseRef.current === "unmounted") return;
      if (isTutorial) {
        setLocation(`/tutorial?phase=results&score=${gs.score}`);
      } else {
        setLocation(`/results/${songId}`);
      }
    }, 300);
  }, [songId, setLocation, isTutorial]);

  const doAbandon = useCallback(() => {
    if (phaseRef.current === "finished") return;
    phaseRef.current = "finished";
    cancelAnimationFrame(rafRef.current);
    audioRef.current?.pause();
    const elapsedTime = audioRef.current?.currentTime || 0;
    audioRef.current && (audioRef.current.currentTime = 0);

    // Log game abandon event
    const gs = gsRef.current;
    logAnalyticsEvent('game_abandon', {
      songId: songId,
      score: gs.score,
      maxCombo: gs.maxCombo,
      elapsedTime: Number(elapsedTime.toFixed(2))
    });

    const origin = sessionStorage.getItem(`game_origin_${songId}`) ?? '';
    const dest = origin === 'songs' ? '/songs' : origin ? `/${origin}` : '/campaign';
    abandonTimeoutRef.current = setTimeout(() => {
      if (phaseRef.current === "unmounted") return;
      setLocation(dest);
    }, 100);
  }, [songId, setLocation]);

  function triggerGameFail(): boolean {
    if (missCountRef.current >= 3 && optsRef.current.missSystem && !activeTutorial) {
      const audio = audioRef.current;
      if (audio) {
        rewindToRef.current = Math.max(0, audio.currentTime - 2.5);
        audio.pause();
      }
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (continueUsedRef.current >= 3) {
        audioManager.playSfx("outof_continues", 0.85);
        finishGame(true);
      } else {
        phaseRef.current = "continue";
        setPhase("continue");
        audioManager.playSfx("gmeover", 0.7);
        laneRestoreTimers.current.forEach(clearTimeout);
        if (continueTimeoutRef.current) {
          clearTimeout(continueTimeoutRef.current);
          continueTimeoutRef.current = null;
        }
        if (finishGameTimeoutRef.current) {
          clearTimeout(finishGameTimeoutRef.current);
          finishGameTimeoutRef.current = null;
        }
        if (abandonTimeoutRef.current) {
          clearTimeout(abandonTimeoutRef.current);
          abandonTimeoutRef.current = null;
        }
      }
      return true;
    }
    return false;
  }

  const doReturn = useCallback(() => {
    if (phaseRef.current !== "continue") return; // guard against double-firing!
    audioManager.stopSfx("gameover_countdown");
    playRewindSound();
    continueUsedRef.current++;

    // Log game continue telemetry event
    logAnalyticsEvent('game_continue', {
      songId: songId,
      continueIndex: continueUsedRef.current
    });

    haptics.fusionProgress();

    // Stop any existing draw loop first
    cancelAnimationFrame(rafRef.current);

    const audio = audioRef.current;
    const rewindTo = rewindToRef.current;
    const fromT = audio?.currentTime ?? (rewindTo + 2.5);

    // Arm the backwards animation — draw loop reads this to compute fake time
    rewindAnimRef.current = { wallStart: performance.now(), fromT, toT: rewindTo };

    // Reset miss counter immediately (pips clear visually)
    missCountRef.current = 0;
    lastMissTimeRef.current = 0;
    setMissCount(0);
    gameSenseService.sendHealth(3);
    gameSenseService.sendCombo(0);

    // Start the rewind render loop NOW so highway plays backwards
    phaseRef.current = "rewinding";
    setPhase("rewinding");
    rafRef.current = requestAnimationFrame(() => drawRef.current?.());

    // After the 1.2 s animation: restore notes, seek audio, resume
    continueTimeoutRef.current = setTimeout(() => {
      if (phaseRef.current !== "rewinding") return; // guard against double-fire
      // Undo misses that happened in the rewind window
      notesRef.current.forEach((ns) => {
        if (ns.missed && ns.note.time >= rewindTo - 0.5) {
          ns.missed = false;
          gsRef.current.misses = Math.max(0, gsRef.current.misses - 1);
        }
        // Also reset any hold notes that were in-flight
        if (ns.holdActive && ns.note.time >= rewindTo - 0.5) {
          ns.holdActive = false;
          ns.holdProgress = 0;
          ns.autoplayedBySurge = false;
        }
      });
      gsRef.current.combo = 0;
      [0, 1, 2].forEach(restoreLane);
      rewindAnimRef.current = null;

      if (audio) {
        audio.currentTime = rewindTo;
        audio.play().catch(() => {});
      }

      phaseRef.current = "playing";
      setPhase("playing");
    }, 1200);
  }, [restoreLane]);

  // Auto-abandon countdown while continue screen is visible
  useEffect(() => {
    if (phase !== "continue") return;
    setContinueCountdown(10);
    // Play the tense countdown loop once on entry
    audioManager.playSfx("gameover_countdown", 0.55);
    let count = 10;
    const id = setInterval(() => {
      count--;
      setContinueCountdown(count);
      if (count <= 0) {
        clearInterval(id);
        finishGame();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [phase, finishGame]);

  // ═══════════════════════════════════════════════════════════════
  //  DRAW LOOP
  // ═══════════════════════════════════════════════════════════════
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const phase = phaseRef.current;
    if (!canvas || (phase !== "playing" && phase !== "rewinding") || pausedRef.current || isTutorialHelpOpenRef.current) return;
    const ctx = canvas.getContext("2d");
    if (!ctx || !songRef.current) return;
    const song = songRef.current;
    const isRewinding = phase === "rewinding";
    let t: number;
    if (isRewinding && rewindAnimRef.current) {
      const { wallStart, fromT, toT } = rewindAnimRef.current;
      const elapsed = (performance.now() - wallStart) / 1000;
      const p = Math.min(1, elapsed / 1.2);
      const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      t = fromT - (fromT - toT) * eased;
    } else {
      t = getT();
    }
    const audio = audioRef.current;
    if (audio && !pausedRef.current && phaseRef.current === "playing") {
      if (modifierRef.current === 'corrupted_signal') {
        audio.playbackRate = 1.0 + Math.sin(t * 2.0) * 0.04;
      } else {
        audio.playbackRate = 1.0;
      }
    }
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.width / dpr;
    const H = canvas.height / dpr;
    const pulse = 0.5 + 0.5 * Math.sin(t * 10); // 1.6Hz pulse for polish
    const AT = approachTime(song.difficultyLevel);
    const hitY = H * HIT_RATIO;
    const hillBow = W * 0.032; // how far rails bow outward at the shoulder
    const bowY = hitY * 0.28; // where the shoulder bow peaks
    const nowMs = Date.now();
    const gs = gsRef.current;
    const pu = puRef.current;
    gs.progress = Math.min(1, t / song.duration);

    // Stage transition tracking
    const stageBounds = [
      { stage: 1, name: "Stage 1", pct: 0.00, difficulty: "Very Easy" },
      { stage: 2, name: "Stage 2", pct: 0.20, difficulty: "Easy" },
      { stage: 3, name: "Stage 3", pct: 0.40, difficulty: "Medium" },
      { stage: 4, name: "Stage 4", pct: 0.65, difficulty: "Hard" },
      { stage: 5, name: "Stage 5", pct: 0.80, difficulty: "Expert" }
    ];
    let calculatedStage = 1;
    for (let i = 0; i < stageBounds.length; i++) {
      if (gs.progress >= stageBounds[i].pct) {
        calculatedStage = stageBounds[i].stage;
      }
    }
    if (calculatedStage !== lastDetectedStageRef.current) {
      const prevStage = lastDetectedStageRef.current;
      lastDetectedStageRef.current = calculatedStage;
      setCurrentStage(calculatedStage);
      
      const sb = stageBounds.find(s => s.stage === calculatedStage);
      if (sb && prevStage > 0 && calculatedStage > prevStage) {
        audioManager.playSfx("fusion", 0.7);
        if (stingerTimeout1Ref.current) clearTimeout(stingerTimeout1Ref.current);
        if (stingerTimeout2Ref.current) clearTimeout(stingerTimeout2Ref.current);
        
        setStageStingerNumber(calculatedStage);
        setStageStingerPhase('cleared');
        
        stingerTimeout1Ref.current = setTimeout(() => {
          setStageStingerPhase('start');
        }, 2200);
        
        stingerTimeout2Ref.current = setTimeout(() => {
          setStageStingerNumber(null);
        }, 4200);
      }
    }

    // Combo milestone tracking
    if (gs.combo === 0) {
      lastMilestoneRef.current = 0;
    } else if (gs.combo % 50 === 0 && gs.combo !== lastMilestoneRef.current) {
      lastMilestoneRef.current = gs.combo;
      milestoneFxRef.current.push({
        combo: gs.combo,
        startMs: performance.now(),
        color: gs.combo >= 100 ? "#39FF14" : "#E5B800",
      });
    }

    // Power-up display sync
    if (pu.active && t < pu.endTime) {
      updatePuDisplayDOM({
        label: pu.label,
        color: pu.color,
        multiplier: pu.multiplier,
        progress: (pu.endTime - t) / pu.duration,
      });
    } else if (pu.active && t >= pu.endTime) {
      pu.active = null;
      updatePuDisplayDOM(null);
      gameSenseService.sendPowerup(0);
    }

    const puActive = !!(pu.active && t < pu.endTime);
    const puColor = puActive ? pu.color : null;

    // ── 1. BACKGROUND ──────────────────────────────────────────
    // Canvas is transparent — CSS cover art layer shows through beneath everything
    ctx.clearRect(0, 0, W, H);

    // Draw pre-rendered static tracks (Double-buffering optimization)
    if (offscreenCanvasRef.current) {
      ctx.drawImage(offscreenCanvasRef.current, 0, 0, W, H);
    }

    // Draw Slideshow Cutouts on the track if selected in gameTrack options
    if (optsRef.current.gameTrack === 'slideshow' && gameplaySlideshowFloatersRef.current.length > 0) {
      ctx.save();
      
      const hwTop = hwAtProgress(0, W);
      const hwBot = hwAtProgress(1, W);
      
      // Clip to track boundary so it stays inside the track
      ctx.beginPath();
      ctx.moveTo(hwTop.left, 0);
      ctx.quadraticCurveTo(W/2, -hitY * 0.09, hwTop.right, 0);
      ctx.lineTo(hwBot.right, hitY);
      ctx.lineTo(hwBot.left, hitY);
      ctx.closePath();
      ctx.clip();

      const cxTrack = W / 2;
      const cyTrack = hitY * 0.55;

      gameplaySlideshowFloatersRef.current.forEach((floater) => {
        // Move
        floater.x += floater.vx;
        floater.y += floater.vy;
        floater.rotation += floater.rotSpeed;

        // Bounce within boundaries of the track
        const boundX = W * 0.18;
        const boundY = hitY * 0.38;

        if (Math.abs(floater.x) > boundX) {
          floater.vx *= -1;
          floater.x = Math.sign(floater.x) * boundX;
        }
        if (Math.abs(floater.y) > boundY) {
          floater.vy *= -1;
          floater.y = Math.sign(floater.y) * boundY;
        }

        ctx.save();
        ctx.translate(cxTrack + floater.x, cyTrack + floater.y);
        ctx.rotate(floater.rotation);
        ctx.scale(floater.scale, floater.scale);

        // Subtle glow to stand out under the notes
        ctx.shadowBlur = 10;
        ctx.shadowColor = floater.glowColor;

        // Draw image cutout
        const fw = floater.width;
        const fh = floater.height;
        ctx.drawImage(floater.canvas, -fw / 2, -fh / 2, fw, fh);

        // Draw glowing label border (similar to slideshow, but smaller)
        ctx.strokeStyle = floater.glowColor;
        ctx.lineWidth = 0.5;
        const pad = 4;
        ctx.beginPath();
        // Top Left
        ctx.moveTo(-fw / 2 - pad, -fh / 2 - pad + 6);
        ctx.lineTo(-fw / 2 - pad, -fh / 2 - pad);
        ctx.lineTo(-fw / 2 - pad + 6, -fh / 2 - pad);
        // Bottom Right
        ctx.moveTo(fw / 2 + pad, fh / 2 + pad - 6);
        ctx.lineTo(fw / 2 + pad, fh / 2 + pad);
        ctx.lineTo(fw / 2 + pad - 6, fh / 2 + pad);
        ctx.stroke();

        ctx.restore();
      });

      ctx.restore();
    }

    // Draw Sacred Visualizer on the track if selected in gameTrack options
    if (optsRef.current.gameTrack === 'sacred_visualizer') {
      const hwTop = hwAtProgress(0, W);
      const hwBot = hwAtProgress(1, W);
      const cyVis = hitY * 0.55;
      const cxVis = W / 2;
      const sizeVis = Math.min(W, hitY) * 0.45;

      let bass = 0;
      let mid = 0;
      let high = 0;
      
      const analyser = gameplayAnalyserRef.current;
      const data = gameplayAnalyserDataRef.current;
      if (analyser && data) {
        analyser.getByteFrequencyData(data);
        let bVal = 0, mVal = 0, hVal = 0;
        for (let i = 0; i < data.length; i++) {
          if (i < 10) bVal += data[i];
          else if (i < 50) mVal += data[i];
          else hVal += data[i];
        }
        bass = bVal / 10;
        mid = mVal / 40;
        high = hVal / (data.length - 50);
      } else {
        const timeSec = t;
        bass = 50 + Math.sin(timeSec * 8) * 25;
        mid = 45 + Math.cos(timeSec * 5) * 15;
        high = 30 + Math.sin(timeSec * 12) * 10;
      }

      const bassN = Math.min(1, bass / 255);
      const midN = Math.min(1, mid / 255);
      const highN = Math.min(1, high / 255);

      const bassScale = 1.0 + bassN * 0.12;
      const rotationAngle = t * 0.4 + midN * 0.3;
      const baseHue = (t * 24) % 360;

      const getColor = (offset: number, alpha: number) => {
        return `hsla(${(baseHue + offset) % 360}, 95%, 62%, ${alpha})`;
      };

      ctx.save();
      
      // Clip to track boundary so it stays inside the track
      ctx.beginPath();
      ctx.moveTo(hwTop.left, 0);
      ctx.quadraticCurveTo(W/2, -hitY * 0.09, hwTop.right, 0);
      ctx.lineTo(hwBot.right, hitY);
      ctx.lineTo(hwBot.left, hitY);
      ctx.closePath();
      ctx.clip();

      ctx.translate(cxVis, cyVis);
      ctx.scale(bassScale, bassScale);
      ctx.rotate(rotationAngle);
      ctx.shadowBlur = 8 + midN * 12;

      // Opacity level: low so it acts as background under the notes
      const opacityVal = 0.20 + highN * 0.12;

      // Cycle shape based on calculatedStage
      const visualizerShape = 
        calculatedStage === 1 ? 'bipolar_torus' :
        calculatedStage === 2 ? 'flower_of_life' :
        calculatedStage === 3 ? 'lakshmi_star' :
        calculatedStage === 4 ? 'metatrons_cube' : 'sri_yantra';

      if (visualizerShape === 'flower_of_life') {
        const radius = sizeVis * 0.22;
        ctx.lineWidth = 1.0;
        for (let i = 0; i < 6; i++) {
          const angle = (i * Math.PI) / 3;
          const ox = Math.cos(angle) * radius;
          const oy = Math.sin(angle) * radius;
          ctx.strokeStyle = getColor(i * 30, opacityVal);
          ctx.shadowColor = getColor(i * 30, opacityVal);
          ctx.beginPath();
          ctx.arc(ox, oy, radius, 0, Math.PI * 2);
          ctx.stroke();

          const outerAngle = angle + Math.PI / 6;
          const oox = Math.cos(outerAngle) * radius * Math.sqrt(3);
          const ooy = Math.sin(outerAngle) * radius * Math.sqrt(3);
          ctx.strokeStyle = getColor(i * 30 + 60, opacityVal);
          ctx.shadowColor = getColor(i * 30 + 60, opacityVal);
          ctx.beginPath();
          ctx.arc(oox, ooy, radius, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.strokeStyle = getColor(0, opacityVal);
        ctx.shadowColor = getColor(0, opacityVal);
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.stroke();

      } else if (visualizerShape === 'sri_yantra') {
        const scaleFact = sizeVis * 0.85;
        ctx.lineWidth = 0.9;
        const drawYantraTriangle = (yCenter: number, r: number, pointingUp: boolean, hueOffset: number) => {
          ctx.strokeStyle = getColor(hueOffset, opacityVal);
          ctx.shadowColor = getColor(hueOffset, opacityVal);
          ctx.beginPath();
          const yTip = pointingUp ? yCenter - r : yCenter + r;
          const yBase = pointingUp ? yCenter + r * 0.5 : yCenter - r * 0.5;
          const xOffset = r * Math.sqrt(3) * 0.5;
          ctx.moveTo(0, yTip);
          ctx.lineTo(xOffset, yBase);
          ctx.lineTo(-xOffset, yBase);
          ctx.closePath();
          ctx.stroke();
        };

        drawYantraTriangle(0, scaleFact * 0.5, true, 0);
        drawYantraTriangle(0, scaleFact * 0.5, false, 40);
        drawYantraTriangle(-scaleFact * 0.05, scaleFact * 0.4, true, 80);
        drawYantraTriangle(scaleFact * 0.05, scaleFact * 0.4, false, 120);
        drawYantraTriangle(scaleFact * 0.03, scaleFact * 0.3, true, 160);
        drawYantraTriangle(-scaleFact * 0.03, scaleFact * 0.3, false, 200);

        ctx.strokeStyle = getColor(180, opacityVal);
        ctx.shadowColor = getColor(180, opacityVal);
        ctx.beginPath();
        ctx.arc(0, 0, scaleFact * 0.58, 0, Math.PI * 2);
        ctx.stroke();

      } else if (visualizerShape === 'metatrons_cube') {
        const rad = sizeVis * 0.22;
        const nodes: {x: number, y: number, color: string}[] = [];
        ctx.lineWidth = 0.7;

        nodes.push({ x: 0, y: 0, color: getColor(0, opacityVal) });
        for (let i = 0; i < 6; i++) {
          const angle = (i * Math.PI) / 3;
          nodes.push({ x: Math.cos(angle) * rad, y: Math.sin(angle) * rad, color: getColor(i * 30, opacityVal) });
          nodes.push({ x: Math.cos(angle) * rad * 2, y: Math.sin(angle) * rad * 2, color: getColor(i * 30 + 60, opacityVal) });
        }

        for (let a = 0; a < nodes.length; a++) {
          for (let b = a + 1; b < nodes.length; b++) {
            ctx.strokeStyle = nodes[a].color.replace(String(opacityVal), String(opacityVal * 0.25));
            ctx.beginPath();
            ctx.moveTo(nodes[a].x, nodes[a].y);
            ctx.lineTo(nodes[b].x, nodes[b].y);
            ctx.stroke();
          }
        }

        nodes.forEach((n) => {
          ctx.strokeStyle = n.color;
          ctx.shadowColor = n.color;
          ctx.beginPath();
          ctx.arc(n.x, n.y, rad * 0.4, 0, Math.PI * 2);
          ctx.stroke();
        });

      } else if (visualizerShape === 'bipolar_torus') {
        const rad = sizeVis * 0.88;
        ctx.lineWidth = 0.9;
        const circlesCount = 8;
        for (let i = 1; i <= circlesCount; i++) {
          const ratio = i / circlesCount;
          const cyOffset = rad * (1 - ratio);
          const currentRad = rad * ratio;

          ctx.strokeStyle = getColor(i * 30, opacityVal);
          ctx.shadowColor = getColor(i * 30, opacityVal);

          ctx.beginPath();
          ctx.arc(0, -cyOffset, currentRad, 0, Math.PI * 2);
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(0, cyOffset, currentRad, 0, Math.PI * 2);
          ctx.stroke();
        }

      } else if (visualizerShape === 'lakshmi_star') {
        const rad = sizeVis * 0.68;
        ctx.lineWidth = 1.0;
        const drawSquare = (angle: number, colorIdx: number) => {
          ctx.save();
          ctx.rotate(angle);
          ctx.strokeStyle = getColor(colorIdx, opacityVal);
          ctx.shadowColor = getColor(colorIdx, opacityVal);
          ctx.beginPath();
          ctx.rect(-rad * 0.5, -rad * 0.5, rad, rad);
          ctx.stroke();
          ctx.restore();
        };

        drawSquare(0, 0);
        drawSquare(Math.PI / 4, 80);

        ctx.strokeStyle = getColor(160, opacityVal);
        ctx.shadowColor = getColor(160, opacityVal);
        ctx.beginPath();
        ctx.arc(0, 0, rad * 0.3, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    }

    // Save context for entire frame drawing (supports global translations / shake)
    ctx.save();

    if (modifierRef.current === 'corrupted_signal') {
      if (Math.random() < 0.07) {
        ctx.translate((Math.random() - 0.5) * 14, 0);
      }
    }

    // ── Miss screen jitter shake ──
    {
      const missAge = Math.min(
        ...lastMissLaneTimeRef.current.map((t2) => nowMs - t2),
      );
      if (missAge < 280) {
        const strength = (1 - missAge / 280) * 9;
        ctx.translate(
          (Math.random() - 0.5) * strength,
          (Math.random() - 0.5) * strength * 0.5,
        );
      }
    }

    // Ambient particles update & draw
    const now = performance.now();
    const frameDt = Math.min(0.1, (now - lastFrameTimeRef.current) / 1000);
    lastFrameTimeRef.current = now;

    const diffLevel = song.difficultyLevel;
    const isVoid = diffLevel >= 7;
    const speedFactor = diffLevel <= 3 ? 0.6 : diffLevel <= 6 ? 1.0 : 1.5;
    const particleColor = diffLevel <= 3 ? "#00FFDD" : diffLevel <= 6 ? "#39FF14" : "#FF1493";

    ctx.save();
    for (const p of ambientParticlesRef.current) {
      // update positions
      p.x += p.vx * frameDt * speedFactor;
      p.y += p.vy * frameDt * speedFactor;

      // wrap boundaries
      if (p.y < 0) {
        p.y = H;
        p.x = Math.random() * W;
      }
      if (p.x < 0 || p.x > W) {
        p.x = Math.random() * W;
      }

      const a = p.alpha * (0.3 + 0.7 * Math.sin(t * 3 + p.x));
      // Outer glow circle
      ctx.fillStyle = particleColor;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 2.0, 0, Math.PI * 2);
      ctx.globalAlpha = a * 0.28;
      ctx.fill();

      // Core circle
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.globalAlpha = a;
      ctx.fill();
    }
    ctx.restore();

    // Glitch/Shake viewport if VOID and high combo / power-up active
    let shakeX = 0;
    let shakeY = 0;
    if (isVoid && (puActive || gs.combo >= 40)) {
      if (Math.random() < 0.28) {
        shakeX = (Math.random() - 0.5) * 3.8;
        shakeY = (Math.random() - 0.5) * 3.8;
      }
    }
    if (shakeX !== 0 || shakeY !== 0) {
      ctx.translate(shakeX, shakeY);
    }

    // Full-screen effects (vignette, mood, scanlines) are now CSS overlays on the
    // outer wrapper — they cover the entire viewport uniformly so no column seam appears.

    const hwTop = hwAtProgress(0, W);
    const hwBot = hwAtProgress(1, W);

    // ── 2. LANE TRACK SURFACE ───────────────────────────────────
    if (!offscreenCanvasRef.current) {
      // Fallback: draw static rails, tints, grid lines, dividers if offscreen cache is missing
      const hillCx = W / 2;
      const hillCy = -hitY * 0.09;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(hwTop.left, 0);
      ctx.quadraticCurveTo(hillCx, hillCy, hwTop.right, 0);
      ctx.lineTo(hwBot.right, hitY);
      ctx.lineTo(hwBot.left, hitY);
      ctx.closePath();
      ctx.clip();

      const trackGrad = ctx.createLinearGradient(0, 0, 0, hitY);
      trackGrad.addColorStop(0, "#08081a");
      trackGrad.addColorStop(0.35, "#0c0c22");
      trackGrad.addColorStop(0.7, "#10102a");
      trackGrad.addColorStop(1, "#141430");
      ctx.fillStyle = trackGrad;
      ctx.fillRect(0, 0, W, hitY);

      for (let i = 0; i < LANE_COUNT; i++) {
        const { x: lx0, w: lw0 } = laneAt(i, 0.3, W);
        const { x: lx1, w: lw1 } = laneAt(i, 1, W);
        const lc = getDifficultyLaneColor(laneColorsRef.current[i], songRef.current?.difficultyLevel ?? 5, i);
        const lcR = parseInt(lc.slice(1, 3), 16);
        const lcG = parseInt(lc.slice(3, 5), 16);
        const lcB = parseInt(lc.slice(5, 7), 16);
        const laneGrad = ctx.createLinearGradient(0, 0, 0, hitY);
        laneGrad.addColorStop(0, "transparent");
        laneGrad.addColorStop(0.6, `rgba(${lcR},${lcG},${lcB},0.03)`);
        laneGrad.addColorStop(1, `rgba(${lcR},${lcG},${lcB},0.07)`);
        ctx.fillStyle = laneGrad;
        ctx.beginPath();
        ctx.moveTo(lx0, hitY * 0.3);
        ctx.lineTo(lx0 + lw0, hitY * 0.3);
        ctx.lineTo(lx1 + lw1, hitY);
        ctx.lineTo(lx1, hitY);
        ctx.closePath();
        ctx.fill();
      }

      for (let row = 0; row <= 16; row++) {
        const ry = (row / 16) * hitY;
        const rp = ry / hitY;
        const { left, right } = hwAtProgress(rp, W);
        ctx.strokeStyle = `rgba(255,248,235,${0.01 + rp * 0.025})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(left, ry);
        ctx.lineTo(right, ry);
        ctx.stroke();
      }

      for (let l = 1; l < LANE_COUNT; l++) {
        const topPos = laneAt(l, 0, W);
        const botPos = laneAt(l, 1, W);
        ctx.strokeStyle = "rgba(0,0,0,0.85)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(topPos.x, 0);
        ctx.lineTo(botPos.x, hitY);
        ctx.stroke();
        const divGrad = ctx.createLinearGradient(0, 0, 0, hitY);
        divGrad.addColorStop(0, "rgba(255,255,255,0.0)");
        divGrad.addColorStop(0.5, "rgba(255,255,255,0.08)");
        divGrad.addColorStop(1, "rgba(255,255,255,0.14)");
        ctx.strokeStyle = divGrad;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(topPos.x + 1.5, 0);
        ctx.lineTo(botPos.x + 1.5, hitY);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Draw dynamic speed lines (clipped to track guides)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(hwTop.left, 0);
    ctx.quadraticCurveTo(W / 2, -hitY * 0.09, hwTop.right, 0);
    ctx.lineTo(hwBot.right, hitY);
    ctx.lineTo(hwBot.left, hitY);
    ctx.closePath();
    ctx.clip();

    const speedCycle = hitY * 0.18;
    const speedOff = (t * 0.8 * hitY) % speedCycle;
    for (let row = -1; row < 8; row++) {
      const sy1 = speedOff + row * speedCycle;
      const sy2 = sy1 + speedCycle * 0.35;
      if (sy2 < 0 || sy1 > hitY) continue;
      const sp1 = Math.max(0, Math.min(1, sy1 / hitY));
      const sp2 = Math.max(0, Math.min(1, sy2 / hitY));
      const { left: sl1, right: sr1 } = hwAtProgress(sp1, W);
      const { left: sl2, right: sr2 } = hwAtProgress(sp2, W);
      const speedAlpha = 0.012 + sp1 * 0.04;
      ctx.fillStyle = `rgba(255,248,235,${speedAlpha})`;
      ctx.beginPath();
      ctx.moveTo(sl1, sy1);
      ctx.lineTo(sr1, sy1);
      ctx.lineTo(sr2, sy2);
      ctx.lineTo(sl2, sy2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // ── HIT LINE BEAM ── neon horizontal bar at the hit zone
    const beamGrad = ctx.createLinearGradient(hwBot.left, 0, hwBot.right, 0);
    const beamColor = puColor ?? "rgba(255,248,235,0.7)";
    const beamPulse = 0.7 + 0.3 * Math.sin(t * 6);
    beamGrad.addColorStop(0, "transparent");
    beamGrad.addColorStop(0.15, beamColor);
    beamGrad.addColorStop(0.5, "rgba(255,255,255,0.9)");
    beamGrad.addColorStop(0.85, beamColor);
    beamGrad.addColorStop(1, "transparent");
    ctx.globalAlpha = beamPulse * 0.45;
    ctx.fillStyle = beamGrad;
    ctx.fillRect(hwBot.left, hitY - 2, hwBot.right - hwBot.left, 4);
    // Bloom glow under the beam
    ctx.globalAlpha = beamPulse * 0.12;
    ctx.shadowColor = puColor ?? "#fff";
    ctx.shadowBlur = 20;
    ctx.fillRect(hwBot.left, hitY - 1, hwBot.right - hwBot.left, 2);
    ctx.shadowBlur = 0; // reset shadow
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";

    ctx.restore();

    // ── 3. TRACK EDGE RAILS ─────────────────────────────────────
    // Neon rails with strong glow
    const railColor = puColor ?? "rgba(255,248,235,0.55)";
    const railGlow = puColor ? `${puColor}CC` : "rgba(255,248,235,0.25)";

    // Outer glow pass (thicker, blurred)
    ctx.save();
    ctx.shadowColor = puColor ?? "rgba(255,248,235,0.4)";
    ctx.shadowBlur = 16;
    const railGlowGrad = ctx.createLinearGradient(0, 0, 0, hitY);
    railGlowGrad.addColorStop(0, "rgba(255,255,255,0.0)");
    railGlowGrad.addColorStop(0.3, railGlow);
    railGlowGrad.addColorStop(1, railColor);
    ctx.strokeStyle = railGlowGrad;
    ctx.lineWidth = 3;
    // Left rail
    ctx.beginPath();
    ctx.moveTo(hwTop.left, 0);
    ctx.quadraticCurveTo(hwTop.left - hillBow, bowY, hwBot.left, hitY);
    ctx.stroke();
    // Right rail
    ctx.beginPath();
    ctx.moveTo(hwTop.right, 0);
    ctx.quadraticCurveTo(hwTop.right + hillBow, bowY, hwBot.right, hitY);
    ctx.stroke();
    ctx.restore();

    // Inner bright core
    const railCoreGrad = ctx.createLinearGradient(0, 0, 0, hitY);
    railCoreGrad.addColorStop(0, "rgba(255,255,255,0.0)");
    railCoreGrad.addColorStop(0.5, "rgba(255,255,255,0.3)");
    railCoreGrad.addColorStop(1, "rgba(255,255,255,0.6)");
    ctx.strokeStyle = railCoreGrad;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(hwTop.left, 0);
    ctx.quadraticCurveTo(hwTop.left - hillBow, bowY, hwBot.left, hitY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(hwTop.right, 0);
    ctx.quadraticCurveTo(hwTop.right + hillBow, bowY, hwBot.right, hitY);
    ctx.stroke();

    // ── 4. POWER-UP SCREEN EDGE GLOW ───────────────────────────
    if (puActive && puColor) {
      const pulse = 0.5 + 0.5 * Math.sin(t * 7);
      const ei = Math.min(1, (pu.endTime - t) / 2) * pulse * 0.7;
      const hex = Math.round(ei * 200)
        .toString(16)
        .padStart(2, "0");
      const eg1 = ctx.createLinearGradient(0, 0, 80, 0);
      eg1.addColorStop(0, `${puColor}${hex}`);
      eg1.addColorStop(1, "transparent");
      ctx.fillStyle = eg1;
      ctx.fillRect(0, 0, 80, H);
      const eg2 = ctx.createLinearGradient(W, 0, W - 80, 0);
      eg2.addColorStop(0, `${puColor}${hex}`);
      eg2.addColorStop(1, "transparent");
      ctx.fillStyle = eg2;
      ctx.fillRect(W - 80, 0, 80, H);
    }

    // ── 4.5. HIT ZONE BUTTONS (behind notes, semi-transparent) ──
    // Original height (space below hit line), centered so baseline bisects each button.
    const btnH = H - hitY;
    const btnY = hitY - btnH / 2; // baseline runs through the exact center
    // Clip to track width so buttons never overflow the highway edges
    ctx.save();
    ctx.beginPath();
    ctx.rect(hwBot.left, 0, hwBot.right - hwBot.left, H);
    ctx.clip();
    for (let i = 0; i < LANE_COUNT; i++) {
      const { x, w } = laneAt(i, 1, W);
      const pressed = laneRef.current[i].pressed;
      const lc = getDifficultyLaneColor(laneColorsRef.current[i], songRef.current?.difficultyLevel ?? 5, i);
      const silenced = laneSilenced.current[i];
      const bx = x + 4;
      const bw = w - 8;
      const bTop = btnY + (pressed ? 2 : 0);

      // Calculate themed difficulty hue
      const diffLvl = songRef.current?.difficultyLevel ?? 5;
      const diffColor = diffLvl <= 3 ? "#00FFDD" : diffLvl >= 7 ? "#FF1493" : "#39FF14";
      const r = parseInt(diffColor.slice(1, 3), 16);
      const g = parseInt(diffColor.slice(3, 5), 16);
      const b = parseInt(diffColor.slice(5, 7), 16);

      // Key body — semi-transparent frosted glass tinted with difficulty hue
      const kGrad = ctx.createLinearGradient(bx, bTop, bx, bTop + btnH);
      if (pressed) {
        kGrad.addColorStop(0, "rgba(255, 255, 255, 0.42)");
        kGrad.addColorStop(0.3, "rgba(220, 215, 205, 0.35)");
        kGrad.addColorStop(0.7, `rgba(${r},${g},${b},0.32)`);
        kGrad.addColorStop(1, `rgba(${r},${g},${b},0.55)`);
      } else {
        kGrad.addColorStop(0, "rgba(255, 255, 255, 0.22)");
        kGrad.addColorStop(0.3, "rgba(240, 235, 225, 0.14)");
        kGrad.addColorStop(0.7, `rgba(${r},${g},${b},0.12)`);
        kGrad.addColorStop(1, `rgba(${r},${g},${b},0.28)`);
      }
      ctx.fillStyle = kGrad;
      ctx.beginPath();
      ctx.roundRect(bx, bTop, bw, btnH, 10);
      ctx.fill();

      // Frosted glass inner bevel highlights
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(bx, bTop, bw, btnH, 10);
      ctx.clip();
      
      // Draw top edge white highlight
      ctx.strokeStyle = pressed ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.45)";
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(bx, bTop + btnH);
      ctx.lineTo(bx, bTop);
      ctx.lineTo(bx + bw, bTop);
      ctx.stroke();

      // Diagonal glass glare line across the button
      const btnGlareX = bx + (bw * 0.45);
      const glareGrad = ctx.createLinearGradient(btnGlareX, bTop, btnGlareX + 25, bTop + btnH);
      glareGrad.addColorStop(0, "rgba(255, 255, 255, 0)");
      glareGrad.addColorStop(0.5, pressed ? "rgba(255, 255, 255, 0.16)" : "rgba(255, 255, 255, 0.09)");
      glareGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = glareGrad;
      ctx.beginPath();
      ctx.moveTo(bx, bTop);
      ctx.lineTo(bx + bw, bTop);
      ctx.lineTo(bx + bw, bTop + btnH);
      ctx.lineTo(bx, bTop + btnH);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Subtle border — tinted with difficulty hue
      ctx.strokeStyle = pressed
        ? `rgba(${r},${g},${b},0.55)`
        : `rgba(${r},${g},${b},0.22)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(bx, bTop, bw, btnH, 10);
      ctx.stroke();

      // Colored stripe — centered exactly on hitY
      const stripeH = Math.max(5, btnH * 0.06);
      const stripeTop = hitY - stripeH / 2 + (pressed ? 1 : 0);
      const stripeCol = silenced ? "rgba(70,68,65,0.55)" : lc;
      ctx.shadowColor = silenced ? "transparent" : lc;
      ctx.shadowBlur = pressed ? 18 : 10;
      ctx.fillStyle = stripeCol;
      ctx.globalAlpha = pressed ? 0.95 : silenced ? 0.35 : 0.78;
      ctx.beginPath();
      ctx.roundRect(bx + 4, stripeTop, bw - 8, stripeH, stripeH * 0.4);
      ctx.fill();
      // Bright core
      ctx.fillStyle = silenced ? "rgba(50,48,45,0.3)" : "rgba(255,255,255,0.5)";
      ctx.globalAlpha = pressed ? 0.75 : 0.55;
      ctx.beginPath();
      ctx.roundRect(
        bx + 7,
        stripeTop + stripeH * 0.15,
        bw - 14,
        stripeH * 0.38,
        stripeH * 0.2,
      );
      ctx.fill();

      // ── Inner radial glow (Beatstar style) ──
      if (pressed || !silenced) {
        ctx.save();
        const lcR2 = parseInt(lc.slice(1, 3), 16);
        const lcG2 = parseInt(lc.slice(3, 5), 16);
        const lcB2 = parseInt(lc.slice(5, 7), 16);
        const rg = ctx.createRadialGradient(bx + bw / 2, hitY, 0, bx + bw / 2, hitY, bw * 0.8);
        const rgAlpha = pressed ? 0.38 : 0.14 + pulse * 0.04;
        rg.addColorStop(0, `rgba(${lcR2},${lcG2},${lcB2},${rgAlpha})`);
        rg.addColorStop(1, `rgba(${lcR2},${lcG2},${lcB2},0)`);
        ctx.fillStyle = rg;
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.roundRect(bx, bTop, bw, btnH, 10);
        ctx.fill();
        ctx.restore();
      }

      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      ctx.shadowColor = "transparent";

      // Key label — below the baseline (lower half of key)
      // When a gamepad is connected show controller button glyphs instead of keyboard keys
      const GAMEPAD_LANE_GLYPHS: [string, string, string] = ['\u25A1', '\u25B3', '\u25CB']; // □ △ ○  (X, Y, B)
      const rawLabel = gamepadConnectedRef.current
        ? GAMEPAD_LANE_GLYPHS[i as 0 | 1 | 2]
        : keyLabel(laneKeysRef.current[i]);
      const fs = Math.max(12, Math.floor(btnH * (gamepadConnectedRef.current ? 0.17 : 0.13)));
      ctx.fillStyle = pressed ? "rgba(50,45,40,0.7)" : "rgba(42,37,32,0.45)";
      ctx.font = `bold ${fs}px "Space Mono", monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        rawLabel,
        x + w / 2,
        hitY + (H - hitY) * 0.42 + (pressed ? 2 : 0),
      );

      // Muted overlay + ⊘ icon
      if (silenced) {
        ctx.fillStyle = "rgba(0,0,0,0.32)";
        ctx.beginPath();
        ctx.roundRect(bx, bTop, bw, btnH, 10);
        ctx.fill();
        const iconR = Math.min(bw, btnH) * 0.07;
        const iconX = bx + bw * 0.78;
        const iconY = hitY + (H - hitY) * 0.22;
        ctx.strokeStyle = "rgba(180,70,70,0.65)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(iconX, iconY, iconR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(iconX - iconR * 0.7, iconY + iconR * 0.7);
        ctx.lineTo(iconX + iconR * 0.7, iconY - iconR * 0.7);
        ctx.stroke();
      }
    }
    ctx.restore(); // end button clip

    // ── 4b. NOTE PARTICLE TRAILS ────────────────────────────────
    const TRAIL_LIFETIME = 280; // ms
    noteTrailsRef.current = noteTrailsRef.current.filter(p => nowMs - p.birthTime < TRAIL_LIFETIME);
    ctx.save();
    for (const p of noteTrailsRef.current) {
      const age = nowMs - p.birthTime;
      const progress = age / TRAIL_LIFETIME;
      const alpha = p.alpha * (1 - progress);
      const size = p.size * (1 - progress * 0.5);

      // Draw a subtle outer halo to simulate glow without using expensive shadowBlur
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y + progress * 24, size * 2.2, 0, Math.PI * 2);
      ctx.globalAlpha = alpha * 0.22;
      ctx.fill();

      // Main core particle
      ctx.beginPath();
      ctx.arc(p.x, p.y + progress * 24, size, 0, Math.PI * 2);
      ctx.globalAlpha = alpha;
      ctx.fill();
    }
    ctx.restore();

    // ── 5. NOTES ────────────────────────────────────────────────
    let dirty = false;
    for (const ns of notesRef.current) {
      if (ns.hit) continue;
      const { note } = ns;
      const spawnT = note.time - AT;
      const prog = (t - spawnT) / AT;
      const maxMissProg = (H - 45) / hitY;
      if (!isRewinding && ns.missed && prog >= maxMissProg) continue;

      const lc = getDifficultyLaneColor(laneColorsRef.current[note.lane], songRef.current?.difficultyLevel ?? 5, note.lane);
      const noteY = prog * hitY;

      if (ns.visualLane === undefined) {
        ns.visualLane = ns.currentLane;
      }
      if (Math.abs(ns.visualLane - ns.currentLane) > 0.001) {
        ns.visualLane = lerp(ns.visualLane, ns.currentLane, 0.18);
      } else {
        ns.visualLane = ns.currentLane;
      }

      const isSurge = puRef.current.active === "SURGE" && t < puRef.current.endTime;
      if (note.type === "hold" && !ns.hit && !ns.missed && !ns.holdActive && isSurge && t >= note.time) {
        ns.holdActive = true;
        ns.autoplayedBySurge = true;
        ns.currentLane = note.lane;
        ns.originLane = note.lane;
        audioManager.playSfx("tap_nav", 0.12);
      }

      if (ns.holdActive) {
        if (isSurge) {
          ns.autoplayedBySurge = true;
        }
        ns.holdProgress = Math.min(
          1,
          (t - note.time) / (note.holdDuration || 0.5),
        );
        if (isSurge && note.targetLane !== undefined) {
          ns.currentLane = note.lane + (note.targetLane - note.lane) * ns.holdProgress;
        }
      }

      const isPressed = ns.touchId !== undefined
        ? touchStartPos.current[ns.touchId] !== undefined
        : laneRef.current[Math.round(ns.currentLane)]?.pressed;

      if (ns.holdActive && ns.holdProgress >= 1 && (isSurge || ns.autoplayedBySurge || isPressed)) {
        if (note.swipeDirection && !isSurge && !ns.autoplayedBySurge) {
          // Swipe-release hold note: wait for the swipe input. Do not auto-hit.
        } else {
          ns.hit = true;
          ns.holdActive = false;
          const gs = gsRef.current;
          gs.score += calcScore(gs.combo, "PERFECT+");
          gs.combo++;
          gs.maxCombo = Math.max(gs.maxCombo, gs.combo);
          gameSenseService.sendHit();
          gameSenseService.sendCombo(gs.combo);
          gs.perfectPlus++;
          checkPowerUps(gs.combo);
          haptics.mediumTap();
          audioManager.playSfx("tap_nav", 0.15);
          triggerHitFx(ns.currentLane, "PERFECT+", hitY, note.swipeDirection);

          jRef.current = [
            ...jRef.current.filter((x) => Date.now() - x.ts < 600),
            { type: "PERFECT+", lane: ns.currentLane, id: ++jCounter.current, ts: Date.now() },
          ];
          dirty = true;
        }
      }

      if (ns.hit) continue;
      if (ns.missed) continue; // Guard: already marked missed (e.g. hold released early), don't double-count

      // Miss detection — skip entirely during rewind (notes travel backwards; no new misses)
      if (!isRewinding && phaseRef.current === "playing") {
        const MW = missWindow(songRef.current?.difficultyLevel ?? 5);
        const isMissed =
          (note.type === "tap" && !ns.holdActive && t > note.time + MW) ||
          (note.type === "swipe" && t > note.time + MW) ||
          (note.type === "hold" && !ns.holdActive && t > note.time + MW);

        if (isMissed) {
          const isSignalLock = puRef.current.active === "SIGNAL_LOCK" && t < puRef.current.endTime && shieldChargesRef.current > 0;
          if (isSignalLock) {
            shieldChargesRef.current--;
            const activeLabel = `SIGNAL LOCK (SHIELD x${shieldChargesRef.current})`;
            puRef.current.label = activeLabel;
            updatePuDisplayDOM({
              label: activeLabel,
              color: puRef.current.color,
              multiplier: puRef.current.multiplier,
              progress: (puRef.current.endTime - t) / puRef.current.duration,
            });
            if (shieldChargesRef.current <= 0) {
              puRef.current.endTime = 0;
              puRef.current.active = null;
              updatePuDisplayDOM(null);
              gameSenseService.sendPowerup(0);
            }
            audioManager.playSfx("tap_nav", 0.35);
            triggerHitFx(note.lane, "SHIELDED");

            ns.hit = true;
            const gsx = gsRef.current;
            gsx.score += calcScore(gsx.combo, "GOOD");
            gsx.combo++;
            gsx.maxCombo = Math.max(gsx.maxCombo, gsx.combo);
            gameSenseService.sendHit();
            gameSenseService.sendCombo(gsx.combo);
            gsx.goods++;
            checkPowerUps(gsx.combo);
            jRef.current = [
              ...jRef.current.filter((x) => Date.now() - x.ts < 600),
              {
                type: "SHIELDED",
                lane: note.lane,
                id: ++jCounter.current,
                ts: Date.now(),
              },
            ];
            dirty = true;
            syncDisplay();
          } else {
            ns.missed = true;
            lastMissLaneTimeRef.current[note.lane] = Date.now();
            const gsx = gsRef.current;
            gsx.combo = 0;
            gsx.misses++;
            gameSenseService.sendMiss();
            gameSenseService.sendCombo(0);
            // Deactivate power up on combo break
            puRef.current.active = null;
            puRef.current.endTime = 0;
            updatePuDisplayDOM(null);
            gameSenseService.sendPowerup(0);
            puRef.current.triggered.clear();
            haptics.error();

            jRef.current = [
              ...jRef.current.filter((x) => Date.now() - x.ts < 600),
              {
                type: "MISS",
                lane: note.lane,
                id: ++jCounter.current,
                ts: Date.now(),
              },
            ];
            muteLane(note.lane);
            dirty = true;
            const now = Date.now();
            if (now - lastMissTimeRef.current > 350) {
              missCountRef.current++;
              lastMissTimeRef.current = now;
            }
            setMissCount(missCountRef.current);
            gameSenseService.sendHealth(3 - missCountRef.current);
            syncDisplay();
            if (activeTutorial && missCountRef.current >= 3) {
              const audio = audioRef.current;
              if (audio) {
                audio.pause();
              }
              isTutorialHelpOpenRef.current = true;
              setIsTutorialHelpOpen(true);
              cancelAnimationFrame(rafRef.current);
              return;
            }

            if (triggerGameFail()) return;
          }
          continue;
        }
      }
      if (noteY < -80) continue;

      const { x: lx, w: lw } = laneAt(note.lane, prog, W);
      let noteH = lerp(22, 54, prog); // perspective scale — bigger closer
      let noteW = lw - 14;
      let noteX = lx + 7;
      if (modifierRef.current === 'bass_realm' && note.lane === 0) {
        noteH = noteH * 1.6; // 60% thicker notes
        noteW = noteW * 1.28; // 28% wider notes
        noteX = lx + 7 - (noteW - (lw - 14)) / 2;
      }
      const r = noteH * 0.32;

      const isMissedNote = ns.missed;
      const noteColor = isMissedNote ? "#FF3800" : lc;
      let drawX = noteX;

      // Spawn note trail particles as the note descends
      if (phase === "playing" && !isMissedNote) {
        if (Math.random() < 0.28) {
          noteTrailsRef.current.push({
            id: `${note.id}-${Math.random()}`,
            x: drawX,
            y: noteY,
            color: noteColor,
            size: 1.8 + Math.random() * 2.8,
            alpha: 0.48,
            birthTime: Date.now(),
          });
        }
      }

      if (isMissedNote) {
        ctx.save();
        ctx.globalAlpha = 0.38 * Math.max(0, (maxMissProg - prog) / (maxMissProg - 1.0));
        if (Math.random() < 0.2) {
          drawX += (Math.random() - 0.5) * 6; // Glitch horizontal offset
        }
      }

      if (note.type === "tap" || note.type === "swipe") {
        drawKey(ctx, drawX, noteY, noteW, noteH, r, noteColor, prog, false, note.swipeDirection);
      } else {
        // Hold/Slide trail — ivory ribbon with colored stripe
        const holdDur = note.holdDuration || 0.5;
        const headP = Math.max(0, prog - holdDur / AT);
        const headY = headP * hitY;

        // Determine lanes for trail rendering
        const startLane = note.lane;
        const endLane = note.targetLane !== undefined ? note.targetLane : note.lane;

        if (ns.holdActive) {
          const top = lerp(headY, hitY, ns.holdProgress);

          // Active hold dial and sparks visual exposition at the hit zone!
          const { x: ax_hold, w: aw_hold } = laneAt(ns.visualLane, 1, W);
          const holdX = ax_hold + aw_hold * 0.5;
          ctx.save();
          ctx.shadowColor = noteColor;
          ctx.shadowBlur = 20;
          const ringPulse = 1.0 + 0.12 * Math.sin(t * 18);
          
          // Glowing ring
          ctx.strokeStyle = noteColor;
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.arc(holdX, hitY, 18 * ringPulse, 0, Math.PI * 2);
          ctx.stroke();
          
          // Progress arc
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          ctx.arc(holdX, hitY, 14, -Math.PI / 2, -Math.PI / 2 + ns.holdProgress * Math.PI * 2);
          ctx.stroke();
          
          // Completion percent text
          ctx.fillStyle = "#ffffff";
          ctx.font = `900 8px "Space Mono", monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(`${Math.round(ns.holdProgress * 100)}%`, holdX, hitY);
          
          // Sizzling sparks
          ctx.fillStyle = noteColor;
          ctx.shadowColor = noteColor;
          ctx.shadowBlur = 8;
          for (let s = 0; s < 2; s++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 18 + Math.random() * 12;
            const sx = holdX + Math.cos(angle) * dist * ringPulse;
            const sy = hitY + Math.sin(angle) * dist * ringPulse;
            ctx.beginPath();
            ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();

          if (noteY > top) {
            // Determine lanes for the active trail segment
            const { x: hx, w: hw } = laneAt(endLane, headP, W);
            const { x: ax, w: aw } = laneAt(ns.visualLane, Math.min(prog, 1), W);
            const midY = (top + noteY) / 2;

            // Trail body (Curved to player's current lane)
            ctx.fillStyle = "rgba(245,240,228,0.22)";
            ctx.beginPath();
            ctx.moveTo(hx + hw * 0.25, top);
            ctx.lineTo(hx + hw * 0.75, top);
            ctx.quadraticCurveTo(ax + aw * 0.75, midY, ax + aw * 0.75, noteY + noteH / 2);
            ctx.lineTo(ax + aw * 0.25, noteY + noteH / 2);
            ctx.quadraticCurveTo(ax + aw * 0.25, midY, hx + hw * 0.25, top);
            ctx.fill();

            // ── Scrolling Active Trail Gridlines ──
            ctx.save();
            ctx.clip();
            const step = 28;
            const offset = (Date.now() / 6) % step;
            ctx.strokeStyle = "rgba(255, 255, 255, 0.14)";
            ctx.lineWidth = 2.0;
            for (let y = top - offset; y < noteY + noteH; y += step) {
              if (y < top) continue;
              const p_y = (y - top) / (noteY - top || 1);
              const trailP_y = lerp(headP, Math.min(prog, 1), p_y);
              const trailLane_y = lerp(endLane, ns.visualLane, p_y);
              const { x: wx, w: ww } = laneAt(trailLane_y, trailP_y, W);
              ctx.beginPath();
              ctx.moveTo(wx + ww * 0.25, y);
              ctx.lineTo(wx + ww * 0.75, y);
              ctx.stroke();
            }
            ctx.restore();

            // Parse note color to RGB for proper alpha compositing
            const lcR = parseInt(noteColor.slice(1, 3), 16);
            const lcG = parseInt(noteColor.slice(3, 5), 16);
            const lcB = parseInt(noteColor.slice(5, 7), 16);

            // ── ELECTRIC LIGHTNING ARCS ──
            const waveCount = 5;
            const trailLen = noteY - top;
            if (trailLen > 20) {
              ctx.save();
              ctx.shadowColor = noteColor;
              ctx.shadowBlur = 18;
              for (let i = 0; i < waveCount; i++) {
                const t_wave = (i + (t * 2.5) % 1) / waveCount;
                const wy = lerp(top + 6, noteY - 6, t_wave);
                const waveP = lerp(headP, Math.min(prog, 1), t_wave);
                const waveLane = lerp(endLane, ns.visualLane, t_wave);
                const { x: wx, w: ww } = laneAt(waveLane, waveP, W);
                const centerX = wx + ww * 0.5;
                const amp = ww * 0.25 * (0.5 + 0.5 * Math.sin(t * 10 + i * 2.1));
                const flicker = 0.4 + 0.6 * Math.abs(Math.sin(t * 18 + i * 3.7));

                // Main lightning arc - jagged segments
                ctx.strokeStyle = `rgba(${lcR},${lcG},${lcB},${flicker})`;
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.moveTo(centerX, wy - 6);
                
                const segments = 4;
                for (let j = 1; j <= segments; j++) {
                  const segY = lerp(wy - 6, wy + 10, j / segments);
                  const seed = t * 38 + i * 17 + j * 9;
                  const displacement = (Math.sin(seed) * 0.5 + Math.cos(seed * 1.6) * 0.5) * amp;
                  const segX = centerX + displacement;
                  ctx.lineTo(segX, segY);
                }
                ctx.stroke();

                // Bright white core
                ctx.strokeStyle = `rgba(255,255,255,${flicker * 0.6})`;
                ctx.lineWidth = 1.0;
                ctx.beginPath();
                ctx.moveTo(centerX, wy - 6);
                for (let j = 1; j <= segments; j++) {
                  const segY = lerp(wy - 6, wy + 10, j / segments);
                  const seed = t * 38 + i * 17 + j * 9;
                  const displacement = (Math.sin(seed) * 0.5 + Math.cos(seed * 1.6) * 0.5) * amp * 0.6;
                  const segX = centerX + displacement;
                  ctx.lineTo(segX, segY);
                }
                ctx.stroke();
              }
              ctx.restore();
            }

            // Colored stripe (Curved) with glow
            ctx.fillStyle = noteColor;
            ctx.globalAlpha = 0.65;
            ctx.shadowColor = noteColor;
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.moveTo(hx + hw * 0.38, top);
            ctx.lineTo(hx + hw * 0.62, top);
            ctx.quadraticCurveTo(ax + aw * 0.62, midY, ax + aw * 0.62, noteY + noteH / 2);
            ctx.lineTo(ax + aw * 0.38, noteY + noteH / 2);
            ctx.quadraticCurveTo(ax + aw * 0.38, midY, hx + hw * 0.38, top);
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.shadowBlur = 0;
            ctx.shadowColor = "transparent";

            // ── Slide direction arrow indicator at the hit line ──
            if (note.targetLane !== undefined && Math.abs(ns.visualLane - note.targetLane) > 0.05) {
              const arrowDir = note.targetLane > ns.visualLane ? 1 : -1;
              const arrowX = ax + aw * 0.5 + arrowDir * aw * 0.35;
              const arrowY = noteY;
              const arrowPulse = 0.5 + 0.5 * Math.sin(t * 8);
              ctx.save();
              ctx.globalAlpha = 0.6 + arrowPulse * 0.4;
              ctx.fillStyle = noteColor;
              ctx.shadowColor = noteColor;
              ctx.shadowBlur = 12;
              ctx.beginPath();
              ctx.moveTo(arrowX + arrowDir * 12, arrowY);
              ctx.lineTo(arrowX - arrowDir * 4, arrowY - 8);
              ctx.lineTo(arrowX - arrowDir * 4, arrowY + 8);
              ctx.closePath();
              ctx.fill();
              ctx.restore();
            }
            
            // Draw gold terminus block at top of active hold
            const tailP = lerp(headP, 1.0, ns.holdProgress);
            const { x: tx_active, w: tw_active } = laneAt(endLane, tailP, W);
            const tailH_active = lerp(22, 54, tailP);
            const tailW_active = tw_active - 14;
            const tailX_active = tx_active + 7;
            const tailR_active = tailH_active * 0.32;
            drawKey(ctx, tailX_active, top, tailW_active, tailH_active, tailR_active, noteColor, tailP, true, note.swipeDirection);
          }
        } else if (headY < noteY) {
          // Inactive trail — SMOOTH CURVE if it's a slide
          const { x: hx, w: hw } = laneAt(endLane, headP, W);
          const { x: tx, w: tw } = laneAt(startLane, prog, W);

          const midY = (headY + noteY) / 2;

          // Outer glow pulse for slide notes
          const isSlide = note.targetLane !== undefined;
          if (isSlide) {
            const glowPulse = 0.12 + 0.06 * Math.sin(t * 5);
            ctx.fillStyle = `rgba(245,240,228,${glowPulse})`;
            ctx.beginPath();
            ctx.moveTo(hx + hw * 0.18, headY);
            ctx.lineTo(hx + hw * 0.82, headY);
            ctx.quadraticCurveTo(tx + tw * 0.82, midY, tx + tw * 0.82, noteY + noteH / 2);
            ctx.lineTo(tx + tw * 0.18, noteY + noteH / 2);
            ctx.quadraticCurveTo(tx + tw * 0.18, midY, hx + hw * 0.18, headY);
            ctx.fill();
          }

          ctx.fillStyle = "rgba(245,240,228,0.18)";
          ctx.beginPath();
          ctx.moveTo(hx + hw * 0.25, headY);
          ctx.lineTo(hx + hw * 0.75, headY);
          ctx.quadraticCurveTo(tx + tw * 0.75, midY, tx + tw * 0.75, noteY + noteH / 2);
          ctx.lineTo(tx + tw * 0.25, noteY + noteH / 2);
          ctx.quadraticCurveTo(tx + tw * 0.25, midY, hx + hw * 0.25, headY);
          ctx.fill();

          // ── Scrolling Inactive Trail Gridlines ──
          ctx.save();
          ctx.clip();
          const inactiveStep = 32;
          const inactiveOffset = (Date.now() / 14) % inactiveStep;
          ctx.strokeStyle = "rgba(255, 255, 255, 0.07)";
          ctx.lineWidth = 1.5;
          for (let y = headY - inactiveOffset; y < noteY + noteH; y += inactiveStep) {
            if (y < headY) continue;
            const p_y = (y - headY) / (noteY - headY || 1);
            const trailP_y = lerp(headP, Math.min(prog, 1), p_y);
            const trailLane_y = lerp(endLane, startLane, p_y);
            const { x: wx, w: ww } = laneAt(trailLane_y, trailP_y, W);
            ctx.beginPath();
            ctx.moveTo(wx + ww * 0.25, y);
            ctx.lineTo(wx + ww * 0.75, y);
            ctx.stroke();
          }
          ctx.restore();

          // Colored center ribbon (curved)
          ctx.fillStyle = noteColor;
          ctx.globalAlpha = 0.5;
          ctx.shadowColor = noteColor;
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.moveTo(hx + hw * 0.38, headY);
          ctx.lineTo(hx + hw * 0.62, headY);
          ctx.quadraticCurveTo(tx + tw * 0.62, midY, tx + tw * 0.62, noteY + noteH / 2);
          ctx.lineTo(tx + tw * 0.38, noteY + noteH / 2);
          ctx.quadraticCurveTo(tx + tw * 0.38, midY, hx + hw * 0.38, headY);
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.shadowBlur = 0;
          ctx.shadowColor = "transparent";

          // ── Slide direction arrow at the tail (destination indicator) ──
          if (isSlide && note.targetLane !== undefined) {
            const arrowDir = note.targetLane > startLane ? 1 : -1;
            const arrowX = tx + tw * 0.5 + arrowDir * tw * 0.3;
            const arrowY2 = noteY - 2;
            const arrowPulse2 = 0.4 + 0.3 * Math.sin(t * 6);
            ctx.save();
            ctx.globalAlpha = arrowPulse2;
            ctx.fillStyle = noteColor;
            ctx.shadowColor = noteColor;
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.moveTo(arrowX + arrowDir * 10, arrowY2);
            ctx.lineTo(arrowX - arrowDir * 5, arrowY2 - 7);
            ctx.lineTo(arrowX - arrowDir * 5, arrowY2 + 7);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          }

          // Draw gold terminus block at the tail of the inactive hold (at headY)
          const tailH_inactive = lerp(22, 54, headP);
          const tailW_inactive = hw - 14;
          const tailX_inactive = hx + 7;
          const tailR_inactive = tailH_inactive * 0.32;
          drawKey(ctx, tailX_inactive, headY, tailW_inactive, tailH_inactive, tailR_inactive, noteColor, headP, true, note.swipeDirection);
        }
        drawKey(ctx, drawX, noteY, noteW, noteH, r, noteColor, prog, false, note.type === "hold" ? undefined : note.swipeDirection);
      }

      if (isMissedNote) {
        ctx.restore();
      }
    }

    // ── 5b. HIT EXPLOSION EFFECTS ───────────────────────────────
    const FX_DURATION = 520;
    hitFxRef.current = hitFxRef.current.filter(
      (e) => nowMs - e.startMs < FX_DURATION,
    );
    for (const e of hitFxRef.current) {
      const t01 = (nowMs - e.startMs) / FX_DURATION; // 0→1
      const dt = (nowMs - e.startMs) / 1000; // seconds
      const easeOut = 1 - t01;

      // ─ Lane flash: bright overlay on the key area fading fast ─
      if (t01 < 0.18) {
        const flashAlpha =
          (1 - t01 / 0.18) * (e.kind === "PERFECT+" ? 0.55 : 0.35);
        const { x: fx, w: fw } = laneAt(e.lane, 1, W);
        const flashGrad = ctx.createLinearGradient(
          fx,
          e.cy - 60,
          fx,
          e.cy + 40,
        );
        flashGrad.addColorStop(0, `${e.color}00`);
        flashGrad.addColorStop(
          0.4,
          `${e.color}${Math.round(flashAlpha * 255)
            .toString(16)
            .padStart(2, "0")}`,
        );
        flashGrad.addColorStop(
          1,
          `${e.color}${Math.round(flashAlpha * 0.5 * 255)
            .toString(16)
            .padStart(2, "0")}`,
        );
        ctx.fillStyle = flashGrad;
        ctx.fillRect(fx + 4, e.cy - 60, fw - 8, 100);
      }

      // ─ Expanding rings ─
      const rings = e.kind === "PERFECT+" ? 2 : 1;
      for (let r = 0; r < rings; r++) {
        const delay = r * 0.08;
        const rt = Math.max(0, (t01 - delay) / (1 - delay));
        if (rt <= 0) continue;
        const maxR = e.kind === "PERFECT+" ? (r === 0 ? 60 : 85) : 52;
        const ringR = rt * maxR;
        const ringAlpha = Math.pow(1 - rt, 1.6) * (r === 0 ? 0.9 : 0.55);
        const ringW = lerp(r === 0 ? 5 : 3, 0.5, rt);
        ctx.save();
        ctx.shadowColor = e.color;
        ctx.shadowBlur = 10;
        ctx.strokeStyle =
          e.color +
          Math.round(ringAlpha * 255)
            .toString(16)
            .padStart(2, "0");
        ctx.lineWidth = ringW;
        ctx.beginPath();
        ctx.arc(e.cx, e.cy, ringR, 0, Math.PI * 2);
        ctx.stroke();
        // White inner core ring (only first ring, very brief)
        if (r === 0 && t01 < 0.2) {
          const coreAlpha = (1 - t01 / 0.2) * 0.6;
          ctx.strokeStyle = `rgba(255,255,255,${coreAlpha})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(e.cx, e.cy, ringR * 0.45, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }

      // ─ Particles ─
      ctx.save();
      for (const p of e.particles) {
        const px = e.cx + p.vx * dt;
        const py = e.cy + p.vy * dt + (p.isSwipeLine ? 0 : 180 * dt * dt); // gravity only for tap particles
        const life = Math.max(0, 1 - t01 * 1.4);
        const size = p.size * (0.3 + 0.7 * (1 - t01));
        // Draw a glowing halo instead of expensive shadowBlur
        ctx.save();
        ctx.globalAlpha = life * 0.28;
        if (p.isSwipeLine) {
          ctx.strokeStyle = e.color;
          ctx.lineWidth = size * 2.8;
          ctx.beginPath();
          ctx.moveTo(px - p.vx * 0.035, py - p.vy * 0.035);
          ctx.lineTo(px, py);
          ctx.stroke();
        } else {
          ctx.fillStyle = e.color;
          ctx.beginPath();
          ctx.arc(px, py, size * 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();

        // Main core particle
        if (p.isSwipeLine) {
          ctx.strokeStyle = e.color + Math.round(life * 255).toString(16).padStart(2, "0");
          ctx.lineWidth = size * 1.6;
          ctx.beginPath();
          ctx.moveTo(px - p.vx * 0.035, py - p.vy * 0.035);
          ctx.lineTo(px, py);
          ctx.stroke();
        } else {
          ctx.fillStyle = e.color + Math.round(life * 255).toString(16).padStart(2, "0");
          ctx.beginPath();
          ctx.arc(px, py, size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.shadowBlur = 0;
      ctx.shadowColor = "transparent";

      // ─ PERFECT+ sparkle stars ─
      if (e.kind === "PERFECT+" && t01 < 0.6) {
        const starCount = 5;
        for (let s = 0; s < starCount; s++) {
          const angle = (s / starCount) * Math.PI * 2 + t01 * 2.5;
          const dist = 30 + t01 * 55;
          const sx = e.cx + Math.cos(angle) * dist;
          const sy = e.cy + Math.sin(angle) * dist;
          const starAlpha = Math.pow(1 - t01 / 0.6, 1.4) * 0.85;
          const starSize = lerp(5, 1.5, t01 / 0.6);
          ctx.strokeStyle =
            "#fff" +
            Math.round(starAlpha * 255)
              .toString(16)
              .padStart(2, "0");
          ctx.lineWidth = 1.5;
          ctx.shadowColor = "#fff";
          ctx.shadowBlur = 6;
          // 4-point star (two crossed lines)
          ctx.beginPath();
          ctx.moveTo(sx - starSize, sy);
          ctx.lineTo(sx + starSize, sy);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(sx, sy - starSize);
          ctx.lineTo(sx, sy + starSize);
          ctx.stroke();
        }
      }
      ctx.restore();
      void easeOut; // suppress unused warning
    }

    // ── 5d. KEY PRESS SHOCKWAVE RIPPLES ───────────────────────────
    for (let i = 0; i < LANE_COUNT; i++) {
      const tapAge = nowMs - lastTapTimeRef.current[i];
      if (tapAge < 250) {
        const rt = tapAge / 250;
        const { x: lx, w: lw } = laneAt(i, 1, W);
        const cx = lx + lw / 2;
        const ringR = rt * lw * 0.85;
        const ringAlpha = Math.pow(1 - rt, 1.4) * 0.65;
        const lc = getDifficultyLaneColor(laneColorsRef.current[i], songRef.current?.difficultyLevel ?? 5, i);

        ctx.save();
        ctx.strokeStyle = `rgba(255, 255, 255, ${ringAlpha})`;
        ctx.lineWidth = lerp(4, 0.5, rt);
        ctx.shadowColor = lc;
        ctx.shadowBlur = 15 * (1 - rt);
        ctx.beginPath();
        ctx.arc(cx, hitY, ringR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // ── 5e. COMBO MILESTONE EFFECTS ──────────────────────────────
    const MILESTONE_DURATION = 1000;
    milestoneFxRef.current = milestoneFxRef.current.filter(
      (m) => nowMs - m.startMs < MILESTONE_DURATION,
    );
    for (const m of milestoneFxRef.current) {
      const t01 = (nowMs - m.startMs) / MILESTONE_DURATION;
      const alpha = 1 - t01;

      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = m.color;
      ctx.shadowBlur = 20 * (1 - t01);

      // Expanding glow ring behind the text
      ctx.strokeStyle = `${m.color}${Math.round(alpha * 0.25 * 255).toString(16).padStart(2, "0")}`;
      ctx.lineWidth = 4 * (1 - t01);
      ctx.beginPath();
      ctx.arc(W / 2, H * 0.25, t01 * 180, 0, Math.PI * 2);
      ctx.stroke();

      // Floating text
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.font = `900 24px "Impact", sans-serif`;
      ctx.fillText(`${m.combo} COMBO!`, W / 2, H * 0.25 - t01 * 60);
      ctx.restore();
    }

    // ── 6. HIT ZONE BASELINE ────────────────────────────────────
    // Thick white glowing baseline — the stripe on the note must line up with this
    ctx.shadowColor = "rgba(255,255,255,0.8)";
    ctx.shadowBlur = 18;
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(hwBot.left - 16, hitY);
    ctx.lineTo(hwBot.right + 16, hitY);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";
    // Subtle glow bloom below baseline — pulses with rhythm
    const bloomH = 20 + pulse * 12;
    const baseGlow = ctx.createLinearGradient(0, hitY, 0, hitY + bloomH);
    baseGlow.addColorStop(0, `rgba(255,255,255,${0.08 + pulse * 0.06})`);
    baseGlow.addColorStop(1, "rgba(255,255,255,0.0)");
    ctx.fillStyle = baseGlow;
    ctx.fillRect(hwBot.left - 16, hitY, hwBot.width + 32, bloomH);

    // ── 6.5. MISSED SIGNAL RECLAIM TRAP (VOID TRAP / DATA LEAK COLLECTOR) ──
    const trapY = H - 55;
    for (let i = 0; i < LANE_COUNT; i++) {
      // Use the lane width and x at progress 1.0 (the baseline) since perspective lanes stop there
      const { x: lx, w: lw } = laneAt(i, 1.0, W);
      const x_start = lx + 8;
      const x_end = lx + lw - 8;
      const x_center = lx + lw / 2;
      
      const missTime = lastMissLaneTimeRef.current[i];
      const timeDiff = Date.now() - missTime;
      const active = timeDiff < 400;
      
      ctx.save();
      
      // If a note was recently missed in this lane, pulse the tray filled neon red glow
      if (active) {
        const fillAlpha = (1 - timeDiff / 400) * 0.42;
        ctx.fillStyle = `rgba(255, 56, 0, ${fillAlpha})`;
        // Pulsing neon shadow for the flash
        ctx.shadowColor = "#FF3800";
        ctx.shadowBlur = 15 + Math.sin(t * 25) * 8;
        ctx.fillRect(x_start, trapY, x_end - x_start, 12);
      }
      
      // Draw the bracket tray outline
      ctx.strokeStyle = active ? "#FF3800" : "rgba(255, 56, 0, 0.4)";
      ctx.lineWidth = active ? 2.5 : 1.5;
      if (active) {
        ctx.shadowColor = "#FF3800";
        ctx.shadowBlur = 10;
      } else {
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
      }
      
      ctx.beginPath();
      ctx.moveTo(x_start, trapY - 8);
      ctx.lineTo(x_start, trapY + 4);
      ctx.lineTo(x_end, trapY + 4);
      ctx.lineTo(x_end, trapY - 8);
      ctx.stroke();
      
      // Draw inner signal glitch lines in the tray if active
      if (active) {
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 1;
        ctx.beginPath();
        const glitchY = trapY + 4 - (timeDiff / 400) * 12;
        ctx.moveTo(x_start + 4, glitchY);
        ctx.lineTo(x_end - 4, glitchY);
        ctx.stroke();
      }
      
      ctx.restore();
      
      // Render text label under the bracket
      ctx.save();
      if (active) {
        ctx.fillStyle = "#FF3800";
        ctx.shadowColor = "#FF3800";
        ctx.shadowBlur = 6;
        ctx.font = `900 9px "Space Mono", monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText("DATA LEAK!", x_center, trapY + 8);
      } else {
        ctx.fillStyle = "rgba(255, 56, 0, 0.35)";
        ctx.shadowBlur = 0;
        ctx.font = `900 8px "Space Mono", monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText("VOID TRAP", x_center, trapY + 8);
      }
      ctx.restore();
    }

    // ── 7. MEDAL PROGRESS METER ─────────────────────────────────
    const MEDAL_STOPS = [
      { name: "BRONZE", acc: 40, color: "#CD7F32" },
      { name: "SILVER", acc: 60, color: "#C0C0C0" },
      { name: "GOLD", acc: 80, color: "#FFD700" },
      { name: "PLATINUM", acc: 93, color: "#E0E0FF" },
    ];
    const MEDAL_COLOR_MAP: Record<string, string> = {
      BRONZE: "#CD7F32",
      SILVER: "#C0C0C0",
      GOLD: "#FFD700",
      PLATINUM: "#E0E0FF",
      NONE: "#444",
    };
    const { perfectPlus: pp, perfects: pfp, goods: gd, misses: ms } = gs;
    const tot = pp + pfp + gd + ms;
    const acc = tot > 0 ? ((pp + pfp * 0.9 + gd * 0.5) / tot) * 100 : 0;
    const curMedal =
      acc >= 93
        ? "PLATINUM"
        : acc >= 80
          ? "GOLD"
          : acc >= 60
            ? "SILVER"
            : acc >= 40
              ? "BRONZE"
              : "NONE";

    // Trigger stamp on new medal
    if (curMedal !== "NONE" && curMedal !== lastMedalRef.current) {
      lastMedalRef.current = curMedal;
      medalStampRef.current = { medal: curMedal, startT: t };
    }

    // Bar geometry — thin strip at very bottom
    const bPad = 14;
    const bH = 7;
    const bY = H - bH - 8;
    const bX = bPad;
    const bW = W - bPad * 2;

    // Track bg
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.beginPath();
    ctx.roundRect(bX, bY, bW, bH, bH / 2);
    ctx.fill();

    // Filled portion
    const fillFrac = Math.min(acc / 93, 1);
    if (fillFrac > 0) {
      const fW = bW * fillFrac;
      const fg = ctx.createLinearGradient(bX, 0, bX + bW, 0);
      fg.addColorStop(0, "#CD7F32");
      fg.addColorStop(0.43, "#C0C0C0");
      fg.addColorStop(0.72, "#FFD700");
      fg.addColorStop(1, "#E0E0FF");
      ctx.shadowColor = MEDAL_COLOR_MAP[curMedal];
      ctx.shadowBlur = 10;
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.roundRect(bX, bY, fW, bH, bH / 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.shadowColor = "transparent";
      // Sheen highlight
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      ctx.beginPath();
      ctx.roundRect(bX, bY, fW, bH * 0.45, [bH / 2, bH / 2, 0, 0]);
      ctx.fill();
    }

    // Medal threshold ticks + labels
    for (const ms2 of MEDAL_STOPS) {
      const mx = bX + bW * (ms2.acc / 93);
      const achieved = fillFrac >= ms2.acc / 93;
      ctx.strokeStyle = achieved ? ms2.color : "rgba(100,100,100,0.5)";
      ctx.lineWidth = achieved ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(mx, bY - 5);
      ctx.lineTo(mx, bY + bH + 5);
      ctx.stroke();
      ctx.font = `bold 7px "Space Mono", monospace`;
      ctx.fillStyle = achieved ? ms2.color : "rgba(100,100,100,0.5)";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(ms2.name[0], mx, bY - 7);
    }

    // Medal stamp animation
    const stamp = medalStampRef.current;
    if (stamp) {
      const elapsed = t - stamp.startT;
      if (elapsed > 1.6) {
        medalStampRef.current = null;
      } else {
        const t01 = elapsed / 1.6;
        let scale: number;
        let alpha: number;
        if (t01 < 0.18) {
          // Smash in: huge → normal
          const inT = t01 / 0.18;
          scale = 2.6 - 1.6 * (1 - Math.pow(1 - inT, 2.5));
          alpha = 1;
        } else if (t01 < 0.72) {
          // Hold with triple bounce
          scale =
            1 + 0.08 * Math.abs(Math.sin(((t01 - 0.18) / 0.54) * Math.PI * 3));
          alpha = 1;
        } else {
          // Fade out
          scale = 1;
          alpha = 1 - (t01 - 0.72) / 0.28;
        }
        const mc = MEDAL_COLOR_MAP[stamp.medal] ?? "#fff";
        const scx = W / 2;
        const scy = H * 0.36;
        ctx.save();
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.translate(scx, scy);
        ctx.scale(scale, scale);
        // Glow halo
        ctx.shadowColor = mc;
        ctx.shadowBlur = 36;
        const sw = 230;
        const sh = 68;
        ctx.fillStyle = "rgba(8,8,12,0.82)";
        ctx.beginPath();
        ctx.roundRect(-sw / 2, -sh / 2, sw, sh, 10);
        ctx.fill();
        ctx.shadowBlur = 0;
        // Border
        ctx.strokeStyle = mc;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.roundRect(-sw / 2, -sh / 2, sw, sh, 10);
        ctx.stroke();
        // ★ MEDAL NAME ★
        ctx.fillStyle = mc;
        ctx.font = `bold 26px "Space Mono", monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`★ ${stamp.medal} ★`, 0, -8);
        // Sub-label
        ctx.font = `bold 10px "Space Mono", monospace`;
        ctx.fillStyle = "rgba(255,255,255,0.65)";
        ctx.fillText("MEDAL UNLOCKED", 0, 18);
        ctx.restore();
        ctx.globalAlpha = 1;
      }
    }

    if (dirty) syncDisplay();

    // ── lives indicator ──────────────────────────────────────────
    {
      const dotSize = 11;
      const dotGap = 6;
      const totalW = 3 * dotSize + 2 * dotGap;
      const startX = W - totalW - 18;
      const dotY = hitY - 32;
      for (let i = 0; i < 3; i++) {
        const active = i < missCountRef.current; // filled = miss accumulated
        ctx.save();
        ctx.globalAlpha = active ? 0.88 : 0.15;
        ctx.fillStyle = "#FF1493";
        ctx.shadowBlur = active ? 14 : 0;
        ctx.shadowColor = "#FF1493";
        ctx.fillRect(
          startX + i * (dotSize + dotGap),
          dotY - dotSize / 2,
          dotSize,
          dotSize,
        );
        ctx.restore();
      }
    }

    // ── Red vignette flash on miss ──
    {
      const missAge = Math.min(
        ...lastMissLaneTimeRef.current.map((t2) => nowMs - t2),
      );
      if (missAge < 350) {
        const intensity = (1 - missAge / 350) * 0.13;
        const vg = ctx.createRadialGradient(
          W / 2, H / 2, H * 0.25,
          W / 2, H / 2, H * 0.82,
        );
        vg.addColorStop(0, "rgba(255,0,0,0)");
        vg.addColorStop(1, `rgba(255,0,0,${intensity.toFixed(3)})`);
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, W, H);
      }
    }

    // Restore context for entire frame drawing
    ctx.restore();

    // ── 7. MODIFIER VISUAL EFFECTS & HUD OVERLAY ──────────────────
    const activeMod = modifierRef.current;
    if (activeMod !== 'none') {
      // 1. HUD Banner
      ctx.save();
      ctx.font = "bold 9px 'Roboto Mono', monospace";
      ctx.textAlign = "center";
      
      const bannerText = `[ SYSTEM MODIFIER: ACTIVE // ${(activeMod || 'none').replace('_', ' ').toUpperCase()} ]`;
      const bannerColor = activeMod === 'bass_realm' ? '#a855f7' : activeMod === 'corrupted_signal' ? '#f97316' : '#ffd700';
      
      // Draw background bar
      ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
      ctx.fillRect(W / 2 - 170, 10, 340, 22);
      ctx.strokeStyle = bannerColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(W / 2 - 170, 10, 340, 22);
      
      // Draw text
      ctx.fillStyle = bannerColor;
      ctx.fillText(bannerText, W / 2, 24);
      ctx.restore();
      
      // 2. Corrupted Signal scanlines & horizontal noise blocks
      if (activeMod === 'corrupted_signal') {
        ctx.save();
        // Periodic horizontal noise block
        if (Math.random() < 0.15) {
          const blockY = Math.random() * H;
          const blockH = 10 + Math.random() * 30;
          ctx.fillStyle = `rgba(249, 115, 22, ${0.08 + Math.random() * 0.1})`;
          ctx.fillRect(0, blockY, W, blockH);
        }
        // CRT horizontal scanlines
        ctx.strokeStyle = "rgba(0, 0, 0, 0.09)";
        ctx.lineWidth = 1;
        for (let y = 0; y < H; y += 4) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(W, y);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // ── end check — ONLY during playing phase ──
    // Never trigger during rewind or continue. The continue screen's auto-abandon
    // timer calls finishGame independently if the player doesn't act.
    if (phaseRef.current === "playing" && !isRewinding) {
      const audio = audioRef.current;
      const allDone = notesRef.current.every((ns) => ns.hit || ns.missed);
      const lastT = notesRef.current.length
        ? Math.max(...notesRef.current.map((ns) => ns.note.time))
        : 0;

      // Only treat audio as "ended" if it naturally finished (not paused for rewind)
      const audioEnded = audio ? audio.ended : false;

      if (activeTutorial && t >= 60.0) {
        finishGame();
        return;
      }

      if ((allDone && t > lastT + 1.2) || audioEnded || t >= song.duration) {
        finishGame();
        return;
      }
    }

    rafRef.current = requestAnimationFrame(() => drawRef.current?.());
  }, [getT, syncDisplay, finishGame, muteLane]);

  // Keep drawRef current so doReturn can schedule the loop without a circular dep
  useEffect(() => {
    drawRef.current = draw;
  }, [draw]);

  // ── keyboard ──
  const keysDownRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const key = e.key;
      keysDownRef.current.add(key);

      // ── Diagonal detection from arrow keys ──
      const isUp = keysDownRef.current.has("ArrowUp");
      const isDown = keysDownRef.current.has("ArrowDown");
      const isLeft = keysDownRef.current.has("ArrowLeft");
      const isRight = keysDownRef.current.has("ArrowRight");

      let swipeDir: Note['swipeDirection'] | undefined;
      if (isUp && isLeft) swipeDir = 'up-left';
      else if (isUp && isRight) swipeDir = 'up-right';
      else if (isDown && isLeft) swipeDir = 'down-left';
      else if (isDown && isRight) swipeDir = 'down-right';
      else if (isUp) swipeDir = 'up';
      else if (isDown) swipeDir = 'down';
      else if (isLeft) swipeDir = 'left';
      else if (isRight) swipeDir = 'right';

      // ── Numpad detection ──
      if (key === "7") swipeDir = 'up-left';
      else if (key === "9") swipeDir = 'up-right';
      else if (key === "1") swipeDir = 'down-left';
      else if (key === "3") swipeDir = 'down-right';
      else if (key === "8") swipeDir = 'up';
      else if (key === "2") swipeDir = 'down';
      else if (key === "4") swipeDir = 'left';
      else if (key === "6") swipeDir = 'right';

      if (swipeDir) {
        // For keyboard swipes, we apply it to the currently pressed lane
        // or all lanes if no lane key is held? 
        // Beatstar usually has swipes on specific lanes.
        // We'll look for a swipe note in any lane at this time.
        const t = getT();
        const cand = notesRef.current.find(n =>
          !n.hit && !n.missed && n.note.type === 'swipe' &&
          n.note.swipeDirection === swipeDir &&
          Math.abs(n.note.time - t) < missWindow(songRef.current?.difficultyLevel ?? 5)
        );
        if (cand) {
          hitLane(cand.note.lane, swipeDir);
          return;
        }

        const activeHoldWithSwipe = notesRef.current.find(n =>
          n.holdActive && !n.hit && !n.missed &&
          n.note.swipeDirection === swipeDir &&
          Math.abs((n.note.time + (n.note.holdDuration || 0.5)) - t) < missWindow(songRef.current?.difficultyLevel ?? 5)
        );
        if (activeHoldWithSwipe) {
          hitSwipeRelease(activeHoldWithSwipe, swipeDir);
          return;
        }

        // If it's an arrow-only press (left/right) and we are holding a slide, move it
        if (key === "ArrowLeft" || key === "ArrowRight") {
          const pressedLanes = laneRef.current.map(l => l.pressed);
          for (let i = 0; i < LANE_COUNT; i++) {
            if (pressedLanes[i]) {
              const activeHold = notesRef.current.find(
                (n) => n.note.type === "hold" && n.holdActive && n.currentLane === i && !n.hit
              );
              let nextLane: number;
              if (activeHold && activeHold.note.targetLane !== undefined) {
                const toRight = key === "ArrowRight";
                const isTargetInDirection = toRight
                  ? activeHold.note.targetLane > i
                  : activeHold.note.targetLane < i;
                nextLane = isTargetInDirection ? activeHold.note.targetLane : (toRight ? i + 1 : i - 1);
              } else {
                nextLane = key === "ArrowLeft" ? i - 1 : i + 1;
              }

              if (nextLane >= 0 && nextLane < LANE_COUNT) {
                laneRef.current[i].pressed = false;
                laneRef.current[nextLane].pressed = true;
                laneRef.current[nextLane].isArrow = key;
                moveHold(i, nextLane);
              }
            }
          }
          return;
        }
      }

      const lane = laneKeysRef.current.indexOf(key === " " ? " " : key.toLowerCase());
      if (lane < 0) return;

      // ── Check if there is an active hold/slide note that needs to transition to this lane ──
      const activeHold = notesRef.current.find(
        (n) =>
          n.note.type === "hold" &&
          n.holdActive &&
          n.note.targetLane === lane &&
          n.currentLane !== lane &&
          !n.hit
      );
      if (activeHold) {
        const prevLaneIdx = Math.round(activeHold.currentLane);
        if (laneRef.current[prevLaneIdx]) {
          laneRef.current[prevLaneIdx].pressed = false;
        }
        laneRef.current[lane].pressed = true;
        lastTapTimeRef.current[lane] = Date.now();
        laneRef.current[lane].isArrow = null;
        moveHold(activeHold.currentLane, lane);
        return;
      }

      laneRef.current[lane].pressed = true;
      lastTapTimeRef.current[lane] = Date.now();
      laneRef.current[lane].isArrow = null;
      hitLane(lane);
    };
    const onUp = (e: KeyboardEvent) => {
      keysDownRef.current.delete(e.key);
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        for (let i = 0; i < LANE_COUNT; i++) {
          if (laneRef.current[i].isArrow === e.key) {
            laneRef.current[i].pressed = false;
            laneRef.current[i].isArrow = null;
            releaseLane(i);
          }
        }
        return;
      }

      const lane = laneKeysRef.current.indexOf(e.key === " " ? " " : e.key.toLowerCase());
      if (lane < 0) return;
      laneRef.current[lane].pressed = false;
      releaseLane(lane);
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [hitLane, releaseLane, moveHold, getT, hitSwipeRelease]);

  // ── Gamepad API Controller Support ──
  const prevGamepadLanePressedRef = useRef<[boolean, boolean, boolean]>([false, false, false]);
  const prevGamepadPausePressedRef = useRef<boolean>(false);
  const gamepadLeftStickNeutralRef = useRef<boolean>(true);
  const gamepadRightStickNeutralRef = useRef<boolean>(true);
  // D-pad edge detection for swipes (Up=12,Down=13,Left=14,Right=15)
  const prevDpadRef = useRef<[boolean, boolean, boolean, boolean]>([false, false, false, false]);
  // True when a gamepad is actively connected — used by draw loop to show XYB labels
  const gamepadConnectedRef = useRef<boolean>(false);

  // Keep references to functions updated on every render to avoid stale closures in the loop
  const hitLaneRef = useRef<typeof hitLane | null>(null);
  const releaseLaneRef = useRef<typeof releaseLane | null>(null);
  const moveHoldRef = useRef<typeof moveHold | null>(null);
  const getTRef = useRef<typeof getT | null>(null);
  const doPauseRef = useRef<typeof doPause | null>(null);
  const doResumeRef = useRef<typeof doResume | null>(null);
  const hitSwipeReleaseRef = useRef<typeof hitSwipeRelease | null>(null);

  useEffect(() => {
    hitLaneRef.current = hitLane;
    releaseLaneRef.current = releaseLane;
    moveHoldRef.current = moveHold;
    getTRef.current = getT;
    doPauseRef.current = doPause;
    doResumeRef.current = doResume;
    hitSwipeReleaseRef.current = hitSwipeRelease;
  }); // No dependency array so it runs on every render

  useEffect(() => {
    let active = true;

    // Helper for analog stick flick detection
    const detectFlick = (x: number, y: number, neutralRef: React.MutableRefObject<boolean>) => {
      const magnitude = Math.hypot(x, y);
      if (magnitude < 0.25) {
        neutralRef.current = true;
      } else if (magnitude > 0.75 && neutralRef.current) {
        neutralRef.current = false;
        // Flick detected! Find direction.
        const angle = Math.atan2(y, x);
        const deg = (angle * (180 / Math.PI) + 360) % 360;
        let swipeDir: Note['swipeDirection'] | undefined;
        if (deg >= 337.5 || deg < 22.5) swipeDir = 'right';
        else if (deg >= 22.5 && deg < 67.5) swipeDir = 'down-right';
        else if (deg >= 67.5 && deg < 112.5) swipeDir = 'down';
        else if (deg >= 112.5 && deg < 157.5) swipeDir = 'down-left';
        else if (deg >= 157.5 && deg < 202.5) swipeDir = 'left';
        else if (deg >= 202.5 && deg < 247.5) swipeDir = 'up-left';
        else if (deg >= 247.5 && deg < 292.5) swipeDir = 'up';
        else swipeDir = 'up-right';

        if (swipeDir) {
          const t = getTRef.current ? getTRef.current() : 0;
          const cand = notesRef.current.find(n =>
            !n.hit && !n.missed && n.note.type === 'swipe' &&
            n.note.swipeDirection === swipeDir &&
            Math.abs(n.note.time - t) < missWindow(songRef.current?.difficultyLevel ?? 5)
          );
          if (cand && hitLaneRef.current) {
            hitLaneRef.current(cand.note.lane, swipeDir);
          } else {
            const activeHoldWithSwipe = notesRef.current.find(n =>
              n.holdActive && !n.hit && !n.missed &&
              n.note.swipeDirection === swipeDir &&
              Math.abs((n.note.time + (n.note.holdDuration || 0.5)) - t) < missWindow(songRef.current?.difficultyLevel ?? 5)
            );
            if (activeHoldWithSwipe && hitSwipeReleaseRef.current) {
              hitSwipeReleaseRef.current(activeHoldWithSwipe, swipeDir);
            }
          }
        }
      }
    };

    const pollGamepad = () => {
      if (!active) return;
      if (!getTRef.current) {
        gamepadRafRef.current = requestAnimationFrame(pollGamepad);
        return;
      }

      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      // Find the first active gamepad
      const gp = gamepads.find(g => g !== null);
      if (!gp) {
        gamepadConnectedRef.current = false;
        gamepadRafRef.current = requestAnimationFrame(pollGamepad);
        return;
      }
      gamepadConnectedRef.current = true;

      const phase = phaseRef.current;
      const paused = pausedRef.current;

      // ── 1. Pause / Menu Buttons ──
      // Start button is Button 9, Select is Button 8
      const pausePressed = (gp.buttons[9]?.pressed) || (gp.buttons[8]?.pressed);
      if (pausePressed && !prevGamepadPausePressedRef.current) {
        if (phase === 'playing') {
          if (paused) {
            doResumeRef.current?.();
          } else {
            doPauseRef.current?.();
          }
        }
      }
      prevGamepadPausePressedRef.current = pausePressed;

      // Only handle game inputs if we are playing and not paused/rewinding
      if (phase === 'playing' && !paused) {
        // ── 2. Swipe Flick detection on analog sticks ──
        // Left stick axes: 0 (X), 1 (Y)
        if (gp.axes[0] !== undefined && gp.axes[1] !== undefined) {
          detectFlick(gp.axes[0], gp.axes[1], gamepadLeftStickNeutralRef);
        }
        // Right stick axes: 2 (X), 3 (Y)
        if (gp.axes[2] !== undefined && gp.axes[3] !== undefined) {
          detectFlick(gp.axes[2], gp.axes[3], gamepadRightStickNeutralRef);
        }

        // ── 2b. D-pad swipe detection (rising-edge, supports diagonals) ──
        // Buttons: Up=12, Down=13, Left=14, Right=15
        const dUp    = gp.buttons[12]?.pressed || false;
        const dDown  = gp.buttons[13]?.pressed || false;
        const dLeft  = gp.buttons[14]?.pressed || false;
        const dRight = gp.buttons[15]?.pressed || false;
        const [prevDUp, prevDDown, prevDLeft, prevDRight] = prevDpadRef.current;
        const dpadChanged = dUp !== prevDUp || dDown !== prevDDown || dLeft !== prevDLeft || dRight !== prevDRight;
        if (dpadChanged && (dUp || dDown || dLeft || dRight)) {
          // Map cardinal/diagonal combos to swipe directions
          let dpadSwipe: Note['swipeDirection'] | undefined;
          if (dUp   && dLeft)  dpadSwipe = 'up-left';
          else if (dUp   && dRight) dpadSwipe = 'up-right';
          else if (dDown && dLeft)  dpadSwipe = 'down-left';
          else if (dDown && dRight) dpadSwipe = 'down-right';
          else if (dUp)    dpadSwipe = 'up';
          else if (dDown)  dpadSwipe = 'down';
          else if (dLeft)  dpadSwipe = 'left';
          else if (dRight) dpadSwipe = 'right';
          if (dpadSwipe) {
            const t = getTRef.current ? getTRef.current() : 0;
            const cand = notesRef.current.find(n =>
              !n.hit && !n.missed && n.note.type === 'swipe' &&
              n.note.swipeDirection === dpadSwipe &&
              Math.abs(n.note.time - t) < missWindow(songRef.current?.difficultyLevel ?? 5)
            );
            if (cand && hitLaneRef.current) {
              hitLaneRef.current(cand.note.lane, dpadSwipe);
            } else {
              const activeHoldWithSwipe = notesRef.current.find(n =>
                n.holdActive && !n.hit && !n.missed &&
                n.note.swipeDirection === dpadSwipe &&
                Math.abs((n.note.time + (n.note.holdDuration || 0.5)) - t) < missWindow(songRef.current?.difficultyLevel ?? 5)
              );
              if (activeHoldWithSwipe && hitSwipeReleaseRef.current) {
                hitSwipeReleaseRef.current(activeHoldWithSwipe, dpadSwipe);
              }
            }
          }
        }
        prevDpadRef.current = [dUp, dDown, dLeft, dRight];

        // ── 3. Direction and Face Buttons mapping ──
        // Determine current slide direction:
        // Left: D-pad Left (Button 14) or Left stick X < -0.5 or Right stick X < -0.5
        // Right: D-pad Right (Button 15) or Left stick X > 0.5 or Right stick X > 0.5
        let slideDir: 'left' | 'center' | 'right' = 'center';
        const stickXThreshold = 0.5;
        if (
          gp.buttons[14]?.pressed ||
          (gp.axes[0] !== undefined && gp.axes[0] < -stickXThreshold) ||
          (gp.axes[2] !== undefined && gp.axes[2] < -stickXThreshold)
        ) {
          slideDir = 'left';
        } else if (
          gp.buttons[15]?.pressed ||
          (gp.axes[0] !== undefined && gp.axes[0] > stickXThreshold) ||
          (gp.axes[2] !== undefined && gp.axes[2] > stickXThreshold)
        ) {
          slideDir = 'right';
        }

        // X, Y, B for the main buttons:
        // Button 2 is X (Left lane -> 0)
        // Button 3 is Y (Center lane -> 1)
        // Button 1 is B (Right lane -> 2)
        // Button 0 is A + D-pad Left/Right = slide trigger
        // NOTE: A alone does NOT fire any lane — it needs an explicit D-pad direction to avoid
        //       accidentally triggering the center (Y) lane when A is first pressed.
        const isAPressed = gp.buttons[0]?.pressed || false;
        
        const lanePressed: [boolean, boolean, boolean] = [
          (gp.buttons[2]?.pressed || false) || (isAPressed && slideDir === 'left'),
          (gp.buttons[3]?.pressed || false) || (isAPressed && slideDir === 'center'),
          (gp.buttons[1]?.pressed || false) || (isAPressed && slideDir === 'right')
        ];

        // Process presses and releases
        for (let i = 0; i < 3; i++) {
          const wasPressed = prevGamepadLanePressedRef.current[i];
          const isPressed = lanePressed[i];
          if (isPressed && !wasPressed) {
            // Lane press transition
            const activeHold = notesRef.current.find(
              (n) =>
                n.note.type === "hold" &&
                n.holdActive &&
                n.note.targetLane === i &&
                n.currentLane !== i &&
                !n.hit
            );
            if (activeHold) {
              const prevLaneIdx = Math.round(activeHold.currentLane);
              if (laneRef.current[prevLaneIdx]) {
                laneRef.current[prevLaneIdx].pressed = false;
              }
              laneRef.current[i].pressed = true;
              laneRef.current[i].isArrow = null;
              moveHoldRef.current?.(activeHold.currentLane, i);
            } else {
              laneRef.current[i].pressed = true;
              laneRef.current[i].isArrow = null;
              hitLaneRef.current?.(i);
            }
          } else if (!isPressed && wasPressed) {
            // Lane release transition
            laneRef.current[i].pressed = false;
            releaseLaneRef.current?.(i);
          }
        }
        prevGamepadLanePressedRef.current = lanePressed;
      } else {
        // If not playing or paused, make sure we clear pressed states to prevent sticking keys
        for (let i = 0; i < 3; i++) {
          if (prevGamepadLanePressedRef.current[i]) {
            laneRef.current[i].pressed = false;
            releaseLaneRef.current?.(i);
          }
        }
        prevGamepadLanePressedRef.current = [false, false, false];
      }

      gamepadRafRef.current = requestAnimationFrame(pollGamepad);
    };

    gamepadRafRef.current = requestAnimationFrame(pollGamepad);

    return () => {
      active = false;
      if (gamepadRafRef.current) {
        cancelAnimationFrame(gamepadRafRef.current);
      }
    };
  }, []);
  // NOTE: Keep touch, swipe, and hold note mechanics in sync with artifacts/rhythm-game/src/pages/Game.tsx
  const touchStartPos = useRef<Record<number, { x: number, y: number, lane: number, originLane?: number }>>({});

  // ── Gesture Lock (Prevent mobile browser back/forward swipe) ──
  useEffect(() => {
    const wrapper = canvasWrapperRef.current;
    if (!wrapper) return;

    const handlePrevent = (e: TouchEvent) => {
      // Only prevent default during active gameplay to stop pull-to-refresh/swipe-nav.
      // During 'continue', 'loading', 'paused' etc., allow normal touch→click synthesis
      // so that buttons (Continue, Abandon, etc.) work on mobile.
      const p = phaseRef.current;
      if ((p === 'playing' || p === 'rewinding') && e.cancelable) {
        e.preventDefault();
      }
    };

    // Use native listener with passive: false to ensure preventDefault() works
    wrapper.addEventListener('touchstart', handlePrevent, { passive: false });
    wrapper.addEventListener('touchmove', handlePrevent, { passive: false });
    wrapper.addEventListener('touchend', handlePrevent, { passive: false });

    return () => {
      wrapper.removeEventListener('touchstart', handlePrevent);
      wrapper.removeEventListener('touchmove', handlePrevent);
      wrapper.removeEventListener('touchend', handlePrevent);
    };
  }, []);

  const resetAllLanes = useCallback(() => {
    touchStartPos.current = {};
    for (let lane = 0; lane < LANE_COUNT; lane++) {
      if (laneRef.current[lane].pressed) {
        laneRef.current[lane].pressed = false;
        laneRef.current[lane].touchId = undefined;
        releaseLane(lane);
      }
    }
  }, [releaseLane]);

  const checkSwipeGesture = useCallback(
    (touch: React.Touch | Touch, start: { x: number; y: number; lane: number; originLane?: number }) => {
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 25) { // Flick threshold
        const angle = Math.atan2(dy, dx);
        const dirs: Note['swipeDirection'][] = [
          'right', 'down-right', 'down', 'down-left', 'left', 'up-left', 'up', 'up-right'
        ];
        let normAngle = angle;
        if (normAngle < 0) normAngle += Math.PI * 2;
        const bucket = Math.round(normAngle / (Math.PI / 4)) % 8;
        const swipeDir = dirs[bucket];

        const t = getT();
        const checkLane = start.originLane !== undefined ? start.originLane : start.lane;
        const cand = notesRef.current.find(n =>
          !n.hit && !n.missed && n.note.type === 'swipe' &&
          n.note.swipeDirection === swipeDir &&
          n.note.lane === checkLane &&
          Math.abs(n.note.time - t) < missWindow(songRef.current?.difficultyLevel ?? 5)
        );
        if (cand) {
          hitLane(checkLane, swipeDir);
          start.x = touch.clientX;
          start.y = touch.clientY;
          return true;
        }

        const activeHoldWithSwipe = notesRef.current.find(n =>
          n.holdActive && !n.hit && !n.missed &&
          n.note.swipeDirection === swipeDir &&
          n.currentLane === checkLane &&
          Math.abs((n.note.time + (n.note.holdDuration || 0.5)) - t) < missWindow(songRef.current?.difficultyLevel ?? 5)
        );
        if (activeHoldWithSwipe) {
          hitSwipeRelease(activeHoldWithSwipe, swipeDir);
          start.x = touch.clientX;
          start.y = touch.clientY;
          return true;
        }
      }
      return false;
    },
    [getT, hitLane, hitSwipeRelease],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      usePointerEventsRef.current = true;
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;

      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}

      const rect = canvas.getBoundingClientRect();
      const rawLane = Math.floor(
        ((e.clientX - rect.left) / rect.width) * LANE_COUNT,
      );
      const lane = Math.max(0, Math.min(LANE_COUNT - 1, rawLane));
      laneRef.current[lane].pressed = true;
      lastTapTimeRef.current[lane] = Date.now();
      laneRef.current[lane].touchId = e.pointerId;
      touchStartPos.current[e.pointerId] = { x: e.clientX, y: e.clientY, lane, originLane: lane };
      hitLane(lane, undefined, e.pointerId);
    },
    [hitLane],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!usePointerEventsRef.current) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const rawLane = Math.floor(
        ((e.clientX - rect.left) / rect.width) * LANE_COUNT,
      );
      const newLane = Math.max(0, Math.min(LANE_COUNT - 1, rawLane));

      const start = touchStartPos.current[e.pointerId];
      if (start) {
        checkSwipeGesture(e as unknown as Touch, start);
      }

      if (newLane >= 0 && newLane < LANE_COUNT) {
        for (let l = 0; l < LANE_COUNT; l++) {
          if (laneRef.current[l].touchId === e.pointerId && l !== newLane) {
            laneRef.current[l].pressed = false;
            laneRef.current[l].touchId = undefined;
            laneRef.current[newLane].pressed = true;
            laneRef.current[newLane].touchId = e.pointerId;
            if (start) start.lane = newLane;

            // Directly track and update active hold notes by touchId
            const ns = notesRef.current.find(
              (n) => n.note.type === "hold" && n.holdActive && n.touchId === e.pointerId && !n.hit
            );
            if (ns && ns.note.targetLane !== undefined) {
              const reachedTarget = newLane === ns.note.targetLane && ns.currentLane !== ns.note.targetLane;
              ns.currentLane = newLane;

              if (reachedTarget) {
                audioManager.playSfx("hidden_secret_found", 0.3);

                // ── Slide success particle effect ──
                const W = canvas.width / (window.devicePixelRatio || 1);
                const H = canvas.height / (window.devicePixelRatio || 1);
                const hitY = H * HIT_RATIO;
                const { x: lx, w: lw } = laneAt(newLane, 1, W);
                const cx = lx + lw / 2;
                const lc = getDifficultyLaneColor(laneColorsRef.current[newLane], songRef.current?.difficultyLevel ?? 5, newLane);
                const particles: HitParticle[] = [];
                for (let i = 0; i < 6; i++) {
                  const angle = (Math.random() - 0.5) * Math.PI;
                  const speed = 40 + Math.random() * 60;
                  particles.push({
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed - 20,
                    size: 2 + Math.random() * 3,
                  });
                }
                hitFxRef.current.push({
                  lane: newLane,
                  startMs: Date.now(),
                  cx,
                  cy: hitY,
                  color: lc,
                  kind: "GOOD",
                  particles,
                });
              }
            }
            break;
          }
        }
      }
    },
    [checkSwipeGesture],
  );

  const releasePointerById = useCallback(
    (identifier: number) => {
      delete touchStartPos.current[identifier];
      for (let lane = 0; lane < LANE_COUNT; lane++) {
        if (laneRef.current[lane].touchId === identifier) {
          laneRef.current[lane].pressed = false;
          laneRef.current[lane].touchId = undefined;
        }
      }
      const ns = notesRef.current.find(
        (n) => n.note.type === "hold" && n.holdActive && n.touchId === identifier && !n.hit
      );
      if (ns) {
        completeHoldNote(ns);
      }
    },
    [completeHoldNote],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!usePointerEventsRef.current) return;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}

      const start = touchStartPos.current[e.pointerId];
      if (start) {
        checkSwipeGesture(e as unknown as Touch, start);
      }
      releasePointerById(e.pointerId);
      if (Object.keys(touchStartPos.current).length === 0) {
        resetAllLanes();
      }
    },
    [releasePointerById, checkSwipeGesture, resetAllLanes],
  );

  const onPointerCancel = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!usePointerEventsRef.current) return;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}

      const start = touchStartPos.current[e.pointerId];
      if (start) {
        checkSwipeGesture(e as unknown as Touch, start);
      }
      releasePointerById(e.pointerId);
      if (Object.keys(touchStartPos.current).length === 0) {
        resetAllLanes();
      }
    },
    [releasePointerById, checkSwipeGesture, resetAllLanes],
  );

  const onTouchStart = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      if (usePointerEventsRef.current) return;
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const rawLane = Math.floor(
          ((touch.clientX - rect.left) / rect.width) * LANE_COUNT,
        );
        const lane = Math.max(0, Math.min(LANE_COUNT - 1, rawLane));
        laneRef.current[lane].pressed = true;
        lastTapTimeRef.current[lane] = Date.now();
        laneRef.current[lane].touchId = touch.identifier;
        touchStartPos.current[touch.identifier] = { x: touch.clientX, y: touch.clientY, lane, originLane: lane };
        hitLane(lane, undefined, touch.identifier);
      }
    },
    [hitLane],
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      if (usePointerEventsRef.current) return;
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const rawLane = Math.floor(
          ((touch.clientX - rect.left) / rect.width) * LANE_COUNT,
        );
        const newLane = Math.max(0, Math.min(LANE_COUNT - 1, rawLane));

        // Swipe detection while moving
        const start = touchStartPos.current[touch.identifier];
        if (start) {
          checkSwipeGesture(touch, start);
        }

        if (newLane >= 0 && newLane < LANE_COUNT) {
          for (let l = 0; l < LANE_COUNT; l++) {
            if (laneRef.current[l].touchId === touch.identifier && l !== newLane) {
              laneRef.current[l].pressed = false;
              laneRef.current[l].touchId = undefined;
              laneRef.current[newLane].pressed = true;
              laneRef.current[newLane].touchId = touch.identifier;
              if (start) start.lane = newLane;

              // Directly track and update active hold notes by touchId
              const ns = notesRef.current.find(
                (n) => n.note.type === "hold" && n.holdActive && n.touchId === touch.identifier && !n.hit
              );
              if (ns && ns.note.targetLane !== undefined) {
                const reachedTarget = newLane === ns.note.targetLane && ns.currentLane !== ns.note.targetLane;
                ns.currentLane = newLane;

                if (reachedTarget) {
                  audioManager.playSfx("hidden_secret_found", 0.3);

                  // ── Slide success particle effect ──
                  const canvas = canvasRef.current;
                  if (canvas) {
                    const W = canvas.width;
                    const H = canvas.height;
                    const hitY = H * HIT_RATIO;
                    const { x: lx, w: lw } = laneAt(newLane, 1, W);
                    const cx = lx + lw / 2;
                    const lc = getDifficultyLaneColor(laneColorsRef.current[newLane], songRef.current?.difficultyLevel ?? 5, newLane);
                    const particles: HitParticle[] = [];
                    for (let i = 0; i < 6; i++) {
                      const angle = (Math.random() - 0.5) * Math.PI;
                      const speed = 40 + Math.random() * 60;
                      particles.push({
                        vx: Math.cos(angle) * speed,
                        vy: Math.sin(angle) * speed - 20,
                        size: 2 + Math.random() * 3,
                      });
                    }
                    hitFxRef.current.push({
                      lane: newLane,
                      startMs: Date.now(),
                      cx,
                      cy: hitY,
                      color: lc,
                      kind: "GOOD",
                      particles,
                    });
                  }
                }
              }
              break;
            }
          }
        }
      }
    },
    [checkSwipeGesture],
  );

  const releaseTouchById = useCallback(
    (identifier: number) => {
      delete touchStartPos.current[identifier];
      for (let lane = 0; lane < LANE_COUNT; lane++) {
        if (laneRef.current[lane].touchId === identifier) {
          laneRef.current[lane].pressed = false;
          laneRef.current[lane].touchId = undefined;
        }
      }
      const ns = notesRef.current.find(
        (n) => n.note.type === "hold" && n.holdActive && n.touchId === identifier && !n.hit
      );
      if (ns) {
        completeHoldNote(ns);
      }
    },
    [completeHoldNote],
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      if (usePointerEventsRef.current) return;
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const start = touchStartPos.current[touch.identifier];
        if (start) {
          checkSwipeGesture(touch, start);
        }
        releaseTouchById(touch.identifier);
      }
      if (e.touches.length === 0) {
        resetAllLanes();
      }
    },
    [releaseTouchById, checkSwipeGesture, resetAllLanes],
  );

  const onTouchCancel = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      if (usePointerEventsRef.current) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const start = touchStartPos.current[touch.identifier];
        if (start) {
          checkSwipeGesture(touch, start);
        }
        releaseTouchById(touch.identifier);
      }
      if (e.touches.length === 0) {
        resetAllLanes();
      }
    },
    [releaseTouchById, checkSwipeGesture, resetAllLanes],
  );

  const onTouchMoveRef = useRef(onTouchMove);
  const onTouchEndRef = useRef(onTouchEnd);
  const onTouchCancelRef = useRef(onTouchCancel);

  useEffect(() => {
    onTouchMoveRef.current = onTouchMove;
    onTouchEndRef.current = onTouchEnd;
    onTouchCancelRef.current = onTouchCancel;
  }, [onTouchMove, onTouchEnd, onTouchCancel]);

  useEffect(() => {
    const handleMove = (e: TouchEvent) => {
      if (usePointerEventsRef.current) return;
      const p = phaseRef.current;
      if (p !== 'playing' && p !== 'rewinding') return;
      onTouchMoveRef.current(e as unknown as React.TouchEvent<HTMLCanvasElement>);
    };
    const handleEnd = (e: TouchEvent) => {
      if (usePointerEventsRef.current) return;
      const p = phaseRef.current;
      if (p !== 'playing' && p !== 'rewinding') return;
      onTouchEndRef.current(e as unknown as React.TouchEvent<HTMLCanvasElement>);
    };
    const handleCancel = (e: TouchEvent) => {
      if (usePointerEventsRef.current) return;
      const p = phaseRef.current;
      if (p !== 'playing' && p !== 'rewinding') return;
      onTouchCancelRef.current(e as unknown as React.TouchEvent<HTMLCanvasElement>);
    };

    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd, { passive: false });
    window.addEventListener('touchcancel', handleCancel, { passive: false });

    return () => {
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
      window.removeEventListener('touchcancel', handleCancel);
    };
  }, []);

  // Synchronize gameplay overlay status to body classes for virtual controller cursor
  useEffect(() => {
    if (paused) {
      document.body.classList.add("gameplay-paused");
    } else {
      document.body.classList.remove("gameplay-paused");
    }
    return () => {
      document.body.classList.remove("gameplay-paused");
    };
  }, [paused]);

  useEffect(() => {
    if (phase === "continue") {
      document.body.classList.add("gameplay-continue");
    } else {
      document.body.classList.remove("gameplay-continue");
    }
    if (phase === "audioError") {
      document.body.classList.add("gameplay-audio-error");
    } else {
      document.body.classList.remove("gameplay-audio-error");
    }
    if (phase === "loadError") {
      document.body.classList.add("gameplay-load-error");
    } else {
      document.body.classList.remove("gameplay-load-error");
    }
    return () => {
      document.body.classList.remove("gameplay-continue");
      document.body.classList.remove("gameplay-audio-error");
      document.body.classList.remove("gameplay-load-error");
    };
  }, [phase]);

  useEffect(() => {
    if (isTutorialHelpOpen) {
      document.body.classList.add("gameplay-tutorial-help");
    } else {
      document.body.classList.remove("gameplay-tutorial-help");
    }
    return () => {
      document.body.classList.remove("gameplay-tutorial-help");
    };
  }, [isTutorialHelpOpen]);

  // ── canvas resize — useLayoutEffect so dimensions are set before first paint ──
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = canvasWrapperRef.current;
    if (!canvas || !wrapper) return;
    const sync = () => {
      const W = wrapper.clientWidth;
      const H = wrapper.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      const canvasWidth = Math.floor(W * dpr);
      const canvasHeight = Math.floor(H * dpr);
      // Only reassign when dimensions actually changed — setting canvas.width/height
      // always clears the canvas and resets the 2D context, causing visible flicker.
      if (W > 0 && H > 0 && (canvas.width !== canvasWidth || canvas.height !== canvasHeight)) {
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        canvas.style.width = `${W}px`;
        canvas.style.height = `${H}px`;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.resetTransform();
          ctx.scale(dpr, dpr);
        }
        
        // Pre-render static track surface offscreen cache on resize
        const diffLevel = songRef.current?.difficultyLevel ?? 5;
        offscreenCanvasRef.current = prerenderStaticTrack(
          W,
          H,
          dpr,
          diffLevel,
          laneColorsRef.current
        );
      }
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(wrapper);
    return () => ro.disconnect();
  }, []);

  // ── init ──
  useEffect(() => {
    console.log("[GamePlay Init Hook] Triggered with songId:", songId);
    if (!songId) {
      console.warn("[GamePlay Init Hook] No songId provided, redirecting to /songs");
      setLocation("/songs");
      return;
    }
    let cancelled = false;
    let audio: HTMLAudioElement | null = null;
    let onProgress: (() => void) | null = null;
    let onCanPlay: (() => void) | null = null;
    let onError: (() => void) | null = null;

    const init = async () => {
      resetPuDisplayDOM();
      if (stingerTimeout1Ref.current) clearTimeout(stingerTimeout1Ref.current);
      if (stingerTimeout2Ref.current) clearTimeout(stingerTimeout2Ref.current);
      lastDetectedStageRef.current = 1;
      setCurrentStage(1);
      setStageStingerNumber(null);
      try {
        console.log("[GamePlay Init] Fetching song for ID:", songId);
        setLoadMsg("FETCHING TRANSMISSION...");
        phaseRef.current = "loading";
        setPhase("loading");
        let song = await getSongById(songId);
        if (song) {
          song = { ...song, notes: [...(song.notes || [])] };
          if (song.notes.length === 0 && !activeTutorial) {
            setLoadMsg("FORGING AUDIO BEATMAP...");
            try {
              song.notes = await generateAudioForgeChart(song);
            } catch (err) {
              console.warn("[GamePlay Init] Audio Forge failed, falling back to procedural grid:", err);
              // Fallback to math generation on fetch/CORS/decode error
              song.notes = generateProceduralChart(song);
            }
          }
        }
        console.log("[GamePlay Init] Fetched song:", song);

        const origin = sessionStorage.getItem(`game_origin_${songId}`) ?? '';
        const originRoute = origin === 'songs' ? '/songs' : origin ? `/${origin}` : '/campaign';
        const modifier = (sessionStorage.getItem(`active_modifier_type_${songId}`) || 'none') as any;
        modifierRef.current = modifier;
        setActiveModifier(modifier);
        console.log("[GamePlay Init] origin:", origin, "originRoute:", originRoute, "modifier:", modifier);

        if (cancelled) {
          console.log("[GamePlay Init] Execution cancelled");
          return;
        }

        if (!song) {
          console.error("[GamePlay Init] Song not found in catalog! Redirecting to:", originRoute);
          setLocation(originRoute);
          return;
        }

        if (activeTutorial) {
          song.difficultyLevel = 1;
          const bpm = song.bpm || 120;
          const beatDur = 60 / bpm;
          const generatedNotes: Note[] = [];
          let time = 3.0;
          let id = 0;
          while (time < 58) {
            const lane = id % 3;
            let type: 'tap' | 'hold' | 'swipe' = 'tap';
            let holdDuration: number | undefined;
            let swipeDirection: 'up' | undefined;

            if (id % 4 === 1) {
              type = 'hold';
              holdDuration = beatDur * 2;
            } else if (id % 4 === 3) {
              type = 'swipe';
              swipeDirection = 'up';
            }

            generatedNotes.push({
              id: id++,
              time,
              lane,
              type,
              holdDuration,
              swipeDirection
            });

            time += beatDur * 4;
          }
          song.notes = generatedNotes;
        }
        
        // Reset pause state on new song load
        pausedRef.current = false;
        setPaused(false);

        const collection = useVaultStore.getState().collection;
        const isOwned = Array.isArray(collection) ? collection.some(c => c && (c.cardId === songId || `card-${c.card?.day}` === songId)) : false;
        const isLocked = !isOwned && isSongTimeLocked(song);
        console.log("[GamePlay Init] isSongTimeLocked evaluated:", isLocked, "for song day:", song.day, "date:", song.date, "isOwned:", isOwned);
        if (isLocked) {
          console.warn("[GamePlay Init] Song is time-locked! Redirecting to:", originRoute);
          setLocation(originRoute);
          return;
        }
      songRef.current = song;
      
      // Initialize GameSense on song load
      gameSenseService.init().then((status) => {
        if (status === 'connected') {
          const modifier = getModifierForSong(song);
          const modifierCode = modifier === "vocal_isolation" ? 1 : modifier === "bass_realm" ? 2 : modifier === "corrupted_signal" ? 3 : 0;
          gameSenseService.sendModifier(modifierCode);
          gameSenseService.sendHealth(3);
          gameSenseService.sendCombo(0);
          gameSenseService.sendPowerup(0);
        }
      });

      // Re-generate offscreen static track cache when song loads and overrides are applied
      const canvas = canvasRef.current;
      if (canvas) {
        const dpr = window.devicePixelRatio || 1;
        const W = canvas.width / dpr;
        const H = canvas.height / dpr;
        offscreenCanvasRef.current = prerenderStaticTrack(
          W,
          H,
          dpr,
          songRef.current.difficultyLevel,
          laneColorsRef.current
        );
      }
      // Apply difficulty override set by SongDetail page
      const diffOverrideNum = parseInt(sessionStorage.getItem(`diff_override_${songId}`) ?? '', 10);
      if (!isNaN(diffOverrideNum) && diffOverrideNum >= 1 && diffOverrideNum <= 10 && !activeTutorial) {
        songRef.current.difficultyLevel = diffOverrideNum;
      }

      // Log game start telemetry event
      logAnalyticsEvent('game_start', {
        songId: songId,
        songTitle: songRef.current.title,
        difficulty: songRef.current.difficultyLevel,
        background: opts.gameBackground || 'cover_blur'
      });

      // Initialize ambient particles depending on difficulty
      const diffLvl = songRef.current.difficultyLevel;
      const partCount = diffLvl <= 3 ? 8 : diffLvl <= 6 ? 12 : 18;
      const ambientParts: AmbientParticle[] = [];
      for (let i = 0; i < partCount; i++) {
        ambientParts.push({
          x: Math.random() * 800,
          y: Math.random() * 600,
          vx: (Math.random() - 0.5) * (diffLvl <= 3 ? 15 : diffLvl <= 6 ? 30 : 55),
          vy: -30 - Math.random() * (diffLvl <= 3 ? 20 : diffLvl <= 6 ? 40 : 80),
          size: 1.5 + Math.random() * 2.5,
          alpha: 0.12 + Math.random() * 0.38,
        });
      }
      ambientParticlesRef.current = ambientParts;
      // Pre-load + pre-blur cover art for background effect
      coverImgRef.current = null;
      coverBlurRef.current = null;
      scanPatternRef.current = null;
      if (song.coverArt) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          if (cancelled) return;
          coverImgRef.current = img;
          const off = document.createElement("canvas");
          off.width = 512;
          off.height = 512;
          const offCtx = off.getContext("2d")!;
          offCtx.filter = "blur(10px) brightness(0.52) saturate(1.5)";
          offCtx.drawImage(img, -24, -24, 560, 560);
          offCtx.filter = "none";
          coverBlurRef.current = off;
        };
        img.src = song.coverArt;
      }
      notesRef.current = song.notes.map((n, idx) => {
        let note = { ...n, lane: Math.min(n.lane, LANE_COUNT - 1) };
        const diff = songRef.current?.difficultyLevel ?? 5;

        // ── Mechanic gating by difficulty ──

        // Swipe notes only at Normal+ (Level 4+)
        if (diff < 4 && note.type === 'swipe') {
          note.type = 'tap';
          note.swipeDirection = undefined;
        }

        // Lane-change holds (slides) only at Hard+ (Level 7+)
        if (diff < 7 && note.type === 'hold' && note.targetLane !== undefined) {
          note.targetLane = undefined;
          note.swipeDirection = undefined;
        }

        // Dual notes (same time, different lane) only at Level 5+
        // For lower difficulties, drop the second note of a dual pair
        if (diff < 5 && idx > 0) {
          const prev = song.notes[idx - 1];
          if (prev && Math.abs(prev.time - note.time) < 0.01 && prev.lane !== note.lane) {
            // This is the second note of a dual — skip it at low difficulty
            return null;
          }
        }

        // Shorten holds at easy difficulties so they're less punishing
        if (diff <= 3 && note.type === 'hold' && note.holdDuration) {
          note.holdDuration = Math.min(note.holdDuration, 0.8);
        }

        return {
          note,
          hit: false,
          missed: false,
          holdActive: false,
          holdProgress: 0,
          currentLane: note.lane,
          originLane: note.lane,
          visualLane: note.lane,
        };
      }).filter((ns): ns is NonNullable<typeof ns> => ns !== null);

      // ── Note thinning for easy difficulties (rhythm-aware temporal filtering) ──
      const dLevel = songRef.current?.difficultyLevel ?? 5;
      if (dLevel <= 2) {
        let lastTime = -999;
        notesRef.current = notesRef.current.filter(ns => {
          if (ns.note.time - lastTime < 0.38) {
            return false; // drop notes closer than 380ms (e.g. rapid taps)
          }
          lastTime = ns.note.time;
          return true;
        });
      } else if (dLevel === 3) {
        let lastTime = -999;
        notesRef.current = notesRef.current.filter(ns => {
          if (ns.note.time - lastTime < 0.28) {
            return false; // drop notes closer than 280ms
          }
          lastTime = ns.note.time;
          return true;
        });
      }
      // Calculate max possible score for percentage metrics simulating perfect play
      const getComboMul = (c: number) => {
        if (dLevel <= 3) return c < 10 ? 1 : c < 25 ? 1.5 : c < 50 ? 2 : 3;
        if (dLevel <= 6) return c < 10 ? 1 : c < 25 ? 1.5 : c < 50 ? 2 : c < 75 ? 3 : 4;
        return c < 10 ? 1 : c < 25 ? 1.5 : c < 50 ? 2 : c < 75 ? 3 : c < 100 ? 4 : 5;
      };

      interface ScoreEvent {
        time: number;
      }
      const scoreEvents: ScoreEvent[] = [];
      notesRef.current.forEach(ns => {
        if (ns.note.type === "hold") {
          scoreEvents.push({ time: ns.note.time });
          scoreEvents.push({ time: ns.note.time + (ns.note.holdDuration || 0.5) });
        } else {
          scoreEvents.push({ time: ns.note.time });
        }
      });
      scoreEvents.sort((a, b) => a.time - b.time);

      let maxScore = 0;
      let tempCombo = 0;
      const triggered = new Set<number>();
      let activePu: { endTime: number; multiplier: number } | null = null;

      for (const event of scoreEvents) {
        // Check power up triggers
        for (const pw of POWER_UPS) {
          if (tempCombo >= pw.threshold && !triggered.has(pw.threshold)) {
            triggered.add(pw.threshold);
            activePu = {
              endTime: event.time + pw.duration,
              multiplier: pw.multiplier,
            };
          }
        }

        const puMul = activePu && event.time < activePu.endTime ? activePu.multiplier : 1;
        const comboMul = getComboMul(tempCombo);
        maxScore += Math.round(500 * puMul * comboMul);
        tempCombo++;
      }

      setMaxPossibleScore(maxScore || 1);
      triggeredThresholdsRef.current = { 50: false, 75: false, 90: false };

      gsRef.current = {
        score: 0,
        combo: 0,
        maxCombo: 0,
        perfectPlus: 0,
        perfects: 0,
        goods: 0,
        misses: 0,
        progress: 0,
      };
      puRef.current = {
        active: null,
        endTime: 0,
        startTime: 0,
        multiplier: 1,
        color: "#fff",
        label: "",
        duration: 0,
        triggered: new Set(),
      };
      shieldChargesRef.current = 0;
      lastMissTimeRef.current = 0;
      continueUsedRef.current = 0;
      missCountRef.current = 0;
      setMissCount(0);

      setBufferPct(0);
      setLoadMsg("BUFFERING AUDIO...");
      phaseRef.current = "buffering";
      setPhase("buffering");

      if (audioObjectUrlRef.current) {
        try {
          URL.revokeObjectURL(audioObjectUrlRef.current);
        } catch {}
        audioObjectUrlRef.current = null;
      }

      let blob: Blob | null = null;
      let objectUrl: string = "";
      let fetchSuccess = false;

      // ── Attempt 1: Fetch via stream reader for precise progress ──
      // Skip blob download for large files (>10MB) — e.g. uncompressed WAV assets.
      // For those, fall through to direct audio.src streaming which starts playback
      // as soon as enough data is buffered rather than waiting for the full download.
      try {
        console.log("[GamePlay Init] Attempting stream-based audio fetch:", song.audioUrl);
        const headRes = await fetch(song.audioUrl, { method: "HEAD" }).catch(() => null);
        const headLen = headRes?.headers.get("content-length");
        const headBytes = headLen ? parseInt(headLen, 10) : 0;
        const LARGE_FILE_THRESHOLD = 10 * 1024 * 1024; // 10 MB

        if (headBytes > LARGE_FILE_THRESHOLD) {
          // Large file — skip blob approach; stream directly via audio.src instead
          console.log(`[GamePlay Init] Large file detected (${Math.round(headBytes / 1024 / 1024)}MB) — skipping blob fetch, using streaming src`);
          setBufferPct(100);
          throw new Error("Large file — use streaming");
        }

        const response = await fetch(song.audioUrl);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const contentLength = response.headers.get("content-length");
        const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;

        if (response.body && totalBytes > 0) {
          const reader = response.body.getReader();
          const chunks: Uint8Array[] = [];
          let loadedBytes = 0;

          while (true) {
            if (cancelled) {
              reader.cancel();
              return;
            }
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              chunks.push(value);
              loadedBytes += value.length;
              setBufferPct(
                Math.min(99, Math.round((loadedBytes / totalBytes) * 100))
              );
            }
          }
          blob = new Blob(chunks, { type: response.headers.get("content-type") || "audio/mpeg" });
        } else {
          blob = await response.blob();
        }

        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        audioObjectUrlRef.current = objectUrl;
        fetchSuccess = true;
        setBufferPct(100);
      } catch (err) {
        console.warn("[GamePlay Init] Stream-based fetch failed, falling back to standard audio loading:", err);
      }

      if (cancelled) return;

      if (fetchSuccess) {
        audio = new Audio();
        audio.crossOrigin = "anonymous";
        audio.preload = "auto";
        audioRef.current = audio;
        audio.src = objectUrl;
        audio.load();

        await new Promise<void>((resolve, reject) => {
          resolvePendingPromiseRef.current = resolve;
          if (audio!.readyState >= 3) {
            resolve();
            return;
          }
          onCanPlay = () => resolve();
          onError = () => reject(new Error("Audio element failed to load Blob URL"));
          audio!.addEventListener("canplay", onCanPlay, { once: true });
          audio!.addEventListener("error", onError, { once: true });
          loadTimeoutRef.current = setTimeout(resolve, 5000); // 5s timeout fallback
        });
        resolvePendingPromiseRef.current = null;

        if (onCanPlay) audio!.removeEventListener("canplay", onCanPlay);
        if (onError) audio!.removeEventListener("error", onError);
        if (loadTimeoutRef.current) {
          clearTimeout(loadTimeoutRef.current);
          loadTimeoutRef.current = null;
        }
      } else {
        // ── Fallback 1: Standard Audio load with CORS ──
        console.log("[GamePlay Init] Fallback: Standard Audio load with CORS");
        let loadFailed = false;
        audio = new Audio();
        audio.crossOrigin = "anonymous";
        audio.preload = "auto";
        audioRef.current = audio;

        const updateFallbackProgress = () => {
          if (!audio || !audio.duration || isNaN(audio.duration)) return;
          const buf = audio.buffered;
          if (buf.length) {
            const pct = Math.min(100, Math.round((buf.end(buf.length - 1) / audio.duration) * 100));
            setBufferPct(pct);
          }
        };

        onProgress = updateFallbackProgress;
        audio.addEventListener("progress", onProgress);
        audio.addEventListener("durationchange", updateFallbackProgress);
        audio.addEventListener("loadedmetadata", updateFallbackProgress);
        audio.addEventListener("canplay", updateFallbackProgress);
        
        const progressPoll = setInterval(updateFallbackProgress, 100);

        audio.src = song.audioUrl;
        audio.load();

        await new Promise<void>((resolve) => {
          resolvePendingPromiseRef.current = resolve;
          if (audio!.readyState >= 3) {
            resolve();
            return;
          }
          onCanPlay = () => resolve();
          onError = () => {
            loadFailed = true;
            resolve();
          };
          audio!.addEventListener("canplay", onCanPlay, { once: true });
          audio!.addEventListener("error", onError, { once: true });
          loadTimeoutRef.current = setTimeout(() => {
            if (audio!.readyState < 3) {
              loadFailed = true;
            }
            resolve();
          }, 12000);
        });
        resolvePendingPromiseRef.current = null;

        clearInterval(progressPoll);
        if (onCanPlay) audio!.removeEventListener("canplay", onCanPlay);
        if (onError) audio!.removeEventListener("error", onError);
        audio.removeEventListener("progress", onProgress);
        audio.removeEventListener("durationchange", updateFallbackProgress);
        audio.removeEventListener("loadedmetadata", updateFallbackProgress);
        audio.removeEventListener("canplay", updateFallbackProgress);
        if (loadTimeoutRef.current) {
          clearTimeout(loadTimeoutRef.current);
          loadTimeoutRef.current = null;
        }

        // ── Fallback 2: Standard Audio load without CORS ──
        if (loadFailed && !cancelled) {
          console.warn("[GamePlay Init] CORS fallback audio load failed. Retrying without CORS (Web Audio filters will be bypassed)...");
          loadFailed = false;
          audio = new Audio();
          audio.preload = "auto";
          audioRef.current = audio;

          const updateFallbackProgress2 = () => {
            if (!audio || !audio.duration || isNaN(audio.duration)) return;
            const buf = audio.buffered;
            if (buf.length) {
              const pct = Math.min(100, Math.round((buf.end(buf.length - 1) / audio.duration) * 100));
              setBufferPct(pct);
            }
          };

          onProgress = updateFallbackProgress2;
          audio.addEventListener("progress", onProgress);
          audio.addEventListener("durationchange", updateFallbackProgress2);
          audio.addEventListener("loadedmetadata", updateFallbackProgress2);
          audio.addEventListener("canplay", updateFallbackProgress2);

          const progressPoll2 = setInterval(updateFallbackProgress2, 100);

          audio.src = song.audioUrl;
          audio.load();

          await new Promise<void>((resolve) => {
            resolvePendingPromiseRef.current = resolve;
            if (audio!.readyState >= 3) {
              resolve();
              return;
            }
            onCanPlay = () => resolve();
            onError = () => {
              loadFailed = true;
              resolve();
            };
            audio!.addEventListener("canplay", onCanPlay, { once: true });
            audio!.addEventListener("error", onError, { once: true });
            loadTimeoutRef.current = setTimeout(() => {
              if (audio!.readyState < 3) {
                loadFailed = true;
              }
              resolve();
            }, 12000);
          });
          resolvePendingPromiseRef.current = null;

          clearInterval(progressPoll2);
          if (onCanPlay) audio!.removeEventListener("canplay", onCanPlay);
          if (onError) audio!.removeEventListener("error", onError);
          audio.removeEventListener("progress", onProgress);
          audio.removeEventListener("durationchange", updateFallbackProgress2);
          audio.removeEventListener("loadedmetadata", updateFallbackProgress2);
          audio.removeEventListener("canplay", updateFallbackProgress2);
          if (loadTimeoutRef.current) {
            clearTimeout(loadTimeoutRef.current);
            loadTimeoutRef.current = null;
          }
        }

        if (loadFailed && !cancelled) {
          phaseRef.current = "loadError";
          setPhase("loadError");
          return;
        }
      }

      if (cancelled) return;

      // ── Web Audio frequency-band routing (Init during fresh user gesture) ──
      // Lane 0 (A) → bass  · Lane 1 (S) → mids  · Lane 2 (D) → treble
      try {
        if (!audio.crossOrigin) {
          throw new Error("No-CORS audio fallback");
        }
        let actx = audioManager.getContext();
        if (!actx) {
          await audioManager.init();
          actx = audioManager.getContext();
        }
        if (!actx) {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          try {
            actx = new AudioContextClass({ latencyHint: 'interactive' });
          } catch {
            actx = new AudioContextClass();
          }
        } else if (actx.state === 'suspended') {
          await actx.resume();
        }
        audioCtxRef.current = actx;
        const src = actx.createMediaElementSource(audio);
        audioSourceRef.current = src;

        const analyser = actx.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);
        gameplayAnalyserRef.current = analyser;
        gameplayAnalyserDataRef.current = new Uint8Array(analyser.frequencyBinCount);

        // Master Limiter setup to prevent digital clipping (scratchy playback)
        const masterGainNode = actx.createGain();
        masterGainNode.gain.setValueAtTime(0.85, actx.currentTime);

        const compressor = actx.createDynamicsCompressor();
        compressor.threshold.setValueAtTime(-1.0, actx.currentTime);
        compressor.knee.setValueAtTime(30, actx.currentTime);
        compressor.ratio.setValueAtTime(12, actx.currentTime);
        compressor.attack.setValueAtTime(0.003, actx.currentTime);
        compressor.release.setValueAtTime(0.08, actx.currentTime);

        masterGainNode.connect(compressor);
        compressor.connect(actx.destination);

        const bandDefs: { type: BiquadFilterType; freq: number; Q: number }[] =
          [
            { type: "lowpass", freq: 300, Q: 0.8 },
            { type: "bandpass", freq: 1200, Q: 0.7 },
            { type: "highpass", freq: 3200, Q: 0.8 },
          ];
        const filters: BiquadFilterNode[] = [];
        laneGainsRef.current = bandDefs.map(({ type, freq, Q }, idx) => {
          const f = actx.createBiquadFilter();
          f.type = type;
          f.frequency.value = freq;
          f.Q.value = Q;
          filters.push(f);
          const g = actx.createGain();
          g.gain.value = getTargetGainForLane(idx);
          src.connect(f);
          f.connect(g);
          g.connect(masterGainNode);
          return g;
        });
        audioFiltersRef.current = filters;
        laneSilenced.current = [false, false, false];
      } catch {
        // CORS or browser restriction — fall back to direct playback (no muting)
      }

      // ── Audio unlock (mobile autoplay policy) ─────────────────────────────
      // Browsers expire the "user gesture" freshness within ~1s. By the time
      // the 3-second countdown finishes, calling audio.play() cold will throw
      // NotAllowedError on iOS/Safari. Warm up the element NOW (still close
      // to the navigation gesture) with a silent play→pause so the element is
      // already "unlocked" when we call play() for real after the countdown.
      try {
        await audio!.play();
        audio!.pause();
        audio!.currentTime = 0;
      } catch {
        // Warm-up blocked; we'll try to play for real after countdown and
        // surface a TAP TO START recovery screen if it fails again.
      }
      if (cancelled) return;

      resetPuDisplayDOM();
      if (stingerTimeout1Ref.current) clearTimeout(stingerTimeout1Ref.current);
      if (stingerTimeout2Ref.current) clearTimeout(stingerTimeout2Ref.current);
      lastDetectedStageRef.current = 1;
      setCurrentStage(1);
      setStageStingerNumber(null);
      phaseRef.current = "countdown";
      setPhase("countdown");
      let count = 3;
      setCountdown(count);
      audioManager.playSfx('countdown', 0.7);
      haptics.lightTap();
      await new Promise<void>((resolve) => {
        countdownIntervalRef.current = setInterval(() => {
          count--;
          if (count > 0) {
            setCountdown(count);
            audioManager.playSfx('countdown', 0.7);
            haptics.lightTap();
          }
          else {
            if (countdownIntervalRef.current) {
              clearInterval(countdownIntervalRef.current);
              countdownIntervalRef.current = null;
            }
            setCountdown(0);
            // "GO!" stinger
            audioManager.playSfx('select_start_song', 0.8);
            haptics.mediumTap();
            resolve();
          }
        }, 1000);
      });
      if (cancelled) return;

      phaseRef.current = "playing";
      setPhase("playing");

      // ── Canvas dimension safety net ────────────────────────────────────────
      // useLayoutEffect sets canvas dims synchronously, but in rare cases the
      // flex layout resolves after the effect fires (e.g. first cold load on
      // mobile). Force-sync here, right before the draw loop starts, so the
      // highway is never invisible on first launch.
      {
        const c = canvasRef.current;
        const w = canvasWrapperRef.current;
        if (c && w && w.clientWidth > 0 && w.clientHeight > 0) {
          const dpr = window.devicePixelRatio || 1;
          const targetWidth = Math.floor(w.clientWidth * dpr);
          const targetHeight = Math.floor(w.clientHeight * dpr);
          if (c.width !== targetWidth || c.height !== targetHeight) {
            c.width = targetWidth;
            c.height = targetHeight;
            c.style.width = `${w.clientWidth}px`;
            c.style.height = `${w.clientHeight}px`;
            const ctx = c.getContext("2d");
            if (ctx) {
              ctx.resetTransform();
              ctx.scale(dpr, dpr);
            }
            // Pre-render static track surface offscreen cache on resize
            const diffLevel = songRef.current?.difficultyLevel ?? 5;
            offscreenCanvasRef.current = prerenderStaticTrack(
              w.clientWidth,
              w.clientHeight,
              dpr,
              diffLevel,
              laneColorsRef.current
            );
          }
        }
      }

      rafRef.current = requestAnimationFrame(() => drawRef.current?.());

      await audio.play();

      // Check if AudioContext is suspended after play, indicating it got blocked during countdown
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        console.warn("[GamePlay Init] AudioContext is suspended after play, triggering tap-to-start recovery");
        phaseRef.current = "audioError";
        setPhase("audioError");
        cancelAnimationFrame(rafRef.current);
        audio.pause();
      }
      } catch (err) {
        console.error("[GamePlay Init Error] Caught exception in init:", err);
        throw err;
      }
    };

    init().catch(() => {
      if (!cancelled) {
        // audio.play() most commonly fails due to the browser's autoplay policy
        // (gesture freshness expired). Instead of silently navigating away,
        // surface a TAP TO START recovery screen — tapping is a fresh gesture
        // that will successfully unlock audio.play().
        phaseRef.current = "audioError";
        setPhase("audioError");
      }
    });
    return () => {
      cancelled = true;
      phaseRef.current = "unmounted";
      laneSilenced.current = [false, false, false];
      // Reset GameSense state on unmount
      gameSenseService.sendPowerup(0);
      cancelAnimationFrame(rafRef.current);
      if (resolvePendingPromiseRef.current) {
        resolvePendingPromiseRef.current();
        resolvePendingPromiseRef.current = null;
      }
      if (audio) {
        audio.pause();
        if (onProgress) audio.removeEventListener("progress", onProgress);
        if (onCanPlay) audio.removeEventListener("canplay", onCanPlay);
        if (onError) audio.removeEventListener("error", onError);
        audio.src = "";
        try { audio.load(); } catch {}
      }
      audioRef.current = null;
      if (audioObjectUrlRef.current) {
        try {
          URL.revokeObjectURL(audioObjectUrlRef.current);
        } catch {}
        audioObjectUrlRef.current = null;
      }
      laneRestoreTimers.current.forEach(clearTimeout);

      if (continueTimeoutRef.current) {
        clearTimeout(continueTimeoutRef.current);
        continueTimeoutRef.current = null;
      }
      if (finishGameTimeoutRef.current) {
        clearTimeout(finishGameTimeoutRef.current);
        finishGameTimeoutRef.current = null;
      }
      if (abandonTimeoutRef.current) {
        clearTimeout(abandonTimeoutRef.current);
        abandonTimeoutRef.current = null;
      }

      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }

      // Disconnect Web Audio nodes to prevent memory retention
      if (audioSourceRef.current) {
        try { audioSourceRef.current.disconnect(); } catch {}
        audioSourceRef.current = null;
      }
      if (audioFiltersRef.current) {
        audioFiltersRef.current.forEach(f => {
          try { f.disconnect(); } catch {}
        });
        audioFiltersRef.current = [];
      }
      if (laneGainsRef.current) {
        laneGainsRef.current.forEach(gain => {
          try { gain.disconnect(); } catch {}
        });
        laneGainsRef.current = [];
      }

      if (audioCtxRef.current) {
        if (audioCtxRef.current !== audioManager.getContext()) {
          try { audioCtxRef.current.close(); } catch {}
        }
        audioCtxRef.current = null;
      }
      laneSilenced.current = [false, false, false];

      // Clean up canvas and image caches to release memory
      coverImgRef.current = null;
      coverBlurRef.current = null;
      scanPatternRef.current = null;
      offscreenCanvasRef.current = null;
    };
  }, [songId, setLocation, retryCount]);

  // ── render ──
  const gs = displayGs;
  const song = songRef.current;
  const comboColor =
    gs.combo < 10
      ? "#888"
      : gs.combo < 20
        ? opts.laneColors[2]
        : gs.combo < 40
          ? "#E5B800"
          : gs.combo < 60
            ? "#FF1493"
            : "#39FF14";
  const animatedScore = useAnimatedCount(gs.score);

  const doPause = useCallback(() => {
    if (phaseRef.current !== 'playing' || pausedRef.current) return;
    pausedRef.current = true;
    setPaused(true);
    audioRef.current?.pause();
    audioManager.playSfx('pause', 0.5);
    resetAllLanes();

    // Log pause telemetry event
    logAnalyticsEvent('game_pause', {
      songId: songId,
      score: gsRef.current.score,
      elapsedTime: Number((audioRef.current?.currentTime || 0).toFixed(2))
    });
  }, [resetAllLanes, songId]);

  const doResume = useCallback(() => {
    if (!pausedRef.current) return;
    pausedRef.current = false;
    setPaused(false);
    audioManager.playSfx('pause_2', 0.6);
    if (phaseRef.current === 'playing') {
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
      audioRef.current?.play().catch(() => {});
      // Restart the loop
      rafRef.current = requestAnimationFrame(() => drawRef.current?.());
    }

    // Log resume telemetry event
    logAnalyticsEvent('game_resume', {
      songId: songId
    });
  }, [songId]);

  // Auto-pause on blur
  useEffect(() => {
    const onBlur = () => { 
      if (phaseRef.current === 'playing') doPause(); 
      resetAllLanes();
    };
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, [doPause, resetAllLanes]);

  // Handle manual keyboard pause (Escape) and Continue (Enter)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const p = phaseRef.current;
      if (p === 'playing') {
        if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
          if (pausedRef.current) doResume();
          else doPause();
        }
      } else if (p === 'continue') {
        if (e.key === 'Enter') {
          doReturn();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [doPause, doResume, doReturn]);

  return (
    <div
      className="fixed inset-0 flex justify-center overflow-hidden"
      style={{ background: "#0c0c14" }}
    >
      {/* ── PAUSE BUTTON (Bottom Right) ── */}
      {phase === "playing" && !paused && (
        <button
          onClick={doPause}
          className="absolute bottom-6 right-6 z-50 w-12 h-12 flex items-center justify-center rounded-full glass-panel border-2 border-white/20 hover:scale-110 active:scale-95 transition-all group"
          title="Pause (Esc)"
        >
          <div className="flex gap-1">
            <div className="w-1.5 h-4 bg-white/80 group-hover:bg-white rounded-full transition-colors" />
            <div className="w-1.5 h-4 bg-white/80 group-hover:bg-white rounded-full transition-colors" />
          </div>
        </button>
      )}

      {/* ── PAUSE OVERLAY ── */}
      {paused && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="glass-panel p-8 max-w-sm w-full mx-4 text-center border-t-2 border-white/20 shadow-2xl">
            <div className="font-mono font-bold text-xs tracking-[0.5em] text-white/30 mb-6 uppercase">
              TRANSMISSION SUSPENDED
            </div>
            <h2 className="font-mono font-bold text-4xl text-white mb-8 tracking-tighter">PAUSED</h2>
            
            <div className="flex flex-col gap-4">
              <button
                onClick={doResume}
                className="w-full py-4 font-mono font-bold text-sm tracking-[0.3em] bg-[#F2F0E8] text-[#080808] rounded-lg hover:scale-[1.02] active:scale-95 transition-all shadow-lg"
              >
                RESUME TRANSMISSION
              </button>
              
              <button
                onClick={doAbandon}
                className="w-full py-4 font-mono font-bold text-xs tracking-[0.2em] bg-white/5 text-white/60 border border-white/10 rounded-lg hover:bg-white/10 hover:text-white transition-all"
              >
                ABORT MISSION
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TUTORIAL ONBOARDING MISS OVERLAY ── */}
      {isTutorialHelpOpen && (
        <div className="absolute inset-0 z-[101] flex items-center justify-center bg-black/95 backdrop-blur-md animate-in fade-in duration-300">
          <div className="glass-panel p-8 max-w-sm w-full mx-4 text-center border border-[#FF1493]/30 shadow-2xl relative">
            {/* Cyberpunk details */}
            <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t border-l border-[#FF1493]" />
            <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t border-r border-[#FF1493]" />
            <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b border-l border-[#FF1493]" />
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b border-r border-[#FF1493]" />

            <div className="font-mono font-bold text-[10px] tracking-[0.4em] text-[#FF1493] mb-4 uppercase">
              // NEURAL OUT OF SYNC //
            </div>
            <h3 className="font-mono font-bold text-2xl text-white mb-6 uppercase tracking-wider">
              TRANSMISSION FAILING
            </h3>
            <div className="font-mono text-zinc-400 text-[10px] leading-relaxed mb-8 text-left space-y-3.5 max-h-[220px] overflow-y-auto pr-1">
              <p className="text-zinc-500 uppercase tracking-widest text-[9px]">// TRAINING MODULE: NOTE TYPES //</p>
              <div>
                <span className="text-[#39FF14] font-bold block mb-0.5">■ TAPS:</span>
                Press the column exactly when the note block aligns with the bottom glowing line.
              </div>
              <div>
                <span className="text-[#00E5FF] font-bold block mb-0.5">▬ HOLD RAILS:</span>
                Hold down the key/column until the note tail fully finishes crossing the bottom line.
              </div>
              <div>
                <span className="text-[#FF1493] font-bold block mb-0.5">➔ SWIPE RELEASES:</span>
                Hold the rail, then at the arrow release AND swipe/flick (or press matching Arrow key).
              </div>
              <div>
                <span className="text-[#FFaa00] font-bold block mb-0.5">↝ SLIDE TRANSITIONS:</span>
                Hold starting lane, then shift/press the target lane as the path bends sideways.
              </div>
            </div>
            <button
              onClick={() => {
                isTutorialHelpOpenRef.current = false;
                setIsTutorialHelpOpen(false);
                missCountRef.current = 0;
                setMissCount(0);
                const audio = audioRef.current;
                if (audio) {
                  audio.play().catch(() => {});
                }
                rafRef.current = requestAnimationFrame(() => drawRef.current?.());
              }}
              className="w-full py-4 font-mono font-bold text-sm tracking-[0.25em] bg-[#FF1493] text-white hover:scale-[1.02] active:scale-95 transition-all shadow-lg rounded-sm border-none cursor-pointer"
            >
              TAP TO RE-SYNC
            </button>
          </div>
        </div>
      )}
      {/* Dynamic gameplay background system */}
      {(() => {
        const bg = opts.gameBackground || 'cover_blur';
        if (bg === 'sacred_visualizer') {
          return (
            <div className="absolute inset-0 overflow-hidden pointer-events-none bg-[#050403]" />
          );
        }
        if (bg === 'neon_grid') {
          return (
            <div className="absolute inset-0 overflow-hidden pointer-events-none bg-neon-grid-container">
              <div className="bg-neon-grid-sun" />
              <div className="bg-neon-grid-grid" />
              <div className="bg-neon-grid-horizon" />
            </div>
          );
        }
        if (bg === 'cyber_streets') {
          return (
            <div className="absolute inset-0 overflow-hidden pointer-events-none bg-cyber-streets-container">
              <div className="cyber-streets-grille" />
              {Array.from({ length: 18 }).map((_, i) => {
                const delay = `${(i * 0.3) % 5}s`;
                const duration = `${3.5 + (i % 4) * 1.5}s`;
                const opacity = 0.22 + ((i * 4) % 8) * 0.08;
                const fontSize = `${9 + (i % 3) * 3.5}px`;
                const left = `${i * 5.5 + 2}%`;
                
                const chars = ["P", "I", "M", "0", "1", "X", "Y", "Ø", "Δ", "Ω", "7", "5", "A", "C", "F"];
                const content = Array.from({ length: 30 }).map((_, charIdx) => {
                  const ch = chars[(i + charIdx * 7) % chars.length];
                  const isFirst = charIdx === 0;
                  return (
                    <span 
                      key={charIdx} 
                      className={isFirst ? "matrix-char-head" : "matrix-char"}
                      style={isFirst ? { color: '#fff', textShadow: '0 0 8px #fff, 0 0 15px #39FF14' } : {}}
                    >
                      {ch}
                    </span>
                  );
                });
                
                return (
                  <div
                    key={i}
                    className="matrix-rain"
                    style={{
                      left,
                      animationDelay: delay,
                      animationDuration: duration,
                      opacity,
                      fontSize,
                    }}
                  >
                    {content}
                  </div>
                );
              })}
            </div>
          );
        }
        if (bg === 'space_nebula') {
          return (
            <div className="absolute inset-0 overflow-hidden pointer-events-none bg-space-nebula-container">
              <div className="space-stars space-stars-back" />
              <div className="space-stars space-stars-mid" />
              <div className="space-stars space-stars-front" />
              <div className="space-nebula-cloud1" />
              <div className="space-nebula-cloud2" />
              <div className="space-nebula-cloud3" />
            </div>
          );
        }
        if (bg === 'glitch_matrix') {
          return (
            <div className="absolute inset-0 overflow-hidden pointer-events-none bg-glitch-matrix-container">
              <div className="glitch-grid" />
              <div className="glitch-static" />
              
              <div className="glitch-hud glitch-hud-top-left font-mono">
                SYS_STATUS: COMPROMISED<br />
                BITRATE_STREAM: [14.2 KB/S]<br />
                DECODING: SEC_92B...
              </div>
              <div className="glitch-hud glitch-hud-bottom-right font-mono text-right">
                VAULT_DOOR: STAGE_UNLOCKED<br />
                INTEGRITY_PIM: 99.98%
              </div>
              
              <div className="glitch-bar1" />
              <div className="glitch-bar2" />
              <div className="glitch-flash-overlay" />
            </div>
          );
        }
        if (bg === 'sunset_skyline') {
          return (
            <div className="absolute inset-0 overflow-hidden pointer-events-none bg-sunset-skyline-container">
              <div className="sunset-sun" />
              <div className="sunset-city-grid" />
              <div className="sunset-mountains" />
              <div className="sunset-horizon" />
            </div>
          );
        }
        if (bg === 'gold_record') {
          return (
            <div className="absolute inset-0 overflow-hidden pointer-events-none bg-gold-record-container">
              <div className="gold-record-vinyl" />
              <div className="gold-record-grooves" />
              <div className="gold-record-spindle" />
              <div className="gold-record-waves" />
            </div>
          );
        }
        if (bg === 'cyber_cityscape') {
          return (
            <div className="absolute inset-0 overflow-hidden pointer-events-none bg-cyber-cityscape-container">
              <div className="cityscape-stars" />
              <div className="cityscape-buildings" />
              <div className="cityscape-holograms">
                <div className="holo-billboard holo-ad1">PIM_NET</div>
                <div className="holo-billboard holo-ad2">VAULT_ACTIVE</div>
              </div>
            </div>
          );
        }
        if (bg === 'toxic_hazard') {
          return (
            <div className="absolute inset-0 overflow-hidden pointer-events-none bg-toxic-hazard-container">
              <div className="toxic-grid-mesh" />
              <div className="toxic-hazard-stripes" />
              <div className="toxic-pulses">
                <div className="toxic-pulse pulse1" />
                <div className="toxic-pulse pulse2" />
              </div>
              <div className="toxic-alert-text font-mono">
                HAZARD LEVEL: CRITICAL // RADIATION LEVEL: HIGH // COOLANT LEAK DETECTED
              </div>
            </div>
          );
        }
        if (bg === 'prismatic_aurora') {
          return (
            <div className="absolute inset-0 overflow-hidden pointer-events-none bg-prismatic-aurora-container">
              <div className="aurora-wave wave-1" />
              <div className="aurora-wave wave-2" />
              <div className="aurora-wave wave-3" />
              <div className="aurora-stars" />
            </div>
          );
        }
        if (bg === 'hyperdrive_warp') {
          return (
            <div className="absolute inset-0 overflow-hidden pointer-events-none bg-hyperdrive-warp-container">
              <div className="warp-core" />
              {Array.from({ length: 24 }).map((_, i) => {
                const delay = `${(i * 0.15) % 3.6}s`;
                const duration = `${1.2 + (i % 3) * 0.6}s`;
                const rotation = `${i * 15}deg`;
                const opacity = 0.35 + (i % 4) * 0.15;
                return (
                  <div
                    key={i}
                    className="warp-star-streak"
                    style={{
                      '--rotation': rotation,
                      animationDelay: delay,
                      animationDuration: duration,
                      opacity,
                    } as React.CSSProperties}
                  />
                );
              })}
            </div>
          );
        }
        if (bg === 'living_vault') {
          const fragments = useVaultStore.getState().fragments[songId] ?? 0;
          const fragmentProgress = Math.min(fragments, 10) / 10;
          const isCrystallized = fragments >= 10;
          const pct = maxPossibleScore > 0 ? (gs.score / maxPossibleScore) * 100 : 0;
          const pulseSpeed = Math.max(0.18, 1.2 - Math.min(gs.combo, 100) * 0.0102);

          // Audio triggers inside render
          [50, 75, 90].forEach(threshold => {
            if (pct >= threshold && !triggeredThresholdsRef.current[threshold]) {
              triggeredThresholdsRef.current[threshold] = true;
              audioManager.playSfx("hidden_secret_found", 0.5);
            }
          });

          return (
            <div
              className={`absolute inset-0 overflow-hidden pointer-events-none bg-living-vault-container ${
                gs.combo >= 100 ? "combo-reactor-active" :
                gs.combo >= 50 ? "combo-reactor-level2" :
                gs.combo >= 20 ? "combo-reactor-level1" : "combo-reactor-dormant"
              }`}
              style={{
                '--combo-intensity': Math.min(gs.combo, 100) / 100,
                '--fragment-progress': fragmentProgress,
                '--pulse-speed': `${pulseSpeed}s`,
              } as React.CSSProperties}
            >
              {/* Parallax Server Hall / Corridor grid elements */}
              <div className="vault-corridor-grid" />
              <div className="vault-corridor-glow" />

              {/* Pulsing energy cables */}
              <div className="vault-cable cable-left" />
              <div className="vault-cable cable-right" />
              <div className="vault-cable cable-top" />

              {/* Shifting Neural Pathways (Hydraulic Doors) */}
              <div className={`hydraulic-door door-wing-a ${pct >= 50 ? 'door-open' : ''}`}>
                <div className="door-panel-left border-r border-[#FF5500]/30" />
                <div className="door-panel-right border-l border-[#FF5500]/30" />
                <div className="door-lock font-mono">WING A [SECURE]</div>
              </div>

              <div className={`hydraulic-door door-wing-b ${pct >= 75 ? 'door-open' : ''}`}>
                <div className="door-panel-left border-r border-[#FF5500]/30" />
                <div className="door-panel-right border-l border-[#FF5500]/30" />
                <div className="door-lock font-mono">WING B [ENCRYPTED]</div>
              </div>

              <div className={`hydraulic-door door-wing-c ${pct >= 90 ? 'door-open' : ''}`}>
                <div className="door-panel-left border-r border-[#FF8800]/40" />
                <div className="door-panel-right border-l border-[#FF8800]/40" />
                <div className="door-lock font-mono">CORE CHAMBER</div>
              </div>

              {/* Glitching/Assembling Card Shards in the center */}
              <div className="vault-shard-assembler">
                <div className="vault-card-silhouette" />

                {/* Shard 1 to 6 - positions transition toward the center as fragments increment */}
                {Array.from({ length: 6 }).map((_, i) => {
                  const baseAngle = (i * 360) / 6;
                  const angleRad = (baseAngle * Math.PI) / 180;
                  // Random direction vector for scatter
                  const scatterX = Math.cos(angleRad) * 140;
                  const scatterY = Math.sin(angleRad) * 90;
                  const rotation = baseAngle + 15;

                  return (
                    <div
                      key={i}
                      className={`card-shard shard-${i} ${isCrystallized ? 'crystallized' : 'glitching'}`}
                      style={{
                        transform: `translate(
                          calc(${scatterX}px * (1 - var(--fragment-progress))),
                          calc(${scatterY}px * (1 - var(--fragment-progress)))
                        ) rotate(
                          calc(${rotation}deg * (1 - var(--fragment-progress)))
                        ) scale(
                          calc(0.7 + (var(--fragment-progress) * 0.3))
                        )`,
                        opacity: isCrystallized ? 1 : 0.4 + (fragmentProgress * 0.5) + (Math.random() * 0.1),
                      }}
                    />
                  );
                })}

                {/* Solid Card Overlay representing Crystallization at 10/10 */}
                {isCrystallized && (
                  <div className="vault-solid-crystallized-card flex items-center justify-center font-mono">
                    <div className="glowing-card-accent animate-pulse" />
                    <span className="text-[10px] text-[#ff5500] font-bold tracking-[0.2em]">{song?.title?.toUpperCase()}</span>
                  </div>
                )}
              </div>

              {/* Living Vault Cyber HUD Overlays */}
              <div className="vault-hud-status top-left font-mono">
                SYS_LOC: COGNITIVE_VAULT_CORRIDOR<br />
                DEC_FRAGMENTS: {fragments} / 10 <span className={isCrystallized ? "text-[#39FF14]" : "text-[#FF8800]"}>
                  {isCrystallized ? "[CRYSTALLIZED]" : `[DECRYPTING_${Math.round(fragmentProgress * 100)}%]`}
                </span>
              </div>

              <div className="vault-hud-status bottom-left font-mono">
                COMBO REACTOR: {gs.combo >= 100 ? "POWER_GRID_ACTIVE" : gs.combo >= 50 ? "ENERGY_SURGE" : gs.combo >= 20 ? "SYS_AWAKE" : "DORMANT"}<br />
                PULSE_FREQUENCY: {(1 / pulseSpeed).toFixed(1)}Hz
              </div>

              <div className="vault-hud-status top-right font-mono text-right">
                WING_A (50%): {pct >= 50 ? "BYPASSED" : "SEALED"}<br />
                WING_B (75%): {pct >= 75 ? "BYPASSED" : "SEALED"}<br />
                CORE_CHAMBER (90%): {pct >= 90 ? "BYPASSED" : "SEALED"}
              </div>
            </div>
          );
        }

        // Default: cover_blur
        const blurValue = typeof opts.backgroundBlur === 'number' ? opts.backgroundBlur : 18;
        const blurScale = 1.0 + (blurValue / 40) * 0.08;
        return song?.coverArt ? (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <img
              src={song.coverArt}
              alt=""
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: `blur(${blurValue}px) brightness(0.28) saturate(1.6)`,
                transform: `scale(${blurScale})`,
              }}
            />
          </div>
        ) : null;
      })()}
      {/* Vignette — full-screen radial dark gradient, no column boundary */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 90% 90% at 50% 42%, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.50) 55%, rgba(0,0,0,0.86) 100%)",
        }}
      />
      {/* Scanlines — full-screen CRT texture */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.07) 3px, rgba(0,0,0,0.07) 4px)",
          mixBlendMode: "multiply",
        }}
      />
      {/* Mood tint — subtle colour cast based on song mood */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            song?.mood === "dark"
              ? "rgba(255,20,147,0.07)"
              : "rgba(57,255,20,0.06)",
        }}
      />
      <div
        className="relative w-full h-full flex flex-col overflow-hidden"
        style={{ maxWidth: 500 }}
      >
        {/* HUD */}
        <div
          className="flex items-center justify-between px-4 py-2.5 flex-shrink-0"
          style={{
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(12,12,20,0.55)",
            backdropFilter: "blur(20px) saturate(1.4)",
            WebkitBackdropFilter: "blur(20px) saturate(1.4)",
            borderRadius: "0 0 14px 14px",
            boxShadow: "0 4px 28px rgba(0,0,0,0.5), inset 0 -1px 0 rgba(255,255,255,0.05)",
          }}
        >
          {/* Left: QUIT + OPTIONS */}
          <div className="flex items-center gap-3">
            <button
              data-testid="button-quit"
              onClick={() => {
                audioRef.current?.pause();
                const origin = sessionStorage.getItem(`game_origin_${songId}`) ?? '';
                setLocation(origin === 'songs' ? '/songs' : origin ? `/${origin}` : '/campaign');
              }}
              className="font-mono text-xs tracking-widest transition-colors"
              style={{ color: "hsl(30 15% 30%)" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#FF1493")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "hsl(30 15% 30%)")}
            >
              ✕ QUIT
            </button>
            <button
              onClick={() => setShowOptions(o => !o)}
              className="font-mono text-xs tracking-widest transition-colors"
              style={{ color: showOptions ? "#E5B800" : "hsl(30 15% 28%)", letterSpacing: '0.1em' }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#E5B800")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = showOptions ? "#E5B800" : "hsl(30 15% 28%)")}
            >
              ⚙
            </button>
            <button
              onClick={toggleFullscreen}
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              style={{ color: isFullscreen ? "#39FF14" : "hsl(30 15% 28%)", lineHeight: 1, padding: "2px 3px", transition: "color 0.15s" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#39FF14")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = isFullscreen ? "#39FF14" : "hsl(30 15% 28%)")}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                {isFullscreen ? (
                  <>
                    <path d="M4 0H0v4h1.5V1.5H4V0z" opacity=".35" />
                    <path d="M8 0h4v4h-1.5V1.5H8V0z" opacity=".35" />
                    <path d="M0 8h1.5v2.5H4V12H0V8z" opacity=".35" />
                    <path d="M12 8h-1.5v2.5H8V12h4V8z" opacity=".35" />
                    <rect x="3.5" y="3.5" width="5" height="5" rx="0.5" />
                  </>
                ) : (
                  <>
                    <path d="M0 0h4v1.5H1.5V4H0V0z" />
                    <path d="M12 0H8v1.5h2.5V4H12V0z" />
                    <path d="M0 12h4v-1.5H1.5V8H0v4z" />
                    <path d="M12 12H8v-1.5h2.5V8H12v4z" />
                  </>
                )}
              </svg>
            </button>
          </div>

          {/* Center: COMBO */}
          {opts.comboDisplay ? (
            <div className="text-center">
              <div className="font-mono" style={{ fontSize: 8, color: "hsl(30 15% 32%)", letterSpacing: "0.3em" }}>COMBO</div>
              <motion.div
                key={gs.combo}
                className={`font-mono font-bold leading-none${gs.combo >= 20 ? ' breathe-glow' : ''}`}
                data-testid="text-combo"
                initial={{ scale: gs.combo > 0 ? 1.35 : 1 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 520, damping: 18, mass: 0.6 }}
                style={{
                  fontSize: 22,
                  color: comboColor,
                  textShadow: gs.combo >= 20 ? `0 0 16px ${comboColor}, 0 0 32px ${comboColor}60` : "none",
                  '--breathe-color': `${comboColor}60`,
                  transition: 'color 0.2s, text-shadow 0.2s',
                  display: 'block',
                } as React.CSSProperties}
              >
                {gs.combo > 0 ? gs.combo : "—"}
              </motion.div>
            </div>
          ) : <div />}

          {/* Right: animated SCORE + miss pips */}
          <div className="flex flex-col items-end gap-1">
            <div className="font-mono" style={{ fontSize: 8, color: "hsl(30 15% 32%)", letterSpacing: "0.3em" }}>SCORE</div>
            <div
              className="font-mono font-bold leading-none"
              data-testid="text-score"
              style={{ fontSize: 26, color: "#F2EDE5", letterSpacing: "0.03em", textShadow: "0 0 14px rgba(242,237,229,0.25)" }}
            >
              {animatedScore.toLocaleString()}
            </div>
            {opts.hudMisses && (
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    style={{
                      width: 7, height: 7,
                      background: i < missCount ? "#FF1493" : "rgba(255,255,255,0.1)",
                      boxShadow: i < missCount ? "0 0 6px rgba(255,20,147,0.9)" : "none",
                      transition: "background 0.15s, box-shadow 0.15s",
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Options panel */}
        {showOptions && (
          <div
            className="absolute top-0 left-0 right-0 bottom-0 z-40"
            style={{ background: "rgba(0,0,0,0.55)" }}
            onClick={() => setShowOptions(false)}
          >
            <div
              className="absolute top-12 right-0 w-64"
              style={{ background: "#0c0c14", borderLeft: "2px solid rgba(255,255,255,0.08)", borderBottom: "2px solid rgba(255,255,255,0.08)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                <div className="font-mono text-xs tracking-[0.35em]" style={{ color: "rgba(255,255,255,0.3)" }}>OPTIONS</div>
              </div>
              {([
                { key: "missSystem", label: "MISS SYSTEM", sub: "3 strikes trigger SIGNAL LOST" },
                { key: "hudMisses", label: "HUD MISSES", sub: "Show miss pips in HUD" },
                { key: "comboDisplay", label: "COMBO DISPLAY", sub: "Show combo counter" },
                { key: "judgmentText", label: "JUDGMENT TEXT", sub: "Show PERFECT / GOOD popups" },
              ] as const).map(({ key, label, sub }) => {
                const isLocked = key === "missSystem" && localStorage.getItem("opt_unlocked_noclip") !== "true";
                const on = opts[key];
                return (
                  <div key={key} className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.05)", opacity: isLocked ? 0.55 : 1 }}>
                    <div>
                      <div className="font-mono text-xs flex items-center gap-1" style={{ color: on && !isLocked ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.3)", letterSpacing: "0.15em" }}>
                        {isLocked && <Lock size={10} className="text-red-500 animate-pulse" />}
                        {label} {isLocked && <span className="text-[8px] text-red-500 lowercase">(locked)</span>}
                      </div>
                      <div className="font-mono mt-0.5" style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", letterSpacing: "0.1em" }}>{sub}</div>
                    </div>
                    {isLocked ? (
                      <button
                        onClick={() => audioManager.playSfx('locked_out', 0.15)}
                        style={{
                          width: 38, height: 20, position: "relative", flexShrink: 0,
                          background: "rgba(239, 68, 68, 0.1)",
                          border: "1px solid rgba(239, 68, 68, 0.3)",
                          cursor: "not-allowed",
                          display: "flex", alignItems: "center", justifyContent: "center"
                        }}
                      >
                        <Lock size={10} className="text-red-500" />
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          const nv = !on;
                          localStorage.setItem(`opt_${key}`, String(nv));
                          setOpts(o => ({ ...o, [key]: nv }));
                        }}
                        style={{
                          width: 38, height: 20, position: "relative", flexShrink: 0,
                          background: on ? "#FF1493" : "rgba(255,255,255,0.1)",
                          border: on ? "1px solid #FF1493" : "1px solid rgba(255,255,255,0.15)",
                          transition: "background 0.15s",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{
                          width: 13, height: 13, background: "#fff", position: "absolute",
                          top: 2.5, left: on ? 21 : 3, transition: "left 0.15s",
                        }} />
                      </button>
                    )}
                  </div>
                );
              })}

              {/* Audio offset slider */}
              <div className="px-5 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="font-mono text-xs" style={{ color: "rgba(255,255,255,0.75)", letterSpacing: "0.15em" }}>AUDIO OFFSET</div>
                    <div className="font-mono mt-0.5" style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", letterSpacing: "0.1em" }}>Sync to your speaker delay</div>
                  </div>
                  <div className="font-mono text-xs font-bold" style={{ color: opts.audioOffset === 0 ? "#39FF14" : "#FF1493", letterSpacing: "0.1em", minWidth: 52, textAlign: "right" }}>
                    {opts.audioOffset === 0 ? "SYNCED" : opts.audioOffset > 0 ? `+${opts.audioOffset}ms` : `${opts.audioOffset}ms`}
                  </div>
                </div>
                <input
                  type="range"
                  min={-150}
                  max={150}
                  step={5}
                  value={opts.audioOffset}
                  onChange={(e) => {
                    const v = parseInt(e.target.value);
                    localStorage.setItem("opt_audioOffset", String(v));
                    setOpts(o => ({ ...o, audioOffset: v }));
                  }}
                  style={{ width: "100%", accentColor: "#FF1493", cursor: "pointer" }}
                />
                <div className="flex justify-between font-mono" style={{ fontSize: 8, color: "rgba(255,255,255,0.18)", letterSpacing: "0.08em", marginTop: 2 }}>
                  <span>-150ms</span><span>0</span><span>+150ms</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Progress bar — rounded pill with glow */}
        <div
          className="flex-shrink-0 mx-2 my-1.5 relative"
          style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,0.06)" }}
        >
          <div
            style={{
              height: "100%",
              borderRadius: 999,
              width: `${(gs.progress || 0) * 100}%`,
              background: "linear-gradient(90deg, #FF1493, #00E5FF, #39FF14)",
              boxShadow: "0 0 8px rgba(255,20,147,0.3), 0 0 16px rgba(57,255,20,0.15)",
              transition: "width 0.2s linear",
            }}
          />
          {/* Stage dividers */}
          {[20, 40, 65, 80].map((pct, idx) => (
            <div
              key={idx}
              className="absolute top-0 w-[2px] h-full bg-white opacity-40 transition-opacity"
              style={{ left: `${pct}%`, transform: "translateX(-50%)" }}
            />
          ))}
        </div>

        {/* Canvas */}
        <div 
          ref={canvasWrapperRef} 
          className="relative flex-1 min-h-0 overflow-hidden"
          style={{ touchAction: 'none' }}
        >
          {/* Stage Transition Alert Banner */}
          <AnimatePresence>
            {stageStingerNumber && (
              <div className="absolute inset-x-0 top-[22%] flex justify-center pointer-events-none z-30 overflow-visible">
                <motion.div
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  variants={{
                    animate: { transition: { staggerChildren: 0.1 } }
                  }}
                  className="relative flex flex-col items-center justify-center font-mono"
                >
                  {/* Glassmorphic Cyberpunk Backing Banner */}
                  <motion.div
                    variants={{
                      initial: { scaleX: 0, opacity: 0 },
                      animate: { 
                        scaleX: 1, 
                        opacity: 1,
                        transition: { type: "spring", stiffness: 120, damping: 18 }
                      },
                      exit: { scaleX: 0, opacity: 0, transition: { duration: 0.25, ease: "easeIn" } }
                    }}
                    style={{
                      position: "absolute",
                      width: "480px",
                      maxWidth: "90vw",
                      height: "190px",
                      background: "rgba(4, 4, 4, 0.96)",
                      backdropFilter: "blur(20px)",
                      border: "2px solid rgba(255, 255, 255, 0.15)",
                      borderLeft: "4px solid #00E5FF",
                      borderRight: "4px solid #FF1493",
                      boxShadow: "0 30px 70px rgba(0,0,0,0.95), inset 0 0 30px rgba(255,255,255,0.05)",
                      borderRadius: "16px",
                      zIndex: 1,
                    }}
                  />

                  {/* Outer Tech Hexagon Vector Ring */}
                  <motion.div
                    variants={{
                      initial: { scale: 2.2, rotate: 0, opacity: 0 },
                      animate: { 
                        scale: 1.0, 
                        rotate: 180, 
                        opacity: [0, 0.95, 0.95],
                        transition: { type: "spring", stiffness: 90, damping: 12, delay: 0.1 }
                      },
                      exit: { scale: 0.4, rotate: 360, opacity: 0, transition: { duration: 0.3 } }
                    }}
                    style={{
                      position: "absolute",
                      width: 220,
                      height: 220,
                      border: "1.5px solid rgba(0, 229, 255, 0.85)",
                      borderRadius: "24px", 
                      boxShadow: "0 0 30px rgba(0, 229, 255, 0.4)",
                      zIndex: 5,
                    }}
                  />

                  {/* Inner Rotating Dashed Circle Ring */}
                  <motion.div
                    variants={{
                      initial: { scale: 0.3, rotate: 0, opacity: 0 },
                      animate: { 
                        scale: 1.0, 
                        rotate: -180, 
                        opacity: [0, 1.0, 1.0],
                        transition: { type: "spring", stiffness: 100, damping: 10, delay: 0.2 }
                      },
                      exit: { scale: 1.8, rotate: -360, opacity: 0, transition: { duration: 0.3 } }
                    }}
                    style={{
                      position: "absolute",
                      width: 190,
                      height: 190,
                      borderRadius: "50%",
                      border: "2px dashed #FF1493",
                      boxShadow: "0 0 20px rgba(255, 20, 147, 0.6)",
                      zIndex: 5,
                    }}
                  />

                  {/* Core Glowing Diamond Shape */}
                  <motion.div
                    variants={{
                      initial: { scale: 0, rotate: 45, opacity: 0 },
                      animate: { 
                        scale: 1.0, 
                        rotate: 225, 
                        opacity: [0, 0.45, 0.45],
                        transition: { type: "spring", stiffness: 120, damping: 12, delay: 0.3 }
                      },
                      exit: { scale: 2.2, rotate: 405, opacity: 0, transition: { duration: 0.3 } }
                    }}
                    style={{
                      position: "absolute",
                      width: 140,
                      height: 140,
                      background: "linear-gradient(135deg, rgba(0, 229, 255, 0.35), rgba(255, 20, 147, 0.35))",
                      border: "1.5px solid rgba(255, 255, 255, 0.45)",
                      boxShadow: "0 0 35px rgba(0, 229, 255, 0.5)",
                      zIndex: 5,
                    }}
                  />

                  {/* Laser Scanline Sweep */}
                  <motion.div
                    variants={{
                      initial: { y: -80, opacity: 0 },
                      animate: { 
                        y: [-80, 80, -80],
                        opacity: [0, 1.0, 1.0, 0],
                        transition: { repeat: Infinity, duration: 2.0, ease: "linear" }
                      },
                      exit: { opacity: 0 }
                    }}
                    style={{
                      position: "absolute",
                      width: 170,
                      height: "2px",
                      background: "linear-gradient(90deg, transparent, #00E5FF, #FF1493, #00E5FF, transparent)",
                      boxShadow: "0 0 10px #00E5FF, 0 0 20px #FF1493",
                      zIndex: 6,
                    }}
                  />

                  {/* Slide-in Top Text Label */}
                  <motion.div
                    key={`top-${stageStingerPhase}-${stageStingerNumber}`}
                    variants={{
                      initial: { scale: 0.5, y: -85, opacity: 0 },
                      animate: { 
                        scale: 1, 
                        y: -65, 
                        opacity: 1, 
                        transition: { type: "spring", stiffness: 150, damping: 12, delay: 0.2 } 
                      },
                      exit: { scale: 1.2, y: -85, opacity: 0, transition: { ease: "easeIn", duration: 0.2 } }
                    }}
                    className="absolute text-white/90 font-black text-xs md:text-sm tracking-[0.6em] z-10"
                    style={{ 
                      fontFamily: '"JetBrains Mono", monospace',
                      textShadow: "0 0 10px rgba(255,255,255,0.6)",
                    }}
                  >
                    STAGE
                  </motion.div>

                  {/* Giant Center Number */}
                  <motion.div
                    key={`num-${stageStingerPhase}-${stageStingerNumber}`}
                    variants={{
                      initial: { scale: 0.2, rotate: -45, opacity: 0 },
                      animate: { 
                        scale: 1.1, 
                        rotate: 0, 
                        opacity: 1, 
                        transition: { type: "spring", stiffness: 180, damping: 10, delay: 0.1 } 
                      },
                      exit: { scale: 1.6, opacity: 0, transition: { ease: "easeIn", duration: 0.2 } }
                    }}
                    className="absolute text-white font-black text-7xl md:text-8xl z-10"
                    style={{ 
                      fontFamily: '"Impact", "Arial Black", sans-serif',
                      textShadow: "0 0 25px rgba(255,255,255,0.95), 0 0 50px rgba(0,229,255,0.6)",
                      lineHeight: 1,
                    }}
                  >
                    {stageStingerPhase === 'cleared' ? stageStingerNumber - 1 : stageStingerNumber}
                  </motion.div>

                  {/* Slide-in Bottom Status Text */}
                  <motion.div
                    key={`bottom-${stageStingerPhase}-${stageStingerNumber}`}
                    variants={{
                      initial: { scale: 0.5, y: 85, opacity: 0 },
                      animate: { 
                        scale: 1, 
                        y: 65, 
                        opacity: 1, 
                        transition: { type: "spring", stiffness: 150, damping: 12, delay: 0.3 } 
                      },
                      exit: { scale: 1.2, y: 85, opacity: 0, transition: { ease: "easeIn", duration: 0.2 } }
                    }}
                    className="absolute font-black text-xs md:text-sm tracking-[0.4em] z-10"
                    style={{ 
                      fontFamily: '"JetBrains Mono", monospace',
                      textShadow: stageStingerPhase === 'cleared' 
                        ? "0 0 15px rgba(255,20,147,0.95), 0 0 30px rgba(255,20,147,0.5)"
                        : "0 0 15px rgba(0,229,255,0.95), 0 0 30px rgba(0,229,255,0.5)",
                      color: stageStingerPhase === 'cleared' ? '#FF1493' : '#00E5FF',
                    }}
                  >
                    {stageStingerPhase === 'cleared' ? 'CLEARED' : 'START!'}
                  </motion.div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          <canvas
            ref={canvasRef}
            className="absolute inset-0"
            style={{ touchAction: 'none' }}
            onTouchStart={onTouchStart}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            data-testid="canvas-game"
          />

          {/* Power-up banner */}
          <div
            ref={puPanelRef}
            className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 pointer-events-none"
          >
            <div
              ref={puTextRef}
              className="font-mono font-bold text-base px-5 py-2 tracking-[0.3em]"
            />
            <div
              className="w-36 h-1"
              style={{ background: "rgba(255,255,255,0.08)" }}
            >
              <div
                ref={puBarRef}
                className="h-full"
              />
            </div>
          </div>

          {/* Judgment text — per-lane, moved up above the hit zone */}
          {opts.judgmentText && displayJudge.map((j) => {
            if (Date.now() - j.ts > 600) return null;
            const pct = (j.lane / LANE_COUNT + 1 / (LANE_COUNT * 2)) * 100;
            const color =
              j.type === "PERFECT+"
                ? "#E5B800"
                : j.type === "PERFECT"
                  ? "#39FF14"
                  : j.type === "GOOD"
                    ? "#00E5FF"
                    : j.type === "SHIELDED"
                      ? "#00FFDD"
                      : "#FF1493";
            return (
              <div
                key={j.id}
                className="absolute font-mono font-bold pointer-events-none judgment-pop"
                style={{
                  left: `${pct}%`,
                  top: "55%",
                  transform: "translateX(-50%)",
                  color,
                  textShadow: `0 0 18px ${color}`,
                  letterSpacing: "0.12em",
                  fontSize: j.type === "PERFECT+" ? 15 : 12,
                }}
              >
                {j.type}
              </div>
            );
          })}

          {/* Secondary judgment banner — top of screen, always visible above fingers */}
          {opts.judgmentText && (() => {
            const latest = displayJudge.filter(j => Date.now() - j.ts < 400).sort((a, b) => b.ts - a.ts)[0];
            if (!latest) return null;
            const age = (Date.now() - latest.ts) / 400;
            const color =
              latest.type === "PERFECT+" ? "#E5B800"
                : latest.type === "PERFECT" ? "#39FF14"
                : latest.type === "GOOD" ? "#00E5FF"
                : latest.type === "SHIELDED" ? "#00FFDD"
                : latest.type === "MISS" ? "#FF1493"
                : "#444";
            return (
              <div
                className="absolute left-1/2 font-mono font-bold pointer-events-none"
                style={{
                  top: "12%",
                  transform: `translateX(-50%) scale(${1 + (1 - age) * 0.15})`,
                  color,
                  textShadow: `0 0 24px ${color}, 0 0 48px ${color}40`,
                  letterSpacing: "0.25em",
                  fontSize: latest.type === "PERFECT+" ? 20 : latest.type === "MISS" ? 18 : 16,
                  opacity: 1 - age * 0.6,
                  transition: "opacity 0.1s",
                }}
              >
                {latest.type}
              </div>
            );
          })()}

          {/* Loading overlay */}
          {(phase === "loading" || phase === "buffering") && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-5"
              style={{ background: "rgba(12,12,20,0.92)", backdropFilter: "blur(12px)" }}
            >
              <div
                className="font-mono text-xs tracking-[0.3em]"
                style={{ color: "#39FF14", textShadow: "0 0 10px rgba(57,255,20,0.3)" }}
              >
                {loadMsg}
              </div>
              {song && (
                <div className="glass-panel text-center p-6" style={{ borderRadius: 16 }}>
                  {song.coverArt && (
                    <img
                      src={song.coverArt}
                      alt={song.title}
                      className="w-24 h-24 object-cover mx-auto mb-3 opacity-70"
                      style={{ borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 4px 20px rgba(0,0,0,0.4)" }}
                    />
                  )}
                  <div
                    className="font-mono font-bold text-lg"
                    style={{ color: "#F2EDE5" }}
                  >
                    {song.title}
                  </div>
                  <div
                    className="font-mono text-xs mt-1"
                    style={{ color: "rgba(255,255,255,0.35)" }}
                  >
                    DAY {song.day} · {song.bpm} BPM · {song.notes.length} NOTES
                  </div>
                </div>
              )}
              {phase === "buffering" && (
                <div className="w-48">
                  <div
                    style={{ height: 4, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}
                  >
                    <div
                      style={{ height: "100%", borderRadius: 999, width: `${bufferPct}%`, background: "linear-gradient(90deg, #FF1493, #FF7A33)", boxShadow: "0 0 8px rgba(255,20,147,0.3)" }}
                    />
                  </div>
                  <div
                    className="font-mono text-xs text-center mt-1"
                    style={{ color: "rgba(255,255,255,0.3)" }}
                  >
                    {bufferPct}%
                  </div>
                </div>
              )}
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="rounded-full animate-pulse"
                    style={{
                      width: 6, height: 6,
                      background: opts.laneColors[i],
                      boxShadow: `0 0 8px ${opts.laneColors[i]}60`,
                      animationDelay: `${i * 0.15}s`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Audio error recovery — tap to unlock audio.play() with a fresh gesture */}
          {phase === "audioError" && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-6"
              style={{ background: "rgba(12,12,20,0.97)" }}
              onClick={async () => {
                const audio = audioRef.current;
                if (!audio) return;
                try {
                  audio.currentTime = 0;
                  // Canvas safety net on recovery too
                  const c = canvasRef.current;
                  const w = canvasWrapperRef.current;
                  if (c && w && w.clientWidth > 0 && w.clientHeight > 0) {
                    const dpr = window.devicePixelRatio || 1;
                    const targetWidth = Math.floor(w.clientWidth * dpr);
                    const targetHeight = Math.floor(w.clientHeight * dpr);
                    if (c.width !== targetWidth || c.height !== targetHeight) {
                      c.width = targetWidth;
                      c.height = targetHeight;
                      c.style.width = `${w.clientWidth}px`;
                      c.style.height = `${w.clientHeight}px`;
                      const ctx = c.getContext("2d");
                      if (ctx) {
                        ctx.resetTransform();
                        ctx.scale(dpr, dpr);
                      }
                      // Pre-render static track surface offscreen cache on resize
                      const diffLevel = songRef.current?.difficultyLevel ?? 5;
                      offscreenCanvasRef.current = prerenderStaticTrack(
                        w.clientWidth,
                        w.clientHeight,
                        dpr,
                        diffLevel,
                        laneColorsRef.current
                      );
                    }
                  }

                  // Resume AudioContext during user gesture!
                  if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
                    await audioCtxRef.current.resume();
                  }
                  await audioManager.ensureReady();

                  phaseRef.current = "playing";
                  setPhase("playing");
                  rafRef.current = requestAnimationFrame(() => drawRef.current?.());

                  await audio.play();
                } catch {
                  phaseRef.current = "audioError";
                  setPhase("audioError");
                  cancelAnimationFrame(rafRef.current);
                }
              }}
            >
              <div
                className="font-mono font-bold tracking-[0.3em]"
                style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: "0.35em" }}
              >
                AUDIO BLOCKED
              </div>
              <div
                className="font-mono font-bold tracking-[0.2em] text-center"
                style={{ fontSize: 28, color: "#FF1493", textShadow: "0 0 40px rgba(255,20,147,0.7)" }}
              >
                TAP TO START
              </div>
              <div
                className="font-mono text-center"
                style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", letterSpacing: "0.2em", maxWidth: 220, lineHeight: 1.8 }}
              >
                YOUR BROWSER NEEDS A TAP<br />TO ALLOW AUDIO PLAYBACK
              </div>
            </div>
          )}

          {/* Audio download/load error overlay */}
          {phase === "loadError" && (
            <div
              className="absolute inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md animate-in fade-in duration-300"
            >
              <div className="glass-panel p-8 max-w-sm w-full mx-4 text-center border-t-2 border-white/20 shadow-2xl">
                <div className="font-mono font-bold text-xs tracking-[0.4em] text-red-500 mb-6 uppercase">
                  TRANSMISSION FAILURE
                </div>
                <h2 className="font-mono font-bold text-2xl text-white mb-4 tracking-tighter">
                  LOADING FAILED
                </h2>
                <p className="font-mono text-xs text-white/50 mb-8 leading-relaxed">
                  We couldn't download the track audio. Please verify your connection and try again.
                </p>
                
                <div className="flex flex-col gap-4">
                  <button
                    onClick={() => {
                      setPhase("loading");
                      setRetryCount((prev) => prev + 1);
                    }}
                    className="w-full py-4 font-mono font-bold text-sm tracking-[0.3em] bg-gradient-to-r from-[#FF1493] to-[#FF7A33] text-white rounded-lg hover:scale-[1.02] active:scale-95 transition-all shadow-lg cursor-pointer"
                  >
                    TRY AGAIN
                  </button>
                  
                  <button
                    onClick={doAbandon}
                    className="w-full py-4 font-mono font-bold text-xs tracking-[0.2em] bg-white/5 text-white/60 border border-white/10 rounded-lg hover:bg-white/10 hover:text-white transition-all cursor-pointer"
                  >
                    ABORT MISSION
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Countdown */}
          {phase === "countdown" && (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{
                background: "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(14,16,40,0.85) 0%, rgba(12,12,20,0.95) 70%)",
                backdropFilter: "blur(6px)",
              }}
            >
              <div
                className="font-mono font-bold text-center"
                style={{
                  fontSize: 120,
                  lineHeight: 1,
                  background:
                    "linear-gradient(135deg, #FF1493, #00E5FF, #39FF14)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  filter: "drop-shadow(0 0 40px rgba(0,229,255,0.6))",
                  animation: "slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both",
                }}
              >
                {countdown > 0 ? countdown : "GO!"}
              </div>
            </div>
          )}

          {/* Continue overlay */}
          {phase === "continue" && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-7"
              style={{
                background: "rgba(8,8,14,0.96)",
                backdropFilter: "blur(6px)",
              }}
            >
              {/* Header */}
              <div className="flex flex-col items-center gap-2">
                <div
                  className="font-mono font-bold tracking-[0.35em]"
                  style={{
                    fontSize: 28,
                    color: "#FF1493",
                    textShadow: "0 0 40px rgba(255,20,147,0.9)",
                  }}
                >
                  SIGNAL LOST
                </div>
                <div
                  className="font-mono text-xs tracking-[0.25em]"
                  style={{ color: "rgba(255,255,255,0.35)" }}
                >
                  {3 - continueUsedRef.current} CONTINUE{3 - continueUsedRef.current !== 1 ? "S" : ""} REMAINING
                </div>
              </div>

              {/* 3 miss pips — all lit */}
              <div className="flex flex-col items-center gap-2">
                <div
                  className="font-mono text-xs tracking-[0.25em]"
                  style={{ color: "rgba(255,255,255,0.28)" }}
                >
                  3 STRIKES
                </div>
                <div className="flex gap-3">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      style={{
                        width: 16,
                        height: 16,
                        background: "#FF1493",
                        boxShadow: "0 0 14px rgba(255,20,147,0.75)",
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Continue bank — shows how many are used/remaining */}
              <div className="flex flex-col items-center gap-2">
                <div
                  className="font-mono text-xs tracking-[0.25em]"
                  style={{ color: "rgba(255,255,255,0.28)" }}
                >
                  CONTINUES
                </div>
                <div className="flex gap-3">
                  {[0, 1, 2].map((i) => {
                    const used = continueUsedRef.current;
                    // Slots 0..used-1 are spent, current one is being used (pulse), rest available
                    const isSpent = i < used;
                    const isCurrent = i === used;
                    return (
                      <div
                        key={i}
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: "50%",
                          background: isSpent
                            ? "rgba(255,255,255,0.08)"
                            : isCurrent
                            ? "#FF1493"
                            : "rgba(255,20,147,0.35)",
                          border: isSpent
                            ? "1.5px solid rgba(255,255,255,0.12)"
                            : `1.5px solid #FF1493`,
                          boxShadow: isCurrent
                            ? "0 0 12px rgba(255,20,147,0.9)"
                            : "none",
                          transition: "all 0.3s ease",
                        }}
                      />
                    );
                  })}
                </div>
                {continueUsedRef.current >= 2 && (
                  <div
                    className="font-mono text-xs tracking-[0.2em]"
                    style={{ color: "rgba(255,80,80,0.8)" }}
                  >
                    LAST CHANCE
                  </div>
                )}
              </div>

              {/* Continue button */}
              <button
                onClick={doReturn}
                className="font-mono font-bold tracking-[0.3em] px-10 py-3"
                style={{
                  background: "rgba(255,20,147,0.12)",
                  border: "2px solid #FF1493",
                  color: "#FF1493",
                  textShadow: "0 0 20px rgba(255,20,147,0.7)",
                  boxShadow: "0 0 30px rgba(255,20,147,0.2)",
                  clipPath:
                    "polygon(8px 0%,100% 0%,calc(100% - 8px) 100%,0% 100%)",
                }}
              >
                ▶ CONTINUE
              </button>

              {/* Countdown + abandon */}
              <div className="flex flex-col items-center gap-2">
                <div
                  className="font-mono text-xs"
                  style={{
                    color: "rgba(255,255,255,0.22)",
                    letterSpacing: "0.2em",
                  }}
                >
                  AUTO-ABANDON IN {continueCountdown}s
                </div>
                <button
                  onClick={doAbandon}
                  className="font-mono text-xs tracking-[0.25em]"
                  style={{
                    color: "rgba(255,255,255,0.22)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  ABANDON RUN
                </button>
              </div>
            </div>
          )}


          {/* Rewinding overlay — VHS tape rewind visual */}
          {phase === "rewinding" && (
            <div
              className="absolute inset-0 overflow-hidden rewind-overlay"
              style={{ background: "rgba(6,6,12,0.15)", pointerEvents: "none" }}
            >
              {/* CRT scan lines */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    "repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.28) 3px,rgba(0,0,0,0.28) 6px)",
                }}
              />
              {/* Glitch bands */}
              <div className="absolute inset-0 rewind-glitch pointer-events-none" />
              {/* Center text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
                <div
                  className="font-mono font-bold rewind-flicker"
                  style={{
                    fontSize: 34,
                    color: "#39FF14",
                    textShadow: "0 0 40px rgba(57,255,20,0.9)",
                    letterSpacing: "0.28em",
                  }}
                >
                  ◀◀ REWINDING
                </div>
                <div
                  className="font-mono text-xs"
                  style={{
                    color: "rgba(57,255,20,0.4)",
                    letterSpacing: "0.2em",
                  }}
                >
                  BACKING UP 2.5 SECONDS
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  KEY NOTE DRAWING — ivory piano key with colored center stripe
// ═══════════════════════════════════════════════════════════════
function drawKey(
  ctx: CanvasRenderingContext2D,
  noteX: number,
  noteY: number,
  noteW: number,
  noteH: number,
  r: number,
  lc: string,
  prog: number,
  isHold: boolean,
  swipeDirection?: Note['swipeDirection'],
) {
  const centerX = noteX + noteW / 2;
  const centerY = noteY;

  ctx.save();
  ctx.translate(centerX, centerY);

  // ── Rotations ──
  const rotations: Record<string, number> = {
    'right': 0,
    'down-right': Math.PI / 4,
    'down': Math.PI / 2,
    'down-left': 3 * Math.PI / 4,
    'left': Math.PI,
    'up-left': -3 * Math.PI / 4,
    'up': -Math.PI / 2,
    'up-right': -Math.PI / 4,
  };

  // Compute morph factor m (morphs from rounded rect (0) to chevron (1) as prog goes from 0.25 to 0.85)
  const m = swipeDirection ? (isHold ? Math.max(0, Math.min(1, (prog - 0.25) / 0.6)) : 1.0) : 0;

  if (swipeDirection) {
    ctx.rotate(m * (rotations[swipeDirection] || 0));
  }

  // ── 1. Define Key Body Path ──
  ctx.beginPath();
  if (m > 0) {
    const w = noteW / 2;
    const h = noteH / 2;
    const br = lerp(r, 8, m);
    // Interpolated chevron path
    const pinchX = lerp(w, w * 0.2, m);
    const indentX = lerp(-w, -w * 0.35, m);

    ctx.moveTo(-w + br, -h);
    ctx.arcTo(pinchX, -h, w, 0, br);
    ctx.arcTo(w, 0, pinchX, h, br);
    ctx.arcTo(pinchX, h, -w, h, br);
    ctx.arcTo(-w, h, indentX, 0, br);
    ctx.arcTo(indentX, 0, -w, -h, br);
    ctx.arcTo(-w, -h, -w + br, -h, br);
    ctx.closePath();
  } else {
    ctx.roundRect(-noteW / 2, -noteH / 2, noteW, noteH, r);
  }

  // ── 2. Render Ivory or Gold Body ──
  if (isHold) {
    // Rich metallic gold gradient
    const goldGrad = ctx.createLinearGradient(0, -noteH / 2, 0, noteH / 2);
    goldGrad.addColorStop(0, "#FFF5C0");
    goldGrad.addColorStop(0.2, "#FFD700");
    goldGrad.addColorStop(0.5, "#FFA500");
    goldGrad.addColorStop(0.8, "#D4AF37");
    goldGrad.addColorStop(1, "#8B6508");
    ctx.fillStyle = goldGrad;
    ctx.shadowColor = "rgba(212,175,55,0.7)";
    ctx.shadowBlur = lerp(8, 20, prog);
    ctx.shadowOffsetY = 0;
  } else {
    ctx.shadowColor = "rgba(0,0,0,0.65)";
    ctx.shadowBlur = lerp(4, 14, prog);
    ctx.shadowOffsetY = lerp(2, 5, prog);

    const bodyGrad = ctx.createLinearGradient(0, -noteH / 2, 0, noteH / 2);
    bodyGrad.addColorStop(0, "rgba(255, 252, 243, 0.98)");
    bodyGrad.addColorStop(0.22, "rgba(252, 248, 238, 0.97)");
    bodyGrad.addColorStop(0.75, "rgba(242, 236, 220, 0.97)");
    bodyGrad.addColorStop(1, "rgba(228, 220, 204, 0.96)");
    ctx.fillStyle = bodyGrad;
  }
  ctx.fill();

  // ── 2b. Sweeping Glass/Gold Sheen ──
  ctx.save();
  ctx.clip();
  const now = Date.now();
  const sheenProgress = ((now % 2200) / 2200 + prog * 0.35) % 1.0;
  const sheenX = -noteW + (noteW * 2) * sheenProgress;
  const sheenGrad = ctx.createLinearGradient(sheenX, -noteH / 2, sheenX + noteW * 0.38, noteH / 2);
  if (isHold) {
    sheenGrad.addColorStop(0, "rgba(255, 255, 255, 0)");
    sheenGrad.addColorStop(0.5, "rgba(255, 253, 230, 0.45)");
    sheenGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
  } else {
    sheenGrad.addColorStop(0, "rgba(255, 255, 255, 0)");
    sheenGrad.addColorStop(0.5, "rgba(255, 255, 255, 0.38)");
    sheenGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
  }
  ctx.fillStyle = sheenGrad;
  ctx.fill();
  ctx.restore();

  // ── 3. Subtle Edge Border or White Double-Stroke Border ──
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  if (isHold) {
    // Outer white stroke
    ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
    ctx.lineWidth = 3.5;
    ctx.stroke();
    // Inner gold separation
    ctx.strokeStyle = "#D4AF37";
    ctx.lineWidth = 2.0;
    ctx.stroke();
    // Inner white core stroke
    ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
    ctx.lineWidth = 0.8;
    ctx.stroke();
  } else {
    ctx.strokeStyle = "rgba(160, 150, 132, 0.45)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  if (isHold) {
    // ── 4. WHITE CORE DOT OR ARROW FOR HOLD TERMINUS ──
    ctx.fillStyle = "#FFFFFF";
    ctx.shadowColor = "#FFFFFF";
    ctx.shadowBlur = 12;
    ctx.globalAlpha = 0.95;
    ctx.beginPath();
    if (swipeDirection && m > 0.3) {
      // Small arrow pointing right (rotated by ctx.rotate to correct direction)
      ctx.moveTo(-4 * m, -3 * m);
      ctx.lineTo(3 * m, 0);
      ctx.lineTo(-4 * m, 3 * m);
      ctx.closePath();
    } else {
      ctx.arc(0, 0, Math.max(0, 5 * (1 - m)), 0, Math.PI * 2);
    }
    ctx.fill();
    
    // Add outer white glowing ring for the core dot (only if not fully morphed to arrow)
    if (m < 0.8) {
      const pulseR = 8 + 3 * Math.sin(Date.now() / 120);
      ctx.strokeStyle = `rgba(255, 255, 255, ${(0.85 - (pulseR - 8) / 6) * (1 - m)})`;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, 0, pulseR, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else {
    // ── 4. COLORED CENTER STRIPE ──
    const stripeH = Math.max(6, noteH * 0.26);
    ctx.shadowColor = lc;
    ctx.shadowBlur = lerp(20, 42, prog);
    ctx.fillStyle = lc;
    ctx.globalAlpha = 0.9;

    ctx.beginPath();
    if (swipeDirection) {
      const sw = noteW / 2 - 4;
      const sh = stripeH / 2;
      const sr = 4; // stripe radius
      ctx.moveTo(-sw + sr, -sh);
      ctx.arcTo(sw * 0.2, -sh, sw, 0, sr);
      ctx.arcTo(sw, 0, sw * 0.2, sh, sr);
      ctx.arcTo(sw * 0.2, sh, -sw, sh, sr);
      ctx.arcTo(-sw, sh, -sw * 0.35, 0, sr);
      ctx.arcTo(-sw * 0.35, 0, -sw, -sh, sr);
      ctx.arcTo(-sw, -sh, -sw + sr, -sh, sr);
      ctx.closePath();
    } else {
      ctx.roundRect(-noteW / 2 + 2, -stripeH / 2, noteW - 4, stripeH, stripeH * 0.35);
    }
    ctx.fill();

    // ── 4b. Scrolling Neon Arrows inside Swipe Stripes ──
    if (swipeDirection) {
      ctx.save();
      ctx.beginPath();
      const sw = noteW / 2 - 4;
      const sh = stripeH / 2;
      const sr = 4;
      ctx.moveTo(-sw + sr, -sh);
      ctx.arcTo(sw * 0.2, -sh, sw, 0, sr);
      ctx.arcTo(sw, 0, sw * 0.2, sh, sr);
      ctx.arcTo(sw * 0.2, sh, -sw, sh, sr);
      ctx.arcTo(-sw, sh, -sw * 0.35, 0, sr);
      ctx.arcTo(-sw * 0.35, 0, -sw, -sh, sr);
      ctx.arcTo(-sw, -sh, -sw + sr, -sh, sr);
      ctx.closePath();
      ctx.clip();

      const arrowSpacing = 24;
      const animTime = Date.now() / 280;
      const offset = (animTime * 16) % arrowSpacing;

      ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
      ctx.lineWidth = 2.0;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.shadowColor = "#FFFFFF";
      ctx.shadowBlur = 6;

      for (let xOff = -sw - 20 + offset; xOff < sw + 20; xOff += arrowSpacing) {
        ctx.beginPath();
        ctx.moveTo(xOff - 3, -3);
        ctx.lineTo(xOff + 1, 0);
        ctx.lineTo(xOff - 3, 3);
        ctx.stroke();
      }
      ctx.restore();
    }

    // ── 5. Bright inner core of stripe ──
    const coreH = stripeH * 0.48;
    const coreGrad = ctx.createLinearGradient(0, -coreH / 2, 0, coreH / 2);
    coreGrad.addColorStop(0, "rgba(255,255,255,0.5)");
    coreGrad.addColorStop(0.4, "rgba(255,255,255,0.85)");
    coreGrad.addColorStop(1, "rgba(255,255,255,0.2)");
    ctx.fillStyle = coreGrad;
    ctx.globalAlpha = 0.75;

    ctx.beginPath();
    if (swipeDirection) {
      const cw = noteW / 2 - 10;
      const ch = coreH / 2;
      const cr = 2; // core radius
      ctx.moveTo(-cw + cr, -ch);
      ctx.arcTo(cw * 0.2, -ch, cw, 0, cr);
      ctx.arcTo(cw, 0, cw * 0.2, ch, cr);
      ctx.arcTo(cw * 0.2, ch, -cw, ch, cr);
      ctx.arcTo(-cw, ch, -cw * 0.35, 0, cr);
      ctx.arcTo(-cw * 0.35, 0, -cw, -ch, cr);
      ctx.arcTo(-cw, -ch, -cw + cr, -ch, cr);
      ctx.closePath();
    } else {
      ctx.roundRect(-noteW / 2 + 5, -coreH / 2, noteW - 10, coreH, stripeH * 0.2);
    }
    ctx.fill();
  }

  ctx.restore();
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
}
