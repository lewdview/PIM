import { Route, Switch, useLocation } from 'wouter';
import { useEffect, useState, useRef, Suspense, lazy } from 'react';
import { useAuthStore } from './store/useAuthStore';
import { logAnalyticsEvent } from './services/telemetryService';
import { useVaultStore } from './store/useVaultStore';
import { useGlobalPlayer } from './store/useGlobalPlayer';
import BackgroundMusic from './components/audio/BackgroundMusic';
import GamepadCursor from './components/ui/GamepadCursor';
import './styles/CardShowcaseStyles.css';

// Component imports
import Navbar from './components/Navbar';
import LoadingToast from './components/LoadingToast';
import GlobalPlayerBar from './components/GlobalPlayerBar';
import OnboardingFlow from './components/OnboardingFlow';
import AuthModal from './components/AuthModal';

// Core Page imports (eager)
import RhythmHome from './pages/RhythmHome';
import SongSelect from './pages/SongSelect';
import GameResults from './pages/GameResults';
import HomePage from './pages/HomePage';
import CollectionPage from './pages/CollectionPage';
import PackRevealPage from './pages/PackRevealPage';
import ForgePage from './pages/ForgePage';
import LeaderboardPage from './pages/LeaderboardPage';
import CodexPage from './pages/CodexPage';
import ClaimPage from './pages/ClaimPage';
import LegalPage from './pages/LegalPage';
import VoyeurPage from './pages/VoyeurPage';
import Campaign from './pages/Campaign';
import Chapter from './pages/Chapter';
import Tutorial from './pages/Tutorial';
import OptionsModal from './components/OptionsModal';
import SongDetail from './pages/SongDetail';
import LandingPage from './pages/LandingPage';
import NextGenLandingPage from './pages/NextGenLandingPage';
import ProfilePage from './pages/ProfilePage';
import ListenPage from './pages/ListenPage';
import EarnPage from './pages/EarnPage';
import { NotificationModal } from './components/NotificationModal';
import { SystemAlertBanner } from './components/SystemAlertBanner';
import { useNotificationStore } from './store/useNotificationStore';
import { getCurrentDay } from './utils/dayCalc';

// Helper to auto-retry and cache-bust lazy route chunk imports on version deployment updates
function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      return await factory();
    } catch (error: any) {
      const msg = error?.message || String(error);
      const isMimeOrChunkError =
        msg.includes('text/html') ||
        msg.includes('MIME type') ||
        msg.includes('Failed to fetch dynamically imported module') ||
        msg.includes('error loading dynamically imported module') ||
        msg.includes('Importing a module script failed');

      if (isMimeOrChunkError) {
        const lastReload = sessionStorage.getItem('chunk_retry_timestamp');
        const now = Date.now();
        if (!lastReload || now - parseInt(lastReload, 10) > 8000) {
          sessionStorage.setItem('chunk_retry_timestamp', now.toString());
          console.warn('[Chunk Loader] Stale chunk detected, refreshing page to load updated assets...', error);
          window.location.reload();
          return new Promise<{ default: T }>(() => {});
        }
      }
      throw error;
    }
  });
}

// Heavy Page imports (lazy-loaded with auto-recovery to reduce bundle size and boot time)
const GamePlay = lazyWithRetry(() => import('./pages/GamePlay'));
const AdminPage = lazyWithRetry(() => import('./pages/AdminPage'));
const BeatmapEditor = lazyWithRetry(() => import('./pages/BeatmapEditor'));
const CardDesignShowcase = lazyWithRetry(() => import('./pages/CardDesignShowcase'));
const PitchDeck = lazyWithRetry(() => import('./pages/PitchDeck'));
const SlideshowPage = lazyWithRetry(() => import('./pages/SlideshowPage'));
const HeroLandingPage = lazyWithRetry(() => import('./pages/HeroLandingPage'));
import { loadOpts } from './lib/options';
import { CHAPTERS } from './game/campaign';

