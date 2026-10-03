// Word-by-word synced lyrics overlay for the PIM rhythm game track.
// Fetches /lyrics/dayNNN.lrc, interpolates word timing across each line,
// and highlights the active word with a randomly-assigned visual effect.
// Always on when lyrics exist — no gating, no unlock flow.
import React, { useEffect, useMemo, useRef, useState } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

interface TimedWord {
  text: string;
  start: number; // seconds
  end: number; // seconds
  effect: WordEffect;
}

interface TimedLine {
  start: number; // seconds
  end: number; // seconds
  words: TimedWord[];
}

export type WordEffect = "pop" | "glow" | "rise" | "flash" | "bounce" | "fade";

const EFFECTS: WordEffect[] = ["pop", "glow", "rise", "flash", "bounce", "fade"];

interface WordLyricsProps {
  /** 365 day number (1-365). Lyrics load from /lyrics/dayNNN.lrc. */
  day: number;
  /** Ref to the gameplay <audio> element; currentTime drives the sync. */
  audioRef: React.RefObject<HTMLAudioElement | null>;
}

// ── LRC parsing ──────────────────────────────────────────────────────────────

const LRC_TAG_RE = /^\[(ti|ar|al|by|offset|length|re|ve):/i;
const LRC_LINE_RE = /^\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]\s*(.*)$/;

function parseLrc(text: string): TimedLine[] {
  const rawLines: { start: number; text: string }[] = [];

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || LRC_TAG_RE.test(line)) continue;
    const m = LRC_LINE_RE.exec(line);
    if (!m) continue;
    const min = parseInt(m[1], 10);
    const sec = parseInt(m[2], 10);
    const fracRaw = m[3] || "0";
    // LRC fractions are centiseconds (2 digits) or milliseconds (3 digits)
    const frac = fracRaw.length >= 3 ? parseInt(fracRaw, 10) / 1000 : parseInt(fracRaw, 10) / 100;
    const text_content = (m[4] || "").trim();
    if (!text_content) continue;
    rawLines.push({ start: min * 60 + sec + frac, text: text_content });
  }

  rawLines.sort((a, b) => a.start - b.start);

  return rawLines.map((rl, i) => {
    const nextStart = i + 1 < rawLines.length ? rawLines[i + 1].start : rl.start + 4;
    const end = Math.max(nextStart, rl.start + 0.5);
    const tokens = rl.text.split(/\s+/).filter(Boolean);
    const dur = end - rl.start;
    const words: TimedWord[] = tokens.map((t, wi) => ({
      text: t,
      start: rl.start + (dur * wi) / tokens.length,
      end: rl.start + (dur * (wi + 1)) / tokens.length,
      effect: EFFECTS[Math.floor(Math.random() * EFFECTS.length)],
    }));
    return { start: rl.start, end, words };
  });
}

// ── Effect styles ────────────────────────────────────────────────────────────

const LYRIC_CSS = `
@keyframes wl-pop { 0% { transform: scale(0.6); } 55% { transform: scale(1.35); } 100% { transform: scale(1.12); } }
@keyframes wl-glow-pulse { 0%, 100% { text-shadow: 0 0 6px #fff, 0 0 18px #ff1493, 0 0 42px #ff1493; } 50% { text-shadow: 0 0 12px #fff, 0 0 34px #ff1493, 0 0 80px #ff1493; } }
@keyframes wl-rise { 0% { transform: translateY(14px); opacity: 0.2; } 100% { transform: translateY(-4px); opacity: 1; } }
@keyframes wl-flash { 0%, 100% { color: #ffffff; } 25% { color: #ffe14d; } 50% { color: #ff1493; } 75% { color: #00e5ff; } }
@keyframes wl-bounce { 0%, 100% { transform: translateY(0); } 30% { transform: translateY(-10px); } 55% { transform: translateY(2px); } 80% { transform: translateY(-4px); } }
@keyframes wl-fade { 0% { opacity: 0.15; } 100% { opacity: 1; } }
.wl-word { display: inline-block; margin: 0 0.18em; transition: color 0.12s linear, opacity 0.12s linear; will-change: transform, text-shadow, opacity; }
.wl-active-pop { animation: wl-pop 0.32s ease-out forwards; color: #fff; }
.wl-active-glow { animation: wl-glow-pulse 0.9s ease-in-out infinite; color: #fff; }
.wl-active-rise { animation: wl-rise 0.3s ease-out forwards; color: #fff; }
.wl-active-flash { animation: wl-flash 0.7s linear infinite; }
.wl-active-bounce { animation: wl-bounce 0.55s ease-in-out; color: #fff; }
.wl-active-fade { animation: wl-fade 0.25s ease-out forwards; color: #fff; }
`;

