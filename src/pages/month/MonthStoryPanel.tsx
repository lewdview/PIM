// The chapter's Story panel in a monthly Playgama build: what the main game's
// chapter page tells as one long scroll, fitted to one screen. The prologue
// lyric and the month's words on top, the mood arc across every track, then
// one act at a time on tabs with its three lyric beats. Acts stay hidden until
// the player reaches them, and the epilogue until its ending is earned.

import { useEffect, useState } from 'react';
import { Lock, Play, X } from 'lucide-react';
import type { GameSong } from '@/game/api';
import { MOOD_LABEL, type ChapterAct, type MonthStory, type StoryBeat } from '@/game/chapterStory';
import { Highlighted, MoodArc, WordChips, type ArcGroup } from '@/pages/campaign/storyParts';
import '@/styles/monthPanels.css';

type Group = ArcGroup & { act?: Partial<ChapterAct> & { word: string; mood?: string; themes?: string[] } };

const hide = (w: string) => w.replace(/./g, '•');

export default function MonthStoryPanel(p: {
  story: MonthStory;
  songs: GameSong[];
  groups: Group[];
  selectedIdx: number;
  stateOf: (s: GameSong, i: number) => string;
  /** Whether the player has reached a group: its first track is open or cleared. */
  reached: (g: Group) => boolean;
  /** The epilogue's words and lines show once the Epilogue ending is earned. */
  epilogueOpen: boolean;
  onSelect: (idx: number) => void;
  onWatch: (path: string) => void;
  onClose: () => void;
}) {
  const { story, songs, groups } = p;
  const open = (g: Group) => (g.bonus ? p.epilogueOpen : p.reached(g));
  const start = Math.max(0, groups.findIndex((g) => p.selectedIdx >= g.startIdx && p.selectedIdx < g.startIdx + g.songs.length));
  const [tab, setTab] = useState(start);
  const g = groups[tab];

  // Left/right (or Q/E) switch acts; Escape is handled by the chapter.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'q' || e.key === 'Q') { e.preventDefault(); setTab((t) => Math.max(0, t - 1)); }
      else if (e.key === 'ArrowRight' || e.key === 'e' || e.key === 'E') { e.preventDefault(); setTab((t) => Math.min(groups.length - 1, t + 1)); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [groups.length]);

  // The arc's act labels follow the same locks as the tabs.
  const arcGroups = groups.map((x) => (x.act && !open(x) ? { ...x, act: { ...x.act, word: hide(x.act.word) } } : x));
  const titleOf = (day: number) => songs.find((s) => s.day === day)?.title;
  const idxOf = (day: number) => songs.findIndex((s) => s.day === day);
  const prologueSong = songs.find((s) => s.day === story.prologue.day);

  return (
    <div className="mb-lb" role="dialog" aria-modal="true" aria-label="Story" onClick={p.onClose}>
      <div className="mb-lb-card mst-card" onClick={(e) => e.stopPropagation()}>
        <div className="mb-lb-head">
          <div>
            <div className="cs-eyebrow">Three acts and an epilogue</div>
            <h2 className="cs-display">Story</h2>
          </div>
          <div className="mst-head-actions">
            <button type="button" className="btn-3d" data-size="sm" data-tone="quiet" onClick={() => p.onWatch('/story/prologue')}>
              <Play size={14} fill="currentColor" /> Prologue
            </button>
            <button type="button" className="btn-3d" data-size="sm" data-tone="quiet" onClick={p.onClose} aria-label="Close"><X size={16} /></button>
          </div>
        </div>

        <div className="mst-prologue">
          {story.prologue.lyric
            ? <p className="mst-quote">“<Highlighted line={story.prologue.line} words={story.words} />”{prologueSong && <small> {prologueSong.title}, day {prologueSong.day}</small>}</p>
            : <p className="mst-quote" data-plain="true">{story.prologue.line}</p>}
          <WordChips words={story.words} small />
        </div>

        <div className="mst-arc">
          <MoodArc songs={songs} groups={arcGroups} selectedIdx={p.selectedIdx} stateOf={p.stateOf} onSelect={p.onSelect} />
        </div>

        <div className="mo-tabs mst-tabs" role="tablist">
          {groups.map((x, i) => (
            <button key={x.key} type="button" role="tab" aria-selected={i === tab} onClick={() => setTab(i)}>
              {x.bonus ? 'Epilogue' : x.label}
              {!open(x) && <Lock size={11} />}
            </button>
          ))}
        </div>

        {g && (
          <div key={g.key} className="mst-act">
            {open(g) && g.act ? (
              <>
                <div className="mst-act-head">
                  <h3 className="cs-display">{g.act.word}</h3>
                  <p className="cs-muted">
                    {[MOOD_LABEL[g.act.mood ?? ''] ?? g.act.mood, ...(g.act.themes ?? [])].filter(Boolean).join(' · ')}
                  </p>
                  {!g.bonus && g.act.act && (
                    <button type="button" className="btn-3d" data-size="sm" data-tone="quiet" onClick={() => p.onWatch(`/story/act-${g.act!.act}`)}>
                      <Play size={14} fill="currentColor" /> Watch Act {g.act.act}
                    </button>
                  )}
                  {g.bonus && (
                    <button type="button" className="btn-3d" data-size="sm" data-tone="quiet" onClick={() => p.onWatch('/ending/epilogue')}>
                      <Play size={14} fill="currentColor" /> Watch the Epilogue
                    </button>
                  )}
                </div>
                <div className="mst-act-body">
                  {g.act.synopsis && <p className="mst-synopsis">{g.act.synopsis}</p>}
                  <ol className="mst-beats">
                    {beatsOf(g.act).map(({ key, label, beat }) => (
                      <li key={key}>
                        <small>{label}</small>
                        {beat.line
                          ? <span>“<Highlighted line={beat.line} words={[g.act!.word, ...story.words]} />”</span>
                          : <span className="cs-muted">{titleOf(beat.day)}</span>}
                        {idxOf(beat.day) !== -1 && (
                          <button type="button" className="mst-track" onClick={() => p.onSelect(idxOf(beat.day))}>
                            Day {beat.day}{titleOf(beat.day) ? ` · ${titleOf(beat.day)}` : ''}
                          </button>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              </>
            ) : (
              <div className="mst-locked">
                <h3 className="cs-display">{g.act ? hide(g.act.word) : '•••••'}</h3>
                <p className="cs-lock-note">
                  <Lock size={14} />{' '}
                  {g.bonus
                    ? `Clear all ${g.songs.length} bonus tracks to read the epilogue.`
                    : `Reach track ${g.startIdx + 1}${g.songs[0] ? ` (${g.songs[0].title})` : ''} to open ${g.label}.`}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function beatsOf(act: Partial<ChapterAct>): { key: string; label: string; beat: StoryBeat }[] {
  const out: { key: string; label: string; beat: StoryBeat }[] = [];
  if (act.open) out.push({ key: 'open', label: 'Opens', beat: act.open });
  if (act.turn) out.push({ key: 'turn', label: act.turn.dir === 'lifts' ? 'Lifts' : 'Drops', beat: act.turn });
  if (act.close) out.push({ key: 'close', label: 'Lands', beat: act.close });
  return out;
}
