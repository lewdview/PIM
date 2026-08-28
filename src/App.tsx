import { Route, Switch, useLocation } from 'wouter';
import { useEffect, useState, useRef, Suspense, lazy } from 'react';
import { useAuthStore } from './store/useAuthStore';
import { logAnalyticsEvent } from './services/telemetryService';
import { useVaultStore } from './store/useVaultStore';
import { useGlobalPlayer } from './store/useGlobalPlayer';
import BackgroundMusic from './components/audio/BackgroundMusic';
import GamepadCursor from './components/ui/GamepadCursor';
import GlobalMenuBackground from './components/layout/GlobalMenuBackground';
import ErrorBoundary from './components/ErrorBoundary';
import './styles/CardShowcaseStyles.css';

// Layout & UI Shell components (eagerly loaded for immediate shell render)
import Navbar from './components/Navbar';
import LoadingToast from './components/LoadingToast';
import GlobalPlayerBar from './components/GlobalPlayerBar';
import OnboardingFlow from './components/OnboardingFlow';
import AuthModal from './components/AuthModal';
import CommandPaletteModal from './components/CommandPaletteModal';
import OptionsModal from './components/OptionsModal';
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
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      const msg = err.message;
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
          console.warn('[Chunk Loader] Stale chunk detected, refreshing page to load updated assets...', err);
          window.location.reload();
          return new Promise<{ default: T }>(() => {});
        }
      }
      throw err;
    }
  });
}

// ── Lazy-loaded Route Components (Chunk-split for instant initial load) ─────
const LandingPage = lazyWithRetry(() => import('./pages/LandingPage'));
const NextGenLandingPage = lazyWithRetry(() => import('./pages/NextGenLandingPage'));
const HeroLandingPage = lazyWithRetry(() => import('./pages/HeroLandingPage'));
const RhythmHome = lazyWithRetry(() => import('./pages/RhythmHome'));
const SongSelect = lazyWithRetry(() => import('./pages/SongSelect'));
const GamePlay = lazyWithRetry(() => import('./pages/GamePlay'));
const GameResults = lazyWithRetry(() => import('./pages/GameResults'));
const Campaign = lazyWithRetry(() => import('./pages/Campaign'));
const Chapter = lazyWithRetry(() => import('./pages/Chapter'));
const Tutorial = lazyWithRetry(() => import('./pages/Tutorial'));
const HomePage = lazyWithRetry(() => import('./pages/HomePage'));
const CollectionPage = lazyWithRetry(() => import('./pages/CollectionPage'));
const PackRevealPage = lazyWithRetry(() => import('./pages/PackRevealPage'));
const ForgePage = lazyWithRetry(() => import('./pages/ForgePage'));
const LeaderboardPage = lazyWithRetry(() => import('./pages/LeaderboardPage'));
const CodexPage = lazyWithRetry(() => import('./pages/CodexPage'));
const ClaimPage = lazyWithRetry(() => import('./pages/ClaimPage'));
const LegalPage = lazyWithRetry(() => import('./pages/LegalPage'));
const VoyeurPage = lazyWithRetry(() => import('./pages/VoyeurPage'));
const ProfilePage = lazyWithRetry(() => import('./pages/ProfilePage'));
const SongDetail = lazyWithRetry(() => import('./pages/SongDetail'));
const ListenPage = lazyWithRetry(() => import('./pages/ListenPage'));
const EarnPage = lazyWithRetry(() => import('./pages/EarnPage'));
const UniverseHome = lazyWithRetry(() => import('./pages/UniverseHome'));
const Archive365Page = lazyWithRetry(() => import('./pages/Archive365Page'));
const DayArtifactPage = lazyWithRetry(() => import('./pages/DayArtifactPage'));
const WarpZonePage = lazyWithRetry(() => import('./pages/WarpZonePage'));
const AboutPage = lazyWithRetry(() => import('./pages/AboutPage'));
const AdminPage = lazyWithRetry(() => import('./pages/AdminPage'));
const BeatmapEditor = lazyWithRetry(() => import('./pages/BeatmapEditor'));
const CardDesignShowcase = lazyWithRetry(() => import('./pages/CardDesignShowcase'));
const PitchDeck = lazyWithRetry(() => import('./pages/PitchDeck'));
const SlideshowPage = lazyWithRetry(() => import('./pages/SlideshowPage'));

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