const UPCOMING_STYLE: React.CSSProperties = { color: "rgba(255,255,255,0.38)" };
const SUNG_STYLE: React.CSSProperties = { color: "rgba(255,255,255,0.72)" };

// ── Component ────────────────────────────────────────────────────────────────

export default function WordLyrics({ day, audioRef }: WordLyricsProps) {
  const [lines, setLines] = useState<TimedLine[]>([]);
  const [now, setNow] = useState(0);
  const rafRef = useRef<number | null>(null);
  const lastWordKey = useRef<string>("");

  // Load + parse the day's LRC file. Missing file => render nothing, no crash.
  useEffect(() => {
    let cancelled = false;
    setLines([]);
    if (!Number.isFinite(day) || day < 1 || day > 365) return;
    const name = `day${String(day).padStart(3, "0")}.lrc`;
    fetch(`/lyrics/${name}`)
      .then((res) => {
        if (!res.ok) throw new Error(`no lyrics for day ${day}`);
        return res.text();
      })
      .then((text) => {
        if (!cancelled) setLines(parseLrc(text));
      })
      .catch(() => {
        if (!cancelled) setLines([]);
      });
    return () => {
      cancelled = true;
    };
  }, [day]);

  // Sync loop: read audio time, update state only when the active word changes.
  useEffect(() => {
    const tick = () => {
      const t = audioRef.current?.currentTime ?? 0;
      let key = "";
      for (let li = 0; li < lines.length; li++) {
        const ln = lines[li];
        if (t >= ln.start && t < ln.end) {
          for (let wi = 0; wi < ln.words.length; wi++) {
            const w = ln.words[wi];
            if (t >= w.start && t < w.end) {
              key = `${li}:${wi}`;
              break;
            }
          }
          if (!key) key = `${li}:-1`;
          break;
        }
      }
      if (key !== lastWordKey.current) {
        lastWordKey.current = key;
        setNow(t);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      lastWordKey.current = "";
    };
  }, [lines, audioRef]);

  const active = useMemo(() => {
    for (let li = 0; li < lines.length; li++) {
      const ln = lines[li];
      if (now >= ln.start && now < ln.end) {
        let wi = -1;
        for (let k = 0; k < ln.words.length; k++) {
          if (now >= ln.words[k].start && now < ln.words[k].end) {
            wi = k;
            break;
          }
        }
        return { line: ln, wordIndex: wi };
      }
    }
    return null;
  }, [lines, now]);

  if (!active || active.line.words.length === 0) return null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: LYRIC_CSS }} />
      <div
        aria-hidden
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "baseline",
          maxWidth: "92%",
          margin: "0 auto",
          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          fontWeight: 800,
          fontSize: "clamp(15px, 2.6vw, 26px)",
          letterSpacing: "0.04em",
          textAlign: "center",
          lineHeight: 1.5,
          textShadow: "0 2px 12px rgba(0,0,0,0.85)",
          userSelect: "none",
        }}
      >
        {active.line.words.map((w, i) => {
          const isActive = i === active.wordIndex;
          const isSung = active.wordIndex >= 0 ? i < active.wordIndex : false;
          return (
            <span
              key={i}
              className={isActive ? `wl-word wl-active-${w.effect}` : "wl-word"}
              style={isActive ? undefined : isSung ? SUNG_STYLE : UPCOMING_STYLE}
            >
              {w.text}
            </span>
          );
        })}
      </div>
    </>
  );
}
