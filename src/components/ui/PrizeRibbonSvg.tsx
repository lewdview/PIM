import React from 'react';

export interface PrizeRibbonSvgProps {
  size?: number;
  isClaimed?: boolean;
  style?: React.CSSProperties;
  className?: string;
  tier?: 'free' | 'taste' | 'special_picks' | 'alpha' | 'prophecy';
}

export function PrizeRibbonSvg({ size = 16, isClaimed = true, style, className, tier = 'special_picks' }: PrizeRibbonSvgProps) {
  // If not claimed, display a clean grey outline representation
  if (!isClaimed) {
    return (
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 24 24" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg" 
        style={style} 
        className={className}
      >
        {/* Ribbon tails outline */}
        <path d="M9.5 14L7 21L12 18.5L14.5 15.5" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M14.5 14L17 21L12 18.5L9.5 15.5" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2" strokeLinejoin="round" />
        {/* Circle outline */}
        <circle cx="12" cy="9" r="6.5" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2" />
        {/* Inner star outline */}
        <path d="M12 6.5L13.1 8.8L15.6 9.1L13.8 10.9L14.2 13.4L12 12.2L9.8 13.4L10.2 10.9L8.4 9.1L10.9 8.8L12 6.5Z" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
      </svg>
    );
  }

  // Tier-specific coloring configuration
  const TIER_COLORS = {
    free: {
      ribbon: '#a05a2c', // Bronze-brown ribbons
      gradId: 'bronzeGrad',
      stops: (
        <>
          <stop offset="0%" stopColor="#f5b041" />
          <stop offset="50%" stopColor="#d35400" />
          <stop offset="100%" stopColor="#873a03" />
        </>
      )
    },
    taste: {
      ribbon: '#475569', // Slate silver-blue ribbons
      gradId: 'silverGrad',
      stops: (
        <>
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="50%" stopColor="#cbd5e1" />
          <stop offset="100%" stopColor="#64748b" />
        </>
      )
    },
    special_picks: {
      ribbon: '#dc2626', // Classic red ribbons
      gradId: 'goldGrad',
      stops: (
        <>
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="50%" stopColor="#eab308" />
          <stop offset="100%" stopColor="#a16207" />
        </>
      )
    },
    alpha: {
      ribbon: '#d946ef', // Neon magenta ribbons
      gradId: 'platinumGrad',
      stops: (
        <>
          <stop offset="0%" stopColor="#e0f2fe" />
          <stop offset="50%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0369a1" />
        </>
      )
    },
    prophecy: {
      ribbon: '#f97316', // Neon orange ribbons
      gradId: 'emeraldGrad',
      stops: (
        <>
          <stop offset="0%" stopColor="#ecfdf5" />
          <stop offset="50%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#064e3b" />
        </>
      )
    }
  };

  const currentTheme = TIER_COLORS[tier] || TIER_COLORS.special_picks;

  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg" 
      style={style} 
      className={className}
    >
      {/* Left ribbon tail */}
      <path d="M9.5 14L7 21L12 18.5L14.5 15.5" fill={currentTheme.ribbon} stroke="#000" strokeWidth="1.2" strokeLinejoin="round" />
      {/* Right ribbon tail */}
      <path d="M14.5 14L17 21L12 18.5L9.5 15.5" fill={currentTheme.ribbon} stroke="#000" strokeWidth="1.2" strokeLinejoin="round" />
      {/* Medal circle */}
      <circle cx="12" cy="9" r="6.5" fill={`url(#${currentTheme.gradId})`} stroke="#000" strokeWidth="1.2" />
      {/* Inner star detail */}
      <path d="M12 6.5L13.1 8.8L15.6 9.1L13.8 10.9L14.2 13.4L12 12.2L9.8 13.4L10.2 10.9L8.4 9.1L10.9 8.8L12 6.5Z" fill="#fff" />
      <defs>
        <radialGradient id={currentTheme.gradId} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" transform="translate(12 9) rotate(90) scale(6.5)">
          {currentTheme.stops}
        </radialGradient>
      </defs>
    </svg>
  );
}

export default PrizeRibbonSvg;
