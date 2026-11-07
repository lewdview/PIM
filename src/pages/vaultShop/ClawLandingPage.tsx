import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, animate, useMotionValue, useTransform } from 'framer-motion';
import { useLocation } from 'wouter';
import { Ticket, ArrowRight, ArrowDown } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { audioManager } from '../../game/audio';
import { logAnalyticsEvent } from '../../services/telemetryService';
import { CLAW_PULL_PRICE } from '../../services/vaultService';
import { CartoonClaw } from './ClawEvent';
import { MysteryPack, MYSTERY_ACCENTS, PackToken } from './PackToken';
import { clawPrizePacks, clawPrizeWeight } from './clawPits';
import MainBrandLogo from '../../components/MainBrandLogo';
import FeatureTour from '../../components/showcase/FeatureTour';
import { SONGS, WALL_DAYS } from '../../components/showcase/showcaseData';
import '../../styles/vaultShop.css';
import '../../styles/clawLanding.css';

/**
 * /claw: the Claw Bot landing page, the top of the claw pull funnel.
 *
 * Funnel: land → free practice drop in the hero (no sign-in) → CTA → sign in if needed →
 * /bonus-claw, where the 99¢ pull or a bonus code is bought and played. Below the fold, a
 * live tour of every feature shows what the packs are for.
 * A ?code=XYZ on this page rides along to /bonus-claw so it arrives pre-filled.
 * Each step logs a claw_funnel_* event so drop-off can be read per step.
 */

const PENDING_FUNNEL_KEY = 'pim_claw_funnel_pending';
const CENTS = CLAW_PULL_PRICE.replace('$0.', '') + '¢';
const TILTS = [-12, 7, -4, 10, -8, 3, -10, 6];
const TICKER = ['Three drops per pull', 'Every pack in the vault', 'Odds published', 'Win it, open it', '365 songs', 'One new song a day'];

