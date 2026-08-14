import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Star } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { RARITY_CONFIG } from '../utils/rarity';
import { supabase } from '../services/supabaseClient';
import { Link, useLocation } from 'wouter';
import LeaderboardRow from '../components/LeaderboardRow';
import '../styles/LeaderboardPage.css';

interface LeaderEntry {
  id: string;
  rank: number;
  name: string;
  avatarUrl?: string;
  uniqueCards: number;
  totalCards: number;
  rarityScore: number;
  topRarity: string;
  isYou: boolean;
  playsToday?: number;
}

export default function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<'today' | 'alltime'>('today');
  const [entries, setEntries] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState<string>('00:00:00');
  const [, navigate] = useLocation();

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (activeTab === 'today') {
      const updateCountdown = () => {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setUTCHours(0, 0, 0, 0);
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
        
        const diffMs = tomorrow.getTime() - now.getTime();
        if (diffMs <= 0) {
          setCountdown('00:00:00');
          return;
        }

        const h = Math.floor(diffMs / 3600000);
        const m = Math.floor((diffMs % 3600000) / 60000);
        const s = Math.floor((diffMs % 60000) / 1000);

        setCountdown(
          `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
        );
      };

      updateCountdown();
      timer = setInterval(updateCountdown, 1000);
    }
    return () => clearInterval(timer);
  }, [activeTab]);

  useEffect(() => {
    async function fetchLeaderboard(showLoading = false) {
      try {
        if (showLoading) setLoading(true);

        const authUser = useAuthStore.getState().user;

        if (activeTab === 'today') {
          // PERFORMANCE: Today
          const todayStart = new Date();
          todayStart.setUTCHours(0, 0, 0, 0);
          const tomorrowStart = new Date(todayStart);
          tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);

          // 1. Fetch gameplay_records for today
          const { data: records, error: recordsError } = await supabase
            .from('gameplay_records')
            .select('user_id, score')
            .gte('timestamp', todayStart.toISOString())
            .lt('timestamp', tomorrowStart.toISOString());

          if (recordsError) throw recordsError;

          const statsByUser: Record<string, { totalScore: number; plays: number }> = {};
          for (const r of records || []) {
            if (!statsByUser[r.user_id]) {
              statsByUser[r.user_id] = { totalScore: 0, plays: 0 };
            }
            statsByUser[r.user_id].totalScore += (r.score || 0);
            statsByUser[r.user_id].plays += 1;
          }

          const userIds = Object.keys(statsByUser);
          
          let profilesMap: Record<string, any> = {};
          if (userIds.length > 0) {
            const { data: profs, error: profsError } = await supabase
              .from('profiles')
              .select('id, wallet_address, display_name, avatar_url')
              .in('id', userIds);
            
            if (!profsError && profs) {
              profilesMap = profs.reduce((acc, p) => ({...acc, [p.id]: p}), {});
            }
          }

          let mappedEntries: LeaderEntry[] = userIds.map(uid => {
            const prof = profilesMap[uid] || { id: uid };
            let name = 'ANONYMOUS';
            if (prof.display_name) {
              name = prof.display_name;
            } else if (prof.wallet_address) {
              const wa = prof.wallet_address;
              name = `${wa.slice(0, 6)}...${wa.slice(-4)}`;
            } else {
              name = `ANON_${uid.slice(0, 6)}`;
            }

            const isYou = authUser ? authUser.id === uid : false;
            
            return {
              id: uid,
              rank: 0,
              name: name.toUpperCase(),
              avatarUrl: prof.avatar_url,
              uniqueCards: 0,
              totalCards: 0,
              rarityScore: statsByUser[uid].totalScore,
              topRarity: 'common',
              isYou,
              playsToday: statsByUser[uid].plays
            };
          });

          mappedEntries.sort((a, b) => b.rarityScore - a.rarityScore);
          mappedEntries.forEach((entry, idx) => {
            entry.rank = idx + 1;
          });

          setEntries(mappedEntries);

        } else {
          // PRESTIGE: All Time
          let profiles: any[] = [];
          let pPage = 0;
          const P_PAGE_SIZE = 1000;
          let pHasMore = true;

          while (pHasMore) {
            const { data, error } = await supabase
              .from('profiles')
              .select('id, wallet_address, display_name, avatar_url, streak_count, total_pulls')
              .range(pPage * P_PAGE_SIZE, (pPage + 1) * P_PAGE_SIZE - 1);
            
            if (error) throw error;
            if (!data || data.length === 0) {
              pHasMore = false;
            } else {
              profiles = [...profiles, ...data];
              if (data.length < P_PAGE_SIZE) {
                pHasMore = false;
              } else {
                pPage++;
              }
            }
          }

          let collections: any[] = [];
          let cPage = 0;
          const C_PAGE_SIZE = 1000;
          let cHasMore = true;

          while (cHasMore) {
            const { data, error } = await supabase
              .from('vault_collections')
              .select('owner_id, card_id, rarity, edition, proof, is_echo')
              .range(cPage * C_PAGE_SIZE, (cPage + 1) * C_PAGE_SIZE - 1);
            
            if (error) throw error;
            if (!data || data.length === 0) {
              cHasMore = false;
            } else {
              collections = [...collections, ...data];
              if (data.length < C_PAGE_SIZE) {
                cHasMore = false;
              } else {
                cPage++;
              }
            }
          }

          const collectionsByOwner: Record<string, typeof collections> = {};
          for (const col of collections || []) {
            if (!collectionsByOwner[col.owner_id]) {
              collectionsByOwner[col.owner_id] = [];
            }
            collectionsByOwner[col.owner_id].push(col);
          }

          const mappedEntries: LeaderEntry[] = (profiles || []).map((prof) => {
            const userCols = collectionsByOwner[prof.id] || [];
            const uniqueCards = new Set(userCols.map(c => c.card_id)).size;
            const totalCards = userCols.length;

            let score = 0;
            score += (prof.streak_count || 0) * 120;
            score += (prof.total_pulls || 0) * 15;

            const RARITY_ORDER = ['common', 'uncommon', 'rare', 'legendary', 'mythic'];
            let maxRarityIdx = 0;

            for (const c of userCols) {
              const rarity = c.rarity || 'common';
              if (rarity === 'common') score += 10;
              else if (rarity === 'uncommon') score += 25;
              else if (rarity === 'rare') score += 60;
              else if (rarity === 'legendary') score += 350;
              else if (rarity === 'mythic') score += 800;

              if (c.edition === 1) score += 500;
              if (c.proof && c.proof !== 'none') score += 200;
              if (c.is_echo) score += 400;

              const rarityIdx = RARITY_ORDER.indexOf(rarity);
              if (rarityIdx > maxRarityIdx) {
                maxRarityIdx = rarityIdx;
              }
            }

            const topRarity = RARITY_ORDER[maxRarityIdx];

            let name = 'ANONYMOUS';
            if (prof.display_name) {
              name = prof.display_name;
            } else if (prof.wallet_address) {
              const wa = prof.wallet_address;
              name = `${wa.slice(0, 6)}...${wa.slice(-4)}`;
            } else {
              name = `ANON_${prof.id.slice(0, 6)}`;
            }

            const isYou = authUser ? authUser.id === prof.id : false;

            return {
              id: prof.id,
              rank: 0,
              name: name.toUpperCase(),
              avatarUrl: prof.avatar_url,
              uniqueCards,
              totalCards,
              rarityScore: score,
              topRarity,
              isYou,
            };
          });

          mappedEntries.sort((a, b) => b.rarityScore - a.rarityScore);
          mappedEntries.forEach((entry, idx) => {
            entry.rank = idx + 1;
          });

          setEntries(mappedEntries);
        }
      } catch (err) {
        console.error("Failed to load leaderboard:", err);
      } finally {
        if (showLoading) {
          setLoading(false);
        }
      }
    }

    fetchLeaderboard(true);

    const channel = supabase
      .channel('leaderboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gameplay_records' }, () => {
        if (activeTab === 'today') fetchLeaderboard(false);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vault_collections' }, () => {
        if (activeTab === 'alltime') fetchLeaderboard(false);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchLeaderboard(false);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTab]);

  const yourEntry = entries.find(e => e.isYou);

  return (
    <div className="flex-1 px-4 md:px-8 pt-2 pb-36 md:pb-10 max-w-4xl mx-auto w-full space-y-8 etching-bg">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4 mb-8"
      >
        <div className="flex flex-col items-center justify-center gap-4">
          <Trophy size={32} className="text-neon-gold drop-shadow-[0_0_15px_rgba(255,215,0,0.4)]" />
          <h1 className="text-6xl brutalist-title" style={{ '--neon-accent': 'var(--color-neon-gold)' } as any}>
            Leaderboard
          </h1>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex justify-center mb-6 border-b border-white/10 relative leaderboard-tabs">
        <button
          className={`px-8 py-4 font-black uppercase text-lg tracking-wider transition-colors relative ${activeTab === 'today' ? 'text-neon-gold active' : 'text-white/40 hover:text-white/80'}`}
          onClick={() => setActiveTab('today')}
        >
          PERFORMANCE
          <div className="text-[10px] opacity-60 font-mono tracking-normal text-white">How well you play today</div>
          {activeTab === 'today' && (
            <motion.div
              layoutId="tab-indicator"
              className="absolute bottom-0 left-0 right-0 h-1 bg-neon-gold"
            />
          )}
        </button>
        <button
          className={`px-8 py-4 font-black uppercase text-lg tracking-wider transition-colors relative ${activeTab === 'alltime' ? 'text-neon-gold active' : 'text-white/40 hover:text-white/80'}`}
          onClick={() => setActiveTab('alltime')}
        >
          PRESTIGE
          <div className="text-[10px] opacity-60 font-mono tracking-normal text-white">How deep your collection goes</div>
          {activeTab === 'alltime' && (
            <motion.div
              layoutId="tab-indicator"
              className="absolute bottom-0 left-0 right-0 h-1 bg-neon-gold"
            />
          )}
        </button>
      </div>

      {/* Your rank card */}
      {yourEntry && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="relative mb-6"
        >
          <div className="sticker-gun-tag sticker-slits p-5 flex items-center justify-between drop-shadow-xl" style={{
            background: 'linear-gradient(135deg, var(--color-neon-yellow), var(--color-neon-cyan))',
            color: '#000',
            '--slit-color': 'rgba(0,0,0,0.15)',
            transform: 'rotate(-0.5deg)',
            border: '2px solid #000'
          } as any}>
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 flex items-center justify-center font-black text-3xl italic brutalist-stroke-md"
                style={{
                  background: '#000',
                  color: 'var(--color-neon-yellow)',
                  transform: 'skewX(-10deg)',
                }}
              >
                {yourEntry.rank}
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-lg font-black uppercase italic tracking-tighter" style={{ transform: 'scaleY(1.2)' }}>
                  YOUR STATUS
                </span>
                 <div className="text-[10px] font-black uppercase opacity-60 mt-1">
                  {activeTab === 'today' ? (
                    <>{yourEntry.rarityScore} SCORE TODAY</>
                  ) : (
                    <>{yourEntry.uniqueCards} UNIQUE • {yourEntry.rarityScore} ECHO SCORE</>
                  )}
                </div>
              </div>
            </div>
            <Star size={24} className="fill-black opacity-20" />
          </div>
        </motion.div>
      )}

      {/* Countdown Timer (Today only) */}
      {activeTab === 'today' && (
        <div className="leaderboard-countdown text-center py-4 flex flex-col items-center">
          <div className="text-[10px] font-mono uppercase tracking-[0.3em] opacity-40 mb-1">
            Resets in
          </div>
          <div className="leaderboard-countdown-value font-black text-2xl text-neon-cyan drop-shadow-[0_0_10px_rgba(0,229,255,0.5)]">
            {countdown}
          </div>
        </div>
      )}

      {/* Leaderboard table */}
      {loading ? (
        <div className="space-y-1.5 pt-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <div key={n} className="flex items-center gap-3 px-4 py-3 border-b border-white/5 opacity-50 leaderboard-skeleton">
              <div className="w-6 h-6 rounded-full bg-white/10 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-1/3 bg-white/10 rounded animate-pulse" />
                <div className="h-2 w-1/4 bg-white/5 rounded animate-pulse" />
              </div>
              <div className="w-16 h-4 bg-white/10 rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-1.5">
          {entries.length === 0 && activeTab === 'today' && (
            <div className="text-center py-12 text-sm font-mono opacity-50">
              No plays recorded today — be the first.
            </div>
          )}
          {entries.map((entry, i) => (
            <LeaderboardRow
              key={entry.id}
              userId={entry.id}
              rank={entry.rank}
              avatarUrl={entry.avatarUrl}
              displayName={entry.name}
              score={entry.rarityScore}
              isYou={entry.isYou}
              topRarity={activeTab === 'alltime' ? entry.topRarity : undefined}
              scoreLabel={activeTab === 'today' ? 'pts' : 'prestige'}
              subtitle={activeTab === 'today' ? `${entry.playsToday} plays` : undefined}
              animationDelay={0.05 * i}
              onClick={() => navigate(`/vault/${entry.id}`)}
            />
          ))}
        </div>
      )}

      {/* Footer note */}
      <p className="text-center text-[10px] font-mono pt-4" style={{ color: 'var(--color-text-muted)' }}>
        Leaderboard updates in real-time • {activeTab === 'today' ? 'Performance ranks based on today\'s gameplay score.' : 'Prestige score is based on collection size, rarity, and streak.'}
      </p>
    </div>
  );
}
