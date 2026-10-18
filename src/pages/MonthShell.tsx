// App shell for a monthly Playgama build ("PIM: January"): an animated intro and
// a press-start screen, then one campaign chapter, its songs and results,
// nothing else. No vault, packs, sign-in or menus; any other route the game
// links to lands back on the chapter. main.tsx renders this instead of App.tsx
// when vite.config.ts sets __PIM_MONTH__.

import { Suspense, lazy, useEffect, useState } from 'react';
import { Redirect, Route, Switch, useLocation } from 'wouter';
import { Volume2, VolumeX } from 'lucide-react';
import ErrorBoundary from '@/components/ErrorBoundary';
import BackgroundMusic from '@/components/audio/BackgroundMusic';
import GamepadCursor from '@/components/ui/GamepadCursor';
import { useGlobalPlayer } from '@/store/useGlobalPlayer';
import { markGameReady } from '@/platform';
import { setGate } from '@/platform/playgama/audioGate';
import { PLAYGAMA_MONTH, restoreBonusBundle } from '@/platform/playgama/month';
import { submitMonthScore } from '@/platform/playgama/monthLeaderboard';
import TitleScreens from './month/TitleScreens';
import '@/styles/CardShowcaseStyles.css';

const ChapterStory = lazy(() => import('./campaign/ChapterStory'));
const GamePlay = lazy(() => import('./GamePlay'));
const MonthResults = lazy(() => import('./month/MonthResults'));

const HOME = `/chapter/${PLAYGAMA_MONTH}`;
const MUTE_KEY = 'pg_muted';

/** The gameplay tutorial ends on /tutorial; record it and show that run's results. */
function TutorialDone() {
  try {
    localStorage.setItem('pim_tutorial_completed', 'true');
  } catch { /* storage blocked */ }
  const last = sessionStorage.getItem('campaign_last_song_id');
  return <Redirect to={last ? `/results/${last}` : HOME} replace />;
}

function MuteButton({ inPlay }: { inPlay: boolean }) {
  const [muted, setMuted] = useState(() => {
    try {
      return localStorage.getItem(MUTE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    setGate('user', muted);
    try {
      localStorage.setItem(MUTE_KEY, String(muted));
    } catch { /* storage blocked */ }
  }, [muted]);
  return (
    <button
      type="button"
      className="pg-mute"
      aria-label={muted ? 'Unmute sound' : 'Mute sound'}
      aria-pressed={muted}
      data-play={inPlay || undefined}
      onClick={() => setMuted((m) => !m)}
    >
      {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
    </button>
  );
}

export default function MonthShell() {
  const [location, setLocation] = useLocation();
  // The intro and start screen show once per launch, then the chapter.
  const [started, setStarted] = useState(false);

  useEffect(() => {
    markGameReady();
    void restoreBonusBundle();
  }, []);

  useEffect(() => {
    if (location.startsWith('/play/')) useGlobalPlayer.getState().stop();
    // Back from a run: post the month total to the Playgama leaderboard if it went up.
    else if (started) void submitMonthScore().catch(() => {});
  }, [location, started]);

  if (!started) {
    return (
      <ErrorBoundary sectionName="ROOT_APP">
        <TitleScreens onStart={() => { setLocation(HOME, { replace: true }); setStarted(true); }} />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary sectionName="ROOT_APP">
      <div className="pim-app-root min-h-screen bg-[#050402] text-white flex flex-col select-none relative">
        <style>{`
          .pg-mute {
            position: fixed; z-index: 9999; right: 12px; top: 12px;
            width: 40px; height: 40px; border-radius: 999px; display: grid; place-items: center;
            background: rgba(10, 8, 6, 0.72); color: #fff; border: 1px solid rgba(255, 255, 255, 0.18);
            cursor: pointer; backdrop-filter: blur(6px);
          }
          .pg-mute:hover { border-color: rgba(255, 255, 255, 0.45); }
          .pg-mute[data-play] { top: 30px; width: 34px; height: 34px; }
        `}</style>
        <BackgroundMusic />
        <GamepadCursor />
        <MuteButton inPlay={location.startsWith('/play/')} />
        <main className="flex-1 flex flex-col relative">
          <ErrorBoundary sectionName="PAGE_ROUTER">
            <Suspense
              fallback={
                <div className="flex-1 flex items-center justify-center p-8 font-mono text-xs text-[#00E5FF] tracking-widest uppercase">
                  <div className="w-6 h-6 border-2 border-[#00E5FF]/20 border-t-[#00E5FF] rounded-full animate-spin" />
                </div>
              }
            >
              <Switch>
                <Route path={HOME} component={ChapterStory} />
                <Route path="/play/:songId" component={GamePlay} />
                <Route path="/results/:songId" component={MonthResults} />
                <Route path="/tutorial" component={TutorialDone} />
                <Route>
                  <Redirect to={HOME} replace />
                </Route>
              </Switch>
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </ErrorBoundary>
  );
}
