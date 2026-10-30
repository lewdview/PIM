/**
 * TrackDetail — the one card / track detail view used everywhere a day of the
 * 365 archive can be opened: collection, codex, daily drop, 365 archive,
 * campaign, award play and search. Shown as a modal (TrackDetailModal) or a
 * full page (/song/:songId and /day/:day).
 *
 * Left: the card art and every way to play or hear it.
 * Right: Overview · My stats · Leaderboard · Artwork · My card · Lyrics.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation } from 'wouter';
import { Check, Disc, Film, Gamepad2, Lock, Pause, Play, Share2, Volume2, X, CheckCircle } from 'lucide-react';
import { getModifierForSong } from '@/game/api';
import { audioManager } from '@/game/audio';
import { DELUXE_UNLOCK_ACCURACY, deluxeSongId, isDeluxeUnlocked, loadEarnedDeluxeDays } from '@/lib/deluxe';
import { useAuthStore } from '@/store/useAuthStore';
import type { OwnedCard } from '../../services/vaultService';
import { useGlobalPlayer } from '../../store/useGlobalPlayer';
import { useVaultStore } from '../../store/useVaultStore';
import { RARITY_CONFIG, getSupplyCap, type Rarity } from '../../utils/rarity';
import { getCoverUrlForRarity, useSmartCoverArt } from '../../utils/rarityArtwork';
import { getBombshellCoverUrl, isBombshellCard } from '../../utils/bombshellCards';
import { primeGameCover } from '../../utils/gameCover';
import { getDateFromDay } from '../../utils/dayCalc';
import RarityBadge from '../RarityBadge';
import OneOfOneOutline from '../OneOfOneOutline';
import { MythicGodRays, MythicPrismFoil, MythicEmberParticles } from '../MythicCardEffects';
import SongLeaderboard from '../SongLeaderboard';
import { useTrackDetail } from './useTrackDetail';
import { OverviewSection, StatsSection, LyricsSection, MEDAL_COLOR } from './InfoSections';
import ArtworkSection from './ArtworkSection';
import CardSection from './CardSection';
import '../../styles/stageShell.css';
import './trackDetail.css';

export type TrackDetailTab = 'overview' | 'stats' | 'leaderboard' | 'artwork' | 'card' | 'lyrics';

const DIFF_COLORS = ['#39FF14', '#39FF14', '#39FF14', '#00E5FF', '#00E5FF', '#00E5FF', '#E5B800', '#E5B800', '#E5B800', '#FF1493'];

export interface TrackDetailProps {
  day: number;
  /** Catalog id if the caller has one (day-005); otherwise derived from the day */
  songIdHint?: string;
  variant: 'modal' | 'page';
  /** Copy to focus on when opened from the collection */
  ownedCard?: OwnedCard | null;
  /**
   * Where PIM should send the player back to after a run, as a route without
   * the leading slash: 'songs', 'chapter/3', 'vault/collection', 'codex', …
   * Chapter origins keep the campaign rule (first play free, replays need the card).
   */
  origin: string;
  initialTab?: TrackDetailTab;
  onClose?: () => void;
  onBurn?: (card: OwnedCard) => void;
  /** Replace the default Play action (the daily drop runs its own claim screen) */
  onPlay?: () => void;
  /** Extra controls for the top bar (page variant: back, day stepper) */
  topBar?: ReactNode;
}

