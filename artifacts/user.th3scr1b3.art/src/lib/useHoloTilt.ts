/**
 * useHoloTilt — drives the holographic sheen and 3D tilt of a card.
 *
 * Pointer (mouse, pen, touch drag) and phone tilt both feed one smoothed
 * light position. Each frame writes CSS custom properties onto the sheen
 * element (read by HoloSheen / holo.css) and a rotate transform onto the tilt
 * element, straight to the DOM so React never re-renders on movement.
 *
 * - Pointer wins over gyro; gyro only runs on touch-first devices.
 * - Work stops when the card is off screen or settled.
 * - prefers-reduced-motion: no tilt, no gyro, no idle drift. The light still
 *   follows a hovering pointer, which is user driven rather than autonomous.
 */

import { useEffect, type RefObject } from 'react';
import { gyroNeedsPermission, requestGyroPermission, subscribeGyro } from './holoGyro';

export interface HoloTiltOptions {
  /** Max rotation in degrees at the card edge. 0 disables tilt but keeps the light. */
  maxTilt?: number;
  /** Follow phone tilt on touch devices. */
  gyro?: boolean;
  /** Let the light drift slowly on its own when nobody is interacting (hero cards). */
  idle?: boolean;
  /** Extra lift toward the viewer while active, in px. */
  lift?: number;
  /**
   * Where to listen and measure. 'parent' (default) uses the untransformed
   * parent so the hit area does not wobble with the tilt; use 'self' when the
   * parent is much larger than the card.
   */
  hit?: 'parent' | 'self';
  enabled?: boolean;
}

const clamp = (v: number) => (v < -1 ? -1 : v > 1 ? 1 : v);

export function useHoloTilt(
  tiltRef: RefObject<HTMLElement | null>,
  sheenRef?: RefObject<HTMLElement | null>,
  { maxTilt = 12, gyro = true, idle = false, lift = 0, hit = 'parent', enabled = true }: HoloTiltOptions = {},
) {
  useEffect(() => {
    const tiltEl = tiltRef.current;
    if (!enabled || !tiltEl || typeof window === 'undefined') return;

    const hitEl = hit === 'parent' ? tiltEl.parentElement ?? tiltEl : tiltEl;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const touchFirst = window.matchMedia('(hover: none)').matches;
    const tilt = reduce ? 0 : maxTilt;

    const target = { x: 0, y: 0, on: 0 };
    const cur = { x: 0, y: 0, on: 0 };
    let pointerActive = false;
    let gyroActive = false;
    let visible = true;
    let raf = 0;
    let last = performance.now();
    const start = last;
    let unsubGyro: (() => void) | null = null;

    const idleRunning = () => idle && !reduce && visible && !pointerActive && !gyroActive;

    const write = () => {
      const sheenEl = sheenRef?.current ?? tiltEl;
      const { x, y, on } = cur;
      const px = 50 + x * 50;
      const py = 50 + y * 50;
      const s = sheenEl.style;
      s.setProperty('--holo-px', `${px.toFixed(2)}%`);
      s.setProperty('--holo-py', `${py.toFixed(2)}%`);
      s.setProperty('--holo-dx', x.toFixed(3));
      s.setProperty('--holo-dy', y.toFixed(3));
      s.setProperty('--holo-hyp', Math.min(1, Math.hypot(x, y)).toFixed(3));
      s.setProperty('--holo-on', on.toFixed(3));
      s.setProperty('--holo-bgx', `${(37 + px * 0.26).toFixed(2)}%`);
      s.setProperty('--holo-bgy', `${(33 + py * 0.34).toFixed(2)}%`);
      s.setProperty('--holo-angle', `${((Math.atan2(y, x) * 180) / Math.PI + 90).toFixed(1)}deg`);
      if (tilt) {
        // Drop the transform entirely at rest so settled cards rasterise crisply.
        const atRest = Math.abs(x) < 0.001 && Math.abs(y) < 0.001 && on < 0.002;
        const z = lift ? ` translateZ(${(on * lift).toFixed(1)}px)` : '';
        tiltEl.style.transform = atRest ? '' : `rotateX(${(-y * tilt).toFixed(2)}deg) rotateY(${(x * tilt).toFixed(2)}deg)${z}`;
      }
    };

    const tick = (now: number) => {
      raf = 0;
      const dt = Math.min(64, now - last);
      last = now;
      if (idleRunning()) {
        const t = (now - start) / 1000;
        target.x = Math.sin(t * 0.42) * 0.6;
        target.y = Math.sin(t * 0.29 + 1.3) * 0.45;
        target.on = 0.6;
      }
      // Frame-rate independent ease toward the target.
      const k = 1 - Math.pow(1 - 0.14, dt / 16.67);
      cur.x += (target.x - cur.x) * k;
      cur.y += (target.y - cur.y) * k;
      cur.on += (target.on - cur.on) * k;
      write();
      const moving =
        Math.abs(target.x - cur.x) > 0.001 || Math.abs(target.y - cur.y) > 0.001 || Math.abs(target.on - cur.on) > 0.002;
      if (moving || idleRunning()) schedule();
    };

    function schedule() {
      if (!raf && visible) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    }

    const startGyro = () => {
      if (unsubGyro || reduce || !gyro || !touchFirst) return;
      unsubGyro = subscribeGyro((gx, gy) => {
        if (pointerActive || !visible) return;
        gyroActive = true;
        target.x = gx;
        target.y = gy;
        target.on = Math.min(1, 0.35 + Math.hypot(gx, gy) * 0.9);
        schedule();
      });
    };
    const stopGyro = () => {
      unsubGyro?.();
      unsubGyro = null;
      gyroActive = false;
    };

    const onMove = (e: PointerEvent) => {
      const r = hitEl.getBoundingClientRect();
      if (!r.width || !r.height) return;
      target.x = clamp(((e.clientX - r.left) / r.width) * 2 - 1);
      target.y = clamp(((e.clientY - r.top) / r.height) * 2 - 1);
      target.on = 1;
      pointerActive = true;
      schedule();
    };
    const onLeave = () => {
      pointerActive = false;
      if (!gyroActive) {
        target.x = 0;
        target.y = 0;
        target.on = 0;
      }
      schedule();
    };
    const onDown = (e: PointerEvent) => {
      // Granting permission wakes every subscribed card at once (see holoGyro).
      if (gyro && touchFirst && !reduce && gyroNeedsPermission()) void requestGyroPermission();
      onMove(e);
    };

    hitEl.addEventListener('pointermove', onMove, { passive: true });
    hitEl.addEventListener('pointerdown', onDown, { passive: true });
    hitEl.addEventListener('pointerleave', onLeave, { passive: true });
    hitEl.addEventListener('pointercancel', onLeave, { passive: true });

    let io: IntersectionObserver | null = null;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (visible) {
          startGyro();
          schedule();
        } else {
          stopGyro();
          if (raf) cancelAnimationFrame(raf);
          raf = 0;
        }
      });
      io.observe(hitEl);
    } else {
      startGyro();
    }

    write();
    schedule();

    return () => {
      hitEl.removeEventListener('pointermove', onMove);
      hitEl.removeEventListener('pointerdown', onDown);
      hitEl.removeEventListener('pointerleave', onLeave);
      hitEl.removeEventListener('pointercancel', onLeave);
      io?.disconnect();
      stopGyro();
      if (raf) cancelAnimationFrame(raf);
      tiltEl.style.transform = '';
    };
  }, [tiltRef, sheenRef, maxTilt, gyro, idle, lift, hit, enabled]);
}
