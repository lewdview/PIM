import React from 'react';
import { Crown, Medal } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'wouter';
import { getIdenticon } from '../utils/identicon';
import { RARITY_CONFIG } from '../utils/rarity';

interface LeaderboardRowProps {
  rank: number;
  avatarUrl: string | null;
  displayName: string;
  score: number;
  isYou: boolean;
  topRarity?: string;
  onClick?: () => void;
  subtitle?: string;
  userId: string;
  scoreLabel?: string;
  animationDelay?: number;
}

export const LeaderboardRow: React.FC<LeaderboardRowProps> = ({
  rank,
  avatarUrl,
  displayName,
  score,
  isYou,
  topRarity,
  onClick,
  subtitle,
  userId,
  scoreLabel,
  animationDelay = 0,
}) => {
  const { initials, bgColor } = getIdenticon(userId, displayName);

  const getRankDisplay = () => {
    switch (rank) {
      case 1:
        return <Crown size={16} color="#FFD700" />;
      case 2:
        return <Medal size={16} color="#C0C0C0" />;
      case 3:
        return <Medal size={16} color="#CD7F32" />;
      default:
        return rank;
    }
  };

  const getAvatarClass = () => {
    if (rank === 1) return 'leaderboard-avatar rank-1';
    if (rank === 2) return 'leaderboard-avatar rank-2';
    if (rank === 3) return 'leaderboard-avatar rank-3';
    return 'leaderboard-avatar';
  };

  const content = (
    <motion.div
      initial={{ opacity: 0, x: -15 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: animationDelay, duration: 0.3 }}
      className={`leaderboard-row ${isYou ? 'is-you' : ''}`}
      onClick={onClick}
    >
      <div className="leaderboard-rank">{getRankDisplay()}</div>
      
      <div className={getAvatarClass()}>
        {avatarUrl ? (
          <img src={avatarUrl} alt={displayName} />
        ) : (
          <div className="leaderboard-avatar-identicon" style={{ backgroundColor: bgColor }}>
            {initials}
          </div>
        )}
      </div>

      <div className="leaderboard-name">
        <div className={`leaderboard-name-text ${isYou ? 'is-you' : ''}`}>
          {displayName}{isYou ? ' (YOU)' : ''}
        </div>
        {subtitle && <div className="leaderboard-name-sub">{subtitle}</div>}
      </div>

      <div className="leaderboard-score">
        {score.toLocaleString()}
        {scoreLabel && <span className="leaderboard-score-label">{scoreLabel}</span>}
      </div>
    </motion.div>
  );

  if (!onClick && !isYou) {
    return <Link href={`/vault/${userId}`}>{content}</Link>;
  }

  return content;
};

export default LeaderboardRow;
