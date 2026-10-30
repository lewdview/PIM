/**
 * TrackDetailPage — the universal track detail view as a full page.
 * Serves /song/:songId (campaign, award play, search) and /day/:day
 * (365 archive, shared links) with the same content.
 */
import { useParams, useSearch, Link, useLocation } from 'wouter';
import { ArrowLeft, ChevronLeft, ChevronRight, Shuffle } from 'lucide-react';
import { audioManager } from '@/game/audio';
import TrackDetail, { type TrackDetailTab } from '../components/trackDetail/TrackDetail';
import { parseDayFromId } from '../components/trackDetail/useTrackDetail';
import { getCurrentDay } from '../utils/dayCalc';

const BACK_LABELS: Record<string, string> = {
  songs: 'Award play',
  campaign: 'Campaign',
  '365': '365 archive',
  'vault/collection': 'Collection',
  collection: 'Collection',
  codex: 'Codex',
  universe: 'Universe',
  warp: 'Warp zone',
};

export default function TrackDetailPage() {
  const params = useParams<{ songId?: string; day?: string }>();
  const search = new URLSearchParams(useSearch());
  const [, setLocation] = useLocation();
  const today = getCurrentDay();

  const fromSong = Boolean(params.songId);
  const day = parseDayFromId(params.songId ?? params.day) ?? 1;
  const from = search.get('from') || (fromSong ? 'campaign' : '365');
  const tab = (search.get('tab') as TrackDetailTab | null) || undefined;
  const backLabel = from.startsWith('chapter') ? 'Chapter' : BACK_LABELS[from] || 'Back';

  // Keep the origin on day-to-day steps so Back still returns where the player came from.
  const stepHref = (d: number) => `/day/${d}${search.get('from') ? `?from=${encodeURIComponent(from)}` : ''}`;

  const topBar = (
    <>
      <Link href={`/${from}`} onClick={() => audioManager.playSfx('back', 0.4)}
        className="btn-3d no-underline" data-size="sm" data-tone="quiet">
        <ArrowLeft size={13} /> <span className="hidden sm:inline">{backLabel}</span>
      </Link>
      <div className="flex items-center gap-1.5">
        {day > 1 ? (
          <Link href={stepHref(day - 1)} className="btn-3d no-underline" data-size="sm" data-tone="ghost" title={`Day ${day - 1}`}>
            <ChevronLeft size={13} /><span className="hidden md:inline">Day {day - 1}</span>
          </Link>
        ) : null}
        <button type="button" className="btn-3d" data-size="sm" data-tone="ghost" title="Random day"
          onClick={() => { audioManager.playSfx('open_chest', 0.5); setLocation(stepHref(Math.floor(Math.random() * today) + 1)); }}>
          <Shuffle size={12} />
        </button>
        {day < today ? (
          <Link href={stepHref(day + 1)} className="btn-3d no-underline" data-size="sm" data-tone="ghost" title={`Day ${day + 1}`}>
            <span className="hidden md:inline">Day {day + 1}</span><ChevronRight size={13} />
          </Link>
        ) : (
          <span className="td-chip" style={{ color: 'var(--shell-gold)', borderColor: 'rgba(255,184,0,0.4)' }}>Today</span>
        )}
      </div>
    </>
  );

  return (
    <div
      className="w-full min-h-screen bg-[#080604] select-none"
      style={{ minHeight: '100dvh', paddingBottom: 'calc(var(--fc-safe-area-bottom, 0px) + env(safe-area-inset-bottom, 0px) + 5.5rem)' }}
    >
      <div className="max-w-7xl mx-auto">
        <TrackDetail
          key={day}
          day={day}
          songIdHint={params.songId}
          variant="page"
          origin={from}
          initialTab={tab}
          topBar={topBar}
        />
      </div>
    </div>
  );
}
