/**
 * The Audius weekly top-5 contest: this week's 5 trending tracks by other
 * artists, the weekly ranking, and last week's claw-pull prizes.
 */
import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Crown, ExternalLink, Gamepad2, Gift, Pause, Play, Trophy } from 'lucide-react';
import { useGlobalPlayer, type GlobalTrack } from '@/store/useGlobalPlayer';
import { useAuthStore } from '@/store/useAuthStore';
import { formatDuration, streamUrl } from '@/lib/audius';
import {
  addDays,
  artistUrl,
  claimPrize,
  contestPulls,
  contestSongId,
  fetchBoard,
  fetchContest,
  fetchCurrentContest,
  fetchMyClaim,
  trackUrl,
  weekEnd,
  weekStart,
  type BoardRow,
  type ContestTrack,
  type WeeklyContest as Contest,
} from '@/lib/audiusContest';
import RanksDialog from './RanksDialog';

const GOLD = '#E5B800';
const ACCENT = '#CC0FE0';

function weekLabel(week: string): string {
  const fmt = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return `${fmt(week)} – ${fmt(addDays(week, 6))}`;
}

function timeLeft(until: Date): string {
  const ms = until.getTime() - Date.now();
  if (ms <= 0) return 'ended';
  const h = Math.floor(ms / 3_600_000);
  const d = Math.floor(h / 24);
  return d > 0 ? `${d}d ${h % 24}h left` : `${h}h ${Math.floor((ms % 3_600_000) / 60_000)}m left`;
}

function toPlayerTrack(t: ContestTrack): GlobalTrack {
  // Stable negative key so the global player never confuses it with a 365 day.
  let h = 0;
  for (let i = 0; i < t.id.length; i++) h = (h * 31 + t.id.charCodeAt(i)) | 0;
  return {
    id: `audius-${t.id}`,
    title: t.title,
    artist: t.artist,
    audioUrl: streamUrl(t.id),
    coverUrl: t.artwork ?? '/data/covers/default.jpg',
    day: -(Math.abs(h) % 1_000_000_000) - 1,
    rarity: 'common',
    source: 'audius',
    externalUrl: trackUrl(t),
  };
}

function ListenButton({ track, playlist, index }: { track: ContestTrack; playlist: ContestTrack[]; index: number }) {
  const isCurrent = useGlobalPlayer((s) => s.currentTrack?.id === `audius-${track.id}`);
  const isPlaying = useGlobalPlayer((s) => s.isPlaying) && isCurrent;
  const onClick = () => {
    const p = useGlobalPlayer.getState();
    if (isPlaying) return p.pause();
    if (isCurrent) return p.resume();
    p.setPlaylist(playlist.map(toPlayerTrack), index, true);
  };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isPlaying ? `Pause ${track.title}` : `Listen to ${track.title}`}
      className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-transform hover:scale-105"
      style={{ background: isCurrent ? ACCENT : 'rgba(0,0,0,0.65)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff' }}
    >
      {isPlaying ? <Pause size={15} /> : <Play size={15} className="ml-0.5" />}
    </button>
  );
}

function usePlayContestSong() {
  const [, setLocation] = useLocation();
  return (t: ContestTrack) => {
    const id = contestSongId(t.id);
    try {
      sessionStorage.setItem(`game_origin_${id}`, 'audius');
    } catch {
      /* private mode: the game falls back to its default exit */
    }
    useGlobalPlayer.getState().stop();
    setLocation(`/play/${id}`);
  };
}

