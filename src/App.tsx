import { Route, Switch, useLocation } from 'wouter';
import { useEffect } from 'react';
import { useAuthStore } from './store/useAuthStore';
import { useVaultStore } from './store/useVaultStore';
import BackgroundMusic from './components/audio/BackgroundMusic';

// Component imports
import Navbar from './components/Navbar';
import LoadingToast from './components/LoadingToast';
import GlobalPlayerBar from './components/GlobalPlayerBar';
import OnboardingFlow from './components/OnboardingFlow';

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
import Campaign from './pages/Campaign';
import Chapter from './pages/Chapter';
import Tutorial from './pages/Tutorial';
import Options from './pages/Options';
import SongDetail from './pages/SongDetail';
import LandingPage from './pages/LandingPage';

export default function App() {
  const [location] = useLocation();
  const initializeAuth = useAuthStore((s) => s.initialize);
  const authStatus = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  
  const hasOnboarded = useVaultStore((s) => s.hasOnboarded);
  const completeOnboarding = useVaultStore((s) => s.completeOnboarding);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

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

  // If user is authenticated but onboarding is explicitly false, show onboarding flow (restricted to /vault routes)
  if (location.startsWith('/vault') && user && hasOnboarded === false) {
    return <OnboardingFlow onComplete={completeOnboarding} />;
  }


  // Hide the global navigation bar in gameplay or tutorial to save screen space
  const hideNavbar = location.startsWith('/play/') || location === '/tutorial';

  return (
    <div className="min-h-screen bg-[#050402] text-white flex flex-col select-none">
      <BackgroundMusic />
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
          <Route path="/admin" component={AdminPage} />
          <Route path="/campaign" component={Campaign} />
          <Route path="/chapter/:chapterId" component={Chapter} />
          <Route path="/tutorial" component={Tutorial} />
          <Route path="/options" component={Options} />
          <Route path="/song/:songId" component={SongDetail} />
          <Route>

            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <h1 className="text-4xl font-black text-[#ff3800] tracking-tighter mb-4 uppercase">
                404 // ROUTE_NOT_FOUND
              </h1>
              <p className="font-mono text-xs text-white/40 mb-8 max-w-md uppercase">
                The neural pathway you requested does not exist or has been decommissioned.
              </p>
              <a
                href="/arcade"
                className="px-6 py-3 border-2 border-black bg-[#ff3800] text-black font-black uppercase text-xs tracking-wider shadow-[4px_4px_0_#000] hover:scale-105 active:scale-95 transition-all"
              >
                Back to Arcade
              </a>
            </div>
          </Route>
        </Switch>
      </main>

      <LoadingToast />
      <GlobalPlayerBar />
    </div>
  );
}
