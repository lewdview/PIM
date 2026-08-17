import { useState, useCallback } from 'react';
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
    glow: 'rgba(255, 51, 102, 0.6)',
    kanji: '詩の動き',
  },
  {
    id: 'red_beast',
    name: 'Red Wolf Fury',
    src: '/data/logos/logo_2_red_beast.png',
    accent: '#ff1438',
    glow: 'rgba(255, 20, 56, 0.6)',
    kanji: '詩の動き',
  },
  {
    id: 'ninja_katana',
    name: 'Katana Ninja Sunset',
    src: '/data/logos/logo_3_ninja_katana.png',
    accent: '#ff6600',
    glow: 'rgba(255, 102, 0, 0.6)',
    kanji: '詩の動き',
  },
  {
    id: 'sea_dragon',
    name: 'Azure Sea Dragon Crest',
    src: '/data/logos/logo_4_sea_dragon.png',
    accent: '#00e5ff',
    glow: 'rgba(0, 229, 255, 0.6)',
    kanji: '詩の動き',
  },
];

// Pick one of the 4 logos on load and keep it consistent across session
function getLoadedLogoIndex(): number {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const cached = sessionStorage.getItem('pim_session_logo_index');
      if (cached !== null) {
        const idx = parseInt(cached, 10);
        if (!isNaN(idx) && idx >= 0 && idx < MAIN_LOGOS.length) {
          return idx;
        }
      }
      const rand = Math.floor(Math.random() * MAIN_LOGOS.length);
      sessionStorage.setItem('pim_session_logo_index', rand.toString());
      return rand;
    } catch {
      return 0;
    }
  }
  return 0;
}

interface MainBrandLogoProps {
  size?: 'nav' | 'sm' | 'md' | 'lg' | 'hero';
  showGlow?: boolean;
  className?: string;
  interactive?: boolean;
  priority?: boolean;
  onLogoChange?: (logo: LogoMeta) => void;
}

const SIZE_CONFIGS = {
  nav: {
    containerClass: 'h-11 sm:h-12 md:h-13 w-auto min-w-[85px] max-w-[180px]',
    imgClass: 'h-11 sm:h-12 md:h-13 w-auto object-contain',
    glowBlur: 'blur-[20px]',
    glowOpacity: '0.45',
  },
  sm: {
    containerClass: 'h-16 sm:h-20 w-auto min-w-[120px] max-w-[220px]',
    imgClass: 'h-16 sm:h-20 w-auto object-contain',
    glowBlur: 'blur-[25px]',
    glowOpacity: '0.5',
  },
  md: {
    containerClass: 'h-28 sm:h-36 w-auto min-w-[210px] max-w-[340px]',
    imgClass: 'h-28 sm:h-36 w-auto object-contain',
    glowBlur: 'blur-[36px]',
    glowOpacity: '0.55',
  },
  lg: {
    containerClass: 'h-40 sm:h-52 md:h-60 w-auto min-w-[280px] max-w-[500px]',
    imgClass: 'h-40 sm:h-52 md:h-60 w-auto object-contain',
    glowBlur: 'blur-[50px]',
    glowOpacity: '0.6',
  },
  hero: {
    containerClass: 'h-48 sm:h-64 md:h-80 w-full max-w-[580px] md:max-w-[720px]',
    imgClass: 'h-48 sm:h-64 md:h-80 w-auto object-contain',
    glowBlur: 'blur-[75px]',
    glowOpacity: '0.65',
  },
};

export default function MainBrandLogo({
  size = 'md',
  showGlow = true,
  className = '',
  interactive = true,
  priority = false,
  onLogoChange,
}: MainBrandLogoProps) {
  // Load one of the 4 on session start — no auto-timer switching while loaded
  const [currentIndex, setCurrentIndex] = useState(getLoadedLogoIndex);
  const activeLogo = MAIN_LOGOS[currentIndex] || MAIN_LOGOS[0];
  const sizeCfg = SIZE_CONFIGS[size] || SIZE_CONFIGS.md;

  const nextLogo = useCallback(() => {
    setCurrentIndex((prev) => {
      const next = (prev + 1) % MAIN_LOGOS.length;
      try {
        sessionStorage.setItem('pim_session_logo_index', next.toString());
      } catch {}
      onLogoChange?.(MAIN_LOGOS[next]);
      return next;
    });
  }, [onLogoChange]);

  return (
    <div
      className={`relative flex items-center justify-center select-none ${sizeCfg.containerClass} ${
        interactive ? 'cursor-pointer group' : ''
      } ${className}`}
      onClick={interactive ? nextLogo : undefined}
      title={interactive ? `${activeLogo.name} (Click to switch artwork)` : activeLogo.name}
    >
      {/* Dynamic Ambient Backlight Glow */}
      {showGlow && (
        <div
          className={`absolute inset-0 m-auto rounded-full pointer-events-none transition-all duration-700 ${sizeCfg.glowBlur}`}
          style={{
            background: `radial-gradient(circle, ${activeLogo.glow} 0%, transparent 75%)`,
            opacity: sizeCfg.glowOpacity,
            transform: 'scale(1.2)',
          }}
        />
      )}

      {/* Loaded Artwork Graphic */}
      <AnimatePresence mode="wait">
        <motion.img
          key={activeLogo.id}
          src={activeLogo.src}
          alt={`PIM th3v4ult - ${activeLogo.name}`}
          className={`relative z-10 ${sizeCfg.imgClass} filter drop-shadow-[0_10px_24px_rgba(0,0,0,0.85)] transition-transform duration-300 ${
            interactive ? 'group-hover:scale-105 group-active:scale-95' : ''
          }`}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
        />
      </AnimatePresence>
    </div>
  );
}
