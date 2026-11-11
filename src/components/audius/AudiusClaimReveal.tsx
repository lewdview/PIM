/**
 * Full-screen claim reveal for weekly Audius cards: "earned in th3scr1b3 x Audius".
 *
 * A retro pixel "select screen" sequence in three acts:
 *   1. Versus intro: th3scr1b3 and AUDIUS banners slam in, a pixel x lands.
 *   2. Select grid: the card's art, pixelated into a tile mosaic; a cursor
 *      hops the tiles and locks onto the centre.
 *   3. Reveal: the real PIM card flies in over a pixel burst, with the
 *      "earned in th3scr1b3 x Audius" lockup.
 *
 * The Deluxe card plays the same story with its own staging: banners from top
 * and bottom, a second DELUXE slam, a 5x5 spiral grid that turns gold, a
 * spinning sunburst and a palette-cycling headline.
 *
 * Tap (or Space/Enter) skips to the reveal; Esc closes. Reduced motion goes
 * straight to the reveal without particles.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import Card from '@/components/Card';
import { findCardWithFallback, type VaultCard } from '@/services/vaultService';
import { getAudiusCard, parseAudiusCardId } from '@/lib/audiusCardRegistry';
import { loadAudiusCardDetails } from '@/lib/audiusCards';
import { AUDIUS_COLLAB } from '@/lib/audiusBrand';
import { claimSfx } from './claimSfx';
import '@/styles/audiusClaim.css';

type Phase = 'intro' | 'select' | 'reveal';

export interface AudiusClaimRevealProps {
  /** 'aud-<track id>' or 'bombshell-aud-<track id>'. */
  cardId: string;
  /** Prebuilt card (previews); otherwise loaded from the card id. */
  card?: VaultCard;
  artist?: string;
  onClose: () => void;
  onViewCollection?: () => void;
}

const TIMING = {
  standard: { intro: 1350, select: 1500, grid: 3 },
  deluxe: { intro: 1900, select: 2100, grid: 5 },
} as const;

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** 'NOV 9' for a 'YYYY-MM-DD' week start. */
function weekOf(week: string | undefined): string {
  const m = (week || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  const mon = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][+m[2] - 1];
  return mon ? `${mon} ${+m[3]}` : '';
}

/** Tile order: row by row for the standard grid, an inward spiral for Deluxe. */
function tileOrder(n: number, spiral: boolean): number[] {
  if (!spiral) return Array.from({ length: n * n }, (_, i) => i);
  const out: number[] = [];
  let top = 0, left = 0, bottom = n - 1, right = n - 1;
  while (top <= bottom && left <= right) {
    for (let c = left; c <= right; c++) out.push(top * n + c);
    for (let r = top + 1; r <= bottom; r++) out.push(r * n + right);
    if (top < bottom) for (let c = right - 1; c >= left; c--) out.push(bottom * n + c);
    if (left < right) for (let r = bottom - 1; r > top; r--) out.push(r * n + left);
    top++; left++; bottom--; right--;
  }
  return out;
}

/** One mosaic tile: its slice of the art drawn into a tiny canvas, shown pixelated. */
function ArtTile({ img, n, index, px }: { img: HTMLImageElement | null; n: number; index: number; px: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    const g = cv?.getContext('2d');
    if (!cv || !g) return;
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#1a0a2e';
    g.fillRect(0, 0, px, px);
    if (!img || !img.naturalWidth) return;
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const sx0 = (img.naturalWidth - side) / 2;
    const sy0 = (img.naturalHeight - side) / 2;
    const cell = side / n;
    const r = Math.floor(index / n);
    const c = index % n;
    try {
      g.drawImage(img, sx0 + c * cell, sy0 + r * cell, cell, cell, 0, 0, px, px);
    } catch {
      /* image not drawable: keep the flat tile */
    }
  }, [img, n, index, px]);
  return <canvas ref={ref} width={px} height={px} className="axr-tile-canvas" />;
}

function useArtImage(src: string | undefined) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!src) return;
    let live = true;
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => live && setImg(im);
    im.onerror = () => live && setImg(null);
    im.src = src;
    return () => {
      live = false;
    };
  }, [src]);
  return img;
}

