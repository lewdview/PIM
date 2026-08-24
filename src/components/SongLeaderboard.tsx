import React, { useEffect, useState, useMemo } from 'react';
import { Trophy, Radio, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { useAuthStore } from '../store/useAuthStore';
import { useVaultStore } from '../store/useVaultStore';
import LeaderboardRow from './LeaderboardRow';
import '../styles/LeaderboardPage.css';

interface SongLeaderEntry {
  userId: string;
  rank: number;
  displayName: string;
  avatarUrl: string | null;
  score: number;
  accuracy: number;
  maxCombo: number;
  medal: string;
  isYou: boolean;
}

interface SongLeaderboardProps {
  songId: string;
  currentScore?: number;
  currentAccuracy?: number;
  currentMaxCombo?: number;
  currentMedal?: string;
  defaultLimit?: number;
  title?: string;
  className?: string;
}

const MEDAL_COLORS: Record<string, string> = {
  PLATINUM: '#39FF14',
  GOLD: '#E5B800',
  SILVER: '#A0AABB',
  BRONZE: '#C97A3A',
  NONE: '#666666',
};

export function getSongAliases(songId: string): string[] {
  const aliases = new Set<string>();
  if (songId) aliases.add(songId);

  const dayMatch = songId ? songId.match(/\d+/) : null;
  if (dayMatch) {
    const dayNum = parseInt(dayMatch[0], 10);
    aliases.add(`day-${dayNum}`);
    aliases.add(`day-${String(dayNum).padStart(2, '0')}`);
    aliases.add(`day-${String(dayNum).padStart(3, '0')}`);
    aliases.add(`card-${dayNum}`);
    aliases.add(`card-${String(dayNum).padStart(3, '0')}`);
    aliases.add(`song-day-${dayNum}`);
    aliases.add(`song-day-${String(dayNum).padStart(3, '0')}`);
    aliases.add(String(dayNum));
  }
  return Array.from(aliases);
}

export default function SongLeaderboard({
  songId,
  currentScore,
  currentAccuracy,
  currentMaxCombo,
  currentMedal,
  defaultLimit = 5,
  title = 'TRANSMISSION RANKINGS',
  className = '',
}: SongLeaderboardProps) {
  const [entries, setEntries] = useState<SongLeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const authUser = useAuthStore(s => s.user);
  const storeDisplayName = useVaultStore(s => s.displayName);
  const storeAvatarUrl = useVaultStore(s => s.avatarUrl);
  const highScores = useVaultStore(s => s.highScores);

  const fetchSongLeaderboard = async (showLoading = false) => {
    try {
      if (showLoading) setLoading(true);

      const aliasIds = getSongAliases(songId);

      // 1. Fetch real gameplay records for this specific song across all aliases from Supabase
      const { data: records, error: recordsErr } = await supabase
        .from('gameplay_records')
        .select('user_id, score, accuracy, max_combo, medal, timestamp')
        .in('song_id', aliasIds)
        .order('score', { ascending: false });

      if (recordsErr) {
        console.warn('Failed to fetch song leaderboard:', recordsErr);
      }

      // Aggregate personal bests per user for this song
      const bestByUser: Record<string, {
        userId: string;
        score: number;
        accuracy: number;
        maxCombo: number;
        medal: string;
        timestamp: string;
      }> = {};

      for (const r of records || []) {
        if (!r.user_id) continue;
        const s = r.score || 0;
        if (!bestByUser[r.user_id] || s > bestByUser[r.user_id].score) {
          bestByUser[r.user_id] = {
            userId: r.user_id,
            score: s,
            accuracy: typeof r.accuracy === 'number' ? r.accuracy : parseFloat(r.accuracy || '0'),
            maxCombo: r.max_combo || 0,
            medal: r.medal || 'NONE',
            timestamp: r.timestamp || '',
          };
        }
      }

      // 2. Ensure current player's local or live score is represented across any alias
      let localHighScore = 0;
      for (const aid of aliasIds) {
        const hsFromStore = highScores[aid];
        if (typeof hsFromStore === 'number' && hsFromStore > localHighScore) localHighScore = hsFromStore;
        if (typeof localStorage !== 'undefined') {
          const hsFromStorage = parseInt(localStorage.getItem(`hs_${aid}`) || '0', 10);
          if (hsFromStorage > localHighScore) localHighScore = hsFromStorage;
        }
      }

      const effectiveScore = typeof currentScore === 'number' && currentScore > 0 ? currentScore : localHighScore;
      const effectiveAcc = typeof currentAccuracy === 'number' ? currentAccuracy : 0;
      const effectiveCombo = typeof currentMaxCombo === 'number' ? currentMaxCombo : 0;
      const effectiveMedal = currentMedal || 'NONE';

      const playerKey = authUser ? authUser.id : 'local_player_guest';

      if (effectiveScore > 0) {
        const existing = bestByUser[playerKey];
        if (!existing || effectiveScore > existing.score) {
          bestByUser[playerKey] = {
            userId: playerKey,
            score: effectiveScore,
            accuracy: effectiveAcc,
            maxCombo: effectiveCombo,
            medal: effectiveMedal,
            timestamp: new Date().toISOString(),
          };
        }
      }

      const userIds = Object.keys(bestByUser);
      let profilesMap: Record<string, { displayName: string; avatarUrl: string | null }> = {};

      // Filter out local guest player ID before querying Supabase profiles
      const realUserIds = userIds.filter(id => id !== 'local_player_guest');

      if (realUserIds.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, wallet_address, display_name, avatar_url')
          .in('id', realUserIds);

        for (const p of profs || []) {
          let name = p.display_name || '';
          if (!name) {
            if (p.wallet_address) {
              name = `${p.wallet_address.slice(0, 6)}...${p.wallet_address.slice(-4)}`;
            } else {
              name = `ANON_${p.id.slice(0, 6)}`;
            }
          }
          profilesMap[p.id] = {
            displayName: name,
            avatarUrl: p.avatar_url || null,
          };
        }
      }

      // Fallback for current user profile
      if (authUser && !profilesMap[authUser.id]) {
        profilesMap[authUser.id] = {
          displayName: storeDisplayName || authUser.email?.split('@')[0] || `ANON_${authUser.id.slice(0, 6)}`,
          avatarUrl: storeAvatarUrl || (authUser.user_metadata?.avatar_url as string) || null,
        };
      } else if (!authUser && bestByUser['local_player_guest']) {
        profilesMap['local_player_guest'] = {
          displayName: storeDisplayName || 'PILOT (GUEST)',
          avatarUrl: storeAvatarUrl || null,
        };
      }

      // 3. Build list of human entries
      const humanEntries: SongLeaderEntry[] = userIds.map(uid => {
        const stats = bestByUser[uid];
        const prof = profilesMap[uid] || { displayName: `ANON_${uid.slice(0, 6)}`, avatarUrl: null };
        const isYou = authUser ? authUser.id === uid : uid === 'local_player_guest';

        return {
          userId: uid,
          rank: 0,
          displayName: prof.displayName.toUpperCase(),
          avatarUrl: prof.avatarUrl,
          score: stats.score,
          accuracy: stats.accuracy,
          maxCombo: stats.maxCombo,
          medal: stats.medal,
          isYou,
        };
      });

      // 4. Sort descending by score and assign final ranks
      humanEntries.sort((a, b) => b.score - a.score);
      humanEntries.forEach((entry, idx) => {
        entry.rank = idx + 1;
      });

      setEntries(humanEntries);
    } catch (err) {
      console.warn('Error loading song leaderboard:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchSongLeaderboard(true);

    // Realtime listener for live score submissions across any alias of this song
    const aliasIds = getSongAliases(songId);
    const channel = supabase
      .channel(`song-leaderboard-${songId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'gameplay_records' },
        (payload: any) => {
          if (payload?.new && aliasIds.includes(payload.new.song_id)) {
            fetchSongLeaderboard(false);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [songId, authUser?.id, currentScore]);

  const yourEntry = useMemo(() => entries.find(e => e.isYou), [entries]);
  const limit = expanded ? 20 : defaultLimit;
  const visibleEntries = useMemo(() => entries.slice(0, limit), [entries, limit]);
  const isYourRankOutsideVisible = yourEntry && yourEntry.rank > limit;

  return (
    <div className={`w-full bg-[#08080c]/90 border border-white/10 rounded-xl overflow-hidden backdrop-blur-md shadow-[0_4px_30px_rgba(0,0,0,0.6)] ${className}`}>
      {/* Header Bar */}
      <div className="px-4 py-3 bg-white/[0.03] border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy size={16} className="text-[#FFD700] drop-shadow-[0_0_8px_rgba(255,215,0,0.4)]" />
          <div className="flex flex-col">
            <span className="font-mono text-xs font-black tracking-widest text-white uppercase flex items-center gap-1.5">
              {title}
            </span>
            <span className="font-mono text-[8px] tracking-[0.15em] text-white/40 uppercase">
              TOP TRANSMISSION SIGNALS
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#39FF14]/10 border border-[#39FF14]/30">
            <div className="w-1.5 h-1.5 rounded-full bg-[#39FF14] animate-pulse" />
            <span className="font-mono text-[8px] font-bold text-[#39FF14] tracking-wider uppercase">
              LIVE SYNC
            </span>
          </div>
          <span className="font-mono text-[9px] text-white/30 tracking-wider">
            {entries.length} {entries.length === 1 ? 'SIGNAL' : 'SIGNALS'}
          </span>
        </div>
      </div>

      {/* Your Rank Highlight Banner (if ranked) */}
      {yourEntry && (
        <div className="px-4 py-2.5 bg-gradient-to-r from-[#FFD700]/15 via-[#FFD700]/05 to-transparent border-b border-[#FFD700]/20 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-black border border-[#FFD700] flex items-center justify-center font-mono font-black text-xs text-[#FFD700]">
              #{yourEntry.rank}
            </div>
            <div className="flex flex-col">
              <span className="font-mono text-[10px] font-black tracking-wider text-[#FFD700] uppercase">
                {yourEntry.rank === 1 ? '👑 TRANSMISSION RECORD HOLDER' : 'YOUR RANKING STATUS'}
              </span>
              <span className="font-mono text-[8px] text-white/60 tracking-wider">
                {yourEntry.accuracy > 0 ? `${yourEntry.accuracy.toFixed(1)}% ACC · ` : ''}
                {yourEntry.maxCombo > 0 ? `${yourEntry.maxCombo}x COMBO · ` : ''}
                <span style={{ color: MEDAL_COLORS[yourEntry.medal] || '#fff' }}>
                  {yourEntry.medal}
                </span>
              </span>
            </div>
          </div>
          <div className="text-right">
            <span className="font-mono text-xs font-black text-white">
              {yourEntry.score.toLocaleString()}
            </span>
            <span className="font-mono text-[9px] text-white/40 ml-1">pts</span>
          </div>
        </div>
      )}

      {/* Leaderboard Entries List */}
      <div className="divide-y divide-white/[0.04]">
        {loading ? (
          <div className="py-4 space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="leaderboard-skeleton">
                <div className="leaderboard-skeleton-circle" />
                <div className="flex-1 space-y-1.5">
                  <div className="leaderboard-skeleton-bar w-28" />
                  <div className="leaderboard-skeleton-bar w-16 h-2" />
                </div>
                <div className="leaderboard-skeleton-bar w-12" />
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="py-8 px-4 text-center">
            <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/30">
              <Radio size={18} />
            </div>
            <p className="font-mono text-[10px] text-white/50 uppercase tracking-widest">
              NO TRANSMISSION RECORDS YET
            </p>
            <p className="font-mono text-[8px] text-white/30 mt-1 uppercase">
              BE THE FIRST TO LOCK IN A HIGH SCORE FOR THIS TRACK
            </p>
          </div>
        ) : (
          <>
            {visibleEntries.map((entry, idx) => {
              const medalColor = MEDAL_COLORS[entry.medal] || '#888';
              const subtitleContent = (
                <span className="flex items-center gap-1.5">
                  {entry.medal && entry.medal !== 'NONE' && (
                    <span style={{ color: medalColor, fontWeight: 700 }}>
                      ★ {entry.medal}
                    </span>
                  )}
                  {entry.accuracy > 0 && (
                    <span>{entry.accuracy.toFixed(1)}%</span>
                  )}
                  {entry.maxCombo > 0 && (
                    <span>· {entry.maxCombo}x</span>
                  )}
                </span>
              );

              return (
                <LeaderboardRow
                  key={entry.userId}
                  rank={entry.rank}
                  avatarUrl={entry.avatarUrl}
                  displayName={entry.displayName}
                  score={entry.score}
                  isYou={entry.isYou}
                  userId={entry.userId}
                  subtitle={subtitleContent}
                  scoreLabel="pts"
                  animationDelay={idx * 0.04}
                />
              );
            })}

            {/* Pinned Your Rank Row if outside top visible limit */}
            {isYourRankOutsideVisible && yourEntry && (
              <>
                <div className="px-4 py-1.5 bg-black/40 text-center font-mono text-[8px] text-white/30 tracking-[0.3em] uppercase">
                  • • •
                </div>
                <LeaderboardRow
                  rank={yourEntry.rank}
                  avatarUrl={yourEntry.avatarUrl}
                  displayName={yourEntry.displayName}
                  score={yourEntry.score}
                  isYou={true}
                  userId={yourEntry.userId}
                  subtitle={
                    <span className="flex items-center gap-1.5">
                      {yourEntry.medal && yourEntry.medal !== 'NONE' && (
                        <span style={{ color: MEDAL_COLORS[yourEntry.medal], fontWeight: 700 }}>
                          ★ {yourEntry.medal}
                        </span>
                      )}
                      {yourEntry.accuracy > 0 && <span>{yourEntry.accuracy.toFixed(1)}%</span>}
                      {yourEntry.maxCombo > 0 && <span>· {yourEntry.maxCombo}x</span>}
                    </span>
                  }
                  scoreLabel="pts"
                />
              </>
            )}
          </>
        )}
      </div>

      {/* Expand / Collapse Button if more than defaultLimit */}
      {entries.length > defaultLimit && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full py-2 bg-white/[0.02] hover:bg-white/[0.06] border-t border-white/5 font-mono text-[9px] text-white/50 hover:text-white uppercase tracking-widest transition-colors flex items-center justify-center gap-1 cursor-pointer"
        >
          {expanded ? (
            <>
              <ChevronUp size={12} />
              <span>COLLAPSE TOP {defaultLimit}</span>
            </>
          ) : (
            <>
              <ChevronDown size={12} />
              <span>EXPAND TOP {Math.min(entries.length, 20)} ({entries.length} TOTAL)</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}
