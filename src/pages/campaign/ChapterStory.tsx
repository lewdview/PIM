// Chapter: one month told as a story through its tracks. A hand-written
// prologue opens it, the mood arc shows how the month moves, and the tracks
// play out as three acts (plus bonus stages as an epilogue). Each act opens
// with its synopsis and three tracks (where it starts, where the mood turns,
// where it lands); only the act you're in is expanded to its full track list.
// Each track shows what it explores. The sticky play bar always sits
// above the phone dock, so the next track is one tap away on any screen.
// Dressed in the results screens' arcade style (campaignArcade.css): the
// chapter name slams in, the mood arc scans across, and each act sweeps in as
// it scrolls into view.

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, Lock, Pause, Play, Film, CheckCircle2, Gift } from 'lucide-react';
import { loadCatalog, isSongTimeLocked, getModifierForSong, type GameSong } from '@/game/api';
import { getCampaignRecord } from '@/game/progress';
import { CHAPTERS, calculateCampaignDifficulty, levelToTier, campaignPlayPath, prepareCampaignRun } from '@/game/campaign';
import { resolvePreferredCover } from '@/utils/gameCover';
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
import { hideBroken } from './hideBroken';
import { ArcadeBackdrop, RevealSection, SlamTitle, StageWipe } from './arcade';
import '@/styles/stageShell.css';
import '@/styles/campaignStory.css';
import '@/styles/campaignArcade.css';

const MEDAL_COLOR: Record<string, string> = {
  PLATINUM: '#39FF14', GOLD: '#E5B800', SILVER: '#A0AABB', BRONZE: '#C97A3A',
};
const MILESTONES = [
  { n: 1 as const, label: '5 clears', need: (_total: number) => 5 },
  { n: 2 as const, label: '15 clears', need: (_total: number) => 15 },
  { n: 3 as const, label: 'All clears', need: (total: number) => total },
];

