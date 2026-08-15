// PIM : beatstar-vault gameplay engine
import React, { useEffect, useLayoutEffect, useRef, useState, useCallback, memo } from "react";
import { useParams, useLocation } from "wouter";
import { getSongById, saveHighScore, isSongTimeLocked, getModifierForSong, STAGEIFICATION_CONFIG, getCandidateAudioUrls } from "@/game/api";
import { saveMedal, saveScoreHistory } from "@/game/progress";
import type { GameSong } from "@/game/api";
import type { Note, JudgmentDisplay, GameState, NoteType } from "@/game/types";
import { loadOpts, keyLabel, type GameOpts } from "@/lib/options";
import { audioManager } from "@/game/audio";
import { useVaultStore } from "@/store/useVaultStore";
import { haptics } from "../utils/haptics";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Film } from "lucide-react";
import { logAnalyticsEvent } from "../services/telemetryService";
import { gameSenseService } from "@/services/gameSenseService";
import { supabase } from "@/services/supabaseClient";
import { useAuthStore } from "@/store/useAuthStore";
import { purchasePack, type OwnedCard } from "@/services/vaultService";
import { TransmissionIcon } from "../components/icons/CustomVectorIcons";
import VideoExportModal from "@/components/ui/VideoExportModal";
import { getRelativeDay } from "../utils/dayCalc";

// Use Vite's eager glob to grab files in /public/data/slideshow/
const imageModules = import.meta.glob('/public/data/slideshow/**/*.{png,jpg,jpeg,gif,webp,svg}', { eager: true });
const staticImages = Object.keys(imageModules).map(key => key.replace('/public', ''));

export interface TransmissionLoadState {
  step: number;
  stepLabel: string;
  detailMsg: string;
  bytesLoaded: number;
  bytesTotal: number;
  speedBps: number;
  etaSeconds: number;
  pct: number;
  isStreaming: boolean;
  logs: string[];
}

function formatLoadBytes(bytes: number): string {
  if (!bytes || isNaN(bytes) || bytes <= 0) return "--";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatLoadSpeed(bytesPerSec: number): string {
  if (!bytesPerSec || isNaN(bytesPerSec) || bytesPerSec <= 0) return "-- MB/s";
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
  return `${(bytesPerSec / (1024 * 1024)).toFixed(2)} MB/s`;
}

function formatLoadEta(seconds: number): string {
  if (seconds === undefined || seconds === null || isNaN(seconds) || !isFinite(seconds) || seconds <= 0) return "--";
  if (seconds < 1) return "< 1s left";
  if (seconds > 60) return `~${(seconds / 60).toFixed(1)}m left`;
  return `~${seconds.toFixed(1)}s left`;
}

// ── 6-ARCHETYPE TRACK GEOMETRY & STAGE COLOR PRIMER ENGINE ──
export type TrackArchetype =
  | 'cyber_tunnel'
  | 'corkscrew_slide'
  | 'radial_orbit'
  | 'horizontal_drift'
  | 'wave_coaster'
  | 'matrix_split';

export interface ArchetypeMeta {
  key: TrackArchetype;
  name: string;
  stage3Title: string;
  stage4Title: string;
  stage5Title: string;
  primerColor: string;
  stage5Color: string;
}

const ARCHETYPE_METAS: Record<TrackArchetype, ArchetypeMeta> = {
  cyber_tunnel: {
    key: 'cyber_tunnel',
    name: '3D CYBER TUNNEL',
    stage3Title: 'STAGE 3: 3D CYBER TUNNEL',
    stage4Title: 'STAGE 4: CYBER PRIMER VOID',
    stage5Title: 'STAGE 5: HYPER-SPEED TUNNEL OVERDRIVE',
    primerColor: '#00E5FF',
    stage5Color: '#FF007F',
  },
  corkscrew_slide: {
    key: 'corkscrew_slide',
    name: 'CORKSCREW HELICAL SLIDE',
    stage3Title: 'STAGE 3: CORKSCREW HELICAL SLIDE',
    stage4Title: 'STAGE 4: PLASMA PRIMER VOID',
    stage5Title: 'STAGE 5: TURBO CORKSCREW OVERDRIVE',
    primerColor: '#FF7B00',
    stage5Color: '#FFD700',
  },
  radial_orbit: {
    key: 'radial_orbit',
    name: '360° RADIAL CYBER ORBIT',
    stage3Title: 'STAGE 3: 360° RADIAL ORBIT',
    stage4Title: 'STAGE 4: STARLIGHT PRIMER VOID',
    stage5Title: 'STAGE 5: ORBITAL SUPERNOVA ZENITH',
    primerColor: '#00F5D4',
    stage5Color: '#39FF14',
  },
  horizontal_drift: {
    key: 'horizontal_drift',
    name: 'HORIZONTAL SIDE-SCROLLER',
    stage3Title: 'STAGE 3: HORIZONTAL SIDE-SCROLLER',
    stage4Title: 'STAGE 4: NEON DRIFT PRIMER',
    stage5Title: 'STAGE 5: HYPER-DRIVE SIDE-SCROLLER',
    primerColor: '#FF1493',
    stage5Color: '#00E5FF',
  },
  wave_coaster: {
    key: 'wave_coaster',
    name: 'WAVE ROLLERCOASTER',
    stage3Title: 'STAGE 3: 3D WAVE ROLLERCOASTER',
    stage4Title: 'STAGE 4: LAVA PRIMER VOID',
    stage5Title: 'STAGE 5: HIGH-G ROLLERCOASTER OVERDRIVE',
    primerColor: '#EF4444',
    stage5Color: '#F59E0B',
  },
  matrix_split: {
    key: 'matrix_split',
    name: 'SPLIT HORIZON MATRIX',
    stage3Title: 'STAGE 3: SPLIT HORIZON MATRIX',
    stage4Title: 'STAGE 4: PRISMATIC MATRIX PRIMER',
    stage5Title: 'STAGE 5: HYPER-MATRIX CROSS-OVERLOAD',
    primerColor: '#A855F7',
    stage5Color: '#3B82F6',
  },
};

function isArchetypeDevModeEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development';
  const optDev = localStorage.getItem('opt_archetypeDevMode') === 'true' || localStorage.getItem('opt_devMode') === 'true';
  const urlDev = new URLSearchParams(window.location.search).get('dev') === 'true' || new URLSearchParams(window.location.search).get('archetypes') === 'true';
  return isDev || optDev || urlDev;
}

function selectSongArchetype(song?: Song | null): TrackArchetype {
  // Primary production 3D perspective mode: Cyber Tunnel
  // The full 6-archetype engine is scoped to Dev Mode (opt_archetypeDevMode / URL ?dev=true)
  if (!isArchetypeDevModeEnabled()) {
    return 'cyber_tunnel';
  }

  if (!song) return 'cyber_tunnel';

  // 1. PRIORITY 1: Lyrics Keywords
  if (song.lyrics && typeof song.lyrics === 'string') {
    const text = song.lyrics.toLowerCase();
    if (text.includes('slide') || text.includes('twist') || text.includes('turn') || text.includes('roll') || text.includes('spin') || text.includes('cork') || text.includes('screw')) return 'corkscrew_slide';
    if (text.includes('wave') || text.includes('ride') || text.includes('ocean') || text.includes('sea') || text.includes('flow')) return 'wave_coaster';
    if (text.includes('matrix') || text.includes('split') || text.includes('break') || text.includes('code') || text.includes('grid')) return 'matrix_split';
    if (text.includes('tunnel') || text.includes('cyber') || text.includes('light') || text.includes('night') || text.includes('space') || text.includes('star')) return 'cyber_tunnel';
  }

  // 2. PRIORITY 2: BPM Tiers
  const bpm = song.bpm || 120;
  if (bpm < 120) return 'wave_coaster';
  if (bpm >= 120 && bpm < 135) return 'corkscrew_slide';
  if (bpm >= 135 && bpm < 155) return 'cyber_tunnel';
  if (bpm >= 155) return 'matrix_split';

  // 3. PRIORITY 3: Genre Fallback
  const genre = (song.genre || '').toLowerCase();
  if (genre.includes('rock') || genre.includes('metal') || genre.includes('punk')) return 'wave_coaster';
  if (genre.includes('hip-hop') || genre.includes('rap') || genre.includes('trap') || genre.includes('pop') || genre.includes('dance') || genre.includes('electronic')) return 'corkscrew_slide';

  // Fallback active 3D archetypes (shelved radial_orbit and horizontal_drift)
  const archetypes: TrackArchetype[] = ['corkscrew_slide', 'cyber_tunnel', 'wave_coaster', 'matrix_split'];
  const hash = (song.title || song.id || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return archetypes[hash % archetypes.length];
}


const refineAndBlendEdges = (canvas: HTMLCanvasElement, threshold: number) => {
  try {
    const ctx = canvas.getContext('2d')!;
    const w = canvas.width;
    const h = canvas.height;
    if (w === 0 || h === 0) return;

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    // Green screen spill suppression & soft edge blending without deleting dark subjects
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      const isGreen = g > r * 1.18 && g > b * 1.18;
      if (isGreen) {
        data[i + 1] = Math.round((r + b) / 2);
        data[i + 3] = Math.round(data[i + 3] * 0.15); // Fade green backdrop
      }
    }
    ctx.putImageData(imgData, 0, 0);
  } catch (e) {
    console.warn('[Slideshow refineAndBlendEdges]', e);
  }
};




interface GameplayVisualizerProps {
  analyserRef: React.MutableRefObject<AnalyserNode | null>;
  dataArrayRef: React.MutableRefObject<Uint8Array | null>;
  isPlaying: boolean;
}