export default function TrackDetail({
  day, songIdHint, variant, ownedCard, origin, initialTab = 'overview', onClose, onBurn, onPlay, topBar,
}: TrackDetailProps) {
  const [, setLocation] = useLocation();
  const data = useTrackDetail(day, songIdHint);
  const { song, songId, ownedCopies, isOwned, unlockedCovers, stats, today } = data;

  const collection = useVaultStore((s) => s.collection);
  const equippedCardId = useVaultStore((s) => s.equippedCardId);
  const setPreferredCardCover = useVaultStore((s) => s.setPreferredCardCover);
  const silentClaimDailyDrop = useVaultStore((s) => s.silentClaimDailyDrop);

  const currentTrack = useGlobalPlayer((s) => s.currentTrack);
  const isGlobalPlaying = useGlobalPlayer((s) => s.isPlaying);
  const playGlobal = useGlobalPlayer((s) => s.play);
  const pauseGlobal = useGlobalPlayer((s) => s.pause);
  const stopGlobal = useGlobalPlayer((s) => s.stop);

  const [tab, setTab] = useState<TrackDetailTab>(initialTab);
  const [copied, setCopied] = useState(false);
  const [previewRarity, setPreviewRarity] = useState<Rarity | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(ownedCard?.id ?? null);
  const [diff, setDiff] = useState<number>(5);
  const [claiming, setClaiming] = useState(false);
  const [deluxeLoaded, setDeluxeLoaded] = useState(0);
  const userId = useAuthStore((s) => s.user?.id);

  useEffect(() => {
    let alive = true;
    loadEarnedDeluxeDays(userId).then(() => { if (alive) setDeluxeLoaded((n) => n + 1); });
    return () => { alive = false; };
  }, [userId]);

  useEffect(() => { setTab(initialTab); }, [day, initialTab]);
  useEffect(() => { setFocusedId(ownedCard?.id ?? null); setPreviewRarity(null); }, [day, ownedCard?.id]);
  // Always start from the canonical difficulty: a stale override voids award eligibility.
  useEffect(() => { if (song) setDiff(song.difficultyLevel || 5); }, [song?.id]);

  const focused = useMemo<OwnedCard | null>(
    () => ownedCopies.find((c) => c.id === focusedId) || ownedCard || ownedCopies[0] || null,
    [ownedCopies, focusedId, ownedCard],
  );

  // ── Active bombshell cover: saved preference, else the focused copy's own art ──
  const [activeCover, setActiveCover] = useState<string | null>(null);
  useEffect(() => {
    const pref = data.preferredCover;
    const own = focused && isBombshellCard(focused) ? focused.coverArtwork || focused.card.coverArtwork || null : null;
    if (pref && unlockedCovers.has(pref)) setActiveCover(pref);
    else if (own && unlockedCovers.has(own)) setActiveCover(own);
    else setActiveCover(unlockedCovers.size > 0 ? Array.from(unlockedCovers)[0] : null);
  }, [day, focused?.id, data.preferredCover, unlockedCovers]);

  const handleSelectCover = (fileName: string) => {
    setActiveCover(fileName);
    setPreviewRarity(null);
    setPreferredCardCover(day, fileName);
    primeGameCover(day, getBombshellCoverUrl(day, fileName));
  };

  // ── Card art on display ──
  const displayRarity: Rarity = (previewRarity || focused?.card.rarity || 'common') as Rarity;
  const rc = RARITY_CONFIG[displayRarity] || RARITY_CONFIG.common;
  const baseCover = song?.coverArt || data.vaultCard?.coverUrl || focused?.card.coverUrl || '';
  const rawCoverUrl = useMemo(() => {
    if (previewRarity) return getCoverUrlForRarity(baseCover, previewRarity);
    if (activeCover) return getBombshellCoverUrl(day, activeCover);
    if (focused) return isBombshellCard(focused) ? focused.card.coverUrl : getCoverUrlForRarity(focused.card.coverUrl, focused.card.rarity);
    return baseCover;
  }, [previewRarity, activeCover, focused, baseCover, day]);
  const { src: coverUrl, handleError: handleCoverError } = useSmartCoverArt(rawCoverUrl, displayRarity);
  const isOneOfOne = displayRarity === 'mythic' || (!previewRarity && focused?.edition === 1 && getSupplyCap(displayRarity, day) === 1);

  // ── Play rules (same gate PIM itself applies) ──
  const isChapter = origin.startsWith('chapter');
  // A caller-supplied onPlay (the daily drop) runs its own claim flow, so it's never locked here.
  const canPlay = !data.isFuture && (Boolean(onPlay) || (isChapter ? !stats.isCleared || isOwned : isOwned || day === today));
  // deluxeLoaded re-renders once earned Deluxe unlocks are hydrated from gameplay records
  const deluxeOpen = deluxeLoaded >= 0 && isOwned && isDeluxeUnlocked(collection, day);
  // Only Award play offers a difficulty override: it's the only origin whose results
  // screen voids prizes for a changed difficulty.
  const showDiff = canPlay && origin === 'songs' && !onPlay;
  const lockedReason = data.isFuture
    ? `Day ${day} hasn't been released yet.`
    : isChapter
      ? 'Replaying a cleared stage needs the card.'
      : 'Own this card to play it. Find it in packs or the vault.';

  const handlePlay = async (opts: { deluxe?: boolean; exportVideo?: boolean } = {}) => {
    if (!canPlay || !song) return;
    if (onPlay && !opts.deluxe && !opts.exportVideo) {
      onPlay();
      return;
    }
    audioManager.playSfx('tap_nav', 0.4);
    stopGlobal();
    // Claim-first: today's free card is claimed before entering play so PIM's gate sees it.
    if (day === today && !isOwned) {
      setClaiming(true);
      try { await silentClaimDailyDrop(day); } catch (err) { console.error('[TrackDetail] claim-first failed', err); }
      setClaiming(false);
    }
    const playId = opts.deluxe ? deluxeSongId(day) : songId;
    sessionStorage.setItem(`game_origin_${playId}`, origin);
    sessionStorage.setItem(`diff_override_${playId}`, String(showDiff ? diff : song.difficultyLevel));
    const modifier = getModifierForSong(song);
    if (equippedCardId === songId && modifier !== 'none') sessionStorage.setItem(`active_modifier_type_${playId}`, modifier);
    else sessionStorage.removeItem(`active_modifier_type_${playId}`);
    if (opts.exportVideo) sessionStorage.setItem(`export_video_${playId}`, 'true');
    primeGameCover(day, rawCoverUrl);
    onClose?.();
    setLocation(`/play/${playId}`);
  };

  // ── Listening: full track with the card, a 30s preview without ──
  const audioUrl = song?.audioUrl || data.vaultCard?.audioUrl || '';
  const isThisPlaying = Boolean(isGlobalPlaying && currentTrack && currentTrack.day === day && currentTrack.audioUrl === audioUrl);
  const toggleListen = () => {
    if (!audioUrl) return;
    if (isThisPlaying) { pauseGlobal(); audioManager.playSfx('pause', 0.2); return; }
    audioManager.playSfx('tap_nav', 0.3);
    playGlobal({
      id: songId,
      title: data.title,
      artist: data.artist,
      audioUrl,
      coverUrl: coverUrl || baseCover,
      day,
      rarity: focused?.card.rarity || 'common',
      isDailyClaim: true,
      maxDuration: isOwned ? 0 : 30,
    });
  };
  const playCoverAudio = (cover: string) => {
    if (!audioUrl) return;
    playGlobal({ id: songId, title: data.title, artist: data.artist, audioUrl, coverUrl: cover, day, rarity: focused?.card.rarity || 'common', isDailyClaim: true, maxDuration: isOwned ? 0 : 30 });
  };
  const openVisualizer = () => {
    stopGlobal();
    sessionStorage.setItem(`game_origin_${songId}`, origin);
    onClose?.();
    setLocation(`/listen/${songId}`);
  };

  const handleShare = () => {
    const url = `${window.location.origin}/day/${day}`;
    if (navigator.share) {
      navigator.share({ title: `${data.title} · PIM Day ${day}`, url }).catch(() => {});
      return;
    }
    navigator.clipboard?.writeText?.(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleBurn = onBurn ? (c: OwnedCard) => { onBurn(c); onClose?.(); } : undefined;

  const dateStr = getDateFromDay(day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const moodColor = data.mood === 'light' ? '#39FF14' : '#FF1493';
  const mc = MEDAL_COLOR[stats.medal] ?? '#666';

  const tabs: { id: TrackDetailTab; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'stats', label: 'My stats' },
    { id: 'leaderboard', label: 'Leaderboard' },
    { id: 'artwork', label: 'Artwork', count: data.dayCovers.totalCovers ? unlockedCovers.size : undefined },
    { id: 'card', label: 'My card', count: ownedCopies.length || undefined },
    { id: 'lyrics', label: 'Lyrics' },
  ];

  if (data.loading) {
    return (
      <div className="td-root relative flex items-center justify-center py-32">
        {onClose && (
          <button type="button" aria-label="Close" onClick={onClose}
            className="absolute top-3 right-4 w-10 h-10 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 text-white/70 cursor-pointer">
            <X size={18} />
          </button>
        )}
        <span className="font-mono text-xs tracking-[0.3em] uppercase text-[#00E5FF] animate-pulse">Loading Day {day}…</span>
      </div>
    );
  }

  if (data.isFuture) {
    return (
      <div className="td-root flex flex-col items-center justify-center text-center gap-4 py-24 px-6">
        <Lock size={28} className="text-white/40" />
        <div className="font-mono text-xs text-[#FF5500] uppercase font-bold tracking-[0.3em]">Not released yet</div>
        <h1 className="td-title">Day #{day} is in the future</h1>
        <p className="td-muted max-w-md">One track is released every day. Today is Day #{today}.</p>
        <div className="flex gap-3">
          <button type="button" className="btn-3d" data-tone="gold" onClick={() => setLocation(`/day/${today}`)}>Go to today</button>
          <button type="button" className="btn-3d" data-tone="quiet" onClick={() => setLocation('/365')}>365 archive</button>
        </div>
      </div>
    );
  }

  const identity = (
    <div className="space-y-3 mb-6">
      <div className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-white/45">
        Day {String(day).padStart(3, '0')} of 365 · {dateStr}
      </div>
      <h1 className="td-title" style={{ color: '#F2F0E8' }}>{data.title}</h1>
      <div className="font-mono text-xs uppercase tracking-widest text-white/50">{data.artist}{song?.key ? ` · ${song.key}` : ''}</div>
      <div className="flex flex-wrap gap-2 pt-1">
        <span className="td-chip" style={{ color: moodColor, borderColor: `${moodColor}55`, background: `${moodColor}12` }}>{data.mood} realm</span>
        {stats.medal && stats.medal !== 'NONE' && <span className="td-chip" style={{ color: mc, borderColor: `${mc}55` }}>{stats.medal}</span>}
        {stats.best > 0 && <span className="td-chip">Best {stats.best.toLocaleString()}</span>}
        {stats.allPrizes && <span className="td-chip" style={{ color: '#facc15', borderColor: 'rgba(250,204,21,0.4)' }}>🏆 All prizes claimed</span>}
        {ownedCopies.some((c) => c.edition === 1 || c.proof === 'proof_of_first') && (
          <span className="td-chip" style={{ color: '#ffd700', borderColor: 'rgba(255,215,0,0.35)' }}>👑 First discoverer</span>
        )}
        {!canPlay && <span className="td-chip" style={{ color: '#FF3800', borderColor: 'rgba(255,56,0,0.4)' }}><Lock size={10} /> Locked</span>}
      </div>
    </div>
  );

  const playLabel = claiming ? 'Claiming…' : onPlay ? `Play Day ${day}` : 'Play PIM';

  return (
    <div className="td-root relative" style={{ ['--td-accent' as any]: rc.color }}>
      {/* Mood glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[640px] h-[640px] rounded-full blur-[180px] opacity-[0.14]" style={{ background: moodColor }} />
      </div>

      {/* Top bar */}
      <div className="relative flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-white/10">
        <div className="flex items-center gap-2 min-w-0">{topBar}</div>
        <div className="flex items-center gap-2 shrink-0">
          <button type="button" className="btn-3d" data-size="sm" data-tone="ghost" onClick={handleShare} title="Share this card">
            {copied ? <Check size={13} className="text-[#39FF14]" /> : <Share2 size={13} />}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Share'}</span>
          </button>
          {onClose && (
            <button type="button" aria-label="Close" onClick={onClose}
              className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 text-white/70 hover:text-white cursor-pointer">
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      <div className="relative grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-8 px-4 sm:px-6 py-6">
        {/* ── LEFT: card + actions ── */}
        <aside className="td-aside flex flex-col gap-5">
          <div className="lg:hidden">{identity}</div>
          <div className="relative w-full max-w-[240px] sm:max-w-[300px] mx-auto">
            {displayRarity === 'mythic' && <MythicGodRays />}
            <div className="absolute -inset-4 rounded-3xl opacity-25 blur-2xl" style={{ background: `radial-gradient(circle, ${rc.color}, transparent 70%)` }} />
            <div className="relative aspect-[3/4] rounded-2xl overflow-hidden border-2 shadow-2xl"
              style={{ borderColor: isOwned || previewRarity ? rc.color : 'rgba(255,255,255,0.15)', boxShadow: `0 0 35px ${rc.color}30, 0 10px 40px rgba(0,0,0,0.8)` }}>
              <img src={coverUrl || undefined} alt={data.title} onError={handleCoverError}
                className={`w-full h-full object-cover ${!isOwned && !previewRarity ? 'saturate-[0.6]' : ''}`} />
              {displayRarity === 'mythic' && <MythicPrismFoil />}
              {displayRarity === 'mythic' && <MythicEmberParticles count={12} />}
              {isOneOfOne && <OneOfOneOutline color="#ffd700" speedSec={14} />}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/30 pointer-events-none" />
              <div className="absolute top-3 inset-x-3 flex justify-between items-center pointer-events-none">
                <span className="px-2 py-0.5 rounded bg-black/80 border border-white/20 text-[9px] font-mono font-bold tracking-widest">DAY {String(day).padStart(3, '0')}</span>
                {(isOwned || previewRarity) && <RarityBadge rarity={displayRarity} size="sm" />}
              </div>
              {previewRarity && (
                <span className="absolute bottom-3 left-3 px-2 py-0.5 rounded bg-black/80 border border-white/20 text-[9px] font-mono uppercase tracking-widest text-white/70">Edition preview</span>
              )}
              {audioUrl && (
                <button type="button" onClick={toggleListen} aria-label={isThisPlaying ? 'Pause' : 'Listen'}
                  className="absolute bottom-3 right-3 w-11 h-11 rounded-full bg-white text-black flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.45)] cursor-pointer active:scale-95">
                  {isThisPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" fill="#000" />}
                </button>
              )}
            </div>
          </div>

          {/* Ownership strip */}
          <div className="hw-well px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="td-label">Your vault</span>
              {isOwned ? (
                <span className="flex items-center gap-1.5 text-xs font-bold text-[#39FF14] mt-0.5">
                  <CheckCircle size={13} /> Owned · {ownedCopies.length} {ownedCopies.length === 1 ? 'copy' : 'copies'}
                </span>
              ) : (
                <span className="text-xs font-bold text-white/70 mt-0.5 block">{day === today ? "Today's free card" : 'Not owned yet'}</span>
              )}
            </div>
            <button type="button" className="font-mono text-[10px] uppercase font-bold text-[var(--shell-gold)] hover:underline cursor-pointer shrink-0" onClick={() => setTab('card')}>
              {isOwned ? 'View card' : 'How to get'} →
            </button>
          </div>

          {/* Difficulty (not in campaign, where the stage sets it) */}
          {showDiff && song && (
            <div className="hw-well px-4 py-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="td-label">Difficulty</span>
                <span className="font-mono font-bold text-xs" style={{ color: DIFF_COLORS[Math.min(diff - 1, 9)] }}>
                  LVL {diff}{diff === song.difficultyLevel ? ' · standard' : ''}
                </span>
              </div>
              <input type="range" min={1} max={10} value={diff} onChange={(e) => setDiff(parseInt(e.target.value, 10))}
                className="w-full cursor-pointer" style={{ accentColor: DIFF_COLORS[Math.min(diff - 1, 9)] }} aria-label="Difficulty" />
              {diff !== song.difficultyLevel && (
                <p className="font-mono text-[9px] text-[#FF8A00] mt-1 uppercase">Changed difficulty: no award prizes this run</p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="hidden lg:flex flex-col gap-2">
            {!canPlay && (
              <div className="rounded-xl border border-[#FF3800]/40 bg-[#FF3800]/10 px-3 py-2.5 text-center font-mono text-[10px] text-[#ff8a66] uppercase">
                <Lock size={11} className="inline mr-1" /> {lockedReason}
              </div>
            )}
            <button type="button" className="btn-3d justify-center" data-size="lg" data-tone={canPlay ? 'acid' : 'quiet'} disabled={!canPlay || claiming} onClick={() => handlePlay()}>
              <Gamepad2 size={18} /> {playLabel}
            </button>
            {isOwned && (
              <button type="button" className="btn-3d justify-center" data-tone={deluxeOpen ? 'gold' : 'quiet'} disabled={!deluxeOpen} onClick={() => handlePlay({ deluxe: true })}
                title={deluxeOpen ? 'Play the Deluxe chart' : `Hit ${DELUXE_UNLOCK_ACCURACY}% on this song or open a Deluxe pack`}>
                {deluxeOpen ? <Play size={15} fill="currentColor" /> : <Lock size={14} />} {deluxeOpen ? 'Play Deluxe' : `Deluxe · ${DELUXE_UNLOCK_ACCURACY}% to unlock`}
              </button>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="btn-3d justify-center" data-tone="ghost" onClick={toggleListen} disabled={!audioUrl}>
                {isThisPlaying ? <Pause size={14} /> : <Volume2 size={14} />} {isThisPlaying ? 'Pause' : isOwned ? 'Listen' : 'Preview 30s'}
              </button>
              <button type="button" className="btn-3d justify-center" data-tone="ghost" onClick={openVisualizer} disabled={!audioUrl || !isOwned}
                title={isOwned ? 'Open the visualizer' : 'Own the card to open the visualizer'}>
                <Disc size={14} /> Visualizer
              </button>
            </div>
            {import.meta.env.DEV && (
              <button type="button" className="btn-3d justify-center" data-tone="quiet" data-size="sm" disabled={!canPlay} onClick={() => handlePlay({ exportVideo: true })}
                title="Export frame-perfect 100% PERFECT+ run video (dev only)">
                <Film size={13} /> Export video (dev)
              </button>
            )}
          </div>
        </aside>

        {/* ── RIGHT: identity + tabs ── */}
        <main className="min-w-0">
          <div className="hidden lg:block">{identity}</div>

          <div className="td-tabs" role="tablist">
            {tabs.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className="td-tab" onClick={() => { audioManager.playSfx('tap_nav', 0.08); setTab(t.id); }}>
                {t.label}{t.count !== undefined && <span className="td-tab-count">{t.count}</span>}
              </button>
            ))}
          </div>

          <div role="tabpanel" className="pb-6">
            {tab === 'overview' && <OverviewSection data={data} />}
            {tab === 'stats' && <StatsSection data={data} />}
            {tab === 'leaderboard' && (
              <SongLeaderboard songId={songId} currentScore={stats.best} currentMedal={stats.medal} defaultLimit={10} title={`Day ${day} rankings`} />
            )}
            {tab === 'artwork' && (
              <ArtworkSection
                data={data}
                activeCover={activeCover}
                onSelectCover={handleSelectCover}
                previewRarity={previewRarity}
                onPreviewRarity={setPreviewRarity}
                onPlayCover={audioUrl ? playCoverAudio : undefined}
                onNavigateAway={onClose}
              />
            )}
            {tab === 'card' && (
              <CardSection
                data={data}
                selected={focused}
                onSelect={(c) => { setFocusedId(c.id); setPreviewRarity(null); }}
                onBurn={handleBurn}
                onShare={handleShare}
                onNavigateAway={onClose}
              />
            )}
            {tab === 'lyrics' && <LyricsSection data={data} />}
          </div>
        </main>
      </div>

      {/* Phone / tablet: Play pinned to the bottom */}
      <div className="td-dock" style={variant === 'page' ? { bottom: 'calc(var(--shell-dock-h, 74px) + env(safe-area-inset-bottom, 0px))' } : undefined}>
        <button type="button" className="btn-3d flex-1 justify-center" data-tone={canPlay ? 'acid' : 'quiet'} disabled={!canPlay || claiming} onClick={() => handlePlay()}>
          {canPlay ? <Gamepad2 size={16} /> : <Lock size={14} />} {canPlay ? playLabel : 'Locked'}
        </button>
        {deluxeOpen && (
          <button type="button" className="btn-3d justify-center" data-tone="gold" onClick={() => handlePlay({ deluxe: true })}>Deluxe</button>
        )}
        <button type="button" className="btn-3d justify-center" data-tone="ghost" onClick={toggleListen} disabled={!audioUrl} aria-label="Listen">
          {isThisPlaying ? <Pause size={15} /> : <Volume2 size={15} />}
        </button>
        {isOwned && (
          <button type="button" className="btn-3d justify-center" data-tone="ghost" onClick={openVisualizer} disabled={!audioUrl} aria-label="Visualizer">
            <Disc size={15} />
          </button>
        )}
      </div>
    </div>
  );
}
