/**
 * AudiusPage.tsx — th3Scr1b3 on Audius, inside PIM.
 *
 * - Albums: Afterlife (the published album), That One Girl, Against a Wall.
 *   Play a whole album or any track in it.
 * - Beyond 365: Audius uploads that aren't one of the 365 days.
 *
 * Audio streams from Audius, so every play here is a play on Audius.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Disc3, ExternalLink, Gamepad2, ListMusic, Pause, Play, Radio, Sparkles, Trophy, X } from 'lucide-react';
import SongLeaderboard from '../components/SongLeaderboard';
import { useGlobalPlayer } from '../store/useGlobalPlayer';
import {
  AUDIUS_HANDLE,
  audiusSongId,
  BEYOND_365,
  fetchAlbumTracks,
  fetchAudiusAlbums,
  fetchAudiusTracks,
  formatDuration,
  formatPlays,
  getBeyondCover,
  toGlobalTrack,
  type AudiusAlbum,
  type AudiusTrack,
} from '../lib/audius';

const PROFILE_URL = `https://audius.co/${AUDIUS_HANDLE}`;
const ACCENT = '#CC0FE0';

/** The PIM game id for an Audius track: its 365 day, or its Beyond 365 id. */
function gameIdFor(t: AudiusTrack): string {
  return t.day != null ? `card-${t.day}` : audiusSongId(t.permalink);
}

function useStartGame() {
  const [, setLocation] = useLocation();
  return (t: AudiusTrack) => {
    const id = gameIdFor(t);
    try {
      sessionStorage.setItem(`game_origin_${id}`, 'audius');
    } catch {
      /* private mode: the game falls back to its default exit */
    }
    useGlobalPlayer.getState().stop();
    setLocation(`/play/${id}`);
  };
}

function GameButton({ track, label }: { track: AudiusTrack; label?: string }) {
  const start = useStartGame();
  return (
    <button
      type="button"
      onClick={() => start(track)}
      aria-label={`Play ${track.title} in PIM`}
      title="Play in PIM"
      className={label ? 'btn-3d' : 'text-white/50 hover:text-white cursor-pointer'}
      data-tone={label ? 'cyan' : undefined}
      data-size={label ? 'sm' : undefined}
    >
      <Gamepad2 size={label ? 13 : 16} />
      {label && <span>{label}</span>}
    </button>
  );
}

function usePlayerFor(trackId: string | undefined) {
  const currentId = useGlobalPlayer((s) => s.currentTrack?.id);
  const isPlaying = useGlobalPlayer((s) => s.isPlaying);
  const isCurrent = Boolean(trackId) && currentId === `audius-${trackId}`;
  return { isCurrent, isPlaying: isCurrent && isPlaying };
}

function PlayToggle({
  track,
  playlist,
  index,
  cover,
  size = 34,
}: {
  track: AudiusTrack;
  playlist: AudiusTrack[];
  index: number;
  cover?: (t: AudiusTrack) => string | null;
  size?: number;
}) {
  const { isCurrent, isPlaying } = usePlayerFor(track.id);
  const setPlaylist = useGlobalPlayer((s) => s.setPlaylist);
  const pause = useGlobalPlayer((s) => s.pause);
  const resume = useGlobalPlayer((s) => s.resume);

  const onClick = () => {
    if (isPlaying) return pause();
    if (isCurrent) return resume();
    setPlaylist(playlist.map((t) => toGlobalTrack(t, cover?.(t))), index, true);
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
      className="shrink-0 rounded-full flex items-center justify-center transition-transform hover:scale-105 active:scale-95 cursor-pointer"
      style={{
        width: size,
        height: size,
        background: isCurrent ? ACCENT : 'rgba(255,255,255,0.1)',
        color: '#fff',
        border: `1px solid ${isCurrent ? ACCENT : 'rgba(255,255,255,0.2)'}`,
      }}
    >
      {isPlaying ? <Pause size={size * 0.42} /> : <Play size={size * 0.42} className="ml-0.5" />}
    </button>
  );
}

function SectionTitle({ icon: Icon, title, sub }: { icon: typeof Disc3; title: string; sub: string }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2">
        <Icon size={18} style={{ color: ACCENT }} />
        <h2
          className="text-xl sm:text-2xl font-black uppercase text-white tracking-tight"
          style={{ fontFamily: '"Impact", "Arial Black", sans-serif' }}
        >
          {title}
        </h2>
      </div>
      <p className="font-mono text-[11px] text-white/50 uppercase tracking-widest mt-1">{sub}</p>
    </div>
  );
}

