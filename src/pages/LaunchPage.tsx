// LaunchPage — "/launch" marketing launch pad for PIM : th3v4ult.
// Avant-garde, parallax-driven ad page built to convert first-time visitors:
//   1. Hero — layered key art, kinetic PIM wordmark, foreground bombshell cutout
//   2. Manifesto — scroll-linked counter-marquees
//   3. Today's Transmission — live day, live song, live audio, countdown, log
//   4. The Bombshells — pinned horizontal gallery of real variant covers
//   5. Light [1] / Dark [0] — draggable split reveal
//   6. The Loop — play / collect / forge with a live overdrive meter
//   7. Pack wall — six pack tiers drifting at different depths
//   8. Final call
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion';
import { ArrowDown, ArrowUpRight, Pause, Play, Radio, Zap } from 'lucide-react';
import { loadCatalog, isSongTimeLocked, type GameSong } from '../game/api';
import staticSongCatalog from '../data/song_catalog.json';
import { getCurrentDay, getTimeUntilNextDay, formatDate } from '../utils/dayCalc';
import {
  BOMBSHELL_COVERS_MAP,
  BOMBSHELL_DARK_PACK_COVERS,
  BOMBSHELL_LIGHT_PACK_COVERS,
  DEFAULT_BOMBSHELL_PACK_COVER,
  ALL_BOMBSHELL_PACK_COVERS,
  getBombshellCoverCandidates,
} from '../utils/bombshellCards';
import { useGlobalPlayer } from '../store/useGlobalPlayer';
import { useNotificationStore } from '../store/useNotificationStore';
import { transmission } from '../store/useTransmissionStore';
import { useAuthStore } from '../store/useAuthStore';
import { logAnalyticsEvent } from '../services/telemetryService';
import '../styles/LaunchPage.css';

// ── Static data ──────────────────────────────────────────────────────────────

const TOTAL_BOMBSHELL_VARIANTS = Object.values(BOMBSHELL_COVERS_MAP).reduce(
  (sum, d) => sum + d.totalCovers,
  0,
);

/** The 14 best-covered days, in calendar order — the gallery's cast. */
const GALLERY_PICKS = Object.values(BOMBSHELL_COVERS_MAP)
  .filter((d) => d.totalCovers > 0)
  .sort((a, b) => b.totalCovers - a.totalCovers || a.day - b.day)
  .slice(0, 14)
  .sort((a, b) => a.day - b.day)
  .map((d, i) => {
    // Alternate full-frame and letterbox so the wall breathes
    const preferLB = i % 3 === 1 && d.lbFiles.length > 0;
    const file = preferLB ? d.lbFiles[0] : d.normalFiles[0] || d.lbFiles[0];
    return { day: d.day, file, isLB: preferLB, total: d.totalCovers };
  });

const PACK_TIERS = [1, 2, 5, 10, 25, 50] as const;

const MANIFESTO_A = ['PLAY THE MUSIC', 'BUILD THE VAULT', 'FIND THE RARE'];
const MANIFESTO_B = ['365 SONGS', '365 LEVELS', '365 CARDS', `${TOTAL_BOMBSHELL_VARIANTS} BOMBSHELLS`];

const OVERDRIVE = [
  { name: 'FEVER', combo: 20, mult: '2×', color: '#ffb800' },
  { name: 'SURGE', combo: 40, mult: '3×', color: '#ff1493' },
  { name: 'SIGNAL LOCK', combo: 60, mult: '4×', color: '#39ff14' },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

/** <img> that walks a candidate list on error, so remote art degrades to local art. */
function CandidateImg({
  candidates,
  alt,
  className,
  eager,
}: {
  candidates: string[];
  alt: string;
  className?: string;
  eager?: boolean;
}) {
  const [idx, setIdx] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const src = candidates[Math.min(idx, candidates.length - 1)];
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      data-loaded={loaded}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      draggable={false}
      onLoad={() => setLoaded(true)}
      onError={() => setIdx((i) => (i + 1 < candidates.length ? i + 1 : i))}
    />
  );
}

/** Bundled pack art used as the instant placeholder / last-resort fallback for gallery slot i. */
function galleryFallback(i: number): string {
  return ALL_BOMBSHELL_PACK_COVERS[i % ALL_BOMBSHELL_PACK_COVERS.length];
}

/** Public CDN that serves the bombshell covers (same host the PIM MCP server's pim_get_cover_artwork returns). */
const BOMBSHELL_CDN = 'https://files.th3scr1b3.art/rare_covers/';

