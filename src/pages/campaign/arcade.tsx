// Arcade pieces shared by the campaign and chapter screens. They borrow the
// results screens' visual language (campaignResults.css): slammed gradient
// letters, pixel chips, rolling counters and the stage-transition wipe.

import { useEffect, useRef, useState, type CSSProperties, type HTMLAttributes, type RefObject } from 'react';

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Big title whose letters slam in one by one, like the results screen's STAGE CLEAR. */
export function SlamTitle({ text, className = '', as: Tag = 'h1', delay = 0 }: {
  text: string;
  className?: string;
  as?: 'h1' | 'h2';
  delay?: number;
}) {
  let li = 0;
  return (
    <Tag className={`ca-title ${className}`} aria-label={text} style={{ ['--d0' as string]: `${delay}ms` } as CSSProperties}>
      {text.split(' ').map((w, wi) => (
        <span key={wi} className="ca-word" aria-hidden="true">
          {[...w].map((ch, i) => (
            <span key={i} className="ca-l" style={{ ['--i' as string]: li++ } as CSSProperties}>{ch}</span>
          ))}
        </span>
      ))}
    </Tag>
  );
}

/** A number that rolls up from zero once, the way the results tally board counts. */
export function CountUp({ to, ms = 900, delay = 0, fmt = (v: number) => Math.round(v).toLocaleString() }: {
  to: number;
  ms?: number;
  delay?: number;
  fmt?: (v: number) => string;
}) {
  const [v, setV] = useState(() => (reducedMotion() ? to : 0));
  useEffect(() => {
    if (reducedMotion() || to === 0) { setV(to); return; }
    let raf = 0;
    const t0 = performance.now() + delay;
    const frame = (now: number) => {
      const p = Math.max(0, Math.min(1, (now - t0) / ms));
      setV(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [to, ms, delay]);
  return <>{fmt(v)}</>;
}

/**
 * True once the element has scrolled into view (and stays true), so sections
 * further down the page play their entry when the player reaches them.
 */
export function useInView<T extends HTMLElement>(): [RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === 'undefined' || reducedMotion());
  useEffect(() => {
    if (seen || !ref.current) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setSeen(true); io.disconnect(); }
    }, { rootMargin: '0px 0px -12% 0px' });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [seen]);
  return [ref, seen];
}

/** Backdrop for a hero: spinning speed rays, dither and scanlines in the chapter colour. */
export function ArcadeBackdrop() {
  return (
    <div className="ca-bg" aria-hidden="true">
      <div className="ca-rays" />
      <div className="ca-dither" />
      <div className="ca-scan" />
    </div>
  );
}

/** One-shot striped wipe across the screen when a screen opens. */
export function StageWipe() {
  return <div className="ca-wipe" aria-hidden="true" />;
}

/** A section that plays its entry animation the first time it scrolls into view. */
export function RevealSection({ className = '', children, ...rest }: HTMLAttributes<HTMLElement>) {
  const [ref, seen] = useInView<HTMLElement>();
  return (
    <section ref={ref} className={`${className} ca-reveal${seen ? ' is-on' : ''}`} {...rest}>
      {children}
    </section>
  );
}
