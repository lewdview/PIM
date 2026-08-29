import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

/**
 * MythicGodRays
 * Renders rotating celestial sunburst god-rays behind the card
 */
export function MythicGodRays({
  color = '#ffd700',
  className = '',
}: {
  color?: string;
  className?: string;
}) {
  return (
    <div
      className={`absolute -inset-10 pointer-events-none z-[-1] overflow-visible flex items-center justify-center ${className}`}
      style={{ willChange: 'transform, opacity' }}
    >
      {/* Primary 16-beam rotating sunburst */}
      <div
        className="w-[180%] h-[180%] rounded-full opacity-60"
        style={{
          background: `conic-gradient(
            from 0deg at 50% 50%,
            transparent 0deg,
            ${color}33 11.25deg,
            transparent 22.5deg,
            ${color}40 33.75deg,
            transparent 45deg,
            ${color}33 56.25deg,
            transparent 67.5deg,
            ${color}40 78.75deg,
            transparent 90deg,
            ${color}33 101.25deg,
            transparent 112.5deg,
            ${color}40 123.75deg,
            transparent 135deg,
            ${color}33 146.25deg,
            transparent 157.5deg,
            ${color}40 168.75deg,
            transparent 180deg,
            ${color}33 191.25deg,
            transparent 202.5deg,
            ${color}40 213.75deg,
            transparent 225deg,
            ${color}33 236.25deg,
            transparent 247.5deg,
            ${color}40 258.75deg,
            transparent 270deg,
            ${color}33 281.25deg,
            transparent 292.5deg,
            ${color}40 303.75deg,
            transparent 315deg,
            ${color}33 326.25deg,
            transparent 337.5deg,
            ${color}40 348.75deg,
            transparent 360deg
          )`,
          animation: 'mythic-godrays-spin 24s linear infinite',
          maskImage: 'radial-gradient(circle at center, black 25%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(circle at center, black 25%, transparent 70%)',
          filter: 'blur(3px)',
        }}
      />

      {/* Secondary reverse counter-rotation warm aura */}
      <div
        className="w-[160%] h-[160%] rounded-full opacity-40"
        style={{
          background: `conic-gradient(
            from 180deg at 50% 50%,
            transparent 0deg,
            rgba(255, 0, 127, 0.25) 30deg,
            transparent 60deg,
            ${color}35 90deg,
            transparent 120deg,
            rgba(0, 240, 255, 0.2) 150deg,
            transparent 180deg,
            rgba(255, 0, 127, 0.25) 210deg,
            transparent 240deg,
            ${color}35 270deg,
            transparent 300deg,
            rgba(0, 240, 255, 0.2) 330deg,
            transparent 360deg
          )`,
          animation: 'mythic-godrays-spin 18s linear infinite reverse',
          maskImage: 'radial-gradient(circle at center, black 20%, transparent 65%)',
          WebkitMaskImage: 'radial-gradient(circle at center, black 20%, transparent 65%)',
          filter: 'blur(6px)',
        }}
      />

      {/* Deep Center Pulse Glow */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle at center, ${color}45 0%, rgba(255,140,0,0.2) 40%, transparent 75%)`,
          filter: 'blur(20px)',
          animation: 'mythic-ray-pulse 3s ease-in-out infinite alternate',
        }}
      />
    </div>
  );
}

/**
 * MythicEmberParticles
 * Generates floating golden cosmic stardust embers drifting upward
 */
export function MythicEmberParticles({ count = 16 }: { count?: number }) {
  const particles = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      left: `${5 + Math.random() * 90}%`,
      size: 2 + Math.random() * 3.5,
      delay: Math.random() * 4,
      duration: 3 + Math.random() * 3.5,
      opacity: 0.4 + Math.random() * 0.6,
      drift: (Math.random() - 0.5) * 20,
    }));
  }, [count]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-25 rounded-xl">
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: p.left,
            bottom: '-10px',
            width: `${p.size}px`,
            height: `${p.size}px`,
            background: 'radial-gradient(circle, #ffffff 10%, #ffd700 80%, rgba(255,215,0,0) 100%)',
            boxShadow: '0 0 6px #ffd700, 0 0 12px rgba(255,215,0,0.8)',
            animation: `mythic-particle-rise ${p.duration}s ease-in-out infinite`,
            animationDelay: `${p.delay}s`,
            opacity: p.opacity,
            ['--drift' as any]: `${p.drift}px`,
          }}
        />
      ))}
    </div>
  );
}

/**
 * MythicPrismFoil
 * Holographic rainbow diffraction foil sweeps
 */
export function MythicPrismFoil() {
  return (
    <>
      {/* Primary Chromatic Foil Sweep */}
      <div
        className="absolute inset-0 pointer-events-none z-15"
        style={{
          background: 'linear-gradient(120deg, rgba(255,0,120,0.18) 0%, rgba(255,180,0,0.24) 25%, rgba(0,255,160,0.18) 50%, rgba(60,0,255,0.22) 75%, rgba(255,0,120,0.18) 100%)',
          backgroundSize: '300% 100%',
          animation: 'foil-sweep 3s linear infinite',
          mixBlendMode: 'screen',
        }}
      />
      {/* Secondary Counter Angle Shimmer */}
      <div
        className="absolute inset-0 pointer-events-none z-15"
        style={{
          background: 'linear-gradient(60deg, rgba(0,200,255,0.15) 0%, rgba(255,80,0,0.2) 33%, rgba(180,0,255,0.15) 66%, rgba(0,200,255,0.15) 100%)',
          backgroundSize: '200% 100%',
          animation: 'foil-sweep 2.2s linear infinite reverse',
          mixBlendMode: 'color-dodge',
          opacity: 0.85,
        }}
      />
      {/* Diagonal Light Streak */}
      <div
        className="absolute inset-0 pointer-events-none z-16"
        style={{
          background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.3) 45%, rgba(255,215,0,0.4) 50%, transparent 60%)',
          backgroundSize: '250% 100%',
          animation: 'foil-sweep 4s ease-in-out infinite',
          mixBlendMode: 'overlay',
        }}
      />
    </>
  );
}

/**
 * MythicCrownBadge
 * Luminous top badge for Mythic cards
 */
export function MythicCrownBadge() {
  return (
    <div
      style={{
        padding: '3px 10px',
        background: 'linear-gradient(135deg, rgba(255,215,0,0.3) 0%, rgba(20,15,5,0.9) 100%)',
        border: '1.5px solid #ffd700',
        borderRadius: '4px',
        boxShadow: '0 0 16px rgba(255,215,0,0.6), inset 0 0 8px rgba(255,215,0,0.3)',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
      }}
    >
      <span style={{ fontSize: '9px', color: '#ffd700', animation: 'spin-slow 6s linear infinite' }}>✦</span>
      <span
        style={{
          fontFamily: '"Impact", "Arial Black", "JetBrains Mono", sans-serif',
          fontSize: '8.5px',
          fontWeight: 900,
          letterSpacing: '0.18em',
          color: '#ffd700',
          textShadow: '0 0 10px rgba(255,215,0,0.9)',
          textTransform: 'uppercase',
        }}
      >
        MYTHIC
      </span>
      <span style={{ fontSize: '9px', color: '#ffd700', animation: 'spin-slow 6s linear infinite reverse' }}>✦</span>
    </div>
  );
}

export default function MythicCardEffects({
  showGodRays = true,
  showEmbers = true,
  showFoil = true,
}: {
  showGodRays?: boolean;
  showEmbers?: boolean;
  showFoil?: boolean;
}) {
  return (
    <>
      {showGodRays && <MythicGodRays />}
      {showFoil && <MythicPrismFoil />}
      {showEmbers && <MythicEmberParticles count={14} />}
    </>
  );
}