/** Check if actual swipe direction matches required swipe direction (with 45° angle tolerance) */
function isDirectionMatch(reqDir?: Note['swipeDirection'], actualDir?: Note['swipeDirection']): boolean {
  if (!reqDir || !actualDir) return true;
  if (reqDir === actualDir) return true;
  if (reqDir === 'up') return actualDir === 'up-left' || actualDir === 'up-right';
  if (reqDir === 'down') return actualDir === 'down-left' || actualDir === 'down-right';
  if (reqDir === 'left') return actualDir === 'up-left' || actualDir === 'down-left';
  if (reqDir === 'right') return actualDir === 'up-right' || actualDir === 'down-right';
  if (actualDir === 'up') return reqDir === 'up-left' || reqDir === 'up-right';
  if (actualDir === 'down') return reqDir === 'down-left' || reqDir === 'down-right';
  if (actualDir === 'left') return reqDir === 'up-left' || reqDir === 'down-left';
  if (actualDir === 'right') return reqDir === 'up-right' || reqDir === 'down-right';
  return false;
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
const HIT_RATIO = 0.78;

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

function hslToHex(h: number, s: number, l: number): string {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function colorWithAlpha(color: string, alpha: number): string {
  if (!color || typeof color !== 'string') return `rgba(255, 255, 255, ${alpha})`;
  const trimmed = color.trim();
  if (trimmed.startsWith('#')) {
    const hex = trimmed.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    const r = parseInt(hex.slice(0, 2), 16) || 0;
    const g = parseInt(hex.slice(2, 4), 16) || 0;
    const b = parseInt(hex.slice(4, 6), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  if (trimmed.startsWith('hsl')) {
    const match = trimmed.match(/hsl\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)/);
    if (match) {
      return `hsla(${match[1]}, ${match[2]}%, ${match[3]}%, ${alpha})`;
    }
    const matchHsla = trimmed.match(/hsla\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*,\s*[\d.]+\s*\)/);
    if (matchHsla) {
      return `hsla(${matchHsla[1]}, ${matchHsla[2]}%, ${matchHsla[3]}%, ${alpha})`;
    }
  }
  if (trimmed.startsWith('rgb')) {
    const match = trimmed.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
    if (match) {
      return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${alpha})`;
    }
    const matchRgba = trimmed.match(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*[\d.]+\s*\)/);
    if (matchRgba) {
      return `rgba(${matchRgba[1]}, ${matchRgba[2]}, ${matchRgba[3]}, ${alpha})`;
    }
  }
  return trimmed;
}

/** ── Custom Vector SVG Judgment Badges (PERFECT+, PERFECT, GOOD, MISS, SHIELDED) ── */
const JudgmentBadge: React.FC<{ type: JudgmentDisplay['type']; scale?: number; className?: string }> = ({ type, scale = 1, className = "" }) => {
  if (type === "PERFECT+") {
    return (
      <svg
        width={145 * scale}
        height={36 * scale}
        viewBox="0 0 145 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`drop-shadow-[0_0_14px_rgba(255,215,0,0.9)] ${className}`}
      >
        <defs>
          <linearGradient id="pPlusGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFF7ED" />
            <stop offset="30%" stopColor="#FFD700" />
            <stop offset="70%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#92400E" />
          </linearGradient>
          <linearGradient id="pPlusGlow" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FFD700" stopOpacity="0" />
            <stop offset="50%" stopColor="#FFD700" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#FFD700" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Outer glowing base line */}
        <rect x="12" y="32" width="121" height="2" rx="1" fill="url(#pPlusGlow)" />
        
        {/* Left & Right Radiant Diamond Starbursts */}
        <path d="M 12 18 L 14 14 L 18 12 L 14 10 L 12 6 L 10 10 L 6 12 L 10 14 Z" fill="#FFF7ED" />
        <path d="M 133 18 L 135 14 L 139 12 L 135 10 L 133 6 L 131 10 L 127 12 L 131 14 Z" fill="#FFF7ED" />

        {/* Text PERFECT+ */}
        <text
          x="72.5"
          y="23"
          textAnchor="middle"
          fill="url(#pPlusGrad)"
          stroke="#FFFFFF"
          strokeWidth="0.6"
          fontFamily="'Space Mono', 'Impact', sans-serif"
          fontWeight="900"
          fontSize="17"
          letterSpacing="0.14em"
        >
          PERFECT+
        </text>
      </svg>
    );
  }

  if (type === "PERFECT") {
    return (
      <svg
        width={132 * scale}
        height={32 * scale}
        viewBox="0 0 132 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`drop-shadow-[0_0_12px_rgba(57,255,20,0.85)] ${className}`}
      >
        <defs>
          <linearGradient id="perfGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#F7FEE7" />
            <stop offset="40%" stopColor="#39FF14" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
        </defs>

        {/* Sleek bracket wings */}
        <path d="M 8 6 L 2 16 L 8 26" stroke="#39FF14" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M 124 6 L 130 16 L 124 26" stroke="#39FF14" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        <text
          x="66"
          y="21"
          textAnchor="middle"
          fill="url(#perfGrad)"
          fontFamily="'Space Mono', 'Impact', sans-serif"
          fontWeight="900"
          fontSize="15"
          letterSpacing="0.16em"
        >
          PERFECT
        </text>
      </svg>
    );
  }

  if (type === "GOOD") {
    return (
      <svg
        width={105 * scale}
        height={28 * scale}
        viewBox="0 0 105 28"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`drop-shadow-[0_0_10px_rgba(0,229,255,0.8)] ${className}`}
      >
        <defs>
          <linearGradient id="goodGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#E0F2FE" />
            <stop offset="50%" stopColor="#00E5FF" />
            <stop offset="100%" stopColor="#0284C7" />
          </linearGradient>
        </defs>

        {/* Top & Bottom Cyber Accent Dashed Bars */}
        <line x1="12" y1="3" x2="93" y2="3" stroke="#00E5FF" strokeWidth="1.5" strokeDasharray="5 3" />
        <line x1="12" y1="25" x2="93" y2="25" stroke="#00E5FF" strokeWidth="1.5" strokeDasharray="5 3" />

        <text
          x="52.5"
          y="19"
          textAnchor="middle"
          fill="url(#goodGrad)"
          fontFamily="'Space Mono', 'Impact', sans-serif"
          fontWeight="900"
          fontSize="14"
          letterSpacing="0.18em"
        >
          GOOD
        </text>
      </svg>
    );
  }

  if (type === "SHIELDED") {
    return (
      <svg
        width={120 * scale}
        height={30 * scale}
        viewBox="0 0 120 30"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`drop-shadow-[0_0_10px_rgba(0,255,221,0.8)] ${className}`}
      >
        <path d="M 12 6 L 18 6 L 18 16 C 18 20 12 24 12 24 C 12 24 6 20 6 16 L 6 6 Z" fill="#00FFDD" opacity="0.3" stroke="#00FFDD" strokeWidth="1.5" />
        <text
          x="65"
          y="20"
          textAnchor="middle"
          fill="#00FFDD"
          fontFamily="'Space Mono', sans-serif"
          fontWeight="900"
          fontSize="12"
          letterSpacing="0.12em"
        >
          SHIELDED
        </text>
      </svg>
    );
  }

  // MISS
  return (
    <svg
      width={100 * scale}
      height={28 * scale}
      viewBox="0 0 100 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`drop-shadow-[0_0_12px_rgba(255,20,147,0.9)] ${className}`}
    >
      <text
        x="50"
        y="19"
        textAnchor="middle"
        fill="#FF1493"
        stroke="#FF003C"
        strokeWidth="0.5"
        fontFamily="'Space Mono', 'Impact', sans-serif"
        fontWeight="900"
        fontSize="14"
        letterSpacing="0.2em"
      >
        MISS
      </text>
    </svg>
  );
};

// Perspective highway geometry
const HW_TOP = 0.65;
const HW_BOT = 0.99;

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

function hwAtProgress(p: number, W: number, topRatio: number = HW_TOP, botRatio: number = HW_BOT) {
  const maxHighwayWidth = Math.min(W, 580 + (W > 680 ? Math.min(140, (W - 680) * 0.18) : 0));
  const w = maxHighwayWidth * lerp(topRatio, botRatio, p);
  const l = (W - w) / 2;
  return { left: l, right: l + w, width: w };
}
function laneAt(
  lane: number,
  progress: number,
  W: number,
  topRatio: number = HW_TOP,
  botRatio: number = HW_BOT,
  archetype?: TrackArchetype,
  stage: number = 1,
  t: number = 0
) {
  const { left, width } = hwAtProgress(progress, W, topRatio, botRatio);
  const lw = width / LANE_COUNT;
  let baseX = left + lane * lw;

  // Apply track archetype motion geometry ONLY during Stage 3 and Stage 5
  // (Stage 4 returns to normal straight notes as a dynamic color primer bridge before Stage 5 overdrive!)
  if (archetype && (stage === 3 || stage === 5)) {
    if (archetype === 'corkscrew_slide') {
      const mult = stage === 5 ? 2.4 : 1.0;
      const swirl = Math.sin(progress * Math.PI * 2 + t * 2.8 * mult) * (W * 0.10 * Math.sin(progress * Math.PI));
      baseX += swirl;
    } else if (archetype === 'matrix_split') {
      const spread = (lane - 1) * (W * 0.15 * Math.sin(progress * Math.PI));
      baseX += spread;
    } else if (archetype === 'wave_coaster') {
      const coasterW = Math.sin(progress * Math.PI * 1.5 + t * 3.0) * (W * 0.05);
      baseX += coasterW;
    } else if (archetype === 'horizontal_drift') {
      const driftX = Math.sin(progress * Math.PI) * (W * 0.06 * (lane === 0 ? -1 : lane === 2 ? 1 : 0));
      baseX += driftX;
    }
  }

  return { x: baseX, w: lw };
}

export interface ProjectionResult {
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
  scale: number;
}

function drawMovingGasAura(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  baseRadius: number,
  baseColor: string,
  t: number,
  intensity: number = 1.0
) {
  ctx.save();

  // ── 1. Undulating Multi-Frequency Radial Noise Gas Field ──
  const gasR = baseRadius * (1.0 + 0.04 * Math.sin(t * 1.5));
  const gasGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, gasR);
  gasGrad.addColorStop(0, colorWithAlpha(baseColor, 0.88 * intensity));
  gasGrad.addColorStop(0.35, colorWithAlpha(baseColor, 0.62 * intensity));
  gasGrad.addColorStop(0.70, colorWithAlpha(baseColor, 0.28 * intensity));
  gasGrad.addColorStop(1.0, "rgba(0, 0, 0, 0.0)");

  ctx.fillStyle = gasGrad;
  ctx.beginPath();
  const numPoints = 28;
  for (let i = 0; i <= numPoints; i++) {
    const ang = (i / numPoints) * Math.PI * 2;
    // Multi-frequency organic trigonometric noise harmonics
    const noise = 1.0
      + 0.08 * Math.sin(ang * 3 + t * 1.6)
      + 0.06 * Math.cos(ang * 5 - t * 2.2)
      + 0.04 * Math.sin(ang * 8 + t * 3.4);
    const r = gasR * noise;
    const gx = cx + Math.cos(ang) * r;
    const gy = cy + Math.sin(ang) * r;
    if (i === 0) ctx.moveTo(gx, gy);
    else ctx.lineTo(gx, gy);
  }
  ctx.closePath();
  ctx.fill();

  // ── 2. Dynamic Swirling Dark Smoke Tendrils & Gas Wisps ──
  const tendrilCount = 6;
  for (let i = 0; i < tendrilCount; i++) {
    const dir = i % 2 === 0 ? 1 : -1;
    const tendrilAng = (i / tendrilCount) * Math.PI * 2 + t * 0.7 * dir;
    const distP = 0.55 + 0.30 * Math.sin(t * 1.2 + i * 1.5);
    const tx = cx + Math.cos(tendrilAng) * (baseRadius * distP);
    const ty = cy + Math.sin(tendrilAng) * (baseRadius * distP * 0.75);
    const tw = baseRadius * (0.28 + 0.12 * Math.sin(t * 1.8 + i));

    const wispGrad = ctx.createRadialGradient(tx, ty, 2, tx, ty, tw);
    wispGrad.addColorStop(0, colorWithAlpha(baseColor, 0.35 * intensity));
    wispGrad.addColorStop(0.55, colorWithAlpha(baseColor, 0.14 * intensity));
    wispGrad.addColorStop(1, "rgba(0, 0, 0, 0.0)");

    ctx.fillStyle = wispGrad;
    ctx.beginPath();
    ctx.arc(tx, ty, tw, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function getCorkscrewSpiralPos(
  lane: number,
  prog: number,
  W: number,
  H: number,
  t: number,
  stage: number
): ProjectionResult {
  const hitY = H * HIT_RATIO;
  const vanishingY = hitY * 0.18;
  const cx = W / 2;
  const corkW = Math.min(W, 840);
  const laneOffset = lane - 1; // -1 for left, 0 for center, 1 for right
  const mult = stage === 5 ? 1.6 : 1.0;
  const baseH = hitY - vanishingY;

  // ── Phase 1: Entry Plunge ($p: 0.00 \rightarrow 0.12$) ──
  // Fast plunge from vanishing horizon into top of the corkscrew tube
  if (prog < 0.12) {
    const u = prog / 0.12;
    const startX = cx + laneOffset * (corkW * 0.06);
    const startY = vanishingY;

    const entryAngle = t * 1.6 * mult;
    const entryRadiusX = corkW * 0.05;
    const entryRadiusY = H * 0.02;
    const entryX = cx + Math.cos(entryAngle) * entryRadiusX + laneOffset * 14;
    const entryY = vanishingY + baseH * 0.10 + Math.sin(entryAngle) * entryRadiusY;

    const noteX = lerp(startX, entryX, u);
    const noteY = lerp(startY, entryY, u);
    const noteW = lerp(38, 54, u);
    const noteH = lerp(32, 46, u);
    return { x: noteX - noteW / 2, y: noteY, w: noteW, h: noteH, rot: laneOffset * 0.05, scale: lerp(0.35, 0.52, u) };
  } 
  
  // ── Phase 2: Tight Helical 3D Spiral Loops ($p: 0.12 \rightarrow 0.48$) ──
  // Fast, tight 720° helical spin centered compactly in the upper middle tube
  else if (prog < 0.48) {
    const u = (prog - 0.12) / 0.36;
    const loopAngle = u * Math.PI * 4 + t * 1.6 * mult; // 2 complete 360° loops

    // Tightened horizontal radius (compact 3D tube)
    const helixRadiusX = lerp(corkW * 0.05, corkW * 0.15, u);
    const helixRadiusY = lerp(H * 0.02, H * 0.065, u);
    const centerY = lerp(vanishingY + baseH * 0.10, vanishingY + baseH * 0.42, u);

    const spiralX = cx + Math.cos(loopAngle) * helixRadiusX + laneOffset * 16 * Math.cos(loopAngle);
    const spiralY = centerY + Math.sin(loopAngle) * helixRadiusY;

    const zDepth = Math.sin(loopAngle); // -1 (back) to +1 (front)
    const rot = Math.cos(loopAngle) * 0.30;
    const depthScale = lerp(0.52, 0.85, u) * (0.90 + zDepth * 0.10);
    const noteW = lerp(54, 90, u) * (0.90 + zDepth * 0.10);
    const noteH = lerp(46, 76, u) * (0.90 + zDepth * 0.10);

    return { x: spiralX - noteW / 2, y: spiralY, w: noteW, h: noteH, rot, scale: depthScale };
  } 
  
  // ── Phase 3: Extended Readability Runway & Target Lane Ejection ($p: 0.48 \rightarrow 1.00$) ──
  // Notes shoot out of the bottom nozzle at p = 0.48 and have 52% of the travel time (~600ms+)
  // to smoothly lock onto their target lane column and glide straight into strike buttons!
  else {
    const u = (prog - 0.48) / 0.52;
    const exitAngle = Math.PI * 4 + t * 1.6 * mult;
    const exitRadiusX = corkW * 0.15;
    const exitRadiusY = H * 0.065;
    const exitX = cx + Math.cos(exitAngle) * exitRadiusX + laneOffset * 16;
    const exitY = vanishingY + baseH * 0.42 + Math.sin(exitAngle) * exitRadiusY;

    const { x: targetX, w: targetW } = laneAt(lane, 1, W);
    const targetCenterX = targetX + targetW / 2;
    const targetCenterY = hitY;

    // Rapid ease-in to straight vertical lane column by u = 0.25 (p = 0.61)
    const alignT = 1 - Math.pow(1 - u, 2.8);
    const noteX = lerp(exitX, targetCenterX, alignT);
    const noteY = lerp(exitY, targetCenterY, u);
    const noteW = lerp(90, targetW, u);
    const noteH = lerp(76, targetW * 0.72, u);
    const rot = lerp(0.15, 0, alignT); // Straightens out into the hit lane
    const scale = lerp(0.85, 1.0, u);

    return { x: noteX - noteW / 2, y: noteY, w: noteW, h: noteH, rot, scale };
  }
}

function getArchetypeProjection(
  lane: number,
  prog: number,
  W: number,
  H: number,
  archetype: TrackArchetype,
  stage: number,
  t: number,
  povMode: 'classic' | 'cyber_tunnel' | 'dynamic_stage' = 'classic'
): ProjectionResult {
  const hitY = H * HIT_RATIO;
  
  // Experimental 3D perspectives (e.g. Corkscrew, Radial Orbit, Side-Scroller, Wave Coaster, Matrix Split)
  // ONLY active during Stage 3 and Stage 5!
  // Stage 1, 2, and 4 ALWAYS revert to standard 2.5D Classic Highway perspective!
  const isExperimentalStage = stage === 3 || stage === 5;
  const isExperimentalArchetype = isExperimentalStage && archetype !== 'cyber_tunnel';

  if (!isExperimentalArchetype) {
    // Only use Cyber Tunnel wide ratios (0.18 -> 0.86) when active POV is cyber_tunnel in Stage 3 or 5!
    // In Stage 1, 2, and 4, retain standard 2.5D Classic Highway ratios (HW_TOP -> HW_BOT)
    const isCyberTunnelPOV = (povMode === 'cyber_tunnel' || archetype === 'cyber_tunnel');
    const isCyberStage = isCyberTunnelPOV && (stage === 3 || stage === 5);
    const topRatio = isCyberStage ? 0.18 : HW_TOP;
    const botRatio = isCyberStage ? 0.86 : HW_BOT;
    if (isCyberStage) {
      // 🌀 3D CYBER TUNNEL PROJECTION (Emerging directly from tunnel entrance at cx, vanishingY)
      const vanishingY = hitY * 0.28; // Tunnel entrance horizon center
      const cx = W / 2;
      const tunnelW = Math.min(W, 840);
      const laneOffset = lane - 1; // -1 for left, 0 for center, +1 for right
      const mult = stage === 5 ? 2.0 : 1.0; // Stage 5 overdrive warp intensity

      // Safe non-negative progress for fractional exponent calculation
      const safeP = Math.max(0, prog);
      const persP = Math.pow(safeP, 1.35);

      // Origin at tunnel entrance mouth (tightly grouped at cx, vanishingY)
      const entranceSpacing = tunnelW * 0.055;
      const entranceX = cx + laneOffset * entranceSpacing;

      // Target hit zone strike position at hitY
      const { x: hitX, w: hitW } = laneAt(lane, 1, W, 0.18, 0.86);

      const noteY = lerp(vanishingY, hitY, persP);
      const noteW = lerp(tunnelW * 0.05, hitW, Math.pow(safeP, 1.25));
      const noteH = lerp(26, 140, persP);
      const noteX = lerp(entranceX - noteW / 2, hitX, persP);

      // Cylindrical Cyber Tunnel 3D Barrel Warp & Vortex Swirl
      const warpFactor = Math.sin(safeP * Math.PI); // Parabolic 3D curve along tunnel depth
      const barrelWarp = laneOffset * (tunnelW * 0.045) * warpFactor;
      const vortexSway = Math.sin(t * 1.8 * mult + safeP * 3.0) * (tunnelW * 0.016 * mult) * warpFactor;
      const rot = (laneOffset * 0.12 + Math.cos(t * 1.8 * mult + safeP * 3.0) * 0.04) * warpFactor;

      return {
        x: noteX + barrelWarp + vortexSway,
        y: noteY,
        w: noteW,
        h: noteH,
        rot,
        scale: lerp(0.25, 1.0, persP),
      };
    }

    const { x, w } = laneAt(lane, prog, W, HW_TOP, HW_BOT);
    const noteY = prog * hitY;
    const noteH = lerp(80, 140, prog);
    return { x, y: noteY, w, h: noteH, rot: 0, scale: lerp(0.4, 1.0, prog) };
  }

  // ↔️ 90° FULL 2D HORIZONTAL SIDE-SCROLLER PERSPECTIVE
  if (archetype === 'horizontal_drift') {
    const maxW = Math.min(W, 860);
    const leftX = (W - maxW) / 2;
    const strikeX = leftX + maxW * 0.85;
    const noteX = leftX + prog * (strikeX - leftX);
    // Button Key Alignment: Lane 0 (A Key) = Bottom, Lane 1 (S Key) = Middle, Lane 2 (D Key) = Top
    const laneYMap = [H * 0.68, H * 0.52, H * 0.36];
    const noteY = laneYMap[lane] || H * 0.52;
    const noteW = lerp(45, 110, prog);
    const noteH = 65;
    return { x: noteX, y: noteY, w: noteW, h: noteH, rot: Math.PI / 2, scale: lerp(0.5, 1.0, prog) };
  }

  // 🎯 360° RADIAL CYBER ORBIT (Notes travel straight along spoke vectors to target hit circles)
  if (archetype === 'radial_orbit') {
    const cx = W / 2;
    const cy = H * 0.48; // Centered vertically in playfield
    const radarRot = t * 0.65; // Continuous 360° radar rotation
    const baseAngles = [(210 * Math.PI) / 180, (270 * Math.PI) / 180, (330 * Math.PI) / 180];
    const angle = (baseAngles[lane] || (270 * Math.PI) / 180) + radarRot;

    const rOuter = Math.min(W, H) * 0.55; // Outer spawn rim
    const rHit = Math.min(W, H) * 0.26; // Target hit pad ring
    const radius = lerp(rOuter, rHit, prog); // Travels straight along spoke vector to target hit circle
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    const noteW = lerp(90, 58, prog);
    const noteH = lerp(75, 48, prog);
    return { x: x - noteW / 2, y, w: noteW, h: noteH, rot: angle + Math.PI / 2, scale: lerp(1.1, 0.7, prog) };
  }

  // 🌀 3D TWISTING CORKSCREW HELICAL SLIDE (Remade Dual-Loop Tubular Helix)
  if (archetype === 'corkscrew_slide') {
    return getCorkscrewSpiralPos(lane, prog, W, H, t, stage);
  }

  // 🎢 3D UNDULATING WAVE ROLLERCOASTER
  if (archetype === 'wave_coaster') {
    const { x: lx, w: lw } = laneAt(lane, prog, W, 0.22, 0.88);
    const waveYOffset = Math.sin(prog * Math.PI * 2.5 + t * 3.5) * (H * 0.08);
    const noteY = prog * hitY + waveYOffset;
    const noteH = lerp(75, 135, prog);
    return { x: lx, y: noteY, w: lw, h: noteH, rot: 0, scale: lerp(0.4, 1.0, prog) };
  }

  // 🔀 3-RIBBON DETACHED SPLIT HORIZON MATRIX
  if (archetype === 'matrix_split') {
    const spread = (lane - 1) * (W * 0.22 * Math.sin(prog * Math.PI));
    const { x: lx, w: lw } = laneAt(lane, prog, W, 0.25, 0.90);
    const noteY = prog * hitY;
    const noteH = lerp(80, 140, prog);
    return {
      x: lx + spread,
      y: noteY,
      w: lw,
      h: noteH,
      rot: (lane - 1) * 0.25 * Math.sin(prog * Math.PI),
      scale: lerp(0.4, 1.0, prog),
    };
  }

  // Default Cyber Tunnel
  if (stage === 3 || stage === 5) {
    const vanishingY = hitY * 0.28;
    const cx = W / 2;
    const tunnelW = Math.min(W, 840);
    const laneOffset = lane - 1;
    const mult = stage === 5 ? 2.0 : 1.0;
    const safeP = Math.max(0, prog);
    const persP = Math.pow(safeP, 1.35);

    const entranceSpacing = tunnelW * 0.055;
    const entranceX = cx + laneOffset * entranceSpacing;
    const { x: hitX, w: hitW } = laneAt(lane, 1, W, 0.18, 0.86);

    const noteY = lerp(vanishingY, hitY, persP);
    const noteW = lerp(tunnelW * 0.05, hitW, Math.pow(safeP, 1.25));
    const noteH = lerp(26, 140, persP);
    const noteX = lerp(entranceX - noteW / 2, hitX, persP);

    const warpFactor = Math.sin(safeP * Math.PI);
    const barrelWarp = laneOffset * (tunnelW * 0.045) * warpFactor;
    const vortexSway = Math.sin(t * 1.8 * mult + safeP * 3.0) * (tunnelW * 0.016 * mult) * warpFactor;
    const rot = (laneOffset * 0.12 + Math.cos(t * 1.8 * mult + safeP * 3.0) * 0.04) * warpFactor;

    return {
      x: noteX + barrelWarp + vortexSway,
      y: noteY,
      w: noteW,
      h: noteH,
      rot,
      scale: lerp(0.25, 1.0, persP),
    };
  }

  const { x: lx, w: lw } = laneAt(lane, prog, W, 0.18, 0.86);
  const noteY = prog * hitY;
  const noteH = lerp(80, 140, prog);
  return { x: lx, y: noteY, w: lw, h: noteH, rot: 0, scale: lerp(0.4, 1.0, prog) };
}

function drawArchetypeHoldTrail(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  ns: any,
  note: Note,
  prog: number,
  headP: number,
  noteColor: string,
  archetype: TrackArchetype,
  stage: number,
  t: number,
  povMode: 'classic' | 'cyber_tunnel' | 'dynamic_stage' = 'classic'
) {
  const startLane = note.lane;
  const endLane = note.targetLane !== undefined ? note.targetLane : note.lane;
  const steps = 12;

  const pStart = ns.holdActive ? lerp(headP, 1.0, ns.holdProgress) : headP;
  const pEnd = ns.holdActive ? Math.min(prog, 1.0) : prog;

  if (pEnd <= pStart) return;

  const leftPoints: { x: number; y: number }[] = [];
  const rightPoints: { x: number; y: number }[] = [];

  for (let s = 0; s <= steps; s++) {
    const sampleP = lerp(pStart, pEnd, s / steps);
    const sampleLane = ns.holdActive ? lerp(endLane, ns.visualLane, s / steps) : lerp(endLane, startLane, s / steps);
    const projSample = getArchetypeProjection(sampleLane, sampleP, W, H, archetype, stage, t, povMode);

    const cx = projSample.x + projSample.w / 2;
    const cy = projSample.y;
    const halfW = projSample.w * 0.38;

    if (projSample.rot !== 0) {
      const cosR = Math.cos(projSample.rot);
      const sinR = Math.sin(projSample.rot);
      leftPoints.push({ x: cx - halfW * cosR, y: cy - halfW * sinR });
      rightPoints.push({ x: cx + halfW * cosR, y: cy + halfW * sinR });
    } else {
      leftPoints.push({ x: cx - halfW, y: cy });
      rightPoints.push({ x: cx + halfW, y: cy });
    }
  }

  // Draw Ribbon Outer Glow / Body (Translucent so oncoming notes remain clearly visible)
  ctx.save();
  ctx.fillStyle = "rgba(245, 240, 228, 0.16)";
  ctx.beginPath();
  ctx.moveTo(leftPoints[0].x, leftPoints[0].y);
  for (let i = 1; i <= steps; i++) {
    ctx.lineTo(leftPoints[i].x, leftPoints[i].y);
  }
  for (let i = steps; i >= 0; i--) {
    ctx.lineTo(rightPoints[i].x, rightPoints[i].y);
  }
  ctx.closePath();
  ctx.fill();

  // Draw Inner Colored Stripe with Neon Glow (Translucent for see-through readability)
  ctx.fillStyle = noteColor;
  ctx.globalAlpha = 0.50;
  ctx.shadowColor = noteColor;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  const innerLeft = leftPoints.map((p, idx) => ({
    x: lerp(leftPoints[idx].x, rightPoints[idx].x, 0.22),
    y: lerp(leftPoints[idx].y, rightPoints[idx].y, 0.22),
  }));
  const innerRight = rightPoints.map((p, idx) => ({
    x: lerp(leftPoints[idx].x, rightPoints[idx].x, 0.78),
    y: lerp(leftPoints[idx].y, rightPoints[idx].y, 0.78),
  }));

  ctx.moveTo(innerLeft[0].x, innerLeft[0].y);
  for (let i = 1; i <= steps; i++) {
    ctx.lineTo(innerLeft[i].x, innerLeft[i].y);
  }
  for (let i = steps; i >= 0; i--) {
    ctx.lineTo(innerRight[i].x, innerRight[i].y);
  }
  ctx.closePath();
  ctx.fill();

  // Outer 3D Neon Laser Edges in Cyber Tunnel Mode
  if (povMode === 'cyber_tunnel') {
    ctx.strokeStyle = noteColor;
    ctx.lineWidth = 3.0;
    ctx.shadowColor = noteColor;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.moveTo(leftPoints[0].x, leftPoints[0].y);
    for (let i = 1; i <= steps; i++) {
      ctx.lineTo(leftPoints[i].x, leftPoints[i].y);
    }
    ctx.moveTo(rightPoints[0].x, rightPoints[0].y);
    for (let i = 1; i <= steps; i++) {
      ctx.lineTo(rightPoints[i].x, rightPoints[i].y);
    }
    ctx.stroke();
  }

  ctx.restore();
}

function prerenderStaticTrack(
  W: number,
  H: number,
  dpr: number,
  difficultyLevel: number,
  laneColors: [string, string, string],
  gameTrack: string = 'classic',
  povMode: 'classic' | 'cyber_tunnel' | 'dynamic_stage' = 'classic',
  stage: number = 1
): HTMLCanvasElement {
  const off = document.createElement("canvas");
  off.width = W * dpr;
  off.height = H * dpr;
  const ctx = off.getContext("2d");
  if (!ctx) return off;

  ctx.scale(dpr, dpr);

  const hitY = H * HIT_RATIO;
  const isCyberStage = povMode === 'cyber_tunnel' && (stage === 3 || stage === 5);
  const topRatio = isCyberStage ? 0.18 : HW_TOP;
  const botRatio = isCyberStage ? 0.86 : HW_BOT;
  const hwTop = hwAtProgress(0, W, topRatio, botRatio);
  const hwBot = hwAtProgress(1, W, topRatio, botRatio);

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

  // Draw distinct lane background colors based on selected gameTrack
  for (let i = 0; i < LANE_COUNT; i++) {
    const { x: lx0, w: lw0 } = laneAt(i, 0, W);
    const { x: lx1, w: lw1 } = laneAt(i, 1, W);
    
    const laneGrad = ctx.createLinearGradient(0, 0, 0, hitY);
    if (gameTrack === 'transparent') {
      // Ultra-clean Ghost Glass (Transparent floor showing background visuals)
      laneGrad.addColorStop(0, "rgba(0, 0, 0, 0.02)");
      laneGrad.addColorStop(0.5, "rgba(10, 10, 20, 0.05)");
      laneGrad.addColorStop(1, "rgba(255, 255, 255, 0.08)");
    } else if (gameTrack === 'cyber_matrix') {
      // Cyber Matrix Wireframe (Avant-Garde Terminal Green)
      laneGrad.addColorStop(0, "rgba(0, 12, 5, 0.5)");
      laneGrad.addColorStop(0.5, "rgba(0, 25, 10, 0.7)");
      laneGrad.addColorStop(1, "rgba(0, 45, 18, 0.85)");
    } else if (gameTrack === 'neon_hyperdrive') {
      // Hyperdrive Synthwave (Neon Purple / Hot Cyan)
      laneGrad.addColorStop(0, "rgba(18, 2, 30, 0.55)");
      laneGrad.addColorStop(0.5, "rgba(35, 5, 50, 0.75)");
      laneGrad.addColorStop(1, "rgba(60, 10, 80, 0.9)");
    } else if (gameTrack === 'sacred_visualizer' || gameTrack === 'slideshow') {
      // Dark Overlay Glass for Visualizers
      laneGrad.addColorStop(0, "rgba(5, 5, 12, 0.3)");
      laneGrad.addColorStop(0.5, "rgba(12, 12, 25, 0.5)");
      laneGrad.addColorStop(1, "rgba(20, 20, 38, 0.7)");
    } else {
      // Classic Silver Gradient
      laneGrad.addColorStop(0, "#0a0a0c");
      laneGrad.addColorStop(0.35, "#18181c");
      laneGrad.addColorStop(0.7, "#3b3b42");
      laneGrad.addColorStop(1, "#5f5f66");
    }
    
    ctx.fillStyle = laneGrad;
    ctx.beginPath();
    ctx.moveTo(lx0, 0);
    ctx.lineTo(lx0 + lw0, 0);
    ctx.lineTo(lx1 + lw1, hitY);
    ctx.lineTo(lx1, hitY);
    ctx.closePath();
    ctx.fill();
  }

  // Subtle perspective horizontal grid lines
  const gridRows = (gameTrack === 'cyber_matrix' || gameTrack === 'neon_hyperdrive') ? 24 : 16;
  for (let row = 0; row <= gridRows; row++) {
    const ry = (row / gridRows) * hitY;
    const rp = ry / hitY;
    const { left, right } = hwAtProgress(rp, W);
    
    if (gameTrack === 'cyber_matrix') {
      ctx.strokeStyle = `rgba(57, 255, 20, ${0.05 + rp * 0.25})`;
      ctx.lineWidth = 1;
    } else if (gameTrack === 'neon_hyperdrive') {
      ctx.strokeStyle = `rgba(0, 229, 255, ${0.05 + rp * 0.28})`;
      ctx.lineWidth = 1.2;
    } else if (gameTrack === 'transparent') {
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.01 + rp * 0.04})`;
      ctx.lineWidth = 0.8;
    } else {
      ctx.strokeStyle = `rgba(255,248,235,${0.01 + rp * 0.025})`;
      ctx.lineWidth = 1;
    }

    ctx.beginPath();
    ctx.moveTo(left, ry);
    ctx.lineTo(right, ry);
    ctx.stroke();
  }

  // Lane groove dividers — double-line with glow
  for (let l = 1; l < LANE_COUNT; l++) {
    const topPos = laneAt(l, 0, W);
    const botPos = laneAt(l, 1, W);

    if (gameTrack === 'cyber_matrix') {
      ctx.strokeStyle = "rgba(0, 30, 10, 0.9)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(topPos.x, 0);
      ctx.lineTo(botPos.x, hitY);
      ctx.stroke();

      const divGrad = ctx.createLinearGradient(0, 0, 0, hitY);
      divGrad.addColorStop(0, "rgba(57, 255, 20, 0.1)");
      divGrad.addColorStop(0.5, "rgba(57, 255, 20, 0.5)");
      divGrad.addColorStop(1, "rgba(57, 255, 20, 0.85)");
      ctx.strokeStyle = divGrad;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(topPos.x, 0);
      ctx.lineTo(botPos.x, hitY);
      ctx.stroke();
    } else if (gameTrack === 'neon_hyperdrive') {
      ctx.strokeStyle = "rgba(20, 0, 30, 0.9)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(topPos.x, 0);
      ctx.lineTo(botPos.x, hitY);
      ctx.stroke();

      const divGrad = ctx.createLinearGradient(0, 0, 0, hitY);
      divGrad.addColorStop(0, "rgba(255, 20, 147, 0.1)");
      divGrad.addColorStop(0.5, "rgba(255, 20, 147, 0.6)");
      divGrad.addColorStop(1, "rgba(255, 20, 147, 0.9)");
      ctx.strokeStyle = divGrad;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(topPos.x, 0);
      ctx.lineTo(botPos.x, hitY);
      ctx.stroke();
    } else if (gameTrack === 'transparent') {
      ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(topPos.x, 0);
      ctx.lineTo(botPos.x, hitY);
      ctx.stroke();

      const divGrad = ctx.createLinearGradient(0, 0, 0, hitY);
      divGrad.addColorStop(0, "rgba(255, 255, 255, 0.05)");
      divGrad.addColorStop(0.7, "rgba(255, 255, 255, 0.25)");
      divGrad.addColorStop(1, "rgba(255, 255, 255, 0.4)");
      ctx.strokeStyle = divGrad;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(topPos.x, 0);
      ctx.lineTo(botPos.x, hitY);
      ctx.stroke();
    } else {
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
  }

  ctx.restore();
  return off;
}

function getSongIntroTheme(laneColors: [string, string, string]) {
  const c0 = laneColors[0] || "#FF1493";
  const c1 = laneColors[1] || "#00E5FF";
  const c2 = laneColors[2] || "#39FF14";

  return {
    subLabelColor: c1,
    subLabelGlow: `0 0 16px ${c1}`,
    titleGradient: `linear-gradient(135deg, #FFFFFF 0%, ${c0} 35%, ${c1} 70%, ${c2} 100%)`,
    titleFilter: `drop-shadow(0 0 35px ${c0}) drop-shadow(0 0 65px ${c1})`,
    goGradient: `linear-gradient(135deg, #FFFFFF 0%, ${c2} 40%, ${c1} 70%, ${c0} 100%)`,
    goFilter: `drop-shadow(0 0 45px ${c2}) drop-shadow(0 0 90px ${c1})`,
  };
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
  cycle: number;
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

const AnimatedScore = memo(({ score }: { score: number }) => {
  const animatedVal = useAnimatedCount(score);
  return <>{animatedVal.toLocaleString()}</>;
});

// ── procedural chart generator for empty beatmaps ────────────────
interface Stage {
  stage: number;
  name: string;
  startTime: number;
  endTime: number;
  difficulty: string;
  noteCount: number;
}

function stageifyNotes(notes: Note[], duration: number, bpm: number, difficultyLevel = 5): { notes: Note[], stages: Stage[] } {
  const beatDuration = 60 / bpm;

  // Stage boundaries: 15% / 20% / 25% / 20% / 20%
  const STAGE_PERCENTS = [0, 0.15, 0.35, 0.60, 0.80, 1.0];
  const stageBounds = [
    { stage: 1, name: "Stage 1",      startTime: duration * STAGE_PERCENTS[0], endTime: duration * STAGE_PERCENTS[1], difficulty: "EASY",   noteCount: 0 },
    { stage: 2, name: "Stage 2",      startTime: duration * STAGE_PERCENTS[1], endTime: duration * STAGE_PERCENTS[2], difficulty: "MEDIUM", noteCount: 0 },
    { stage: 3, name: "Stage 3",      startTime: duration * STAGE_PERCENTS[2], endTime: duration * STAGE_PERCENTS[3], difficulty: "HARD",   noteCount: 0 },
    { stage: 4, name: "Stage 4",      startTime: duration * STAGE_PERCENTS[3], endTime: duration * STAGE_PERCENTS[4], difficulty: "BRUTAL", noteCount: 0 },
    { stage: 5, name: "FINAL STAGE",  startTime: duration * STAGE_PERCENTS[4], endTime: duration * STAGE_PERCENTS[5], difficulty: "BRUTAL", noteCount: 0 }
  ];

  // Transition boundaries between stages
  const boundaries = STAGE_PERCENTS.slice(1, -1).map(p => duration * p);

  // BPM-relative transition gap (4 beats)
  const gapDuration = 4 * beatDuration;

  // Mechanic allowlists per stage
  const ALLOWED: Record<number, Set<string>> = {
    1: new Set(['tap']),
    2: new Set(['tap', 'hold']),
    3: new Set(['tap', 'hold', 'swipe', 'accent']),
    4: new Set(['tap', 'hold', 'swipe', 'accent', 'remix', 'break', 'lift', 'mine']),
    5: new Set(['tap', 'hold', 'swipe', 'accent', 'remix', 'break', 'lift', 'mine']),
  };

  // Min spacing per stage (multiplier of beatDuration) — tightest at stage end
  const MIN_SPACING = [0.85, 0.45, 0.22, 0.15, 0.08];
  const DENSITY_RAMP = 1.5; // spacing is 1.5× wider at stage start

  const processed: Note[] = [];
  const lastTime: Record<number, number> = { 1: -999, 2: -999, 3: -999, 4: -999, 5: -999 };

  const sorted = [...notes].sort((a, b) => a.time - b.time);

  for (const note of sorted) {
    // Skip notes in BPM-relative transition gaps
    const inGap = boundaries.some(b => note.time >= b - 0.1 && note.time <= b + gapDuration);
    if (inGap) continue;

    // Determine stage
    let stage = 5;
    for (const sb of stageBounds) {
      if (note.time >= sb.startTime && note.time < sb.endTime) {
        stage = sb.stage;
        break;
      }
    }

    const clone: Note = { ...note, stage };
    const allowed = ALLOWED[stage];

    // Gate mines: only Stage 4+ AND difficultyLevel >= 7
    if (clone.type === 'mine') {
      if (stage < 4 || difficultyLevel < 7) continue;
    }
    // Downgrade unsupported types
    else if (!allowed.has(clone.type as string)) {
      if (clone.type === 'swipe') {
        clone.type = 'tap';
        delete clone.swipeDirection;
      } else if (clone.type === 'hold' && !allowed.has('hold')) {
        clone.type = 'tap';
        delete clone.holdDuration;
        delete clone.targetLane;
      } else if (['remix', 'break', 'accent', 'lift'].includes(clone.type as string)) {
        clone.type = 'tap';
        delete clone.swipeDirection;
        delete clone.holdDuration;
        delete clone.targetLane;
      }
    }

    // Stage 1: strip all advanced fields
    if (stage === 1) {
      delete clone.holdDuration;
      delete clone.targetLane;
      delete clone.swipeDirection;
    }
    // Stage 2: strip swipe fields
    if (stage === 2) {
      delete clone.swipeDirection;
    }

    // Intra-stage density ramp: wider spacing at stage start, tighter at end
    const sb = stageBounds[stage - 1];
    const progress = Math.max(0, Math.min(1, (note.time - sb.startTime) / Math.max(0.1, sb.endTime - sb.startTime)));
    const baseSpacing = MIN_SPACING[stage - 1] * beatDuration;
    const startSpacing = baseSpacing * DENSITY_RAMP;
    const minSpacing = startSpacing + (baseSpacing - startSpacing) * progress;

    if (note.time - lastTime[stage] < minSpacing) continue;

    // Prevent simultaneous notes in stages 1-3
    if (stage <= 3) {
      if (processed.some(n => Math.abs(n.time - clone.time) < 0.02)) continue;
    }

    processed.push(clone);
    lastTime[stage] = note.time;
  }

  const finalNotes = processed.map((note, index) => ({
    ...note,
    id: index
  }));

  const stagesWithCounts = stageBounds.map(sb => ({
    ...sb,
    noteCount: finalNotes.filter(n => n.stage === sb.stage).length,
  }));

  return { notes: finalNotes, stages: stagesWithCounts };
}

type PatternType = 'stair_up' | 'stair_down' | 'trill_outer' | 'trill_left' | 'trill_right' | 'wave' | 'jack' | 'dual_outer' | 'dual_left' | 'dual_right' | 'single_tap' | 'hold_rail' | 'slide_hold';

interface PatternStep {
  lanes: number[];
  type?: NoteType;
  holdDuration?: number;
  targetLane?: number;
  swipeDirection?: 'up' | 'down' | 'left' | 'right';
  stepBeatOffset: number;
}

function getPatternSequence(
  pattern: PatternType, 
  bpm: number, 
  difficulty: number, 
  lastLane: number
): PatternStep[] {
  const beatDur = 60 / bpm;
  switch (pattern) {
    case 'stair_up':
      return [
        { lanes: [0], stepBeatOffset: 0 },
        { lanes: [1], stepBeatOffset: 1 },
        { lanes: [2], stepBeatOffset: 2 }
      ];
    case 'stair_down':
      return [
        { lanes: [2], stepBeatOffset: 0 },
        { lanes: [1], stepBeatOffset: 1 },
        { lanes: [0], stepBeatOffset: 2 }
      ];
    case 'trill_outer':
      return [
        { lanes: [0], stepBeatOffset: 0 },
        { lanes: [2], stepBeatOffset: 0.75 },
        { lanes: [0], stepBeatOffset: 1.5 },
        { lanes: [2], stepBeatOffset: 2.25 }
      ];
    case 'trill_left':
      return [
        { lanes: [0], stepBeatOffset: 0 },
        { lanes: [1], stepBeatOffset: 0.75 },
        { lanes: [0], stepBeatOffset: 1.5 },
        { lanes: [1], stepBeatOffset: 2.25 }
      ];
    case 'trill_right':
      return [
        { lanes: [1], stepBeatOffset: 0 },
        { lanes: [2], stepBeatOffset: 0.75 },
        { lanes: [1], stepBeatOffset: 1.5 },
        { lanes: [2], stepBeatOffset: 2.25 }
      ];
    case 'wave':
      return [
        { lanes: [0], stepBeatOffset: 0 },
        { lanes: [1], stepBeatOffset: 1 },
        { lanes: [2], stepBeatOffset: 2 },
        { lanes: [1], stepBeatOffset: 3 },
        { lanes: [0], stepBeatOffset: 4 }
      ];
    case 'jack': {
      const jackLane = Math.max(0, Math.min(2, lastLane));
      return [
        { lanes: [jackLane], stepBeatOffset: 0 },
        { lanes: [jackLane], stepBeatOffset: 1 },
        { lanes: [jackLane], stepBeatOffset: 2 }
      ];
    }
    case 'dual_outer':
      return [
        { lanes: [0, 2], type: difficulty >= 7 ? 'break' : 'tap', stepBeatOffset: 0 }
      ];
    case 'dual_left':
      return [
        { lanes: [0, 1], type: 'tap', stepBeatOffset: 0 }
      ];
    case 'dual_right':
      return [
        { lanes: [1, 2], type: 'tap', stepBeatOffset: 0 }
      ];
    case 'slide_hold': {
      const fromLane = lastLane === 0 ? 0 : lastLane === 2 ? 2 : 0;
      const toLane = fromLane === 0 ? 2 : 0;
      return [
        { 
          lanes: [fromLane], 
          type: 'hold', 
          holdDuration: beatDur * 2.5, 
          targetLane: toLane,
          swipeDirection: toLane > fromLane ? 'right' as const : 'left' as const,
          stepBeatOffset: 0 
        }
      ];
    }
    case 'hold_rail':
      return [
        { 
          lanes: [lastLane], 
          type: 'hold', 
          holdDuration: beatDur * 2, 
          swipeDirection: undefined,
          stepBeatOffset: 0 
        }
      ];
    default:
      return [
        { lanes: [lastLane], stepBeatOffset: 0 }
      ];
  }
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

  // Determine effective chart end time (leave 3.5s buffer before audio ends)
  const maxChartTime = Math.max(10, duration - 3.5);

  let patternQueue: { lane: number; type: NoteType; holdDuration?: number; targetLane?: number; swipeDirection?: 'up'|'down'|'left'|'right'; timeOffset: number }[] = [];

  while (time < maxChartTime) {
    const progress = time / duration;
    
    // Dynamic difficulty & section parameters
    const isIntro = progress < 0.15;
    const isBridge = progress >= 0.65 && progress < 0.80;
    const isChorus = (progress >= 0.40 && progress < 0.65) || progress >= 0.85;

    let stepMultiplier = 2; // Default: every 2 beats
    if (difficulty >= 9) stepMultiplier = 0.5; // Half beats
    else if (difficulty >= 7) stepMultiplier = 1;  // Every beat
    else if (difficulty >= 4) stepMultiplier = 1.5;
    else stepMultiplier = 3; // Easy

    if (isIntro) stepMultiplier *= 1.5;
    else if (isBridge) stepMultiplier *= 1.25;
    else if (isChorus) stepMultiplier *= 0.75;

    stepMultiplier = Math.max(0.5, stepMultiplier);

    // Populate pattern queue if empty
    if (patternQueue.length === 0) {
      const roll = Math.floor((time * 17 + id * 11) % 100);
      let selectedPattern: PatternType = 'single_tap';

      if (isIntro) {
        if (roll < 30) selectedPattern = 'stair_up';
        else if (roll < 60) selectedPattern = 'stair_down';
        else if (roll < 80) selectedPattern = 'hold_rail';
        else selectedPattern = 'single_tap';
      } else if (isChorus) {
        if (difficulty >= 5 && roll < 20) selectedPattern = 'trill_outer';
        else if (difficulty >= 4 && roll < 35) selectedPattern = 'stair_up';
        else if (difficulty >= 4 && roll < 50) selectedPattern = 'stair_down';
        else if (difficulty >= 5 && roll < 65) selectedPattern = 'wave';
        else if (difficulty >= 4 && roll < 80) selectedPattern = 'dual_outer';
        else if (difficulty >= 6 && roll < 90) selectedPattern = 'slide_hold';
        else selectedPattern = 'trill_left';
      } else if (isBridge) {
        if (roll < 40) selectedPattern = 'wave';
        else if (roll < 70) selectedPattern = 'hold_rail';
        else selectedPattern = 'stair_down';
      } else { // Verse / Normal
        if (roll < 25) selectedPattern = 'stair_up';
        else if (roll < 50) selectedPattern = 'stair_down';
        else if (difficulty >= 4 && roll < 70) selectedPattern = 'jack';
        else if (difficulty >= 5 && roll < 85) selectedPattern = 'trill_right';
        else selectedPattern = 'hold_rail';
      }

      const steps = getPatternSequence(selectedPattern, bpm, difficulty, lastLane);
      for (const s of steps) {
        for (const l of s.lanes) {
          patternQueue.push({
            lane: l,
            type: (s.type as NoteType) || 'tap',
            holdDuration: s.holdDuration,
            targetLane: s.targetLane,
            swipeDirection: s.swipeDirection,
            timeOffset: s.stepBeatOffset * beatDuration
          });
        }
      }
    }

    // Dequeue note(s) at current step time
    if (patternQueue.length > 0) {
      const nextStep = patternQueue.shift()!;
      const noteTime = parseFloat((time + nextStep.timeOffset).toFixed(3));

      if (noteTime < maxChartTime) {
        notes.push({
          id: id++,
          time: noteTime,
          lane: nextStep.lane,
          type: nextStep.type,
          holdDuration: nextStep.holdDuration ? parseFloat(nextStep.holdDuration.toFixed(3)) : undefined,
          targetLane: nextStep.targetLane,
          swipeDirection: nextStep.swipeDirection
        });
        lastLane = nextStep.lane;
      }
    }

    time += stepMultiplier * beatDuration;
  }

  const stageified = stageifyNotes(notes, duration, bpm, difficulty);
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
  
  const candidates = getCandidateAudioUrls(audioUrl, song.day);
  let response: Response | null = null;
  for (const c of candidates) {
    try {
      const res = await fetch(c);
      if (res.ok) {
        response = res;
        break;
      }
    } catch {}
  }
  if (!response || !response.ok) {
    throw new Error(`Fetch failed for audio candidates`);
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

  for (let i = 0; i < totalSamples; i += blockSize) {
    let sum = 0;
    const end = Math.min(totalSamples, i + blockSize);
    for (let j = i; j < end; j++) {
      sum += channelData[j] * channelData[j];
    }
    const rms = Math.sqrt(sum / (end - i));
    blockEnergies.push(rms);
  }

  // Detect active sound energy fade-out boundary to clip trailing silence
  let lastActiveBlock = blockEnergies.length - 1;
  while (lastActiveBlock > movingAvgWindow && blockEnergies[lastActiveBlock] < 0.008) {
    lastActiveBlock--;
  }
  const activeEnergyEndTime = (lastActiveBlock * blockSize) / sampleRate;
  const effectiveAudioDuration = Math.max(10, Math.min(duration, activeEnergyEndTime > 10 ? activeEnergyEndTime : duration));
  console.log(`[Audio Forge] Track duration: ${duration}s, active sound energy until ${activeEnergyEndTime.toFixed(1)}s (effective: ${effectiveAudioDuration.toFixed(1)}s)`);

  const thresholdRatio = 1.35 - (difficulty * 0.035);
  const minCooldown = Math.max(0.12, 0.45 - (difficulty * 0.035));
  let lastNoteTime = 0;
  const noteTimes: number[] = [];

  for (let b = movingAvgWindow; b < blockEnergies.length; b++) {
    const instantEnergy = blockEnergies[b];

    let windowSum = 0;
    for (let w = b - movingAvgWindow; w < b; w++) {
      windowSum += blockEnergies[w];
    }
    const localAvgEnergy = windowSum / movingAvgWindow;
    const blockTime = (b * blockSize) / sampleRate;

    if (instantEnergy > localAvgEnergy * thresholdRatio && instantEnergy > 0.015) {
      if (blockTime - lastNoteTime >= minCooldown && blockTime >= 3.0 && blockTime < effectiveAudioDuration - 3.5) {
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
      if (difficulty >= 5 && slideRoll < 45) {
        targetLane = (lane + 1 + (index % 2)) % 3;
      }
      
      const swipeRoll = (index * 23) % 100;
      if (difficulty >= 4 && swipeRoll < 60) {
        swipeDirection = (index % 3 === 0) ? 'up' : (index % 3 === 1) ? 'left' : 'right';
      }
    } else if (difficulty >= 4 && (index * 23) % 100 < 22) {
      noteType = 'swipe' as any;
      swipeDirection = (index % 3 === 0) ? 'up' : (index % 3 === 1) ? 'left' : 'right';
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

    const canSpawnDual = difficulty >= 4;
    if (canSpawnDual) {
      const dualRoll = (time * 23 + index * 3) % 100;
      const dualChance = difficulty >= 7 ? 35 : 20;
      
      if (dualRoll < dualChance && energy > 0.12) {
        const comboIdx = (index + Math.floor(time)) % 3;
        let laneA = 0;
        let laneB = 2;
        if (comboIdx === 1) {
          laneA = 1;
          laneB = 2;
        } else if (comboIdx === 2) {
          laneA = 0;
          laneB = 1;
        }

        const lastNote = notes[notes.length - 1];
        if (lastNote) {
          lastNote.lane = laneA;
        }

        let secondType: 'tap' | 'hold' = 'tap';
        let secondHoldDuration: number | undefined;
        let secondSwipeDir: 'up' | 'down' | 'left' | 'right' | undefined;
        let secondTargetLane: number | undefined;
        
        const typeRoll = (index * 13 + Math.floor(time)) % 100;
        if (difficulty >= 6 && typeRoll < 40) {
          secondType = 'hold';
          secondHoldDuration = beatDuration * 1.5;
          if (index % 2 === 0) {
            secondSwipeDir = 'up';
          }
        }
        
        notes.push({
          id: 30000 + index,
          time: parseFloat(time.toFixed(3)),
          lane: laneB,
          type: secondType,
          holdDuration: secondHoldDuration ? parseFloat(secondHoldDuration.toFixed(3)) : undefined,
          targetLane: secondTargetLane,
          swipeDirection: secondSwipeDir
        });
      }
    }
  });

  if (notes.length < 10) {
    console.warn(`[Audio Forge] Only detected ${notes.length} peaks. Falling back to math generation.`);
    return generateProceduralChart(song);
  }

  const stageified = stageifyNotes(notes, effectiveAudioDuration, bpm, song.difficultyLevel || 5);
  song.stages = stageified.stages;
  console.log(`[Audio Forge] Success! Analyzed ${effectiveAudioDuration.toFixed(1)}s audio and forged ${stageified.notes.length} notes (stages applied).`);
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
  const lastLaneHitRef = useRef<Record<number, { ts: number; type: string }>>({});

  const addJudgment = useCallback((newJ: JudgmentDisplay) => {
    const now = Date.now();
    let write = 0;
    const arr = jRef.current;
    for (let i = 0; i < arr.length; i++) {
      if (now - arr[i].ts < 600) {
        arr[write++] = arr[i];
      }
    }
    arr.length = write;
    arr.push(newJ);
    lastLaneHitRef.current[newJ.lane] = { ts: newJ.ts, type: newJ.type };
  }, []);
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
    cycle: 0,
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
  const tunnelComboFlashRef = useRef<{ lastCombo: number; flashStartMs: number }>({ lastCombo: 0, flashStartMs: 0 });
  const milestoneFxRef = useRef<MilestoneEffect[]>([]);
  const remixFlashUntilRef = useRef<number>(0);
  const remixEffectNameRef = useRef<string | null>(null);

  const continueUsedRef = useRef<number>(0); // how many continues the player has used (max 3)
  const coverImgRef = useRef<HTMLImageElement | null>(null);
  const coverBlurRef = useRef<HTMLCanvasElement | null>(null);
  const scanPatternRef = useRef<CanvasPattern | null>(null);
  const lastMedalRef = useRef<string>("NONE");
  const ambientParticlesRef = useRef<AmbientParticle[]>([]);
  const tunnelParticlesRef = useRef<{z: number; size: number; speed: number; ang: number; rad: number}[]>([]);
  const lastFrameTimeRef = useRef<number>(performance.now());
  const medalStampRef = useRef<{ medal: string; startT: number } | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gameplayAnalyserRef = useRef<AnalyserNode | null>(null);
  const gameplayAnalyserDataRef = useRef<Uint8Array | null>(null);
  const recordedTelemetryRef = useRef<{ noteId: number; time: number; judgment: string; offset: number; lane: number; type: string }[]>([]);
  const ghostTelemetryRef = useRef<any[] | null>(null);
  const ghostIndexRef = useRef<number>(0);
  const ghostActiveKeysRef = useRef<boolean[]>([false, false, false]);
  const ghostJudgmentsRef = useRef<{ id: number; type: string; lane: number; ts: number }[]>([]);
  const ghostJCounter = useRef(0);
  const gameplaySlideshowFloatersRef = useRef<any[]>([]);
  const slideshowSlidesRef = useRef<any[]>([]);
  const currentSlideIdxRef = useRef<number>(0);
  const nextSlideIdxRef = useRef<number>(-1);
  const slideTimeRef = useRef<number>(0);
  const fadeAlphaRef = useRef<number>(1);
  const audioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
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
  const [loadState, setLoadState] = useState<TransmissionLoadState>({
    step: 1,
    stepLabel: "FETCHING TRANSMISSION METADATA",
    detailMsg: "Querying track catalog & JSON manifest...",
    bytesLoaded: 0,
    bytesTotal: 0,
    speedBps: 0,
    etaSeconds: 0,
    pct: 8,
    isStreaming: false,
    logs: [" [SYS] Connecting to transmission gateway..."],
  });


  // ── Frame-Perfect Video Recorder State (DEV SERVER ONLY) ──
  const isExportVideoRef = useRef<boolean>(
    Boolean(import.meta.env.DEV) && (
      new URLSearchParams(window.location.search).get("export") === "video" ||
      sessionStorage.getItem(`export_video_${songId}`) === "true"
    )
  );
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [frameCount, setFrameCount] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoMimeType, setVideoMimeType] = useState<string>("video/mp4");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const frameCounterRef = useRef<number>(0);

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

  const [activePu, setActivePu] = useState<{
    label: string;
    color: string;
    multiplier: number;
    progress: number;
  } | null>(null);



  const updatePuDisplayDOM = useCallback((
    displayData: {
      label: string;
      color: string;
      multiplier: number;
      progress: number;
    } | null
  ) => {
    setActivePu(displayData);
  }, []);

  const resetPuDisplayDOM = useCallback(() => {
    setActivePu(null);
  }, []);
  const [missCount, setMissCount] = useState(0);
  const [continueCountdown, setContinueCountdown] = useState(10);
  const [opts, setOpts] = useState<GameOpts>(loadOpts);
  const optsRef = useRef(opts);
  useEffect(() => { optsRef.current = opts; }, [opts]);

  // ── 6-Archetype Track Geometry & Stage Color Primer Engine ──
  const activeArchetypeRef = useRef<TrackArchetype>('cyber_tunnel');
  const [activeArchetype, setActiveArchetype] = useState<TrackArchetype>('cyber_tunnel');

  // ── POV Perspective Engine State ──
  const [activePovMode, setActivePovMode] = useState<'classic' | 'cyber_tunnel' | 'dynamic_stage'>(opts.povMode || 'classic');
  const activePovModeRef = useRef(activePovMode);
  const [isPovLocked, setIsPovLocked] = useState<boolean>(() => {
    return typeof localStorage !== 'undefined' && localStorage.getItem('opt_povLocked') === 'true';
  });
  const isPovLockedRef = useRef(isPovLocked);
  const [povToast, setPovToast] = useState<{ mode: string; time: number } | null>(null);

  useEffect(() => {
    activePovModeRef.current = activePovMode;
  }, [activePovMode]);

  useEffect(() => {
    isPovLockedRef.current = isPovLocked;
  }, [isPovLocked]);

  useEffect(() => {
    if (opts.povMode) {
      setActivePovMode(opts.povMode);
      activePovModeRef.current = opts.povMode;
    }
  }, [opts.povMode]);

  const togglePovLock = useCallback(() => {
    const nextLocked = !isPovLockedRef.current;
    setIsPovLocked(nextLocked);
    isPovLockedRef.current = nextLocked;
    try {
      localStorage.setItem('opt_povLocked', String(nextLocked));
    } catch {}
    audioManager.playSfx('tap_nav', 0.15);
    setPovToast({
      mode: nextLocked ? 'PERSPECTIVE LOCKED 🔒' : 'PERSPECTIVE UNLOCKED 🔓',
      time: Date.now(),
    });
  }, []);

  const povTransitionRef = useRef<{
    startTime: number;
    duration: number;
    fromMode: 'classic' | 'cyber_tunnel' | 'dynamic_stage';
    toMode: 'classic' | 'cyber_tunnel' | 'dynamic_stage';
    warpAlpha: number;
  }>({
    startTime: 0,
    duration: 600,
    fromMode: opts.povMode || 'classic',
    toMode: opts.povMode || 'classic',
    warpAlpha: 0,
  });

  const cyclePovMode = useCallback(() => {
    const modes: ('classic' | 'cyber_tunnel' | 'dynamic_stage')[] = ['classic', 'cyber_tunnel', 'dynamic_stage'];
    const currentIdx = modes.indexOf(activePovModeRef.current);
    const nextMode = modes[(currentIdx + 1) % modes.length];
    
    povTransitionRef.current = {
      startTime: Date.now(),
      duration: 600,
      fromMode: activePovModeRef.current,
      toMode: nextMode,
      warpAlpha: 1.0,
    };
    
    setActivePovMode(nextMode);
    activePovModeRef.current = nextMode;
    offscreenCanvasRef.current = null; // Reset offscreen canvas cache to regenerate track geometry
    audioManager.playSfx('menu_confirm', 0.18);

    const labels = {
      classic: '2.5D CLASSIC HIGHWAY',
      cyber_tunnel: '3D CYBER TUNNEL VORTEX',
      dynamic_stage: 'DYNAMIC STAGE CAM',
    };
    setPovToast({ mode: labels[nextMode], time: Date.now() });
  }, []);

  const cycleArchetype = useCallback(() => {
    const list: TrackArchetype[] = ['corkscrew_slide', 'cyber_tunnel', 'wave_coaster', 'matrix_split'];
    const currIdx = list.indexOf(activeArchetypeRef.current);
    const nextIdx = (currIdx + 1) % list.length;
    const nextArch = list[nextIdx];
    activeArchetypeRef.current = nextArch;
    setActiveArchetype(nextArch);
    audioManager.playSfx('tap_nav', 0.15);
    setPovToast({
      mode: `DEV ARCHETYPE: ${ARCHETYPE_METAS[nextArch].name.toUpperCase()}`,
      time: Date.now(),
    });
    console.log(`[Dev Mode] Switched track archetype geometry to '${nextArch}' (${ARCHETYPE_METAS[nextArch].name})`);
  }, []);

  // Load and segment slideshow images for track customization
  useEffect(() => {
    if (opts.gameTrack !== 'slideshow') return;

    let active = true;

    const fetchAndSegment = async () => {
      try {
        let imageUrls = staticImages.length > 0 ? [...staticImages] : ['/data/slideshow/cyber_dancer.jpg', '/data/slideshow/cyber_headphones.jpg', '/data/slideshow/cyber_dj.jpg'];
        
        const freeStella = localStorage.getItem('opt_free_stella_unlocked') === 'true';
        const purchasedString = localStorage.getItem('opt_purchased_stunners') || '[]';
        const purchasedList: string[] = JSON.parse(purchasedString);

        const filtered = imageUrls.filter((url: string) => {
          const isStella = /stella/i.test(url);
          if (!isStella) return true;
          if (freeStella) return true;
          return purchasedList.some((pUrl: string) => url.includes(pUrl) || pUrl.includes(url));
        });

        if (filtered.length > 0) {
          imageUrls = filtered;
        } else {
          imageUrls = ['/data/slideshow/cyber_dancer.jpg', '/data/slideshow/cyber_headphones.jpg', '/data/slideshow/cyber_dj.jpg'];
        }

        try {
          const res = await fetch('http://localhost:3002/api/slideshow-images')
            .catch(() => fetch('/api/slideshow-images'))
            .catch(() => null);
          if (res && res.ok) {
            const files = await res.json();
            if (files && files.length > 0) {
              imageUrls = files.filter((url: string) => {
                const isStella = /stella/i.test(url);
                if (!isStella) return true;
                if (freeStella) return true;
                return purchasedList.some((pUrl: string) => url.includes(pUrl) || pUrl.includes(url));
              });
            }
          }
        } catch (e) {
          console.warn('[GamePlay Slideshow] API offline, using fallback assets');
        }

        const slides: any[] = [];
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

          const w = img.naturalWidth;
          const h = img.naturalHeight;
          const tempCanvas = document.createElement('canvas');
          const targetH = 450;
          const targetW = Math.round((w / h) * targetH);
          tempCanvas.width = targetW;
          tempCanvas.height = targetH;
          const tCtx = tempCanvas.getContext('2d')!;
          tCtx.drawImage(img, 0, 0, targetW, targetH);
          refineAndBlendEdges(tempCanvas, 32);

          slides.push({
            canvas: tempCanvas,
            width: targetW,
            height: targetH,
            glowColor: colors[idx % colors.length]
          });
        }

        if (active) {
          slideshowSlidesRef.current = slides;
          currentSlideIdxRef.current = 0;
          nextSlideIdxRef.current = -1;
          slideTimeRef.current = 0;
          fadeAlphaRef.current = 1;
        }
      } catch (e) {
        console.error('[GamePlay Slideshow Loader] Cutout generation failed:', e);
      }
    };

    fetchAndSegment();

    return () => {
      active = false;
    };
  }, [opts.gameTrack]);

  // Regenerate static track offscreen cache when gameTrack style changes
  useEffect(() => {
    optsRef.current.gameTrack = opts.gameTrack;
    if (canvasRef.current) {
      const c = canvasRef.current;
      const dpr = window.devicePixelRatio || 1;
      const W = c.width / dpr;
      const H = c.height / dpr;
      const diffLevel = songRef.current?.difficultyLevel ?? 5;
      offscreenCanvasRef.current = prerenderStaticTrack(
        W,
        H,
        dpr,
        diffLevel,
        laneColorsRef.current,
        opts.gameTrack
      );
    }
  }, [opts.gameTrack]);
  // Keep mutable refs current every render so draw/handlers always see latest values
  // without needing to be listed as useCallback dependencies.
  audioOffsetRef.current = opts.audioOffset;
  if (opts.noteTheme !== 'artwork') {
    laneColorsRef.current = opts.laneColors;
  }
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

  // Sync opts state with useVaultStore settings and options modal state changes
  const storeSettings = useVaultStore((state) => state.settings);
  const isOptionsModalOpen = useVaultStore((state) => state.isOptionsModalOpen);
  useEffect(() => {
    setOpts(loadOpts());
  }, [storeSettings, isOptionsModalOpen]);

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

  const lastSyncTimeRef = useRef(0);
  const syncDisplay = useCallback(() => {
    const now = performance.now();
    if (now - lastSyncTimeRef.current >= 33) {
      lastSyncTimeRef.current = now;
      setDisplayGs({ ...gsRef.current });
      setDisplayJudge([...jRef.current]);
    }
  }, []);
  // audioOffset (ms) compensates for speaker latency: subtract it so hits land in time
  // with what the player hears rather than what the audio clock reports.
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const introStartTimeRef = useRef<number | null>(null);

  // ── High-Precision Interpolated Audio Clock (Eliminates HTML5 Audio Buffer Jitter) ──
  const lastAudioCurrentTimeRef = useRef<number>(0);
  const lastAudioWallTimeRef = useRef<number>(0);
  const isAudioClockCalibratedRef = useRef<boolean>(false);

  const getT = useCallback(() => {
    if (phaseRef.current === "countdown" || phaseRef.current === "loading") {
      if (introStartTimeRef.current === null) {
        introStartTimeRef.current = performance.now();
      }
      return (performance.now() - introStartTimeRef.current) / 1000;
    }
    introStartTimeRef.current = null;

    const audio = audioRef.current;
    if (!audio) return 0;

    const rawT = audio.currentTime;
    const nowWall = performance.now();

    if (audio.paused || !isAudioClockCalibratedRef.current) {
      lastAudioCurrentTimeRef.current = rawT;
      lastAudioWallTimeRef.current = nowWall;
      isAudioClockCalibratedRef.current = !audio.paused;
      return rawT - audioOffsetRef.current / 1000;
    }

    // Check if audio element advanced its native buffer clock
    if (rawT !== lastAudioCurrentTimeRef.current) {
      lastAudioCurrentTimeRef.current = rawT;
      lastAudioWallTimeRef.current = nowWall;
      return rawT - audioOffsetRef.current / 1000;
    }

    // Interpolate high-precision fractional seconds between native audio buffer updates
    const elapsedSinceBuffer = (nowWall - lastAudioWallTimeRef.current) / 1000;
    // Bound interpolation to max 0.08s to prevent runaway if audio stalls
    const interpolatedT = lastAudioCurrentTimeRef.current + Math.min(0.08, Math.max(0, elapsedSinceBuffer));

    return interpolatedT - audioOffsetRef.current / 1000;
  }, []);

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
          const finalMultiplier = pw.multiplier + (pu.cycle || 0);
          const finalLabel = pw.type === "SIGNAL_LOCK" 
            ? "SIGNAL LOCK (SHIELD x2)" 
            : (pu.cycle > 0 ? `${pw.label} Lvl ${1 + pu.cycle}` : pw.label);

          Object.assign(pu, {
            active: pw.type,
            endTime: t + pw.duration,
            startTime: t,
            multiplier: finalMultiplier,
            color: pw.color,
            label: finalLabel,
            duration: pw.duration,
          });
          updatePuDisplayDOM({
            label: finalLabel,
            color: pw.color,
            multiplier: finalMultiplier,
            progress: 1,
          });
          const code = pw.type === "FEVER" ? 1 : pw.type === "SURGE" ? 2 : pw.type === "SIGNAL_LOCK" ? 3 : 0;
          gameSenseService.sendPowerup(code);
          if (pw.type === "SIGNAL_LOCK") {
            shieldChargesRef.current = 2;
            audioManager.playSfx("powerup_t1", 0.85);
            haptics.fusionSuccess();
          } else if (pw.threshold === 40) {
            audioManager.playSfx("powerup_t2", 0.85);
            haptics.heavyTap();
          } else if (pw.threshold === 60) {
            audioManager.playSfx("powerup_t3", 0.90);
            haptics.heavyTap();
          } else {
            audioManager.playSfx("powerup_t1", 0.80);
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
      if (hitFxRef.current.length > 12) {
        hitFxRef.current.shift();
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
      const diff = isExportVideoRef.current ? 0 : Math.abs(ns.note.time - t);
      const dl = songRef.current?.difficultyLevel ?? 5;
      if (diff > missWindow(dl)) return;

      // Swipe check: swipe notes, lift notes, or notes with required swipeDirection ignore plain tap-down inputs
      const reqSwipeDir = ns.note.swipeDirection || (ns.note.type === "lift" ? "up" : undefined);
      const isSwipeNote = ns.note.type === "swipe" || ns.note.type === "lift" || (reqSwipeDir !== undefined && ns.note.type !== "hold");
      if (isSwipeNote) {
        if (!direction) return; // Plain tap-down does not complete a swipe/lift note
        if (reqSwipeDir && !isDirectionMatch(reqSwipeDir, direction)) return;
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

      if (ns.note.type === "mine") {
        ns.hit = true;
        ns.missed = true;
        const gs = gsRef.current;
        gs.score = Math.max(0, gs.score - 500);
        gs.combo = 0;
        gs.misses++;
        audioManager.playSfx("mine_explosion", 0.85);
        haptics.heavyTap();
        addJudgment({ type: "MISS", lane, id: ++jCounter.current, ts: Date.now() });
        syncDisplay();
        return;
      }

      recordedTelemetryRef.current.push({
        noteId: ns.note.id,
        time: t,
        judgment: j,
        offset: t - ns.note.time,
        lane: lane,
        type: ns.note.type
      });

      // Dynamic Live Auto-Sync: Micro-adjust audio offset toward natural hit timing
      if (optsRef.current.autoLatencyAdjust && Math.abs(t - ns.note.time) < 0.12) {
        const offsetMs = (t - ns.note.time) * 1000;
        audioOffsetRef.current += offsetMs * 0.04;
        audioOffsetRef.current = Math.max(-200, Math.min(300, audioOffsetRef.current));
      }

      if (ns.note.type === "hold") {
        ns.holdActive = true;
        ns.currentLane = lane;
        ns.originLane = lane;
        ns.touchId = touchId;
      } else ns.hit = true;

      const gs = gsRef.current;
      gs.score += calcScore(gs.combo, j);

      if (ns.note.type === "remix") {
        const fxName = audioManager.triggerRemixStemEffect(ns.note.remixEffect || "vocals_isolate", 5.0);
        remixEffectNameRef.current = fxName.toUpperCase().replace('_', ' ');
        remixFlashUntilRef.current = Date.now() + 5000;
        gs.score += 1000;

        // ── ACTUAL STEM GAIN MODULATION via laneGainsRef crossover bands ──
        // Lane 0 = lowpass (bass), Lane 1 = bandpass (mids/vocals), Lane 2 = highpass (treble/leads)
        const ctx = audioCtxRef.current;
        if (ctx && laneGainsRef.current.length === 3) {
          const now = ctx.currentTime;
          const rampIn = 0.15; // smooth ramp-in seconds
          const stemDuration = 5.0;
          const stemGains: [number, number, number] = (() => {
            switch (fxName) {
              case 'vocals_isolate': return [0.08, 2.4, 0.08]; // solo mids
              case 'bass_boost':     return [2.8, 0.2, 0.15];  // solo bass
              case 'drums_mute':     return [0.05, 1.2, 1.2];  // cut bass (drums live in low-end)
              case 'lead_solo':      return [0.1, 0.15, 2.6];  // solo treble
              default:               return [1.0, 1.0, 1.0];
            }
          })();
          laneGainsRef.current.forEach((g, i) => {
            g.gain.cancelScheduledValues(now);
            g.gain.setValueAtTime(g.gain.value, now);
            g.gain.linearRampToValueAtTime(stemGains[i], now + rampIn);
            // Schedule restore back to normal after duration
            g.gain.setValueAtTime(stemGains[i], now + stemDuration - 0.3);
            g.gain.linearRampToValueAtTime(getTargetGainForLane(i), now + stemDuration);
          });
        }
      } else if (ns.note.type === "break") {
        audioManager.playSfx("diamond", 0.8);
        gs.score += 1200;
      } else if (ns.note.type === "accent") {
        gs.score += 800;
      }

      gs.combo++;
      gs.maxCombo = Math.max(gs.maxCombo, gs.combo);
      gameSenseService.sendHit();
      gameSenseService.sendCombo(gs.combo);
      if (j === "PERFECT+") {
        gs.perfectPlus++;
        audioManager.playSfx("tap_perfect", 0.35);
      }
      else if (j === "PERFECT") {
        gs.perfects++;
        audioManager.playSfx("tap_perfect", 0.25);
      }
      else {
        gs.goods++;
        audioManager.playSfx("tap_nav", 0.15);
      }
      if (ns.note.type === "swipe" || ns.note.swipeDirection) {
        audioManager.playSfx("swipe", 0.45);
        haptics.doubleTap();
      } else {
        if (j === "PERFECT+") {
          haptics.mediumTap();
        } else {
          haptics.lightTap();
        }
      }
      checkPowerUps(gs.combo);

      addJudgment({ type: j, lane, id: ++jCounter.current, ts: Date.now() });

      // ── Hit explosion effect ──
      triggerHitFx(lane, j, undefined, direction || ns.note.swipeDirection);

      syncDisplay();
    },
    [getT, calcScore, checkPowerUps, syncDisplay, restoreLane, triggerHitFx, addJudgment],
  );

  const completeHoldNote = useCallback(
    (ns: NoteState) => {
      if (ns.hit) return;
      const isSurge = puRef.current.active === "SURGE" && getT() < puRef.current.endTime;
      if (isSurge || ns.autoplayedBySurge) return;

      // If it requires a swipe-release, releasing it without swiping is a miss!
      if (ns.note.swipeDirection) {
        ns.holdActive = false;
        ns.missed = true;
        recordedTelemetryRef.current.push({
          noteId: ns.note.id,
          time: getT(),
          judgment: "MISS",
          offset: 0,
          lane: ns.note.lane,
          type: "hold"
        });
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

        addJudgment({ type: "MISS", lane: ns.note.lane, id: ++jCounter.current, ts: Date.now() });
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
          recordedTelemetryRef.current.push({
            noteId: ns.note.id,
            time: getT(),
            judgment: "SHIELDED",
            offset: 0,
            lane: ns.currentLane,
            type: "hold"
          });
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
          recordedTelemetryRef.current.push({
            noteId: ns.note.id,
            time: getT(),
            judgment: "MISS",
            offset: 0,
            lane: ns.note.lane,
            type: "hold"
          });
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
        recordedTelemetryRef.current.push({
          noteId: ns.note.id,
          time: getT(),
          judgment: "MISS",
          offset: 0,
          lane: ns.note.lane,
          type: "hold"
        });
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
      const diff = isExportVideoRef.current ? 0 : Math.abs((ns.note.time + (ns.note.holdDuration || 0.5)) - t);

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
      if (ns.note.targetLane !== undefined && !ns.hit) {
        const reachedTarget = toLane === ns.note.targetLane && ns.currentLane !== ns.note.targetLane;
        ns.currentLane = toLane;

        if (reachedTarget) {
          ns.hit = true;
          ns.holdActive = false;
          ns.holdProgress = 1.0;
          audioManager.playSfx("hidden_secret_found", 0.35);

          const gs = gsRef.current;
          gs.score += calcScore(gs.combo, "PERFECT+");
          gs.combo++;
          gs.maxCombo = Math.max(gs.maxCombo, gs.combo);
          gameSenseService.sendHit();
          gameSenseService.sendCombo(gs.combo);
          gs.perfectPlus++;
          checkPowerUps(gs.combo);
          haptics.mediumTap();

          // ── Slide success particle effect ──
          const canvas = canvasRef.current;
          if (canvas) {
            const dpr = window.devicePixelRatio || 1;
            const W = canvas.width / dpr;
            const H = canvas.height / dpr;
            const hitY = H * HIT_RATIO;
            const { x: lx, w: lw } = laneAt(toLane, 1, W);
            const cx = lx + lw / 2;
            const lc = getDifficultyLaneColor(laneColorsRef.current[toLane], songRef.current?.difficultyLevel ?? 5, toLane);
            const particles: HitParticle[] = [];
            for (let i = 0; i < 8; i++) {
              const angle = (Math.random() - 0.5) * Math.PI;
              const speed = 40 + Math.random() * 60;
              particles.push({
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 20,
                size: 2.5 + Math.random() * 3.5,
              });
            }
            hitFxRef.current.push({
              lane: toLane,
              startMs: Date.now(),
              cx,
              cy: hitY,
              color: lc,
              kind: "PERFECT+",
              particles,
            });
          }

          jRef.current = [
            ...jRef.current.filter((x) => Date.now() - x.ts < 600),
            { type: "PERFECT+", lane: toLane, id: ++jCounter.current, ts: Date.now() },
          ];
          syncDisplay();
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

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }

    if (optsRef.current.autoLatencyAdjust) {
      const autoOffsetMs = Math.round(audioOffsetRef.current);
      localStorage.setItem("opt_audioOffset", String(autoOffsetMs));
    }

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
        const totalNotes = gs.perfectPlus + gs.perfects + gs.goods + gs.misses;
        const accuracy = totalNotes > 0 ? ((gs.perfectPlus + gs.perfects) / totalNotes) * 100 : 0;
        const rewardOpts = loadOpts();
        const isRewardEligible = rewardOpts.noteGenerationSource === 'auto' || !rewardOpts.noteGenerationSource;
        if (isRewardEligible) {
          saveHighScore(
            songRef.current.id,
            gs.score,
            parseFloat(accuracy.toFixed(2)),
            gs.maxCombo,
            medal,
            { events: recordedTelemetryRef.current }
          );
        } else {
          console.log(`[GamePlay] Score not saved — playing in ${rewardOpts.noteGenerationSource} mode (practice)`);
          // Save locally for personal tracking only
          try {
            localStorage.setItem(`practice_score_${songRef.current.id}_${rewardOpts.noteGenerationSource}`, JSON.stringify({ score: gs.score, accuracy: parseFloat(accuracy.toFixed(2)), maxCombo: gs.maxCombo, medal }));
          } catch (e) { /* ignore storage errors */ }
        }
        saveMedal(songRef.current.id, medal);
        saveScoreHistory(songRef.current.id, gs.score);
      }

      // ── Aggregate per-lane accuracy from real telemetry ──
      const laneTelemetry: Record<number, { hits: number; perfectPlus: number; perfects: number; goods: number; misses: number }> = {};
      for (let li = 0; li < 3; li++) {
        laneTelemetry[li] = { hits: 0, perfectPlus: 0, perfects: 0, goods: 0, misses: 0 };
      }
      for (const ev of recordedTelemetryRef.current) {
        const lt = laneTelemetry[ev.lane];
        if (!lt) continue;
        lt.hits++;
        if (ev.judgment === 'PERFECT+') lt.perfectPlus++;
        else if (ev.judgment === 'PERFECT') lt.perfects++;
        else if (ev.judgment === 'GOOD') lt.goods++;
        else lt.misses++;
      }
      // Count misses per lane from notes that were missed (not in telemetry)
      for (const ns of notesRef.current) {
        if (ns.missed && !ns.hit && ns.note.type !== 'mine' && ns.note.type !== 'ghost') {
          const lt = laneTelemetry[ns.note.lane];
          if (lt) { lt.misses++; lt.hits++; }
        }
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
          laneTelemetry,
        }),
      );
    } catch (err) {
      console.error("Failed to save game results:", err);
    }

    // Only navigate to results if not exporting video (or user closes export modal)
    if (!isExportVideoRef.current) {
      finishGameTimeoutRef.current = setTimeout(() => {
        if (phaseRef.current === "unmounted") return;
        if (isTutorial) {
          setLocation(`/tutorial?phase=results&score=${gs.score}`);
        } else {
          setLocation(`/results/${songId}`);
        }
      }, 300);
    }
  }, [songId, setLocation, isTutorial]);

  const doAbandon = useCallback(() => {
    if (phaseRef.current === "finished") return;
    audioManager.stopSfx("gameover_countdown");
    if (phaseRef.current === "continue") {
      finishGame(false);
      return;
    }
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
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }

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

      // Reset ghost playback index on rewind
      if (ghostTelemetryRef.current) {
        const ghostEvents = ghostTelemetryRef.current;
        let newIdx = 0;
        while (newIdx < ghostEvents.length && ghostEvents[newIdx].time < rewindTo) {
          newIdx++;
        }
        ghostIndexRef.current = newIdx;
        ghostJudgmentsRef.current = [];
      }

      // Re-calibrate timebases and smoothed audio clock on resume from continue
      const nowWall = performance.now();
      lastFrameTimeRef.current = nowWall;
      lastAudioCurrentTimeRef.current = rewindTo;
      lastAudioWallTimeRef.current = nowWall;
      isAudioClockCalibratedRef.current = false;

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
        audioManager.stopSfx("gameover_countdown");
        finishGame(false);
      }
    }, 1000);
    return () => {
      clearInterval(id);
      audioManager.stopSfx("gameover_countdown");
    };
  }, [phase, finishGame]);

  // ═══════════════════════════════════════════════════════════════
  //  DRAW LOOP
  // ═══════════════════════════════════════════════════════════════
  const draw = useCallback(() => {
    if (phaseRef.current === "unmounted") {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      return;
    }

    const canvas = canvasRef.current;
    const phase = phaseRef.current;
    if (!canvas || (phase !== "playing" && phase !== "rewinding" && phase !== "countdown") || pausedRef.current || isTutorialHelpOpenRef.current) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      return;
    }

    // Schedule next frame ONLY if loop is actively running
    rafRef.current = requestAnimationFrame(() => drawRef.current?.());
    const ctx = canvas.getContext("2d");
    if (!ctx || !songRef.current) return;
    if (optsRef.current.legacyGraphics) {
      ctx.shadowBlur = 0;
      Object.defineProperty(ctx, 'shadowBlur', {
        set: () => {},
        get: () => 0,
        configurable: true
      });
    }
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

    // Frame-Perfect Perfect Solver Bot execution & Frame Counter
    if (isExportVideoRef.current && phaseRef.current === "playing") {
      frameCounterRef.current++;
      setFrameCount(frameCounterRef.current);
      if (songRef.current && songRef.current.duration > 0 && !isNaN(songRef.current.duration)) {
        const prog = Math.min(100, Math.max(0, (t / songRef.current.duration) * 100));
        setRecordingProgress(isNaN(prog) ? 0 : prog);
      }
      notesRef.current.forEach((ns) => {
        if (ns.note.type === "mine") return; // Skip hazard mines
        if (!ns.hit && !ns.missed) {
          if (ns.note.type === "hold") {
            if (t >= ns.note.time && !ns.holdActive) {
              hitLane(ns.note.lane, ns.note.swipeDirection);
            }
            if (ns.holdActive) {
              const holdDur = ns.note.holdDuration || 0.5;
              ns.holdProgress = Math.min(1, Math.max(0, (t - ns.note.time) / holdDur));
              if (ns.note.targetLane !== undefined) {
                ns.currentLane = lerp(ns.note.lane, ns.note.targetLane, ns.holdProgress);
              }
              if (t >= ns.note.time + holdDur) {
                if (ns.note.swipeDirection) {
                  hitSwipeRelease(ns, ns.note.swipeDirection);
                } else {
                  if (ns.note.targetLane !== undefined) {
                    ns.currentLane = ns.note.targetLane;
                  }
                  completeHoldNote(ns);
                }
              }
            }
          } else if (t >= ns.note.time) {
            hitLane(ns.note.lane, ns.note.swipeDirection);
          }
        }
      });
    }

    // Update ghost competitor keys and timeline events
    if (ghostTelemetryRef.current) {
      const ghostEvents = ghostTelemetryRef.current;
      const ghostPressed = [false, false, false];
      ghostEvents.forEach(event => {
        if (event.type === 'hold' && event.judgment !== 'MISS') {
          const holdDur = event.holdDuration || 0.5;
          if (t >= event.time && t <= event.time + holdDur) {
            ghostPressed[event.lane] = true;
          }
        } else if (event.judgment !== 'MISS') {
          if (t >= event.time && t <= event.time + 0.08) {
            ghostPressed[event.lane] = true;
          }
        }
      });
      ghostActiveKeysRef.current = ghostPressed;

      // Update ghost index pointer and trigger floating judgments
      while (ghostIndexRef.current < ghostEvents.length) {
        const event = ghostEvents[ghostIndexRef.current];
        if (t >= event.time) {
          ghostIndexRef.current++;
          ghostJudgmentsRef.current.push({
            id: ++ghostJCounter.current,
            type: event.judgment,
            lane: event.lane,
            ts: Date.now()
          });
          if (ghostJudgmentsRef.current.length > 10) {
            ghostJudgmentsRef.current.shift();
          }
        } else {
          break;
        }
      }
    }

    // Stage transition tracking
    const stageBounds = [
      { stage: 1, name: "Stage 1",      pct: 0.00, difficulty: "EASY"   },
      { stage: 2, name: "Stage 2",      pct: 0.15, difficulty: "MEDIUM" },
      { stage: 3, name: "Stage 3",      pct: 0.35, difficulty: "HARD"   },
      { stage: 4, name: "Stage 4",      pct: 0.60, difficulty: "BRUTAL" },
      { stage: 5, name: "FINAL STAGE",  pct: 0.80, difficulty: "BRUTAL" }
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

        // Stage-Integrated Dynamic POV Camera Auto-Switching (Skipped if POV Lock is active)
        if (!isPovLockedRef.current && optsRef.current.stagePovSwitch !== false && phaseRef.current === "playing" && prevStage > 0 && calculatedStage > prevStage) {
          let targetPov: 'classic' | 'cyber_tunnel' | 'dynamic_stage' = 'classic';
          if (calculatedStage === 3) targetPov = 'cyber_tunnel';
          else if (calculatedStage === 4) targetPov = 'dynamic_stage';
          else if (calculatedStage === 5) targetPov = 'cyber_tunnel';
          else targetPov = 'classic';

          if (targetPov !== activePovModeRef.current) {
            if (targetPov === 'cyber_tunnel') {
              audioManager.playSfx('tunnel_transition', 0.85);
            }
            povTransitionRef.current = {
              startTime: Date.now(),
              duration: 700,
              fromMode: activePovModeRef.current,
              toMode: targetPov,
              warpAlpha: 1.0,
            };
            setActivePovMode(targetPov);
            activePovModeRef.current = targetPov;
            offscreenCanvasRef.current = null; // Reset offscreen track canvas to regenerate geometry for target POV!
          }
        }

      // If player cleared the stage and triggered all power-ups, reset thresholds for the next level cycle
      if (prevStage > 0 && calculatedStage > prevStage) {
        const allPowerupsUsed = pu.triggered.has(20) && pu.triggered.has(40) && pu.triggered.has(60);
        if (allPowerupsUsed) {
          pu.cycle = (pu.cycle || 0) + 1;
          pu.triggered.clear();
          console.log(`[Powerup Sync] Stage clear detected. Incrementing powerup level cycle to ${pu.cycle}`);
        }
      }
      
      const sb = stageBounds.find(s => s.stage === calculatedStage);
      if (sb && prevStage > 0 && calculatedStage > prevStage) {
        if (calculatedStage === 5) {
          audioManager.playSfx("overdrive_activate", 0.85);
        } else {
          audioManager.playSfx("inbetween", 0.80);
        }
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

    // Track combo changes for tunnel POV flash effect
    if (gs.combo > tunnelComboFlashRef.current.lastCombo && gs.combo > 0) {
      tunnelComboFlashRef.current.flashStartMs = performance.now();
    }
    tunnelComboFlashRef.current.lastCombo = gs.combo;

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
    // Canvas is transparent — CSS background system shows through beneath the silver track
    ctx.clearRect(0, 0, W, H);

    if (isExportVideoRef.current) {
      if (coverImgRef.current && coverImgRef.current.complete && coverImgRef.current.naturalWidth > 0) {
        ctx.drawImage(coverImgRef.current, 0, 0, W, H);
      } else {
        ctx.fillStyle = "#050402";
        ctx.fillRect(0, 0, W, H);
      }
      const bgGrad = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.85);
      bgGrad.addColorStop(0, "rgba(5, 4, 2, 0.65)");
      bgGrad.addColorStop(0.8, "rgba(5, 4, 2, 0.92)");
      bgGrad.addColorStop(1, "rgba(5, 4, 2, 0.98)");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);
    }

    // Draw pre-rendered static tracks (Double-buffering optimization)
    if (!offscreenCanvasRef.current && W > 0 && H > 0) {
      const diffLevel = songRef.current?.difficultyLevel ?? 5;
      offscreenCanvasRef.current = prerenderStaticTrack(
        W,
        H,
        dpr,
        diffLevel,
        laneColorsRef.current,
        optsRef.current.gameTrack,
        activePovModeRef.current,
        calculatedStage
      );
    }
    const isExperimentalArchetype = (calculatedStage === 3 || calculatedStage === 5) && activeArchetypeRef.current !== 'cyber_tunnel';
    if (offscreenCanvasRef.current && !isExperimentalArchetype) {
      ctx.drawImage(offscreenCanvasRef.current, 0, 0, W, H);
    }

    // ── Dynamic Lane Hit Glows Sweep (Subtle Ambient Illumination) ──
    const nowGlowMs = Date.now();
    for (let i = 0; i < LANE_COUNT; i++) {
      const latest = lastLaneHitRef.current[i];
      if (latest && nowGlowMs - latest.ts < 500) {
        const age = (nowGlowMs - latest.ts) / 500;
        const opacity = (1 - age); // smooth decay factor (0 to 1)
        
        let baseColor = "#39FF14"; // Perfect+ emerald green
        if (latest.type === "PERFECT") {
          baseColor = "#FFD700"; // Perfect gold/yellow
        } else if (latest.type === "GOOD") {
          baseColor = "#00E5FF"; // Good blue
        } else if (latest.type === "MISS") {
          baseColor = "#FF1493"; // Miss magenta
        }

        const { x: lx0, w: lw0 } = laneAt(i, 0, W);
        const { x: lx1, w: lw1 } = laneAt(i, 1, W);

        ctx.save();
        const glowGrad = ctx.createLinearGradient(0, 0, 0, hitY);
        glowGrad.addColorStop(0, "transparent");
        glowGrad.addColorStop(0.4, colorWithAlpha(baseColor, 0.03 * opacity));
        glowGrad.addColorStop(0.85, colorWithAlpha(baseColor, 0.22 * opacity));
        glowGrad.addColorStop(1, colorWithAlpha(baseColor, 0.12 * opacity));

        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.moveTo(lx0, 0);
        ctx.lineTo(lx0 + lw0, 0);
        ctx.lineTo(lx1 + lw1, hitY);
        ctx.lineTo(lx1, hitY);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    // Draw Slideshow Cutouts on the track if selected in gameTrack options
    if (optsRef.current.gameTrack === 'slideshow' && slideshowSlidesRef.current.length > 0 && !optsRef.current.legacyGraphics) {
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

      const cx = W / 2;
      const cy = hitY * 0.5;

      const SLIDE_DURATION = 7.0; // 7 seconds per slide
      const TRANSITION_DURATION = 1.2; // 1.2 second cross-fade

      const slides = slideshowSlidesRef.current;
      const curSlideIdx = Math.floor(t / SLIDE_DURATION) % slides.length;
      const slideTime = t % SLIDE_DURATION;

      // Helper function to draw a slide with Ken Burns effect
      const drawSlide = (slide: any, alpha: number) => {
        ctx.save();
        ctx.globalAlpha = alpha;

        const scaleX = (W * 0.6) / slide.width;
        const scaleY = hitY / slide.height;
        const baseScale = Math.max(scaleX, scaleY) * 1.15;

        // Slow orbital pan and zoom
        const panX = Math.sin(t * 0.35) * (slide.width * baseScale * 0.08);
        const panY = Math.cos(t * 0.28) * (slide.height * baseScale * 0.08);
        const zoom = baseScale * (1.0 + Math.sin(t * 0.22) * 0.05);

        ctx.translate(cx + panX, cy + panY);
        ctx.scale(zoom, zoom);

        // Subtle glow to stand out under the notes
        ctx.shadowBlur = 15;
        ctx.shadowColor = slide.glowColor;

        ctx.drawImage(slide.canvas, -slide.width / 2, -slide.height / 2, slide.width, slide.height);
        ctx.restore();
      };

      if (slideTime > SLIDE_DURATION - TRANSITION_DURATION) {
        // We are transitioning: cross-fade current and next slide
        const nextSlideIdx = (curSlideIdx + 1) % slides.length;
        const fadeProgress = (slideTime - (SLIDE_DURATION - TRANSITION_DURATION)) / TRANSITION_DURATION;

        drawSlide(slides[curSlideIdx], 1 - fadeProgress);
        drawSlide(slides[nextSlideIdx], fadeProgress);
      } else {
        // Just draw the current slide
        drawSlide(slides[curSlideIdx], 1.0);
      }

      ctx.restore();
    }

    // Draw Sacred Visualizer on the track if selected in gameTrack options
    if (optsRef.current.gameTrack === 'sacred_visualizer' && !optsRef.current.legacyGraphics) {
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
      ctx.shadowBlur = 12 + midN * 18;

      // Opacity level: vibrant spiritual geometry overlay beneath the notes
      const opacityVal = 0.38 + highN * 0.25;

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
      ctx.fill();
    }
    ctx.restore();

    // Draw Cyber Matrix or Hyperdrive Synthwave dynamic track pulse effects
    if (optsRef.current.gameTrack === 'cyber_matrix' && !optsRef.current.legacyGraphics) {
      ctx.save();
      const hwTopMat = hwAtProgress(0, W);
      const hwBotMat = hwAtProgress(1, W);
      ctx.beginPath();
      ctx.moveTo(hwTopMat.left, 0);
      ctx.quadraticCurveTo(W/2, -hitY * 0.09, hwTopMat.right, 0);
      ctx.lineTo(hwBotMat.right, hitY);
      ctx.lineTo(hwBotMat.left, hitY);
      ctx.closePath();
      ctx.clip();

      // Matrix Rain code drops along each lane
      const matrixChars = "0123456789ABCDEF⚡PIMVAULT";
      ctx.font = "bold 9px monospace";
      ctx.fillStyle = "rgba(57, 255, 20, 0.45)";
      for (let l = 0; l < LANE_COUNT; l++) {
        const dropSpeed = (l + 1) * 0.18;
        const progress = ((t * dropSpeed) % 1);
        const { x, w } = laneAt(l, progress, W);
        const charY = progress * hitY;
        const char = matrixChars[Math.floor((t * 20 + l * 7) % matrixChars.length)];
        ctx.fillText(char, x + w / 2 - 4, charY);
      }
      ctx.restore();
    } else if (optsRef.current.gameTrack === 'neon_hyperdrive' && !optsRef.current.legacyGraphics) {
      ctx.save();
      const hwTopHyp = hwAtProgress(0, W);
      const hwBotHyp = hwAtProgress(1, W);
      ctx.beginPath();
      ctx.moveTo(hwTopHyp.left, 0);
      ctx.quadraticCurveTo(W/2, -hitY * 0.09, hwTopHyp.right, 0);
      ctx.lineTo(hwBotHyp.right, hitY);
      ctx.lineTo(hwBotHyp.left, hitY);
      ctx.closePath();
      ctx.clip();

      // Hyperdrive synthwave speed pulse beams
      const beamProgress = (t * 0.8) % 1;
      const beamY = beamProgress * hitY;
      const { left, right } = hwAtProgress(beamProgress, W);
      const beamGrad = ctx.createLinearGradient(0, Math.max(0, beamY - 15), 0, Math.min(hitY, beamY + 15));
      beamGrad.addColorStop(0, "rgba(0, 229, 255, 0.0)");
      beamGrad.addColorStop(0.5, "rgba(0, 229, 255, 0.45)");
      beamGrad.addColorStop(1, "rgba(255, 20, 147, 0.0)");
      ctx.fillStyle = beamGrad;
      ctx.fillRect(left, Math.max(0, beamY - 15), right - left, 30);
      ctx.restore();
    }

    // ── 3D CYBER TUNNEL ENVIRONMENT & CIRCULAR STRIKE ZONES ──
    const curPovMode = activePovModeRef.current;
    const isCyberTunnelPov = curPovMode === 'cyber_tunnel';
    const isDynamicStagePov = curPovMode === 'dynamic_stage';

    if (isCyberTunnelPov || (isDynamicStagePov && calculatedStage >= 3)) {
      ctx.save();
      const cx = W / 2;
      const vanishingY = hitY * 0.28; // 3D Tunnel vanishing horizon point
      const bpmVal = songRef.current?.bpm || 120;
      
      // Stage Warp Speed & Tunnel Opacity Rules:
      // - Stage 4: Tunnel environment completely disappears (dark hyperspace void plunge!)
      // - Stage 5: Tunnel returns TWICE AS FAST (swirlSpeed * 2.0) with hyperdrive pulse!
      let tunnelOpacity = 1.0;
      let swirlSpeedMult = 1.0;
      
      const archMeta = ARCHETYPE_METAS[activeArchetypeRef.current] || ARCHETYPE_METAS['cyber_tunnel'];
      // Dynamically resolve Stage 4 Primer Color and Stage 5 Overdrive Color directly from album cover art!
      const primerColor = laneColorsRef.current?.[0] || archMeta.primerColor || '#00E5FF';
      const stage5Color = laneColorsRef.current?.[2] || laneColorsRef.current?.[1] || archMeta.stage5Color || '#FF007F';

      if (calculatedStage === 4) {
        tunnelOpacity = 0.0; // Stage 4: Dynamic Color Primer Void & Story Bridge
        ctx.save();
        
        // Moving gas-like primer haze centered around the Stage 4 track (using dynamic cover color #1)
        const trackHazeR = Math.min(W, 820) * 0.55;
        drawMovingGasAura(ctx, cx, hitY * 0.5, trackHazeR, primerColor, t, 0.85);

        // Story Bridge Pulsing Laser Grid Lines (clipped to track bounds and side drop shadows)
        ctx.strokeStyle = colorWithAlpha(primerColor, 0.35 + Math.pow(Math.sin(((t * (bpmVal / 60)) % 1) * Math.PI), 3) * 0.25);
        ctx.lineWidth = 1.5;
        const gridLines = 8;
        for (let g = 0; g < gridLines; g++) {
          const gY = lerp(vanishingY, H, (g / gridLines + (t * 0.4) % (1 / gridLines)));
          const { left, right } = hwAtProgress(g / gridLines, W);
          const shadowMargin = Math.min(18, (right - left) * 0.06);
          ctx.beginPath();
          ctx.moveTo(left - shadowMargin, gY);
          ctx.lineTo(right + shadowMargin, gY);
          ctx.stroke();
        }
        ctx.restore();
      } else if (calculatedStage === 5) {
        tunnelOpacity = 1.0; // Stage 5: Souped-Up Archetype Overdrive
        swirlSpeedMult = 2.4; // Hyperdrive speed!
      } else if (calculatedStage === 3) {
        swirlSpeedMult = 1.3;
      }

      const beatPulseVal = Math.pow(Math.sin(((t * (bpmVal / 60) * swirlSpeedMult) % 1) * Math.PI), 3);
      const swirlAngle = t * 0.9 * swirlSpeedMult; // Continuous rotational vortex swirl
      const isOverdrive = calculatedStage === 5 && swirlSpeedMult >= 2.0;

      if (tunnelOpacity > 0) {
        const currentArch = activeArchetypeRef.current;

        // ── ARCHETYPE 1: HORIZONTAL SIDE-SCROLLER (90° Canvas) ──
        if (currentArch === 'horizontal_drift') {
          // Dynamic Moving Gas Nebula Backdrop around Side-Scroller Track
          const sideMaxW = Math.min(W, 860);
          drawMovingGasAura(ctx, W / 2, H / 2, sideMaxW * 0.60, "#16052b", t, 0.95);

          // Wireframe Synthwave Sun at Left Horizon (X = -20, Y = H * 0.52)
          ctx.save();
          const sunX = -20;
          const sunY = H * 0.52;
          const sunR = Math.min(W, H) * 0.28;
          const sunGrad = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
          sunGrad.addColorStop(0, "#FFE600");
          sunGrad.addColorStop(0.5, "#FF2A85");
          sunGrad.addColorStop(1, "#7A00FF");
          ctx.fillStyle = sunGrad;
          ctx.shadowColor = "#FF2A85";
          ctx.shadowBlur = 35;
          ctx.beginPath();
          ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
          ctx.fill();

          // Sun Horizon Scanlines
          ctx.strokeStyle = "rgba(12, 3, 28, 0.85)";
          ctx.lineWidth = 3;
          for (let sY = sunY - sunR * 0.5; sY < sunY + sunR; sY += 9) {
            ctx.beginPath();
            ctx.moveTo(sunX - sunR, sY);
            ctx.lineTo(sunX + sunR, sY);
            ctx.stroke();
          }
          ctx.restore();

          // 3 Horizontal Lane Highway Ribbons: Lane 2 (Top/D) -> Lane 1 (Mid/S) -> Lane 0 (Bot/A)
          const strikeX = W * 0.82;
          const laneYMap = [H * 0.68, H * 0.52, H * 0.36];

          laneYMap.forEach((lY, lIdx) => {
            const laneCol = laneColorsRef.current[lIdx] || '#00E5FF';
            // Sleek Horizontal Lane Ribbon Body
            const laneGrad = ctx.createLinearGradient(0, lY, strikeX, lY);
            laneGrad.addColorStop(0, "rgba(5, 2, 18, 0.4)");
            laneGrad.addColorStop(0.5, colorWithAlpha(laneCol, 0.28));
            laneGrad.addColorStop(1, colorWithAlpha(laneCol, 0.65));
            ctx.fillStyle = laneGrad;
            ctx.fillRect(0, lY - 25, strikeX, 50);

            // Glowing Edge Laser Guardrails
            ctx.strokeStyle = colorWithAlpha(laneCol, 0.85);
            ctx.lineWidth = 2.5;
            ctx.shadowColor = laneCol;
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.moveTo(0, lY - 25);
            ctx.lineTo(strikeX, lY - 25);
            ctx.moveTo(0, lY + 25);
            ctx.lineTo(strikeX, lY + 25);
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Animated Rightward Speed Arrow Chevrons along Lane Floor
            ctx.fillStyle = colorWithAlpha(laneCol, 0.35);
            const chevSpacing = 80;
            const chevOffset = (t * 220) % chevSpacing;
            for (let cx = chevOffset; cx < strikeX; cx += chevSpacing) {
              ctx.beginPath();
              ctx.moveTo(cx, lY - 12);
              ctx.lineTo(cx + 16, lY);
              ctx.lineTo(cx, lY + 12);
              ctx.lineTo(cx - 8, lY);
              ctx.closePath();
              ctx.fill();
            }
          });

          // Vertical Pulsing Target Laser Strike Bar
          ctx.save();
          ctx.strokeStyle = "#FFFFFF";
          ctx.lineWidth = 4.5;
          ctx.shadowColor = "#00E5FF";
          ctx.shadowBlur = 28;
          ctx.beginPath();
          ctx.moveTo(strikeX, H * 0.24);
          ctx.lineTo(strikeX, H * 0.80);
          ctx.stroke();

          // Laser Strike Bar Glow Halo
          ctx.strokeStyle = "rgba(0, 229, 255, 0.45)";
          ctx.lineWidth = 12;
          ctx.stroke();
          ctx.restore();

          // Vertical Grid Markers
          ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
          ctx.lineWidth = 1.5;
          const gridSpacing = 45;
          for (let gx = -(t * 140) % gridSpacing; gx < strikeX; gx += gridSpacing) {
            if (gx < 0) continue;
            ctx.beginPath();
            ctx.moveTo(gx, H * 0.28);
            ctx.lineTo(gx, H * 0.76);
            ctx.stroke();
          }
        }

        // ── ARCHETYPE 2: 360° RADIAL CYBER ORBIT ──
        else if (currentArch === 'radial_orbit') {
          const orbitCx = W / 2;
          const orbitCy = H * 0.48; // Centered vertically in playfield
          const radarRot = t * 0.65; // Continuous 360° radar rotation

          // Dynamic Moving Cosmic Gas Backdrop around Radial Orbit
          const orbitR = Math.min(W, H) * 0.65;
          drawMovingGasAura(ctx, orbitCx, orbitCy, orbitR, "#0a1432", t, 0.95);

          // Concentric Glowing Orbit Rings (1.5x Scale)
          const rOuter = Math.min(W, H) * 0.55; // Outer 1.5x spawn rim
          const rHit = Math.min(W, H) * 0.26; // Target hit button pad ring
          const rMin = Math.min(W, H) * 0.10;
          const ringRadii = [rMin, rHit, rHit + (rOuter - rHit) * 0.5, rOuter];

          ringRadii.forEach((r, idx) => {
            const laneCol = laneColorsRef.current[idx % 3] || '#00E5FF';
            ctx.strokeStyle = colorWithAlpha(laneCol, 0.4 + beatPulseVal * 0.25);
            ctx.lineWidth = 2.0;
            ctx.beginPath();
            ctx.arc(orbitCx, orbitCy, r, 0, Math.PI * 2);
            ctx.stroke();
          });

          // 3 Rotating Radial Spoke Beams & Precision Target Hit Zones
          const baseAngles = [(210 * Math.PI) / 180, (270 * Math.PI) / 180, (330 * Math.PI) / 180];
          baseAngles.forEach((baseAng, idx) => {
            const ang = baseAng + radarRot;
            const laneCol = laneColorsRef.current[idx] || '#00E5FF';
            
            // Rotating Spoke Beam from Center Hub outward to Outer Rim
            ctx.strokeStyle = colorWithAlpha(laneCol, 0.65);
            ctx.lineWidth = 2.8;
            ctx.beginPath();
            ctx.moveTo(orbitCx + Math.cos(ang) * (rMin * 0.6), orbitCy + Math.sin(ang) * (rMin * 0.6));
            ctx.lineTo(orbitCx + Math.cos(ang) * (rOuter * 1.1), orbitCy + Math.sin(ang) * (rOuter * 1.1));
            ctx.stroke();

            // Precise 1.5x Dual-Ring Target Hit Zone at rHit
            const bx = orbitCx + Math.cos(ang) * rHit;
            const by = orbitCy + Math.sin(ang) * rHit;
            
            ctx.save();
            // Outer Neon Halo Ring
            ctx.strokeStyle = laneCol;
            ctx.lineWidth = 4.0;
            ctx.shadowColor = laneCol;
            ctx.shadowBlur = 22;
            ctx.beginPath();
            ctx.arc(bx, by, 26, 0, Math.PI * 2);
            ctx.stroke();

            // Inner Precision Crosshair Circle
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 2.0;
            ctx.beginPath();
            ctx.arc(bx, by, 17, 0, Math.PI * 2);
            ctx.stroke();

            // Crosshair Ticks (+)
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(bx - 7, by); ctx.lineTo(bx + 7, by);
            ctx.moveTo(bx, by - 7); ctx.lineTo(bx, by + 7);
            ctx.stroke();

            // Key Label Badge (A / S / D)
            const keyLabel = idx === 0 ? 'A' : idx === 1 ? 'S' : 'D';
            ctx.fillStyle = '#FFFFFF';
            ctx.font = '900 13px "Space Mono", monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(keyLabel, bx, by);
            ctx.restore();
          });

          // 360° Rotating Radar Sweep Scanner Beam
          ctx.save();
          ctx.translate(orbitCx, orbitCy);
          const sweepAngle = t * 1.8 + radarRot;
          const sweepGrad = ctx.createConicGradient(sweepAngle, 0, 0);
          sweepGrad.addColorStop(0, "rgba(0, 229, 255, 0.25)");
          sweepGrad.addColorStop(0.12, "rgba(0, 229, 255, 0.0)");
          sweepGrad.addColorStop(1, "rgba(0, 0, 0, 0.0)");
          ctx.fillStyle = sweepGrad;
          ctx.beginPath();
          ctx.arc(0, 0, rHit * 1.15, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // ── ARCHETYPE 3: 3D TWISTING CORKSCREW SLIDE (Tighter Helical Tube + Extended 52% Runway) ──
        else if (currentArch === 'corkscrew_slide') {
          const corkW = Math.min(W, 840);
          const outerRadius = corkW * 0.55;
          const vanishingY = hitY * 0.18;
          const baseH = hitY - vanishingY;

          // Dynamic Moving Gas Nebula Backdrop around 3D Corkscrew Tube
          drawMovingGasAura(ctx, cx, vanishingY + baseH * 0.35, outerRadius, "#1c0830", t, 1.0);

          ctx.save();
          const mult = calculatedStage === 5 ? 1.6 : 1.0;

          // 1. Glowing Entry Mouth Ring (Top entrance at p = 0.12)
          const entryAngle = t * 1.6 * mult;
          const entryRadiusX = corkW * 0.05;
          const entryRadiusY = H * 0.02;
          const entryY = vanishingY + baseH * 0.10;

          ctx.strokeStyle = "rgba(255, 123, 0, 0.85)";
          ctx.lineWidth = 3.5;
          ctx.shadowColor = "#FF7B00";
          ctx.shadowBlur = 16;
          ctx.beginPath();
          ctx.ellipse(cx, entryY, entryRadiusX, entryRadiusY, 0, 0, Math.PI * 2);
          ctx.stroke();

          // 2. Tight 3D Helical Corkscrew Guide Rails (p: 0.12 -> 0.48)
          const helixSteps = 60;
          for (let rail = 0; rail < 3; rail++) {
            const laneOff = (rail - 1) * 16;
            const railColor = laneColorsRef.current[rail] || '#FF7B00';

            ctx.beginPath();
            for (let step = 0; step <= helixSteps; step++) {
              const u = step / helixSteps;
              const loopAngle = u * Math.PI * 4 + t * 1.6 * mult; // 2 complete loops
              const helixRadiusX = lerp(corkW * 0.05, corkW * 0.15, u);
              const helixRadiusY = lerp(H * 0.02, H * 0.065, u);
              const centerY = lerp(entryY, vanishingY + baseH * 0.42, u);

              const rx = cx + Math.cos(loopAngle) * helixRadiusX + laneOff * Math.cos(loopAngle);
              const ry = centerY + Math.sin(loopAngle) * helixRadiusY;

              if (step === 0) ctx.moveTo(rx, ry);
              else ctx.lineTo(rx, ry);
            }

            ctx.strokeStyle = colorWithAlpha(railColor, 0.75);
            ctx.lineWidth = 2.5;
            ctx.shadowColor = railColor;
            ctx.shadowBlur = 12;
            ctx.stroke();
          }

          // 3. Glowing Exit Ejection Nozzle (Bottom exit at p = 0.48)
          const exitAngle = Math.PI * 4 + t * 1.6 * mult;
          const exitRadiusX = corkW * 0.15;
          const exitRadiusY = H * 0.065;
          const exitY = vanishingY + baseH * 0.42;

          ctx.strokeStyle = "rgba(255, 215, 0, 0.90)";
          ctx.lineWidth = 4.0;
          ctx.shadowColor = "#FFD700";
          ctx.shadowBlur = 20;
          ctx.beginPath();
          ctx.ellipse(cx, exitY, exitRadiusX, exitRadiusY, 0, 0, Math.PI * 2);
          ctx.stroke();

          // 4. Extended Laser Runway Tracks (p: 0.48 -> 1.00) leading straight into player's hit targets!
          for (let rail = 0; rail < 3; rail++) {
            const railColor = laneColorsRef.current[rail] || '#FF7B00';
            const { x: targetX, w: targetW } = laneAt(rail, 1, W);
            const targetCenterX = targetX + targetW / 2;
            const exitX = cx + Math.cos(exitAngle) * exitRadiusX + (rail - 1) * 16;

            ctx.beginPath();
            ctx.moveTo(exitX, exitY);
            ctx.bezierCurveTo(
              exitX + (targetCenterX - exitX) * 0.7, exitY + baseH * 0.20,
              targetCenterX, hitY - baseH * 0.15,
              targetCenterX, hitY
            );
            ctx.strokeStyle = colorWithAlpha(railColor, 0.35);
            ctx.lineWidth = 2.0;
            ctx.shadowColor = railColor;
            ctx.shadowBlur = 8;
            ctx.stroke();
          }

          // Ejection pulse particles popping out of the nozzle
          ctx.fillStyle = "#FFD700";
          for (let p = 0; p < 4; p++) {
            const pAngle = exitAngle + (p / 4) * Math.PI * 2;
            const px = cx + Math.cos(pAngle) * exitRadiusX;
            const py = exitY + Math.sin(pAngle) * exitRadiusY;
            ctx.beginPath();
            ctx.arc(px, py, 3.5, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.restore();
        }

        // ── ARCHETYPE 4: 3D UNDULATING WAVE ROLLERCOASTER ──
        else if (currentArch === 'wave_coaster') {
          const coasterW = Math.min(W, 840);
          drawMovingGasAura(ctx, cx, hitY * 0.5, coasterW * 0.55, "#0b1d3a", t, 0.90);

          // Undulating Wave Coaster Rails
          ctx.save();
          const waveSteps = 24;
          ctx.strokeStyle = "rgba(57, 255, 20, 0.65)";
          ctx.lineWidth = 3.5;
          ctx.shadowColor = "#39FF14";
          ctx.shadowBlur = 12;

          for (let lane = 0; lane < LANE_COUNT; lane++) {
            ctx.beginPath();
            for (let step = 0; step <= waveSteps; step++) {
              const p = step / waveSteps;
              const { x } = laneAt(lane, p, W, 0.22, 0.88);
              const waveYOffset = Math.sin(p * Math.PI * 2.5 + t * 3.5) * (H * 0.08);
              const y = p * hitY + waveYOffset;
              if (step === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.stroke();
          }
          ctx.restore();
        }

        // ── ARCHETYPE 5: 3-RIBBON DETACHED SPLIT HORIZON MATRIX ──
        else if (currentArch === 'matrix_split') {
          const matrixW = Math.min(W, 840);
          drawMovingGasAura(ctx, cx, vanishingY + (hitY - vanishingY) * 0.5, matrixW * 0.60, "#04190c", t, 0.95);

          // 3 Separate Floating Ribbons
          ctx.save();
          for (let lane = 0; lane < LANE_COUNT; lane++) {
            const laneCol = laneColorsRef.current[lane] || '#39FF14';
            ctx.strokeStyle = colorWithAlpha(laneCol, 0.75);
            ctx.lineWidth = 3.0;
            ctx.shadowColor = laneCol;
            ctx.shadowBlur = 14;

            ctx.beginPath();
            for (let s = 0; s <= 20; s++) {
              const p = s / 20;
              const spread = (lane - 1) * (W * 0.22 * Math.sin(p * Math.PI));
              const { x, w } = laneAt(lane, p, W, 0.25, 0.90);
              const lx = x + spread;
              const ly = p * hitY;
              if (s === 0) ctx.moveTo(lx, ly);
              else ctx.lineTo(lx, ly);
            }
            ctx.stroke();
          }
          ctx.restore();
        }

        // ── ARCHETYPE 6: 3D CYBER VORTEX TUNNEL (Default & Stage 3/5 POV) ──
        else {
          const tunnelW = Math.min(W, 840);
          const outerRadius = tunnelW * 0.65;
          const tunnelColor = isOverdrive ? stage5Color : "#0d0822";
          
          // Dynamic Undulating Gas Backdrop around 3D Cyber Tunnel (using dynamic cover color #3/#2)
          drawMovingGasAura(ctx, cx, vanishingY, outerRadius, tunnelColor, t, isOverdrive ? 1.2 : 0.95);

          // 1. Dynamic Radial Hyperspace Speed Lines radiating out toward player from vanishing center (cx, vanishingY)
          ctx.save();
          ctx.translate(cx, vanishingY);
          const lineCount = isOverdrive ? 24 : 16;
          const speedMult = isOverdrive ? 2.4 : 1.4;
          
          for (let i = 0; i < lineCount; i++) {
            const baseAng = (i / lineCount) * Math.PI * 2 + swirlAngle * 0.25;
            const lineP = ((t * 0.6 * speedMult + i / lineCount) % 1);
            
            // Scaled dynamically to tunnelW for desktop & widescreen displays
            const minR = tunnelW * 0.04;
            const maxR = tunnelW * 0.58;
            const innerR = minR + (maxR - minR) * Math.pow(lineP, 2);
            const outerR = Math.min(maxR, innerR + tunnelW * lerp(0.08, 0.22, lineP));
            const lineAlpha = (1.0 - Math.pow(lineP - 0.5, 2) * 4) * (0.45 + beatPulseVal * 0.35);
            
            const lc = laneColorsRef.current[i % 3] || (i % 2 === 0 ? "#00E5FF" : "#FF007F");

            ctx.beginPath();
            ctx.moveTo(Math.cos(baseAng) * innerR, Math.sin(baseAng) * (innerR * 0.62));
            ctx.lineTo(Math.cos(baseAng) * outerR, Math.sin(baseAng) * (outerR * 0.62));
            ctx.strokeStyle = colorWithAlpha(lc, Math.max(0, lineAlpha));
            ctx.lineWidth = lerp(1.2, 4.0, lineP);
            ctx.stroke();
          }
          ctx.restore();

          // 2. Dynamic 3D Concentric Depth Rings CONTINUOUSLY EXPANDING & WEAVING WITH THE NOTES
          const ringCount = 8;
          ctx.save();
          ctx.globalCompositeOperation = "screen";

          for (let idx = 0; idx < ringCount; idx++) {
            // Continuous forward movement towards the player in 3D depth space!
            const p_base = idx / ringCount;
            const ringP = ((p_base + (t * 0.35 * swirlSpeedMult)) % 1); // 0 (horizon) -> 1 (foreground)
            
            // 3D Perspective Scaling: accelerates exponentially as ring reaches camera foreground
            const perspectiveP = Math.pow(ringP, 1.4);
            const baseRingY = lerp(vanishingY, H * 0.58, perspectiveP);
            
            // ── Harmonic Tunnel Weave & Sway (Flows in lockstep with the notes!) ──
            const ringWarp = Math.sin(ringP * Math.PI); // Parabolic amplitude (0 at entrance, peaks mid-tunnel)
            const multVal = isOverdrive ? 2.0 : 1.0;
            const ringSwayX = Math.sin(t * 1.8 * multVal + ringP * 3.0) * (tunnelW * 0.028) * ringWarp;
            const ringUndulateY = Math.cos(t * 2.0 + ringP * 2.5) * (H * 0.016) * ringWarp;
            const ringTilt = (Math.cos(t * 1.8 + ringP * 3.0) * 0.12 + Math.sin(t * 0.9 * swirlSpeedMult + ringP * 4.0) * 0.08) * ringWarp;
            
            // Organic breathing resonance pulse
            const ringResonance = 1.0 + 0.06 * Math.sin(t * 4.0 + ringP * Math.PI * 2) * ringWarp;

            // Scaled dynamically to tunnelW for desktop & widescreen displays!
            const ringRadiusX = lerp(tunnelW * 0.05, tunnelW * 0.58, perspectiveP) * ringResonance;
            const ringRadiusY = lerp(H * 0.03, H * 0.42, perspectiveP) * ringResonance;
            
            // Fade in as ring emerges from horizon, fade out at foreground threshold
            const fadeAlpha = ringP < 0.15 ? ringP / 0.15 : (1.0 - Math.max(0, (ringP - 0.82) / 0.18));
            const ringAlpha = fadeAlpha * (0.38 + beatPulseVal * 0.42);

            const ringColor = laneColorsRef.current[idx % 3] || (idx % 2 === 0 ? "#00E5FF" : "#FF007F");
            const ringSwirl = swirlAngle + ringP * 2.0;

            ctx.save();
            ctx.translate(cx + ringSwayX, baseRingY + ringUndulateY);
            ctx.rotate(ringSwirl * 0.15 + ringTilt);

            const lineWidth = lerp(1.5, 6.0, perspectiveP);

            ctx.beginPath();
            ctx.ellipse(0, 0, ringRadiusX, ringRadiusY, 0, 0, Math.PI * 2);
            ctx.strokeStyle = colorWithAlpha(ringColor, Math.max(0, ringAlpha));
            ctx.lineWidth = lineWidth;
            ctx.shadowColor = ringColor;
            ctx.shadowBlur = lerp(4, 20, perspectiveP);
            ctx.stroke();
            ctx.restore();
          }
          ctx.restore();
        }

        // Particle Dust/Stars in the Tunnel/Space (scaled dynamically to tunnelW for widescreen)
        const tunnelW_p = Math.min(W, 840);
        if (tunnelParticlesRef.current.length === 0) {
          for (let i = 0; i < 30; i++) {
            tunnelParticlesRef.current.push({
              ang: Math.random() * Math.PI * 2,
              rad: 0.1 + Math.random() * 0.65, // normalized ratio
              z: Math.random(), // 0 (near) to 1 (far)
              speed: 0.002 + Math.random() * 0.005,
              size: 1 + Math.random() * 2.5
            });
          }
        }

        const pSpeedMult = swirlSpeedMult * 1.5;
        tunnelParticlesRef.current.forEach(p => {
          p.z -= p.speed * pSpeedMult;
          p.ang += 0.002 * swirlSpeedMult;
          if (p.z <= 0) {
            p.z = 1.0;
            p.rad = 0.1 + Math.random() * 0.65;
            p.ang = Math.random() * Math.PI * 2;
          }
          const pScale = 1.0 - p.z;
          const actualR = p.rad * tunnelW_p;
          const px = cx + Math.cos(p.ang) * actualR * pScale;
          const py = vanishingY + Math.sin(p.ang) * (actualR * 0.6) * pScale;
          
          ctx.beginPath();
          ctx.arc(px, py, p.size * pScale * 2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${pScale * 0.8})`;
          ctx.fill();
        });

        // Stage 5 Edge Chromatic Aberration
        if (isOverdrive) {
           const edgeGlow = ctx.createLinearGradient(0, 0, W, 0);
           edgeGlow.addColorStop(0, "rgba(255, 0, 50, 0.15)");
           edgeGlow.addColorStop(0.1, "rgba(0, 0, 0, 0)");
           edgeGlow.addColorStop(0.9, "rgba(0, 0, 0, 0)");
           edgeGlow.addColorStop(1, "rgba(0, 100, 255, 0.15)");
           ctx.fillStyle = edgeGlow;
           ctx.fillRect(0, 0, W, H);
        }
      }

      // ── 3. 3D Circular Judgment Target Strike Zones (Deep Drop Shadows & Neon Rim Glow) ──
      const hwBot = hwAtProgress(1, W);
      const laneW = hwBot.width / LANE_COUNT;
      for (let lane = 0; lane < LANE_COUNT; lane++) {
        const targetProj = getArchetypeProjection(lane, 1, W, H, activeArchetypeRef.current, calculatedStage, t, activePovModeRef.current);
        const laneCenterX = targetProj.x + targetProj.w / 2;
        const laneCenterY = targetProj.y;
        const targetRadiusX = targetProj.w * 0.43;
        const targetRadiusY = targetRadiusX * 0.46;

        const isPressed = laneRef.current[lane]?.pressed;
        const laneColor = laneColorsRef.current[lane] || '#00E5FF';
        
        // Pulse scale
        const scalePulse = 1.0 + beatPulseVal * 0.05;
        const rx = targetRadiusX * scalePulse;
        const ry = targetRadiusY * scalePulse;

        ctx.save();
        ctx.translate(laneCenterX, laneCenterY);
        if (targetProj.rot !== 0) {
          ctx.rotate(targetProj.rot);
        }

        // Track floor drop shadow under target
        ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
        ctx.beginPath();
        ctx.ellipse(0, 4, rx * 1.05, ry * 1.05, 0, 0, Math.PI * 2);
        ctx.fill();

        // Rotating dashed outer ring
        ctx.save();
        ctx.rotate(t * 2);
        ctx.beginPath();
        ctx.ellipse(0, 0, rx * 1.15, ry * 1.15, 0, 0, Math.PI * 2);
        ctx.strokeStyle = colorWithAlpha(laneColor, 0.4);
        ctx.lineWidth = 1.5;
        ctx.setLineDash([8, 6]);
        ctx.stroke();
        ctx.restore();

        // Outer glowing neon strike ring
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        ctx.strokeStyle = isPressed ? '#FFFFFF' : colorWithAlpha(laneColor, 0.95);
        ctx.lineWidth = isPressed ? 5.5 : 3.2;
        ctx.shadowColor = laneColor;
        ctx.shadowBlur = isPressed ? 32 : 16;
        ctx.stroke();

        // Inner target circle
        ctx.beginPath();
        ctx.ellipse(0, 0, rx * 0.55, ry * 0.55, 0, 0, Math.PI * 2);
        ctx.strokeStyle = isPressed ? '#FFFFFF' : colorWithAlpha(laneColor, 0.7);
        ctx.lineWidth = 2.0;
        ctx.stroke();

        // Center crosshair / pulse dot
        ctx.beginPath();
        ctx.arc(0, 0, isPressed ? 8 : 4.5, 0, Math.PI * 2);
        ctx.fillStyle = isPressed ? '#FFFFFF' : laneColor;
        ctx.shadowBlur = isPressed ? 20 : 8;
        ctx.fill();

        // Brief radial burst effect when pressed
        if (isPressed) {
           ctx.beginPath();
           ctx.ellipse(0, 0, rx * 1.3, ry * 1.3, 0, 0, Math.PI * 2);
           ctx.strokeStyle = colorWithAlpha(laneColor, 0.6);
           ctx.lineWidth = 2;
           ctx.stroke();
        }

        ctx.restore();
      }

      ctx.restore();
    }



    // ── POV Warp Speed Transition Overlay ──
    if (povTransitionRef.current.warpAlpha > 0) {
      const elapsed = Date.now() - povTransitionRef.current.startTime;
      const p = Math.min(1, elapsed / povTransitionRef.current.duration);
      povTransitionRef.current.warpAlpha = 1.0 - p;

      if (p < 1.0) {
        ctx.save();
        const flashAlpha = Math.sin(p * Math.PI) * 0.35;
        ctx.fillStyle = `rgba(0, 229, 255, ${flashAlpha})`;
        ctx.fillRect(0, 0, W, H);

        const numStreaks = 20;
        ctx.strokeStyle = `rgba(255, 255, 255, ${flashAlpha * 0.8})`;
        ctx.lineWidth = 2;
        for (let s = 0; s < numStreaks; s++) {
          const angle = (s / numStreaks) * Math.PI * 2;
          const r1 = lerp(10, 80, p);
          const r2 = lerp(100, W * 0.7, p);
          ctx.beginPath();
          ctx.moveTo(W / 2 + Math.cos(angle) * r1, hitY * 0.6 + Math.sin(angle) * r1);
          ctx.lineTo(W / 2 + Math.cos(angle) * r2, hitY * 0.6 + Math.sin(angle) * r2);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

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
        const laneGrad = ctx.createLinearGradient(0, 0, 0, hitY);
        laneGrad.addColorStop(0, "transparent");
        laneGrad.addColorStop(0.6, colorWithAlpha(lc, 0.03));
        laneGrad.addColorStop(1, colorWithAlpha(lc, 0.07));
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
    const railGlow = puColor ? colorWithAlpha(puColor, 0.8) : "rgba(255,248,235,0.25)";

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
      const alphaGlow = Math.max(0, Math.min(1, ei * 0.78));
      const eg1 = ctx.createLinearGradient(0, 0, 80, 0);
      eg1.addColorStop(0, colorWithAlpha(puColor, alphaGlow));
      eg1.addColorStop(1, "transparent");
      ctx.fillStyle = eg1;
      ctx.fillRect(0, 0, 80, H);
      const eg2 = ctx.createLinearGradient(W, 0, W - 80, 0);
      eg2.addColorStop(0, colorWithAlpha(puColor, alphaGlow));
      eg2.addColorStop(1, "transparent");
      ctx.fillStyle = eg2;
      ctx.fillRect(W - 80, 0, 80, H);
    }

    // ── 4.5. HIT ZONE BUTTONS (for 2.5D Classic POV mode) ──
    const isCyberPOV = (isCyberTunnelPov || activeArchetypeRef.current === 'cyber_tunnel') && (calculatedStage === 3 || calculatedStage === 5);
    const show3DCircularTargets = isCyberTunnelPov || (isDynamicStagePov && calculatedStage >= 3);
    if (!show3DCircularTargets) {
      // Original height (space below hit line), centered so baseline bisects each button.
      const btnH = H - hitY;
      const btnY = hitY - btnH / 2; // baseline runs through the exact center
      // Clip to active track width so buttons never overflow the highway edges
      ctx.save();
      ctx.beginPath();
      ctx.rect(hwBot.left, 0, hwBot.right - hwBot.left, H);
      ctx.clip();
    for (let i = 0; i < LANE_COUNT; i++) {
      const { x, w } = laneAt(i, 1, W, isCyberPOV ? 0.18 : HW_TOP, isCyberPOV ? 0.86 : HW_BOT);
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

      // Draw Ghost Pressed Highlight overlay (Translucent Neon Cyan)
      if (ghostActiveKeysRef.current && ghostActiveKeysRef.current[i]) {
        ctx.strokeStyle = "rgba(0, 229, 255, 0.62)";
        ctx.lineWidth = 2.5;
        ctx.shadowColor = "#00E5FF";
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.roundRect(bx, bTop, bw, btnH, 10);
        ctx.stroke();
        
        ctx.fillStyle = "rgba(0, 229, 255, 0.08)";
        ctx.beginPath();
        ctx.roundRect(bx, bTop, bw, btnH, 10);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

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

      // ── Inner radial glow (PIM style) ──
      if (pressed || !silenced) {
        ctx.save();
        const rg = ctx.createRadialGradient(bx + bw / 2, hitY, 0, bx + bw / 2, hitY, bw * 0.8);
        const rgAlpha = pressed ? 0.38 : 0.14 + pulse * 0.04;
        rg.addColorStop(0, colorWithAlpha(lc, rgAlpha));
        rg.addColorStop(1, colorWithAlpha(lc, 0));
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
    }

    // ── 4b. NOTE PARTICLE TRAILS ────────────────────────────────
    const TRAIL_LIFETIME = 280; // ms
    let trailWrite = 0;
    for (let i = 0; i < noteTrailsRef.current.length; i++) {
      if (nowMs - noteTrailsRef.current[i].birthTime < TRAIL_LIFETIME) {
        noteTrailsRef.current[trailWrite++] = noteTrailsRef.current[i];
      }
    }
    noteTrailsRef.current.length = trailWrite;
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

    // ── 5. HIGH-PERFORMANCE NOTES RENDERING (Active Visible Slice) ──
    // Skip note rendering during intro stingers so the rolling highway remains completely clean
    if (phaseRef.current === "countdown") return;

    let dirty = false;
    const allNotes = notesRef.current;
    const minActiveTime = t - Math.max(1.2, AT * 0.8);
    const maxActiveTime = t + AT + 0.3;
    const activeVisibleNotes: NoteState[] = [];

    // Collect ONLY the active visible notes on screen (typically 3-15 notes max)
    for (let i = 0; i < allNotes.length; i++) {
      const ns = allNotes[i];
      if (ns.hit) continue;
      const nTime = ns.note.time;
      const holdDur = ns.note.holdDuration || 0.5;
      if (nTime + holdDur < minActiveTime) continue; // Note is in the past
      if (nTime - AT > maxActiveTime) break; // Subsequent notes are far in the future
      activeVisibleNotes.push(ns);
    }

    // Render back-to-front Z-order (farthest notes at horizon first, closest notes near hit line last)
    for (let idx = activeVisibleNotes.length - 1; idx >= 0; idx--) {
      const ns = activeVisibleNotes[idx];
      if (ns.hit) continue;
      const { note } = ns;
      const spawnT = note.time - AT;
      const prog = (t - spawnT) / AT;
      const maxMissProg = (H - 45) / hitY;
      if (!isRewinding && ns.missed && prog >= maxMissProg) continue;

      const lc = getDifficultyLaneColor(laneColorsRef.current[note.lane], songRef.current?.difficultyLevel ?? 5, note.lane);
      let noteY = prog * hitY;

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

      if (note.type === "mine") {
        const MW = missWindow(songRef.current?.difficultyLevel ?? 5);
        if (t > note.time + MW) {
          ns.hit = true; // Safely avoided the mine!
          continue;
        }
      }

      // Miss detection — skip entirely during rewind (notes travel backwards; no new misses)
      if (!isRewinding && phaseRef.current === "playing") {
        const MW = missWindow(songRef.current?.difficultyLevel ?? 5);
        const isMissed =
          (!ns.holdActive && t > note.time + MW);

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
            recordedTelemetryRef.current.push({
              noteId: note.id,
              time: t,
              judgment: "SHIELDED",
              offset: t - note.time,
              lane: note.lane,
              type: note.type
            });
            dirty = true;
            syncDisplay();
          } else {
            ns.missed = true;
            recordedTelemetryRef.current.push({
              noteId: note.id,
              time: note.time,
              judgment: "MISS",
              offset: 0,
              lane: note.lane,
              type: note.type
            });
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

      const isCyberTunnelStage = activePovModeRef.current === 'cyber_tunnel' && (calculatedStage === 3 || calculatedStage === 5);
      const povTop = isCyberTunnelStage ? 0.18 : HW_TOP;
      const povBot = isCyberTunnelStage ? 0.86 : HW_BOT;

      const proj = getArchetypeProjection(note.lane, prog, W, H, activeArchetypeRef.current, calculatedStage, t, activePovModeRef.current);
      let noteH = proj.h;
      let noteW = proj.w;
      let noteX = proj.x;
      noteY = proj.y;
      if (modifierRef.current === 'bass_realm' && note.lane === 0) {
        noteH = noteH * 1.6; // 60% thicker notes
        noteW = noteW * 1.28; // 28% wider notes
        noteX = proj.x - (noteW - proj.w) / 2;
      }
      const r = lerp(12, 24, prog);

      // Fast O(1) simultaneous chord connection line lookup within activeVisibleNotes
      const chordPartner = activeVisibleNotes.find(other => 
        other !== ns &&
        Math.abs(other.note.time - note.time) < 0.001 &&
        other.note.lane > note.lane &&
        !ns.missed &&
        !other.missed &&
        !ns.hit &&
        !other.hit
      );

      if (chordPartner) {
        const projA = getArchetypeProjection(note.lane, prog, W, H, activeArchetypeRef.current, calculatedStage, t, activePovModeRef.current);
        const projB = getArchetypeProjection(chordPartner.note.lane, prog, W, H, activeArchetypeRef.current, calculatedStage, t, activePovModeRef.current);
        const cx1 = projA.x + projA.w / 2;
        const cy1 = projA.y;
        const cx2 = projB.x + projB.w / 2;
        const cy2 = projB.y;
        
        if (Number.isFinite(cx1) && Number.isFinite(cy1) && Number.isFinite(cx2) && Number.isFinite(cy2)) {
          const colorA = getDifficultyLaneColor(laneColorsRef.current[note.lane], songRef.current?.difficultyLevel ?? 5, note.lane);
          const colorB = getDifficultyLaneColor(laneColorsRef.current[chordPartner.note.lane], songRef.current?.difficultyLevel ?? 5, chordPartner.note.lane);

          ctx.save();
          const connectorGrad = ctx.createLinearGradient(cx1, cy1, cx2, cy2);
          connectorGrad.addColorStop(0, colorA);
          connectorGrad.addColorStop(1, colorB);

          // Neon outer glow line
          ctx.shadowColor = colorA;
          ctx.shadowBlur = 18;
          ctx.strokeStyle = connectorGrad;
          ctx.lineWidth = lerp(4, 14, Math.max(0, Math.min(1, prog)));
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(cx1, cy1);
          ctx.lineTo(cx2, cy2);
          ctx.stroke();
          
          // Bright white core line
          ctx.shadowColor = "transparent";
          ctx.shadowBlur = 0;
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = lerp(1.5, 4.5, Math.max(0, Math.min(1, prog)));
          ctx.stroke();
          ctx.restore();
        }
      }

      const isMissedNote = ns.missed;
      const noteColor = isMissedNote ? "#FF3800" : lc;
      let drawX = noteX;

      // Spawn note trail particles as the note descends (capped to max 35 for performance)
      if (phase === "playing" && !isMissedNote) {
        if (Math.random() < 0.22) {
          if (noteTrailsRef.current.length > 35) {
            noteTrailsRef.current.shift();
          }
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

      const spawnFade = isCyberTunnelStage ? Math.min(1.0, Math.max(0, prog / 0.09)) : 1.0;
      ctx.save();
      if (spawnFade < 1.0) {
        ctx.globalAlpha = (ctx.globalAlpha || 1.0) * spawnFade;
      }

      if (isMissedNote) {
        ctx.save();
        ctx.globalAlpha = 0.38 * Math.max(0, (maxMissProg - prog) / (maxMissProg - 1.0));
        if (Math.random() < 0.2) {
          drawX += (Math.random() - 0.5) * 6; // Glitch horizontal offset
        }
      }

      if (note.type !== "hold") {
        if (proj.rot !== 0) {
          ctx.save();
          ctx.translate(drawX, noteY);
          ctx.rotate(proj.rot);
          drawKey(ctx, 0, 0, noteW, noteH, r, noteColor, prog, false, note.swipeDirection, note.time * 3700, note.type);
          ctx.restore();
        } else {
          drawKey(ctx, drawX, noteY, noteW, noteH, r, noteColor, prog, false, note.swipeDirection, note.time * 3700, note.type);
        }
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
          const { x: ax_hold, w: aw_hold } = laneAt(ns.visualLane, 1, W, povTop, povBot);
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
        }

        // 1. Draw Hold Trail (Active or Inactive) across ALL POV modes & stages!
        drawArchetypeHoldTrail(
          ctx, W, H, ns, note, prog, headP, noteColor,
          activeArchetypeRef.current, calculatedStage, t, activePovModeRef.current
        );

        // 2. Draw Top Terminus Box for Active Hold
        const tailSwipeDir: Note['swipeDirection'] | undefined = (note.targetLane !== undefined ? (note.targetLane > startLane ? 'right' : 'left') : undefined) || note.swipeDirection;
        const headSwipeDir = tailSwipeDir;

        if (ns.holdActive) {
          const tailP = lerp(headP, 1.0, ns.holdProgress);
          const tailProj = getArchetypeProjection(endLane, tailP, W, H, activeArchetypeRef.current, calculatedStage, t, activePovModeRef.current);
          const tailR = lerp(12, 24, tailP);
          if (tailProj.rot !== 0) {
            ctx.save();
            ctx.translate(tailProj.x + tailProj.w / 2, tailProj.y);
            ctx.rotate(tailProj.rot);
            drawKey(ctx, -tailProj.w / 2, 0, tailProj.w, tailProj.h, tailR, noteColor, tailP, true, tailSwipeDir, note.time * 3700, note.type);
            ctx.restore();
          } else {
            drawKey(ctx, tailProj.x, tailProj.y, tailProj.w, tailProj.h, tailR, noteColor, tailP, true, tailSwipeDir, note.time * 3700, note.type);
          }
        }

        // Draw gold terminus block at the tail of the inactive hold (at headP)
        if (!ns.holdActive && headP > 0 && headP <= 1) {
          const tailProj = getArchetypeProjection(endLane, headP, W, H, activeArchetypeRef.current, calculatedStage, t, activePovModeRef.current);
          const tailR = lerp(12, 24, headP);
          if (tailProj.rot !== 0) {
            ctx.save();
            ctx.translate(tailProj.x + tailProj.w / 2, tailProj.y);
            ctx.rotate(tailProj.rot);
            drawKey(ctx, -tailProj.w / 2, 0, tailProj.w, tailProj.h, tailR, noteColor, headP, true, tailSwipeDir, note.time * 3700, note.type);
            ctx.restore();
          } else {
            drawKey(ctx, tailProj.x, tailProj.y, tailProj.w, tailProj.h, tailR, noteColor, headP, true, tailSwipeDir, note.time * 3700, note.type);
          }
        }

        // Draw gold note box at the head of the hold note ONLY when NOT actively held
        // (Once the hold is active, the head is already struck, so we don't draw the big head box to avoid blocking the incoming tail release/swipe)
        if (!ns.holdActive) {
          if (proj.rot !== 0) {
            ctx.save();
            ctx.translate(drawX + noteW / 2, noteY);
            ctx.rotate(proj.rot);
            drawKey(ctx, -noteW / 2, 0, noteW, noteH, r, noteColor, prog, false, headSwipeDir, note.time * 3700, note.type);
            ctx.restore();
          } else {
            drawKey(ctx, drawX, noteY, noteW, noteH, r, noteColor, prog, false, headSwipeDir, note.time * 3700, note.type);
          }
        }
      }

      if (isMissedNote) {
        ctx.restore();
      }
      ctx.restore();
    }

    // ── Horizon Fog Overlay (Fades notes into the background at the vanishing horizon across all stages) ──
    if (activeArchetypeRef.current !== 'radial_orbit' && activeArchetypeRef.current !== 'horizontal_drift') {
      const archMeta = ARCHETYPE_METAS[activeArchetypeRef.current] || ARCHETYPE_METAS['cyber_tunnel'];
      const primerColor_fog = laneColorsRef.current?.[0] || archMeta.primerColor || '#00E5FF';
      const stage5Color_fog = laneColorsRef.current?.[2] || laneColorsRef.current?.[1] || archMeta.stage5Color || '#FF007F';
      const fogColor = calculatedStage === 4 ? primerColor_fog : (calculatedStage === 5 ? stage5Color_fog : "#000000");
      
      const fogGrad = ctx.createLinearGradient(0, 0, 0, hitY * 0.38);
      fogGrad.addColorStop(0, colorWithAlpha(fogColor, 0.65));
      fogGrad.addColorStop(0.5, colorWithAlpha(fogColor, 0.30));
      fogGrad.addColorStop(1, "rgba(0, 0, 0, 0.0)");
      ctx.fillStyle = fogGrad;
      
      ctx.save();
      const isCyberPOV_fog = (isCyberTunnelPov || activeArchetypeRef.current === 'cyber_tunnel') && (calculatedStage === 3 || calculatedStage === 5);
      const topR_fog = isCyberPOV_fog ? 0.18 : HW_TOP;
      const botR_fog = isCyberPOV_fog ? 0.86 : HW_BOT;
      
      const hwTop_fog = hwAtProgress(0, W, topR_fog, botR_fog);
      const hwBot_fog = hwAtProgress(1, W, topR_fog, botR_fog);
      ctx.beginPath();
      ctx.moveTo(hwTop_fog.left, 0);
      ctx.quadraticCurveTo(W / 2, -hitY * 0.09, hwTop_fog.right, 0);
      ctx.lineTo(hwBot_fog.right, hitY);
      ctx.lineTo(hwBot_fog.left, hitY);
      ctx.closePath();
      ctx.clip();
      
      ctx.fillRect(0, 0, W, hitY * 0.38);
      ctx.restore();
    }

    // ── 5b. HIT EXPLOSION EFFECTS ───────────────────────────────
    const FX_DURATION = 520;
    let hitFxWrite = 0;
    for (let i = 0; i < hitFxRef.current.length; i++) {
      if (nowMs - hitFxRef.current[i].startMs < FX_DURATION) {
        hitFxRef.current[hitFxWrite++] = hitFxRef.current[i];
      }
    }
    hitFxRef.current.length = hitFxWrite;
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
        flashGrad.addColorStop(0, colorWithAlpha(e.color, 0));
        flashGrad.addColorStop(0.4, colorWithAlpha(e.color, flashAlpha));
        flashGrad.addColorStop(1, colorWithAlpha(e.color, flashAlpha * 0.5));
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
        const isRadial = activeArchetypeRef.current === 'radial_orbit' && (calculatedStage === 3 || calculatedStage === 5);
        let cx = 0;
        let cy = hitY;
        let ringR = rt * lw * 0.85;

        if (isRadial) {
          const hitProj = getArchetypeProjection(i, 1.0, W, H, activeArchetypeRef.current, calculatedStage, t, activePovModeRef.current);
          cx = hitProj.x;
          cy = hitProj.y;
          ringR = rt * 45;
        } else {
          cx = lx + lw / 2;
        }

        const ringAlpha = Math.pow(1 - rt, 1.4) * 0.65;
        const lc = getDifficultyLaneColor(laneColorsRef.current[i], songRef.current?.difficultyLevel ?? 5, i);

        ctx.save();
        ctx.strokeStyle = `rgba(255, 255, 255, ${ringAlpha})`;
        ctx.lineWidth = lerp(4, 0.5, rt);
        ctx.shadowColor = lc;
        ctx.shadowBlur = 15 * (1 - rt);
        ctx.beginPath();
        ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // ── 5d_ghost. GHOST FLOATING JUDGMENTS ───────────────────────────
    if (ghostTelemetryRef.current) {
      ctx.save();
      ghostJudgmentsRef.current.forEach((j) => {
        const age = Date.now() - j.ts;
        if (age > 600) return;
        const alpha = 1 - age / 600;
        const { x: lx, w: lw } = laneAt(j.lane, 1.0, W);
        const cx = lx + lw / 2;
        const y = hitY - 30 - (age / 600) * 45; // float upwards
        
        let color = "rgba(0, 229, 255, "; // default cyan
        if (j.type === "PERFECT+") color = "rgba(229, 184, 0, "; // gold
        else if (j.type === "MISS") color = "rgba(255, 20, 147, "; // pink/magenta
        
        ctx.fillStyle = `${color}${alpha})`;
        ctx.font = `italic 900 11px "Space Mono", monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowColor = j.type === "PERFECT+" ? "#E5B800" : j.type === "MISS" ? "#FF1493" : "#00E5FF";
        ctx.shadowBlur = 8 * alpha;
        ctx.fillText(`[GHOST: ${j.type}]`, cx, y);
      });
      ctx.restore();
    }

    // ── 5e. COMBO MILESTONE EFFECTS ──────────────────────────────
    const MILESTONE_DURATION = 1000;
    let msWrite = 0;
    for (let i = 0; i < milestoneFxRef.current.length; i++) {
      if (nowMs - milestoneFxRef.current[i].startMs < MILESTONE_DURATION) {
        milestoneFxRef.current[msWrite++] = milestoneFxRef.current[i];
      }
    }
    milestoneFxRef.current.length = msWrite;
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
    // ── 6.6 REMIX STEM EFFECT HUD BANNER & PALETTE FLASH ──
    if (remixFlashUntilRef.current > Date.now()) {
      ctx.save();
      
      // Ethereal cyan/magenta border glow
      ctx.strokeStyle = `rgba(56, 189, 248, ${0.4 + 0.3 * Math.sin(t * 12)})`;
      ctx.lineWidth = 6;
      ctx.strokeRect(0, 0, W, H);

      // HUD Top Banner
      const bannerW = Math.min(320, W * 0.85);
      const bannerX = (W - bannerW) / 2;
      const bannerY = hitY * 0.18;
      
      ctx.fillStyle = "rgba(14, 165, 233, 0.25)";
      ctx.shadowColor = "#38bdf8";
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.roundRect(bannerX, bannerY, bannerW, 30, 8);
      ctx.fill();

      ctx.strokeStyle = "rgba(56, 189, 248, 0.8)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = "#f0abfc";
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`⚡ STEM REMIX: ${remixEffectNameRef.current || 'VOCALS ISOLATE'} ⚡`, W / 2, bannerY + 15);

      // ── Canvas Palette Inversion / Color Shift Overlay ──
      // Applies a pulsing color wash over the entire scene matching the active stem effect
      const remixTimeLeft = remixFlashUntilRef.current - Date.now();
      const remixFade = Math.min(1, remixTimeLeft / 1000); // fade out over last second
      const remixPulse = 0.06 + 0.04 * Math.sin(t * 8);
      const overlayAlpha = remixPulse * remixFade;

      const effectName = audioManager.activeRemixEffect || 'vocals_isolate';
      let overlayColor: string;
      switch (effectName) {
        case 'vocals_isolate': overlayColor = `rgba(56, 189, 248, ${overlayAlpha})`; break;  // Cyan wash
        case 'bass_boost':     overlayColor = `rgba(168, 85, 247, ${overlayAlpha})`; break;  // Purple wash
        case 'drums_mute':     overlayColor = `rgba(34, 197, 94, ${overlayAlpha})`; break;   // Green wash
        case 'lead_solo':      overlayColor = `rgba(251, 146, 60, ${overlayAlpha})`; break;  // Orange wash
        default:               overlayColor = `rgba(56, 189, 248, ${overlayAlpha})`;
      }
      ctx.fillStyle = overlayColor;
      ctx.fillRect(0, 0, W, H);

      ctx.restore();
    }
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

    // Medal stamp popups removed in favor of dynamic HUD and circular dial updates

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

    // ── 8. VIDEO EXPORT HUD OVERLAY (Renders HUD directly on canvas) ──
    if (isExportVideoRef.current) {
      ctx.save();

      // Top HUD Bar background gradient
      const headGrad = ctx.createLinearGradient(0, 0, 0, 70);
      headGrad.addColorStop(0, "rgba(5, 5, 10, 0.92)");
      headGrad.addColorStop(0.7, "rgba(5, 5, 10, 0.65)");
      headGrad.addColorStop(1, "rgba(5, 5, 10, 0)");
      ctx.fillStyle = headGrad;
      ctx.fillRect(0, 0, W, 70);

      // Stage & Song title (Top Left)
      ctx.fillStyle = "#39FF14";
      ctx.font = "900 11px monospace";
      ctx.textAlign = "left";
      ctx.shadowColor = "#39FF14";
      const stageNum = song && song.day !== undefined ? getRelativeDay(song.day) : 1;
      ctx.fillText(`PIM MUSEUM ARCHIVE // STAGE #${stageNum}`, 18, 24);

      ctx.fillStyle = "#FFFFFF";
      ctx.font = "900 16px monospace";
      ctx.shadowColor = "rgba(0,0,0,0.8)";
      ctx.shadowBlur = 4;
      ctx.fillText((song.title || "TRANSMISSION").toUpperCase(), 18, 44);

      // Score & Perfect+ Combo (Top Right)
      ctx.textAlign = "right";
      ctx.fillStyle = "#39FF14";
      ctx.font = "900 18px monospace";
      ctx.shadowColor = "#39FF14";
      ctx.shadowBlur = 12;
      ctx.fillText(`${gs.score.toLocaleString()} PTS`, W - 18, 26);

      ctx.fillStyle = "#FF1493";
      ctx.font = "900 11px monospace";
      ctx.shadowColor = "#FF1493";
      ctx.shadowBlur = 8;
      ctx.fillText(`100% PERFECT+ // COMBO x${gs.combo}`, W - 18, 44);

      ctx.restore();
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
  }, [getT, syncDisplay, finishGame, muteLane]);

  // Keep drawRef current so the single self-sustaining render loop always calls the latest draw instance
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
        const t = getTRef.current ? getTRef.current() : 0;
        for (let l = 0; l < LANE_COUNT; l++) {
          const swipeCandidate = notesRef.current.find(
            (ns) =>
              ns.note.lane === l &&
              !ns.hit &&
              !ns.missed &&
              (ns.note.type === "swipe" || ns.note.type === "lift" || ns.note.swipeDirection) &&
              Math.abs(ns.note.time - t) < missWindow(songRef.current?.difficultyLevel ?? 5)
          );
          if (swipeCandidate) {
            hitLaneRef.current?.(l, swipeDir);
            return;
          }
        }

        const activeHoldWithSwipe = notesRef.current.find(n =>
          n.holdActive && !n.hit && !n.missed &&
          n.note.swipeDirection === swipeDir &&
          Math.abs((n.note.time + (n.note.holdDuration || 0.5)) - t) < missWindow(songRef.current?.difficultyLevel ?? 5)
        );
        if (activeHoldWithSwipe) {
          hitSwipeReleaseRef.current?.(activeHoldWithSwipe, swipeDir);
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
                moveHoldRef.current?.(i, nextLane);
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
        moveHoldRef.current?.(activeHold.currentLane, lane);
        return;
      }

      laneRef.current[lane].pressed = true;
      lastTapTimeRef.current[lane] = Date.now();
      laneRef.current[lane].isArrow = null;
      hitLaneRef.current?.(lane);
    };
    const onUp = (e: KeyboardEvent) => {
      keysDownRef.current.delete(e.key);
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        for (let i = 0; i < LANE_COUNT; i++) {
          if (laneRef.current[i].isArrow === e.key) {
            laneRef.current[i].pressed = false;
            laneRef.current[i].isArrow = null;
            releaseLaneRef.current?.(i);
          }
        }
        return;
      }

      const lane = laneKeysRef.current.indexOf(e.key === " " ? " " : e.key.toLowerCase());
      if (lane < 0) return;
      laneRef.current[lane].pressed = false;
      releaseLaneRef.current?.(lane);
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, []);

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
          const mw = missWindow(songRef.current?.difficultyLevel ?? 5);
          let cand: typeof notesRef.current[0] | undefined = undefined;
          let activeHoldWithSwipe: typeof notesRef.current[0] | undefined = undefined;

          for (let i = 0; i < notesRef.current.length; i++) {
            const n = notesRef.current[i];
            if (n.note.time < t - 1.0) continue;
            if (n.note.time > t + mw + 0.5) break;

            if (!cand && !n.hit && !n.missed && n.note.type === 'swipe' &&
                n.note.swipeDirection === swipeDir && Math.abs(n.note.time - t) < mw) {
              cand = n;
            }
            if (!activeHoldWithSwipe && n.holdActive && !n.hit && !n.missed &&
                n.note.swipeDirection === swipeDir &&
                Math.abs((n.note.time + (n.note.holdDuration || 0.5)) - t) < mw) {
              activeHoldWithSwipe = n;
            }
            if (cand && activeHoldWithSwipe) break;
          }

          if (cand && hitLaneRef.current) {
            hitLaneRef.current(cand.note.lane, swipeDir);
          } else if (activeHoldWithSwipe && hitSwipeReleaseRef.current) {
            hitSwipeReleaseRef.current(activeHoldWithSwipe, swipeDir);
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
          const isModalOpen = useVaultStore.getState().optionsModalOpen;
          if (isModalOpen) {
            useVaultStore.getState().setOptionsModalOpen(false);
          } else if (paused) {
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

        // ── Controller Active Slide Auto-Transition ──
        const activeSlideHold = notesRef.current.find(
          (n) => n.note.type === "hold" && n.holdActive && n.note.targetLane !== undefined && !n.hit
        );
        if (activeSlideHold && activeSlideHold.note.targetLane !== undefined) {
          const targetLane = activeSlideHold.note.targetLane;
          const currentLane = Math.round(activeSlideHold.currentLane);
          if (currentLane !== targetLane) {
            const stickX = (gp.axes[0] !== undefined && Math.abs(gp.axes[0]) > 0.35) ? gp.axes[0] : (gp.axes[2] !== undefined && Math.abs(gp.axes[2]) > 0.35) ? gp.axes[2] : 0;
            const dpadLeft = gp.buttons[14]?.pressed || false;
            const dpadRight = gp.buttons[15]?.pressed || false;
            const isSlideRightNeeded = targetLane > currentLane;
            const isSlideLeftNeeded = targetLane < currentLane;

            const targetLaneBtnPressed =
              (targetLane === 0 && (gp.buttons[2]?.pressed || false)) ||
              (targetLane === 1 && (gp.buttons[3]?.pressed || false)) ||
              (targetLane === 2 && (gp.buttons[1]?.pressed || false));

            const directStickDpadMatch =
              (isSlideRightNeeded && (stickX > 0.35 || dpadRight)) ||
              (isSlideLeftNeeded && (stickX < -0.35 || dpadLeft));

            if (targetLaneBtnPressed || directStickDpadMatch) {
              const prevLaneIdx = Math.round(activeSlideHold.currentLane);
              if (laneRef.current[prevLaneIdx]) {
                laneRef.current[prevLaneIdx].pressed = false;
              }
              laneRef.current[targetLane].pressed = true;
              laneRef.current[targetLane].isArrow = null;
              moveHoldRef.current?.(activeSlideHold.currentLane, targetLane);
            }
          }
        }

        // X, Y, B for the main buttons:
        // Button 2 is X (Left lane -> 0)
        // Button 3 is Y (Center lane -> 1)
        // Button 1 is B (Right lane -> 2)
        // Button 0 is A + D-pad Left/Right = slide trigger
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
        
        // Find matching swipe candidate note with direction tolerance
        let cand = notesRef.current.find(n =>
          !n.hit && !n.missed &&
          (n.note.type === 'swipe' || n.note.type === 'lift' || n.note.swipeDirection !== undefined) &&
          isDirectionMatch(n.note.swipeDirection || (n.note.type === 'lift' ? 'up' : undefined), swipeDir) &&
          n.note.lane === checkLane &&
          Math.abs(n.note.time - t) < missWindow(songRef.current?.difficultyLevel ?? 5)
        );

        // Fallback: check adjacent lanes if finger drifted slightly during swipe
        if (!cand) {
          cand = notesRef.current.find(n =>
            !n.hit && !n.missed &&
            (n.note.type === 'swipe' || n.note.type === 'lift' || n.note.swipeDirection !== undefined) &&
            isDirectionMatch(n.note.swipeDirection || (n.note.type === 'lift' ? 'up' : undefined), swipeDir) &&
            Math.abs(n.note.lane - checkLane) <= 1 &&
            Math.abs(n.note.time - t) < missWindow(songRef.current?.difficultyLevel ?? 5)
          );
        }

        if (cand) {
          hitLane(cand.note.lane, swipeDir);
          start.x = touch.clientX;
          start.y = touch.clientY;
          return true;
        }

        const activeHoldWithSwipe = notesRef.current.find(n =>
          n.holdActive && !n.hit && !n.missed &&
          isDirectionMatch(n.note.swipeDirection, swipeDir) &&
          (n.currentLane === checkLane || Math.abs(n.currentLane - checkLane) <= 1) &&
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
                ns.hit = true;
                ns.holdActive = false;
                ns.holdProgress = 1.0;
                audioManager.playSfx("hidden_secret_found", 0.35);

                const gs = gsRef.current;
                gs.score += calcScore(gs.combo, "PERFECT+");
                gs.combo++;
                gs.maxCombo = Math.max(gs.maxCombo, gs.combo);
                gameSenseService.sendHit();
                gameSenseService.sendCombo(gs.combo);
                gs.perfectPlus++;
                checkPowerUps(gs.combo);
                haptics.mediumTap();

                // ── Slide success particle effect ──
                const W = canvas.width / (window.devicePixelRatio || 1);
                const H = canvas.height / (window.devicePixelRatio || 1);
                const hitY = H * HIT_RATIO;
                const { x: lx, w: lw } = laneAt(newLane, 1, W);
                const cx = lx + lw / 2;
                const lc = getDifficultyLaneColor(laneColorsRef.current[newLane], songRef.current?.difficultyLevel ?? 5, newLane);
                const particles: HitParticle[] = [];
                for (let i = 0; i < 8; i++) {
                  const angle = (Math.random() - 0.5) * Math.PI;
                  const speed = 40 + Math.random() * 60;
                  particles.push({
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed - 20,
                    size: 2.5 + Math.random() * 3.5,
                  });
                }
                hitFxRef.current.push({
                  lane: newLane,
                  startMs: Date.now(),
                  cx,
                  cy: hitY,
                  color: lc,
                  kind: "PERFECT+",
                  particles,
                });

                jRef.current = [
                  ...jRef.current.filter((x) => Date.now() - x.ts < 600),
                  { type: "PERFECT+", lane: newLane, id: ++jCounter.current, ts: Date.now() },
                ];
                syncDisplay();
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
                  ns.hit = true;
                  ns.holdActive = false;
                  ns.holdProgress = 1.0;
                  audioManager.playSfx("hidden_secret_found", 0.35);

                  const gs = gsRef.current;
                  gs.score += calcScore(gs.combo, "PERFECT+");
                  gs.combo++;
                  gs.maxCombo = Math.max(gs.maxCombo, gs.combo);
                  gameSenseService.sendHit();
                  gameSenseService.sendCombo(gs.combo);
                  gs.perfectPlus++;
                  checkPowerUps(gs.combo);
                  haptics.mediumTap();

                  // ── Slide success particle effect ──
                  const canvas = canvasRef.current;
                  if (canvas) {
                    const dpr = window.devicePixelRatio || 1;
                    const W = canvas.width / dpr;
                    const H = canvas.height / dpr;
                    const hitY = H * HIT_RATIO;
                    const { x: lx, w: lw } = laneAt(newLane, 1, W);
                    const cx = lx + lw / 2;
                    const lc = getDifficultyLaneColor(laneColorsRef.current[newLane], songRef.current?.difficultyLevel ?? 5, newLane);
                    const particles: HitParticle[] = [];
                    for (let i = 0; i < 8; i++) {
                      const angle = (Math.random() - 0.5) * Math.PI;
                      const speed = 40 + Math.random() * 60;
                      particles.push({
                        vx: Math.cos(angle) * speed,
                        vy: Math.sin(angle) * speed - 20,
                        size: 2.5 + Math.random() * 3.5,
                      });
                    }
                    hitFxRef.current.push({
                      lane: newLane,
                      startMs: Date.now(),
                      cx,
                      cy: hitY,
                      color: lc,
                      kind: "PERFECT+",
                      particles,
                    });

                    jRef.current = [
                      ...jRef.current.filter((x) => Date.now() - x.ts < 600),
                      { type: "PERFECT+", lane: newLane, id: ++jCounter.current, ts: Date.now() },
                    ];
                    syncDisplay();
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

      // Check candidate LIFT notes (release on beat timing)
      const t = getT();
      const dl = songRef.current?.difficultyLevel ?? 5;
      const liftCandidate = notesRef.current.find(
        (n) => n.note.type === "lift" && !n.hit && !n.missed && Math.abs(n.note.time - t) <= goodWindow(dl)
      );
      if (liftCandidate) {
        liftCandidate.hit = true;
        const diff = Math.abs(liftCandidate.note.time - t);
        const j = diff <= perfectPlusWindow(dl) ? "PERFECT+" : diff <= perfectWindow(dl) ? "PERFECT" : "GOOD";
        const gs = gsRef.current;
        gs.score += calcScore(gs.combo, j);
        gs.combo++;
        gs.maxCombo = Math.max(gs.maxCombo, gs.combo);
        if (j === "PERFECT+") gs.perfectPlus++;
        else if (j === "PERFECT") gs.perfects++;
        else gs.goods++;
        audioManager.playSfx("tap_nav", 0.25);
        triggerHitFx(liftCandidate.currentLane, j);

        // Track lift note telemetry
        recordedTelemetryRef.current.push({
          noteId: liftCandidate.note.id,
          time: t,
          judgment: j,
          offset: t - liftCandidate.note.time,
          lane: liftCandidate.currentLane,
          type: 'lift'
        });
      }
    },
    [completeHoldNote, getT, triggerHitFx],
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
          laneColorsRef.current,
          optsRef.current.gameTrack
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
        setLoadState({
          step: 1,
          stepLabel: "INITIALIZING TRANSMISSION METADATA",
          detailMsg: "Querying track catalog & JSON manifest...",
          bytesLoaded: 0,
          bytesTotal: 0,
          speedBps: 0,
          etaSeconds: 0,
          pct: 12,
          isStreaming: false,
          logs: [`[SYS] Connecting to transmission gateway for ID: ${songId}`, `[SYS] Fetching track configuration...`],
        });
        let song = await getSongById(songId);
        if (song) {
          song = { ...song, notes: [...(song.notes || [])] };
          if (!activeTutorial) {
            const gameOpts = loadOpts();
            const genMode = gameOpts.noteGenerationSource || 'auto';
            
            if (song.notes.length === 0 || genMode !== 'auto') {
              const msg = genMode === 'lyrics' ? "TRANSLATING LYRICAL DYNAMICS..." : "ALIGNING BPM BEATS...";
              setLoadMsg(msg);
              setLoadState(prev => ({
                ...prev,
                step: 2,
                stepLabel: "GENERATING BEATMAP & RHYTHM GRID",
                detailMsg: msg,
                pct: 28,
                logs: [...prev.logs.slice(-4), `[CHART] Generating ${genMode} chart notes...`]
              }));
              if (genMode !== 'auto') {
                // Non-auto modes use runtime procedural generation
                song.notes = generateProceduralChart(song);
                console.log(`[GamePlay Init] Generated ${genMode} chart: ${song.notes.length} notes (reward play disabled)`);
              } else {
                setLoadMsg("FORGING AUDIO BEATMAP...");
                try {
                  song.notes = await generateAudioForgeChart(song);
                } catch (err) {
                  console.warn("[GamePlay Init] Audio Forge failed, falling back to procedural grid:", err);
                  song.notes = generateProceduralChart(song);
                }
              }
            }

            // Runtime stageification toggle: re-partition pre-baked notes through the stage density engine
            if (STAGEIFICATION_CONFIG.USE_RUNTIME_STAGEIFICATION && genMode === 'auto' && song.notes.length > 0) {
              console.log(`[GamePlay Init] Runtime stageification enabled — re-partitioning ${song.notes.length} pre-baked notes`);
              const { notes: restaged } = stageifyNotes(song.notes, song.duration, song.bpm, song.difficultyLevel || 5);
              song.notes = restaged;
              console.log(`[GamePlay Init] Restaged to ${song.notes.length} notes`);
            }
          }

          setLoadState(prev => ({
            ...prev,
            step: 2,
            stepLabel: "BEATMAP & TIMING ALIGNED",
            detailMsg: `Mapped ${song!.notes.length} notes · ${song!.bpm} BPM`,
            pct: 36,
            logs: [...prev.logs.slice(-4), `[CHART] Validated ${song!.notes.length} notes across stages`]
          }));
        }

        const selectedArchetype = selectSongArchetype(song);
        activeArchetypeRef.current = selectedArchetype;
        setActiveArchetype(selectedArchetype);
        if (!isPovLockedRef.current) {
          setActivePovMode('classic');
          activePovModeRef.current = 'classic';
          offscreenCanvasRef.current = null;
        }
        console.log(`[Track Archetype Engine] Selected archetype '${selectedArchetype}' (${ARCHETYPE_METAS[selectedArchetype].name}) for song '${song?.title}'`);

        // Load ghost telemetry
        ghostTelemetryRef.current = null;
        ghostIndexRef.current = 0;
        ghostActiveKeysRef.current = [false, false, false];
        ghostJudgmentsRef.current = [];
        recordedTelemetryRef.current = [];

        // 1. Try local storage first
        try {
          const localGhost = localStorage.getItem(`telemetry_${songId}`);
          if (localGhost) {
            const parsed = JSON.parse(localGhost);
            if (parsed && Array.isArray(parsed.events)) {
              // Sort events by time to ensure sequential playback
              ghostTelemetryRef.current = parsed.events.sort((a: any, b: any) => a.time - b.time);
              console.log("[Replay Ghost] Loaded ghost telemetry from localStorage:", parsed.events.length, "events");
            }
          }
        } catch (e) {
          console.warn("[Replay Ghost] Failed to parse local ghost telemetry:", e);
        }

        // 2. Try Supabase as secondary source
        if (!ghostTelemetryRef.current && supabase) {
          try {
            const session = await supabase.auth.getSession();
            const userId = session.data.session?.user.id;
            if (userId) {
              const { data } = await supabase
                .from('gameplay_records')
                .select('telemetry')
                .eq('user_id', userId)
                .eq('song_id', songId)
                .not('telemetry', 'is', null)
                .order('score', { ascending: false })
                .limit(1)
                .maybeSingle();

              if (data?.telemetry?.events) {
                ghostTelemetryRef.current = data.telemetry.events.sort((a: any, b: any) => a.time - b.time);
                console.log("[Replay Ghost] Loaded ghost telemetry from Supabase:", data.telemetry.events.length, "events");
              }
            }
          } catch (e) {
            console.warn("[Replay Ghost] Failed to fetch ghost telemetry from Supabase:", e);
          }
        }

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
          laneColorsRef.current,
          optsRef.current.gameTrack
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

          // Extract dynamic colors from artwork for notes if theme is artwork
          if (opts.noteTheme === "artwork") {
            try {
              const extCanvas = document.createElement("canvas");
              extCanvas.width = 3;
              extCanvas.height = 3;
              const extCtx = extCanvas.getContext("2d")!;
              extCtx.drawImage(img, 0, 0, 3, 3);
              const imgData = extCtx.getImageData(0, 0, 3, 3).data;
              
              const samplePixel = (pxIdx: number): string => {
                const r = imgData[pxIdx * 4];
                const g = imgData[pxIdx * 4 + 1];
                const b = imgData[pxIdx * 4 + 2];
                
                const rNorm = r / 255;
                const gNorm = g / 255;
                const bNorm = b / 255;
                const max = Math.max(rNorm, gNorm, bNorm);
                const min = Math.min(rNorm, gNorm, bNorm);
                let h = 0;
                let s = 0;
                const l = (max + min) / 2;
                
                if (max !== min) {
                  const d = max - min;
                  s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                  switch (max) {
                    case rNorm: h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0); break;
                    case gNorm: h = (bNorm - rNorm) / d + 2; break;
                    case bNorm: h = (rNorm - gNorm) / d + 4; break;
                  }
                  h /= 6;
                }
                
                const finalH = Math.round(h * 360);
                const finalS = 95; // Vibrant neon saturation
                const finalL = 52; // Excellent screen legibility
                return hslToHex(finalH, finalS, finalL);
              };
              
              const extColors: [string, string, string] = [
                samplePixel(0), // Left pixel
                samplePixel(4), // Center pixel
                samplePixel(8), // Right pixel
              ];
              
              laneColorsRef.current = extColors;
              console.log("[Dynamic Colors] Extracted lane colors from cover art:", extColors);
              
              // Regenerate static track visual cache with new dynamic colors
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
                  laneColorsRef.current,
                  optsRef.current.gameTrack
                );
              }
            } catch (err) {
              console.error("Failed to extract dynamic colors from artwork:", err);
            }
          }
        };
        img.src = song.coverArt;
      }
      notesRef.current = song.notes.map((n, idx) => {
        let note = { ...n, lane: Math.min(n.lane, LANE_COUNT - 1) };
        const diff = songRef.current?.difficultyLevel ?? 5;

        // Sanitize swipeDirection: only 'swipe' notes and 'hold' notes can have a swipeDirection
        if (note.type !== 'swipe' && note.type !== 'hold') {
          note.swipeDirection = undefined;
        }
        if (note.type === 'swipe' && !note.swipeDirection) {
          note.swipeDirection = 'up';
        }

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
        type: NoteType;
      }
      const scoreEvents: ScoreEvent[] = [];
      notesRef.current.forEach(ns => {
        if (ns.note.type === "mine") {
          return; // mines are not hit in a perfect run
        }
        if (ns.note.type === "hold") {
          scoreEvents.push({ time: ns.note.time, type: ns.note.type });
          scoreEvents.push({ time: ns.note.time + (ns.note.holdDuration || 0.5), type: ns.note.type });
        } else {
          scoreEvents.push({ time: ns.note.time, type: ns.note.type });
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

        let baseNoteScore = 500;
        if (event.type === "remix") baseNoteScore += 1000;
        else if (event.type === "break") baseNoteScore += 1200;
        else if (event.type === "accent") baseNoteScore += 800;

        maxScore += Math.round(baseNoteScore * puMul * comboMul);
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
      setLoadState(prev => ({
        ...prev,
        step: 4,
        stepLabel: "DOWNLOADING AUDIO TRANSMISSION",
        detailMsg: "Establishing stream connection to audio file...",
        pct: 55,
        logs: [...prev.logs.slice(-4), `[NET] Requesting audio stream: ${song.audioUrl}`]
      }));

      if (audioObjectUrlRef.current) {
        try {
          URL.revokeObjectURL(audioObjectUrlRef.current);
        } catch {}
        audioObjectUrlRef.current = null;
      }

      let blob: Blob | null = null;
      let objectUrl: string = "";
      let fetchSuccess = false;

      const audioCandidates = getCandidateAudioUrls(song.audioUrl, song.day);
      let targetAudioUrl = song.audioUrl;

      // ── Attempt 1: Fetch via stream reader for precise progress ──
      // Skip blob download for large files (>10MB) — e.g. uncompressed WAV assets.
      // For those, fall through to direct audio.src streaming which starts playback
      // as soon as enough data is buffered rather than waiting for the full download.
      try {
        let response: Response | null = null;
        let headRes: Response | null = null;

        for (const candidate of audioCandidates) {
          try {
            console.log("[GamePlay Init] Attempting stream-based audio fetch:", candidate);
            const r = await fetch(candidate);
            if (r.ok) {
              response = r;
              targetAudioUrl = candidate;
              break;
            }
          } catch (e) {
            console.warn(`[GamePlay Init] Candidate fetch failed for ${candidate}:`, e);
          }
        }

        const headLen = response?.headers.get("content-length");
        const headBytes = headLen ? parseInt(headLen, 10) : 0;
        const LARGE_FILE_THRESHOLD = 10 * 1024 * 1024; // 10 MB

        if (headBytes > LARGE_FILE_THRESHOLD) {
          // Large file — skip blob approach; stream directly via audio.src instead
          console.log(`[GamePlay Init] Large file detected (${Math.round(headBytes / 1024 / 1024)}MB) — using direct audio streaming`);
          setBufferPct(100);
          setLoadState(prev => ({
            ...prev,
            step: 4,
            stepLabel: "STREAMING DIRECT AUDIO CHUNKS",
            detailMsg: `Large file (${(headBytes / 1048576).toFixed(1)} MB) · HTML5 streaming active`,
            bytesLoaded: headBytes,
            bytesTotal: headBytes,
            pct: 95,
            isStreaming: true,
            logs: [...prev.logs.slice(-4), `[NET] Direct HTML5 media streaming engaged (${(headBytes / 1048576).toFixed(1)} MB)`]
          }));
        } else if (response && response.ok) {
          const contentLength = response.headers.get("content-length");
          const totalBytes = contentLength ? parseInt(contentLength, 10) : (headBytes || 0);

          if (response.body && totalBytes > 0) {
            const reader = response.body.getReader();
            const chunks: Uint8Array[] = [];
            let loadedBytes = 0;
            const startTime = performance.now();
            let lastTime = startTime;
            let lastLoaded = 0;
            let speedBps = 0;

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
                
                const now = performance.now();
                const dt = (now - lastTime) / 1000;
                if (dt >= 0.15) {
                  speedBps = (loadedBytes - lastLoaded) / dt;
                  lastTime = now;
                  lastLoaded = loadedBytes;
                }
                
                const streamPct = Math.min(99, Math.round((loadedBytes / totalBytes) * 100));
                const bytesLeft = Math.max(0, totalBytes - loadedBytes);
                const etaSeconds = speedBps > 0 && bytesLeft > 0 ? bytesLeft / speedBps : 0;
                const mappedPct = Math.min(96, Math.round(55 + (streamPct * 0.41)));

                setBufferPct(streamPct);
                setLoadState({
                  step: 4,
                  stepLabel: "DOWNLOADING AUDIO TRANSMISSION",
                  detailMsg: `Receiving stream chunks (${formatLoadBytes(loadedBytes)} / ${formatLoadBytes(totalBytes)})...`,
                  bytesLoaded,
                  bytesTotal: totalBytes,
                  speedBps,
                  etaSeconds,
                  pct: mappedPct,
                  isStreaming: false,
                  logs: [
                    `[NET] ${(loadedBytes / 1048576).toFixed(2)} MB received of ${formatLoadBytes(totalBytes)} (${streamPct}%)`,
                    `[SPEED] ${formatLoadSpeed(speedBps)} · ETA: ${formatLoadEta(etaSeconds)}`
                  ]
                });
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
          setLoadState(prev => ({
            ...prev,
            step: 5,
            stepLabel: "SYNCHRONIZING AUDIO ENGINE",
            detailMsg: "Aligning Web Audio Context & pre-rendering surface...",
            pct: 98,
            logs: [...prev.logs.slice(-3), `[ENGINE] Audio blob compiled & object URL generated`]
          }));
        }
      } catch (err) {
        console.warn("[GamePlay Init] Stream-based fetch failed, falling back to standard audio loading:", err);
      }


      if (cancelled) return;

      if (fetchSuccess) {
        audio = new Audio();
        // NOTE: Blob URLs (blob:http://...) are same-origin by definition.
        // Setting crossOrigin = "anonymous" on a blob: URL causes HTMLMediaElement to fail with CORS security error.
        audio.preload = "auto";
        audioRef.current = audio;
        audio.src = objectUrl;
        audio.load();

        let blobLoadFailed = false;

        await new Promise<void>((resolve) => {
          resolvePendingPromiseRef.current = resolve;
          if (audio!.readyState >= 3) {
            resolve();
            return;
          }
          onCanPlay = () => resolve();
          onError = () => {
            console.warn("[GamePlay Init] Audio element failed to load Blob URL, falling back to standard audio streaming...");
            blobLoadFailed = true;
            resolve();
          };
          audio!.addEventListener("canplay", onCanPlay, { once: true });
          audio!.addEventListener("error", onError, { once: true });
          loadTimeoutRef.current = setTimeout(() => {
            if (audio!.readyState < 3) {
              console.warn("[GamePlay Init] Blob URL load timed out, falling back to standard audio streaming...");
              blobLoadFailed = true;
            }
            resolve();
          }, 5000); // 5s timeout fallback
        });
        resolvePendingPromiseRef.current = null;

        if (onCanPlay) audio!.removeEventListener("canplay", onCanPlay);
        if (onError) audio!.removeEventListener("error", onError);
        if (loadTimeoutRef.current) {
          clearTimeout(loadTimeoutRef.current);
          loadTimeoutRef.current = null;
        }

        if (blobLoadFailed) {
          if (audioObjectUrlRef.current) {
            try {
              URL.revokeObjectURL(audioObjectUrlRef.current);
            } catch {}
            audioObjectUrlRef.current = null;
          }
          fetchSuccess = false;
        }
      }

      if (!fetchSuccess && !cancelled) {
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

        audio.src = targetAudioUrl;
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

          audio.src = targetAudioUrl;
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

      // Sync real audio element duration with song.duration and re-stageify notes
      if (audio && audio.duration && !isNaN(audio.duration) && isFinite(audio.duration) && audio.duration > 5) {
        const roundedAudioDuration = parseFloat(audio.duration.toFixed(1));
        if (songRef.current && Math.abs(songRef.current.duration - roundedAudioDuration) > 1.5) {
          console.log(`[Audio Duration Sync] Syncing song.duration from ${songRef.current.duration}s to real audio duration ${roundedAudioDuration}s`);
          songRef.current.duration = roundedAudioDuration;

          // Filter out notes exceeding real audio duration - 1.0s
          const filteredNotes = (songRef.current.notes || []).filter(n => n.time <= roundedAudioDuration - 1.0);

          // Re-stageify notes using exact real audio duration
          const { notes: restaged, stages } = stageifyNotes(
            filteredNotes,
            roundedAudioDuration,
            songRef.current.bpm || 120,
            songRef.current.difficultyLevel || 5
          );
          songRef.current.notes = restaged;
          songRef.current.stages = stages;

          // Refresh active notesRef
          notesRef.current = restaged.map(n => ({
            note: { ...n, lane: Math.min(n.lane, LANE_COUNT - 1) },
            hit: false,
            missed: false,
            holdActive: false,
            holdProgress: 0,
            currentLane: n.lane,
            originLane: n.lane,
            visualLane: n.lane,
          }));
        }
      }

      // ── Web Audio frequency-band routing (Init during fresh user gesture) ──
      // Lane 0 (A) → bass  · Lane 1 (S) → mids  · Lane 2 (D) → treble
      try {
        const isBlobUrl = audio.src.startsWith("blob:");
        if (!isBlobUrl && !audio.crossOrigin) {
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
        masterGainRef.current = masterGainNode;
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

      // ── Canvas dimension safety net & initial setup ────────────────────────
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
          }
          // Pre-render static track surface offscreen cache
          const diffLevel = songRef.current?.difficultyLevel ?? 5;
          offscreenCanvasRef.current = prerenderStaticTrack(
            w.clientWidth,
            w.clientHeight,
            dpr,
            diffLevel,
            laneColorsRef.current,
            optsRef.current.gameTrack
          );
        }
      }

      // START HIGHWAY CANVAS ROLLING IMMEDIATELY
      phaseRef.current = "countdown";
      setPhase("countdown");
      rafRef.current = requestAnimationFrame(() => drawRef.current?.());

      // Initial Enter Game Sound FX
      audioManager.playSfx('select_start_song', 0.85);

      // ── INTRO STINGER SEQUENCE: 2: TRANSMISSION INCOMING -> 1: ARE YOU READY??! -> 0: GO! ──
      let count = 2;
      setCountdown(count);
      audioManager.playSfx('countdown', 0.9);
      haptics.mediumTap();

      await new Promise<void>((resolve) => {
        countdownIntervalRef.current = setInterval(() => {
          count--;
          if (count > 0) {
            setCountdown(count);
            audioManager.playSfx('countdown', 0.9);
            haptics.mediumTap();
          } else {
            if (countdownIntervalRef.current) {
              clearInterval(countdownIntervalRef.current);
              countdownIntervalRef.current = null;
            }
            setCountdown(0); // "GO!"
            audioManager.playSfx('select_start_song', 1.0);
            haptics.heavyTap();
            setTimeout(() => {
              resolve();
            }, 600);
          }
        }, 1150);
      });
      if (cancelled) return;

      phaseRef.current = "playing";
      setPhase("playing");

      if (isExportVideoRef.current && canvasRef.current) {
        try {
          setIsRecordingVideo(true);
          setIsExportModalOpen(true);
          recordedChunksRef.current = [];
          
          const canvasStream = canvasRef.current.captureStream(60);
          let combinedStream = canvasStream;
          
          if (audioCtxRef.current && audioCtxRef.current.destination) {
            const dest = audioCtxRef.current.createMediaStreamDestination();
            let connected = false;
            if (masterGainRef.current) {
              try { masterGainRef.current.connect(dest); connected = true; } catch {}
            }
            if (!connected && audioSourceRef.current) {
              try { audioSourceRef.current.connect(dest); connected = true; } catch {}
            }
            const audioTracks = dest.stream.getAudioTracks();
            if (audioTracks.length > 0) {
              combinedStream = new MediaStream([
                ...canvasStream.getVideoTracks(),
                audioTracks[0]
              ]);
            }
          }

          let mimeType = 'video/mp4;codecs=avc1,aac';
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'video/webm;codecs=vp9,opus';
          }
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'video/webm';
          }
          setVideoMimeType(mimeType);

          const recorder = new MediaRecorder(combinedStream, { mimeType });
          recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
              recordedChunksRef.current.push(e.data);
            }
          };
          recorder.onstop = () => {
            const blob = new Blob(recordedChunksRef.current, { type: mimeType });
            const url = URL.createObjectURL(blob);
            setVideoBlob(blob);
            setVideoUrl(url);
            setIsRecordingVideo(false);
          };
          recorder.start(100);
          mediaRecorderRef.current = recorder;
        } catch (recErr) {
          console.error('[Video Export] Failed to start MediaRecorder:', recErr);
        }
      }

      await audio.play();

      // Check if AudioContext is suspended after play, indicating it got blocked during countdown
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        console.warn("[GamePlay Init] AudioContext is suspended after play, triggering tap-to-start recovery");
        phaseRef.current = "audioError";
        setPhase("audioError");
        cancelAnimationFrame(rafRef.current);
        audio.pause();
      }
      } catch (err: any) {
        if (err?.name === 'NotAllowedError') {
          console.warn("[GamePlay Init] Autoplay blocked by browser policy. Displaying Tap to Start overlay.");
          phaseRef.current = "audioError";
          setPhase("audioError");
          cancelAnimationFrame(rafRef.current);
          if (audioRef.current) audioRef.current.pause();
        } else {
          console.error("[GamePlay Init Error] Caught exception in init:", err);
          throw err;
        }
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

      if (stingerTimeout1Ref.current) {
        clearTimeout(stingerTimeout1Ref.current);
        stingerTimeout1Ref.current = null;
      }
      if (stingerTimeout2Ref.current) {
        clearTimeout(stingerTimeout2Ref.current);
        stingerTimeout2Ref.current = null;
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
      if (gameplayAnalyserRef.current) {
        try { gameplayAnalyserRef.current.disconnect(); } catch {}
        gameplayAnalyserRef.current = null;
      }
      gameplayAnalyserDataRef.current = null;

      if (audioCtxRef.current) {
        if (audioCtxRef.current !== audioManager.getContext()) {
          try { audioCtxRef.current.close(); } catch {}
        }
        audioCtxRef.current = null;
      }
      laneSilenced.current = [false, false, false];

      // Clean up canvas, particles, telemetry and image caches to release memory
      coverImgRef.current = null;
      coverBlurRef.current = null;
      scanPatternRef.current = null;
      offscreenCanvasRef.current = null;
      slideshowSlidesRef.current = [];
      gameplaySlideshowFloatersRef.current = [];
      noteTrailsRef.current = [];
      notesRef.current = [];
      jRef.current = [];
      hitFxRef.current = [];
      milestoneFxRef.current = [];
      ambientParticlesRef.current = [];
      tunnelParticlesRef.current = [];
      recordedTelemetryRef.current = [];
      ghostTelemetryRef.current = null;
      ghostJudgmentsRef.current = [];
      keysDownRef.current.clear();
      touchStartPos.current = {};
      isAudioClockCalibratedRef.current = false;
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

    const nowWall = performance.now();
    lastFrameTimeRef.current = nowWall;
    lastAudioCurrentTimeRef.current = audioRef.current?.currentTime ?? 0;
    lastAudioWallTimeRef.current = nowWall;
    isAudioClockCalibratedRef.current = false;

    if (phaseRef.current === 'playing') {
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
      audioRef.current?.play().catch(() => {});
      // Restart the loop safely without duplicating RAF handles
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
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

  // Handle manual keyboard pause (Escape), POV switcher (V), and Continue (Enter)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const p = phaseRef.current;
      if (p === 'playing') {
        if (e.key === 'v' || e.key === 'V') {
          cyclePovMode();
          return;
        }
        if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
          const isModalOpen = useVaultStore.getState().optionsModalOpen;
          if (isModalOpen) {
            useVaultStore.getState().setOptionsModalOpen(false);
            return;
          }
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
  }, [doPause, doResume, doReturn, cyclePovMode]);

  const { perfectPlus: pp = 0, perfects: pfp = 0, goods: gd = 0, misses: ms = 0 } = displayGs;
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

  const MEDAL_STYLES: Record<string, { main: string; glow: string; text: string; bg: string }> = {
    NONE: {
      main: "rgba(168, 85, 247, 0.45)",
      glow: "rgba(168, 85, 247, 0.35)",
      text: "text-purple-400",
      bg: "rgba(168, 85, 247, 0.08)"
    },
    BRONZE: {
      main: "#CD7F32",
      glow: "rgba(205, 127, 50, 0.75)",
      text: "text-[rgb(205,127,50)]",
      bg: "rgba(205, 127, 50, 0.15)"
    },
    SILVER: {
      main: "#C0C0C0",
      glow: "rgba(192, 192, 192, 0.75)",
      text: "text-[rgb(192,192,192)]",
      bg: "rgba(192, 192, 192, 0.15)"
    },
    GOLD: {
      main: "#FFD700",
      glow: "rgba(255, 215, 0, 0.95)",
      text: "text-[rgb(255,215,0)] font-black",
      bg: "rgba(255, 215, 0, 0.2)"
    },
    PLATINUM: {
      main: "#E0E0FF",
      glow: "rgba(224, 224, 255, 0.95)",
      text: "text-[rgb(224,224,255)] font-black",
      bg: "rgba(224, 224, 255, 0.25)"
    }
  };
  const medalStyle = MEDAL_STYLES[curMedal] || MEDAL_STYLES.NONE;

  return (
    <div
      className="fixed inset-0 flex justify-center overflow-hidden"
      style={{ background: "#0c0c14" }}
    >
      {/* ── POV TOAST NOTIFICATION OVERLAY ── */}
      <AnimatePresence>
        {povToast && Date.now() - povToast.time < 1800 && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.95 }}
            className="absolute top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-2 rounded-full border border-[#00E5FF]/40 bg-black/80 backdrop-blur-xl shadow-[0_0_24px_rgba(0,229,255,0.4)] flex items-center gap-3 pointer-events-none"
          >
            <div className="w-2 h-2 rounded-full bg-[#00E5FF] animate-ping" />
            <span className="font-mono text-xs font-black tracking-widest text-white uppercase">
              CAMERA PERSPECTIVE: <span className="text-[#00E5FF]">{povToast.mode}</span>
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── POV SWITCH & LOCK BUTTONS (Bottom Right next to Pause) ── */}
      {phase === "playing" && !paused && (
        <div className="absolute bottom-6 right-20 z-50 flex items-center gap-1.5">
          <button
            onClick={togglePovLock}
            className={`h-12 px-3 flex items-center gap-1.5 rounded-full border-2 transition-all cursor-pointer shadow-lg backdrop-blur-md font-mono text-xs ${
              isPovLocked
                ? 'bg-[#FF3800]/25 border-[#FF3800] text-[#FF3800] shadow-[0_0_16px_rgba(255,56,0,0.4)] scale-105'
                : 'bg-black/60 border-white/20 text-white/60 hover:text-white hover:border-white/40'
            }`}
            title={isPovLocked ? "POV Perspective Locked (Auto-Stage Camera Shifts Disabled)" : "Lock Current POV Perspective Camera"}
          >
            <span className="text-sm">{isPovLocked ? '🔒' : '🔓'}</span>
            <span className="font-black text-[9px] uppercase tracking-wider hidden md:inline-block">
              {isPovLocked ? 'LOCKED' : 'LOCK'}
            </span>
          </button>

          <button
            onClick={cyclePovMode}
            className="px-3.5 h-12 flex items-center gap-2 rounded-full glass-panel border-2 border-white/20 hover:scale-105 active:scale-95 transition-all cursor-pointer group text-white font-mono text-xs shadow-lg bg-black/60 backdrop-blur-md"
            title="Toggle POV Perspective Camera Mode (Hotkey: V)"
          >
            <span className="text-base">
              {activePovMode === 'cyber_tunnel' ? '🌀' : activePovMode === 'dynamic_stage' ? '🎥' : '📐'}
            </span>
            <span className="font-black text-[10px] uppercase tracking-wider hidden sm:inline-block">
              {activePovMode === 'cyber_tunnel' ? '3D TUNNEL' : activePovMode === 'dynamic_stage' ? 'DYNAMIC STAGE' : '2.5D CLASSIC'}
            </span>
            <span className="text-[8px] font-black text-white/80 bg-white/10 px-1.5 py-0.5 rounded font-mono border border-white/10">V</span>
          </button>

          {isArchetypeDevModeEnabled() && (
            <button
              onClick={cycleArchetype}
              className="px-3.5 h-12 flex items-center gap-1.5 rounded-full glass-panel border-2 border-purple-500/50 hover:scale-105 active:scale-95 transition-all cursor-pointer group text-white font-mono text-xs shadow-lg bg-black/70 backdrop-blur-md"
              title="DEV MODE: Cycle Track Geometry Archetype"
            >
              <span className="text-[9px] font-black bg-purple-500/40 text-purple-200 px-1.5 py-0.5 rounded border border-purple-400/50">DEV</span>
              <span className="font-black text-[9px] uppercase tracking-wider hidden sm:inline-block text-purple-200">
                {ARCHETYPE_METAS[activeArchetype]?.name || 'CYBER TUNNEL'}
              </span>
            </button>
          )}
        </div>
      )}

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
            
            <div className="flex flex-col gap-3.5">
              <button
                onClick={doResume}
                className="w-full py-3.5 font-mono font-bold text-sm tracking-[0.3em] bg-[#F2F0E8] text-[#080808] rounded-lg hover:scale-[1.02] active:scale-95 transition-all shadow-lg cursor-pointer"
              >
                RESUME TRANSMISSION
              </button>
              
              <button
                onClick={() => {
                  audioManager.playSfx('menu_confirm', 0.15);
                  useVaultStore.getState().setOptionsModalOpen(true);
                }}
                className="w-full py-3.5 font-mono font-bold text-xs tracking-[0.2em] bg-white/5 text-white/80 border border-white/10 rounded-lg hover:bg-white/10 hover:text-white transition-all cursor-pointer"
              >
                ⚙ SETTINGS & OPTIONS
              </button>
              
              <button
                onClick={doAbandon}
                className="w-full py-3.5 font-mono font-bold text-xs tracking-[0.2em] bg-white/5 text-white/60 border border-white/10 rounded-lg hover:bg-white/10 hover:text-white transition-all cursor-pointer"
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
              <p className="text-zinc-500 uppercase tracking-widest text-[9px]">// TRAINING MODULE: NOTE TYPES & CONTROLS //</p>
              <div>
                <span className="text-[#39FF14] font-bold block mb-0.5">■ TAPS:</span>
                Press lane key (D F J), Controller (X Y B), or tap screen when note aligns with trigger line.
              </div>
              <div>
                <span className="text-[#FFD700] font-bold block mb-0.5">▬ HOLD & SLIDES:</span>
                Hold key/button until gold tail finishes. Shift lane if path bends sideways.
              </div>
              <div>
                <span className="text-[#FF1493] font-bold block mb-0.5">➔ SWIPES & ▲ LIFTS:</span>
                Flick Analog Stick, press Arrow Key / D-Pad, or swipe screen in arrow/upward direction.
              </div>
              <div>
                <span className="text-[#FF7B00] font-bold block mb-0.5">⚡ BREAK & ✦ ACCENT:</span>
                High-voltage beat & snare drops awarding bonus score multipliers.
              </div>
              <div>
                <span className="text-[#00F5D4] font-bold block mb-0.5">🎛 REMIX RUNES:</span>
                Hit perfectly to isolate vocals, mute drums, or boost bass audio stems.
              </div>
              <div>
                <span className="text-[#FF003C] font-bold block mb-0.5">⚠ MINE HAZARDS:</span>
                DO NOT TOUCH MINE LANES! Avoid to prevent -500 penalty and combo breaks.
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
      >
        {/* HUD */}
        <div
          className="flex items-center justify-between px-4 py-2.5 flex-shrink-0 max-w-4xl w-full mx-auto"
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
              onClick={() => {
                audioManager.playSfx('menu_confirm', 0.15);
                if (phase === 'playing' && !paused) {
                  doPause();
                }
                useVaultStore.getState().setOptionsModalOpen(true);
              }}
              className="font-mono text-xs tracking-widest transition-colors cursor-pointer"
              style={{ color: "hsl(30 15% 28%)", letterSpacing: '0.1em' }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#E5B800")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "hsl(30 15% 28%)")}
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

          {/* Spacer to keep dial centered */}
          <div />

          {/* Right spacer with miss pips */}
          <div className="flex flex-col items-end justify-center min-w-[70px]">
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
          className="flex-shrink-0 mx-auto my-1.5 relative max-w-4xl w-[calc(100%-16px)]"
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
          {/* Circular Score Dial & Combo Overlays (PIM Style) */}
          {(() => {
            // Calculate active combo multiplier matching the game settings
            const c = gs.combo;
            let m = 1;
            if (c >= 100) m = 5;
            else if (c >= 75) m = 4;
            else if (c >= 50) m = 3;
            else if (c >= 25) m = 2;
            if (puRef.current.active) {
              m = m * (puRef.current.active === "SIGNAL_LOCK" ? 4 : puRef.current.active === "SURGE" ? 3 : 2);
            }


            return (
              <div
                className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none z-20"
                style={{
                  opacity: activePovMode === 'cyber_tunnel' ? 0.18 : 1,
                  transition: 'opacity 0.5s ease-in-out',
                }}
              >
                <style dangerouslySetInnerHTML={{ __html: `
                  @keyframes marquee-behind {
                    0% {
                      transform: translateX(110%);
                      opacity: 0;
                    }
                    12% {
                      opacity: 0.85;
                    }
                    88% {
                      opacity: 0.85;
                    }
                    100% {
                      transform: translateX(-110%);
                      opacity: 0;
                    }
                  }
                  .animate-marquee-behind {
                    animation: marquee-behind 4.5s linear infinite;
                  }
                `}} />

                {/* Scrolling Medal Name behind the dial */}
                {curMedal !== "NONE" && (
                  <div className="absolute top-[40px] left-1/2 -translate-x-1/2 w-[340px] h-12 overflow-hidden flex items-center justify-center z-[-1] pointer-events-none">
                    <span 
                      key={curMedal}
                      className="absolute font-mono text-[2.8rem] font-black uppercase tracking-[0.25em] text-transparent select-none whitespace-nowrap animate-marquee-behind"
                      style={{
                        WebkitTextStroke: `1px ${medalStyle.main}60`,
                        textShadow: `0 0 12px ${medalStyle.glow}`,
                      }}
                    >
                      {curMedal}
                    </span>
                  </div>
                )}

                {/* Top HUD Row: Main Circular Score Dial & Side Combo Circle HUD */}
                <div className="flex flex-row items-center justify-center gap-3 md:gap-4 lg:gap-5 relative">
                  {/* Circular Score Ring */}
                  <div className="relative w-32 h-32 md:w-36 md:h-36 lg:w-40 lg:h-40 rounded-full flex flex-col items-center justify-center shrink-0" style={{
                    background: "rgba(10, 10, 18, 0.94)",
                    border: `2px solid ${medalStyle.main}`,
                    boxShadow: `0 0 35px ${medalStyle.glow}, inset 0 0 15px rgba(255,255,255,0.03)`,
                    transition: "all 0.4s ease-in-out",
                  }}>
                    {/* SVG Stage Progress Ring */}
                    <svg viewBox="0 0 128 128" className="absolute inset-0 w-full h-full -rotate-90">
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        fill="none"
                        stroke="rgba(255, 255, 255, 0.06)"
                        strokeWidth="4"
                      />
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        fill="none"
                        stroke={medalStyle.main}
                        strokeWidth="4"
                        strokeDasharray={2 * Math.PI * 56}
                        strokeDashoffset={2 * Math.PI * 56 * (1 - (gs.progress || 0))}
                        strokeLinecap="round"
                        style={{ 
                          transition: "stroke-dashoffset 0.15s linear, stroke 0.4s ease-in-out",
                          filter: `drop-shadow(0 0 8px ${medalStyle.main})`
                        }}
                      />
                      {/* Dynamic Powerup Decaying Outer Ring */}
                      {activePu && (
                        <circle
                          cx="64"
                          cy="64"
                          r="60"
                          fill="none"
                          stroke={activePu.color}
                          strokeWidth="4"
                          strokeDasharray={2 * Math.PI * 60}
                          strokeDashoffset={2 * Math.PI * 60 * (1 - (activePu.progress ?? 0))}
                          strokeLinecap="round"
                          style={{
                            transition: "stroke-dashoffset 0.08s linear",
                            filter: `drop-shadow(0 0 12px ${activePu.color})`
                          }}
                        />
                      )}
                    </svg>

                    <span className="font-mono text-[8.5px] md:text-[9.5px] lg:text-[10.5px] tracking-[0.25em] text-zinc-400 font-black mb-1">
                      {currentStage === 5 ? "STAGE FINAL" : `STAGE ${currentStage}`}
                    </span>
                    <span className="font-mono text-2xl md:text-3xl lg:text-4xl font-black text-white tracking-tight" style={{ textShadow: "0 0 12px rgba(255,255,255,0.5)" }}>
                      <AnimatedScore score={gs.score} />
                    </span>
                    <span className={`font-mono text-[10.5px] md:text-[11.5px] lg:text-[12.5px] font-black mt-1 tracking-widest ${medalStyle.text}`} style={{ transition: "color 0.4s ease-in-out" }}>
                      ×{m}
                    </span>
                  </div>

                  {/* Dedicated Side Circular Combo HUD Ring */}
                  {opts.comboDisplay && (
                    <motion.div
                      key={gs.combo > 0 ? "active-combo" : "zero-combo"}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="relative w-20 h-20 md:w-24 md:h-24 lg:w-28 lg:h-28 rounded-full flex flex-col items-center justify-center shrink-0"
                      style={{
                        background: "rgba(10, 10, 18, 0.94)",
                        border: `2px solid ${gs.combo >= 100 ? '#39FF14' : gs.combo >= 50 ? '#FF1493' : gs.combo > 0 ? '#00E5FF' : 'rgba(255,255,255,0.18)'}`,
                        boxShadow: gs.combo > 0 
                          ? `0 0 25px ${gs.combo >= 100 ? 'rgba(57, 255, 20, 0.5)' : gs.combo >= 50 ? 'rgba(255, 20, 147, 0.5)' : 'rgba(0, 229, 255, 0.4)'}, inset 0 0 10px rgba(255,255,255,0.03)`
                          : '0 0 15px rgba(0,0,0,0.5)',
                        transition: "all 0.3s ease-in-out",
                      }}
                    >
                      {/* SVG Combo Circular Decay/Progress Ring */}
                      <svg viewBox="0 0 96 96" className="absolute inset-0 w-full h-full -rotate-90">
                        <circle
                          cx="48"
                          cy="48"
                          r="42"
                          fill="none"
                          stroke="rgba(255, 255, 255, 0.08)"
                          strokeWidth="3.5"
                        />
                        {gs.combo > 0 && (
                          <circle
                            cx="48"
                            cy="48"
                            r="42"
                            fill="none"
                            stroke={gs.combo >= 100 ? '#39FF14' : gs.combo >= 50 ? '#FF1493' : '#00E5FF'}
                            strokeWidth="3.5"
                            strokeDasharray={2 * Math.PI * 42}
                            strokeDashoffset={2 * Math.PI * 42 * (1 - Math.min(1, (gs.combo % 50) / 50))}
                            strokeLinecap="round"
                            style={{
                              transition: "stroke-dashoffset 0.1s linear, stroke 0.3s ease-in-out",
                              filter: `drop-shadow(0 0 6px ${gs.combo >= 100 ? '#39FF14' : gs.combo >= 50 ? '#FF1493' : '#00E5FF'})`
                            }}
                          />
                        )}
                      </svg>

                      <span className="font-mono text-[7.5px] md:text-[8.5px] lg:text-[9.5px] tracking-[0.2em] text-zinc-400 font-bold mb-0.5 uppercase">
                        COMBO
                      </span>
                      <motion.span
                        key={gs.combo}
                        initial={{ scale: 1.35 }}
                        animate={{ scale: 1.0 }}
                        transition={{ type: "spring", stiffness: 450, damping: 25 }}
                        className="font-mono text-lg md:text-xl lg:text-2xl font-black text-white tracking-tight"
                        style={{
                          textShadow: gs.combo > 0 ? `0 0 10px ${gs.combo >= 100 ? '#39FF14' : gs.combo >= 50 ? '#FF1493' : '#00E5FF'}` : 'none'
                        }}
                      >
                        {gs.combo}
                      </motion.span>
                    </motion.div>
                  )}
                </div>

                {/* Active Power-up dynamic tech pill */}
                {activePu && (
                  <motion.div
                    key={activePu.label}
                    initial={{ scale: 0.8, opacity: 0, y: -8 }}
                    animate={{ scale: 1.0, opacity: 1, y: 0 }}
                    className="mt-2 text-center font-mono text-[9px] md:text-[10px] lg:text-[11px] font-black px-4.5 py-0.5 rounded-full tracking-[0.18em] uppercase flex items-center justify-center gap-1.5 shadow-lg border"
                    style={{
                      background: "rgba(10, 10, 18, 0.96)",
                      borderColor: `${activePu.color}45`,
                      boxShadow: `0 0 20px ${activePu.color}35`,
                      color: activePu.color,
                    }}
                  >
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: activePu.color }} />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: activePu.color }} />
                    </span>
                    {activePu.label}
                  </motion.div>
                )}
              </div>
            );
          })()}

          {/* Stage Transition Alert Banner */}
          <AnimatePresence>
            {stageStingerNumber && (
              <div className="absolute inset-x-0 top-[32%] flex justify-center pointer-events-none z-30 overflow-visible">
                <motion.div
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  variants={{
                    animate: { transition: { staggerChildren: 0.1 } }
                  }}
                  className="relative flex flex-col items-center justify-center font-mono"
                >
                  {/* Glassmorphic Cyberpunk Backing Banner with Lightened Opacity Top & Bottom Gradient */}
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
                      background: `linear-gradient(180deg, ${colorWithAlpha(laneColorsRef.current[1], 0.15)} 0%, rgba(6, 6, 20, 0.62) 22%, rgba(6, 6, 20, 0.62) 78%, ${colorWithAlpha(laneColorsRef.current[1], 0.15)} 100%)`,
                      backdropFilter: "blur(10px)",
                      border: `2px solid ${colorWithAlpha(laneColorsRef.current[1], 0.7)}`, // Middle button color
                      borderLeft: `5px solid ${laneColorsRef.current[0]}`, // Left button color
                      borderRight: `5px solid ${laneColorsRef.current[2]}`, // Right button color
                      borderBottom: `4px solid ${colorWithAlpha(laneColorsRef.current[1], 0.8)}`,
                      boxShadow: `0 20px 50px rgba(0,0,0,0.7), 0 0 35px ${colorWithAlpha(laneColorsRef.current[1], 0.35)}`,
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
                        opacity: [0, 0.85, 0.85],
                        transition: { type: "spring", stiffness: 90, damping: 12, delay: 0.1 }
                      },
                      exit: { scale: 0.4, rotate: 360, opacity: 0, transition: { duration: 0.3 } }
                    }}
                    style={{
                      position: "absolute",
                      width: 220,
                      height: 220,
                      border: `2.5px solid ${colorWithAlpha(laneColorsRef.current[0], 0.75)}`, // Left button color
                      borderRadius: "24px", 
                      boxShadow: `0 0 25px ${colorWithAlpha(laneColorsRef.current[0], 0.4)}`,
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
                        opacity: [0, 0.85, 0.85],
                        transition: { type: "spring", stiffness: 100, damping: 10, delay: 0.2 }
                      },
                      exit: { scale: 1.8, rotate: -360, opacity: 0, transition: { duration: 0.3 } }
                    }}
                    style={{
                      position: "absolute",
                      width: 190,
                      height: 190,
                      borderRadius: "50%",
                      border: `2.5px dashed ${colorWithAlpha(laneColorsRef.current[2], 0.75)}`, // Right button color
                      boxShadow: `0 0 20px ${colorWithAlpha(laneColorsRef.current[2], 0.4)}`,
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
                      background: `linear-gradient(135deg, ${colorWithAlpha(laneColorsRef.current[0], 0.12)}, ${colorWithAlpha(laneColorsRef.current[2], 0.14)})`,
                      border: `2.5px solid ${colorWithAlpha(laneColorsRef.current[1], 0.6)}`,
                      boxShadow: `0 0 35px ${colorWithAlpha(laneColorsRef.current[1], 0.4)}`,
                      zIndex: 5,
                    }}
                  />

                  {/* Laser Scanline Sweep */}
                  <motion.div
                    variants={{
                      initial: { y: -80, opacity: 0 },
                      animate: { 
                        y: [-80, 80, -80],
                        opacity: [0, 0.95, 0.95, 0],
                        transition: { repeat: Infinity, duration: 2.0, ease: "linear" }
                      },
                      exit: { opacity: 0 }
                    }}
                    style={{
                      position: "absolute",
                      width: 170,
                      height: "3px",
                      background: `linear-gradient(90deg, transparent, ${laneColorsRef.current[0]}, ${laneColorsRef.current[1]}, ${laneColorsRef.current[2]}, transparent)`,
                      boxShadow: `0 0 15px ${laneColorsRef.current[1]}`,
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

                  {/* Giant Center Number or FINAL */}
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
                    {stageStingerPhase === 'cleared'
                      ? (stageStingerNumber! - 1 === 5 ? 'FINAL' : stageStingerNumber! - 1)
                      : (stageStingerNumber === 5 ? 'FINAL' : stageStingerNumber)}
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
                    {stageStingerPhase === 'cleared'
                      ? 'CLEARED!'
                      : stageStingerNumber >= 3
                        ? (stageStingerNumber === 3
                            ? ARCHETYPE_METAS[activeArchetype]?.stage3Title.replace('STAGE 3: ', '')
                            : stageStingerNumber === 4
                              ? ARCHETYPE_METAS[activeArchetype]?.stage4Title.replace('STAGE 4: ', '')
                              : ARCHETYPE_METAS[activeArchetype]?.stage5Title.replace('STAGE 5: ', ''))
                        : 'GO!'}
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

          {/* Initial Buffering indicator over live rolling canvas */}
          {phase === "buffering" && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none z-30"
              style={{ background: "rgba(8,8,18,0.4)", backdropFilter: "blur(2px)" }}
            >
              <div
                className="font-mono text-xs tracking-[0.3em] font-bold"
                style={{ color: "#39FF14", textShadow: "0 0 12px rgba(57,255,20,0.6)" }}
              >
                {loadMsg || "STREAMING AUDIO STEMS..."}
              </div>
            </div>
          )}

          {/* Judgment text — per-lane custom vector SVG popups anchored at judgment target strike zones */}
          {opts.judgmentText && displayJudge.map((j) => {
            if (Date.now() - j.ts > 600) return null;
            const canvasW = canvasRef.current?.width ? canvasRef.current.width / (window.devicePixelRatio || 1) : 0;
            if (!canvasW) return null;
            const hwBot = hwAtProgress(1, canvasW);
            const laneW = hwBot.width / LANE_COUNT;
            const targetX = hwBot.left + (j.lane + 0.5) * laneW;
            const targetPct = (targetX / canvasW) * 100;
            return (
              <div
                key={j.id}
                className="absolute pointer-events-none judgment-pop"
                style={{
                  left: `${targetPct}%`,
                  top: "73%",
                  transform: "translateX(-50%)",
                }}
              >
                <JudgmentBadge type={j.type} scale={j.type === "PERFECT+" ? 1.05 : 0.9} />
              </div>
            );
          })}

          {/* Secondary judgment banner — top of screen, custom vector SVG badge */}
          {opts.judgmentText && (() => {
            const latest = displayJudge.filter(j => Date.now() - j.ts < 400).sort((a, b) => b.ts - a.ts)[0];
            if (!latest) return null;
            const age = (Date.now() - latest.ts) / 400;
            return (
              <div
                className="absolute left-1/2 pointer-events-none"
                style={{
                  top: "23%",
                  transform: `translateX(-50%) scale(${1 + (1 - age) * 0.18})`,
                  opacity: 1 - age * 0.6,
                  transition: "opacity 0.1s",
                }}
              >
                <JudgmentBadge type={latest.type} scale={latest.type === "PERFECT+" ? 1.35 : 1.15} />
              </div>
            );
          })()}

          {/* Comprehensive Transmission Loading HUD */}
          {(phase === "loading" || phase === "buffering") && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center p-4 sm:p-6 z-[90] overflow-y-auto"
              style={{
                background: "radial-gradient(ellipse 80% 80% at 50% 50%, rgba(14,14,26,0.96) 0%, rgba(6,6,12,0.98) 100%)",
                backdropFilter: "blur(16px)",
              }}
            >
              {/* Transmission Signal Header */}
              <div className="w-full max-w-lg flex items-center justify-between mb-4 border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </span>
                  <span className="font-mono text-[11px] font-bold tracking-[0.25em] text-emerald-400 uppercase">
                    📡 TRANSMISSION RECEIVER ONLINE
                  </span>
                </div>
                <div className="font-mono text-[10px] tracking-widest px-2.5 py-1 rounded bg-white/5 border border-white/10 text-white/70 uppercase">
                  STEP {loadState.step} / 5
                </div>
              </div>

              {/* Song Card */}
              {song && (
                <div className="w-full max-w-lg glass-panel p-4 mb-4 rounded-xl border border-white/10 flex items-center gap-4 bg-black/40">
                  {song.coverArt ? (
                    <img
                      src={song.coverArt}
                      alt={song.title}
                      className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-lg border border-white/15 shadow-lg flex-shrink-0 animate-pulse"
                    />
                  ) : (
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg bg-zinc-800 border border-white/10 flex items-center justify-center text-white/30 flex-shrink-0">
                      <TransmissionIcon size={28} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-[10px] tracking-widest text-[#FF1493] font-bold uppercase mb-0.5">
                      SIGNAL: TRANSMISSION #{song.day || songId}
                    </div>
                    <h3 className="font-mono font-black text-base sm:text-lg text-white truncate leading-tight">
                      {song.title}
                    </h3>
                    <div className="font-mono text-[11px] text-white/50 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                      <span>{song.bpm || 120} BPM</span>
                      <span>•</span>
                      <span>{song.notes?.length || 0} NOTES</span>
                      {song.difficultyLevel && (
                        <>
                          <span>•</span>
                          <span className="text-amber-400 font-bold">DIFF {song.difficultyLevel}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Current Step Label & Main Progress Bar */}
              <div className="w-full max-w-lg mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="font-mono text-xs font-bold tracking-wider text-cyan-300 uppercase flex items-center gap-2">
                    <span>✦ {loadState.stepLabel}</span>
                  </div>
                  <div className="font-mono text-sm font-black text-cyan-400">
                    {loadState.pct}%
                  </div>
                </div>

                {/* Main Dual-Layer Progress Bar */}
                <div className="relative w-full h-3.5 bg-black/60 rounded-full overflow-hidden border border-white/15 p-0.5 shadow-inner">
                  <div
                    className="h-full rounded-full transition-all duration-200 bg-gradient-to-r from-emerald-400 via-cyan-400 to-[#FF1493] shadow-[0_0_12px_rgba(0,240,255,0.6)]"
                    style={{ width: `${Math.max(3, loadState.pct)}%` }}
                  />
                </div>

                <div className="font-mono text-[11px] text-white/60 mt-1.5 truncate">
                  {loadState.detailMsg || loadMsg}
                </div>
              </div>

              {/* Detailed Metrics 4-Grid */}
              <div className="w-full max-w-lg grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                {/* Metric 1: Downloaded / Total */}
                <div className="glass-panel p-2.5 rounded-lg border border-white/10 bg-white/[0.02]">
                  <div className="font-mono text-[9px] text-white/40 tracking-wider uppercase mb-1">
                    DOWNLOADED
                  </div>
                  <div className="font-mono text-xs font-bold text-white truncate">
                    {formatLoadBytes(loadState.bytesLoaded)}
                    {loadState.bytesTotal > 0 && (
                      <span className="text-[10px] text-white/40 font-normal block truncate">
                        / {formatLoadBytes(loadState.bytesTotal)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Metric 2: Download Left */}
                <div className="glass-panel p-2.5 rounded-lg border border-white/10 bg-white/[0.02]">
                  <div className="font-mono text-[9px] text-white/40 tracking-wider uppercase mb-1">
                    DATA LEFT
                  </div>
                  <div className="font-mono text-xs font-bold text-amber-300 truncate">
                    {loadState.bytesTotal > 0 && loadState.bytesLoaded > 0 ? (
                      formatLoadBytes(Math.max(0, loadState.bytesTotal - loadState.bytesLoaded))
                    ) : (
                      <span className="text-white/40">--</span>
                    )}
                  </div>
                </div>

                {/* Metric 3: Download Speed */}
                <div className="glass-panel p-2.5 rounded-lg border border-white/10 bg-white/[0.02]">
                  <div className="font-mono text-[9px] text-white/40 tracking-wider uppercase mb-1">
                    SPEED
                  </div>
                  <div className="font-mono text-xs font-bold text-emerald-400 truncate">
                    {formatLoadSpeed(loadState.speedBps)}
                  </div>
                </div>

                {/* Metric 4: EST. Time */}
                <div className="glass-panel p-2.5 rounded-lg border border-white/10 bg-white/[0.02]">
                  <div className="font-mono text-[9px] text-white/40 tracking-wider uppercase mb-1">
                    EST. TIME
                  </div>
                  <div className="font-mono text-xs font-bold text-cyan-300 truncate">
                    {formatLoadEta(loadState.etaSeconds)}
                  </div>
                </div>
              </div>

              {/* Live Diagnostic Terminal Ticker */}
              <div className="w-full max-w-lg glass-panel p-3 rounded-lg border border-white/10 bg-black/60 font-mono text-[10px] leading-relaxed">
                <div className="text-white/30 uppercase tracking-widest text-[9px] mb-1 flex items-center justify-between border-b border-white/5 pb-1">
                  <span>ENGINE DIAGNOSTIC FEED</span>
                  <span className="text-emerald-400 font-bold">LIVE</span>
                </div>
                <div className="space-y-0.5 text-white/70">
                  {loadState.logs.length > 0 ? (
                    loadState.logs.slice(-3).map((log, idx) => (
                      <div key={idx} className="truncate">
                        <span className="text-cyan-400 font-bold">&gt;</span> {log}
                      </div>
                    ))
                  ) : (
                    <div className="text-white/30 italic">&gt; Initializing signal telemetry...</div>
                  )}
                </div>
              </div>

              {/* Connectivity Safeguard Button */}
              {loadState.step === 4 && (
                <div className="mt-3 w-full max-w-lg flex justify-center">
                  <button
                    onClick={() => {
                      setPhase("loading");
                      setRetryCount((prev) => prev + 1);
                    }}
                    className="px-3.5 py-1.5 font-mono text-[10px] tracking-widest text-white/50 hover:text-white bg-white/5 hover:bg-white/15 border border-white/10 rounded-md transition-all cursor-pointer uppercase flex items-center gap-2"
                  >
                    <span>↺ STUCK OR SLOW? FORCE RETRY TRANSMISSION</span>
                  </button>
                </div>
              )}
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
                        laneColorsRef.current,
                        optsRef.current.gameTrack
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

          {/* Countdown: TRANSMISSION INCOMING -> ARE YOU READY??! -> GO! */}
          {phase === "countdown" && (() => {
            const songTheme = getSongIntroTheme(laneColorsRef.current);
            return (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-40 overflow-hidden"
                style={{
                  background: "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(14,16,40,0.55) 0%, rgba(8,8,18,0.75) 80%)",
                  backdropFilter: "blur(3px)",
                }}
              >
                {countdown === 2 && (
                  <div className="flex flex-col items-center justify-center px-4">
                    <div
                      className="font-mono font-black text-center tracking-[0.35em] uppercase text-xs md:text-sm mb-3 flex items-center justify-center gap-2.5"
                      style={{ color: songTheme.subLabelColor, textShadow: songTheme.subLabelGlow }}
                    >
                      <TransmissionIcon size={20} className="animate-pulse" color={songTheme.subLabelColor} />
                      <span>INCOMING SIGNAL</span>
                      <TransmissionIcon size={20} className="animate-pulse" color={songTheme.subLabelColor} />
                    </div>
                    <div
                      className="font-mono font-black text-center tracking-tight text-3xl sm:text-5xl md:text-6xl lg:text-7xl"
                      style={{
                        lineHeight: 1.1,
                        background: songTheme.titleGradient,
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        filter: songTheme.titleFilter,
                        fontFamily: '"Impact", "Arial Black", sans-serif',
                      }}
                    >
                      TRANSMISSION INCOMING
                    </div>
                  </div>
                )}

                {countdown === 1 && (
                  <div className="flex flex-col items-center justify-center px-4">
                    <div
                      className="font-mono font-black text-center tracking-[0.35em] uppercase text-xs md:text-sm mb-3"
                      style={{ color: songTheme.subLabelColor, textShadow: songTheme.subLabelGlow }}
                    >
                      ✦ PREPARE FOR HIGHWAY ✦
                    </div>
                    <div
                      className="font-mono font-black text-center tracking-tight text-3xl sm:text-5xl md:text-6xl lg:text-7xl"
                      style={{
                        lineHeight: 1.1,
                        background: songTheme.titleGradient,
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        filter: songTheme.titleFilter,
                        fontFamily: '"Impact", "Arial Black", sans-serif',
                      }}
                    >
                      ARE YOU READY??!
                    </div>
                  </div>
                )}

                {countdown === 0 && (
                  <div
                    className="font-mono font-black text-center text-7xl sm:text-8xl md:text-9xl lg:text-[140px]"
                    style={{
                      lineHeight: 1,
                      background: songTheme.goGradient,
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      filter: songTheme.goFilter,
                      fontFamily: '"Impact", "Arial Black", sans-serif',
                    }}
                  >
                    GO!
                  </div>
                )}
              </div>
            );
          })()}

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

          {/* Frame-Perfect 100% PERFECT+ Video Export Modal */}
          <VideoExportModal
            isOpen={isExportModalOpen}
            isRecording={isRecordingVideo}
            recordingProgress={recordingProgress}
            frameCount={frameCount}
            videoUrl={videoUrl}
            videoBlob={videoBlob}
            mimeType={videoMimeType}
            songTitle={song?.title || "Transmission"}
            songArtist={song?.artist || "PIM Artist"}
            onClose={() => {
              setIsExportModalOpen(false);
              sessionStorage.removeItem(`export_video_${songId}`);
              if (isTutorial) {
                setLocation(`/tutorial?phase=results&score=${gs.score}`);
              } else {
                setLocation(`/results/${songId}`);
              }
            }}
          />

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
  rawNoteX: number,
  rawNoteY: number,
  rawNoteW: number,
  rawNoteH: number,
  rawR: number,
  lc: string,
  prog: number,
  isHold: boolean,
  swipeDirection?: Note['swipeDirection'],
  timeOffset: number = 0,
  noteType?: NoteType
) {
  const noteW = Number.isFinite(rawNoteW) && rawNoteW > 0 ? rawNoteW : 60;
  const noteH = Number.isFinite(rawNoteH) && rawNoteH > 0 ? rawNoteH : 40;
  const noteX = Number.isFinite(rawNoteX) ? rawNoteX : 0;
  const noteY = Number.isFinite(rawNoteY) ? rawNoteY : 0;
  const r = Number.isFinite(rawR) ? rawR : 12;

  const centerX = noteX + noteW / 2;
  const centerY = noteY;

  ctx.save();
  ctx.translate(centerX, centerY);

  // ── 0. SPECIAL CUSTOM GEOMETRY FOR MINE HAZARD NOTES ──
  if (noteType === 'mine') {
    const timeNow = Date.now() + timeOffset;
    const pulse = 1.0 + 0.15 * Math.sin(timeNow / 90);
    const mSize = Math.min(noteW * 0.45, noteH * 0.75) * pulse;

    // Spiked Octagon Hazard Orb
    ctx.save();
    ctx.shadowColor = "#FF003C";
    ctx.shadowBlur = lerp(18, 38, prog);

    // Dark danger core gradient — richer with more depth
    const mineGrad = ctx.createRadialGradient(0, 0, 1, 0, 0, mSize);
    mineGrad.addColorStop(0, "#FF4D6D");
    mineGrad.addColorStop(0.15, "#FF1A40");
    mineGrad.addColorStop(0.4, "#B91C1C");
    mineGrad.addColorStop(0.65, "#800014");
    mineGrad.addColorStop(0.85, "#2B0007");
    mineGrad.addColorStop(1, "#0D0002");
    ctx.fillStyle = mineGrad;

    // Octagonal path with corner spikes
    ctx.beginPath();
    const sides = 8;
    for (let i = 0; i < sides; i++) {
      const a = (i * Math.PI * 2) / sides + (timeNow / 1200);
      const dist = (i % 2 === 0 ? mSize : mSize * 0.78);
      const px = Math.cos(a) * dist;
      const py = Math.sin(a) * dist;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    // High contrast neon danger border
    ctx.strokeStyle = "#FF003C";
    ctx.lineWidth = 3.0;
    ctx.stroke();

    // Inner yellow/black hazard warning stripes ring
    ctx.save();
    ctx.clip();
    const ringRadius = mSize * 0.65;
    ctx.strokeStyle = "#FACC15";
    ctx.lineWidth = 4;
    ctx.setLineDash([6, 6]);
    ctx.lineDashOffset = -(timeNow / 30) % 12;
    ctx.beginPath();
    ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // ☠ SKULL CENTER EMBLEM with pulsing glow
    ctx.save();
    const skullPulse = 1.0 + 0.12 * Math.sin(timeNow / 100);
    ctx.shadowColor = '#FF003C';
    ctx.shadowBlur = 14 * skullPulse;
    ctx.fillStyle = '#FCA5A5';
    ctx.font = `900 ${Math.round(mSize * 0.72)}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('☠', 0, -1);
    ctx.restore();

    // Danger pill badge below skull
    ctx.save();
    const pillW = mSize * 1.1;
    const pillH = mSize * 0.38;
    ctx.fillStyle = 'rgba(127, 29, 29, 0.9)';
    ctx.beginPath();
    ctx.roundRect(-pillW / 2, mSize * 0.32, pillW, pillH, pillH / 2);
    ctx.fill();
    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = '#EF4444';
    ctx.shadowBlur = 8;
    ctx.stroke();

    ctx.fillStyle = '#FCA5A5';
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.font = `900 ${Math.round(mSize * 0.26)}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('AVOID', 0, mSize * 0.32 + pillH / 2);
    ctx.restore();

    ctx.restore();
    ctx.restore();
    return;
  }

  // ── Rotations for Swipes ──
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

  const isHoldHead = noteType === 'hold' || noteType === 'hold-swipe';
  const m = (swipeDirection && !isHold && !isHoldHead && noteType !== 'lift') ? 1.0 : 0;

  if (swipeDirection && m > 0) {
    ctx.rotate(rotations[swipeDirection] || 0);
  }

  // ── 1. Define Key Body Path ──
  ctx.beginPath();
  if (m > 0) {
    const w = noteW / 2;
    const h = noteH / 2;
    const br = lerp(r, 8, m);
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

  // ── 2. Render Body Fill (Customized per note type) ──
  if (isHold) {
    const stageColor = lc || "#FFD700";
    const goldGrad = ctx.createLinearGradient(0, -noteH / 2, 0, noteH / 2);
    goldGrad.addColorStop(0, "#FFF7ED");
    goldGrad.addColorStop(0.2, "#FFD700");
    goldGrad.addColorStop(0.6, stageColor);
    goldGrad.addColorStop(1, "#3B0764");
    ctx.fillStyle = goldGrad;
    ctx.shadowColor = stageColor;
    ctx.shadowBlur = lerp(4, 12, prog);
    ctx.shadowOffsetY = 0;
  } else if (noteType === 'remix') {
    // Cyberpunk Prismatic Body — Electric Cyan to Deep Magenta
    ctx.shadowColor = "#00F5D4";
    ctx.shadowBlur = lerp(6, 14, prog);
    ctx.shadowOffsetY = lerp(2, 6, prog);
    const remixGrad = ctx.createLinearGradient(0, -noteH / 2, 0, noteH / 2);
    remixGrad.addColorStop(0, "#A5F3FC");
    remixGrad.addColorStop(0.3, "#00F5D4");
    remixGrad.addColorStop(0.7, "#FF007F");
    remixGrad.addColorStop(1, "#3b0764");
    ctx.fillStyle = remixGrad;
  } else if (noteType === 'break') {
    // High-Voltage Flame Armored Body — Gold to Orange
    ctx.shadowColor = "#FF7B00";
    ctx.shadowBlur = lerp(6, 14, prog);
    ctx.shadowOffsetY = lerp(2, 6, prog);
    const breakGrad = ctx.createLinearGradient(0, -noteH / 2, 0, noteH / 2);
    breakGrad.addColorStop(0, "#FFF7ED");
    breakGrad.addColorStop(0.25, "#FFD700");
    breakGrad.addColorStop(0.7, "#FF7B00");
    breakGrad.addColorStop(1, "#7C2D12");
    ctx.fillStyle = breakGrad;
  } else if (noteType === 'accent') {
    // Emerald / Acid Lime Crystalline Body — Bright Lime
    ctx.shadowColor = "#CCFF00";
    ctx.shadowBlur = lerp(6, 14, prog);
    ctx.shadowOffsetY = lerp(2, 6, prog);
    const accentGrad = ctx.createLinearGradient(0, -noteH / 2, 0, noteH / 2);
    accentGrad.addColorStop(0, "#F7FEE7");
    accentGrad.addColorStop(0.3, "#CCFF00");
    accentGrad.addColorStop(0.7, "#15803D");
    accentGrad.addColorStop(1, "#022C22");
    ctx.fillStyle = accentGrad;
  } else if (noteType === 'lift') {
    // Spring Green Body — Bright Mint
    ctx.shadowColor = "#00FF88";
    ctx.shadowBlur = lerp(6, 14, prog);
    ctx.shadowOffsetY = lerp(2, 6, prog);
    const liftGrad = ctx.createLinearGradient(0, -noteH / 2, 0, noteH / 2);
    liftGrad.addColorStop(0, "#ECFDF5");
    liftGrad.addColorStop(0.3, "#00FF88");
    liftGrad.addColorStop(0.7, "#047857");
    liftGrad.addColorStop(1, "#022C22");
    ctx.fillStyle = liftGrad;
  } else if (noteType === 'zigzag') {
    // Snaking Neon Violet Body — Deep Purple to Bright Magenta
    ctx.shadowColor = "#A855F7";
    ctx.shadowBlur = lerp(6, 14, prog);
    ctx.shadowOffsetY = lerp(2, 6, prog);
    const zigzagGrad = ctx.createLinearGradient(-noteW / 2, 0, noteW / 2, 0);
    zigzagGrad.addColorStop(0, "#F0ABFC");
    zigzagGrad.addColorStop(0.3, "#C084FC");
    zigzagGrad.addColorStop(0.7, "#A855F7");
    zigzagGrad.addColorStop(1, "#581C87");
    ctx.fillStyle = zigzagGrad;
  } else if (noteType === 'burst') {
    // Expanding Radiant Pulse Body — Vivid Crimson/Orange
    ctx.shadowColor = "#FF5500";
    ctx.shadowBlur = lerp(6, 14, prog);
    ctx.shadowOffsetY = lerp(2, 6, prog);
    const burstGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, noteW / 2);
    burstGrad.addColorStop(0, "#FFFBEB");
    burstGrad.addColorStop(0.4, "#FF5500");
    burstGrad.addColorStop(0.8, "#DC2626");
    burstGrad.addColorStop(1, "#7F1D1D");
    ctx.fillStyle = burstGrad;
  } else if (noteType === 'ghost') {
    // 👻 GHOST NOTE: Semi-transparent Flickering Body — DO NOT TAP
    const ghostFlicker = 0.2 + 0.15 * Math.sin(Date.now() / 80); // Rapid shimmer
    ctx.globalAlpha = ghostFlicker;
    ctx.shadowColor = "rgba(148, 163, 184, 0.3)";
    ctx.shadowBlur = lerp(4, 8, prog);
    const ghostGrad = ctx.createLinearGradient(0, -noteH / 2, 0, noteH / 2);
    ghostGrad.addColorStop(0, "rgba(226, 232, 240, 0.4)");
    ghostGrad.addColorStop(0.5, "rgba(148, 163, 184, 0.3)");
    ghostGrad.addColorStop(1, "rgba(71, 85, 105, 0.2)");
    ctx.fillStyle = ghostGrad;
  } else {
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = lerp(3, 8, prog);
    ctx.shadowOffsetY = lerp(2, 6, prog);
    const bodyGrad = ctx.createLinearGradient(0, -noteH / 2, 0, noteH / 2);
    bodyGrad.addColorStop(0, "#1c1c1f");
    bodyGrad.addColorStop(0.35, "#0e0e11");
    bodyGrad.addColorStop(0.85, "#08080a");
    bodyGrad.addColorStop(1, "#030304");
    ctx.fillStyle = bodyGrad;
  }
  ctx.fill();

  // ── 2b. Sweeping Glass Sheen ──
  ctx.save();
  ctx.clip();
  const now = Date.now() + timeOffset;
  const sheenProgress = (now % 2200) / 2200;
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

  // ── 3. Edge Border Styling ──
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  if (isHold) {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.95)"; ctx.lineWidth = 3.5; ctx.stroke();
    ctx.strokeStyle = "#D4AF37"; ctx.lineWidth = 2.0; ctx.stroke();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.95)"; ctx.lineWidth = 0.8; ctx.stroke();
  } else if (noteType === 'remix') {
    ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = 3.0; ctx.stroke();
    ctx.strokeStyle = "#00F5D4"; ctx.lineWidth = 1.5; ctx.stroke();
  } else if (noteType === 'break') {
    ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = 3.0; ctx.stroke();
    ctx.strokeStyle = "#FFD700"; ctx.lineWidth = 1.5; ctx.stroke();
  } else if (noteType === 'accent') {
    ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = 3.0; ctx.stroke();
    ctx.strokeStyle = "#CCFF00"; ctx.lineWidth = 1.5; ctx.stroke();
  } else if (noteType === 'lift') {
    ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = 3.0; ctx.stroke();
    ctx.strokeStyle = "#00FF88"; ctx.lineWidth = 1.5; ctx.stroke();
  } else {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.35)"; ctx.lineWidth = 1.25; ctx.stroke();
  }

  if (isHold) {
    // ── 4. WHITE CORE DOT OR ARROW FOR HOLD TERMINUS ──
    ctx.fillStyle = "#FFFFFF";
    ctx.shadowColor = "#FFFFFF";
    ctx.shadowBlur = 12;
    ctx.globalAlpha = 0.95;
    ctx.beginPath();
    if (swipeDirection) {
      const sw = noteW * 0.22;
      const sh = noteH * 0.25;
      const rot = rotations[swipeDirection] || 0;
      ctx.save();
      ctx.rotate(rot);
      ctx.moveTo(sw, 0);
      ctx.lineTo(-sw, -sh);
      ctx.lineTo(-sw * 0.4, 0);
      ctx.lineTo(-sw, sh);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else {
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    const pulseR = 8 + 3 * Math.sin(Date.now() / 120);
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.85 - (pulseR - 8) / 6})`;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(0, 0, pulseR, 0, Math.PI * 2);
    ctx.stroke();
  } else if (noteType !== 'ghost') {
    // ── 4. COLORED CENTER STRIPE ── (skipped for ghost notes to preserve transparency)
    const stripeColor = noteType === 'remix' ? '#00F5D4' 
                      : noteType === 'break' ? '#FF7B00' 
                      : noteType === 'accent' ? '#CCFF00' 
                      : noteType === 'lift' ? '#00FF88' 
                      : lc;
    const stripeH = Math.max(14, noteH * 0.28);
    ctx.shadowColor = stripeColor;
    ctx.shadowBlur = lerp(12, 28, prog);
    ctx.fillStyle = stripeColor;
    ctx.globalAlpha = 0.95;

    if (swipeDirection && isHoldHead) {
      // ── SLEEK AERODYNAMIC DOUBLE-CHEVRON ARROW FOR HOLD SWIPE HEADS ──
      ctx.save();
      const rot = rotations[swipeDirection] || 0;
      ctx.rotate(rot);

      const arrowScale = Math.min(noteW * 0.28, noteH * 0.35);
      
      // Dual nested glowing chevrons
      for (let c = 0; c < 2; c++) {
        const offset = (c - 0.5) * (arrowScale * 0.55);
        const alpha = c === 0 ? 1.0 : 0.65;
        ctx.globalAlpha = alpha;

        // Outer glow path
        ctx.shadowColor = lc || '#FFD700';
        ctx.shadowBlur = lerp(10, 22, prog);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = Math.max(2.5, arrowScale * 0.18);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        ctx.moveTo(offset - arrowScale * 0.5, -arrowScale * 0.6);
        ctx.lineTo(offset + arrowScale * 0.4, 0);
        ctx.lineTo(offset - arrowScale * 0.5, arrowScale * 0.6);
        ctx.stroke();

        // Inner neon core accent
        ctx.strokeStyle = lc || '#FFD700';
        ctx.lineWidth = Math.max(1.2, arrowScale * 0.08);
        ctx.stroke();
      }
      ctx.restore();
    } else if (swipeDirection && noteType === 'swipe') {
      // ── WHITE CENTER LINE WITH ROUNDED ARROW TIP & FOLD-CONSTRAINED BOUNDS ──
      ctx.save();

      // Constrain stripe height so it stays strictly within key body fold boundaries
      const swH = Math.min(stripeH * 0.85, noteH * 0.26);
      const halfH = swH / 2;
      const leftX = -noteW / 2 + 6;
      const rightX = noteW / 2 - 8;
      const taperLen = swH * 1.0;
      const tipRadius = Math.max(3.5, swH * 0.28);

      // 1. Outer Colored Glow Arrow Stripe Bar (Smooth Rounded Arrow Tip)
      ctx.shadowColor = stripeColor;
      ctx.shadowBlur = lerp(16, 32, prog);
      ctx.fillStyle = stripeColor;
      ctx.beginPath();
      ctx.moveTo(leftX + 4, -halfH);
      ctx.lineTo(rightX - taperLen, -halfH);
      ctx.arcTo(rightX, 0, rightX - taperLen, halfH, tipRadius); // Smooth Rounded Arrow Tip
      ctx.lineTo(rightX - taperLen, halfH);
      ctx.lineTo(leftX + 4, halfH);
      ctx.lineTo(leftX + halfH * 0.6, 0); // Rear Aerodynamic Notch
      ctx.closePath();
      ctx.fill();

      // 2. Crisp White Center Line Track (Smooth Rounded White Arrow Tip)
      const whiteH = swH * 0.46;
      const wHalfH = whiteH / 2;
      const wLeftX = leftX + 4;
      const wRightX = rightX - 3;
      const wTaperLen = whiteH * 1.0;
      const wTipRadius = Math.max(2.0, whiteH * 0.25);

      ctx.fillStyle = '#FFFFFF';
      ctx.shadowColor = '#FFFFFF';
      ctx.shadowBlur = 8;
      ctx.globalAlpha = 0.95;
      ctx.beginPath();
      ctx.moveTo(wLeftX + 3, -wHalfH);
      ctx.lineTo(wRightX - wTaperLen, -wHalfH);
      ctx.arcTo(wRightX, 0, wRightX - wTaperLen, wHalfH, wTipRadius); // Smooth Rounded White Arrow Tip
      ctx.lineTo(wRightX - wTaperLen, wHalfH);
      ctx.lineTo(wLeftX + 3, wHalfH);
      ctx.lineTo(wLeftX + wHalfH * 0.6, 0); // Rear White Notch
      ctx.closePath();
      ctx.fill();

      // 3. Animated Marching Chevrons Inside the White Arrow Track
      const animT = (Date.now() + timeOffset) / 1000;
      const chevCount = 4;
      const chevW = Math.min(noteW * 0.13, 10);
      const chevH = Math.min(whiteH * 0.85, 11);
      const totalSpan = (wRightX - wTaperLen * 0.5) - wLeftX;
      const spacing = totalSpan / chevCount;
      const scrollOffset = (animT * 2.8) % 1.0;

      for (let i = 0; i < chevCount; i++) {
        const rawX = wLeftX + (i + scrollOffset) * spacing;
        if (rawX > wRightX - 3) continue;

        const normPos = (rawX - wLeftX) / totalSpan;
        const baseAlpha = 0.35 + normPos * 0.65;
        const pulse = 0.85 + 0.15 * Math.sin(animT * 6.0 + i * 1.2);
        const alpha = baseAlpha * pulse;

        const sizeScale = 0.75 + normPos * 0.25;
        const cw = chevW * sizeScale;
        const ch = chevH * sizeScale;

        ctx.globalAlpha = alpha;

        // Chevron Path
        ctx.beginPath();
        ctx.moveTo(rawX - cw * 0.5, -ch * 0.5);
        ctx.lineTo(rawX + cw * 0.5, 0);
        ctx.lineTo(rawX - cw * 0.5, ch * 0.5);

        // Layer A: Vivid neon colored glow stroke matching lane/stripe color
        ctx.strokeStyle = stripeColor;
        ctx.shadowColor = stripeColor;
        ctx.shadowBlur = lerp(8, 16, prog) * pulse;
        ctx.lineWidth = Math.max(3.0, cw * 0.28);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

        // Layer B: Dark contrast outline for crisp legibility over the white center line
        ctx.strokeStyle = '#0F172A';
        ctx.shadowBlur = 0;
        ctx.lineWidth = Math.max(1.6, cw * 0.15);
        ctx.stroke();

        // Layer C: Vibrant neon core stroke
        ctx.strokeStyle = stripeColor;
        ctx.lineWidth = Math.max(0.8, cw * 0.08);
        ctx.stroke();
      }
      ctx.globalAlpha = 1.0;
      ctx.restore();
    } else {
      // ── BOLD WHITE CENTER LINE WITH OUTER COLOR GLOW FOR NORMAL NOTES ──
      // 1. Outer Colored Glow Stripe Bar
      ctx.shadowColor = stripeColor;
      ctx.shadowBlur = lerp(16, 32, prog);
      ctx.fillStyle = stripeColor;
      ctx.beginPath();
      ctx.roundRect(-noteW / 2 + 2, -stripeH / 2, noteW - 4, stripeH, stripeH * 0.4);
      ctx.fill();

      // 2. Crisp White Center Line Track matching swipe notes
      ctx.fillStyle = '#FFFFFF';
      ctx.shadowColor = '#FFFFFF';
      ctx.shadowBlur = 8;
      ctx.globalAlpha = 0.95;
      ctx.beginPath();
      ctx.roundRect(-noteW / 2 + 8, -stripeH * 0.42 / 2, noteW - 16, stripeH * 0.42, stripeH * 0.21);
      ctx.fill();
      ctx.globalAlpha = 1.0;
    }
  }

  // ── 5. SPECIAL HIGH-VISIBILITY ICON EMBLEMS & ANIMATIONS ──
  const nowMs = Date.now() + timeOffset;

  if (noteType === 'remix') {
    // 🎛 REMIX NOTE: Rotating EQ Spectrum Ring + Hologram Badge
    ctx.save();
    const ringRadius = Math.max(noteW, noteH) * 0.52;
    const eqAngle = (nowMs / 300) % (Math.PI * 2);

    // Dark pill container for contrast
    ctx.fillStyle = 'rgba(3, 7, 18, 0.75)';
    ctx.beginPath();
    ctx.roundRect(-22, -10, 44, 20, 10);
    ctx.fill();
    ctx.strokeStyle = '#00F5D4';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Text emblem
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = '#00F5D4';
    ctx.shadowBlur = 10;
    ctx.font = '900 9px "Space Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🎛 REMIX', 0, 0);
    ctx.restore();

  } else if (noteType === 'break') {
    // ⚡ BREAK NOTE: Heavy Voltage Lightning Emblem + Crashing Aura
    ctx.save();
    const pulse = 1.0 + 0.12 * Math.sin(nowMs / 90);
    
    // Dark pill container for high contrast
    ctx.fillStyle = 'rgba(28, 25, 23, 0.85)';
    ctx.beginPath();
    ctx.roundRect(-24, -10, 48, 20, 10);
    ctx.fill();
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Glowing central text / badge
    ctx.fillStyle = '#FFD700';
    ctx.shadowColor = '#FF7B00';
    ctx.shadowBlur = 12;
    ctx.font = '900 10px "Space Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚡ DROP', 0, 0);

    // Electric aura shockwave ring
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.8)';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.arc(0, 0, (noteW / 2 + 4) * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

  } else if (noteType === 'accent') {
    // ✦ ACCENT NOTE: Diamond Flare Starburst
    ctx.save();
    const starPulse = 1.0 + 0.18 * Math.sin(nowMs / 100);
    ctx.shadowColor = '#CCFF00';
    ctx.shadowBlur = 20;

    // Dark pill container
    ctx.fillStyle = 'rgba(2, 44, 34, 0.85)';
    ctx.beginPath();
    ctx.roundRect(-22, -10, 44, 20, 10);
    ctx.fill();
    ctx.strokeStyle = '#CCFF00';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✦ BEAT', 0, 0);
    ctx.restore();

  } else if (noteType === 'lift' && (!swipeDirection || swipeDirection === 'up')) {
    // ▲ LIFT NOTE: Upward Animated Chevrons Cueing Flick
    ctx.save();
    ctx.strokeStyle = '#FFFFFF';
    ctx.shadowColor = '#00FF88';
    ctx.shadowBlur = 16;
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const animOffset = (nowMs / 14) % 16;

    for (let i = 0; i < 2; i++) {
      const yPos = 4 - i * 10 + (8 - animOffset * 0.5);
      const alpha = Math.max(0.3, 1.0 - i * 0.4);
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.moveTo(-10, yPos + 4);
      ctx.lineTo(0, yPos - 5);
      ctx.lineTo(10, yPos + 4);
      ctx.stroke();
    }
    ctx.restore();

  } else if (noteType === 'zigzag') {
    // ⚡ ZIGZAG NOTE: Animated Zigzag Wave Pattern + Label
    ctx.save();
    ctx.strokeStyle = '#F0ABFC';
    ctx.shadowColor = '#A855F7';
    ctx.shadowBlur = 14;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Animated zigzag wave
    const zigPhase = (nowMs / 200) % (Math.PI * 2);
    const zigAmplitude = 5;
    const zigSegments = 6;
    const zigWidth = noteW - 16;
    const segW = zigWidth / zigSegments;
    ctx.beginPath();
    for (let s = 0; s <= zigSegments; s++) {
      const sx = -zigWidth / 2 + s * segW;
      const sy = (s % 2 === 0 ? -1 : 1) * zigAmplitude * Math.sin(zigPhase + s * 0.5);
      if (s === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();

    // Label pill
    ctx.fillStyle = 'rgba(88, 28, 135, 0.85)';
    ctx.beginPath();
    ctx.roundRect(-18, 6, 36, 14, 7);
    ctx.fill();
    ctx.fillStyle = '#F0ABFC';
    ctx.font = '700 7px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ZIGZAG', 0, 13);
    ctx.restore();

  } else if (noteType === 'burst') {
    // 💥 BURST NOTE: Pulsing Concentric Expanding Rings + Label
    ctx.save();
    const burstPulse = 1.0 + 0.25 * Math.sin(nowMs / 80);
    const ringRadius = Math.max(noteW, noteH) * 0.48;

    // Three concentric pulsing rings
    for (let ri = 0; ri < 3; ri++) {
      const rScale = 0.5 + ri * 0.25;
      const rAlpha = 0.8 - ri * 0.25;
      ctx.strokeStyle = `rgba(255, 85, 0, ${rAlpha})`;
      ctx.lineWidth = 2.0 - ri * 0.5;
      ctx.shadowColor = '#FF5500';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(0, 0, ringRadius * rScale * burstPulse, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Label pill
    ctx.fillStyle = 'rgba(127, 29, 29, 0.85)';
    ctx.beginPath();
    ctx.roundRect(-18, -8, 36, 16, 8);
    ctx.fill();
    ctx.fillStyle = '#FFFBEB';
    ctx.shadowColor = '#FF5500';
    ctx.shadowBlur = 10;
    ctx.font = '900 8px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('BURST', 0, 0);
    ctx.restore();
  }

  ctx.restore();
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
}
