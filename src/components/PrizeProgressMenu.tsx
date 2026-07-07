import { useState } from 'react';
import { useVaultStore } from '../store/useVaultStore';
import PrizeRibbonSvg from './ui/PrizeRibbonSvg';

interface PrizeProgressMenuProps {
  songId: string;
}

export default function PrizeProgressMenu({ songId }: PrizeProgressMenuProps) {
  const claimedRewards = useVaultStore((s) => s.claimedRewards);
  const songClaimed = claimedRewards[songId] || [];
  const [expanded, setExpanded] = useState(false);

  const REWARD_TIERS = [
    { id: 'free', label: 'Free Play', desc: 'Preview tier unlocked' },
    { id: 'taste', label: 'First Taste', desc: '15s fragment completed' },
    { id: 'special_picks', label: 'Special Picks', desc: 'Special curation reward' },
    { id: 'alpha', label: 'Alpha Stage', desc: '80% stage completion' },
    { id: 'prophecy', label: 'Prophecy', desc: '100% fragments collected' },
  ];

  const claimedCount = REWARD_TIERS.filter(
    (t) =>
      songClaimed.includes(t.id) ||
      localStorage.getItem(`reward_tier_${songId}`) === t.id ||
      (t.id === 'prophecy' && localStorage.getItem(`reward_tier_${songId}`) === 'prophecy')
  ).length;

  return (
    <div className="border border-white/10 bg-white/[0.02] rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3.5 flex items-center justify-between font-mono text-[10px] font-bold uppercase tracking-wider text-white/80 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <PrizeRibbonSvg size={14} isClaimed={claimedCount > 0} />
          <span>Vault Prizes Status ({claimedCount} / 5 Claimed)</span>
        </div>
        <span className="text-white/40">{expanded ? '▲ Hide Details' : '▼ View Remaining'}</span>
      </button>

      {expanded && (
        <div className="p-4 border-t border-white/5 bg-black/20 space-y-3">
          {REWARD_TIERS.map((tier) => {
            const isClaimed =
              songClaimed.includes(tier.id) ||
              localStorage.getItem(`reward_tier_${tier.id}`) === tier.id ||
              localStorage.getItem(`reward_tier_${songId}`) === tier.id ||
              (tier.id === 'prophecy' && localStorage.getItem(`reward_tier_${songId}`) === 'prophecy');
            return (
              <div key={tier.id} className="flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-3">
                  <PrizeRibbonSvg size={16} isClaimed={isClaimed} />
                  <div className="text-left">
                    <div className={isClaimed ? "text-white font-bold" : "text-white/40"}>
                      {tier.label}
                    </div>
                    <div className="text-[9px] text-white/30 uppercase">{tier.desc}</div>
                  </div>
                </div>
                <div className={`text-[10px] font-black tracking-wider ${isClaimed ? "text-[#39FF14]" : "text-white/20"}`}>
                  {isClaimed ? "COLLECTED" : "REMAINING"}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
