import React from 'react';
import type { JudgmentDisplay } from '@/game/types';

export const JudgmentBadge: React.FC<{ type: JudgmentDisplay['type']; scale?: number; className?: string }> = ({ type, scale = 1, className = "" }) => {
  if (type === "PERFECT+") {
    return (
      <svg
        width={145 * scale}
        height={36 * scale}
        viewBox="0 0 145 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`drop-shadow-[0_0_14px_rgba(255,215,0,0.9)] ${className}`}
      >
        <defs>
          <linearGradient id="pPlusGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFF7ED" />
            <stop offset="30%" stopColor="#FFD700" />
            <stop offset="70%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#92400E" />
          </linearGradient>
          <linearGradient id="pPlusGlow" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FFD700" stopOpacity="0" />
            <stop offset="50%" stopColor="#FFD700" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#FFD700" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Outer glowing base line */}
        <rect x="12" y="32" width="121" height="2" rx="1" fill="url(#pPlusGlow)" />
        
        {/* Left & Right Radiant Diamond Starbursts */}
        <path d="M 12 18 L 14 14 L 18 12 L 14 10 L 12 6 L 10 10 L 6 12 L 10 14 Z" fill="#FFF7ED" />
        <path d="M 133 18 L 135 14 L 139 12 L 135 10 L 133 6 L 131 10 L 127 12 L 131 14 Z" fill="#FFF7ED" />

        {/* Text PERFECT+ */}
        <text
          x="72.5"
          y="23"
          textAnchor="middle"
          fill="url(#pPlusGrad)"
          stroke="#FFFFFF"
          strokeWidth="0.6"
          fontFamily="'Space Mono', 'Impact', sans-serif"
          fontWeight="900"
          fontSize="17"
          letterSpacing="0.14em"
        >
          PERFECT+
        </text>
      </svg>
    );
  }

  if (type === "PERFECT") {
    return (
      <svg
        width={132 * scale}
        height={32 * scale}
        viewBox="0 0 132 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`drop-shadow-[0_0_12px_rgba(57,255,20,0.85)] ${className}`}
      >
        <defs>
          <linearGradient id="perfGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#F7FEE7" />
            <stop offset="40%" stopColor="#39FF14" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
        </defs>

        {/* Sleek bracket wings */}
        <path d="M 8 6 L 2 16 L 8 26" stroke="#39FF14" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M 124 6 L 130 16 L 124 26" stroke="#39FF14" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        <text
          x="66"
          y="21"
          textAnchor="middle"
          fill="url(#perfGrad)"
          fontFamily="'Space Mono', 'Impact', sans-serif"
          fontWeight="900"
          fontSize="15"
          letterSpacing="0.16em"
        >
          PERFECT
        </text>
      </svg>
    );
  }

  if (type === "GOOD") {
    return (
      <svg
        width={105 * scale}
        height={28 * scale}
        viewBox="0 0 105 28"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`drop-shadow-[0_0_10px_rgba(0,229,255,0.8)] ${className}`}
      >
        <defs>
          <linearGradient id="goodGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#E0F2FE" />
            <stop offset="50%" stopColor="#00E5FF" />
            <stop offset="100%" stopColor="#0284C7" />
          </linearGradient>
        </defs>

        {/* Top & Bottom Cyber Accent Dashed Bars */}
        <line x1="12" y1="3" x2="93" y2="3" stroke="#00E5FF" strokeWidth="1.5" strokeDasharray="5 3" />
        <line x1="12" y1="25" x2="93" y2="25" stroke="#00E5FF" strokeWidth="1.5" strokeDasharray="5 3" />

        <text
          x="52.5"
          y="19"
          textAnchor="middle"
          fill="url(#goodGrad)"
          fontFamily="'Space Mono', 'Impact', sans-serif"
          fontWeight="900"
          fontSize="14"
          letterSpacing="0.18em"
        >
          GOOD
        </text>
      </svg>
    );
  }

  if (type === "SHIELDED") {
    return (
      <svg
        width={120 * scale}
        height={30 * scale}
        viewBox="0 0 120 30"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`drop-shadow-[0_0_10px_rgba(0,255,221,0.8)] ${className}`}
      >
        <path d="M 12 6 L 18 6 L 18 16 C 18 20 12 24 12 24 C 12 24 6 20 6 16 L 6 6 Z" fill="#00FFDD" opacity="0.3" stroke="#00FFDD" strokeWidth="1.5" />
        <text
          x="65"
          y="20"
          textAnchor="middle"
          fill="#00FFDD"
          fontFamily="'Space Mono', sans-serif"
          fontWeight="900"
          fontSize="12"
          letterSpacing="0.12em"
        >
          SHIELDED
        </text>
      </svg>
    );
  }

  // MISS
  return (
    <svg
      width={100 * scale}
      height={28 * scale}
      viewBox="0 0 100 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`drop-shadow-[0_0_12px_rgba(255,20,147,0.9)] ${className}`}
    >
      <text
        x="50"
        y="19"
        textAnchor="middle"
        fill="#FF1493"
        stroke="#FF003C"
        strokeWidth="0.5"
        fontFamily="'Space Mono', 'Impact', sans-serif"
        fontWeight="900"
        fontSize="14"
        letterSpacing="0.2em"
      >
        MISS
      </text>
    </svg>
  );
};

