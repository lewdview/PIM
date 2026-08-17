import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface LogoMeta {
  id: string;
  name: string;
  src: string;
  accent: string;
  glow: string;
  kanji: string;
}

export const MAIN_LOGOS: LogoMeta[] = [
  {
    id: 'sakura_pagoda',
    name: 'Sakura Pagoda & Crimson Sun',
    src: '/data/logos/logo_1_sakura.png',
    accent: '#ff3366',
    glow: 'rgba(255, 51, 102, 0.55)',
    kanji: '詩の動き',
  },
  {
    id: 'red_beast',
    name: 'Red Wolf Fury',
    src: '/data/logos/logo_2_red_beast.png',
    accent: '#ff1438',
    glow: 'rgba(255, 20, 56, 0.55)',
    kanji: '詩の動き',
  },
  {
    id: 'ninja_katana',
    name: 'Katana Ninja Sunset',
    src: '/data/logos/logo_3_ninja_katana.png',
    accent: '#ff6600',
    glow: 'rgba(255, 102, 0, 0.55)',
    kanji: '詩の動き',
  },
  {
    id: 'sea_dragon',
    name: 'Azure Sea Dragon Crest',
    src: '/data/logos/logo_4_sea_dragon.png',
    accent: '#00e5ff',
    glow: 'rgba(0, 229, 255, 0.55)',
    kanji: '詩の動き',
  },
];

interface MainBrandLogoProps {
  size?: 'nav' | 'sm' | 'md' | 'lg' | 'hero';
  showGlow?: boolean;
  intervalMs?: number;
  autoCycle?: boolean;
  className?: string;
  interactive?: boolean;
  priority?: boolean;
  onLogoChange?: (logo: LogoMeta) => void;
}

const SIZE_CONFIGS = {
  nav: {
    containerClass: 'h-10 w-auto min-w-[70px] max-w-[130px]',
    imgClass: 'h-10 w-auto object-contain',
    glowBlur: 'blur-[16px]',
    glowOpacity: '0.4',
  },
  sm: {
    containerClass: 'h-14 w-auto min-w-[100px] max-w-[170px]',
    imgClass: 'h-14 w-auto object-contain',
    glowBlur: 'blur-[20px]',
    glowOpacity: '0.45',
  },
  md: {
    containerClass: 'h-24 w-auto min-w-[180px] max-w-[280px]',
    imgClass: 'h-24 w-auto object-contain',
    glowBlur: 'blur-[32px]',
    glowOpacity: '0.5',
  },
  lg: {
    containerClass: 'h-32 sm:h-36 w-auto min-w-[240px] max-w-[380px]',
    imgClass: 'h-32 sm:h-36 w-auto object-contain',
    glowBlur: 'blur-[45px]',
    glowOpacity: '0.55',
  },
  hero: {
    containerClass: 'h-36 sm:h-44 md:h-52 w-full max-w-[460px] md:max-w-[540px]',
    imgClass: 'h-36 sm:h-44 md:h-52 w-auto object-contain',
    glowBlur: 'blur-[65px]',
    glowOpacity: '0.6',
  },
};

export default function MainBrandLogo({
  size = 'md',
  showGlow = true,
  intervalMs = 4200,
  autoCycle = true,
  className = '',
  interactive = true,
  priority = false,
  onLogoChange,
}: MainBrandLogoProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const activeLogo = MAIN_LOGOS[currentIndex];
  const sizeCfg = SIZE_CONFIGS[size] || SIZE_CONFIGS.md;

  const nextLogo = useCallback(() => {
    setCurrentIndex((prev) => {
      const next = (prev + 1) % MAIN_LOGOS.length;
      onLogoChange?.(MAIN_LOGOS[next]);
      return next;
    });
  }, [onLogoChange]);

  useEffect(() => {
    if (!autoCycle) return;
    const timer = setInterval(() => {
      nextLogo();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [autoCycle, intervalMs, nextLogo]);

  return (
    <div
      className={`relative flex items-center justify-center select-none ${sizeCfg.containerClass} ${
        interactive ? 'cursor-pointer group' : ''
      } ${className}`}
      onClick={interactive ? nextLogo : undefined}
      title={interactive ? `${activeLogo.name} (Click to switch)` : activeLogo.name}
    >
      {/* Dynamic Ambient Backlight Glow */}
      {showGlow && (
        <div
          className={`absolute inset-0 m-auto rounded-full pointer-events-none transition-all duration-700 ${sizeCfg.glowBlur}`}
          style={{
            background: `radial-gradient(circle, ${activeLogo.glow} 0%, transparent 75%)`,
            opacity: sizeCfg.glowOpacity,
            transform: 'scale(1.15)',
          }}
        />
      )}

      {/* Cross-fading Logo Image */}
      <AnimatePresence mode="wait">
        <motion.img
          key={activeLogo.id}
          src={activeLogo.src}
          alt={`PIM th3v4ult - ${activeLogo.name}`}
          className={`relative z-10 ${sizeCfg.imgClass} filter drop-shadow-[0_8px_20px_rgba(0,0,0,0.8)] transition-transform duration-300 ${
            interactive ? 'group-hover:scale-105 group-active:scale-95' : ''
          }`}
          initial={{ opacity: 0, scale: 0.94, filter: 'brightness(1.4) blur(4px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'brightness(1) blur(0px)' }}
          exit={{ opacity: 0, scale: 1.04, filter: 'brightness(0.8) blur(3px)' }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
        />
      </AnimatePresence>
    </div>
  );
}