/** CDN cover first, then the shared helper's candidates (sibling variants), then the bundled pack art. */
function galleryCandidates(day: number, file: string, i: number): string[] {
  const cdn = `${BOMBSHELL_CDN}day%20${day}/${encodeURIComponent(file)}`;
  const remote = getBombshellCoverCandidates(day, file).filter(
    (u) => u !== cdn && u !== DEFAULT_BOMBSHELL_PACK_COVER,
  );
  return [cdn, ...remote.slice(0, 3), galleryFallback(i)];
}

function pad(n: number, w = 2) {
  return String(n).padStart(w, '0');
}

function useCountdown() {
  const [t, setT] = useState(getTimeUntilNextDay);
  useEffect(() => {
    const id = window.setInterval(() => setT(getTimeUntilNextDay()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return t;
}

/** Fades + lifts children in when they enter the viewport. */
function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 48 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-12% 0px' }}
      transition={{ duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

function Marquee({ items, progress, direction, outline }: {
  items: string[];
  progress: MotionValue<number>;
  direction: 1 | -1;
  outline?: boolean;
}) {
  const x = useTransform(progress, [0, 1], direction === 1 ? ['0%', '-35%'] : ['-35%', '0%']);
  const row = [...items, ...items, ...items];
  return (
    <motion.div className={`lp-marquee-row ${outline ? 'is-outline' : ''}`} style={{ x }} aria-hidden="true">
      {row.map((t, i) => (
        <span key={i} className="lp-marquee-item">
          {t}
          <span className="lp-marquee-star">✦</span>
        </span>
      ))}
    </motion.div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function LaunchPage() {
  const [, setLocation] = useLocation();
  const reduce = useReducedMotion() ?? false;
  const today = getCurrentDay();
  const countdown = useCountdown();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'PIM — Play the Music. Build the Vault. Find the Rare.';
    window.scrollTo(0, 0);
    logAnalyticsEvent('launch_page_view', { day: today });
    return () => {
      document.title = prevTitle;
    };
  }, [today]);

  // Every CTA funnels through here so the arcade splash never re-intercepts.
  const go = useCallback(
    (path: string, cta: string) => {
      logAnalyticsEvent('launch_cta', { cta, path });
      useAuthStore.getState().setShowArcadeSplash(false);
      setLocation(path);
    },
    [setLocation],
  );

  // ── Pointer parallax (hero) ───────────────────────────────────────────────
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const smx = useSpring(mx, { stiffness: 60, damping: 18 });
  const smy = useSpring(my, { stiffness: 60, damping: 18 });
  const onHeroPointer = (e: React.PointerEvent) => {
    if (reduce || e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  };
  const artX = useTransform(smx, (v) => v * -30);
  const artY = useTransform(smy, (v) => v * -20);
  const girlX = useTransform(smx, (v) => v * 46);
  const girlRot = useTransform(smx, (v) => v * 6);
  const typeX = useTransform(smx, (v) => v * -14);

  // ── Scroll parallax (hero) ────────────────────────────────────────────────
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress: heroP } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const bgY = useTransform(heroP, [0, 1], ['0%', reduce ? '0%' : '35%']);
  const bgScale = useTransform(heroP, [0, 1], [1.08, reduce ? 1.08 : 1.3]);
  const wordY = useTransform(heroP, [0, 1], ['0%', reduce ? '0%' : '-60%']);
  const girlY = useTransform(heroP, [0, 1], ['0%', reduce ? '0%' : '-28%']);
  const heroFade = useTransform(heroP, [0, 0.85], [1, 0]);

  // ── Manifesto marquees ────────────────────────────────────────────────────
  const manifestoRef = useRef<HTMLElement>(null);
  const { scrollYProgress: manP } = useScroll({ target: manifestoRef, offset: ['start end', 'end start'] });

  return (
    <div className="lp-root">
      <div className="lp-grain" aria-hidden="true" />

      {/* ═════════ TOP BAR ═════════ */}
      <header className={`lp-topbar ${scrolled ? 'is-scrolled' : ''}`}>
        <button className="lp-topbar-logo" onClick={() => go('/', 'logo')} aria-label="PIM home">
          <img src="/data/logos/logo_1.png" alt="PIM : th3v4ult" />
        </button>
        <nav className="lp-topbar-nav" aria-label="Launch page sections">
          <a href="#transmission">Transmission</a>
          <a href="#bombshells">Bombshells</a>
          <a href="#loop">The Loop</a>
        </nav>
        <button className="lp-btn lp-btn-sm" onClick={() => go('/daily', 'topbar_play')}>
          Play free <ArrowUpRight size={14} />
        </button>
      </header>

      {/* ═════════ 1. HERO ═════════ */}
      <section ref={heroRef} className="lp-hero" onPointerMove={onHeroPointer}>
        <motion.div className="lp-hero-bg" style={{ y: bgY, scale: bgScale }}>
          <motion.img src="/seo/pim-key-art.jpg" alt="" style={{ x: artX, y: artY }} draggable={false} />
        </motion.div>
        <div className="lp-hero-shade" aria-hidden="true" />

        <motion.div className="lp-hero-word" style={{ y: wordY, x: typeX, opacity: heroFade }} aria-hidden="true">
          <span className="lp-word-fill">PIM</span>
          <span className="lp-word-ghost">PIM</span>
        </motion.div>

        <motion.div className="lp-hero-girl" style={{ y: girlY, x: girlX, rotate: girlRot }}>
          <img src="/data/packs/bs_cover.png" alt="A PIM Bombshell" draggable={false} />
        </motion.div>

        <motion.div className="lp-hero-copy" style={{ opacity: heroFade }}>
          <div className="lp-kicker">
            <span className="lp-live-dot" /> TH3SCR1B3 PRESENTS · LIVE NOW · DAY {pad(today, 3)} / 365
          </div>
          <h1 className="lp-hero-title">
            Poetry
            <br />
            <em>in motion.</em>
          </h1>
          <p className="lp-hero-sub">
            A rhythm game where every day drops a new song, a new level and a new collectible.
            365 days of light and dark. Miss a day and it&rsquo;s gone from the shelf.
          </p>
          <div className="lp-hero-ctas">
            <button className="lp-btn" onClick={() => go('/daily', 'hero_play')}>
              Play today&rsquo;s drop <ArrowUpRight size={18} />
            </button>
            <a className="lp-btn lp-btn-ghost" href="#transmission">
              <Radio size={16} /> Tune in first
            </a>
          </div>
        </motion.div>

        <div className="lp-hero-meta" aria-hidden="true">
          <span>N° {pad(today, 3)}</span>
          <span>{formatDate(today).toUpperCase()} 2026</span>
          <span>FREE · WEB · FARCASTER · DESKTOP</span>
        </div>
        <a href="#manifesto" className="lp-scroll-cue" aria-label="Scroll down">
          <ArrowDown size={16} />
        </a>
      </section>

      {/* ═════════ 2. MANIFESTO ═════════ */}
      <section id="manifesto" ref={manifestoRef} className="lp-manifesto">
        <Marquee items={MANIFESTO_A} progress={manP} direction={1} />
        <Marquee items={MANIFESTO_B} progress={manP} direction={-1} outline />
        <Reveal className="lp-manifesto-copy">
          <p>
            Not a playlist. Not a feed. <strong>A year-long broadcast</strong> you play with your hands —
            tap, hold, swipe and scratch across a three-lane highway that is literally wired to
            the bass, the mids and the treble. Hit the note and the band plays. Miss it and the room goes quiet.
          </p>
        </Reveal>
      </section>

      {/* ═════════ 3. TRANSMISSION ═════════ */}
      <TransmissionSection today={today} countdown={countdown} onPlayLevel={go} />

      {/* ═════════ 4. BOMBSHELLS ═════════ */}
      <BombshellGallery reduce={reduce} />

      {/* ═════════ 5. LIGHT / DARK ═════════ */}
      <LightDarkSplit />

      {/* ═════════ 6. THE LOOP ═════════ */}
      <LoopSection onGo={go} />

      {/* ═════════ 7. PACK WALL ═════════ */}
      <PackWall reduce={reduce} />

      {/* ═════════ 8. FINAL CALL ═════════ */}
      <section className="lp-final">
        <div className="lp-final-word" aria-hidden="true">
          TUNE
          <br />
          IN.
        </div>
        <Reveal className="lp-final-inner">
          <div className="lp-kicker">NEXT TRANSMISSION IN {pad(countdown.hours)}:{pad(countdown.minutes)}:{pad(countdown.seconds)}</div>
          <h2 className="lp-final-title">Today&rsquo;s drop won&rsquo;t wait.</h2>
          <p className="lp-final-sub">Free to play. No download. Your first card is on the house.</p>
          <div className="lp-hero-ctas lp-center">
            <button className="lp-btn lp-btn-xl" onClick={() => go('/daily', 'final_play')}>
              Play PIM now <ArrowUpRight size={20} />
            </button>
            <button className="lp-btn lp-btn-ghost" onClick={() => go('/bombshells', 'final_bombshells')}>
              Browse the Bombshells
            </button>
          </div>
        </Reveal>
      </section>

      <footer className="lp-footer">
        <span>PIM : th3v4ult — poetry in motion</span>
        <span>© 2026 TH3SCR1B3</span>
        <button onClick={() => go('/legal', 'footer_legal')}>Legal</button>
      </footer>
    </div>
  );
}

// ── 3. Today's Transmission (live) ──────────────────────────────────────────

function TransmissionSection({
  today,
  countdown,
  onPlayLevel,
}: {
  today: number;
  countdown: { hours: number; minutes: number; seconds: number };
  onPlayLevel: (path: string, cta: string) => void;
}) {
  // Seed from the bundled catalog so the signal is instant, then upgrade to the live catalog.
  const [catalog, setCatalog] = useState<GameSong[] | null>(
    () => (Array.isArray(staticSongCatalog) ? (staticSongCatalog as unknown as GameSong[]) : null),
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    loadCatalog()
      .then((songs) => alive && songs.length > 0 && setCatalog(songs))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  const song = useMemo(() => {
    if (!catalog) return null;
    return (
      catalog.find((s) => s.day === today) ||
      [...catalog].filter((s) => !isSongTimeLocked(s)).sort((a, b) => b.day - a.day)[0] ||
      null
    );
  }, [catalog, today]);

  const recent = useMemo(() => {
    if (!catalog || !song) return [];
    return catalog
      .filter((s) => s.day < song.day && s.day >= song.day - 4)
      .sort((a, b) => b.day - a.day);
  }, [catalog, song]);

  // Live player wiring — the global singleton, so playback survives navigating into the game.
  const currentTrack = useGlobalPlayer((s) => s.currentTrack);
  const isPlaying = useGlobalPlayer((s) => s.isPlaying);
  const progress = useGlobalPlayer((s) => s.progress);
  const currentTime = useGlobalPlayer((s) => s.currentTime);
  const play = useGlobalPlayer((s) => s.play);
  const pause = useGlobalPlayer((s) => s.pause);

  const isThisTrack = !!song && currentTrack?.day === song.day;
  const live = isThisTrack && isPlaying;

  const toggle = useCallback(
    (s: GameSong | null = song) => {
      if (!s) return;
      if (currentTrack?.day === s.day && isPlaying) {
        pause();
        return;
      }
      play({
        id: s.id,
        title: s.title,
        artist: s.artist || 'TH3SCR1B3',
        audioUrl: s.audioUrl,
        coverUrl: s.coverArt || '',
        day: s.day,
        rarity: s.mood === 'light' ? 'uncommon' : 'rare',
        maxDuration: 0,
      });
      logAnalyticsEvent('launch_transmission_play', { day: s.day });
    },
    [song, currentTrack, isPlaying, play, pause],
  );

  // Announcement feed from the live system_announcements table (App subscribes realtime).
  const announcements = useNotificationStore((s) => s.announcements);
  const fetchAnnouncements = useNotificationStore((s) => s.fetchAnnouncements);
  useEffect(() => {
    if (announcements.length === 0) fetchAnnouncements().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // HUD transmission toast — fires once when the signal section is first seen.
  const sectionRef = useRef<HTMLElement>(null);
  const announced = useRef(false);
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || !song) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || announced.current) return;
        announced.current = true;
        transmission.telemetry(
          'Incoming transmission',
          `Day ${pad(song.day, 3)} · ${song.title} is live.`,
          {
            badgeText: 'SIGNAL ACQUIRED',
            duration: 6500,
            action: { label: 'Tune in', onClick: () => toggle(song) },
          },
        );
      },
      { threshold: 0.45 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [song, toggle]);

  const accent = song?.mood === 'light' ? '#ffb800' : '#ff1493';
  const fmt = (sec: number) => `${Math.floor(sec / 60)}:${pad(Math.floor(sec % 60))}`;
  const duration = song?.duration || 0;

  return (
    <section id="transmission" ref={sectionRef} className="lp-tx" style={{ ['--tx-accent' as string]: accent }}>
      <div className="lp-section-head">
        <span className="lp-index">03</span>
        <div>
          <div className="lp-kicker">
            <span className={`lp-live-dot ${live ? 'is-hot' : ''}`} /> TODAY&rsquo;S TRANSMISSION · ON AIR
          </div>
          <h2 className="lp-h2">One song. One level. One card. Every single day.</h2>
        </div>
      </div>

      <div className="lp-tx-grid">
        {/* Cover / turntable */}
        <Reveal className="lp-tx-cover-wrap">
          <button
            className={`lp-tx-cover ${live ? 'is-live' : ''}`}
            onClick={() => toggle()}
            disabled={!song}
            aria-label={live ? 'Pause today’s transmission' : 'Play today’s transmission'}
          >
            {song?.coverArt ? (
              <CandidateImg
                candidates={[song.coverArt, '/seo/pim-key-art.jpg']}
                alt={`${song.title} cover art`}
                className="lp-tx-cover-img"
              />
            ) : (
              <img src="/seo/pim-key-art.jpg" alt="" className="lp-tx-cover-img" />
            )}
            <span className="lp-tx-cover-play">{live ? <Pause size={34} /> : <Play size={34} />}</span>
            <span className="lp-tx-cover-day">DAY {pad(song?.day ?? today, 3)}</span>
          </button>
          <div className="lp-tx-bars" aria-hidden="true">
            {Array.from({ length: 32 }).map((_, i) => (
              <span key={i} className={live ? 'is-live' : ''} style={{ animationDelay: `${(i * 73) % 900}ms` }} />
            ))}
          </div>
        </Reveal>

        {/* Readout */}
        <Reveal className="lp-tx-readout" delay={0.1}>
          {!song && !failed && <div className="lp-tx-loading">ACQUIRING SIGNAL…</div>}
          {!song && failed && (
            <div className="lp-tx-loading">SIGNAL LOST — the vault still has 365 tracks waiting.</div>
          )}
          {song && (
            <>
              <div className="lp-tx-meta-top">
                <span className="lp-chip" style={{ background: accent }}>{song.mood === 'light' ? 'LIGHT [1]' : 'DARK [0]'}</span>
                <span>{formatDate(song.day).toUpperCase()}</span>
                <span>{song.artist || 'TH3SCR1B3'}</span>
              </div>
              <h3 className="lp-tx-title">{song.title}</h3>
              {song.description && <p className="lp-tx-desc">{song.description}</p>}

              <dl className="lp-tx-stats">
                <div><dt>BPM</dt><dd>{song.bpm || '—'}</dd></div>
                <div><dt>KEY</dt><dd>{song.key || '—'}</dd></div>
                <div><dt>DIFF</dt><dd>{song.difficultyLevel ? `${song.difficultyLevel}/10` : '—'}</dd></div>
                <div><dt>GENRE</dt><dd>{song.genre?.[0] || '—'}</dd></div>
              </dl>

              {/* Transport */}
              <div className="lp-tx-transport">
                <button className="lp-tx-playbtn" onClick={() => toggle()}>
                  {live ? <Pause size={18} /> : <Play size={18} />}
                  {live ? 'Pause' : isThisTrack ? 'Resume' : 'Listen now'}
                </button>
                <div className="lp-tx-progress" aria-hidden="true">
                  <div className="lp-tx-progress-fill" style={{ width: `${isThisTrack ? progress * 100 : 0}%` }} />
                </div>
                <span className="lp-tx-time">
                  {fmt(isThisTrack ? currentTime : 0)} / {duration ? fmt(duration) : '—'}
                </span>
              </div>

              <div className="lp-tx-actions">
                <button className="lp-btn" onClick={() => onPlayLevel(`/play/${song.id}`, 'tx_play_level')}>
                  Play this level <ArrowUpRight size={16} />
                </button>
                <button className="lp-btn lp-btn-ghost" onClick={() => onPlayLevel('/vault/claim', 'tx_claim')}>
                  Claim today&rsquo;s card
                </button>
              </div>
            </>
          )}

          <div className="lp-tx-countdown">
            <span className="lp-tx-countdown-label">NEXT TRANSMISSION</span>
            <span className="lp-tx-countdown-digits">
              {pad(countdown.hours)}<i>:</i>{pad(countdown.minutes)}<i>:</i>{pad(countdown.seconds)}
            </span>
            <span className="lp-tx-countdown-label">{365 - today} DROPS REMAIN</span>
          </div>
        </Reveal>

        {/* Transmission log */}
        <Reveal className="lp-tx-log" delay={0.2}>
          <div className="lp-tx-log-head">
            <Radio size={14} /> TRANSMISSION LOG
          </div>
          <ul>
            {announcements.slice(0, 2).map((a) => (
              <li key={a.id} className="is-announce">
                <span className="lp-tx-log-tag">{a.category.toUpperCase()}</span>
                <span className="lp-tx-log-title">{a.title}</span>
                <span className="lp-tx-log-sub">{a.message}</span>
              </li>
            ))}
            {recent.map((s) => {
              const isCur = currentTrack?.day === s.day && isPlaying;
              return (
                <li key={s.id}>
                  <button onClick={() => toggle(s)} aria-label={`${isCur ? 'Pause' : 'Play'} day ${s.day}: ${s.title}`}>
                    <span className="lp-tx-log-tag">D{pad(s.day, 3)}</span>
                    <span className="lp-tx-log-title">{s.title}</span>
                    <span className="lp-tx-log-icon">{isCur ? <Pause size={13} /> : <Play size={13} />}</span>
                  </button>
                </li>
              );
            })}
            {recent.length === 0 && announcements.length === 0 && (
              <li className="lp-tx-log-empty">Previous transmissions load with the signal.</li>
            )}
          </ul>
          <button className="lp-tx-log-more" onClick={() => onPlayLevel('/365', 'tx_archive')}>
            Open the 365 archive <ArrowUpRight size={13} />
          </button>
        </Reveal>
      </div>
    </section>
  );
}

// ── 4. Bombshell gallery (pinned horizontal scroll) ─────────────────────────

function BombshellGallery({ reduce }: { reduce: boolean }) {
  const outerRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [travel, setTravel] = useState(0);

  useEffect(() => {
    const measure = () => {
      const track = trackRef.current;
      if (!track) return;
      setTravel(Math.max(0, track.scrollWidth - window.innerWidth));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (trackRef.current) ro.observe(trackRef.current);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  const { scrollYProgress } = useScroll({ target: outerRef, offset: ['start start', 'end end'] });
  const x = useTransform(scrollYProgress, [0, 1], [0, -travel]);
  const smoothX = useSpring(x, { stiffness: 120, damping: 30, mass: 0.4 });
  const counter = useTransform(scrollYProgress, (v) => pad(Math.min(GALLERY_PICKS.length, Math.max(1, Math.ceil(v * GALLERY_PICKS.length))), 2));
  const bar = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);

  const pinned = !reduce;

  return (
    <section
      id="bombshells"
      ref={outerRef}
      className={`lp-bomb ${pinned ? 'is-pinned' : ''}`}
      style={pinned ? { height: `calc(100vh + ${travel}px)` } : undefined}
    >
      <div className="lp-bomb-sticky">
        <div className="lp-bomb-head">
          <span className="lp-index">04</span>
          <div>
            <div className="lp-kicker">THE BOMBSHELL SET · VARIANT COVERS</div>
            <h2 className="lp-h2 lp-bomb-h2">
              <span className="lp-bomb-count">{TOTAL_BOMBSHELL_VARIANTS.toLocaleString()}</span> covers.
              <br />Every one a pull.
            </h2>
          </div>
          <div className="lp-bomb-progress" aria-hidden="true">
            <motion.span>{counter}</motion.span> / {pad(GALLERY_PICKS.length)}
            <div className="lp-bomb-bar"><motion.div style={{ width: bar }} /></div>
          </div>
        </div>

        <div className={`lp-bomb-viewport ${pinned ? '' : 'is-scrollable'}`}>
          <motion.div ref={trackRef} className="lp-bomb-track" style={pinned ? { x: smoothX } : undefined}>
            <div className="lp-bomb-intro">
              <p>
                Every day of the year ships with its own <strong>Bombshell</strong> variants — full-frame and
                letterbox, light and dark. Pull them from packs, fuse duplicates, chase the full month.
              </p>
              <span className="lp-bomb-hint">Keep scrolling →</span>
            </div>
            {GALLERY_PICKS.map((p, i) => (
              <figure
                key={p.day}
                className={`lp-bomb-card ${p.isLB ? 'is-lb' : ''} ${i % 2 ? 'is-low' : ''}`}
                style={{ ['--tilt' as string]: `${(i % 2 ? 1 : -1) * (1.5 + (i % 3))}deg` }}
              >
                <div className="lp-bomb-frame" style={{ backgroundImage: `url('${galleryFallback(i)}')` }}>
                  <CandidateImg candidates={galleryCandidates(p.day, p.file, i)} alt={`Bombshell variant, day ${p.day}`} />
                  <span className="lp-bomb-holo" aria-hidden="true" />
                </div>
                <figcaption>
                  <span className="lp-bomb-day">DAY {pad(p.day, 3)}</span>
                  <span>{p.isLB ? 'LETTERBOX' : 'FULL FRAME'} · {p.total} VARIANTS</span>
                </figcaption>
                <span className="lp-bomb-num" aria-hidden="true">{pad(i + 1)}</span>
              </figure>
            ))}
            <div className="lp-bomb-outro">
              <span>+{(TOTAL_BOMBSHELL_VARIANTS - GALLERY_PICKS.length).toLocaleString()}</span>
              <p>more waiting in the vault.</p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ── 5. Light / Dark split reveal ────────────────────────────────────────────

function LightDarkSplit() {
  const [split, setSplit] = useState(50);
  const boxRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const setFromPointer = (clientX: number) => {
    const r = boxRef.current?.getBoundingClientRect();
    if (!r) return;
    setSplit(Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)));
  };

  return (
    <section className="lp-split">
      <div className="lp-section-head">
        <span className="lp-index">05</span>
        <div>
          <div className="lp-kicker">EVERY DAY HAS TWO FACES</div>
          <h2 className="lp-h2">
            Light <span className="lp-split-bit">[1]</span> / Dark <span className="lp-split-bit">[0]</span>
          </h2>
        </div>
      </div>

      <Reveal>
        <div
          ref={boxRef}
          className="lp-split-box"
          style={{ ['--split' as string]: `${split}%` }}
          onPointerDown={(e) => {
            dragging.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            setFromPointer(e.clientX);
          }}
          onPointerMove={(e) => dragging.current && setFromPointer(e.clientX)}
          onPointerUp={() => (dragging.current = false)}
          onPointerCancel={() => (dragging.current = false)}
        >
          <div className="lp-split-panes">
            {PACK_TIERS.slice(0, 3).map((n) => (
              <div key={n} className="lp-split-pane">
                <img className="lp-split-dark" src={BOMBSHELL_DARK_PACK_COVERS[n] || DEFAULT_BOMBSHELL_PACK_COVER} alt={`Dark edition bombshell, ${n}-card pack`} draggable={false} />
                <img className="lp-split-light" src={BOMBSHELL_LIGHT_PACK_COVERS[n] || DEFAULT_BOMBSHELL_PACK_COVER} alt={`Light edition bombshell, ${n}-card pack`} draggable={false} />
              </div>
            ))}
          </div>
          <div className="lp-split-handle" aria-hidden="true"><span>⟷</span></div>
          <span className="lp-split-label is-light">LIGHT</span>
          <span className="lp-split-label is-dark">DARK</span>
          <input
            className="lp-split-range"
            type="range"
            min={0}
            max={100}
            value={Math.round(split)}
            onChange={(e) => setSplit(Number(e.target.value))}
            aria-label="Reveal light or dark edition"
          />
        </div>
      </Reveal>
      <p className="lp-split-caption">
        Drag across. Light songs pull light editions, dark songs pull dark ones — own both faces of a day to master it.
      </p>
    </section>
  );
}

// ── 6. The Loop ─────────────────────────────────────────────────────────────

function LoopSection({ onGo }: { onGo: (path: string, cta: string) => void }) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.8', 'end 0.4'] });
  const combo = useTransform(scrollYProgress, [0, 1], [0, 72]);
  const [comboNow, setComboNow] = useState(0);
  useEffect(() => combo.on('change', (v) => setComboNow(Math.round(Math.max(0, v)))), [combo]);
  const tier = [...OVERDRIVE].reverse().find((t) => comboNow >= t.combo);

  const steps = [
    {
      n: '01',
      verb: 'Play',
      title: 'The highway hears you.',
      body: 'Three lanes, three frequency bands. Tap, hold, swipe in eight directions, scratch, dodge mines. Miss and that slice of the mix drops out.',
      path: '/arcade',
      cta: 'Enter the arcade',
    },
    {
      n: '02',
      verb: 'Collect',
      title: 'Rip packs. Hunt rares.',
      body: 'Every clear earns sparks. Tear open holographic packs, chase legendary and mythic foils, and claim the daily card before midnight.',
      path: '/vault',
      cta: 'Open the vault',
    },
    {
      n: '03',
      verb: 'Forge',
      title: 'Burn, fuse, ascend.',
      body: 'Burn duplicates into V⚡, fuse three of a kind into a higher tier, or spend sparks to pull any card from the 365 archive.',
      path: '/forge',
      cta: 'Visit the forge',
    },
  ];

  return (
    <section id="loop" ref={ref} className="lp-loop">
      <div className="lp-section-head">
        <span className="lp-index">06</span>
        <div>
          <div className="lp-kicker">THE LOOP</div>
          <h2 className="lp-h2">Play the music. Build the vault. Find the rare.</h2>
        </div>
      </div>

      <div className="lp-loop-grid">
        {steps.map((s, i) => (
          <Reveal key={s.n} delay={i * 0.08} className="lp-loop-card">
            <span className="lp-loop-n">{s.n}</span>
            <span className="lp-loop-verb">{s.verb}</span>
            <h3>{s.title}</h3>
            <p>{s.body}</p>
            <button onClick={() => onGo(s.path, `loop_${s.verb.toLowerCase()}`)}>
              {s.cta} <ArrowUpRight size={14} />
            </button>
            {i === 0 && (
              <div className="lp-highway" aria-hidden="true">
                {[0, 1, 2].map((lane) => (
                  <div key={lane} className="lp-lane">
                    {[0, 1, 2].map((k) => (
                      <span key={k} style={{ animationDelay: `${lane * 0.37 + k * 0.62}s` }} />
                    ))}
                  </div>
                ))}
              </div>
            )}
          </Reveal>
        ))}
      </div>

      {/* Scroll-driven overdrive meter */}
      <div className="lp-overdrive" style={{ ['--od' as string]: tier?.color || '#ffffff' }}>
        <div className="lp-overdrive-combo">
          <span className="lp-overdrive-num">{comboNow}</span>
          <span className="lp-overdrive-x">COMBO</span>
        </div>
        <div className="lp-overdrive-track">
          <div className="lp-overdrive-fill" style={{ width: `${Math.min(100, (comboNow / 72) * 100)}%` }} />
          {OVERDRIVE.map((t) => (
            <div
              key={t.name}
              className={`lp-overdrive-tick ${comboNow >= t.combo ? 'is-on' : ''}`}
              style={{ left: `${(t.combo / 72) * 100}%`, ['--c' as string]: t.color }}
            >
              <span>{t.name}</span>
              <em>{t.mult}</em>
            </div>
          ))}
        </div>
        <div className="lp-overdrive-state">
          <Zap size={16} /> {tier ? `${tier.name} · ${tier.mult} SCORE` : 'BUILD THE COMBO'}
        </div>
      </div>
    </section>
  );
}

// ── 7. Pack wall ────────────────────────────────────────────────────────────

function PackCard({ n, i, progress, speed }: { n: number; i: number; progress: MotionValue<number>; speed: number }) {
  const y = useTransform(progress, [0, 1], [speed, -speed]);
  return (
    <motion.div className="lp-pack" style={{ y, ['--r' as string]: `${(i - 2.5) * 3}deg` }}>
      <img
        src={(i % 2 ? BOMBSHELL_LIGHT_PACK_COVERS : BOMBSHELL_DARK_PACK_COVERS)[n]}
        alt={`${n}-card bombshell pack`}
        loading="lazy"
        draggable={false}
      />
      <span className="lp-pack-label">{n}×</span>
    </motion.div>
  );
}

const PACK_SPEEDS = [-140, 90, -60, 160, -110, 70];

function PackWall({ reduce }: { reduce: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });

  return (
    <section ref={ref} className="lp-packs">
      <div className="lp-packs-word" aria-hidden="true">RIP&nbsp;IT</div>
      <div className="lp-packs-row">
        {PACK_TIERS.map((n, i) => (
          <PackCard key={n} n={n} i={i} progress={scrollYProgress} speed={reduce ? 0 : PACK_SPEEDS[i]} />
        ))}
      </div>
      <Reveal className="lp-packs-copy">
        <h2 className="lp-h2">Six pack tiers. One to fifty cards.</h2>
        <p>Light and dark editions, cinematic tear animations and foil reveals. The bigger the rip, the louder the room.</p>
      </Reveal>
    </section>
  );
}
