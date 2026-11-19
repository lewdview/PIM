// A track's own page in a monthly Playgama build: its cover big (or its
// Bombshell art once a platinum unlocks it), where it sits in the month's
// story, the lyric hook, and the player's records for the track and its Deluxe
// chart. Left/right steps through the chapter; like the chapter, it never scrolls.

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Lock, Pause, Play, Sparkles, X } from 'lucide-react';
import type { GameSong } from '@/game/api';
import { getHighScore, getMedalForSong } from '@/game/progress';
import { levelToTier } from '@/game/campaign';
import { MOOD_LABEL, type ChapterAct, type TrackStory } from '@/game/chapterStory';
import { formatDate } from '@/utils/dayCalc';
import { Highlighted } from '@/pages/campaign/storyParts';
import { hideBroken } from '@/pages/campaign/hideBroken';
import { deluxeRunId } from './startRun';
import '@/styles/monthPanels.css';
import { t } from '@/i18n';

const MEDAL_COLOR: Record<string, string> = {
  PLATINUM: '#39FF14', GOLD: '#E5B800', SILVER: '#A0AABB', BRONZE: '#C97A3A',
};

export interface SongPageStatus {
  locked: boolean;
  lockReason: string | null;
  level: number;
  cleared: boolean;
  medal: string;
  score: number;
  isBonus: boolean;
  bombshell: string | null;
  bombshellUnlocked: boolean;
}

interface Props {
  song: GameSong;
  idx: number;
  regularCount: number;
  /** The act (or epilogue) the track belongs to. */
  act?: Partial<ChapterAct> & { word: string; mood: string };
  track?: TrackStory;
  /** Words lit in the hook: the track's and the month's. */
  words: string[];
  status: SongPageStatus;
  previewing: boolean;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onPreview: () => void;
  onPlay: (deluxe?: boolean) => void;
  onClose: () => void;
}

const medalText = (m: string) => (m && m !== 'NONE' ? t(m.toLowerCase()) : '—');

/** Where the track sits in its act's story, if it is one of the act's three beats. */
function storyBeat(day: number, act: Props['act']): string | null {
  if (!act) return null;
  const name = act.act ? t('Act {n}', { n: act.act }) : t('the epilogue');
  if (act.open?.day === day) return t('Opens {name}.', { name });
  if (act.turn?.day === day) return t(act.turn.dir === 'lifts' ? 'The turn of {name}: the mood lifts here.' : 'The turn of {name}: the mood drops here.', { name });
  if (act.close?.day === day) return t('Closes {name}.', { name });
  return null;
}

