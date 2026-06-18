import { Route, Switch, useLocation } from 'wouter';
import { useEffect } from 'react';
import { useAuthStore } from './store/useAuthStore';
import { logAnalyticsEvent } from './services/telemetryService';
import { useVaultStore } from './store/useVaultStore';
import { useGlobalPlayer } from './store/useGlobalPlayer';
import BackgroundMusic from './components/audio/BackgroundMusic';
import GamepadCursor from './components/ui/GamepadCursor';

// Component imports
import Navbar from './components/Navbar';
import LoadingToast from './components/LoadingToast';
import GlobalPlayerBar from './components/GlobalPlayerBar';
import OnboardingFlow from './components/OnboardingFlow';
import AuthModal from './components/AuthModal';

// Page imports
import RhythmHome from './pages/RhythmHome';
import SongSelect from './pages/SongSelect';
import GamePlay from './pages/GamePlay';
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
import AdminPage from './pages/AdminPage';
import BeatmapEditor from './pages/BeatmapEditor';
import CardDesignShowcase from './pages/CardDesignShowcase';
import Campaign from './pages/Campaign';
import Chapter from './pages/Chapter';
import Tutorial from './pages/Tutorial';
import Options from './pages/Options';
import SongDetail from './pages/SongDetail';
import LandingPage from './pages/LandingPage';
import PitchDeck from './pages/PitchDeck';
import ProfilePage from './pages/ProfilePage';

export default function App() {
  const [location, setLocation] = useLocation();
  const initializeAuth = useAuthStore((s) => s.initialize);
  const authStatus = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const showAuthModal = useAuthStore((s) => s.showAuthModal);
  const setShowAuthModal = useAuthStore((s) => s.setShowAuthModal);
  
  const hasOnboarded = useVaultStore((s) => s.hasOnboarded);
  const completeOnboarding = useVaultStore((s) => s.completeOnboarding);

  const collection = useVaultStore((s) => s.collection);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  // Track page views on route transitions
  useEffect(() => {
    logAnalyticsEvent('page_view', { path: location });
  }, [location]);

  // Automatically redirect guests who haven't completed the tutorial to /tutorial
  useEffect(() => {
    if (location === '/') {
      const isTutorialCompleted = localStorage.getItem('pim_tutorial_completed') === 'true';
      const hasCollection = collection.length > 0;
      if (!isTutorialCompleted && !hasCollection) {
        setLocation('/tutorial');
      }
    }
  }, [location, setLocation, collection]);

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


  // Hide the global navigation bar in gameplay, campaign, songs, options, tutorial, results, etc. to save screen space and avoid mobile overlaps
  const hideNavbar =
    location.startsWith('/play/') ||
    location === '/tutorial' ||
    location === '/campaign' ||
    location.startsWith('/chapter/') ||
    location.startsWith('/song/') ||
    location === '/songs' ||
    location.startsWith('/results/') ||
    location === '/options' ||
    location === '/admin/editor' ||
    location === '/admin/card-designs';

  return (
    <div className="min-h-screen bg-[#050402] text-white flex flex-col select-none">
      <BackgroundMusic />
      <GamepadCursor />
      {!hideNavbar && <Navbar />}

      <main className="flex-1 flex flex-col">
        <Switch>
          <Route path="/" component={LandingPage} />
          <Route path="/arcade" component={RhythmHome} />
          <Route path="/songs" component={SongSelect} />
          <Route path="/play/:songId" component={GamePlay} />
          <Route path="/results/:songId" component={GameResults} />
          <Route path="/vault" component={HomePage} />
          <Route path="/vault/collection" component={CollectionPage} />
          <Route path="/vault/reveal" component={PackRevealPage} />
          <Route path="/vault/forge" component={ForgePage} />
          <Route path="/vault/leaderboard" component={LeaderboardPage} />
          <Route path="/vault/codex" component={CodexPage} />
          <Route path="/vault/claim" component={ClaimPage} />
          <Route path="/vault/legal" component={LegalPage} />
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
          <Route path="/options" component={Options} />
          <Route path="/song/:songId" component={SongDetail} />
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
                  <span>DIAGNOSTIC_CODE:</span>
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
      </main>

      <LoadingToast />
      <GlobalPlayerBar />
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
}
