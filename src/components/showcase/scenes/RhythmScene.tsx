import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import type { SceneProps } from '../sceneKit';
import { DEMO_CHART_URL, DEMO_CHART_DAY, SONGS } from '../showcaseData';

/**
 * Self-playing rhythm demo. It runs the real day-311 chart (taps, holds, swipes, timed
 * lyrics) on a canvas highway drawn like the game's: three lanes, perspective, hit line,
 * judgments, combo and the FEVER / SURGE power-ups at 20 / 40 combo.
 * Sound is off until asked for; with it on, the clock follows the song.
 */

interface ChartNote { id: number; time: number; lane: number; type: 'tap' | 'hold' | 'swipe'; holdDuration?: number; swipeDirection?: string }
interface Segment { start: number; end: number; text: string }
interface Chart { notes: ChartNote[]; lyricsSegments: Segment[]; audioUrl: string; bpm: number; title: string }

const LOOP_START = 41.4;
const LOOP_END = 88.2;
const APPROACH = 1.75;
const START_COMBO = 12;
const LANE_COLORS = ['#A855F7', '#00E5FF', '#FF1493'];
const LANE_KEYS = ['A', 'S', 'D'];
const POWERS = [
  { at: 40, label: 'SURGE', color: '#FF1493', mult: 3, dur: 11 },
  { at: 20, label: 'FEVER', color: '#E5B800', mult: 2, dur: 9 },
];

type Judge = 'PERFECT+' | 'PERFECT' | 'GOOD';
const JUDGE_COLOR: Record<Judge, string> = { 'PERFECT+': '#FDE047', PERFECT: '#00E5FF', GOOD: '#A3E635' };
const BASE: Record<Judge, number> = { 'PERFECT+': 500, PERFECT: 300, GOOD: 150 };

let chartPromise: Promise<Chart> | null = null;
const loadChart = () => (chartPromise ??= fetch(DEMO_CHART_URL).then(r => r.json()));