export default function MonthSong(p: Props) {
  const { song, status, act } = p;
  const [showBombshell, setShowBombshell] = useState(false);
  useEffect(() => setShowBombshell(false), [song.id]);

  // Left/right browse the chapter; Enter plays. Escape is handled by the chapter.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && p.hasPrev) { e.preventDefault(); p.onPrev(); }
      else if (e.key === 'ArrowRight' && p.hasNext) { e.preventDefault(); p.onNext(); }
      else if (e.key === 'Enter' && !status.locked && !(e.target instanceof HTMLButtonElement)) p.onPlay();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [p, status.locked]);

  const deluxeId = deluxeRunId(song.id);
  const deluxeBest = getHighScore(deluxeId);
  const deluxeMedal = getMedalForSong(deluxeId);
  const beat = storyBeat(song.day, act);
  const art = showBombshell && status.bombshell ? status.bombshell : song.coverArt;

  return (
    <div className="mb-lb" role="dialog" aria-modal="true" aria-label={song.title} onClick={p.onClose}>
      <div className="mb-lb-card ms-card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="ms-nav" data-side="prev" aria-label={t('Previous track')} disabled={!p.hasPrev} onClick={p.onPrev}>
          <ChevronLeft size={22} />
        </button>
        <button type="button" className="ms-nav" data-side="next" aria-label={t('Next track')} disabled={!p.hasNext} onClick={p.onNext}>
          <ChevronRight size={22} />
        </button>
        <button type="button" className="btn-3d ms-close" data-size="sm" data-tone="quiet" onClick={p.onClose} aria-label={t('Close')}>
          <X size={16} />
        </button>

        <div key={song.id} className="ms-body">
          <figure className="ms-art" data-bombshell={showBombshell || undefined}>
            {art ? <img key={art} src={art} alt="" onError={hideBroken} /> : <span className="ms-art-empty" />}
            {status.locked && <span className="ms-art-lock"><Lock size={28} /></span>}
            {status.bombshell && (
              status.bombshellUnlocked ? (
                <button type="button" className="ms-art-toggle" onClick={() => setShowBombshell((v) => !v)}>
                  {t(showBombshell ? 'Show cover' : 'Show Prestige Art')}
                </button>
              ) : (
                <figcaption className="ms-art-hint">{t("Platinum unlocks this track's Prestige Art")}</figcaption>
              )
            )}
          </figure>

          <div className="ms-info">
            <div className="cs-eyebrow">
              {status.isBonus ? t('Bonus') : t('Track {n}/{total}', { n: p.idx + 1, total: p.regularCount })} · {t('day {n}', { n: song.day })} · {formatDate(song.day)}
            </div>
            <h2 className="cs-display ms-title">{song.title}</h2>
            {act && (
              <p className="ms-act">
                <b>{act.act ? t('Act {n}', { n: act.act }) : t('Epilogue')} · {act.word}</b>
                {MOOD_LABEL[act.mood] && <> · {t(MOOD_LABEL[act.mood])}</>}
                {beat && <> · {beat}</>}
              </p>
            )}
            {p.track && (
              <blockquote className="ms-hook">
                {p.track.hasLyrics ? <>“<Highlighted line={p.track.hook} words={p.words} />”</> : p.track.hook}
              </blockquote>
            )}
            {!!p.track?.themes.length && (
              <ul className="ms-themes" aria-label={t('Themes')}>
                {p.track.themes.map((th) => <li key={th}>{th}</li>)}
              </ul>
            )}

            <dl className="ms-records">
              <div><dt>{t('Level')} · {t(levelToTier(status.level).toLowerCase())}</dt><dd>{status.level}</dd></div>
              <div><dt>{t('Best')}</dt><dd>{status.score ? status.score.toLocaleString() : '—'}</dd></div>
              <div><dt>{t('Medal')}</dt><dd style={{ color: MEDAL_COLOR[status.medal] }}>{medalText(status.medal)}</dd></div>
              <div data-deluxe><dt>{t('Deluxe best')}</dt><dd>{deluxeBest ? deluxeBest.toLocaleString() : '—'}</dd></div>
              <div data-deluxe><dt>{t('Deluxe medal')}</dt><dd style={{ color: MEDAL_COLOR[deluxeMedal] }}>{medalText(deluxeMedal)}</dd></div>
            </dl>

            {status.lockReason && <p className="cs-lock-note ms-lock">{status.lockReason}</p>}

            <div className="mb-actions ms-actions">
              {!status.locked && (
                <button type="button" className="btn-3d" data-size="sm" data-tone="quiet" onClick={p.onPreview}>
                  {p.previewing ? <Pause size={14} /> : <Play size={14} />} {t(p.previewing ? 'Stop' : 'Preview')}
                </button>
              )}
              {status.cleared && !status.locked && (
                <button type="button" className="btn-3d" data-size="sm" data-tone="gold" onClick={() => p.onPlay(true)}
                  title={t('Chart Master Deluxe: denser, harder chart with every note type')}>
                  <Sparkles size={14} /> {t('Deluxe')}
                </button>
              )}
              <button type="button" className="btn-3d mb-play" disabled={status.locked} onClick={() => p.onPlay()}>
                {status.locked ? <Lock size={16} /> : <Play size={16} fill="currentColor" />}
                {t(status.locked ? 'Locked' : status.cleared ? 'Replay' : 'Play')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
