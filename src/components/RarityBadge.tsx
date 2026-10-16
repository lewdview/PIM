import { type Rarity, RARITY_CONFIG } from '../utils/rarity';

interface RarityBadgeProps {
  rarity: Rarity;
  size?: 'sm' | 'md' | 'lg';
}

export default function RarityBadge({ rarity, size = 'md' }: RarityBadgeProps) {
  const config = RARITY_CONFIG[rarity];
  const sizeStyles = {
    sm: { fontSize: '8.5px', minHeight: '20px', padding: '3px 10px', minWidth: '64px' },
    md: { fontSize: '10.5px', minHeight: '24px', padding: '4px 13px', minWidth: '82px' },
    lg: { fontSize: '12.5px', minHeight: '28px', padding: '5px 16px', minWidth: '102px' },
  }[size];

  return (
    <span
      className="sticker-gun-tag sticker-slits font-black uppercase tracking-wider transition-all select-none"
      style={{
        background: `linear-gradient(180deg, ${config.color}95 0%, ${config.color}70 100%), #ffffff`,
        color: '#050402',
        transform: 'rotate(-0.75deg)',
        '--slit-color': `${config.color}28`,
        fontSize: sizeStyles.fontSize,
        minHeight: sizeStyles.minHeight,
        minWidth: sizeStyles.minWidth,
        padding: sizeStyles.padding,
        lineHeight: 1.1,
        letterSpacing: '0.08em',
        whiteSpace: 'nowrap',
        flexShrink: 0,
        border: '1px solid rgba(0,0,0,0.35)',
        boxShadow: `2px 2px 0 rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.65), 0 0 10px ${config.color}30`,
      } as any}
    >
      {config.label}
    </span>
  );
}