function Board({ rows, myId, emptyText }: { rows: BoardRow[]; myId?: string; emptyText: string }) {
  if (!rows.length) {
    return <p className="font-mono text-xs text-white/50 uppercase tracking-wider py-6 text-center">{emptyText}</p>;
  }
  return (
    <ol className="divide-y divide-white/5">
      {rows.map((r) => {
        const pulls = contestPulls(r.rank);
        const isMe = r.userId === myId;
        return (
          <li
            key={r.userId}
            className="flex items-center gap-3 px-3 py-2"
            style={{ background: isMe ? 'rgba(204,15,224,0.12)' : undefined }}
          >
            <span className="w-6 text-right font-mono text-xs font-bold" style={{ color: r.rank <= 3 ? GOLD : 'rgba(255,255,255,0.5)' }}>
              {r.rank}
            </span>
            {r.avatarUrl ? (
              <img src={r.avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover" />
            ) : (
              <span className="w-6 h-6 rounded-full bg-white/10" />
            )}
            <span className="flex-1 min-w-0 truncate text-sm text-white">
              {r.name}
              {isMe && <span className="ml-1 font-mono text-[10px] uppercase" style={{ color: ACCENT }}>you</span>}
            </span>
            <span className="font-mono text-[10px] text-white/40 uppercase">{r.songsPlayed}/5</span>
            <span className="font-mono text-sm text-white tabular-nums">{r.total.toLocaleString()}</span>
            <span className="w-16 text-right font-mono text-[10px] uppercase" style={{ color: pulls ? GOLD : 'transparent' }}>
              {pulls ? `${pulls} pull${pulls > 1 ? 's' : ''}` : '-'}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function LastWeek({ myId }: { myId?: string }) {
  const week = addDays(weekStart(), -7);
  const [contest, setContest] = useState<Contest | null>(null);
  const [rows, setRows] = useState<BoardRow[]>([]);
  const [claim, setClaim] = useState<{ rank: number; pulls: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetchContest(week)
      .then(async (c) => {
        if (!live || !c) return;
        setContest(c);
        const [b, mine] = await Promise.all([fetchBoard(week, 10), myId ? fetchMyClaim(week) : null]);
        if (!live) return;
        setRows(b);
        setClaim(mine);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [week, myId]);

  if (!contest) return null;
  const mine = rows.find((r) => r.userId === myId);
  const owed = mine ? contestPulls(mine.rank) : 0;

  const onClaim = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await claimPrize(week);
      setClaim({ rank: mine?.rank ?? 0, pulls: res.pulls });
      setMsg(`${res.pulls} claw pull${res.pulls > 1 ? 's' : ''} added. You have ${res.credits} to use on the bonus claw.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Could not claim the prize.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-white/10 bg-black/50 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-white/10">
        <div className="font-black uppercase text-white tracking-tight">Last week · {weekLabel(week)}</div>
        {owed > 0 && !claim && (
          <button type="button" onClick={onClaim} disabled={busy} className="btn-3d" data-tone="gold" data-size="sm">
            <Gift size={13} />
            <span>Claim {owed} pull{owed > 1 ? 's' : ''}</span>
          </button>
        )}
        {claim && (
          <span className="font-mono text-[11px] uppercase tracking-wider" style={{ color: GOLD }}>
            Claimed {claim.pulls} pull{claim.pulls > 1 ? 's' : ''}
          </span>
        )}
      </div>
      {msg && <p className="px-4 pt-3 font-mono text-xs text-white/70">{msg}</p>}
      <Board rows={rows} myId={myId} emptyText="Nobody played last week's songs." />
    </div>
  );
}

export default function WeeklyContest() {
  const myId = useAuthStore((s) => s.user?.id);
  const play = usePlayContestSong();
  const [contest, setContest] = useState<Contest | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [rows, setRows] = useState<BoardRow[] | null>(null);
  const [ranksFor, setRanksFor] = useState<ContestTrack | null>(null);
  const closeRanks = useCallback(() => setRanksFor(null), []);

  useEffect(() => {
    let live = true;
    fetchCurrentContest()
      .then((c) => {
        if (!live) return;
        setContest(c);
        if (c) fetchBoard(c.week_start, 25).then((b) => live && setRows(b)).catch(() => live && setRows([]));
      })
      .catch((err) => {
        console.error('[audius contest]', err);
        if (live) setFailed(err instanceof Error ? err.message : String(err));
      });
    return () => {
      live = false;
    };
  }, []);

  if (failed) {
    return (
      <section className="mb-12" id="weekly-contest">
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-200">
          <div className="font-bold tracking-wide">WEEKLY TOP 5 UNAVAILABLE</div>
          <div className="mt-1 opacity-80">{failed}</div>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-12" id="weekly-contest">
      {ranksFor && (
        <RanksDialog
          label={`Weekly top 5 · ${ranksFor.artist}`}
          title={ranksFor.title}
          songId={contestSongId(ranksFor.id)}
          accent={GOLD}
          onClose={closeRanks}
          rankingTitle="SONG RANKINGS"
          action={
            <button type="button" onClick={() => play(ranksFor)} className="btn-3d" data-tone="cyan" data-size="sm">
              <Gamepad2 size={13} />
              <span>Play PIM</span>
            </button>
          }
        />
      )}

      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Crown size={18} style={{ color: GOLD }} />
            <h2
              className="text-xl sm:text-2xl font-black uppercase text-white tracking-tight"
              style={{ fontFamily: '"Impact", "Arial Black", sans-serif' }}
            >
              Weekly Top 5
            </h2>
          </div>
          <p className="font-mono text-[11px] text-white/50 uppercase tracking-widest mt-1">
            This week's trending artists on Audius. Your best run on each song adds up.
          </p>
        </div>
        {contest && (
          <div className="text-right font-mono text-[11px] uppercase tracking-wider">
            <div className="text-white">{weekLabel(contest.week_start)}</div>
            <div style={{ color: GOLD }}>{timeLeft(weekEnd(contest.week_start))}</div>
          </div>
        )}
      </div>

      <div className="mb-4 rounded-lg px-4 py-2.5 font-mono text-[11px] uppercase tracking-wider text-black flex flex-wrap items-center gap-x-4 gap-y-1" style={{ background: GOLD }}>
        <span className="font-black flex items-center gap-1.5"><Gift size={13} /> Claw pull prizes</span>
        <span>1st · 5</span>
        <span>2nd · 3</span>
        <span>3rd · 2</span>
        <span>4th–10th · 1</span>
      </div>

      {contest ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
          {contest.tracks.map((t, i) => (
            <div key={t.id} className="rounded-lg overflow-hidden border border-white/10 bg-black/60">
              <div className="relative aspect-square">
                {t.artwork ? (
                  <img src={t.artwork} alt="" loading="lazy" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-yellow-700 to-black" />
                )}
                <span className="absolute top-2 left-2 w-7 h-7 rounded-full flex items-center justify-center font-black text-sm text-black" style={{ background: GOLD }}>
                  {i + 1}
                </span>
                <div className="absolute bottom-2 right-2">
                  <ListenButton track={t} playlist={contest.tracks} index={i} />
                </div>
              </div>
              <div className="px-3 py-2">
                <div className="text-sm text-white truncate" title={t.title}>{t.title}</div>
                <div className="flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-wider">
                  <a href={artistUrl(t)} target="_blank" rel="noopener noreferrer" className="truncate no-underline hover:underline" style={{ color: ACCENT }}>
                    {t.artist}
                  </a>
                  <span className="text-white/40 shrink-0">{formatDuration(t.duration)}</span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <button type="button" onClick={() => play(t)} className="btn-3d" data-tone="cyan" data-size="sm" aria-label={`Play ${t.title} in PIM`}>
                    <Gamepad2 size={13} />
                    <span>Play PIM</span>
                  </button>
                  <button type="button" onClick={() => setRanksFor(t)} className="btn-3d" data-tone="quiet" data-size="sm" aria-label={`${t.title} leaderboard`}>
                    <Trophy size={13} />
                  </button>
                  <a href={trackUrl(t)} target="_blank" rel="noopener noreferrer" aria-label={`${t.title} on Audius`} className="ml-auto text-white/40 hover:text-white">
                    <ExternalLink size={13} />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="aspect-[3/4] rounded-lg bg-white/5 animate-pulse" />
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-white/10 bg-black/50 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 font-black uppercase text-white tracking-tight">This week's ranking</div>
          {rows ? (
            <Board rows={rows} myId={myId} emptyText="No runs yet this week. Be first on the board." />
          ) : (
            <div className="h-24 animate-pulse bg-white/5" />
          )}
        </div>
        <LastWeek myId={myId} />
      </div>
    </section>
  );
}