function getMonthNumFromDay(day: number): number {
  if (day >= 335) return 12;
  if (day >= 305) return 11;
  if (day >= 274) return 10;
  if (day >= 244) return 9;
  if (day >= 213) return 8;
  if (day >= 182) return 7;
  if (day >= 152) return 6;
  if (day >= 121) return 5;
  if (day >= 91)  return 4;
  if (day >= 60)  return 3;
  if (day >= 32)  return 2;
  return 1;
}

function getLocalCurrentDay(): number {
  const EPOCH = new Date('2026-01-01T00:00:00');
  const now = new Date();
  const diff = now.getTime() - EPOCH.getTime();
  const day = Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, Math.min(365, day));
}

function GlobalMenuBackground() {
  const [bg, setBg] = useState('cover_blur');
  const [isLegacy, setIsLegacy] = useState(false);
  const [location] = useLocation();
  const [dailyCover, setDailyCover] = useState<string | null>(null);
  const currentTrack = useGlobalPlayer(s => s.currentTrack);

  useEffect(() => {
    try {
      const opts = loadOpts();
      setBg(opts.gameBackground || 'cover_blur');
      setIsLegacy(opts.legacyGraphics || false);
    } catch (e) {
      // ignore
    }
  }, [location]);

  // Load fallback daily card cover art in background with smart fallback
  useEffect(() => {
    let cancelled = false;
    import('./utils/dayCalc').then(({ getCurrentDay }) => {
      import('./services/vaultService').then(({ getCardByDay }) => {
        getCardByDay(getCurrentDay()).then(card => {
          if (cancelled || !card) return;
          const cover = card.coverUrl || (card as any).coverArt;
          if (cover) {
            import('./utils/rarityArtwork').then(({ getSmartCoverCandidates }) => {
              const candidates = getSmartCoverCandidates(cover, card.rarity);
              if (candidates.length > 0) {
                // Test first candidate or fallback sequentially
                let idx = 0;
                const tryNext = () => {
                  if (idx >= candidates.length) {
                    setDailyCover(cover);
                    return;
                  }
                  const img = new Image();
                  img.onload = () => {
                    if (!cancelled) setDailyCover(candidates[idx]);
                  };
                  img.onerror = () => {
                    idx++;
                    tryNext();
                  };
                  img.src = candidates[idx];
                };
                tryNext();
              } else {
                setDailyCover(cover);
              }
            });
          }
        });
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const hideBg =
    location.startsWith('/play/') ||
    location === '/tutorial' ||
    location.startsWith('/results/');

  if (hideBg || isLegacy) return null;

  const sessionCover = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('active_game_cover') : null;
  const activeCoverUrl = currentTrack?.coverUrl || sessionCover || dailyCover || '/data/covers/default.jpg';
  const songDay = currentTrack?.day || getLocalCurrentDay();
  const monthNum = getMonthNumFromDay(songDay);
  const activeChapter = CHAPTERS.find(c => c.month === monthNum);
  const activeGlowColor = activeChapter?.dc || '#ff3800';

  return (
    <>
      {bg === 'cover_blur' && (
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none bg-[#050402]">
          {/* Blurred Background Artwork */}
          <div 
            className="absolute inset-0 transition-all duration-1000 ease-in-out filter blur-[10px] brightness-[0.25] scale-[1.35] opacity-80"
            style={{
              backgroundImage: `url(${activeCoverUrl})`,
              backgroundPosition: 'center',
              backgroundSize: 'cover'
            }}
          />
          {/* Slow pulsing radial glow of the active mood color */}
          <div 
            className="absolute inset-0 opacity-55 mix-blend-screen animate-pulse duration-[8000ms]"
            style={{
              background: `radial-gradient(circle at 50% 50%, ${activeGlowColor}1a 0%, transparent 85%)`
            }}
          />
          {/* Ambient overlay grid lines */}
          <div 
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: 'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)',
              backgroundSize: '48px 48px'
            }}
          />
        </div>
      )}

      {bg !== 'cover_blur' && (
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden opacity-[0.18] select-none" style={{ mixBlendMode: 'screen' }}>
          {bg === 'neon_grid' && (
            <div className="absolute inset-0 overflow-hidden bg-neon-grid-container">
              <div className="bg-neon-grid-sun" style={{ opacity: 0.12 }} />
              <div className="bg-neon-grid-grid" />
              <div className="bg-neon-grid-horizon" />
            </div>
          )}
          {bg === 'cyber_streets' && (
            <div className="absolute inset-0 overflow-hidden bg-cyber-streets-container">
              <div className="cyber-streets-grille" style={{ opacity: 0.05 }} />
              {Array.from({ length: 12 }).map((_, i) => {
                const delay = `${(i * 0.4) % 5}s`;
                const duration = `${4 + (i % 4) * 2}s`;
                const opacity = 0.08 + ((i * 3) % 6) * 0.04;
                const left = `${i * 8.5 + 2}%`;
                const chars = ["P", "I", "M", "0", "1", "X", "Y"];
                const content = Array.from({ length: 20 }).map((_, charIdx) => {
                  const ch = chars[(i + charIdx * 7) % chars.length];
                  return <span key={charIdx} className="matrix-char" style={{ color: '#39FF14' }}>{ch}</span>;
                });
                return (
                  <div
                    key={i}
                    className="matrix-rain"
                    style={{ left, animationDelay: delay, animationDuration: duration, opacity, fontSize: '10px' }}
                  >
                    {content}
                  </div>
                );
              })}
            </div>
          )}
          {bg === 'space_nebula' && (
            <div className="absolute inset-0 overflow-hidden bg-space-nebula-container" style={{ filter: 'brightness(0.6)' }}>
              <div className="space-stars space-stars-back" />
              <div className="space-stars space-stars-mid" style={{ opacity: 0.4 }} />
              <div className="space-nebula-cloud1" style={{ opacity: 0.5 }} />
              <div className="space-nebula-cloud2" style={{ opacity: 0.5 }} />
            </div>
          )}
          {bg === 'sunset_skyline' && (
            <div className="absolute inset-0 overflow-hidden bg-sunset-skyline-container" style={{ filter: 'brightness(0.5)' }}>
              <div className="sunset-sun" style={{ opacity: 0.1 }} />
              <div className="sunset-city-grid" style={{ opacity: 0.6 }} />
              <div className="sunset-mountains" style={{ opacity: 0.5 }} />
            </div>
          )}
          {bg === 'glitch_matrix' && (
            <div className="absolute inset-0 overflow-hidden bg-glitch-matrix-container" style={{ opacity: 0.6 }}>
              <div className="glitch-grid" style={{ opacity: 0.2 }} />
              <div className="glitch-static" style={{ opacity: 0.04 }} />
              <div className="glitch-bar1" style={{ opacity: 0.3 }} />
            </div>
          )}
          {bg === 'cyber_cityscape' && (
            <div className="absolute inset-0 overflow-hidden bg-cyber-cityscape-container" style={{ filter: 'brightness(0.5)' }}>
              <div className="cityscape-stars" />
              <div className="cityscape-buildings" style={{ opacity: 0.5 }} />
            </div>
          )}
          {bg === 'toxic_hazard' && (
            <div className="absolute inset-0 overflow-hidden bg-toxic-hazard-container" style={{ opacity: 0.5 }}>
              <div className="toxic-grid-mesh" style={{ opacity: 0.3 }} />
              <div className="toxic-hazard-stripes" style={{ opacity: 0.1 }} />
            </div>
          )}
          {bg === 'prismatic_aurora' && (
            <div className="absolute inset-0 overflow-hidden bg-prismatic-aurora-container" style={{ filter: 'brightness(0.6)' }}>
              <div className="aurora-wave wave-1" style={{ opacity: 0.5 }} />
              <div className="aurora-wave wave-2" style={{ opacity: 0.5 }} />
              <div className="aurora-stars" style={{ opacity: 0.4 }} />
            </div>
          )}
          {bg === 'hyperdrive_warp' && (
            <div className="absolute inset-0 overflow-hidden bg-hyperdrive-warp-container" style={{ opacity: 0.3 }}>
              <div className="warp-core" style={{ opacity: 0.2 }} />
            </div>
          )}
          {bg === 'living_vault' && (
            <div className="absolute inset-0 overflow-hidden bg-living-vault-container" style={{ opacity: 0.4 }}>
              <div className="vault-corridor-grid" />
              <div className="vault-corridor-glow" style={{ opacity: 0.3 }} />
            </div>
          )}
          {bg === 'gold_record' && (
            <div className="absolute inset-0 overflow-hidden bg-gold-record-container" style={{ opacity: 0.3 }}>
              <div className="gold-record-vinyl" style={{ transform: 'scale(0.8)', opacity: 0.3 }} />
              <div className="gold-record-waves" />
            </div>
          )}
        </div>
      )}
    </>
  );
}

function OptionsRouteHandler() {
  const setOptionsModalOpen = useVaultStore((s) => s.setOptionsModalOpen);
  const [, setLocation] = useLocation();

  useEffect(() => {
    setOptionsModalOpen(true);
    const lastPath = sessionStorage.getItem('last_path') || '/vault';
    setLocation(lastPath);
  }, [setOptionsModalOpen, setLocation]);

  return null;
}

// Automatic Daily Drop stage launcher
function DailyDropRoute() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    const today = getCurrentDay();
    setLocation(`/play/day-${today}`);
  }, [setLocation]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
      <div className="text-[12px] font-mono text-[#ff1493] uppercase font-bold tracking-widest animate-pulse">
        CALIBRATING STAGE TO TODAY'S DROP...
      </div>
    </div>
  );
}

function TransmissionsRoute() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    useNotificationStore.getState().setIsOpen(true);
    setLocation('/arcade');
  }, [setLocation]);
  return null;
}