export function getJudgmentBadgeSvgHtml(type: JudgmentDisplay['type'], scale = 1, idSuffix: number | string = ''): string {
  if (type === "PERFECT+") {
    return `<svg width="${145 * scale}" height="${36 * scale}" viewBox="0 0 145 36" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 0 14px rgba(255,215,0,0.9));">
      <defs>
        <linearGradient id="pPlusGrad_${idSuffix}" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#FFF7ED" />
          <stop offset="30%" stop-color="#FFD700" />
          <stop offset="70%" stop-color="#F59E0B" />
          <stop offset="100%" stop-color="#92400E" />
        </linearGradient>
        <linearGradient id="pPlusGlow_${idSuffix}" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#FFD700" stop-opacity="0" />
          <stop offset="50%" stop-color="#FFD700" stop-opacity="0.8" />
          <stop offset="100%" stop-color="#FFD700" stop-opacity="0" />
        </linearGradient>
      </defs>
      <rect x="12" y="32" width="121" height="2" rx="1" fill="url(#pPlusGlow_${idSuffix})" />
      <path d="M 12 18 L 14 14 L 18 12 L 14 10 L 12 6 L 10 10 L 6 12 L 10 14 Z" fill="#FFF7ED" />
      <path d="M 133 18 L 135 14 L 139 12 L 135 10 L 133 6 L 131 10 L 127 12 L 131 14 Z" fill="#FFF7ED" />
      <text x="72.5" y="23" text-anchor="middle" fill="url(#pPlusGrad_${idSuffix})" stroke="#FFFFFF" stroke-width="0.6" font-family="'Space Mono', 'Impact', sans-serif" font-weight="900" font-size="17" letter-spacing="0.14em">PERFECT+</text>
    </svg>`;
  }
  if (type === "PERFECT") {
    return `<svg width="${132 * scale}" height="${32 * scale}" viewBox="0 0 132 32" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 0 12px rgba(57,255,20,0.85));">
      <defs>
        <linearGradient id="perfGrad_${idSuffix}" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#F7FEE7" />
          <stop offset="40%" stop-color="#39FF14" />
          <stop offset="100%" stop-color="#059669" />
        </linearGradient>
      </defs>
      <path d="M 8 6 L 2 16 L 8 26" stroke="#39FF14" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M 124 6 L 130 16 L 124 26" stroke="#39FF14" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
      <text x="66" y="21" text-anchor="middle" fill="url(#perfGrad_${idSuffix})" font-family="'Space Mono', 'Impact', sans-serif" font-weight="900" font-size="15" letter-spacing="0.16em">PERFECT</text>
    </svg>`;
  }
  if (type === "GOOD") {
    return `<svg width="${105 * scale}" height="${28 * scale}" viewBox="0 0 105 28" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 0 10px rgba(0,229,255,0.8));">
      <defs>
        <linearGradient id="goodGrad_${idSuffix}" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#E0F2FE" />
          <stop offset="50%" stop-color="#00E5FF" />
          <stop offset="100%" stop-color="#0284C7" />
        </linearGradient>
      </defs>
      <line x1="12" y1="3" x2="93" y2="3" stroke="#00E5FF" stroke-width="1.5" stroke-dasharray="5 3" />
      <line x1="12" y1="25" x2="93" y2="25" stroke="#00E5FF" stroke-width="1.5" stroke-dasharray="5 3" />
      <text x="52.5" y="19" text-anchor="middle" fill="url(#goodGrad_${idSuffix})" font-family="'Space Mono', 'Impact', sans-serif" font-weight="900" font-size="14" letter-spacing="0.18em">GOOD</text>
    </svg>`;
  }
  if (type === "SHIELDED") {
    return `<svg width="${120 * scale}" height="${30 * scale}" viewBox="0 0 120 30" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 0 10px rgba(0,255,221,0.8));">
      <path d="M 12 6 L 18 6 L 18 16 C 18 20 12 24 12 24 C 12 24 6 20 6 16 L 6 6 Z" fill="#00FFDD" opacity="0.3" stroke="#00FFDD" stroke-width="1.5" />
      <text x="65" y="20" text-anchor="middle" fill="#00FFDD" font-family="'Space Mono', sans-serif" font-weight="900" font-size="12" letter-spacing="0.12em">SHIELDED</text>
    </svg>`;
  }
  return `<svg width="${100 * scale}" height="${28 * scale}" viewBox="0 0 100 28" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 0 12px rgba(255,20,147,0.9));">
    <text x="50" y="19" text-anchor="middle" fill="#FF1493" stroke="#FF003C" stroke-width="0.5" font-family="'Space Mono', 'Impact', sans-serif" font-weight="900" font-size="14" letter-spacing="0.2em">MISS</text>
  </svg>`;
}

