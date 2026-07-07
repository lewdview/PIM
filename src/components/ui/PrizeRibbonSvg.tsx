import React from 'react';

export interface PrizeRibbonSvgProps {
  size?: number;
  isClaimed?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

export function PrizeRibbonSvg({ size = 16, isClaimed = true, style, className }: PrizeRibbonSvgProps) {
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
      <path d="M9.5 14L7 21L12 18.5L14.5 15.5" fill="#ff3b30" stroke="#000" strokeWidth="1.2" strokeLinejoin="round" />
      {/* Right ribbon tail */}
      <path d="M14.5 14L17 21L12 18.5L9.5 15.5" fill="#ff3b30" stroke="#000" strokeWidth="1.2" strokeLinejoin="round" />
      {/* Golden medal circle */}
      <circle cx="12" cy="9" r="6.5" fill="url(#goldGrad)" stroke="#000" strokeWidth="1.2" />
      {/* Inner star detail */}
      <path d="M12 6.5L13.1 8.8L15.6 9.1L13.8 10.9L14.2 13.4L12 12.2L9.8 13.4L10.2 10.9L8.4 9.1L10.9 8.8L12 6.5Z" fill="#fff" />
      <defs>
        <radialGradient id="goldGrad" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" transform="translate(12 9) rotate(90) scale(6.5)">
          <stop offset="0%" stopColor="#fff2a3" />
          <stop offset="50%" stopColor="#ffd700" />
          <stop offset="100%" stopColor="#c59b00" />
        </radialGradient>
      </defs>
    </svg>
  );
}

export default PrizeRibbonSvg;
