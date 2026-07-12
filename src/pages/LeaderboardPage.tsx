import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Medal, Crown, Star } from 'lucide-react';
import { useVaultStore } from '../store/useVaultStore';
import { useAuthStore } from '../store/useAuthStore';
import { RARITY_CONFIG } from '../utils/rarity';
import { supabase } from '../services/supabaseClient';
import { Link } from 'wouter';

interface LeaderEntry {
  id: string;
  rank: number;
  name: string;
  uniqueCards: number;
  totalCards: number;
  rarityScore: number;
  topRarity: string;
  isYou: boolean;
}

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLeaderboard(showLoading = false) {
      try {
        if (showLoading) {
          setLoading(true);
        }
        // 1. Fetch all profiles using pagination to bypass PostgREST query row limit
        let profiles: any[] = [];
        let pPage = 0;
        const P_PAGE_SIZE = 1000;
        let pHasMore = true;

        while (pHasMore) {
          const { data, error } = await supabase
            .from('profiles')
            .select('id, wallet_address, streak_count, total_pulls')
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

        // 2. Fetch all collections using pagination to bypass PostgREST query row limit
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

        const authUser = useAuthStore.getState().user;

        // 3. Map collections by owner_id
        const collectionsByOwner: Record<string, typeof collections> = {};
        for (const col of collections || []) {
          if (!collectionsByOwner[col.owner_id]) {
            collectionsByOwner[col.owner_id] = [];
          }
          collectionsByOwner[col.owner_id].push(col);
        }

        // 4. Calculate score for each profile
        const mappedEntries: LeaderEntry[] = (profiles || []).map((prof) => {
          const userCols = collectionsByOwner[prof.id] || [];
          const uniqueCards = new Set(userCols.map(c => c.card_id)).size;
          const totalCards = userCols.length;

          // Calculate score
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

          // Format Display Name
          let name = 'ANONYMOUS';
          if (prof.wallet_address) {
            const wa = prof.wallet_address;
            name = `${wa.slice(0, 6)}...${wa.slice(-4)}`;
          } else {
            name = `ANON_${prof.id.slice(0, 6)}`;
          }

          const isYou = authUser ? authUser.id === prof.id : false;
          if (isYou) {
            name = `${name} (YOU)`;
          }

          return {
            id: prof.id,
            rank: 0,
            name: name.toUpperCase(),
            uniqueCards,
            totalCards,
            rarityScore: score,
            topRarity,
            isYou,
          };
        });

        // 5. Sort and rank
        mappedEntries.sort((a, b) => b.rarityScore - a.rarityScore);
        mappedEntries.forEach((entry, idx) => {
          entry.rank = idx + 1;
        });

        setEntries(mappedEntries);
      } catch (err) {
        console.error("Failed to load real leaderboard:", err);
      } finally {
        if (showLoading) {
          setLoading(false);
        }
      }
    }

    fetchLeaderboard(true);

    // Set up realtime channel subscriptions to database events
    const channel = supabase
      .channel('leaderboard-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vault_collections' },
        () => {
          fetchLeaderboard(false);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => {
          fetchLeaderboard(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const yourEntry = entries.find(e => e.isYou);

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown size={16} style={{ color: 'var(--color-neon-gold)' }} />;
    if (rank === 2) return <Medal size={16} style={{ color: '#c0c0c0' }} />;
    if (rank === 3) return <Medal size={16} style={{ color: '#cd7f32' }} />;
    return <span className="text-xs font-mono w-4 text-center" style={{ color: 'var(--color-text-muted)' }}>{rank}</span>;
  };

  return (
    <div className="flex-1 px-4 md:px-8 pt-4 pb-10 max-w-4xl mx-auto w-full space-y-8 etching-bg">
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
        <div className="mx-auto w-24 h-1 bg-neon-gold/30 rounded-full" />
        <p className="text-[10px] font-mono uppercase tracking-[0.3em] opacity-40">
          Global Collector Integrity Ranking
        </p>
      </motion.div>

      {/* Your rank card */}
      {yourEntry && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="relative"
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
                 <div className="text-[10px] font-black uppercase opacity-60">
                  {yourEntry.uniqueCards} UNIQUE • {yourEntry.rarityScore} ECHO SCORE
                </div>
              </div>
            </div>
            <Star size={24} className="fill-black opacity-20" />
          </div>
        </motion.div>
      )}

      {/* Leaderboard table */}
      {loading ? (
        <div className="text-center py-12 text-xs font-mono opacity-50">
          Syncing with Base network...
        </div>
      ) : (
        <div className="space-y-1.5">
          {entries.map((entry, i) => {
            const Wrapper = entry.isYou ? 'div' : Link;
            const wrapperProps = entry.isYou ? {} : { to: `/vault/${entry.id}` };
            
            return (
              <motion.div
                key={entry.name}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 * i }}
              >
                <Wrapper
                  {...wrapperProps as any}
                  className={`flex items-center gap-3 px-4 py-3 border-b border-white/5 transition-all ${
                    entry.isYou ? 'bg-white/5' : 'hover:bg-white/5 hover:translate-x-1 hover:border-yellow-500/30 group'
                  }`}
                >
                  {/* Rank */}
                  <div className="w-6 flex-shrink-0 flex justify-center">
                    {getRankIcon(entry.rank)}
                  </div>

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <span
                      className={`text-sm font-mono ${entry.isYou ? 'font-bold' : ''}`}
                      style={{
                        color: entry.isYou ? 'var(--color-neon-yellow)' : 'var(--color-text-primary)',
                      }}
                    >
                      {entry.name}
                    </span>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 text-xs font-mono">
                    <div className="text-right hidden sm:block">
                      <span style={{ color: 'var(--color-text-muted)' }}>{entry.uniqueCards}</span>
                      <span className="ml-0.5" style={{ color: 'var(--color-text-muted)' }}>unique</span>
                    </div>
                    <div
                      className="text-right font-bold min-w-[50px]"
                      style={{
                        color: entry.rank <= 3
                          ? RARITY_CONFIG[entry.topRarity as keyof typeof RARITY_CONFIG]?.color || 'var(--color-text-primary)'
                          : 'var(--color-text-secondary)',
                      }}
                    >
                      {entry.rarityScore}
                      <span className="text-[10px] ml-0.5" style={{ color: 'var(--color-text-muted)' }}>score</span>
                    </div>
                  </div>
                </Wrapper>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Footer note */}
      <p className="text-center text-[10px] font-mono pt-4" style={{ color: 'var(--color-text-muted)' }}>
        Leaderboard updates in real-time • Rank score is based on the dynamic Echo Prestige Score formula.
      </p>
    </div>
  );
}