export function getJudgmentStreamItemHtml(type: JudgmentDisplay['type'], _lane: number): string {
  let color = '#39FF14';
  let label = 'PF';
  let bg = 'rgba(57,255,20,0.22)';
  let border = '1px solid rgba(57,255,20,0.65)';
  let shadow = '0 0 6px rgba(57,255,20,0.35)';

  if (type === 'PERFECT+') {
    color = '#FFD700';
    label = 'P+';
    bg = 'rgba(255,215,0,0.26)';
    border = '1px solid rgba(255,215,0,0.75)';
    shadow = '0 0 8px rgba(255,215,0,0.45)';
  } else if (type === 'PERFECT') {
    color = '#39FF14';
    label = 'PF';
    bg = 'rgba(57,255,20,0.22)';
    border = '1px solid rgba(57,255,20,0.65)';
    shadow = '0 0 6px rgba(57,255,20,0.35)';
  } else if (type === 'GOOD') {
    color = '#00E5FF';
    label = 'GD';
    bg = 'rgba(0,229,255,0.22)';
    border = '1px solid rgba(0,229,255,0.65)';
    shadow = '0 0 6px rgba(0,229,255,0.35)';
  } else if (type === 'SHIELDED') {
    color = '#E879F9';
    label = 'SH';
    bg = 'rgba(232,121,249,0.22)';
    border = '1px solid rgba(232,121,249,0.65)';
    shadow = '0 0 6px rgba(232,121,249,0.35)';
  } else if (type === 'MISS') {
    color = '#FF0055';
    label = 'MS';
    bg = 'rgba(255,0,85,0.26)';
    border = '1px solid rgba(255,0,85,0.75)';
    shadow = '0 0 8px rgba(255,0,85,0.45)';
  }

  return `<div class="flex items-center justify-center rounded-[3px] backdrop-blur-sm select-none" style="width:26px;height:18px;background:${bg};border:${border};box-shadow:${shadow};">
    <span class="font-mono text-[9px] font-black tracking-tight leading-none text-center" style="color:${color};text-shadow:0 0 5px ${color};">${label}</span>
  </div>`;
}

export default JudgmentBadge;
