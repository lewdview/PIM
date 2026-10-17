// Campaign results: shown after a run launched from a chapter. It answers the
// three campaign questions instead of the on-demand reward screen: did you pass
// the stage, can you replay it (only with its card once cleared), and what's
// next (the next day's stage, its release date, the bonus gate, or the next
// chapter). On-demand plays (collection, codex, award play, search) keep the
// regular results screen.

import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, CheckCircle2, Lock, Play, RotateCcw, XCircle } from 'lucide-react';
import { getModifierForSong, type GameSong } from '@/game/api';
import { CHAPTERS, campaignPlayPath, levelToTier, prepareCampaignRun } from '@/game/campaign';
import { getCampaignRecord } from '@/game/progress';
import { getCampaignStage, stageAt, type CampaignStage } from '@/game/chapterStory';
import { audioManager } from '@/game/audio';
import { useVaultStore, ownsCardForDay } from '@/store/useVaultStore';
import { formatDate } from '@/utils/dayCalc';
import { hideBroken } from './hideBroken';
import '@/styles/stageShell.css';
import '@/styles/campaignStory.css';

const MEDAL_COLOR: Record<string, string> = {
  PLATINUM: '#39FF14', GOLD: '#E5B800', SILVER: '#A0AABB', BRONZE: '#C97A3A',
};
const pad = (n: number) => String(n).padStart(2, '0');

export interface CampaignResultData {
  score: number;
  maxCombo: number;
  medal: string;
  failed?: boolean;
  campaign?: { month: number; idx: number; level: number; firstClear: boolean };
}

type NextStep =
  | { kind: 'play'; stage: CampaignStage }
  | { kind: 'released-later'; stage: CampaignStage }
  | { kind: 'bonus-gate'; need: number; have: number }
  | { kind: 'next-chapter'; month: number }
  | { kind: 'done' };

