import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Medal, Crown, Star } from 'lucide-react';
import { useVaultStore } from '../store/useVaultStore';
import { useAuthStore } from '../store/useAuthStore';
import { RARITY_CONFIG } from '../utils/rarity';
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

// Generate mock leaderboard data (in V2: pull from Supabase)
function generateLeaderboard(yourScore: number, yourUnique: number, user: any): LeaderEntry[] {
  const names = [
    'v0id_walker', 'neon_drift', 'signal_lost', 'dark_matter',
    'echo_chamber', 'static_monk', 'pulse_rider', 'glitch_saint',
    'data_ghost', 'byte_prophet', 'hex_oracle', 'null_sage',
    'cache_wraith', 'root_nomad', 'cloud_seeker',
  ];

  const entries: LeaderEntry[] = names.map((name, i) => {
    const base = 150 - i * 8;
    const uniqueCards = Math.max(5, base + Math.floor(Math.random() * 20));
    const totalCards = uniqueCards + Math.floor(Math.random() * 50);
    const rarityScore = uniqueCards * 3 + Math.floor(Math.random() * 100);

    return {
      id: crypto.randomUUID(),
      rank: 0,
      name,
      uniqueCards,
      totalCards,
      rarityScore,
      topRarity: ['mythic', 'legendary', 'legendary', 'rare', 'rare'][Math.min(i, 4)],
      isYou: false,
    };
  });

  let displayName = 'anonymous';
  if (user) {
    if (user.email) {
      const cleaned = user.email.split('@')[0];
      if (cleaned.startsWith('0x') && cleaned.length === 42) {
        displayName = `${cleaned.slice(0, 6)}...${cleaned.slice(-4)}`;
      } else {
        displayName = cleaned;
      }
    } else {
      displayName = `anon_${user.id.slice(0, 6)}`;
    }
  }

  // Add "you"
  entries.push({
    id: 'you',
    rank: 0,
    name: displayName.toUpperCase() + ' (YOU)',
    uniqueCards: yourUnique,
    totalCards: yourUnique,
    rarityScore: yourScore,
    topRarity: yourScore > 50 ? 'legendary' : yourScore > 20 ? 'rare' : 'uncommon',
    isYou: true,
  });

  // Sort by rarity score
  entries.sort((a, b) => b.rarityScore - a.rarityScore);
  entries.forEach((e, i) => { e.rank = i + 1; });

  return entries;
}

import { Link } from 'wouter';

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderEntry[]>([]);

  useEffect(() => {
    const collection = useVaultStore.getState().collection;
    const unique = new Set(collection.map(c => c.cardId)).size;
    const echoPrestigeScore = useVaultStore.getState().echoPrestigeScore;
    const user = useAuthStore.getState().user;
    setEntries(generateLeaderboard(echoPrestigeScore, unique, user));
  }, []);

  const yourEntry = entries.find(e => e.isYou);

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown size={16} style={{ color: 'var(--color-neon-gold)' }} />;
    if (rank === 2) return <Medal size={16} style={{ color: '#c0c0c0' }} />;
    if (rank === 3) return <Medal size={16} style={{ color: '#cd7f32' }} />;
    return <span className="text-xs font-mono w-4 text-center" style={{ color: 'var(--color-text-muted)' }}>{rank}</span>;
  };

  return (
    <div className="flex-1 px-4 md:px-8 py-10 max-w-4xl mx-auto w-full space-y-8 etching-bg">
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
                <span className="ml-0.5" style={{ color: 'var(--color-text-muted)' }}>cards</span>
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

      {/* Footer note */}
      <p className="text-center text-[10px] font-mono pt-4" style={{ color: 'var(--color-text-muted)' }}>
        Leaderboard updates in real-time • Rank score is based on the dynamic Echo Prestige Score formula.
      </p>
    </div>
  );
}