export default function RhythmScene({ active }: SceneProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scoreRef = useRef<HTMLSpanElement>(null);
  const comboRef = useRef<HTMLSpanElement>(null);
  const multRef = useRef<HTMLSpanElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [chart, setChart] = useState<Chart | null>(null);
  const [lyric, setLyric] = useState<{ words: string[]; at: number }>({ words: [], at: -1 });
  const [power, setPower] = useState<{ label: string; color: string; key: number } | null>(null);
  const [sound, setSound] = useState(false);
  const soundRef = useRef(false);
  soundRef.current = sound;
  const song = SONGS[DEMO_CHART_DAY];

  useEffect(() => { loadChart().then(setChart).catch(() => { chartPromise = null; }); }, []);

  // Sound: a plain <audio>, looped by hand over the demo window.
  useEffect(() => {
    if (!chart) return;
    if (!sound || !active) { audioRef.current?.pause(); return; }
    let a = audioRef.current;
    if (!a) { a = new Audio(chart.audioUrl); a.preload = 'auto'; audioRef.current = a; }
    a.currentTime = LOOP_START;
    a.volume = 0.8;
    a.play().catch(() => setSound(false));
    return () => { a?.pause(); };
  }, [sound, active, chart]);

  useEffect(() => () => { audioRef.current?.pause(); audioRef.current = null; }, []);

  useEffect(() => {
    if (!active || !chart) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const notes = chart.notes.filter(n => n.time >= LOOP_START - 0.2 && n.time < LOOP_END - 0.4);
    const beat = 60 / (chart.bpm || 69);

    let w = 0, h = 0, dpr = 1;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = r.width; h = r.height;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Run state, reset on every loop.
    let hit = new Set<number>();
    let combo = START_COMBO, score = 184250, lastT = -1;
    let powerOn: { label: string; color: string; mult: number; until: number } | null = null;
    const bursts: Array<{ lane: number; t: number; color: string }> = [];
    const judges: Array<{ lane: number; t: number; j: Judge }> = [];
    const padAt = [-9, -9, -9];
    let lyricKey = '';
    const t0 = performance.now();

    const reset = () => {
      hit = new Set(); combo = START_COMBO; score = 184250; powerOn = null;
      bursts.length = 0; judges.length = 0; setPower(null);
    };

    const sceneTime = () => {
      const a = audioRef.current;
      if (soundRef.current && a && !a.paused && a.currentTime > 1) {
        if (a.currentTime >= LOOP_END) a.currentTime = LOOP_START;
        return a.currentTime;
      }
      return LOOP_START + (((performance.now() - t0) / 1000) % (LOOP_END - LOOP_START));
    };

    // Perspective: p = 0 at the horizon, 1 at the hit line.
    const geo = () => {
      const topY = h * 0.2, hitY = h * 0.8, padY = h * 0.94;
      const topW = w * 0.26, hitW = Math.min(w * 0.9, h * 1.05);
      return { topY, hitY, padY, topW, hitW };
    };
    const at = (p: number) => {
      const g = geo();
      const e = Math.pow(Math.max(0, p), 1.6);
      return { y: g.topY + (g.hitY - g.topY) * e, wd: g.topW + (g.hitW - g.topW) * e };
    };
    const laneX = (lane: number, wd: number) => w / 2 - wd / 2 + wd * (lane + 0.5) / 3;

    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const t = sceneTime();
      if (t < lastT - 1) reset();
      lastT = t;
      const g = geo();

      // ── Autoplay: hit everything on time.
      for (const n of notes) {
        if (hit.has(n.id) || n.time > t) continue;
        hit.add(n.id);
        let j: Judge = n.id % 11 === 0 ? 'PERFECT' : n.id % 17 === 0 ? 'GOOD' : 'PERFECT+';
        if (powerOn && j === 'PERFECT') j = 'PERFECT+';
        combo += 1;
        score += BASE[j] * (powerOn?.mult ?? 1);
        bursts.push({ lane: n.lane, t, color: LANE_COLORS[n.lane] });
        judges.push({ lane: n.lane, t, j });
        padAt[n.lane] = t;
        for (const pw of POWERS) {
          if (combo === pw.at) {
            powerOn = { label: pw.label, color: pw.color, mult: pw.mult, until: t + pw.dur };
            setPower({ label: pw.label, color: pw.color, key: Math.round(t * 10) });
            break;
          }
        }
      }
      if (powerOn && t > powerOn.until) { powerOn = null; setPower(null); }

      // ── HUD text (direct DOM writes, no re-render).
      if (scoreRef.current) scoreRef.current.textContent = String(score).padStart(7, '0');
      if (comboRef.current) comboRef.current.textContent = String(combo);
      if (multRef.current) multRef.current.textContent = `×${powerOn?.mult ?? 1}`;

      // ── Lyric window: a few words around the one being sung.
      const seg = chart.lyricsSegments.find(s => t >= s.start && t < s.end);
      if (seg) {
        const words = seg.text.split(/\s+/);
        const idx = Math.min(words.length - 1, Math.floor(((t - seg.start) / (seg.end - seg.start)) * words.length));
        const from = Math.max(0, idx - 3);
        const key = `${seg.start}:${idx}`;
        if (key !== lyricKey) { lyricKey = key; setLyric({ words: words.slice(from, from + 7), at: idx - from }); }
      } else if (lyricKey !== '') { lyricKey = ''; setLyric({ words: [], at: -1 }); }

      // ── Draw.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const tint = powerOn?.color;

      // Highway body.
      const bot = { y: g.padY, wd: g.hitW * 1.08 };
      ctx.beginPath();
      ctx.moveTo(w / 2 - g.topW / 2, g.topY);
      ctx.lineTo(w / 2 + g.topW / 2, g.topY);
      ctx.lineTo(w / 2 + bot.wd / 2, bot.y);
      ctx.lineTo(w / 2 - bot.wd / 2, bot.y);
      ctx.closePath();
      const body = ctx.createLinearGradient(0, g.topY, 0, bot.y);
      body.addColorStop(0, 'rgba(8,6,14,0.15)');
      body.addColorStop(1, 'rgba(8,6,14,0.72)');
      ctx.fillStyle = body;
      ctx.fill();

      // Beat lines rushing toward the player.
      const firstBeat = Math.ceil(t / beat) * beat;
      for (let b = firstBeat; b < t + APPROACH; b += beat) {
        const p = 1 - (b - t) / APPROACH;
        const { y, wd } = at(p);
        ctx.strokeStyle = `rgba(255,255,255,${0.04 + p * 0.1})`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(w / 2 - wd / 2, y); ctx.lineTo(w / 2 + wd / 2, y); ctx.stroke();
      }

      // Lane dividers and edges.
      for (let i = 0; i <= 3; i++) {
        const edge = i === 0 || i === 3;
        ctx.strokeStyle = edge ? (tint ?? 'rgba(255,255,255,0.75)') : 'rgba(255,255,255,0.12)';
        ctx.lineWidth = edge ? 2 : 1;
        if (edge) { ctx.shadowColor = tint ?? 'rgba(255,255,255,0.6)'; ctx.shadowBlur = tint ? 18 : 8; }
        ctx.beginPath();
        ctx.moveTo(w / 2 - g.topW / 2 + (g.topW * i) / 3, g.topY);
        ctx.lineTo(w / 2 - bot.wd / 2 + (bot.wd * i) / 3, bot.y);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // Hold beams (drawn under the heads).
      for (const n of notes) {
        if (n.type !== 'hold' || !n.holdDuration) continue;
        const end = n.time + n.holdDuration;
        if (end < t || n.time > t + APPROACH) continue;
        const pHead = Math.min(1, 1 - (n.time - t) / APPROACH);
        const pTail = Math.max(0, 1 - (end - t) / APPROACH);
        const a = at(pHead), b = at(pTail);
        const ha = (a.wd / 3) * 0.34, hb = (b.wd / 3) * 0.34;
        const xa = laneX(n.lane, a.wd), xb = laneX(n.lane, b.wd);
        const held = t >= n.time;
        ctx.fillStyle = LANE_COLORS[n.lane] + (held ? 'aa' : '55');
        if (held) { ctx.shadowColor = LANE_COLORS[n.lane]; ctx.shadowBlur = 20; padAt[n.lane] = t; }
        ctx.beginPath();
        ctx.moveTo(xa - ha, a.y); ctx.lineTo(xa + ha, a.y); ctx.lineTo(xb + hb, b.y); ctx.lineTo(xb - hb, b.y);
        ctx.closePath(); ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Note heads.
      for (const n of notes) {
        if (hit.has(n.id)) continue;
        const s = (n.time - t) / APPROACH;
        if (s > 1 || s < 0) continue;
        const p = 1 - s;
        const { y, wd } = at(p);
        const lw = (wd / 3) * 0.8;
        const nh = Math.max(4, 22 * Math.pow(p, 1.4));
        const x = laneX(n.lane, wd);
        const col = LANE_COLORS[n.lane];
        ctx.shadowColor = col; ctx.shadowBlur = 16 * p;
        ctx.fillStyle = col;
        roundRect(ctx, x - lw / 2, y - nh / 2, lw, nh, Math.min(8, nh / 2));
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        roundRect(ctx, x - lw / 2 + 4, y - nh / 2 + 2, lw - 8, Math.max(1.5, nh * 0.22), 2);
        ctx.fill();
        if (n.type === 'swipe') drawChevron(ctx, x, y, nh * 0.9, n.swipeDirection);
      }

      // Hit line.
      const hl = ctx.createLinearGradient(w / 2 - g.hitW / 2, 0, w / 2 + g.hitW / 2, 0);
      hl.addColorStop(0, LANE_COLORS[0]); hl.addColorStop(0.5, '#ffffff'); hl.addColorStop(1, LANE_COLORS[2]);
      ctx.strokeStyle = hl; ctx.lineWidth = 3; ctx.shadowColor = tint ?? '#ffffff'; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.moveTo(w / 2 - g.hitW / 2, g.hitY); ctx.lineTo(w / 2 + g.hitW / 2, g.hitY); ctx.stroke();
      ctx.shadowBlur = 0;

      // Lane pads under the hit line.
      for (let l = 0; l < 3; l++) {
        const lit = Math.max(0, 1 - (t - padAt[l]) / 0.22);
        const yA = g.hitY + 6, yB = g.padY - 2;
        const wA = g.hitW, wB = bot.wd;
        const xA0 = w / 2 - wA / 2 + (wA * l) / 3 + 4, xA1 = w / 2 - wA / 2 + (wA * (l + 1)) / 3 - 4;
        const xB0 = w / 2 - wB / 2 + (wB * l) / 3 + 4, xB1 = w / 2 - wB / 2 + (wB * (l + 1)) / 3 - 4;
        ctx.fillStyle = `rgba(255,255,255,${0.04 + lit * 0.05})`;
        if (lit > 0) { ctx.fillStyle = hexA(LANE_COLORS[l], 0.12 + lit * 0.4); ctx.shadowColor = LANE_COLORS[l]; ctx.shadowBlur = 24 * lit; }
        ctx.beginPath(); ctx.moveTo(xA0, yA); ctx.lineTo(xA1, yA); ctx.lineTo(xB1, yB); ctx.lineTo(xB0, yB); ctx.closePath(); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = `rgba(255,255,255,${0.35 + lit * 0.6})`;
        ctx.font = `700 ${Math.max(11, h * 0.028)}px "JetBrains Mono", monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(LANE_KEYS[l], (xA0 + xA1 + xB0 + xB1) / 4, (yA + yB) / 2);
      }

      // Hit bursts.
      for (let i = bursts.length - 1; i >= 0; i--) {
        const b = bursts[i];
        const k = (t - b.t) / 0.42;
        if (k > 1 || k < 0) { bursts.splice(i, 1); continue; }
        const x = laneX(b.lane, g.hitW);
        ctx.strokeStyle = hexA(b.color, 1 - k);
        ctx.lineWidth = 3 * (1 - k) + 1;
        ctx.beginPath(); ctx.ellipse(x, g.hitY, 12 + k * (g.hitW / 6), 6 + k * 18, 0, 0, Math.PI * 2); ctx.stroke();
        for (let s = 0; s < 8; s++) {
          const ang = (s / 8) * Math.PI * 2 + b.lane;
          const r = 10 + k * 60;
          ctx.fillStyle = hexA(s % 2 ? '#ffffff' : b.color, 1 - k);
          ctx.fillRect(x + Math.cos(ang) * r - 2, g.hitY + Math.sin(ang) * r * 0.55 - 2, 4, 4);
        }
      }

      // Judgments.
      for (let i = judges.length - 1; i >= 0; i--) {
        const jd = judges[i];
        const k = (t - jd.t) / 0.55;
        if (k > 1 || k < 0) { judges.splice(i, 1); continue; }
        const x = laneX(jd.lane, g.hitW);
        ctx.globalAlpha = 1 - k * k;
        ctx.fillStyle = JUDGE_COLOR[jd.j];
        ctx.font = `400 ${Math.max(14, h * 0.04)}px "Anton", Impact, sans-serif`;
        ctx.textAlign = 'center';
        ctx.shadowColor = JUDGE_COLOR[jd.j]; ctx.shadowBlur = 12;
        ctx.fillText(jd.j, x, g.hitY - 26 - k * 28);
        ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      }

      // Power-up aura.
      if (tint) {
        const pulse = 0.55 + 0.45 * Math.sin(t * 8);
        ctx.strokeStyle = hexA(tint, 0.5 * pulse);
        ctx.lineWidth = 6; ctx.shadowColor = tint; ctx.shadowBlur = 30;
        ctx.strokeRect(3, 3, w - 6, h - 6);
        ctx.shadowBlur = 0;
      }
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [active, chart]);

  return (
    <div ref={wrapRef} className="sc-rhythm">
      <div className="sc-rhythm-bg" style={{ backgroundImage: `url("${song.cover}")` }} aria-hidden />
      <canvas ref={canvasRef} className="sc-rhythm-canvas" aria-hidden />

      <div className="sc-rhythm-top">
        <div className="sc-rhythm-track">
          <img src={song.cover} alt="" />
          <div>
            <b>{song.title}</b>
            <span>DAY {DEMO_CHART_DAY} · TH3SCR1B3 · LIVE CHART</span>
          </div>
        </div>
        <div className="sc-rhythm-score">
          <span ref={scoreRef}>0184250</span>
          <small ref={multRef}>×1</small>
        </div>
      </div>

      <p className="sc-rhythm-lyric" aria-hidden>
        {lyric.words.map((wd, i) => <span key={i} className={i === lyric.at ? 'on' : i < lyric.at ? 'sung' : ''}>{wd} </span>)}
      </p>

      <div className="sc-rhythm-combo" aria-hidden>
        <span ref={comboRef}>{START_COMBO}</span>
        <small>COMBO</small>
      </div>

      {power && (
        <div key={power.key} className="sc-rhythm-power" style={{ ['--pc' as string]: power.color }} aria-hidden>
          {power.label}
        </div>
      )}

      <button
        type="button"
        className="sc-rhythm-sound"
        onClick={e => { e.stopPropagation(); setSound(s => !s); }}
        aria-pressed={sound}
        aria-label={sound ? 'Mute the song' : 'Play the song'}
      >
        {sound ? <Volume2 size={15} /> : <VolumeX size={15} />}
        {sound ? 'Sound on' : 'Sound off'}
      </button>
    </div>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawChevron(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, dir = 'up') {
  const rot: Record<string, number> = { up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 };
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot[dir] ?? 0);
  ctx.strokeStyle = '#0b0710';
  ctx.lineWidth = Math.max(2, s * 0.22);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(-s * 0.5, s * 0.25); ctx.lineTo(0, -s * 0.25); ctx.lineTo(s * 0.5, s * 0.25); ctx.stroke();
  ctx.restore();
}

function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}