function PixelX({ className = '' }: { className?: string }) {
  // 5x5 pixel cross
  const on = [0, 4, 6, 8, 12, 16, 18, 20, 24];
  return (
    <span className={`axr-px ${className}`} aria-hidden>
      {Array.from({ length: 25 }, (_, i) => (
        <i key={i} style={{ opacity: on.includes(i) ? 1 : 0 }} />
      ))}
    </span>
  );
}

function TypeLine({ text, start, className }: { text: string; start: boolean; className?: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!start) return;
    if (prefersReducedMotion()) {
      setN(text.length);
      return;
    }
    setN(0);
    let i = 0;
    const id = window.setInterval(() => {
      i++;
      setN(i);
      if (text[i - 1] && text[i - 1] !== ' ') claimSfx.type();
      if (i >= text.length) window.clearInterval(id);
    }, 38);
    return () => window.clearInterval(id);
  }, [start, text]);
  return (
    <span className={className} aria-label={text}>
      {text.split('').map((ch, i) => (
        <span key={i} style={{ visibility: i < n ? 'visible' : 'hidden', ['--i' as any]: i }}>
          {ch === ' ' ? ' ' : ch}
        </span>
      ))}
    </span>
  );
}

export default function AudiusClaimReveal({ cardId, card: givenCard, artist, onClose, onViewCollection }: AudiusClaimRevealProps) {
  const parsed = parseAudiusCardId(cardId);
  const deluxe = !!parsed?.deluxe;
  const variant = deluxe ? 'deluxe' : 'standard';
  const t = TIMING[variant];
  const reduced = useMemo(prefersReducedMotion, []);

  const [phase, setPhase] = useState<Phase>(reduced ? 'reveal' : 'intro');
  const [card, setCard] = useState<VaultCard | null>(givenCard ?? null);
  const [flash, setFlash] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const [cursor, setCursor] = useState(-1);
  const [locked, setLocked] = useState(false);
  const [golden, setGolden] = useState(-1);
  const timers = useRef<number[]>([]);
  const closeRef = useRef<HTMLButtonElement>(null);

  const later = useCallback((ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);
  const clearTimers = useCallback(() => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  }, []);

  // Card details (title, artist, art) — loaded while the intro plays.
  useEffect(() => {
    if (givenCard) return;
    let live = true;
    loadAudiusCardDetails([cardId])
      .catch(() => undefined)
      .then(() => live && setCard(findCardWithFallback([], cardId)));
    return () => {
      live = false;
    };
  }, [cardId, givenCard]);

  const info = getAudiusCard(cardId);
  const artistName = artist || info?.artist || '';
  const img = useArtImage(card?.coverUrl);

  const n = t.grid;
  const order = useMemo(() => tileOrder(n, deluxe), [n, deluxe]);
  const center = Math.floor((n * n) / 2);

  const hit = useCallback((heavy = false) => {
    setFlash((f) => f + 1);
    claimSfx.slam(heavy);
    // Screen shake on the stage without remounting it (that would restart the intro).
    const m = heavy ? 10 : 6;
    stageRef.current?.animate?.(
      [
        { transform: 'translate(0, 0)' },
        { transform: `translate(${-m}px, ${m / 2}px)` },
        { transform: `translate(${m}px, ${-m * 0.7}px)` },
        { transform: `translate(${-m * 0.7}px, ${-m / 3}px)` },
        { transform: `translate(${m / 2}px, ${m * 0.7}px)` },
        { transform: 'translate(0, 0)' },
      ],
      { duration: heavy ? 380 : 260, easing: heavy ? 'steps(8)' : 'steps(6)' },
    );
  }, []);

  // Act 1: versus intro.
  useEffect(() => {
    if (phase !== 'intro') return;
    later(120, () => claimSfx.swoosh());
    later(deluxe ? 300 : 280, () => claimSfx.swoosh());
    later(deluxe ? 720 : 680, () => hit(false));
    if (deluxe) later(1180, () => hit(true));
    later(t.intro, () => setPhase('select'));
    return clearTimers;
  }, [phase, deluxe, t.intro, later, clearTimers, hit]);

  // Act 2: select grid. Tiles pop in, the cursor hops and locks on the centre.
  useEffect(() => {
    if (phase !== 'select') return;
    const appear = n * n * (deluxe ? 22 : 45);
    // Cursor path: standard runs the rows and comes back round to the centre;
    // Deluxe spirals inward and ends on it.
    const path = deluxe ? order : [...order, ...order.slice(0, center + 1)];
    const hops = path.length;
    const hopSpan = t.select - appear - (deluxe ? 620 : 380);
    let at = appear;
    path.forEach((idx, i) => {
      // Ease out: hops slow down as the cursor nears its pick.
      const step = (hopSpan / hops) * (0.45 + 1.4 * (i / hops) ** 2);
      at += step;
      later(at, () => {
        setCursor(idx);
        claimSfx.tick((i % 8) - (deluxe ? 0 : 4));
      });
    });
    later(at + 60, () => {
      setLocked(true);
      claimSfx.lock();
    });
    if (deluxe) {
      order.forEach((idx, i) => later(at + 120 + i * 14, () => setGolden(i)));
    }
    later(t.select, () => {
      setFlash((f) => f + 1);
      setPhase('reveal');
    });
    return clearTimers;
  }, [phase, n, deluxe, order, center, t.select, later, clearTimers]);

  // Act 3: reveal fanfare.
  useEffect(() => {
    if (phase !== 'reveal') return;
    if (!reduced) claimSfx.fanfare(deluxe);
    window.setTimeout(() => closeRef.current?.focus(), 900);
  }, [phase, deluxe, reduced]);

  const skip = useCallback(() => {
    if (phase === 'reveal') return;
    clearTimers();
    setFlash((f) => f + 1);
    setPhase('reveal');
  }, [phase, clearTimers]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if ((e.key === ' ' || e.key === 'Enter') && phase !== 'reveal') {
        e.preventDefault();
        skip();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, skip, phase]);

  useEffect(() => clearTimers, [clearTimers]);

  const sparks = useMemo(() => {
    if (reduced) return [];
    const count = deluxe ? 28 : 16;
    return Array.from({ length: count }, (_, i) => {
      const a = (i / count) * Math.PI * 2 + (i % 2 ? 0.2 : 0);
      const dist = (deluxe ? 190 : 160) + (i % 3) * 40;
      return { dx: Math.cos(a) * dist, dy: Math.sin(a) * dist, d: (i % 4) * 40, s: i % 3 === 0 ? 10 : 6, c: i % 3 };
    });
  }, [deluxe, reduced]);

  const headline = deluxe ? 'DELUXE CARD EARNED!' : 'CARD EARNED!';
  const songTitle = (card?.title || '').replace(/ \(Deluxe\)$/, '');
  const weekText = weekOf(info?.weekStart);

  return createPortal(
    <div
      className="axr"
      data-variant={variant}
      data-phase={phase}
      role="dialog"
      aria-modal="true"
      aria-label={`${headline} Earned in ${AUDIUS_COLLAB}`}
      onClick={phase === 'reveal' ? undefined : skip}
      data-testid="audius-claim-reveal"
    >
      <div className="axr-bg" aria-hidden />
      <div className="axr-stars" aria-hidden />
      {phase !== 'intro' && (
        <div className="axr-brand" aria-hidden>
          <span>th3scr1b3</span>
          <PixelX className="axr-px-sm" />
          <span>Audius</span>
          <em>Weekly Top 5</em>
        </div>
      )}
      <div className="axr-stage" ref={stageRef}>
        {phase === 'intro' && (
          <div className="axr-intro" aria-hidden>
            <div className="axr-wipe">
              {Array.from({ length: 48 }, (_, i) => (
                <i key={i} style={{ ['--d' as any]: `${((i % 8) + Math.floor(i / 8)) * 28}ms` }} />
              ))}
            </div>
            <div className="axr-bar axr-bar-a">
              <span className="axr-bar-tag">P1</span>
              <span className="axr-bar-name">TH3SCR1B3</span>
            </div>
            <div className="axr-bar axr-bar-b">
              <span className="axr-bar-name">AUDIUS</span>
              <span className="axr-bar-tag">P2</span>
            </div>
            <div className="axr-x">
              <PixelX />
            </div>
            {deluxe && <div className="axr-stamp">DELUXE</div>}
            <div className="axr-intro-cap">WEEKLY TOP 5{weekText ? ` · WEEK OF ${weekText}` : ''}</div>
          </div>
        )}

        {phase === 'select' && (
          <div className="axr-select" aria-hidden>
            <div className="axr-select-title">
              <span className="axr-blink">▶</span> {deluxe ? 'DELUXE SELECT' : 'CARD SELECT'}
            </div>
            <div className="axr-grid" style={{ ['--n' as any]: n }}>
              {Array.from({ length: n * n }, (_, i) => {
                const rank = order.indexOf(i);
                return (
                  <div
                    key={i}
                    className="axr-tile"
                    data-cursor={cursor === i ? (locked ? 'locked' : 'on') : undefined}
                    data-gold={deluxe && golden >= rank ? 'on' : undefined}
                    data-center={i === center ? 'on' : undefined}
                    style={{ ['--d' as any]: `${rank * (deluxe ? 22 : 45)}ms` }}
                  >
                    <ArtTile img={img} n={n} index={i} px={deluxe ? 16 : 24} />
                  </div>
                );
              })}
            </div>
            <div className="axr-select-foot">
              {songTitle ? `${songTitle}${artistName ? ` · ${artistName}` : ''}`.toUpperCase() : '···'}
            </div>
          </div>
        )}

        {phase === 'reveal' && (
          <div className="axr-reveal" onClick={(e) => e.stopPropagation()}>
            <div className="axr-headline">
              <TypeLine text={headline} start className="axr-type" />
            </div>

            <div className="axr-card-wrap">
              <div className="axr-burst" aria-hidden />
              <div className="axr-shock" aria-hidden />
              {deluxe && <div className="axr-ring" aria-hidden />}
              <div className="axr-sparks" aria-hidden>
                {sparks.map((s, i) => (
                  <i
                    key={i}
                    data-c={s.c}
                    style={{
                      ['--dx' as any]: `${s.dx}px`,
                      ['--dy' as any]: `${s.dy}px`,
                      ['--d' as any]: `${s.d}ms`,
                      width: s.s,
                      height: s.s,
                    }}
                  />
                ))}
              </div>
              <motion.div
                className="axr-card"
                initial={reduced ? false : { scale: 0.15, rotateY: deluxe ? -720 : -540, y: 40, opacity: 0 }}
                animate={{ scale: 1, rotateY: 0, y: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: deluxe ? 120 : 150, damping: deluxe ? 13 : 15, mass: 0.9 }}
              >
                <div className="axr-card-float">
                  {card ? <Card card={card} /> : <div className="axr-card-ph" />}
                  <div className="axr-shine" aria-hidden />
                </div>
              </motion.div>
            </div>

            <div className="axr-meta">
              {songTitle && (
                <div className="axr-meta-artist">
                  {songTitle}
                  {artistName ? ` · ${artistName}` : ''}
                </div>
              )}
            </div>

            <div className="axr-lockup">
              <span className="axr-lockup-earned">EARNED IN</span>
              <span className="axr-lockup-brand">
                <span>th3scr1b3</span>
                <PixelX className="axr-px-sm" />
                <span>Audius</span>
              </span>
              <span className="axr-lockup-week">
                {deluxe ? 'DELUXE CLEAR' : 'WEEKLY TOP 5'}
                {weekText ? ` · WEEK OF ${weekText}` : ''}
              </span>
            </div>

            <div className="axr-actions">
              {onViewCollection && (
                <button type="button" className="btn-3d" data-tone={deluxe ? 'gold' : 'cyan'} onClick={onViewCollection}>
                  View collection
                </button>
              )}
              <button ref={closeRef} type="button" className="btn-3d" data-tone="quiet" onClick={onClose}>
                Continue
              </button>
            </div>
            <p className="axr-note">Only earnable in its week. Yours for good.</p>
          </div>
        )}
      </div>
      <div className="axr-scan" aria-hidden />
      {flash > 0 && <div className="axr-flash" key={`flash-${flash}`} aria-hidden />}
      {phase !== 'reveal' && <div className="axr-skip" aria-hidden>TAP TO SKIP</div>}
    </div>,
    document.body,
  );
}