const pad = (n: number) => String(n).padStart(2, '0');
const sfx = (v = 0.12) => audioManager.playSfx('tap_nav', v);

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
  const monthNum = Math.min(12, Math.max(1, parseInt(month ?? '1', 10) || 1));
  const meta = CHAPTERS.find((c) => c.month === monthNum) ?? CHAPTERS[0];
  const prev = CHAPTERS.find((c) => c.month === monthNum - 1);
  const next = CHAPTERS.find((c) => c.month === monthNum + 1);
  const story = getMonthStory(monthNum);

  const [songs, setSongs] = useState<GameSong[] | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [claimed, setClaimed] = useState<Record<number, boolean>>({});
  // Acts the player opened or closed by hand; otherwise only the act holding the selected track is open.
  const [actOpen, setActOpen] = useState<Record<string, boolean>>({});

  const collection = useVaultStore((s) => s.collection);
  const loadVaultData = useVaultStore((s) => s.loadVaultData);
  const equippedCardId = useVaultStore((s) => s.equippedCardId);
  const setEquippedCardId = useVaultStore((s) => s.setEquippedCardId);
  const milestoneClaims = useVaultStore((s) => s.milestoneClaims);
  const claimedRewards = useVaultStore((s) => s.claimedRewards);
  // Campaign progress is seeded from older saves once vault data loads.
  const vaultLoaded = useVaultStore((s) => s.hasLoadedData);

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
    loadVaultData().catch((err) => console.warn('Failed to load vault data', err));
  }, [loadVaultData]);

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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const progress = useMemo(() => (songs ? chapterProgress(songs, meta) : null), [songs, meta, vaultLoaded]);

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
    const timeLocked = isSongTimeLocked(selected);
    const bonusLocked = isBonus && !progress.bonusUnlocked;
    const progLocked = !isStageUnlocked(selectedIdx, progress);
    const cardLocked = cleared && !ownsCard;
    const level = calculateCampaignDifficulty(
      monthNum,
      isBonus ? selectedIdx - progress.regular.length : selectedIdx,
      isBonus ? progress.bonus.length : progress.regular.length,
      isBonus,
    );
    let lockReason = '';
    if (timeLocked) lockReason = `Releases ${formatDate(selected.day)}.`;
    else if (bonusLocked) lockReason = `Bonus stages open at ${meta.platNeeded} platinum medals in this chapter (you have ${progress.platinums}).`;
    else if (progLocked) lockReason = 'Clear the previous track to continue the story.';
    else if (cardLocked) lockReason = 'Replaying a cleared track needs its card. Find it in packs or the vault.';
    return {
      isBonus, cleared, ownsCard, level, lockReason,
      locked: timeLocked || bonusLocked || progLocked || cardLocked,
      modifier: getModifierForSong(selected),
      medal: getCampaignRecord(selected.id)?.medal ?? '',
      score: getCampaignRecord(selected.id)?.score ?? 0,
      prophecy: claimedRewards[selected.id]?.includes('prophecy') || localStorage.getItem(`reward_tier_${selected.id}`) === 'prophecy',
    };
  }, [songs, progress, selected, selectedIdx, collection, monthNum, meta, claimedRewards]);

  const handlePlay = useCallback(() => {
    if (!selected || !status || status.locked) return;
    stopPreview();
    audioManager.playSfx('tap_nav', 0.4);
    prepareCampaignRun(selected.id, monthNum, status.modifier, equippedCardId === selected.id);
    setLocation(campaignPlayPath(selected.id));
  }, [selected, status, stopPreview, monthNum, equippedCardId, setLocation]);

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
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); move(-1); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); move(1); }
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
    return <div className="cs-page ca-root" style={chStyle}><div className="cs-empty ca-loading">Loading chapter…</div></div>;
  }

  const prologueSong = story ? songs.find((s) => s.day === story.prologue.day) : undefined;
  const pct = progress.regular.length ? Math.round((progress.cleared / progress.regular.length) * 100) : 0;
  const stateOf = (s: GameSong, i: number) =>
    hasClearedSong(s) ? 'cleared' : isStageUnlocked(i, progress) && !isSongTimeLocked(s) ? 'open' : 'locked';

  return (
    <div className="cs-page ca-root" style={chStyle}>
      <StageWipe />
      <nav className="cs-topbar" aria-label="Chapter navigation">
        <Link href="/campaign" className="cs-chip-btn" onClick={() => sfx()}>
          <ArrowLeft size={16} /> Campaign
        </Link>
        <div className="cs-topbar-nav">
          <Link href={prev ? `/chapter/${prev.month}` : '/campaign'} className="cs-chip-btn" aria-disabled={!prev} aria-label="Previous chapter" onClick={() => sfx()}>
            <ChevronLeft size={18} />
          </Link>
          <span className="ca-chip">{pad(meta.month)} / 12</span>
          <Link href={next ? `/chapter/${next.month}` : '/campaign'} className="cs-chip-btn" aria-disabled={!next} aria-label="Next chapter" onClick={() => sfx()}>
            <ChevronRight size={18} />
          </Link>
        </div>
      </nav>

      <header className="cs-hero ca-hero">
        <div className="cs-hero-art" aria-hidden="true">
          {songs.filter((s) => s.coverArt).slice(0, 6).map((s) => <img key={s.id} src={s.coverArt!} alt="" loading="lazy" onError={hideBroken} />)}
        </div>
        <ArcadeBackdrop />
        <div className="ca-hud">
          <span className="ca-chip" data-tone="hot">Chapter {pad(meta.month)}</span>
          <span className="ca-chip">{meta.sub}</span>
        </div>
        <SlamTitle text={meta.name} className="ca-title--ch" delay={250} />
        {story && (
          <div>
            {story.prologue.lyric
              ? <p className="cs-quote">“<Highlighted line={story.prologue.line} words={story.words} />”</p>
              : <p className="cs-quote" data-plain="true">{story.prologue.line}</p>}
            {prologueSong && story.prologue.lyric && <div className="cs-cite">— {prologueSong.title}, day {prologueSong.day}</div>}
          </div>
        )}
        {story && <WordChips words={story.words} />}
        <div className="cs-stats ca-stats">
          <span><b>{progress.cleared}/{progress.regular.length}</b> cleared</span>
          <span><b>✦ {progress.platinums}/{meta.platNeeded}</b> platinum for bonus</span>
          <span><b>{meta.diff.toLowerCase()}</b> difficulty</span>
        </div>
        <div className="cs-bar ca-bar" aria-label={`${pct}% cleared`}><span style={{ width: `${pct}%` }} /></div>
        <div className="cs-milestones">
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
        </div>
      </header>

      <MoodArc songs={songs} groups={groups} selectedIdx={selectedIdx} stateOf={stateOf} onSelect={(i) => select(i, true)} />

      {groups.map((g) => {
        const holdsSelected = selectedIdx >= g.startIdx && selectedIdx < g.startIdx + g.songs.length;
        const open = actOpen[g.key] ?? holdsSelected;
        const done = g.songs.filter(hasClearedSong).length;
        return (
        <RevealSection key={g.key} className="cs-act" data-open={open} aria-labelledby={`act-${g.key}`}>
          <div className="cs-act-head">
            <div className="cs-eyebrow">
              <span className="ca-act-tag">{g.label}</span>
              {g.act && <>{MOOD_LABEL[g.act.mood] ?? g.act.mood}</>}
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
          <ol className="cs-beats">
            {g.songs.map((s, j) => {
              const idx = g.startIdx + j;
              const tr = getTrackStory(s.day);
              const state = stateOf(s, idx);
              const isSel = idx === selectedIdx;
              const medal = getCampaignRecord(s.id)?.medal ?? '';
              return (
                <li key={s.id} id={`beat-${idx}`} className="cs-beat" data-state={state} data-selected={isSel}>
                  <button type="button" className="cs-beat-main" aria-expanded={isSel} onClick={() => select(idx)}>
                    {isSel && <span className="ca-cursor ca-beat-cursor" aria-hidden="true">▶</span>}
                    <span className="cs-beat-cover">
                      {s.coverArt && <img src={s.coverArt} alt="" loading="lazy" onError={hideBroken} />}
                      <span className="cs-beat-day">{s.day}</span>
                    </span>
                    <span className="cs-beat-body">
                      <span className="cs-beat-title">{s.title}</span>
                      {tr && (
                        <span className="cs-hook">
                          {tr.hasLyrics ? <>“<Highlighted line={tr.hook} words={[...tr.words, ...(story?.words ?? [])]} />”</> : (s.description || tr.hook)}
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
                        {state !== 'locked' && (
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
        </RevealSection>
        );
      })}

      {songs.length === 0 && <div className="cs-empty">No tracks in this chapter yet.</div>}

      {selected && status && (
        <div className="cs-playbar ca-playbar" role="region" aria-label="Selected track">
          {resolvePreferredCover(selected) ? <img src={resolvePreferredCover(selected)!} alt="" onError={hideBroken} /> : <span className="cs-pb-ph" />}
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
    <>
    {act.synopsis && <p className="cs-act-synopsis">{act.synopsis}</p>}
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
    </>
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
    <RevealSection className="cs-arc" aria-label="Mood across the chapter">
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
              style={{ left: `${x(i)}%`, top: `${(y(s) / H) * 100}%`, ['--x' as string]: x(i) / 100 } as CSSProperties}
              aria-label={`${s.title}, day ${s.day}`}
              onClick={() => onSelect(i)}
            />
          ))}
        </div>
      </div>
      <div className="cs-arc-acts" style={{ gridTemplateColumns: groups.map((g) => `${g.songs.length}fr`).join(' ') }}>
        {groups.map((g) => <span key={g.key} title={g.label}>{g.act?.act ? `${g.act.act} · ${g.act.word}` : g.bonus ? `Bonus${g.act ? ` · ${g.act.word}` : ''}` : g.label}</span>)}
      </div>
    </RevealSection>
  );
}