export default function App() {
  const [location, setLocation] = useLocation();
  const initializeAuth = useAuthStore((s) => s.initialize);
  const authStatus = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const showAuthModal = useAuthStore((s) => s.showAuthModal);
  const setShowAuthModal = useAuthStore((s) => s.setShowAuthModal);
  
  const hasOnboarded = useVaultStore((s) => s.hasOnboarded);
  const completeOnboarding = useVaultStore((s) => s.completeOnboarding);
  const optionsModalOpen = useVaultStore((s) => s.optionsModalOpen);
  const setOptionsModalOpen = useVaultStore((s) => s.setOptionsModalOpen);

  const collection = useVaultStore((s) => s.collection);
  const progression = useVaultStore((s) => s.progression);

  const subscribeNotifications = useNotificationStore((s) => s.subscribeRealtime);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  useEffect(() => {
    const unsubscribe = subscribeNotifications(user?.id);
    return () => {
      unsubscribe();
    };
  }, [subscribeNotifications, user?.id]);

  // Track page views on route transitions
  useEffect(() => {
    logAnalyticsEvent('page_view', { path: location });
    if (location !== '/options') {
      sessionStorage.setItem('last_path', location);
    }
  }, [location]);

  // Close the options modal when navigating to a new route (except if redirecting back from /options)
  const prevLocationRef = useRef(location);
  useEffect(() => {
    if (prevLocationRef.current === '/options') {
      // Just redirected back from options page, keep it open!
    } else {
      setOptionsModalOpen(false);
    }
    prevLocationRef.current = location;
  }, [location, setOptionsModalOpen]);

  // Force first-time players who haven't completed the tutorial to /tutorial
  // (Exempting /hero, /admin, /pitch-deck, /legal, /options)
  useEffect(() => {
    if (authStatus === 'idle' || authStatus === 'loading') return;

    const isTutorialCompleted = 
      progression.tutorialCompleted || 
      localStorage.getItem('pim_tutorial_completed') === 'true';

    const isExemptRoute = 
      location === '/tutorial' ||
      location.startsWith('/hero') ||
      location.startsWith('/admin') ||
      location === '/pitch-deck' ||
      location === '/options' ||
      location === '/vault/legal' ||
      location === '/legal';

    if (!isTutorialCompleted && !isExemptRoute) {
      setLocation('/tutorial');
    }
  }, [location, progression.tutorialCompleted, authStatus, setLocation]);

  // Stop global preview player on gameplay routes to prevent dual-audio
  useEffect(() => {
    if (location.startsWith('/play/') || location === '/tutorial') {
      useGlobalPlayer.getState().stop();
    }
  }, [location]);

  // If loading authentication state, show a clean loading screen
  if (authStatus === 'idle' || authStatus === 'loading') {
    return (
      <div className="fixed inset-0 bg-[#050402] flex flex-col items-center justify-center">
        <div
          className="w-8 h-8 border-2 border-white/10 rounded-full animate-spin mb-4"
          style={{ borderTopColor: '#ff3800' }}
        />
        <p className="font-mono text-[10px] tracking-widest text-[#ff3800] uppercase">
          Initializing Neural Link...
        </p>
      </div>
    );
  }

  // If user is authenticated but onboarding is explicitly false, show onboarding flow (globally for real authenticated users, ignoring anonymous guests)
  const isAnonymous = user?.is_anonymous || 
                      user?.app_metadata?.provider === 'anonymous' || 
                      (!user?.email && !user?.user_metadata?.wallet && !user?.user_metadata?.wallet_address);
  const isGameplayRoute = location.startsWith('/play/') || location.startsWith('/results/') || location === '/tutorial';
  if (user && !isAnonymous && hasOnboarded === false && !isGameplayRoute) {
    return <OnboardingFlow onComplete={completeOnboarding} />;
  }


  // Hide the global navigation bar only in active gameplay, tutorial, editor, or hero landing pages
  const hideNavbar =
    location.startsWith('/play/') ||
    location === '/tutorial' ||
    location === '/admin/editor' ||
    location === '/admin/card-designs' ||
    location.startsWith('/hero');

  return (
    <div className="min-h-screen bg-[#050402] text-white flex flex-col select-none relative">
      <GlobalMenuBackground />
      <BackgroundMusic />
      <GamepadCursor />
      {/* Global Navigation Header with integrated notification telemetry */}
      {!hideNavbar && <Navbar />}
      {!hideNavbar && <SystemAlertBanner />}

      <main className="flex-1 flex flex-col relative">
        <Suspense fallback={
          <div className="flex-1 flex items-center justify-center p-8 font-mono text-xs text-[#00E5FF] tracking-widest uppercase">
            LOADING_MODULE...
          </div>
        }>
          <Switch>
            <Route path="/" component={LandingPage} />
            <Route path="/next-vault" component={NextGenLandingPage} />
            <Route path="/hero" component={HeroLandingPage} />
            <Route path="/hero/day-:dayParam" component={HeroLandingPage} />
            <Route path="/hero/:dayParam" component={HeroLandingPage} />
            <Route path="/pim" component={RhythmHome} />
            <Route path="/play" component={RhythmHome} />
            <Route path="/arcade" component={RhythmHome} />
            <Route path="/daily" component={DailyDropRoute} />
            <Route path="/drop" component={DailyDropRoute} />
            <Route path="/today" component={DailyDropRoute} />
            <Route path="/daily-drop" component={DailyDropRoute} />
            <Route path="/transmissions" component={TransmissionsRoute} />
            <Route path="/songs" component={SongSelect} />
            <Route path="/play/:songId" component={GamePlay} />
            <Route path="/results/:songId" component={GameResults} />
            <Route path="/vault" component={HomePage} />
            <Route path="/vault/collection" component={CollectionPage} />
            <Route path="/collection" component={CollectionPage} />
            <Route path="/vault/reveal" component={PackRevealPage} />
            <Route path="/reveal" component={PackRevealPage} />
            <Route path="/vault/forge" component={ForgePage} />
            <Route path="/forge" component={ForgePage} />
            <Route path="/vault/leaderboard" component={LeaderboardPage} />
            <Route path="/leaderboard" component={LeaderboardPage} />
            <Route path="/vault/codex" component={CodexPage} />
            <Route path="/codex" component={CodexPage} />
            <Route path="/vault/claim" component={ClaimPage} />
            <Route path="/claim" component={ClaimPage} />
            <Route path="/vault/legal" component={LegalPage} />
            <Route path="/legal" component={LegalPage} />
            <Route path="/vault/earn" component={EarnPage} />
            <Route path="/earn" component={EarnPage} />
            <Route path="/shop" component={EarnPage} />
            <Route path="/store" component={EarnPage} />
            <Route path="/vault/:userId" component={VoyeurPage} />
            { (import.meta.env.DEV || localStorage.getItem('th3vault_dev_mode') === 'true') && (
              <>
                <Route path="/pitch-deck" component={PitchDeck} />
                <Route path="/admin" component={AdminPage} />
                <Route path="/admin/editor" component={BeatmapEditor} />
                <Route path="/admin/card-designs" component={CardDesignShowcase} />
              </>
            ) }
            <Route path="/campaign" component={Campaign} />
            <Route path="/chapter/:month" component={Chapter} />
            <Route path="/tutorial" component={Tutorial} />
            <Route path="/profile" component={ProfilePage} />
            <Route path="/user" component={ProfilePage} />
            <Route path="/user.th3scr1b3.art" component={ProfilePage} />
            <Route path="/options" component={OptionsRouteHandler} />
            <Route path="/song/:songId" component={SongDetail} />
            <Route path="/listen/:songId" component={ListenPage} />
            <Route path="/slideshow" component={SlideshowPage} />
            <Route>
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto">
                <div className="text-[10px] tracking-[0.3em] text-white/40 mb-4 uppercase font-bold">
                  404 // NEURAL_DESYNC
                </div>
                <h1 className="text-4xl font-black text-[#ff3800] tracking-tighter mb-4 uppercase">
                  NOT_FOUND
                </h1>
                <p className="font-mono text-xs text-white/60 mb-8 uppercase leading-relaxed">
                  The requested transmission pathway has collapsed. The sector query failed to resolve or has been quarantined by the archivist.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 items-center justify-center mb-8">
                  <a
                    href="/arcade"
                    className="px-6 py-3 border-2 border-black bg-[#ff3800] text-black font-black uppercase text-xs tracking-wider shadow-[4px_4px_0_#000] hover:scale-105 active:scale-95 transition-all"
                  >
                    Back to Arcade
                  </a>
                  <button
                    onClick={() => { window.location.href = '/'; }}
                    className="px-6 py-3 border-2 border-[#ff3800] bg-transparent text-[#ff3800] font-black uppercase text-xs tracking-wider shadow-[4px_4px_0_#ff3800] hover:scale-105 active:scale-95 transition-all cursor-pointer"
                  >
                    Restart System
                  </button>
                </div>
                <div className="w-full pt-6 border-t border-white/10 text-left font-mono text-[9px] text-white/30 space-y-1">
                  <div className="flex justify-between">
                    <span>DESYNC_GATEWAY:</span>
                    <span className="text-white/60 font-bold uppercase">SFO1::CLIENT_ROUTER</span>
                  </div>
                  <div className="flex justify-between">
                    <span>ERROR_CODE:</span>
                    <span className="text-[#ff3800] font-bold">404_PATH_DECOMISSIONED</span>
                  </div>
                  <div className="flex justify-between">
                    <span>QUERY_LOCATION:</span>
                    <span className="text-white/60 font-bold uppercase">{location}</span>
                  </div>
                </div>
              </div>
            </Route>
          </Switch>
        </Suspense>
      </main>

      <LoadingToast />
      <GlobalPlayerBar />
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      <OptionsModal isOpen={optionsModalOpen} onClose={() => setOptionsModalOpen(false)} />
      <NotificationModal />
    </div>
  );
}
