import { type Rarity, RARITY_CONFIG } from '../utils/rarity';

interface RarityBadgeProps {
  rarity: Rarity;
  size?: 'sm' | 'md' | 'lg';
}

export default function RarityBadge({ rarity, size = 'md' }: RarityBadgeProps) {
  const config = RARITY_CONFIG[rarity];
  const sizeClasses = {
    sm: 'text-[9px] min-h-[18px]',
    md: 'text-[11px] min-h-[22px]',
    lg: 'text-[13px] min-h-[28px]',
  };

  return (
    <span
      className={`sticker-gun-tag sticker-slits font-black uppercase tracking-tighter transition-all ${sizeClasses[size]}`}
      style={{
        background: `linear-gradient(${config.color}80, ${config.color}80), #ffffff`,
        color: '#000',
        transform: 'rotate(-1deg)',
        '--slit-color': `${config.color}25`,
        minWidth: size === 'sm' ? '60px' : size === 'md' ? '80px' : '100px',
        padding: size === 'sm' ? '2px 8px' : '4px 12px'
      } as any}
    >
      {config.label}
    </span>
  );
}
