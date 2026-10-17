// Chapter: one month told as a story through its tracks. A prologue line from
// the lyrics opens it, the mood arc shows how the month moves, and the tracks
// play out as three acts (plus bonus stages as an epilogue). Each act opens
// with its story in three lines (where it starts, where the mood turns, where
// it lands); only the act you're in is expanded to its full track list. Each
// track shows its hook line with its highlight words lit. The sticky play bar always sits
// above the phone dock, so the next track is one tap away on any screen.
//
// In a monthly Playgama build (PLAYGAMA_MONTH) this is the whole game: no
// campaign/vault links, card locks or pack rewards; bonus songs also open by
// rewarded ad or the month's bundle, and a platinum run shows the song's
// Bombshell artwork during play.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, Lock, Pause, Play, Film, CheckCircle2, Gift, Trophy, X } from 'lucide-react';
import { loadCatalog, isSongTimeLocked, getModifierForSong, type GameSong } from '@/game/api';
import { getMedalForSong, getHighScore } from '@/game/progress';
import { CHAPTERS, calculateCampaignDifficulty, levelToTier } from '@/game/campaign';
import { audioManager } from '@/game/audio';
import { useVaultStore, ownsCardForDay } from '@/store/useVaultStore';
import { purchasePack } from '@/services/vaultService';
import { PACK_CONFIGS } from '@/utils/rarity';
import { formatDate } from '@/utils/dayCalc';
import {
  chapterProgress, getMonthStory, getTrackStory, hasClearedSong, isStageUnlocked, songsForMonth, MOOD_LABEL,
  type ChapterAct, type MonthStory,
} from '@/game/chapterStory';
import { Highlighted, WordChips } from './storyParts';
import { getBombshellCoverUrl, BOMBSHELL_COVERS_MAP } from '@/utils/bombshellCards';
import {
  PLAYGAMA_MONTH, MONTH_BOMBSHELL, BONUS_PRODUCT_ID, BONUS_UNLOCK_EVENT,
  isBonusSongBought, canUnlockWithAd, canBuyBundle, unlockSongWithAd, buyBonusBundle,
} from '@/platform/playgama/month';
import { getProductPrice } from '@/platform/playgama/bridge';
import { bombshellFileForDay } from '@/platform/playgama/monthMedia.mjs';
import { hideBroken } from './hideBroken';
import {
  getMonthEntries, monthLeaderboardKind, monthTotal, showMonthPopup, submitMonthScore, type LeaderboardRow,
} from '@/platform/playgama/monthLeaderboard';
import '@/styles/stageShell.css';
import '@/styles/campaignStory.css';
import '@/styles/monthBoard.css';

const MEDAL_COLOR: Record<string, string> = {
  PLATINUM: '#39FF14', GOLD: '#E5B800', SILVER: '#A0AABB', BRONZE: '#C97A3A',
};
const MILESTONES = [
  { n: 1 as const, label: '5 clears', need: (_total: number) => 5 },
  { n: 2 as const, label: '15 clears', need: (_total: number) => 15 },
  { n: 3 as const, label: 'All clears', need: (total: number) => total },
];

const pad = (n: number) => String(n).padStart(2, '0');
const MONTH_BUILD = PLAYGAMA_MONTH > 0;

/** Monthly build: the Bombshell art a platinum run on this song unlocks, or null. */
function bombshellArtFor(song: GameSong): string | null {
  if (!MONTH_BOMBSHELL) return null;
  const file = bombshellFileForDay(song.day, BOMBSHELL_COVERS_MAP);
  return file ? getBombshellCoverUrl(song.day, file) : null;
}
const sfx = (v = 0.12) => audioManager.playSfx('tap_nav', v);
/** Columns of the monthly build's track grid (set in monthBoard.css). */
function gridCols(): number {
  const grid = document.querySelector('.mb-tracks');
  return (grid && parseInt(getComputedStyle(grid).getPropertyValue('--cols'), 10)) || 1;
}

type ActStoryData = Omit<ChapterAct, 'act'>;

interface ActGroup {
  key: string;
  label: string;
  act?: ActStoryData & { act?: string };
  songs: GameSong[];
  startIdx: number;
  bonus: boolean;
}

