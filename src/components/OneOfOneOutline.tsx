import React, { useId } from 'react';

interface OneOfOneOutlineProps {
  color?: string;
  glowColor?: string;
  speedSec?: number;
  text?: string;
  className?: string;
  showCornerDiodes?: boolean;
}

/**
 * OneOfOneOutline
 * Renders an animated kinetic text outline that travels continuously around
 * the 4 perimeter edges of a 3:4 card (clockwise), with glowing laser guide rails
 * and pulsating corner energy diodes.
 */
export default function OneOfOneOutline({
  color = '#ffd700',
  glowColor = 'rgba(255, 215, 0, 0.65)',
  speedSec = 14,
  text,
  className = '',
  showCornerDiodes = true,
}: OneOfOneOutlineProps) {
  const uniqueId = useId().replace(/:/g, '_');
  const pathId = `one-of-one-track-${uniqueId}`;

  // Default marquee string: repeating 1 OF 1 / ONE OF ONE / GENESIS / TH3VAULT
  const defaultText = text || '✦ ONE OF ONE ✦ 1 OF 1 ✦ GENESIS ✦ ONE OF ONE ✦ 1 OF 1 ✦ TH3VAULT ✦ ONE OF ONE ✦ 1 OF 1 ✦ GENESIS ✦ ONE OF ONE ✦ 1 OF 1 ✦ TH3VAULT ';
  // Double the string to guarantee no gaps when looping around the 1328px perimeter
  const repeatedText = `${defaultText} ${defaultText} `;

  // SVG perimeter path for 300x400 card with 14px corner radius and 6px inset
  // Top: (20,6)->(280,6), TR: (294,20), R: (294,380), BR: (280,394), B: (20,394), BL: (6,380), L: (6,20), TL: (20,6)
  const perimeterPath = 'M 20 6 H 280 A 14 14 0 0 1 294 20 V 380 A 14 14 0 0 1 280 394 H 20 A 14 14 0 0 1 6 380 V 20 A 14 14 0 0 1 20 6 Z';

  return (
    <div
      className={`absolute inset-0 pointer-events-none z-35 overflow-visible select-none ${className}`}
      style={{
        borderRadius: '12px',
        willChange: 'transform',
      }}
    >
      {/* Outer border glow bloom */}
      <div
        style={{
          position: 'absolute',
          inset: '-2px',
          borderRadius: '14px',
          boxShadow: `0 0 16px ${glowColor}, inset 0 0 8px ${glowColor}`,
          opacity: 0.85,
          animation: 'mythic-corona-pulse 2.8s ease-in-out infinite alternate',
          pointerEvents: 'none',
        }}
      />

      <svg
        viewBox="0 0 300 400"
        className="w-full h-full overflow-visible"
        style={{ display: 'block' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <path id={pathId} d={perimeterPath} />
          {/* Subtle gold drop-shadow for neon text */}
          <filter id={`glow-${uniqueId}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor={color} floodOpacity="0.9" />
          </filter>
        </defs>

        {/* 1. Underlying dark-tinted tape track behind text */}
        <path
          d={perimeterPath}
          fill="none"
          stroke="rgba(8, 6, 4, 0.88)"
          strokeWidth="15"
          strokeLinejoin="round"
        />

        {/* 2. Outer & Inner hairline laser rails */}
        <path
          d="M 20 2 H 280 A 18 18 0 0 1 298 20 V 380 A 18 18 0 0 1 280 398 H 20 A 18 18 0 0 1 2 380 V 20 A 18 18 0 0 1 20 2 Z"
          fill="none"
          stroke={color}
          strokeWidth="1.2"
          strokeOpacity="0.75"
        />
        <path
          d="M 20 10 H 280 A 10 10 0 0 1 290 20 V 380 A 10 10 0 0 1 280 390 H 20 A 10 10 0 0 1 10 380 V 20 A 10 10 0 0 1 20 10 Z"
          fill="none"
          stroke={color}
          strokeWidth="0.8"
          strokeOpacity="0.4"
        />

        {/* 3. High-voltage ticker text traveling continuously clockwise */}
        <text
          fill={color}
          fontFamily="'JetBrains Mono', 'Impact', sans-serif"
          fontSize="7.2"
          fontWeight="900"
          letterSpacing="1.8px"
          textRendering="geometricPrecision"
          filter={`url(#glow-${uniqueId})`}
          style={{ textTransform: 'uppercase' }}
        >
          <textPath href={`#${pathId}`} startOffset="0%">
            {repeatedText}
            {/* SVG SMIL animation for ultra-smooth 60fps loop across browsers */}
            <animate
              attributeName="startOffset"
              from="0%"
              to="100%"
              dur={`${speedSec}s`}
              repeatCount="indefinite"
            />
          </textPath>
        </text>

        {/* Second layered offset to prevent any wrap blip */}
        <text
          fill={color}
          fontFamily="'JetBrains Mono', 'Impact', sans-serif"
          fontSize="7.2"
          fontWeight="900"
          letterSpacing="1.8px"
          textRendering="geometricPrecision"
          filter={`url(#glow-${uniqueId})`}
          style={{ textTransform: 'uppercase' }}
        >
          <textPath href={`#${pathId}`} startOffset="-100%">
            {repeatedText}
            <animate
              attributeName="startOffset"
              from="-100%"
              to="0%"
              dur={`${speedSec}s`}
              repeatCount="indefinite"
            />
          </textPath>
        </text>
      </svg>

      {/* 4. Corner Energy Diodes / Bracket Accents */}
      {showCornerDiodes && (
        <>
          {/* Top-Left */}
          <div
            style={{
              position: 'absolute',
              top: '2px',
              left: '2px',
              width: '12px',
              height: '12px',
              borderTop: `2.5px solid ${color}`,
              borderLeft: `2.5px solid ${color}`,
              boxShadow: `0 0 8px ${color}`,
            }}
          />
          {/* Top-Right */}
          <div
            style={{
              position: 'absolute',
              top: '2px',
              right: '2px',
              width: '12px',
              height: '12px',
              borderTop: `2.5px solid ${color}`,
              borderRight: `2.5px solid ${color}`,
              boxShadow: `0 0 8px ${color}`,
            }}
          />
          {/* Bottom-Left */}
          <div
            style={{
              position: 'absolute',
              bottom: '2px',
              left: '2px',
              width: '12px',
              height: '12px',
              borderBottom: `2.5px solid ${color}`,
              borderLeft: `2.5px solid ${color}`,
              boxShadow: `0 0 8px ${color}`,
            }}
          />
          {/* Bottom-Right */}
          <div
            style={{
              position: 'absolute',
              bottom: '2px',
              right: '2px',
              width: '12px',
              height: '12px',
              borderBottom: `2.5px solid ${color}`,
              borderRight: `2.5px solid ${color}`,
              boxShadow: `0 0 8px ${color}`,
            }}
          />
        </>
      )}
    </div>
  );
}
