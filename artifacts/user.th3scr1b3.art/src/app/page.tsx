'use client';

// user.th3scr1b3.art — identity hub, styled after pim.th3scr1b3.art/launch:
//   Hero (passport card) → manifesto marquee → 01 Access → 02 Activity → 03 Telemetry
//   → 04 Layers → 05 Endpoints → final call.
import { useState, useEffect, useRef, useSyncExternalStore } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { isAllowedRedirectUri } from '../lib/redirect';
import WalletConnect from '../components/WalletConnect';
import IdentityTerminal from '../components/IdentityTerminal';
import ActivityDashboard from '../components/ActivityDashboard';
import { ArrowDown, ArrowLeft, ArrowUpRight, RefreshCw } from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import styles from './page.module.css';
import HoloSheen from '../components/HoloSheen';
import { useHoloTilt } from '../lib/useHoloTilt';

/** Key art and the bombshell cutout are served by PIM; the hub borrows them so both pages share a face. */
const PIM_ORIGIN = 'https://pim.th3scr1b3.art';

const MANIFESTO_A = ['ONE LOGIN', 'EVERY LAYER', 'YOUR SIGNAL'];
const MANIFESTO_B = ['365 SONGS', 'ONE PASSPORT', 'ZERO PASSWORDS'];

/** Day 1 = January 1 2026, same calendar as PIM's dayCalc. */
function getCurrentDay(): number {
  const diff = Date.now() - new Date('2026-01-01T00:00:00').getTime();
  return Math.max(1, Math.min(365, Math.floor(diff / 86_400_000) + 1));
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0');
const noopSubscribe = () => () => {};

function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-10% 0px' }}
      transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

function SectionHead({ index, kicker, title }: { index: string; kicker: React.ReactNode; title: React.ReactNode }) {
  return (
    <div className={styles.sectionHead}>
      <span className={styles.index}>{index}</span>
      <div>
        <div className={styles.kicker}>{kicker}</div>
        <h2 className={styles.h2}>{title}</h2>
      </div>
    </div>
  );
}

export default function Home() {
  const [displayName, setDisplayName] = useState<string>('');
  const [activeUser, setActiveUser] = useState<SupabaseUser | null>(null);
  const [updating, setUpdating] = useState<boolean>(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [redirectUri, setRedirectUri] = useState<string>('');
  const [scrolled, setScrolled] = useState(false);
  // Prerendered as day 1, then the client's real day takes over after hydration.
  const today = useSyncExternalStore(noopSubscribe, getCurrentDay, () => 1);
  const reduce = useReducedMotion() ?? false;

  // 3D passport tilt + holographic sheen (pointer, phone tilt, idle drift)
  const cardRef = useRef<HTMLDivElement>(null);
  const sheenRef = useRef<HTMLDivElement>(null);
  useHoloTilt(cardRef, sheenRef, { maxTilt: 12, idle: true, hit: 'self' });

  const isAnonymousUser = !!activeUser && (
    activeUser.is_anonymous ||
    activeUser.app_metadata?.provider === 'anonymous' ||
    (!activeUser.email && !activeUser.user_metadata?.wallet)
  );
  const isSignedIn = !!activeUser && !isAnonymousUser;

  // Hero scroll parallax
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress: heroP } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const bgY = useTransform(heroP, [0, 1], ['0%', reduce ? '0%' : '30%']);
  const bgScale = useTransform(heroP, [0, 1], [1.08, reduce ? 1.08 : 1.25]);
  const wordY = useTransform(heroP, [0, 1], ['0%', reduce ? '0%' : '-50%']);
  const heroFade = useTransform(heroP, [0, 0.85], [1, 0]);

  // Manifesto marquees
  const manifestoRef = useRef<HTMLElement>(null);
  const { scrollYProgress: manP } = useScroll({ target: manifestoRef, offset: ['start end', 'end start'] });
  const marqueeA = useTransform(manP, [0, 1], ['0%', '-35%']);
  const marqueeB = useTransform(manP, [0, 1], ['-35%', '0%']);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const getAppName = (urlStr: string): string => {
    try {
      const url = new URL(urlStr);
      const host = url.hostname;
      const port = url.port;
      if (host.includes('pim.th3scr1b3.art') || host.includes('vault') || port === '5173') {
        return 'PIM : TH3V4ULT';
      }
      if (host.includes('video.th3scr1b3.art')) {
        return '365 POSTER';
      }
      if (host.includes('mood.th3scr1b3.art')) {
        return 'MOOD BOARD';
      }
      if (host.includes('ce.th3scr1b3.art')) {
        return 'SONG ANALYZER';
      }
      if (host.includes('base.th3scr1b3.art')) {
        return 'BASE MINI-APP';
      }
      if (host.includes('th3scr1b3.art') || port === '3000' || port === '3001') {
        return 'TH3SCR1B3';
      }
      return host.toUpperCase();
    } catch {
      return 'PREVIOUS NODE';
    }
  };

  const getEcosystemLinks = () => {
    if (typeof window === 'undefined') {
      return {
        main: 'https://th3scr1b3.art',
        pim: 'https://pim.th3scr1b3.art',
        base: 'https://base.th3scr1b3.art',
        video: 'https://video.th3scr1b3.art',
        mood: 'https://th3scr1b3.art/mood-map',
        ce: 'https://ce.th3scr1b3.art',
      };
    }
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    return {
      main: isLocal ? 'http://localhost:3000' : 'https://th3scr1b3.art',
      pim: isLocal ? 'http://localhost:5173' : 'https://pim.th3scr1b3.art',
      base: 'https://base.th3scr1b3.art',
      video: 'https://video.th3scr1b3.art',
      mood: 'https://th3scr1b3.art/mood-map',
      ce: 'https://ce.th3scr1b3.art',
    };
  };

  const links = getEcosystemLinks();

  const layers = [
    { n: '01', verb: '365', name: 'th3scr1b3.art', body: 'The main broadcast. One song a day for a year, the warp, the archive and the mood map.', href: links.main, tag: 'MAIN' },
    { n: '02', verb: 'PIM', name: 'PIM : th3v4ult', body: 'The rhythm game. Play each day’s level, rip packs, chase the Bombshell variants.', href: links.pim, tag: 'PLAY' },
    { n: '03', verb: 'Base', name: 'Base mini-app', body: 'The Farcaster frame and on-chain side of the drop, right inside your feed.', href: links.base, tag: 'WEB3' },
    { n: '04', verb: 'Poster', name: '365 Poster', body: 'Every daily release as a poster. The visual archive of the whole year.', href: links.video, tag: 'VISUAL' },
    { n: '05', verb: 'Mood', name: 'Mood map', body: 'Every poem plotted by feeling. Wander light to dark and land on a song.', href: links.mood, tag: 'MOOD' },
    { n: '06', verb: 'CE', name: 'Song analyzer', body: 'The creative engine: audio analysis, lyrics and spectral readouts.', href: links.ce, tag: 'TOOLS' },
  ];

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const uri = params.get('redirect_uri');
      if (uri && isAllowedRedirectUri(uri)) {
        setRedirectUri(uri);
        sessionStorage.setItem('pim_redirect_uri', uri);
      } else {
        const saved = sessionStorage.getItem('pim_redirect_uri');
        if (saved && isAllowedRedirectUri(saved)) {
          setRedirectUri(saved);
        } else {
          sessionStorage.removeItem('pim_redirect_uri');
        }
      }
    }

    const getRedirectUri = (): string | null => {
      const params = new URLSearchParams(window.location.search);
      const fromParams = params.get('redirect_uri');
      if (fromParams && isAllowedRedirectUri(fromParams)) return fromParams;
      const saved = sessionStorage.getItem('pim_redirect_uri');
      return saved && isAllowedRedirectUri(saved) ? saved : null;
    };

    const fetchUserAndProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setActiveUser(session.user);

        const uri = getRedirectUri();
        const isAnon = session.user.is_anonymous ||
                       session.user.app_metadata?.provider === 'anonymous' ||
                       (!session.user.email && !session.user.user_metadata?.wallet);
        if (uri && !isAnon) {
          console.log('[SYSTEM] Active session detected. Redirecting with tokens...');
          sessionStorage.removeItem('pim_redirect_uri');
          const url = new URL(uri);
          url.hash = `access_token=${encodeURIComponent(session.access_token)}&refresh_token=${encodeURIComponent(session.refresh_token)}`;
          window.location.href = url.toString();
          return;
        }

        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', session.user.id)
            .maybeSingle();

          if (profile?.display_name) {
            setDisplayName(profile.display_name);
          }
        } catch {
          // Graceful fallback if profile record does not exist yet
        }
      }
    };

    fetchUserAndProfile();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        setActiveUser(session.user);

        const uri = getRedirectUri();
        const isAnon = session.user.is_anonymous ||
                       session.user.app_metadata?.provider === 'anonymous' ||
                       (!session.user.email && !session.user.user_metadata?.wallet);
        if (uri && !isAnon) {
          console.log('[SYSTEM] Session state changed. Redirecting with tokens...');
          sessionStorage.removeItem('pim_redirect_uri');
          const url = new URL(uri);
          url.hash = `access_token=${encodeURIComponent(session.access_token)}&refresh_token=${encodeURIComponent(session.refresh_token)}`;
          window.location.href = url.toString();
          return;
        }

        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', session.user.id)
            .maybeSingle();
          if (profile?.display_name) {
            setDisplayName(profile.display_name);
          }
        } catch {
          // Graceful fallback
        }
      } else {
        setActiveUser(null);
        setDisplayName('');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const updateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeUser) return;

    setUpdating(true);
    setMessage(null);

    try {
      const { error: metaError } = await supabase.auth.updateUser({
        data: { display_name: displayName }
      });
      if (metaError) throw metaError;

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: activeUser.id,
          display_name: displayName,
        });

      if (profileError) throw profileError;

      setMessage({ text: 'Alias saved. Every layer will show it.', type: 'success' });
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Error updating profile.';
      setMessage({ text: msg, type: 'error' });
    } finally {
      setUpdating(false);
    }
  };

  const walletAddr = activeUser?.user_metadata?.wallet || activeUser?.email;
  const aliasDisplay = displayName || (walletAddr ? walletAddr.slice(0, 10) + '…' : 'Unclaimed');
  const provider = activeUser?.app_metadata?.provider || (isSignedIn ? 'web3' : 'none');
  // Activity only renders with a session, so the sections after it renumber to stay sequential.
  const sectionNo = (n: number) => pad(activeUser || n < 3 ? n : n - 1);

  return (
    <main className={styles.root}>
      <div className={styles.grain} aria-hidden="true" />

      {/* ═════════ TOP BAR ═════════ */}
      <header className={`${styles.topbar} ${scrolled ? styles.topbarScrolled : ''}`}>
        <a href={links.main} className={styles.wordmark} aria-label="th3scr1b3.art home">
          TH3SCR1B3<span>{'// ID'}</span>
        </a>
        <nav className={styles.topbarNav} aria-label="Sections">
          <a href="#access">Access</a>
          {isSignedIn && <a href="#activity">Activity</a>}
          <a href="#layers">Layers</a>
          <a href="#endpoints">API</a>
        </nav>
        {isSignedIn ? (
          <a className={`${styles.btn} ${styles.btnSm}`} href={links.pim}>
            Play PIM <ArrowUpRight size={14} />
          </a>
        ) : (
          <a className={`${styles.btn} ${styles.btnSm}`} href="#access">
            Sign in <ArrowUpRight size={14} />
          </a>
        )}
      </header>

      {redirectUri && (
        <a href={redirectUri} className={styles.returnBanner}>
          <ArrowLeft size={16} />
          <span>Return to {getAppName(redirectUri)}</span>
        </a>
      )}

      {/* ═════════ HERO ═════════ */}
      <section ref={heroRef} className={styles.hero}>
        <motion.div className={styles.heroBg} style={{ y: bgY, scale: bgScale }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${PIM_ORIGIN}/seo/pim-key-art.jpg`} alt="" draggable={false} />
        </motion.div>
        <div className={styles.heroShade} aria-hidden="true" />

        <motion.div className={styles.heroWord} style={{ y: wordY, opacity: heroFade }} aria-hidden="true">
          <span className={styles.wordFill}>ID</span>
          <span className={styles.wordGhost}>ID</span>
        </motion.div>

        <div className={styles.heroGrid}>
          <motion.div className={styles.heroCopy} style={{ opacity: heroFade }}>
            <div className={styles.kicker}>
              <span className={`${styles.liveDot} ${isSignedIn ? styles.liveDotHot : ''}`} />
              TH3SCR1B3 IDENTITY HUB · DAY {pad(today, 3)} / 365
            </div>
            <h1 className={styles.heroTitle}>
              One pass.
              <br />
              <em>Every layer.</em>
            </h1>
            <p className={styles.heroSub}>
              {isSignedIn
                ? 'You’re signed in everywhere. Your plays, runs, cards and sparks from every th3scr1b3 site land here.'
                : 'Sign in once with a Base wallet, GitHub or email and you’re in on the game, the archive, the poster wall and every layer after.'}
            </p>
            <div className={styles.heroCtas}>
              {isSignedIn ? (
                <>
                  <a className={styles.btn} href="#activity">
                    See your activity <ArrowDown size={18} />
                  </a>
                  <a className={`${styles.btn} ${styles.btnGhost}`} href={links.pim}>
                    Play today&rsquo;s drop
                  </a>
                </>
              ) : (
                <>
                  <a className={styles.btn} href="#access">
                    Claim your pass <ArrowDown size={18} />
                  </a>
                  <a className={`${styles.btn} ${styles.btnGhost}`} href="#layers">
                    See the layers
                  </a>
                </>
              )}
            </div>
          </motion.div>

          {/* Passport */}
          <div className={styles.passportStage}>
            <div
              ref={cardRef}
              className={styles.passport}
            >
              <HoloSheen ref={sheenRef} variant="prism" tint="#ff1493" foilZ={3} glareZ={4} />
              <div className={styles.passportTop}>
                <span>PASSPORT</span>
                <span>N° {pad(today, 3)}</span>
              </div>
              <div className={styles.passportArt}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${PIM_ORIGIN}/data/packs/bs_cover.png`} alt="" draggable={false} />
              </div>
              <div className={styles.passportBody}>
                <span className={styles.passportLabel}>HOLDER</span>
                <h2 className={styles.passportAlias}>{aliasDisplay}</h2>
                <div className={styles.passportChips}>
                  <span className={`${styles.chip} ${isSignedIn ? styles.chipPink : styles.chipPaper}`}>
                    {isSignedIn ? 'VERIFIED' : isAnonymousUser ? 'GUEST' : 'NOT SIGNED IN'}
                  </span>
                  <span className={`${styles.chip} ${styles.chipAmber}`}>{provider.toUpperCase()}</span>
                </div>
              </div>
              <div className={styles.passportFoot}>
                <span>USER.TH3SCR1B3.ART</span>
                <span>{isSignedIn ? 'VALID ON ALL LAYERS' : 'AWAITING SIGNATURE'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.heroMeta} aria-hidden="true">
          <span>N° {pad(today, 3)}</span>
          <span>ONE SESSION · {layers.length} LAYERS</span>
          <span>WALLET · GITHUB · EMAIL</span>
        </div>
      </section>

      {/* ═════════ MANIFESTO ═════════ */}
      <section ref={manifestoRef} className={styles.manifesto} aria-hidden="true">
        <motion.div className={styles.marqueeRow} style={{ x: marqueeA }}>
          {[...MANIFESTO_A, ...MANIFESTO_A, ...MANIFESTO_A].map((t, i) => (
            <span key={i} className={styles.marqueeItem}>{t}<span className={styles.marqueeStar}>✦</span></span>
          ))}
        </motion.div>
        <motion.div className={`${styles.marqueeRow} ${styles.marqueeOutline}`} style={{ x: marqueeB }}>
          {[...MANIFESTO_B, ...MANIFESTO_B, ...MANIFESTO_B].map((t, i) => (
            <span key={i} className={styles.marqueeItem}>{t}<span className={styles.marqueeStar}>✦</span></span>
          ))}
        </motion.div>
      </section>

      {/* ═════════ 01. ACCESS ═════════ */}
      <section id="access" className={styles.section}>
        <SectionHead
          index="01"
          kicker={<><span className={`${styles.liveDot} ${isSignedIn ? styles.liveDotHot : ''}`} /> ACCESS · {isSignedIn ? 'SIGNED IN' : 'SIGN IN'}</>}
          title={isSignedIn ? 'You’re in. Name yourself.' : 'Sign in once. Stay in everywhere.'}
        />
        <div className={styles.accessGrid}>
          <Reveal className={styles.slab}>
            <div className={styles.slabHead}>AUTHORIZATION</div>
            <div className={styles.slabBody}>
              <p className={styles.slabDesc}>
                Connect a Base wallet, or use GitHub or an email link. The session follows you to every th3scr1b3.art site.
              </p>
              <WalletConnect redirectUri={redirectUri} />
            </div>
          </Reveal>

          <Reveal className={styles.slab} delay={0.1}>
            <div className={styles.slabHead}>ALIAS</div>
            <div className={styles.slabBody}>
              {isSignedIn ? (
                <form onSubmit={updateProfile} className={styles.profileForm}>
                  <label htmlFor="displayName" className={styles.inputLabel}>
                    Display name / scribe alias
                  </label>
                  <div className={styles.inputRow}>
                    <input
                      type="text"
                      id="displayName"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="scribe_alias"
                      required
                      className={styles.textInput}
                      maxLength={24}
                    />
                    <button type="submit" className={styles.btn} disabled={updating}>
                      {updating ? <RefreshCw className={styles.spin} size={14} /> : 'Save'}
                    </button>
                  </div>
                  <p className={styles.slabDesc}>Shows on leaderboards, the passport and anywhere else you appear.</p>
                  {message && (
                    <div className={message.type === 'success' ? styles.successAlert : styles.errorAlert}>
                      {message.text}
                    </div>
                  )}
                </form>
              ) : (
                <div className={styles.lockedNote}>
                  <span className={styles.lockedBig}>?</span>
                  <p>Sign in to pick the alias that shows on leaderboards and your passport.</p>
                </div>
              )}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═════════ 02. ACTIVITY ═════════ */}
      {activeUser && (
        <section id="activity" className={`${styles.section} ${styles.sectionTint}`}>
          <SectionHead
            index="02"
            kicker="YOUR SIGNAL · EVERY LAYER"
            title="Everything you’ve played, heard and pulled."
          />
          <Reveal className={styles.sectionBody}>
            <ActivityDashboard />
          </Reveal>
        </section>
      )}

      {/* ═════════ 03. TELEMETRY ═════════ */}
      <section className={styles.section}>
        <SectionHead
          index={sectionNo(3)}
          kicker="TELEMETRY STREAM"
          title="The raw feed."
        />
        <Reveal className={styles.sectionBody}>
          <IdentityTerminal />
        </Reveal>
      </section>

      {/* ═════════ 04. LAYERS ═════════ */}
      <section id="layers" className={styles.section}>
        <SectionHead
          index={sectionNo(4)}
          kicker="THE LAYERS · ONE LOGIN OPENS ALL OF THEM"
          title="Where the pass works."
        />
        <div className={styles.layerGrid}>
          {layers.map((l, i) => (
            <Reveal key={l.n} delay={(i % 3) * 0.08} className={styles.layerCell}>
              <a href={l.href} className={styles.layerCard}>
                <span className={styles.layerN}>{l.n} · {l.tag}</span>
                <span className={styles.layerVerb}>{l.verb}</span>
                <h3>{l.name}</h3>
                <p>{l.body}</p>
                <span className={styles.layerGo}>
                  Open <ArrowUpRight size={14} />
                </span>
              </a>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ═════════ 05. ENDPOINTS ═════════ */}
      <section id="endpoints" className={styles.section}>
        <SectionHead
          index={sectionNo(5)}
          kicker="FOR BUILDERS · BEARER JWT"
          title="Endpoints."
        />
        <Reveal className={styles.sectionBody}>
          <div className={styles.apiLog}>
            <div className={styles.apiLogHead}>CROSS-ORIGIN APIS · th3scr1b3.art · base. · pim.</div>
            <ul>
              <li>
                <span className={styles.apiMethod}>GET</span>
                <code>/api/profile</code>
                <span className={styles.apiDesc}>Connected wallet, alias and account metadata.</span>
              </li>
              <li>
                <span className={styles.apiMethod}>GET</span>
                <code>/api/analytics</code>
                <span className={styles.apiDesc}>Play counts from 365 plus PIM high scores and accuracy.</span>
              </li>
              <li>
                <span className={styles.apiMethod}>GET</span>
                <code>/api/collection</code>
                <span className={styles.apiDesc}>The signed-in user&apos;s cards. Only the vault engine grants cards.</span>
              </li>
            </ul>
          </div>
        </Reveal>
      </section>

      {/* ═════════ FINAL CALL ═════════ */}
      <section className={styles.final} style={{ ['--final-art' as string]: `url('${PIM_ORIGIN}/data/packs/bombshell_dark_50cards.jpg')` }}>
        <div className={styles.finalWord} aria-hidden="true">
          TUNE
          <br />
          IN.
        </div>
        <Reveal className={styles.finalInner}>
          <div className={styles.kicker}>DAY {pad(today, 3)} · {365 - today} DROPS REMAIN</div>
          <h2 className={styles.finalTitle}>Today&rsquo;s drop won&rsquo;t wait.</h2>
          <p className={styles.finalSub}>
            {isSignedIn ? 'Your pass already works in the game. Go use it.' : 'Free to play. No download. Sign in whenever you’re ready.'}
          </p>
          <div className={`${styles.heroCtas} ${styles.center}`}>
            <a className={`${styles.btn} ${styles.btnXl}`} href={links.pim}>
              Play PIM now <ArrowUpRight size={20} />
            </a>
            <a className={`${styles.btn} ${styles.btnGhost}`} href={links.main}>
              Back to th3scr1b3.art
            </a>
          </div>
        </Reveal>
      </section>

      <footer className={styles.footer}>
        <span>user.th3scr1b3.art — identity hub</span>
        <span>© 2026 TH3SCR1B3</span>
      </footer>
    </main>
  );
}