export default function CampaignResults({ songId, song, result, accuracy, coverUrl }: {
  songId: string;
  song: GameSong | null;
  result: CampaignResultData;
  accuracy: number;
  coverUrl?: string | null;
}) {
  const [, setLocation] = useLocation();
  const collection = useVaultStore((s) => s.collection);
  const equippedCardId = useVaultStore((s) => s.equippedCardId);
  const [stage, setStage] = useState<CampaignStage | null>(null);

  // Re-read the stage after the run so progress reflects this result.
  useEffect(() => {
    let alive = true;
    getCampaignStage(songId).then((st) => { if (alive) setStage(st); });
    return () => { alive = false; };
  }, [songId]);

  const passed = !result.failed;
  const month = stage?.month ?? result.campaign?.month ?? 1;
  const meta = CHAPTERS.find((c) => c.month === month) ?? CHAPTERS[0];
  const level = result.campaign?.level ?? stage?.level ?? 1;
  const ownsCard = song ? ownsCardForDay(collection, song.day) : false;
  const record = getCampaignRecord(songId);
  const firstClear = !!result.campaign?.firstClear;

  const next = useMemo<NextStep | null>(() => {
    if (!stage || !passed) return null;
    const { songs, progress, idx } = stage;
    const n = idx + 1;
    if (n < songs.length) {
      const nextStage = stageAt(songs, meta, n);
      if (nextStage.isBonus && !progress.bonusUnlocked) {
        return { kind: 'bonus-gate', need: meta.platNeeded, have: progress.platinums };
      }
      if (nextStage.timeLocked) return { kind: 'released-later', stage: nextStage };
      if (nextStage.unlocked) return { kind: 'play', stage: nextStage };
    }
    if (progress.complete && meta.month < 12) return { kind: 'next-chapter', month: meta.month + 1 };
    return { kind: 'done' };
  }, [stage, passed, meta]);

  const launch = (target: GameSong) => {
    audioManager.playSfx('tap_nav', 0.4);
    sessionStorage.removeItem(`result_${songId}`);
    prepareCampaignRun(target.id, month, getModifierForSong(target), equippedCardId === target.id);
    setLocation(campaignPlayPath(target.id));
  };
  const go = (path: string) => { audioManager.playSfx('tap_nav', 0.15); setLocation(path); };

  // Failed: retry is always open until the stage is cleared. Passed: replay
  // needs the card (the stage is cleared now).
  const canReplay = passed ? ownsCard : true;
  const stageLabel = stage
    ? stage.isBonus
      ? `Bonus ${stage.idx - stage.progress.regular.length + 1} of ${stage.progress.bonus.length}`
      : `Stage ${stage.idx + 1} of ${stage.progress.regular.length}`
    : 'Stage';
  const medalColor = MEDAL_COLOR[result.medal];

  return (
    <div className="cs-page" style={{ ['--ch' as string]: meta.dc, maxWidth: 640 }}>
      <nav className="cs-topbar" aria-label="Campaign">
        <button type="button" className="cs-chip-btn" onClick={() => go(`/chapter/${month}`)}>
          <ArrowLeft size={16} /> Chapter {pad(month)}
        </button>
        <span className="cs-eyebrow">{meta.name} · {stageLabel}</span>
      </nav>

      <header className="cs-hero" style={{ alignItems: 'center', textAlign: 'center' }}>
        {coverUrl && (
          <div className="cs-hero-art" aria-hidden="true" style={{ gridTemplateColumns: '1fr' }}>
            <img src={coverUrl} alt="" onError={hideBroken} />
          </div>
        )}
        <div className="cs-eyebrow" style={{ color: passed ? meta.dc : '#ff4d6d' }}>
          {passed ? <CheckCircle2 size={14} style={{ verticalAlign: '-2px' }} /> : <XCircle size={14} style={{ verticalAlign: '-2px' }} />}{' '}
          Campaign · Lv {level} · {levelToTier(level).toLowerCase()}
        </div>
        <h1 className="cs-display" style={{ fontSize: 'clamp(44px, 13vw, 76px)' }}>
          {passed ? 'Stage passed' : 'Stage failed'}
        </h1>
        <div className="cs-muted" style={{ fontSize: 15 }}>
          {song ? <>Day {song.day} · <b style={{ color: '#fff' }}>{song.title}</b></> : 'Transmission'}
        </div>
        <div className="cs-detail-grid" style={{ width: '100%' }}>
          <div><small>Score</small><b>{result.score.toLocaleString()}</b></div>
          <div><small>Accuracy</small><b>{Math.round(accuracy)}%</b></div>
          <div>
            <small>{passed ? 'Medal' : 'Max combo'}</small>
            <b style={{ color: passed ? medalColor : undefined }}>
              {passed ? (result.medal && result.medal !== 'NONE' ? result.medal.toLowerCase() : 'clear') : `${result.maxCombo}x`}
            </b>
          </div>
        </div>
        {passed && record && record.score > result.score && (
          <div className="cs-eyebrow">Campaign best {record.score.toLocaleString()}</div>
        )}
      </header>

      {/* Replay status */}
      <section className="cs-act" data-open="true" aria-label="Replay">
        <div className="cs-act-head">
          <div className="cs-eyebrow">{passed ? 'Replay' : 'Try again'}</div>
          {!passed ? (
            <p className="cs-hook">The next stage stays locked until you pass this one. Retry as many times as you need.</p>
          ) : canReplay ? (
            <p className="cs-hook">Replay available. You hold this stage's card, so you can run it again for a better medal.</p>
          ) : (
            <div className="cs-lock-note">
              <Lock size={14} style={{ verticalAlign: '-2px' }} /> Replay locked. Cleared stages can only be replayed once you pull
              the Day {song?.day} card. Find it in packs or the vault.
            </div>
          )}
          <div className="cs-detail-actions">
            {canReplay && song ? (
              <button type="button" className="btn-3d" data-tone={passed ? 'quiet' : undefined} onClick={() => launch(song)}>
                <RotateCcw size={16} /> {passed ? 'Replay stage' : 'Retry stage'}
              </button>
            ) : (
              <button type="button" className="btn-3d" data-tone="quiet" onClick={() => go('/vault')}>
                Get the card
              </button>
            )}
          </div>
        </div>
      </section>

      {/* What's next */}
      {passed && (
        <section className="cs-act" data-open="true" aria-label="Next stage">
          <div className="cs-act-head">
            <div className="cs-eyebrow">{firstClear ? 'Unlocked' : 'Up next'}</div>
            {!next && <p className="cs-hook">Checking the next stage…</p>}
            {next?.kind === 'play' && (
              <>
                <NextTrack stage={next.stage} />
                <div className="cs-detail-actions">
                  <button type="button" className="btn-3d" onClick={() => launch(next.stage.song)}>
                    <Play size={16} fill="currentColor" /> Play day {next.stage.song.day}
                  </button>
                </div>
              </>
            )}
            {next?.kind === 'released-later' && (
              <>
                <NextTrack stage={next.stage} />
                <div className="cs-lock-note">
                  <Lock size={14} style={{ verticalAlign: '-2px' }} /> Unlocked, releases {formatDate(next.stage.song.day)}.
                </div>
              </>
            )}
            {next?.kind === 'bonus-gate' && (
              <div className="cs-lock-note">
                <Lock size={14} style={{ verticalAlign: '-2px' }} /> All stages cleared. The bonus stages open at {next.need} campaign
                platinum medals in this chapter ({next.have} so far).
              </div>
            )}
            {next?.kind === 'next-chapter' && (
              <>
                <p className="cs-hook">Chapter {pad(month)} complete.</p>
                <div className="cs-detail-actions">
                  <button type="button" className="btn-3d" onClick={() => go(`/chapter/${next.month}`)}>
                    <Play size={16} fill="currentColor" /> Chapter {pad(next.month)}
                  </button>
                </div>
              </>
            )}
            {next?.kind === 'done' && <p className="cs-hook">You've reached the end of this chapter.</p>}
          </div>
        </section>
      )}

      <div className="cs-detail-actions" style={{ justifyContent: 'center' }}>
        <button type="button" className="btn-3d" data-tone="ghost" onClick={() => go(`/chapter/${month}`)}>
          Back to chapter
        </button>
      </div>
    </div>
  );
}

function NextTrack({ stage }: { stage: CampaignStage }) {
  const { song, level, isBonus } = stage;
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      {song.coverArt && (
        <img src={song.coverArt} alt="" onError={hideBroken}
          style={{ width: 56, height: 56, borderRadius: 10, objectFit: 'cover', flex: 'none' }} />
      )}
      <div style={{ minWidth: 0 }}>
        <div className="cs-eyebrow">Day {song.day} · {isBonus ? 'Bonus · ' : ''}Lv {level}</div>
        <div style={{ color: '#fff', fontWeight: 700, overflowWrap: 'anywhere' }}>{song.title}</div>
      </div>
    </div>
  );
}
