/**
 * Overview, My stats and Lyrics tabs of the universal track detail view.
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Terminal } from 'lucide-react';
import { getModifierForSong } from '@/game/api';
import { audioManager } from '@/game/audio';
import { useVaultStore, getShardsForDay, isAwardPlayUnlocked, AWARD_PLAY_SHARD_THRESHOLD } from '../../store/useVaultStore';
import { getDateFromDay } from '../../utils/dayCalc';
import PrizeProgressMenu from '../PrizeProgressMenu';
import type { TrackDetailData } from './useTrackDetail';

export const MEDAL_COLOR: Record<string, string> = {
  PLATINUM: '#39FF14', GOLD: '#E5B800', SILVER: '#A0AABB', BRONZE: '#C97A3A', NONE: '#666', '': '#666',
};

const MODIFIER_COPY: Record<string, { name: string; desc: string }> = {
  vocal_isolation: { name: 'Vocal isolation', desc: 'Boost vocal channels, dampen bass & treble' },
  bass_realm: { name: 'Bass realm', desc: 'Intensify bass + wider highway lane-0 notes' },
  corrupted_signal: { name: 'Corrupted signal', desc: 'Tempo drift & CRT visual glitch' },
};

function TraitBar({ label, value, color, display }: { label: string; value: number; color: string; display?: string }) {
  const pct = Math.max(4, Math.min(100, value * 100));
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-end">
        <span className="td-label">{label}</span>
        <span className="text-[11px] font-mono font-black" style={{ color }}>{display ?? `${Math.round(value * 100)}%`}</span>
      </div>
      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="h-full rounded-full" style={{ background: color, boxShadow: `0 0 10px ${color}40` }} />
      </div>
    </div>
  );
}

export function OverviewSection({ data }: { data: TrackDetailData }) {
  const { song, vaultCard, day, isOwned } = data;
  const equippedCardId = useVaultStore((s) => s.equippedCardId);
  const setEquippedCardId = useVaultStore((s) => s.setEquippedCardId);

  const bpm = song?.bpm || vaultCard?.tempo || 120;
  const duration = song?.duration || 0;
  const length = duration ? `${Math.floor(duration / 60)}:${String(Math.round(duration % 60)).padStart(2, '0')}` : '—';
  const energy = vaultCard?.energy;
  const valence = song?.valence ?? vaultCard?.valence;
  const tags = Array.from(new Set([...(song?.moodTags || []), ...(vaultCard?.tags || [])])).slice(0, 8);
  const genres = song?.genre?.length ? song.genre : vaultCard?.genre || [];
  const description = song?.description || vaultCard?.description;
  const modifier = song ? getModifierForSong(song) : 'none';
  const songId = data.songId;
  const dateStr = getDateFromDay(day).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: 'BPM', value: bpm },
          { label: 'Notes', value: song?.notes?.length || '—' },
          { label: 'Length', value: length },
          { label: 'Difficulty', value: song?.difficultyLevel ? `LVL ${song.difficultyLevel}` : '—' },
        ].map(({ label, value }) => (
          <div key={label} className="td-cell text-center">
            <span className="td-label">{label}</span>
            <span className="font-mono font-bold text-base text-white">{value}</span>
          </div>
        ))}
      </div>

      <div className="hw-well p-4 sm:p-5 space-y-3">
        <div className="td-label">Story</div>
        <p className="text-sm leading-relaxed text-white/85">
          {description || 'This track is part of the 365 Days of Light & Dark release archive. Each day explores dualities between intense digital energy and raw acoustic introspection.'}
        </p>
        <p className="text-[11px] leading-relaxed text-white/45 italic">
          "Years ago I lost much of my music in a hard drive failure. I recovered what I could. Rather than letting those songs disappear, I decided to release one every day."
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-5 p-5 rounded-2xl bg-white/[0.02] border border-white/5">
        {energy !== undefined && <TraitBar label="Energy" value={energy} color="var(--shell-cyan)" />}
        {valence !== undefined && <TraitBar label="Valence" value={valence} color="var(--shell-gold)" />}
        <TraitBar label="Tempo" value={Math.max(0.1, Math.min(1, (bpm - 50) / 130))} color="#a78bfa" display={`${bpm} BPM`} />
        <div className="space-y-1.5">
          <span className="td-label">Mood</span>
          <div>
            <span className={`px-2.5 py-1 rounded text-xs font-black uppercase ${data.mood === 'light' ? 'bg-yellow-400/20 text-yellow-400' : 'bg-blue-400/20 text-blue-400'}`}>
              {data.mood}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono">
        <div className="td-cell"><span className="td-label">Released</span><span className="text-xs font-bold">{song?.date || dateStr}</span></div>
        <div className="td-cell"><span className="td-label">Key</span><span className="text-xs font-bold">{song?.key || '—'}</span></div>
        <div className="td-cell"><span className="td-label">Genre</span><span className="text-xs font-bold truncate">{genres.join(', ') || 'Alternative'}</span></div>
        <div className="td-cell"><span className="td-label">Format</span><span className="text-xs font-bold text-[#39FF14]">Lossless WAV</span></div>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => <span key={t} className="td-chip">{t}</span>)}
        </div>
      )}

      {isOwned && modifier !== 'none' && (
        <div className="hw-well p-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="td-label" style={{ color: 'var(--shell-gold)' }}>Modifier card owned</div>
            <div className="text-sm font-bold text-white">{MODIFIER_COPY[modifier]?.name || modifier}</div>
            <div className="text-[10px] font-mono text-white/45">{MODIFIER_COPY[modifier]?.desc}</div>
          </div>
          <button
            type="button"
            className="btn-3d shrink-0"
            data-size="sm"
            data-tone={equippedCardId === songId ? 'gold' : 'quiet'}
            onClick={() => { audioManager.playSfx('tap_nav', 0.08); setEquippedCardId(equippedCardId === songId ? null : songId); }}
          >
            {equippedCardId === songId ? 'Active' : 'Equip'}
          </button>
        </div>
      )}
    </div>
  );
}

export function StatsSection({ data }: { data: TrackDetailData }) {
  const fragments = useVaultStore((s) => s.fragments);
  const { stats, day, isOwned } = data;
  const mc = MEDAL_COLOR[stats.medal] ?? '#666';
  const shards = getShardsForDay(fragments, day);
  const awardUnlocked = isAwardPlayUnlocked(fragments, day);
  const history = stats.history.slice(0, 10);
  const top = history.length ? Math.max(...history) : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-2">
        <div className="td-cell">
          <span className="td-label">Best score</span>
          <span className="font-mono font-black text-lg" style={{ color: stats.best > 0 ? mc : 'rgba(255,255,255,0.35)' }}>
            {stats.best > 0 ? stats.best.toLocaleString() : '—'}
          </span>
        </div>
        <div className="td-cell">
          <span className="td-label">Medal</span>
          <span className="font-mono font-black text-sm uppercase" style={{ color: mc }}>{stats.medal && stats.medal !== 'NONE' ? stats.medal : 'None yet'}</span>
        </div>
        <div className="td-cell">
          <span className="td-label">Plays logged</span>
          <span className="font-mono font-black text-lg text-white">{stats.history.length}</span>
        </div>
      </div>

      {isOwned && (
        <div className={`hw-well p-4 ${awardUnlocked ? 'border-[#FFB800]/45' : ''}`}>
          <div className={`font-mono text-xs font-black tracking-wider uppercase ${awardUnlocked ? 'text-[#FFB800]' : 'text-white/75'}`}>
            {awardUnlocked ? '🏆 Award play unlocked' : `◈ ${shards} / ${AWARD_PLAY_SHARD_THRESHOLD} shards to award play`}
          </div>
          {!awardUnlocked && (
            <div className="h-2 w-full bg-black/60 rounded-full overflow-hidden mt-2 border border-white/10">
              <div className="h-full bg-gradient-to-r from-[#FFB800] to-[#FF3800] rounded-full" style={{ width: `${Math.min(100, (shards / AWARD_PLAY_SHARD_THRESHOLD) * 100)}%` }} />
            </div>
          )}
          <div className="font-mono text-[10px] text-white/55 mt-1.5">
            {awardUnlocked ? 'High scores earn prize packs.' : 'Pull more copies of this card to unlock award play prizes.'}
          </div>
        </div>
      )}

      <PrizeProgressMenu songId={data.songId} aliasIds={data.aliasIds} />

      <section>
        <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/5">
          <h3 className="td-h">Recent runs</h3>
          <span className="td-label">Last {history.length}</span>
        </div>
        {history.length === 0 ? (
          <p className="td-muted text-center py-6">No runs yet. Play it to start your history.</p>
        ) : (
          <div className="space-y-1.5">
            {history.map((score, i) => {
              const isTop = score === top && i === history.indexOf(top);
              return (
                <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg"
                  style={{ background: isTop ? 'rgba(229,184,0,0.06)' : 'rgba(255,255,255,0.02)', border: isTop ? '1px solid rgba(229,184,0,0.18)' : '1px solid transparent' }}>
                  <span className="font-mono text-[10px] w-6" style={{ color: isTop ? '#E5B800' : 'rgba(255,255,255,0.3)' }}>{isTop ? '★' : `#${i + 1}`}</span>
                  <div className="flex-1 h-1 rounded-full bg-white/5">
                    <div className="h-full rounded-full" style={{ width: `${top > 0 ? (score / top) * 100 : 100}%`, background: isTop ? '#E5B800' : 'rgba(255,255,255,0.18)' }} />
                  </div>
                  <span className="font-mono font-bold text-[11px] min-w-[76px] text-right" style={{ color: isTop ? '#F2F0E8' : 'rgba(255,255,255,0.5)' }}>{score.toLocaleString()}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export function LyricsSection({ data }: { data: TrackDetailData }) {
  const [terminal, setTerminal] = useState(false);
  const { song, day } = data;
  const title = data.title.toUpperCase();
  const dayStr = String(day).padStart(3, '0');
  const ascii = `
 ┌────────────────────────────────────────────────────────┐
 │  TH3SCR1B3 // 365 DAYS OF LIGHT & DARK                 │
 │  DAY #${dayStr} — [${data.mood.toUpperCase()} REALM]                          │
 ├────────────────────────────────────────────────────────┤
 │      TITLE  : ${title.slice(0, 29).padEnd(29)}            │
 │      TEMPO  : ${String(song?.bpm || 120).padEnd(4)} BPM                                │
 │      VALENCE: ${String(song?.valence ?? 0.5).slice(0, 4).padEnd(4)} / 1.00                            │
 │      GENRE  : ${(song?.genre?.join('/') || 'EXPERIMENTAL').slice(0, 29).padEnd(29)}            │
 │      STATUS : SYNCHRONIZED / READY                      │
 └────────────────────────────────────────────────────────┘
`;
  return (
    <div className="space-y-4">
      <div className="hw-well p-5">
        {song?.lyrics ? (
          <pre className="font-mono text-xs sm:text-sm text-white/80 whitespace-pre-wrap leading-loose">{song.lyrics}</pre>
        ) : (
          <div className="text-center py-10 font-mono text-xs text-white/45 uppercase">
            <BookOpen size={22} className="mx-auto mb-2 opacity-50" />
            Lyrics for this day aren't transcribed yet.
          </div>
        )}
      </div>
      <button type="button" className="btn-3d" data-size="sm" data-tone="quiet" onClick={() => setTerminal((t) => !t)}>
        <Terminal size={12} /> {terminal ? 'Hide' : 'Show'} terminal view
      </button>
      {terminal && (
        <pre className="p-4 bg-black border border-white/15 rounded-xl overflow-x-auto font-mono text-[10px] sm:text-xs text-[#39FF14] leading-tight select-all">{ascii}</pre>
      )}
    </div>
  );
}