// ── Albums ──────────────────────────────────────────────────────────────

function AlbumTrackList({ album }: { album: AudiusAlbum }) {
  const [tracks, setTracks] = useState<AudiusTrack[] | null>(null);
  const [failed, setFailed] = useState(false);
  const setPlaylist = useGlobalPlayer((s) => s.setPlaylist);

  useEffect(() => {
    let live = true;
    setTracks(null);
    setFailed(false);
    fetchAlbumTracks(album.id)
      .then((t) => live && setTracks(t))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [album.id]);

  const albumCover = (t: AudiusTrack) => t.artwork ?? album.artwork;
  const totalPlays = tracks?.reduce((n, t) => n + t.plays, 0) ?? 0;

  return (
    <div className="rounded-lg border border-white/10 bg-black/50 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-white/10">
        <div>
          <div className="font-black uppercase text-white tracking-tight text-lg">{album.name}</div>
          <div className="font-mono text-[10px] text-white/50 uppercase tracking-widest">
            {tracks ? `${tracks.length} tracks • ${formatPlays(totalPlays)} plays on Audius` : 'Loading tracks…'}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!tracks?.length}
            onClick={() => tracks && setPlaylist(tracks.map((t) => toGlobalTrack(t, albumCover(t))), 0, true)}
            className="btn-3d"
           
            data-size="sm"
          >
            <Play size={13} />
            <span>Play album</span>
          </button>
          <a href={album.url} target="_blank" rel="noopener noreferrer" className="btn-3d" data-tone="quiet" data-size="sm">
            <ExternalLink size={13} />
            <span>Audius</span>
          </a>
        </div>
      </div>

      {failed && (
        <p className="px-4 py-6 font-mono text-xs text-white/60">
          Couldn't reach Audius just now.{' '}
          <a href={album.url} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: ACCENT }}>
            Listen on Audius
          </a>
          .
        </p>
      )}
      {!tracks && !failed && (
        <div className="px-4 py-8 flex justify-center">
          <div className="w-6 h-6 border-2 border-white/20 rounded-full animate-spin" style={{ borderTopColor: ACCENT }} />
        </div>
      )}
      {tracks && (
        <ol className="divide-y divide-white/5">
          {tracks.map((t, i) => (
            <li key={t.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/5">
              <span className="w-6 text-right font-mono text-[11px] text-white/40">{i + 1}</span>
              <PlayToggle track={t} playlist={tracks} index={i} cover={albumCover} size={30} />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white truncate">{t.title}</div>
                <div className="font-mono text-[10px] text-white/40 uppercase tracking-wider">
                  {formatPlays(t.plays)} plays
                  {t.day != null ? (
                    <>
                      {' • '}
                      <Link to={`/day/${t.day}`} className="no-underline" style={{ color: '#00E5FF' }}>
                        Day {t.day}
                      </Link>
                    </>
                  ) : (
                    <span style={{ color: ACCENT }}> • Beyond 365</span>
                  )}
                </div>
              </div>
              <span className="font-mono text-[11px] text-white/40">{formatDuration(t.duration)}</span>
              <GameButton track={t} />
              <a
                href={t.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${t.title} on Audius`}
                className="text-white/40 hover:text-white"
              >
                <ExternalLink size={14} />
              </a>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function AlbumsSection() {
  const [albums, setAlbums] = useState<AudiusAlbum[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetchAudiusAlbums()
      .then((a) => {
        if (!live) return;
        setAlbums(a);
        setOpenId((cur) => cur ?? a[0]?.id ?? null);
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);

  const open = albums?.find((a) => a.id === openId) ?? null;

  return (
    <section className="mb-12">
      <SectionTitle icon={Disc3} title="Albums" sub="Full albums, streamed from Audius" />
      {failed && (
        <p className="font-mono text-xs text-white/60">
          Couldn't load the albums.{' '}
          <a href={`${PROFILE_URL}/albums`} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: ACCENT }}>
            See them on Audius
          </a>
          .
        </p>
      )}
      {albums && (
        <>
          <div className="grid grid-cols-3 gap-3 sm:gap-5 mb-5 max-w-3xl">
            {albums.map((a) => {
              const active = a.id === openId;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setOpenId(a.id)}
                  className="text-left group cursor-pointer"
                  aria-pressed={active}
                >
                  <div
                    className="relative aspect-square rounded-lg overflow-hidden border-2 transition-all"
                    style={{
                      borderColor: active ? ACCENT : 'rgba(255,255,255,0.1)',
                      boxShadow: active ? `0 0 24px ${ACCENT}55` : 'none',
                    }}
                  >
                    {a.artwork ? (
                      <img src={a.artwork} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-fuchsia-900 to-black" />
                    )}
                    {a.published && (
                      <span
                        className="absolute top-2 left-2 px-1.5 py-0.5 rounded font-mono text-[9px] font-black uppercase tracking-wider text-black"
                        style={{ background: '#E5B800' }}
                      >
                        Published
                      </span>
                    )}
                  </div>
                  <div className="mt-2 font-black uppercase text-white text-xs sm:text-sm tracking-tight truncate">{a.name}</div>
                  <div className="font-mono text-[10px] text-white/40 uppercase tracking-wider">{a.trackCount} tracks</div>
                </button>
              );
            })}
          </div>
          {open && <AlbumTrackList album={open} />}
        </>
      )}
      {!albums && !failed && (
        <div className="grid grid-cols-3 gap-3 sm:gap-5 max-w-3xl">
          {[0, 1, 2].map((i) => (
            <div key={i} className="aspect-square rounded-lg bg-white/5 animate-pulse" />
          ))}
        </div>
      )}
    </section>
  );
}

// ── Beyond 365 ──────────────────────────────────────────────────────────

function Placeholder({ title }: { title: string }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-3 text-center bg-[radial-gradient(circle_at_30%_20%,#5b0a66,#0b0410_70%)]">
      <Sparkles size={22} style={{ color: ACCENT }} />
      <span className="font-black uppercase text-white/90 text-xs leading-tight line-clamp-3">{title}</span>
      <span className="font-mono text-[9px] text-white/40 uppercase tracking-widest">Beyond 365</span>
    </div>
  );
}

function BeyondCard({ track, playlist, index, cover, onRanks }: {
  track: AudiusTrack;
  playlist: AudiusTrack[];
  index: number;
  cover: (t: AudiusTrack) => string | null;
  onRanks: (t: AudiusTrack) => void;
}) {
  const { isCurrent } = usePlayerFor(track.id);
  const img = cover(track);
  return (
    <div
      className="rounded-lg overflow-hidden border bg-black/60 transition-colors"
      style={{ borderColor: isCurrent ? ACCENT : 'rgba(255,255,255,0.1)' }}
    >
      <div className="relative aspect-square">
        {img ? <img src={img} alt="" loading="lazy" className="w-full h-full object-cover" /> : <Placeholder title={track.title} />}
        <div className="absolute bottom-2 right-2">
          <PlayToggle track={track} playlist={playlist} index={index} cover={cover} size={38} />
        </div>
      </div>
      <div className="px-3 py-2">
        <div className="text-sm text-white truncate" title={track.title}>{track.title}</div>
        <div className="flex items-center justify-between font-mono text-[10px] text-white/40 uppercase tracking-wider">
          <span>{formatPlays(track.plays)} plays • {formatDuration(track.duration)}</span>
          <a href={track.url} target="_blank" rel="noopener noreferrer" aria-label={`${track.title} on Audius`} className="hover:text-white">
            <ExternalLink size={12} />
          </a>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <GameButton track={track} label="Play PIM" />
          <button
            type="button"
            onClick={() => onRanks(track)}
            aria-label={`${track.title} leaderboard`}
            title="Leaderboard"
            className="btn-3d"
            data-tone="quiet"
            data-size="sm"
          >
            <Trophy size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

function RanksModal({ track, onClose }: { track: AudiusTrack; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${track.title} leaderboard`}
    >
      <div
        className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-xl border border-white/15 bg-[#0a0805] p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <div className="font-mono text-[10px] uppercase tracking-widest" style={{ color: ACCENT }}>Beyond 365</div>
            <div className="font-black uppercase text-white text-lg tracking-tight truncate">{track.title}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-white/60 hover:text-white cursor-pointer">
            <X size={20} />
          </button>
        </div>
        <SongLeaderboard songId={audiusSongId(track.permalink)} defaultLimit={10} title="ALL-TIME RANKINGS" />
        <div className="mt-4 flex justify-end">
          <GameButton track={track} label="Play PIM" />
        </div>
      </div>
    </div>
  );
}

function BeyondSection({ tracks, failed }: { tracks: AudiusTrack[] | null; failed: boolean }) {
  const setPlaylist = useGlobalPlayer((s) => s.setPlaylist);
  const [ranksFor, setRanksFor] = useState<AudiusTrack | null>(null);

  // Order follows the generated map; live data adds ids, plays and artwork.
  const beyond = useMemo(() => {
    if (!tracks) return null;
    const byPermalink = new Map(tracks.map((t) => [t.permalink.toLowerCase(), t]));
    return BEYOND_365.map((b) => byPermalink.get(b.permalink.toLowerCase())).filter(
      (t): t is AudiusTrack => Boolean(t),
    );
  }, [tracks]);

  // The owner's own cover card wins; then the Audius artwork; then a placeholder.
  const cover = (t: AudiusTrack) => getBeyondCover(t.permalink) ?? t.artwork;

  return (
    <section className="mb-12">
      {ranksFor && <RanksModal track={ranksFor} onClose={() => setRanksFor(null)} />}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionTitle icon={Radio} title="Beyond 365" sub="Songs on Audius that live outside the 365 days" />
        {beyond && beyond.length > 0 && (
          <button
            type="button"
            onClick={() => setPlaylist(beyond.map((t) => toGlobalTrack(t, cover(t))), 0, true)}
            className="btn-3d mb-4"
           
            data-size="sm"
          >
            <ListMusic size={13} />
            <span>Play all</span>
          </button>
        )}
      </div>

      {beyond ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {beyond.map((t, i) => (
            <BeyondCard key={t.id} track={t} playlist={beyond} index={i} cover={cover} onRanks={setRanksFor} />
          ))}
        </div>
      ) : failed ? (
        // Audius unreachable: still list the songs, with links out.
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {BEYOND_365.map((b) => (
            <li key={b.permalink}>
              <a
                href={`https://audius.co${b.permalink}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 px-3 py-2 rounded border border-white/10 bg-black/50 text-sm text-white no-underline hover:border-white/30"
              >
                <span className="truncate">{b.title}</span>
                <ExternalLink size={13} className="shrink-0 text-white/40" />
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {BEYOND_365.map((b) => (
            <div key={b.permalink} className="aspect-[3/4] rounded-lg bg-white/5 animate-pulse" />
          ))}
        </div>
      )}
    </section>
  );
}

// ── Page ────────────────────────────────────────────────────────────────

export default function AudiusPage() {
  const [tracks, setTracks] = useState<AudiusTrack[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    fetchAudiusTracks()
      .then((t) => live && setTracks(t))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);

  const totalPlays = tracks?.reduce((n, t) => n + t.plays, 0) ?? null;

  return (
    <div className="flex-1 w-full min-h-screen bg-[#050402] text-white relative pb-28">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none z-0" />

      <section className="relative z-10 border-b border-white/10 bg-[#0a0805] px-4 sm:px-6 lg:px-8 pt-8 pb-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: ACCENT }} />
              <span className="font-mono text-[10px] uppercase font-bold tracking-[0.3em]" style={{ color: ACCENT }}>
                Streaming from Audius
              </span>
            </div>
            <h1
              className="text-3xl sm:text-5xl font-black uppercase text-white tracking-tight"
              style={{ fontFamily: '"Impact", "Arial Black", sans-serif' }}
            >
              th3Scr1b3 on Audius
            </h1>
            <p className="font-mono text-xs text-white/60 uppercase tracking-widest mt-1">
              {tracks ? `${tracks.length} tracks • ${formatPlays(totalPlays ?? 0)} plays` : 'Albums • Beyond 365'}
              {' • every play here counts on Audius'}
            </p>
          </div>
          <a
            href={PROFILE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-5 py-3 rounded text-white font-mono text-xs font-black uppercase tracking-wider transition-all hover:scale-105 active:scale-95 no-underline"
            style={{ background: ACCENT, boxShadow: `0 0 20px ${ACCENT}55` }}
          >
            <span>Follow on Audius</span>
            <ExternalLink size={14} />
          </a>
        </div>
      </section>

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <AlbumsSection />
        <BeyondSection tracks={tracks} failed={failed} />
      </main>
    </div>
  );
}