export default function ClawLandingPage() {
  const [, setLocation] = useLocation();
  const user = useAuthStore(s => s.user);
  const code = useMemo(() => new URLSearchParams(window.location.search).get('code')?.trim() || '', []);
  const source = useMemo(() => new URLSearchParams(window.location.search).get('src') || 'direct', []);

  const packs = useMemo(() => clawPrizePacks('dark'), []);
  const odds = useMemo(() => {
    const total = packs.reduce((s, p) => s + clawPrizeWeight(p.cardCount), 0);
    return packs
      .map(p => ({ pack: p, pct: (clawPrizeWeight(p.cardCount) / total) * 100 }))
      .sort((a, b) => a.pack.cardCount - b.pack.cardCount || b.pct - a.pct);
  }, [packs]);
  const topPct = Math.max(...odds.map(o => o.pct));
  const bigPackPct = useMemo(() => odds.filter(o => o.pack.cardCount >= 10).reduce((s, o) => s + o.pct, 0), [odds]);

  useEffect(() => {
    logAnalyticsEvent('claw_funnel_landing_view', { source, hasCode: !!code, signedIn: !!user });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goToMachine = useCallback((via: string) => {
    logAnalyticsEvent('claw_funnel_handoff', { via, source, hasCode: !!code });
    const qs = new URLSearchParams({ from: 'claw-landing' });
    if (code) qs.set('code', code);
    setLocation(`/bonus-claw?${qs.toString()}`);
  }, [code, source, setLocation]);

  const start = useCallback((via: string) => {
    audioManager.playSfx('tap_nav', 0.3);
    logAnalyticsEvent('claw_funnel_cta', { via, source, signedIn: !!user });
    if (user) { goToMachine(via); return; }
    try { sessionStorage.setItem(PENDING_FUNNEL_KEY, via); } catch { /* storage blocked */ }
    useAuthStore.getState().setShowAuthModal(true);
  }, [user, source, goToMachine]);

  // Signed in from the CTA's auth modal: carry on to the machine.
  useEffect(() => {
    if (!user) return;
    let via: string | null = null;
    try { via = sessionStorage.getItem(PENDING_FUNNEL_KEY); } catch { /* storage blocked */ }
    if (!via) return;
    try { sessionStorage.removeItem(PENDING_FUNNEL_KEY); } catch { /* storage blocked */ }
    logAnalyticsEvent('claw_funnel_signed_in', { via, source });
    goToMachine(via);
  }, [user, source, goToMachine]);

  const onChapterView = useCallback((id: string) => logAnalyticsEvent('claw_funnel_tour_view', { chapter: id, source }), [source]);
  const ctaLabel = code ? 'Use my code' : `Pull for ${CENTS}`;

  return (
    <div className="cb">
      <div className="cb-grain" aria-hidden />

      {/* ── TOP BAR ── */}
      <header className="cb-bar">
        <a href="/" className="cb-bar-brand" aria-label="PIM th3v4ult home"><MainBrandLogo size="nav" showGlow={false} interactive={false} /></a>
        <nav className="cb-bar-nav">
          <a href="#tour">The game</a>
          <a href="#odds">Odds</a>
          <button type="button" className="cb-btn cb-btn-sm" onClick={() => start('bar')}>{ctaLabel}</button>
        </nav>
      </header>

      {/* ── HERO ── */}
      <section className="cb-hero">
        <CoverWall />
        <div className="cb-hero-grid">
          <div className="cb-hero-copy">
            <p className="cb-eyebrow"><span>Bonus claw</span><i />{CENTS} a pull<i />three drops</p>
            <h1 className="cb-h1">
              <span className="cb-h1-line">Three drops.</span>
              <span className="cb-h1-line">Any pack</span>
              <em className="cb-h1-voice">in the vault.</em>
            </h1>
            <p className="cb-lede">
              Claw Bot’s machine is stacked with covered card packs, from 2-card singles to
              50-card Bombshell bundles. One pull, three drops. Win one and it opens straight
              into your collection.
            </p>
            {code && (
              <p className="cb-code" role="status"><Ticket size={16} /> Code <b>{code}</b> is loaded. It’ll be filled in for you.</p>
            )}
            <div className="cb-ctas">
              <motion.button type="button" className="cb-btn cb-btn-lg" onClick={() => start('hero')} whileTap={{ scale: 0.96 }}>
                {ctaLabel} <ArrowRight size={22} />
              </motion.button>
              <a href="#tour" className="cb-link">See how the game works <ArrowDown size={15} /></a>
            </div>
            <dl className="cb-facts">
              <div><dt>{CENTS}</dt><dd>per pull</dd></div>
              <div><dt>3</dt><dd>drops each</dd></div>
              <div><dt>{packs.length}</dt><dd>packs inside</dd></div>
            </dl>
          </div>

          <PracticeCabinet onConvert={() => start('practice')} source={source} />
        </div>
      </section>

      {/* ── TICKER ── */}
      <div className="cb-ticker" aria-hidden>
        <div className="cb-ticker-track">
          {[0, 1].map(k => (
            <span key={k}>{TICKER.map(t => <b key={t}>{t}<i>✦</i></b>)}</span>
          ))}
        </div>
      </div>

      {/* ── HOW A PULL WORKS ── */}
      <section className="cb-sec cb-how" aria-labelledby="cb-how-h">
        <h2 id="cb-how-h" className="cb-h2">How a pull <em>works</em></h2>
        <ol>
          <li>
            <b>01</b>
            <h3>Get a pull</h3>
            <p>{CENTS} at checkout, or redeem a bonus code.</p>
          </li>
          <li>
            <b>02</b>
            <h3>Drop the claw</h3>
            <p>It swings on its own. Tap to drop. You get three drops, and the pull is only used on the third.</p>
          </li>
          <li>
            <b>03</b>
            <h3>Open the pack</h3>
            <p>Your prize goes into your vault and opens right away, card by card.</p>
          </li>
        </ol>
      </section>

      {/* ── FEATURE TOUR ── */}
      <section id="tour" className="cb-sec cb-tour" aria-labelledby="cb-tour-h">
        <header className="cb-tour-head">
          <p className="cb-eyebrow"><span>Inside the vault</span></p>
          <h2 id="cb-tour-h" className="cb-h2 cb-h2-xl">The claw is one way in. <em>Here’s the whole game.</em></h2>
          <p className="cb-lede">PIM is a rhythm game with a new song every day and a card vault behind it. Every demo below is live, built from the real songs, charts and art.</p>
        </header>
        <FeatureTour highlight="claw" onChapterView={onChapterView} />
      </section>

      {/* ── ODDS ── */}
      <section id="odds" className="cb-sec cb-odds" aria-labelledby="cb-odds-h">
        <div className="cb-odds-head">
          <h2 id="cb-odds-h" className="cb-h2">What’s in <em>the machine</em></h2>
          <p className="cb-lede">Each win is one of these packs, at these odds. Packs of 10 cards or more come up {bigPackPct.toFixed(1)}% of the time.</p>
        </div>
        <ul className="cb-odds-list">
          {odds.map(({ pack, pct }) => (
            <li key={pack.id} style={{ ['--pa' as string]: pack.accent }}>
              <span className="cb-odds-pack"><PackToken pack={pack} hidePrice /></span>
              <span className="cb-odds-name">{pack.label}<small>{pack.cardCount} card{pack.cardCount === 1 ? '' : 's'}</small></span>
              <span className="cb-odds-bar"><i style={{ width: `${(pct / topPct) * 100}%` }} /></span>
              <span className="cb-odds-pct">{pct >= 1 ? pct.toFixed(1) : pct.toFixed(2)}%</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="cb-final">
        <p className="cb-eyebrow"><span>Claw Bot is warmed up</span></p>
        <h2 className="cb-final-h">Your <em>pull.</em></h2>
        <button type="button" className="cb-btn cb-btn-lg" onClick={() => start('footer')}>{ctaLabel} <ArrowRight size={22} /></button>
        <p className="cb-fine">Three drops per pull. Odds above. <a href="/vault/legal">Terms &amp; privacy</a></p>
      </section>
    </div>
  );
}

/** Three rows of real song covers drifting behind the hero. */
function CoverWall() {
  const rows = [WALL_DAYS, [...WALL_DAYS].reverse(), WALL_DAYS.slice(5).concat(WALL_DAYS.slice(0, 5))];
  return (
    <div className="cb-wall" aria-hidden>
      {rows.map((row, r) => (
        <div key={r} className={`cb-wall-row ${r % 2 ? 'rev' : ''}`}>
          {[...row, ...row].map((d, i) => <img key={i} src={SONGS[d].cover} alt="" loading={r === 0 ? 'eager' : 'lazy'} decoding="async" />)}
        </div>
      ))}
    </div>
  );
}

type Practice = 'idle' | 'swing' | 'drop' | 'done';

/** The hero machine: a free, prize-less practice drop so visitors feel the claw first. */
function PracticeCabinet({ onConvert, source }: { onConvert: () => void; source: string }) {
  const glassRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Practice>('idle');
  const [open, setOpen] = useState(true);
  const [grabbed, setGrabbed] = useState<number | null>(null);
  const [lifting, setLifting] = useState(false);
  const x = useMotionValue(0.5);
  const drop = useMotionValue(0);
  const left = useTransform(x, v => `${v * 100}%`);
  const cable = useTransform(drop, v => 22 + v);
  const swing = useRef<ReturnType<typeof animate> | null>(null);

  const startSwing = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setPhase('swing'); setGrabbed(null); setOpen(true); setLifting(false); drop.set(0);
    swing.current = animate(x, [0.18, 0.84], { duration: 1.25, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' });
    logAnalyticsEvent('claw_funnel_practice_start', { source });
  }, [x, drop, source]);

  useEffect(() => () => swing.current?.stop(), []);

  const doDrop = useCallback(async () => {
    if (phase !== 'swing') return;
    swing.current?.stop();
    setPhase('drop');
    audioManager.playSfx('tap_nav', 0.3);
    const glass = glassRef.current;
    const head = glass?.querySelector('.cb-cab-head svg')?.getBoundingClientRect();
    const pack = glass?.querySelector('.cb-cab-pile span')?.getBoundingClientRect();
    const depth = head && pack ? Math.max(40, pack.top + pack.height * 0.4 - head.bottom) : 160;
    await animate(drop, depth, { duration: 0.5, ease: 'easeIn' });
    setOpen(false);
    const slot = Math.max(0, Math.min(5, Math.floor(((x.get() - 0.12) / 0.76) * 6)));
    setGrabbed(slot);
    await new Promise(r => setTimeout(r, 220));
    setLifting(true);
    await animate(drop, 0, { duration: 0.6, ease: 'easeOut' });
    audioManager.playSfx('open_case', 0.5);
    setPhase('done');
    logAnalyticsEvent('claw_funnel_practice_grab', { source });
  }, [phase, x, drop, source]);

  return (
    <div className="cb-cab">
      <div className="cb-cab-marquee">
        <span className="cb-cab-bulbs" aria-hidden />
        <b>CLAW</b><i>BOT</i>
      </div>
      <div ref={glassRef} className="cb-cab-glass" onClick={phase === 'swing' ? doDrop : undefined} role="presentation">
        <div className="cb-cab-rays" aria-hidden />
        <div className="cb-cab-rail" aria-hidden />
        <motion.div className="cb-cab-rig" style={{ left }}>
          <motion.div className="cb-cab-cable" style={{ height: cable }} />
          <div className="cb-cab-head">
            <CartoonClaw open={open} />
            <span className="cb-cab-eyes" aria-hidden><i /><i /></span>
            {grabbed !== null && lifting && <span className="cb-cab-held"><MysteryPack accent={MYSTERY_ACCENTS[grabbed]} /></span>}
          </div>
        </motion.div>
        <div className="cb-cab-pile" aria-hidden>
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} style={{ rotate: `${TILTS[i]}deg`, opacity: grabbed === i && lifting ? 0 : 1 }}>
              <MysteryPack accent={MYSTERY_ACCENTS[i]} />
            </span>
          ))}
        </div>

        <AnimatePresence>
          {phase === 'idle' && (
            <motion.div key="idle" className="cb-cab-over" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <p className="cb-cab-free">Free practice drop</p>
              <button type="button" className="cb-btn" onClick={startSwing}>Try the claw</button>
              <p className="cb-cab-note">No sign-in. No prize. Just the feel.</p>
            </motion.div>
          )}
          {phase === 'swing' && (
            <motion.p key="hint" className="cb-cab-hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              Tap anywhere to drop
            </motion.p>
          )}
          {phase === 'done' && (
            <motion.div key="done" className="cb-cab-over cb-cab-win" initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
              <p className="cb-cab-nice">Nice grab.</p>
              <p className="cb-cab-note">In the real machine, that pack is yours to open.</p>
              <div className="cb-cab-actions">
                <button type="button" className="cb-btn" onClick={e => { e.stopPropagation(); onConvert(); }}>Pull for real · {CENTS}</button>
                <button type="button" className="cb-btn cb-btn-ghost" onClick={startSwing}>Again</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="cb-cab-base" aria-hidden><span /><span /><span /></div>
    </div>
  );
}