// Give Me A Sign Random Discovery Route
function SignDiscoveryRoute() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    const today = getCurrentDay();
    const randomDay = Math.floor(Math.random() * today) + 1;
    setLocation(`/day/${randomDay}`);
  }, [setLocation]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
      <div className="text-[12px] font-mono text-purple-400 uppercase font-bold tracking-widest animate-pulse">
        CALIBRATING MYSTERY TRANSMISSION // GIVING YOU A SIGN...
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
  const [location] = useLocation();
  const initializeAuth = useAuthStore((s) => s.initialize);
  const authStatus = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const showAuthModal = useAuthStore((s) => s.showAuthModal);
  const setShowAuthModal = useAuthStore((s) => s.setShowAuthModal);
  
  const hasOnboarded = useVaultStore((s) => s.hasOnboarded);
  const completeOnboarding = useVaultStore((s) => s.completeOnboarding);
  const optionsModalOpen = useVaultStore((s) => s.optionsModalOpen);
  const setOptionsModalOpen = useVaultStore((s) => s.setOptionsModalOpen);

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
    if (prevLocationRef.current !== '/options') {
      setOptionsModalOpen(false);
    }
    prevLocationRef.current = location;
  }, [location, setOptionsModalOpen]);

  // Stop global preview player on gameplay routes to prevent dual-audio
  useEffect(() => {
    if (location.startsWith('/play/') || location === '/tutorial') {
      useGlobalPlayer.getState().stop();
    }
  }, [location]);

  // If loading authentication state, show a clean loading screen with a 2.5s timeout safeguard
  const [authTimedOut, setAuthTimedOut] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      setAuthTimedOut(true);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  if (!authTimedOut && (authStatus === 'idle' || authStatus === 'loading')) {
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
  const isAnonymous =
    user?.is_anonymous ||
    user?.app_metadata?.provider === 'anonymous' ||
    (!user?.email && !user?.user_metadata?.wallet && !user?.user_metadata?.wallet_address);
  const isGameplayRoute =
    location.startsWith('/play/') || location.startsWith('/results/') || location === '/tutorial';
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
    <ErrorBoundary sectionName="ROOT_APP">
      <div className="min-h-screen bg-[#050402] text-white flex flex-col select-none relative">
        <GlobalMenuBackground />
        <BackgroundMusic />
        <GamepadCursor />
        {/* Global Navigation Header with integrated notification telemetry */}
        {!hideNavbar && <Navbar />}
        {!hideNavbar && <SystemAlertBanner />}

        <main className="flex-1 flex flex-col relative">
          <ErrorBoundary sectionName="PAGE_ROUTER">
            <Suspense
              fallback={
                <div className="flex-1 flex items-center justify-center p-8 font-mono text-xs text-[#00E5FF] tracking-widest uppercase">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-6 h-6 border-2 border-[#00E5FF]/20 border-t-[#00E5FF] rounded-full animate-spin" />
                    <span>LOADING_MODULE...</span>
                  </div>
                </div>
              }
            >
              <Switch>
                {/* 1. Primary Public Landing & PIM Rhythm Routes */}
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
                <Route path="/campaign" component={Campaign} />
                <Route path="/chapter/:month" component={Chapter} />
                <Route path="/tutorial" component={Tutorial} />

                {/* 2. TH3VAULT & Collectible Routes */}
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

                {/* 3. Identity, Audio & Universal 365 Sub-Routes */}
                <Route path="/profile" component={ProfilePage} />
                <Route path="/user" component={ProfilePage} />
                <Route path="/options" component={OptionsRouteHandler} />
                <Route path="/song/:songId" component={SongDetail} />
                <Route path="/listen/:songId" component={ListenPage} />
                <Route path="/slideshow" component={SlideshowPage} />
                <Route path="/universe" component={UniverseHome} />
                <Route path="/365" component={Archive365Page} />
                <Route path="/day/:day" component={DayArtifactPage} />
                <Route path="/day-:day" component={DayArtifactPage} />
                <Route path="/sign" component={SignDiscoveryRoute} />
                <Route path="/random" component={SignDiscoveryRoute} />
                <Route path="/warp" component={WarpZonePage} />
                <Route path="/warp/:sub" component={WarpZonePage} />
                <Route path="/about" component={AboutPage} />
                <Route path="/manifesto" component={AboutPage} />
                <Route path="/hub" component={ProfilePage} />

                {/* 5. Developer & Admin (Dev mode) */}
                {(import.meta.env.DEV || localStorage.getItem('th3vault_dev_mode') === 'true') && (
                  <>
                    <Route path="/pitch-deck" component={PitchDeck} />
                    <Route path="/admin" component={AdminPage} />
                    <Route path="/admin/editor" component={BeatmapEditor} />
                    <Route path="/admin/card-designs" component={CardDesignShowcase} />
                  </>
                )}

                {/* 404 Handler */}
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
                        onClick={() => {
                          window.location.href = '/';
                        }}
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
          </ErrorBoundary>
        </main>

        <LoadingToast />
        <GlobalPlayerBar />
        <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
        <OptionsModal isOpen={optionsModalOpen} onClose={() => setOptionsModalOpen(false)} />
        <NotificationModal />
        <CommandPaletteModal />
      </div>
    </ErrorBoundary>
  );
}