export default function ChapterStory() {
  const { month } = useParams<{ month: string }>();
  const [, setLocation] = useLocation();
  const monthNum = MONTH_BUILD ? PLAYGAMA_MONTH : Math.min(12, Math.max(1, parseInt(month ?? '1', 10) || 1));
  const meta = CHAPTERS.find((c) => c.month === monthNum) ?? CHAPTERS[0];
  const prev = CHAPTERS.find((c) => c.month === monthNum - 1);
  const next = CHAPTERS.find((c) => c.month === monthNum + 1);
  const story = getMonthStory(monthNum);

  const [songs, setSongs] = useState<GameSong[] | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [claimed, setClaimed] = useState<Record<number, boolean>>({});
  // Acts the player opened or closed by hand; otherwise only the act holding the selected track is open.
  const [actOpen, setActOpen] = useState<Record<string, boolean>>({});
  // Monthly build: bumped when a bonus song is bought or unlocked by ad, to re-read unlocks.
  const [unlockRev, setUnlockRev] = useState(0);
  const [unlocking, setUnlocking] = useState(false);
  const [bundlePrice, setBundlePrice] = useState<string | null>(null);
  // Monthly build: Playgama leaderboard (only where the portal offers one).
  const lbKind = MONTH_BUILD ? monthLeaderboardKind() : 'not_available';
  const [lbOpen, setLbOpen] = useState(false);
  const [lbRows, setLbRows] = useState<LeaderboardRow[] | null>(null);
  const openLeaderboard = async () => {
    sfx(0.15);
    if (lbKind === 'native_popup') { await showMonthPopup(); return; }
    setLbOpen(true);
    setLbRows(null);
    await submitMonthScore();
    setLbRows(await getMonthEntries());
  };

  const collection = useVaultStore((s) => s.collection);
  const loadVaultData = useVaultStore((s) => s.loadVaultData);
  const equippedCardId = useVaultStore((s) => s.equippedCardId);
  const setEquippedCardId = useVaultStore((s) => s.setEquippedCardId);
  const milestoneClaims = useVaultStore((s) => s.milestoneClaims);
  const claimedRewards = useVaultStore((s) => s.claimedRewards);

  // Preview audio
  const previewRef = useRef<HTMLAudioElement | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const stopPreview = useCallback(() => {
    const a = previewRef.current;
    if (a) {
      a.pause();
      a.src = '';
      try { a.load(); } catch { /* ignore */ }
    }
    previewRef.current = null;
    setPreviewing(false);
  }, []);
  useEffect(() => stopPreview, [stopPreview]);

  useEffect(() => {
    if (MONTH_BUILD) return;
    loadVaultData().catch((err) => console.warn('Failed to load vault data', err));
  }, [loadVaultData]);

  useEffect(() => {
    if (!MONTH_BUILD) return;
    const bump = () => setUnlockRev((r) => r + 1);
    window.addEventListener(BONUS_UNLOCK_EVENT, bump);
    if (canBuyBundle()) getProductPrice(BONUS_PRODUCT_ID).then(setBundlePrice);
    return () => window.removeEventListener(BONUS_UNLOCK_EVENT, bump);
  }, []);

  useEffect(() => {
    const next: Record<number, boolean> = {};
    for (const m of [1, 2, 3]) {
      const key = `campaign_claimed_${monthNum}_${m}`;
      next[m] = !!milestoneClaims[key] || localStorage.getItem(key) === 'true';
    }
    setClaimed(next);
  }, [monthNum, milestoneClaims]);

  useEffect(() => {
    let alive = true;
    setSongs(null);
    setActOpen({});
    stopPreview();
    loadCatalog().then((catalog) => {
      if (!alive) return;
      const list = songsForMonth(catalog, monthNum);
      setSongs(list);
      const p = chapterProgress(list, meta);
      const lastId = sessionStorage.getItem('campaign_last_song_id');
      const lastIdx = lastId ? list.findIndex((s) => s.id === lastId) : -1;
      const firstOpen = list.findIndex((s, i) => isStageUnlocked(i, p) && !hasClearedSong(s));
      setSelectedIdx(lastIdx !== -1 ? lastIdx : firstOpen !== -1 ? firstOpen : 0);
    });
    return () => { alive = false; };
  }, [monthNum, meta, stopPreview]);

  const progress = useMemo(() => (songs ? chapterProgress(songs, meta) : null), [songs, meta]);

  // Stage unlocks, plus the monthly build's bought/ad-unlocked bonus songs (open in any order).
  const stageOpen = useCallback((idx: number) => {
    if (!songs || !progress) return false;
    if (isStageUnlocked(idx, progress)) return true;
    return MONTH_BUILD && idx >= progress.regular.length && !!songs[idx] && isBonusSongBought(songs[idx].id);
    // unlockRev: re-evaluate after a purchase or rewarded ad.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songs, progress, unlockRev]);
  // Every song in a monthly build ships with it, so release dates don't apply.
  const timeLockedSong = (s: GameSong) => !MONTH_BUILD && isSongTimeLocked(s);

  // Acts: the story file's three acts over the regular tracks, then an epilogue of bonus stages.
  const groups = useMemo<ActGroup[]>(() => {
    if (!songs || !progress) return [];
    const out: ActGroup[] = [];
    const acts = story?.acts ?? [];
    if (acts.length) {
      for (const act of acts) {
        const inAct = progress.regular.filter((s) => s.day >= act.fromDay && s.day <= act.toDay);
        if (!inAct.length) continue;
        out.push({ key: act.act, label: `Act ${act.act}`, act, songs: inAct, startIdx: songs.indexOf(inAct[0]), bonus: false });
      }
      // Tracks the acts don't cover (bonus split moved, catalog changed) still get shown.
      const covered = new Set(out.flatMap((g) => g.songs));
      const rest = progress.regular.filter((s) => !covered.has(s));
      if (rest.length) out.push({ key: 'more', label: 'Interlude', songs: rest, startIdx: songs.indexOf(rest[0]), bonus: false });
    } else if (progress.regular.length) {
      out.push({ key: 'all', label: 'Tracks', songs: progress.regular, startIdx: 0, bonus: false });
    }
    if (progress.bonus.length) {
      out.push({ key: 'bonus', label: 'Epilogue', act: story?.epilogue ?? undefined, songs: progress.bonus, startIdx: progress.regular.length, bonus: true });
    }
    return out;
  }, [songs, progress, story]);

  const selected = songs?.[selectedIdx];

  const status = useMemo(() => {
    if (!songs || !progress || !selected) return null;
    const isBonus = selectedIdx >= progress.regular.length;
    const cleared = hasClearedSong(selected);
    const ownsCard = ownsCardForDay(collection, selected.day);
    const timeLocked = timeLockedSong(selected);
    const bought = MONTH_BUILD && isBonusSongBought(selected.id);
    const bonusLocked = isBonus && !progress.bonusUnlocked && !bought;
    const progLocked = !stageOpen(selectedIdx);
    // Replays need the song's card in the vault; the monthly build has no vault.
    const cardLocked = !MONTH_BUILD && cleared && !ownsCard;
    const level = calculateCampaignDifficulty(
      monthNum,
      isBonus ? selectedIdx - progress.regular.length : selectedIdx,
      isBonus ? progress.bonus.length : progress.regular.length,
      isBonus,
    );
    let lockReason = '';
    if (timeLocked) lockReason = `Releases ${formatDate(selected.day)}.`;
    else if (bonusLocked && MONTH_BUILD) lockReason = `Bonus song. Earn ${meta.platNeeded} platinum medals in this chapter to open the bonus songs (you have ${progress.platinums}), or unlock it now.`;
    else if (bonusLocked) lockReason = `Bonus stages open at ${meta.platNeeded} platinum medals in this chapter (you have ${progress.platinums}).`;
    else if (progLocked) lockReason = 'Clear the previous track to continue the story.';
    else if (cardLocked) lockReason = 'Replaying a cleared track needs its card. Find it in packs or the vault.';
    const bombshell = bombshellArtFor(selected);
    return {
      isBonus, cleared, ownsCard, level, lockReason, bonusLocked,
      bombshell,
      bombshellUnlocked: !!bombshell && getMedalForSong(selected.id) === 'PLATINUM',
      locked: timeLocked || bonusLocked || progLocked || cardLocked,
      modifier: getModifierForSong(selected),
      medal: getMedalForSong(selected.id),
      score: getHighScore(selected.id),
      prophecy: claimedRewards[selected.id]?.includes('prophecy') || localStorage.getItem(`reward_tier_${selected.id}`) === 'prophecy',
    };
  }, [songs, progress, selected, selectedIdx, collection, monthNum, meta, claimedRewards, stageOpen]);

  const handlePlay = useCallback(() => {
    if (!selected || !status || status.locked) return;
    stopPreview();
    audioManager.playSfx('tap_nav', 0.4);
    sessionStorage.setItem('campaign_last_song_id', selected.id);
    sessionStorage.setItem(`game_origin_${selected.id}`, `chapter/${monthNum}`);
    sessionStorage.setItem(`diff_override_${selected.id}`, String(status.level));
    if (MONTH_BUILD) {
      // A platinum run unlocks the song's Bombshell art as its backdrop in play.
      if (status.bombshellUnlocked && status.bombshell) {
        sessionStorage.setItem(`active_cover_url_${selected.id}`, status.bombshell);
        sessionStorage.setItem(`active_cover_bombshell_${selected.id}`, '1');
      } else {
        sessionStorage.removeItem(`active_cover_url_${selected.id}`);
        sessionStorage.removeItem(`active_cover_bombshell_${selected.id}`);
      }
      // First run of the game teaches the controls on the opening track.
      if (selectedIdx === 0 && !status.cleared && localStorage.getItem('pim_tutorial_completed') !== 'true') {
        setLocation(`/play/${selected.id}?tutorial=true`);
        return;
      }
    }
    if (equippedCardId === selected.id && status.modifier !== 'none') {
      sessionStorage.setItem(`active_modifier_type_${selected.id}`, status.modifier);
    } else {
      sessionStorage.removeItem(`active_modifier_type_${selected.id}`);
    }
    setLocation(`/play/${selected.id}`);
  }, [selected, status, selectedIdx, stopPreview, monthNum, equippedCardId, setLocation]);

  const unlockByAd = async () => {
    if (!selected || unlocking) return;
    stopPreview();
    setUnlocking(true);
    try {
      await unlockSongWithAd(selected.id);
    } finally {
      setUnlocking(false);
    }
  };

  const buyBundle = async () => {
    if (unlocking) return;
    stopPreview();
    setUnlocking(true);
    try {
      await buyBonusBundle();
    } finally {
      setUnlocking(false);
    }
  };

  const select = useCallback((idx: number, scroll = false) => {
    setSelectedIdx(idx);
    setActOpen({});
    stopPreview();
    sfx(0.15);
    if (scroll) {
      requestAnimationFrame(() => document.getElementById(`beat-${idx}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
    }
  }, [stopPreview]);

  // Keyboard and gamepad: up/down or left/right moves through the story, Enter/A/Start plays.
  const playRef = useRef(handlePlay);
  playRef.current = handlePlay;
  const count = songs?.length ?? 0;
  useEffect(() => {
    if (!count) return;
    const move = (d: number) => setSelectedIdx((i) => {
      const n = Math.max(0, Math.min(count - 1, i + d));
      if (n !== i) {
        sfx(0.15);
        setActOpen({});
        requestAnimationFrame(() => document.getElementById(`beat-${n}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
      }
      return n;
    });
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      // The monthly build's track grid moves a whole row on up/down.
      const row = MONTH_BUILD ? gridCols() : 1;
      if (e.key === 'ArrowUp') { e.preventDefault(); move(-row); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); move(row); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); move(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); move(1); }
      else if (e.key === 'Enter' && !(t && t.tagName === 'BUTTON') && !(t && t.tagName === 'A')) playRef.current();
    };
    window.addEventListener('keydown', onKey);

    let raf = 0;
    const prevBtn: Record<string, boolean> = {};
    const poll = () => {
      const gp = navigator.getGamepads ? Array.from(navigator.getGamepads()).find(Boolean) : null;
      if (gp) {
        const btn = {
          play: !!(gp.buttons[0]?.pressed || gp.buttons[9]?.pressed),
          up: !!(gp.buttons[12]?.pressed || gp.buttons[14]?.pressed || (gp.axes[1] ?? 0) < -0.5 || (gp.axes[0] ?? 0) < -0.5),
          down: !!(gp.buttons[13]?.pressed || gp.buttons[15]?.pressed || (gp.axes[1] ?? 0) > 0.5 || (gp.axes[0] ?? 0) > 0.5),
        };
        if (btn.play && !prevBtn.play) playRef.current();
        if (btn.up && !prevBtn.up) move(-1);
        if (btn.down && !prevBtn.down) move(1);
        Object.assign(prevBtn, btn);
      }
      raf = requestAnimationFrame(poll);
    };
    raf = requestAnimationFrame(poll);
    return () => {
      window.removeEventListener('keydown', onKey);
      cancelAnimationFrame(raf);
    };
  }, [count]);

  const togglePreview = () => {
    if (!selected) return;
    if (previewing) { stopPreview(); return; }
    stopPreview();
    const a = new Audio(selected.audioUrl);
    a.volume = 0.4;
    a.currentTime = selected.duration * 0.15;
    a.addEventListener('ended', () => setPreviewing(false));
    previewRef.current = a;
    a.play().catch(() => setPreviewing(false));
    setPreviewing(true);
  };

  const claimReward = async (m: 1 | 2 | 3) => {
    if (!progress) return;
    const need = MILESTONES[m - 1].need(progress.regular.length);
    const key = `campaign_claimed_${monthNum}_${m}`;
    if (progress.cleared < need || localStorage.getItem(key) === 'true') return;
    sfx(0.2);
    const category: 'taste' | 'light' | 'dark' =
      m === 1 ? 'taste' : m === 2 ? (meta.mood === 'light' ? 'light' : 'dark') : (meta.mood === 'light' ? 'dark' : 'light');
    const cards = await purchasePack(category, 'single', undefined, undefined, true);
    if (!cards || !cards.length) return;
    localStorage.setItem(key, 'true');
    useVaultStore.getState().syncMilestoneClaim(monthNum, m);
    setClaimed((c) => ({ ...c, [m]: true }));
    useVaultStore.getState().addToCollection(cards);
    const config = PACK_CONFIGS[category];
    useVaultStore.getState().startReveal(cards, {
      category,
      size: 'single',
      label: `MILESTONE REWARD: ${config.label}`,
      icon: config.icon,
      accent: config.accent,
      gradient: config.gradient,
      price: 'REWARD',
      cardCount: cards.length,
      revealType: 'cinematic' as const,
      redirectPath: `/chapter/${monthNum}`,
      showRipAnother: false,
    });
    setLocation('/vault/reveal');
  };

  const chStyle = { ['--ch' as string]: meta.dc };

  if (!songs || !progress) {
    return <div className="cs-page" style={chStyle}><div className="cs-empty">Loading chapter…</div></div>;
  }

  const prologueSong = story ? songs.find((s) => s.day === story.prologue.day) : undefined;
  const pct = progress.regular.length ? Math.round((progress.cleared / progress.regular.length) * 100) : 0;
  const stateOf = (s: GameSong, i: number) =>
    hasClearedSong(s) ? 'cleared' : stageOpen(i) && !timeLockedSong(s) ? 'open' : 'locked';

  if (MONTH_BUILD) {
    const leaderboard = (lbKind === 'in_game' || lbKind === 'native_popup') && (
      <button type="button" className="btn-3d mb-lb-btn" data-size="sm" data-tone="quiet" onClick={openLeaderboard}>
        <Trophy size={14} /> Leaderboard
      </button>
    );
    const group = groups.find((g) => selectedIdx >= g.startIdx && selectedIdx < g.startIdx + g.songs.length);
    const tr = selected ? getTrackStory(selected.day) : undefined;
    const bonusGated = !progress.bonusUnlocked && progress.bonus.some((b) => !isBonusSongBought(b.id));
    return (
      <div className="mb-page" style={chStyle}>
        <header className="mb-head">
          <div className="mb-title">
            <div className="cs-eyebrow" style={{ color: meta.dc }}>Chapter {pad(meta.month)} · {meta.sub}</div>
            <h1 className="cs-display">{meta.name}</h1>
          </div>
          <div className="mb-progress">
            <div className="cs-stats">
              <span><b>{progress.cleared}/{progress.regular.length}</b> cleared</span>
              <span><b>✦ {progress.platinums}/{meta.platNeeded}</b> platinum for bonus</span>
              <span><b>{meta.diff.toLowerCase()}</b></span>
            </div>
            <div className="cs-bar" aria-label={`${pct}% cleared`}><span style={{ width: `${pct}%` }} /></div>
          </div>
          <div className="mb-head-actions">
            {bonusGated && canBuyBundle() && (
              <button type="button" className="btn-3d" data-size="sm" data-tone="gold" disabled={unlocking} onClick={buyBundle}>
                <Gift size={14} /> Unlock {progress.bonus.length} bonus songs{bundlePrice ? ` · ${bundlePrice}` : ''}
              </button>
            )}
            {leaderboard}
          </div>
        </header>

        <div className="mb-main">
          <ol className="mb-tracks" aria-label="Tracks">
            {songs.map((s, idx) => {
              const state = stateOf(s, idx);
              const medal = getMedalForSong(s.id);
              const isBonus = idx >= progress.regular.length;
              const isActStart = groups.some((g) => g.startIdx === idx && idx > 0);
              return (
                <li key={s.id} id={`beat-${idx}`} data-act-start={isActStart || undefined}>
                  <button
                    type="button"
                    className="mb-tile"
                    data-state={state}
                    data-selected={idx === selectedIdx}
                    data-bonus={isBonus || undefined}
                    aria-label={`${s.title}, ${isBonus ? 'bonus' : `track ${idx + 1}`}, ${state}`}
                    aria-pressed={idx === selectedIdx}
                    onClick={() => select(idx)}
                    onDoubleClick={() => { if (idx === selectedIdx) handlePlay(); }}
                  >
                    {s.coverArt && <img src={s.coverArt} alt="" loading="lazy" onError={hideBroken} />}
                    <span className="mb-tile-n">{isBonus ? '★' : idx + 1}</span>
                    {state === 'locked' && <span className="mb-tile-ico"><Lock size={14} /></span>}
                    {state === 'cleared' && (
                      <span className="mb-tile-medal" style={{ background: MEDAL_COLOR[medal] ?? '#39ff14' }} title={medal} />
                    )}
                  </button>
                </li>
              );
            })}
          </ol>

          {selected && status && (
            <section className="mb-detail" aria-label="Selected track">
              <div className="mb-detail-top">
                {selected.coverArt ? <img className="mb-cover" src={selected.coverArt} alt="" onError={hideBroken} /> : <span className="mb-cover" />}
                <div className="mb-detail-name">
                  <div className="cs-eyebrow">
                    {status.isBonus ? 'Bonus' : `Track ${selectedIdx + 1}/${progress.regular.length}`}
                    {group?.act?.act && <> · Act {group.act.act} · {group.act.word}</>}
                    {' · '}day {selected.day}
                  </div>
                  <h2 className="cs-display">{selected.title}</h2>
                  {tr && (
                    <p className="cs-hook mb-hook">
                      {tr.hasLyrics ? <>“<Highlighted line={tr.hook} words={[...tr.words, ...(story?.words ?? [])]} />”</> : tr.hook}
                    </p>
                  )}
                </div>
              </div>
              <div className="cs-detail-grid">
                <div><small>Level · {levelToTier(status.level).toLowerCase()}</small><b>{status.level}</b></div>
                <div><small>Best</small><b>{status.score ? status.score.toLocaleString() : '—'}</b></div>
                <div><small>Medal</small><b style={{ color: MEDAL_COLOR[status.medal] ?? undefined }}>{status.medal && status.medal !== 'NONE' ? status.medal.toLowerCase() : '—'}</b></div>
              </div>
              <div className="mb-note">
                {status.lockReason
                  ? <span className="cs-lock-note">{status.lockReason}</span>
                  : status.bombshell
                    ? <span className="cs-muted">{status.bombshellUnlocked ? 'Bombshell art unlocked. It plays behind this track.' : 'Get a platinum medal to unlock this track’s Bombshell art.'}</span>
                    : null}
              </div>
              <div className="mb-actions">
                {status.bonusLocked && canUnlockWithAd() && (
                  <button type="button" className="btn-3d" data-size="sm" data-tone="quiet" disabled={unlocking} onClick={unlockByAd}>
                    <Film size={14} /> Watch ad
                  </button>
                )}
                {status.bonusLocked && bonusGated && canBuyBundle() && (
                  <button type="button" className="btn-3d" data-size="sm" data-tone="gold" disabled={unlocking} onClick={buyBundle}>
                    All 5 bonus{bundlePrice ? ` · ${bundlePrice}` : ''}
                  </button>
                )}
                {!status.bonusLocked && (
                  <button type="button" className="btn-3d" data-size="sm" data-tone="quiet" onClick={togglePreview} aria-label={previewing ? 'Stop preview' : 'Preview'}>
                    {previewing ? <Pause size={14} /> : <Play size={14} />} {previewing ? 'Stop' : 'Preview'}
                  </button>
                )}
                <button type="button" className="btn-3d mb-play" disabled={status.locked} onClick={handlePlay} aria-label={status.locked ? `Locked: ${status.lockReason}` : `Play ${selected.title}`}>
                  {status.locked ? <Lock size={16} /> : <Play size={16} fill="currentColor" />}
                  {status.locked ? 'Locked' : status.cleared ? 'Replay' : 'Play'}
                </button>
              </div>
            </section>
          )}
        </div>

        {lbOpen && (
          <div className="mb-lb" role="dialog" aria-modal="true" aria-label={`${meta.name} leaderboard`} onClick={() => setLbOpen(false)}>
            <div className="mb-lb-card" onClick={(e) => e.stopPropagation()}>
              <div className="mb-lb-head">
                <div>
                  <div className="cs-eyebrow">Total of your best scores</div>
                  <h2 className="cs-display">{meta.name} leaderboard</h2>
                </div>
                <button type="button" className="btn-3d" data-size="sm" data-tone="quiet" onClick={() => setLbOpen(false)} aria-label="Close leaderboard"><X size={16} /></button>
              </div>
              {lbRows === null ? <div className="cs-muted">Loading…</div>
                : lbRows.length === 0 ? <div className="cs-muted">No scores yet. Clear a track to post yours.</div>
                : (
                  <ol className="mb-lb-rows">
                    {lbRows.slice(0, 10).map((r) => (
                      <li key={r.id ?? r.rank}>
                        <span className="mb-lb-rank">{r.rank}</span>
                        {r.photo ? <img src={r.photo} alt="" onError={hideBroken} /> : <span className="mb-lb-ph" />}
                        <span className="mb-lb-name">{r.name || 'Player'}</span>
                        <b>{Number(r.score).toLocaleString()}</b>
                      </li>
                    ))}
                  </ol>
                )}
              <div className="cs-muted" style={{ fontSize: 12 }}>Your total: {monthTotal(songs).toLocaleString()}</div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="cs-page" style={chStyle}>
      {!MONTH_BUILD && <nav className="cs-topbar" aria-label="Chapter navigation">
        <Link href="/campaign" className="cs-chip-btn" onClick={() => sfx()}>
          <ArrowLeft size={16} /> Campaign
        </Link>
        <div className="cs-topbar-nav">
          <Link href={prev ? `/chapter/${prev.month}` : '/campaign'} className="cs-chip-btn" aria-disabled={!prev} aria-label="Previous chapter" onClick={() => sfx()}>
            <ChevronLeft size={18} />
          </Link>
          <span className="cs-eyebrow">{pad(meta.month)} / 12</span>
          <Link href={next ? `/chapter/${next.month}` : '/campaign'} className="cs-chip-btn" aria-disabled={!next} aria-label="Next chapter" onClick={() => sfx()}>
            <ChevronRight size={18} />
          </Link>
        </div>
      </nav>}

      <header className="cs-hero">
        <div className="cs-hero-art" aria-hidden="true">
          {songs.filter((s) => s.coverArt).slice(0, 6).map((s) => <img key={s.id} src={s.coverArt!} alt="" loading="lazy" onError={hideBroken} />)}
        </div>
        <div className="cs-eyebrow" style={{ color: meta.dc }}>Chapter {pad(meta.month)} · {meta.sub}</div>
        <h1 className="cs-display">{meta.name}</h1>
        {story && (
          <div>
            {story.prologue.lyric
              ? <p className="cs-quote">“<Highlighted line={story.prologue.line} words={story.words} />”</p>
              : <p className="cs-quote" data-plain="true">{story.prologue.line}</p>}
            {prologueSong && story.prologue.lyric && <div className="cs-cite">— {prologueSong.title}, day {prologueSong.day}</div>}
          </div>
        )}
        {story && <WordChips words={story.words} />}
        <div className="cs-stats">
          <span><b>{progress.cleared}/{progress.regular.length}</b> cleared</span>
          <span><b>✦ {progress.platinums}/{meta.platNeeded}</b> platinum for bonus</span>
          <span><b>{meta.diff.toLowerCase()}</b> difficulty</span>
        </div>
        <div className="cs-bar" aria-label={`${pct}% cleared`}><span style={{ width: `${pct}%` }} /></div>
        {!MONTH_BUILD && <div className="cs-milestones">
          {MILESTONES.map(({ n, label, need }) => {
            const goal = need(progress.regular.length);
            const state = claimed[n] ? 'claimed' : progress.cleared >= goal ? 'ready' : 'pending';
            return (
              <button
                key={n}
                type="button"
                className="cs-ms"
                data-state={state}
                disabled={state !== 'ready'}
                onClick={() => claimReward(n)}
              >
                <b>{state === 'claimed' ? <CheckCircle2 size={16} /> : <Gift size={16} />}</b>
                <span>{label}</span>
                <span>{state === 'claimed' ? 'Claimed' : state === 'ready' ? 'Claim reward' : `${Math.min(progress.cleared, goal)}/${goal}`}</span>
              </button>
            );
          })}
        </div>}
      </header>

      <MoodArc songs={songs} groups={groups} selectedIdx={selectedIdx} stateOf={stateOf} onSelect={(i) => select(i, true)} />

      {groups.map((g) => {
        const holdsSelected = selectedIdx >= g.startIdx && selectedIdx < g.startIdx + g.songs.length;
        const open = actOpen[g.key] ?? holdsSelected;
        const done = g.songs.filter(hasClearedSong).length;
        return (
        <section key={g.key} className="cs-act" data-open={open} aria-labelledby={`act-${g.key}`}>
          <div className="cs-act-head">
            <div className="cs-eyebrow">
              {g.label}
              {g.act && <> · {MOOD_LABEL[g.act.mood] ?? g.act.mood}</>}
              {g.bonus && <> · Bonus stages</>}
            </div>
            <h2 id={`act-${g.key}`} className="cs-display">{g.act ? g.act.word : g.bonus ? 'Afterword' : 'The tracks'}</h2>
            {g.act && g.act.themes.length > 0 && <div className="cs-muted" style={{ fontSize: 14 }}>{g.act.themes.join(' · ')}</div>}
            {g.act && <ActStory act={g.act} songs={songs} story={story} onPick={(i) => select(i, true)} />}
            <button
              type="button"
              className="cs-act-toggle"
              aria-expanded={open}
              aria-controls={`act-body-${g.key}`}
              onClick={() => { sfx(0.1); setActOpen((o) => ({ ...o, [g.key]: !open })); }}
            >
              <span>{done}/{g.songs.length} cleared</span>
              <span>{open ? 'Hide tracks' : `Show ${g.songs.length} tracks`} <ChevronDown size={14} /></span>
            </button>
          </div>
          {open && (
          <div className="cs-act-body" id={`act-body-${g.key}`}>
          {g.bonus && !progress.bonusUnlocked && (
            <div className="cs-act-gate"><Lock size={16} /> Earn {meta.platNeeded} platinum medals in this chapter to open the epilogue ({progress.platinums} so far).</div>
          )}
          {MONTH_BUILD && g.bonus && !progress.bonusUnlocked && canBuyBundle() && g.songs.some((b) => !isBonusSongBought(b.id)) && (
            <button type="button" className="btn-3d" data-size="sm" data-tone="gold" disabled={unlocking} onClick={buyBundle} style={{ margin: '0 0 12px' }}>
              Unlock all {g.songs.length} bonus songs{bundlePrice ? ` · ${bundlePrice}` : ''}
            </button>
          )}
          <ol className="cs-beats">
            {g.songs.map((s, j) => {
              const idx = g.startIdx + j;
              const tr = getTrackStory(s.day);
              const state = stateOf(s, idx);
              const isSel = idx === selectedIdx;
              const medal = getMedalForSong(s.id);
              return (
                <li key={s.id} id={`beat-${idx}`} className="cs-beat" data-state={state} data-selected={isSel}>
                  <button type="button" className="cs-beat-main" aria-expanded={isSel} onClick={() => select(idx)}>
                    <span className="cs-beat-cover">
                      {s.coverArt && <img src={s.coverArt} alt="" loading="lazy" onError={hideBroken} />}
                      <span className="cs-beat-day">{s.day}</span>
                    </span>
                    <span className="cs-beat-body">
                      <span className="cs-beat-title">{s.title}</span>
                      {tr && (
                        <span className="cs-hook">
                          {tr.hasLyrics ? <>“<Highlighted line={tr.hook} words={[...tr.words, ...(story?.words ?? [])]} />”</> : tr.hook}
                        </span>
                      )}
                    </span>
                    <span className="cs-beat-status">
                      {state === 'locked' ? <Lock size={14} /> : state === 'cleared'
                        ? <span className="cs-medal" style={{ color: MEDAL_COLOR[medal] ?? '#39ff14' }}>{medal && medal !== 'NONE' ? medal : <CheckCircle2 size={14} />}</span>
                        : <span className="cs-medal" style={{ color: meta.dc }}>NEXT</span>}
                    </span>
                  </button>
                  {isSel && status && (
                    <div className="cs-beat-detail">
                      {tr && tr.words.length > 0 && <WordChips words={tr.words} small />}
                      <div className="cs-detail-grid">
                        <div><small>Level · {levelToTier(status.level).toLowerCase()}</small><b>{status.level}</b></div>
                        <div><small>Best</small><b>{status.score ? status.score.toLocaleString() : '—'}</b></div>
                        <div><small>Medal</small><b style={{ color: MEDAL_COLOR[status.medal] ?? undefined }}>{status.medal && status.medal !== 'NONE' ? status.medal.toLowerCase() : '—'}{status.prophecy ? ' 👑' : ''}</b></div>
                      </div>
                      {s.description && tr?.hasLyrics && <p className="cs-hook">{s.description}</p>}
                      {status.lockReason && <div className="cs-lock-note">{status.lockReason}</div>}
                      {MONTH_BUILD && status.bonusLocked && (canUnlockWithAd() || canBuyBundle()) && (
                        <div className="cs-detail-actions">
                          {canUnlockWithAd() && (
                            <button type="button" className="btn-3d" data-size="sm" disabled={unlocking} onClick={unlockByAd}>
                              <Film size={14} /> Watch an ad to unlock
                            </button>
                          )}
                          {canBuyBundle() && (
                            <button type="button" className="btn-3d" data-size="sm" data-tone="gold" disabled={unlocking} onClick={buyBundle}>
                              Unlock all bonus songs{bundlePrice ? ` · ${bundlePrice}` : ''}
                            </button>
                          )}
                        </div>
                      )}
                      {status.bombshell && !status.locked && (
                        <div className="cs-muted" style={{ fontSize: 13 }}>
                          {status.bombshellUnlocked
                            ? 'Bombshell art unlocked. It plays behind this track.'
                            : 'Get a platinum medal on this track to unlock its Bombshell art.'}
                        </div>
                      )}
                      {!status.locked && status.ownsCard && status.modifier !== 'none' && (
                        <div className="cs-mod">
                          <span>Card modifier · {status.modifier.replace('_', ' ')}</span>
                          <button
                            type="button"
                            className="btn-3d"
                            data-size="sm"
                            data-tone={equippedCardId === s.id ? 'gold' : 'quiet'}
                            onClick={() => { sfx(0.08); setEquippedCardId(equippedCardId === s.id ? null : s.id); }}
                          >
                            {equippedCardId === s.id ? 'Equipped' : 'Equip'}
                          </button>
                        </div>
                      )}
                      <div className="cs-detail-actions">
                        <button type="button" className="btn-3d" data-size="sm" data-tone="quiet" onClick={togglePreview}>
                          {previewing ? <Pause size={14} /> : <Play size={14} />} {previewing ? 'Stop preview' : 'Preview'}
                        </button>
                        {state !== 'locked' && !MONTH_BUILD && (
                          <Link href={`/song/${s.id}?from=chapter/${monthNum}`} className="btn-3d" data-size="sm" data-tone="quiet">Codex</Link>
                        )}
                        {import.meta.env.DEV && (
                          <button
                            type="button"
                            className="btn-3d"
                            data-size="sm"
                            data-tone="quiet"
                            disabled={status.locked}
                            title="Export a frame-perfect run video (dev only)"
                            onClick={() => { sessionStorage.setItem(`export_video_${s.id}`, 'true'); handlePlay(); }}
                          >
                            <Film size={14} /> Export
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
          </div>
          )}
        </section>
        );
      })}

      {songs.length === 0 && <div className="cs-empty">No tracks in this chapter yet.</div>}

      {selected && status && (
        <div className="cs-playbar" role="region" aria-label="Selected track">
          {selected.coverArt ? <img src={selected.coverArt} alt="" onError={hideBroken} /> : <span className="cs-pb-ph" />}
          <button type="button" className="cs-pb-text" style={{ background: 'none', border: 0, padding: 0, textAlign: 'left', color: 'inherit', cursor: 'pointer' }}
            onClick={() => document.getElementById(`beat-${selectedIdx}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })}>
            <small>{status.isBonus ? 'Bonus' : `Track ${selectedIdx + 1} of ${progress.regular.length}`} · Lv {status.level}</small>
            <b>{selected.title}</b>
          </button>
          <button type="button" className="btn-3d" disabled={status.locked} onClick={handlePlay} aria-label={status.locked ? `Locked: ${status.lockReason}` : `Play ${selected.title}`}>
            {status.locked ? <Lock size={16} /> : <Play size={16} fill="currentColor" />}
            {status.locked ? 'Locked' : status.cleared ? 'Replay' : 'Play'}
          </button>
        </div>
      )}
    </div>
  );
}

/** An act's story in up to three beats: the line it opens on, where the mood turns, and where it lands. */
function ActStory({ act, songs, story, onPick }: {
  act: ActStoryData;
  songs: GameSong[];
  story?: MonthStory;
  onPick: (i: number) => void;
}) {
  const beats = [
    { key: 'open', label: 'Opens', beat: act.open },
    act.turn && { key: 'turn', label: act.turn.dir === 'lifts' ? 'Lifts' : 'Drops', beat: act.turn },
    act.close && { key: 'close', label: 'Lands', beat: act.close },
  ].filter(Boolean) as { key: string; label: string; beat: { day: number; line: string | null } }[];
  const words = [act.word, ...(story?.words ?? [])];
  return (
    <ol className="cs-synopsis" aria-label="Story of this act">
      {beats.map(({ key, label, beat }) => {
        const idx = songs.findIndex((s) => s.day === beat.day);
        if (idx === -1) return null;
        const song = songs[idx];
        return (
          <li key={key} data-beat={key}>
            <button type="button" onClick={() => onPick(idx)}>
              <small>{label} · day {song.day}</small>
              {beat.line ? <span>“<Highlighted line={beat.line} words={words} />”</span> : <span className="cs-muted">{song.title}</span>}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/** The month's mood (track valence) as a line, with a tappable dot per track. */
function MoodArc({ songs, groups, selectedIdx, stateOf, onSelect }: {
  songs: GameSong[];
  groups: ActGroup[];
  selectedIdx: number;
  stateOf: (s: GameSong, i: number) => string;
  onSelect: (i: number) => void;
}) {
  if (songs.length < 2) return null;
  const H = 132;
  // Scale to this month's own range so its swings read clearly.
  const vals = songs.map((s) => s.valence ?? 0.5);
  const lo = Math.min(...vals);
  const span = Math.max(0.15, Math.max(...vals) - lo);
  const x = (i: number) => (i / (songs.length - 1)) * 100;
  const y = (s: GameSong) => 14 + (1 - ((s.valence ?? 0.5) - lo) / span) * (H - 28);
  const pts = songs.map((s, i) => `${x(i).toFixed(2)},${y(s).toFixed(1)}`).join(' ');
  const seps = groups.slice(1).map((g) => x(g.startIdx - 0.5));
  return (
    <section className="cs-arc" aria-label="Mood across the chapter">
      <div className="cs-arc-head">
        <div className="cs-eyebrow">Mood arc</div>
        <div className="cs-eyebrow">brighter ↑ · heavier ↓</div>
      </div>
      <div style={{ position: 'relative' }}>
        <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" aria-hidden="true">
          <polygon className="arc-fill" points={`0,${H} ${pts} 100,${H}`} />
          {seps.map((sx, i) => <line key={i} className="arc-sep" x1={sx} x2={sx} y1={0} y2={H} />)}
          <polyline className="arc-line" points={pts} />
        </svg>
        <div className="cs-arc-dots" style={{ position: 'absolute', inset: 0, height: '100%' }}>
          {songs.map((s, i) => (
            <button
              key={s.id}
              type="button"
              className="cs-arc-dot"
              data-state={stateOf(s, i)}
              data-selected={i === selectedIdx}
              style={{ left: `${x(i)}%`, top: `${(y(s) / H) * 100}%` }}
              aria-label={`${s.title}, day ${s.day}`}
              onClick={() => onSelect(i)}
            />
          ))}
        </div>
      </div>
      <div className="cs-arc-acts" style={{ gridTemplateColumns: groups.map((g) => `${g.songs.length}fr`).join(' ') }}>
        {groups.map((g) => <span key={g.key} title={g.label}>{g.act?.act ? `${g.act.act} · ${g.act.word}` : g.bonus ? `Bonus${g.act ? ` · ${g.act.word}` : ''}` : g.label}</span>)}
      </div>
    </section>
  );
}
