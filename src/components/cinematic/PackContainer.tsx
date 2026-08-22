import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVaultStore, type RevealPackMeta } from '../../store/useVaultStore';
import type { OwnedCard } from '../../services/vaultService';
import { audioManager } from '../../game/audio';
import { RARITY_CONFIG, type Rarity } from '../../utils/rarity';
import { getCoverUrlForRarity, useSmartCoverArt, resolveSmartCoverUrl } from '../../utils/rarityArtwork';
import { get365CardVariantStyle, getPackCoverFallback, getPackMultiCovers } from '../../utils/cardVariants';
import { getFeaturedBombshellFoilCover, getRandomBombshellPackCover } from '../../utils/bombshellCards';
import Card from '../Card';
import RarityBadge from '../RarityBadge';
import {
  playAmbient, playCrinkle, playTension, playTear,
  playSnap, playShimmer, playTick, playNearMiss, playRareHit,
  playUnlockChime, playBombshellHeartbeat, playBombshellSwell,
  playBombshellShimmer, disposeAudioContext,
} from './audioEngine';

// ── Types ────────────────────────────────────────────────────────────

type Phase =
  | 'preloading' // assets being fetched
  | 'idle'       // 0: floating pack
  | 'grip'       // 1: press-and-hold
  | 'tension'    // 2: pre-tear stretch
  | 'tearing'    // 3: tear starts
  | 'snap'       // 4: tear snap
  | 'pause'      // 5: reveal pause (anticipation)
  | 'rise'       // 6: card stack rises
  | 'flipping'   // 7: flip sequence
  | 'layout'     // 8: post layout (arc spread)
  | 'inspect';   // 9: inspection mode

interface ShardParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  angle: number;
  spin: number;
  alpha: number;
  decay: number;
  points: number;
}

interface Props {
  meta: RevealPackMeta;
  cards: OwnedCard[];
  accumulatedCards?: OwnedCard[];
  onComplete: () => void;
  onBuyAnother?: () => void;
  isRepurchasing?: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────


const isRareOrHigher = (r: Rarity) => ['rare', 'legendary', 'mythic'].includes(r);

function shouldFakeNearMiss(): boolean {
  return Math.random() < 0.6;
}

function isUltraTrigger(): boolean {
  return Math.random() < 0.003;
}

// ── Grain Overlay ────────────────────────────────────────────────────

function GrainOverlay() {
  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 100,
      opacity: 0.06, mixBlendMode: 'overlay',
      background: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
    }} />
  );
}

// ===== PACK EMBLEM (Custom Icon) =====
function PackEmblem({ accent, size = 80, isBombshell = false }: { accent: string; size?: number; isBombshell?: boolean }) {
  return (
    <div className="relative flex justify-center items-center my-1 rounded-full mx-auto" style={{ width: size, height: size, boxShadow: `0 0 25px ${accent}40`, zIndex: 25 }}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" style={{ animation: 'spin-slow 16s linear infinite', transformOrigin: 'center', willChange: 'transform' }}>
        <path id="circlePath" d="M 50, 50 m -35, 0 a 35,35 0 1,1 70,0 a 35,35 0 1,1 -70,0" fill="transparent" />
        <text fill={accent} fontWeight="900" style={{ textTransform: 'uppercase', fontSize: isBombshell ? '7.5px' : '8.5px', textShadow: `0 0 10px ${accent}`, letterSpacing: '1px' }}>
          <textPath href="#circlePath" startOffset="0%">
            {isBombshell ? '💖 BOMBSHELL • UNCENSORED •' : 'TH3SCR1B3 • GEN 0 •'}
          </textPath>
          <textPath href="#circlePath" startOffset="50%">
            {isBombshell ? '💖 BOMBSHELL • UNCENSORED •' : 'TH3SCR1B3 • GEN 0 •'}
          </textPath>
        </text>
        <circle cx="50" cy="50" r="23" fill="none" stroke={accent} strokeWidth="1.5" strokeDasharray="3 3" opacity="0.8" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-black" style={{ 
          fontSize: size * 0.44, 
          color: '#ffffff',
          WebkitTextFillColor: '#ffffff',
          fontFamily: '"Impact", "Arial Black", sans-serif',
          letterSpacing: '-1.5px',
          transform: 'scaleY(1.2) scaleX(0.9)',
          WebkitTextStroke: '1px #000000',
          textShadow: `0 0 15px ${accent}, 2px 2px 0 #000000`,
        }}>
          365
        </span>
      </div>
    </div>
  );
}

function CyberPackBagContents({ meta, sampleCard }: { meta: RevealPackMeta; sampleCard?: OwnedCard['card'] }) {
  const isBombshell = meta.category === 'bombshell' || meta.category === 'bombshell_token' || meta.label?.toLowerCase().includes('bombshell');
  const variant = get365CardVariantStyle(meta.category || meta.label);

  const countNum = (meta.cardCount && meta.cardCount >= 50) ? 50 : (meta.cardCount && meta.cardCount >= 25) ? 25 : (meta.cardCount && meta.cardCount >= 10) ? 10 : (meta.cardCount && meta.cardCount >= 5) ? 5 : (meta.cardCount && meta.cardCount >= 2) ? 2 : 1;
  const plural = countNum === 1 ? 'card' : 'cards';

  const foilCoverUrl = meta.coverImage || (isBombshell ? getRandomBombshellPackCover(countNum) : undefined);

  return (
    <>
      {/* Precision Cartridge Shell Frame */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isBombshell ? 'linear-gradient(165deg, #13010b 0%, #2d031c 40%, #0d0108 100%)' : 'linear-gradient(175deg, #07070d 0%, #0d0e17 40%, #05060a 100%)', zIndex: 0 }}>
        {/* Carbon Weave Texture Layer */}
        <div className="cyber-carbon-weave absolute inset-0 opacity-40 pointer-events-none" />

        {/* Panik Cyber Ambient Neon Halo for Bombshell */}
        {isBombshell && (
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at 50% 35%, rgba(255, 20, 147, 0.48) 0%, rgba(255, 0, 100, 0.24) 45%, transparent 75%)',
              mixBlendMode: 'screen',
              zIndex: 1,
            }}
          />
        )}

        {/* Embedded Artwork Underplate */}
        {foilCoverUrl && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 flex items-center justify-center">
            <motion.img
              src={foilCoverUrl}
              alt="Foil Artwork"
              className="w-full h-full object-cover pointer-events-none select-none"
              animate={isBombshell ? { scale: [1, 1.02, 1] } : { scale: [1.35, 1.42, 1.35] }}
              transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                filter: isBombshell ? 'contrast(1.2) saturate(1.35) brightness(1.05) drop-shadow(0 0 24px rgba(255,20,147,0.75))' : 'contrast(1.2) brightness(0.85)',
                mixBlendMode: isBombshell ? 'normal' : 'luminosity',
                opacity: isBombshell ? 1 : 0.45,
              }}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = `/data/packs/bombshell_top_${countNum}${plural}.jpg`;
              }}
            />
            {!isBombshell && (
              <div 
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: `linear-gradient(180deg, rgba(5,6,10,0.3) 0%, rgba(5,6,10,0.85) 70%, #05060a 100%)`,
                  mixBlendMode: 'multiply',
                }}
              />
            )}
          </div>
        )}

        {/* Animated Iridescent Panik Foil Shimmer */}
        {isBombshell && (
          <div
            className="absolute inset-0 pointer-events-none foil-holo-prism"
            style={{
              background: 'linear-gradient(115deg, transparent 20%, rgba(255, 20, 147, 0.4) 40%, rgba(255, 255, 255, 0.75) 50%, rgba(0, 229, 255, 0.4) 60%, transparent 80%)',
              mixBlendMode: 'color-dodge',
              opacity: 0.65,
              zIndex: 3,
            }}
          />
        )}

        {/* Dynamic Glow */}
        <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 50% 30%, ${meta.accent}40, transparent 65%)`, zIndex: 2 }} />
      </div>

      {/* Top and Bottom Gold Multi-Pin Bus Terminals */}
      <div className="cyber-bus-pins-top absolute inset-x-0 top-0 h-[18px]" style={{ zIndex: 25 }} />
      <div className="cyber-bus-pins-bottom absolute inset-x-0 bottom-0 h-[18px]" style={{ zIndex: 25 }} />

      {/* Dual Neon Light Conduits */}
      <div className="cyber-light-conduit-left" style={{ zIndex: 22, '--conduit-accent': meta.accent } as any} />
      <div className="cyber-light-conduit-right" style={{ zIndex: 22, '--conduit-accent': meta.accent } as any} />

      {/* TOP-LEFT: Laser Security Price Seal */}
      <div className="absolute left-3 top-7 pointer-events-none" style={{ zIndex: 30 }}>
        <div className="cyber-laser-stamp" style={{ '--stamp-accent': meta.accent, '--stamp-accent-glow': `${meta.accent}50`, borderColor: isBombshell ? '#FF1493' : undefined, padding: '3px 8px' } as any}>
          <span className="text-[5px] font-mono uppercase opacity-70 tracking-wider" style={{ color: isBombshell ? '#FF1493' : undefined }}>PRICE</span>
          <span className="text-[16px] font-black leading-none" style={{ fontFamily: 'Impact, sans-serif', color: '#fff', textShadow: `0 0 8px ${meta.accent}` }}>
            {meta.price || '$0.25'}
          </span>
        </div>
      </div>

      {/* BOTTOM-RIGHT: Capacity Stamp */}
      <div className="absolute right-3 bottom-7 pointer-events-none" style={{ zIndex: 30 }}>
        <div className="cyber-laser-stamp" style={{ '--stamp-accent': meta.accent, '--stamp-accent-glow': `${meta.accent}50`, borderColor: isBombshell ? '#FF1493' : undefined, padding: '2px 7px' } as any}>
          <span className="text-[5px] font-mono uppercase opacity-70" style={{ color: isBombshell ? '#FF1493' : undefined }}>CAPACITY</span>
          <span className="text-[13px] font-black leading-none" style={{ fontFamily: 'Impact, sans-serif', color: '#fff' }}>
            {meta.cardCount || 1}×
          </span>
        </div>
      </div>

      {/* CENTER GRAPHICS */}
      <div className="absolute inset-0 flex flex-col items-center justify-between pt-6 pb-6 px-4 pointer-events-none" style={{ zIndex: 20 }}>
        <div className="w-full h-3 mt-1" style={{
          borderBottom: `1.5px dashed ${meta.accent}60`,
        }} />

        <div className="flex flex-col items-center justify-center my-auto w-full px-2">
          <h3 
            className={`leading-[0.92] uppercase font-black text-center max-w-[230px] ${
              (meta.label || '').length > 18
                ? 'text-[18px] sm:text-[20px]'
                : (meta.label || '').length > 12
                  ? 'text-[21px] sm:text-[23px]'
                  : 'text-[25px] sm:text-[28px]'
            }`} 
            style={{
              color: '#ffffff',
              fontFamily: '"Impact", "Arial Black", sans-serif',
              letterSpacing: '0.02em',
              textShadow: `0 0 16px ${meta.accent}, 2px 2px 0 #000`,
              margin: '3px 0 5px 0',
            }}
          >
            {meta.label || (isBombshell ? 'BOMBSHELL' : 'CYBER CORE')}
          </h3>
          
          <PackEmblem accent={meta.accent} size={62} isBombshell={isBombshell} />
          
          <div className="text-center mt-2 w-full">
            <div className="inline-block">
              <div className="px-3 py-1 rounded bg-black/80 border border-white/15" style={{ boxShadow: `0 0 10px ${meta.accent}30` }}>
                <span className="text-[7.5px] font-mono font-bold tracking-wider uppercase text-slate-300">
                  {isBombshell ? '💖 UNCENSORED PANIK ARCHIVE 💖' : variant.tagline}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="h-2" />
      </div>

      <div style={{ position: 'absolute', inset: 0, border: `1.5px solid ${meta.accent}40`, borderRadius: '8px', pointerEvents: 'none', zIndex: 30 }} />
    </>
  );
}

function ClassicFoilPackBagContents({ meta, sampleCard }: { meta: RevealPackMeta; sampleCard?: OwnedCard['card'] }) {
  const isBombshell = meta.category === 'bombshell' || meta.category === 'bombshell_token' || meta.label?.toLowerCase().includes('bombshell');
  const variant = get365CardVariantStyle(meta.category || meta.label);

  const countNum = (meta.cardCount && meta.cardCount >= 50) ? 50 : (meta.cardCount && meta.cardCount >= 25) ? 25 : (meta.cardCount && meta.cardCount >= 10) ? 10 : (meta.cardCount && meta.cardCount >= 5) ? 5 : (meta.cardCount && meta.cardCount >= 2) ? 2 : 1;
  const plural = countNum === 1 ? 'card' : 'cards';

  const foilCoverUrl = meta.coverImage || (isBombshell ? getRandomBombshellPackCover(countNum) : undefined);

  return (
    <>
      {/* 1. CLEAN 3D METALLIC FOIL PACK BASE WITH EMBEDDED CLOSE-UP ARTWORK */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isBombshell ? 'linear-gradient(165deg, #13010b 0%, #2d031c 40%, #0d0108 100%)' : '#08060f', zIndex: 0 }}>
        {/* Panik Cyber Ambient Neon Halo for Bombshell */}
        {isBombshell && (
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at 50% 35%, rgba(255, 20, 147, 0.48) 0%, rgba(255, 0, 100, 0.24) 45%, transparent 75%)',
              mixBlendMode: 'screen',
              zIndex: 1,
            }}
          />
        )}

        {/* EMBEDDED CLOSE-UP COVER ARTWORK IN FOIL */}
        {foilCoverUrl && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none flex items-center justify-center" style={{ zIndex: 1 }}>
            <motion.img
              src={foilCoverUrl}
              alt="Foil Artwork"
              className="w-full h-full object-cover"
              animate={isBombshell ? { scale: [1, 1.02, 1] } : { scale: [1.48, 1.55, 1.48], rotate: [-0.6, 0.6, -0.6] }}
              transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                filter: isBombshell 
                  ? 'contrast(1.2) saturate(1.35) brightness(1.05) drop-shadow(0 0 24px rgba(255,20,147,0.75))' 
                  : 'contrast(1.15) brightness(0.75) saturate(1.2)',
                mixBlendMode: isBombshell ? 'normal' : 'luminosity',
                opacity: isBombshell ? 1 : 0.4,
              }}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = `/data/packs/bombshell_top_${countNum}${plural}.jpg`;
              }}
            />
            {/* Holographic foil iridescent duotone color overlay */}
            {!isBombshell && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'linear-gradient(160deg, rgba(0, 229, 255, 0.35) 0%, rgba(10, 16, 32, 0.75) 100%)',
                  mixBlendMode: 'color',
                  opacity: 0.9,
                }}
              />
            )}
            {/* Metallic specular sheen overlay */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: isBombshell 
                  ? 'radial-gradient(ellipse at 50% 25%, rgba(255, 255, 255, 0.3) 0%, transparent 60%)'
                  : 'radial-gradient(ellipse at 50% 30%, rgba(255, 255, 255, 0.25) 0%, transparent 65%)',
                mixBlendMode: 'screen',
                opacity: 0.7,
              }}
            />
          </div>
        )}

        {/* Animated Iridescent Panik Foil Shimmer for Bombshell */}
        {isBombshell && (
          <div
            className="absolute inset-0 pointer-events-none foil-holo-prism"
            style={{
              background: 'linear-gradient(115deg, transparent 20%, rgba(255, 20, 147, 0.4) 40%, rgba(255, 255, 255, 0.75) 50%, rgba(0, 229, 255, 0.4) 60%, transparent 80%)',
              mixBlendMode: 'color-dodge',
              opacity: 0.65,
              zIndex: 3,
            }}
          />
        )}

        {/* VIBRANT POPPING PACK ACCENT COLOR TINT */}
        {!isBombshell && (
          <>
            <div
              className="absolute inset-0 pointer-events-none transition-all"
              style={{
                position: 'absolute', inset: 0,
                background: `linear-gradient(160deg, ${meta.accent}ee 0%, ${meta.accent}aa 45%, rgba(6,3,14,0.96) 100%)`,
                mixBlendMode: 'hard-light',
                opacity: 0.95,
                zIndex: 2,
              }}
            />
            <div
              className="absolute inset-0 pointer-events-none transition-all"
              style={{
                position: 'absolute', inset: 0,
                background: meta.accent,
                mixBlendMode: 'color',
                opacity: 0.85,
                zIndex: 3,
              }}
            />
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 25%, rgba(255,255,255,0.2) 0%, transparent 60%)', zIndex: 4 }} />
          </>
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.7) 90%)', zIndex: 4 }} />
      </div>

      {/* 2. REALISTIC SERRATED JAGGED CRIMP TEETH */}
      <div className="absolute top-0 inset-x-0 h-[10px] pointer-events-none z-20 overflow-hidden">
        <div className="w-full h-full foil-crimped-edge-top opacity-90" />
      </div>
      <div className="absolute bottom-0 inset-x-0 h-[10px] pointer-events-none z-20 overflow-hidden">
        <div className="w-full h-full foil-crimped-edge-bottom opacity-90" />
      </div>

      {/* 3. HORIZONTAL CRIMP TEXTURE BANDS */}
      <div className="absolute top-0 inset-x-0 h-[16px] pointer-events-none z-10 opacity-70" style={{
        background: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.18) 0px, rgba(255,255,255,0.18) 1.5px, transparent 1.5px, transparent 3.5px)',
        borderBottom: '1px solid rgba(255,255,255,0.25)',
      }} />
      <div className="absolute bottom-0 inset-x-0 h-[16px] pointer-events-none z-10 opacity-70" style={{
        background: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.18) 0px, rgba(255,255,255,0.18) 1.5px, transparent 1.5px, transparent 3.5px)',
        borderTop: '1px solid rgba(255,255,255,0.25)',
      }} />

      {/* 4. VERTICAL FOIL PILLOW CRUSH SHADOWS */}
      <div className="absolute inset-y-0 left-0 w-8 pointer-events-none z-10" style={{
        background: 'linear-gradient(90deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.15) 50%, transparent 100%)',
      }} />
      <div className="absolute inset-y-0 right-0 w-8 pointer-events-none z-10" style={{
        background: 'linear-gradient(270deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.15) 50%, transparent 100%)',
      }} />

      {/* 5. CENTER VERTICAL SPECULAR SPINE */}
      <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-16 pointer-events-none z-10" style={{
        background: 'radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.18) 0%, transparent 80%)',
        mixBlendMode: 'screen',
      }} />

      {/* 6. CORNER LIGHT FLARES */}
      <div className="absolute top-2 left-2 w-12 h-12 pointer-events-none z-10 rounded-full" style={{
        background: 'radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%)',
        mixBlendMode: 'screen',
      }} />
      <div className="absolute bottom-4 right-2 w-16 h-16 pointer-events-none z-10 rounded-full" style={{
        background: `radial-gradient(circle, ${isBombshell ? '#FF1493' : meta.accent}40 0%, transparent 70%)`,
        mixBlendMode: 'screen',
      }} />

      {/* 7. LIVE METALLIC SHEEN SWEEP ANIMATION */}
      <div className="foil-metallic-sheen" style={{ zIndex: 5 }} />

      {/* 8. REALISTIC METALLIC FOIL CRINKLE NOISE TEXTURE */}
      <div className="absolute inset-0 pointer-events-none mix-blend-overlay" style={{
        background: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='foilNoise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.035 0.08' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.5 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23foilNoise)'/%3E%3C/svg%3E")`,
        opacity: 0.25,
        zIndex: 9,
      }} />

      {/* 9. VERTICAL TH3SCR1B3 / BOMBSHELL SIDE BANNER */}
      <div className="absolute left-1 top-24 w-8 flex items-center justify-center pointer-events-none" style={{ zIndex: 22 }}>
        <div className="font-black leading-none uppercase whitespace-nowrap" style={{
          transform: 'rotate(-90deg) scaleY(1.3) scaleX(0.9)',
          color: 'rgba(255,255,255,0.8)',
          WebkitTextFillColor: 'rgba(255,255,255,0.8)',
          fontFamily: '"Impact", "Arial Black", sans-serif',
          fontSize: '16px',
          letterSpacing: '-0.5px',
          WebkitTextStroke: `1px ${meta.accent}`,
          textShadow: `0 0 12px ${meta.accent}99`,
        }}>
          {isBombshell ? 'PANIK // BOMBSHELL' : 'TH3SCR1B3'}
        </div>
      </div>

      {/* 10. Middle-Left: Price Sticker */}
      <div className="absolute left-0 top-20 pointer-events-none" style={{ zIndex: 30 }}>
        <div className="sticker-gun-tag sticker-slits drop-shadow-lg" style={{ 
          transform: 'rotate(-90deg) translateX(-50%)',
          transformOrigin: 'left center',
          background: '#ffffff',
          '--slit-color': `${meta.accent}30`,
          border: isBombshell ? `1.5px solid ${meta.accent}` : undefined,
          padding: '4px 10px',
          alignItems: 'center'
        } as any}>
          <span className="text-[6px] font-black tracking-tighter opacity-70 mb-0.5 leading-none" style={{ fontFamily: 'Impact, sans-serif', color: isBombshell ? '#FF1493' : '#000', WebkitTextFillColor: isBombshell ? '#FF1493' : '#000' }}>
            {isBombshell ? 'BOMBSHELL' : 'TH3SCR1B3 VAULT'}
          </span>
          <div className="flex items-baseline leading-none py-0.5">
            <span className="text-[15px] font-black mr-0.5" style={{ transform: 'scaleY(1.3)', letterSpacing: '-0.8px', color: '#000', WebkitTextFillColor: '#000' }}>
              {meta.price || '$0.25'}
            </span>
          </div>
        </div>
      </div>

      {/* 11. CENTER BAG GRAPHICS */}
      <div 
        className="absolute inset-0 flex flex-col items-center justify-between pt-6 pb-8 px-4 pointer-events-none"
        style={{ zIndex: 20 }}
      >
        <div className="w-full h-4 mt-2" style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.15), transparent)',
          borderBottom: `2px dashed rgba(255,255,255,0.35)`,
        }} />

        <div className="flex flex-col items-center justify-center my-auto w-full px-2">
          <h3 
            className={`leading-[0.92] uppercase font-black text-center max-w-[240px] ${
              (meta.label || '').length > 18
                ? 'text-[19px] sm:text-[21px]'
                : (meta.label || '').length > 12
                  ? 'text-[23px] sm:text-[25px]'
                  : 'text-[27px] sm:text-[30px]'
            }`} 
            style={{
              color: '#ffffff',
              WebkitTextFillColor: '#ffffff',
              fontFamily: '"Impact", "Arial Black", sans-serif',
              letterSpacing: '-0.3px',
              transform: 'scaleY(1.06)',
              transformOrigin: 'center',
              WebkitTextStroke: '1.5px #000000',
              textShadow: `
                0 0 15px ${meta.accent}, 
                0 0 30px ${meta.accent}99, 
                2px 3px 0 #000000, 
                3px 6px 12px rgba(0,0,0,0.95)
              `,
              margin: '4px 0 6px 0',
            }}
          >
            {meta.label || (isBombshell ? 'BOMBSHELL' : 'VAULT PACK')}
          </h3>
          
          <PackEmblem accent={meta.accent} size={62} isBombshell={isBombshell} />
          
          <div className="text-center mt-2 w-full">
            <div className="inline-block">
              <div className="sticker-gun-tag sticker-slits drop-shadow-md" style={{
                background: '#ffffff',
                border: `1.5px solid ${meta.accent}40`,
                '--slit-color': `${meta.accent}20`,
                padding: '3px 10px',
                transform: 'rotate(0.5deg)',
                minWidth: '150px'
              } as any}>
                <span 
                  className="text-[8px] font-black tracking-tighter uppercase italic opacity-95" 
                  style={{ 
                    color: '#000000',
                    WebkitTextFillColor: '#000000',
                    fontFamily: '"JetBrains Mono", monospace'
                  }}
                >
                  {isBombshell ? '💖 UNCENSORED PANIK ARCHIVE 💖' : variant.tagline}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="h-4" />
      </div>

      {/* 12. Bottom Center: Card Count Sticker */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none" style={{ zIndex: 30 }}>
        <div className="sticker-gun-tag sticker-slits drop-shadow-sm" style={{ 
          background: '#ffffff',
          '--slit-color': `${meta.accent}20`,
          border: isBombshell ? `1.5px solid ${meta.accent}` : undefined,
          transform: 'rotate(2deg)',
          padding: '2px 10px',
          alignItems: 'center'
        } as any}>
          <span className="text-[7px] font-black tracking-tighter uppercase mb-0.5 opacity-70" style={{ color: isBombshell ? '#FF1493' : '#000', WebkitTextFillColor: isBombshell ? '#FF1493' : '#000' }}>CARDS</span>
          <span className="text-[14px] font-black leading-none" style={{ transform: 'scaleY(1.2)', color: '#000', WebkitTextFillColor: '#000' }}>
            {meta.cardCount || 1}
          </span>
        </div>
      </div>

      <div style={{ position: 'absolute', inset: 0, border: '1.5px solid rgba(255,255,255,0.08)', borderRadius: '8px', pointerEvents: 'none', zIndex: 30 }} />
    </>
  );
}

function PackBagContents({ meta, sampleCard }: { meta: RevealPackMeta; sampleCard?: OwnedCard['card'] }) {
  const packDesignStyle = useVaultStore((s) => s.packDesignStyle);
  if (packDesignStyle === 'cyber_cartridge') {
    return <CyberPackBagContents meta={meta} sampleCard={sampleCard} />;
  }
  return <ClassicFoilPackBagContents meta={meta} sampleCard={sampleCard} />;
}

// ── Pack Shell (the bag visual) ──────────────────────────────────────

function PackShell({ meta, phase, sampleCard }: { meta: RevealPackMeta; phase: Phase; sampleCard?: OwnedCard['card'] }) {
  const isTorn = ['snap', 'pause', 'rise', 'flipping', 'layout', 'inspect'].includes(phase);
  const isTearing = phase === 'tearing';
  const isBombshell = meta.category === 'bombshell' || meta.category === 'bombshell_token' || meta.label?.toLowerCase().includes('bombshell');

  return (
    <>
      {/* Intact pack — visible during idle/grip/tension */}
      <AnimatePresence>
        {!isTorn && !isTearing && (
          <motion.div
            key="intact"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            style={{
              position: 'absolute', inset: 0, borderRadius: '8px', overflow: 'hidden',
              background: isBombshell ? '#000000' : (meta.gradient || '#0a0814'),
              boxShadow: `0 15px 40px rgba(0,0,0,0.8), 0 0 35px ${meta.accent}35`,
              border: '1.5px solid rgba(255,255,255,0.12)',
            }}
          >
            <PackBagContents meta={meta} sampleCard={sampleCard} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tearing mask — visible during tear phase */}
      <AnimatePresence>
        {isTearing && (
          <motion.div
            key="tearing"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.08 }}
            style={{ position: 'absolute', inset: 0 }}
          >
            {/* Top seam stretching */}
            <motion.div
              initial={{ scaleY: 1 }}
              animate={{ scaleY: 1.08 }}
              transition={{ duration: 0.3 }}
              style={{
                position: 'absolute', inset: 0, borderRadius: '8px', overflow: 'hidden',
                background: isBombshell ? 'linear-gradient(165deg, #13010b 0%, #2d031c 40%, #0d0108 100%)' : (meta.gradient || '#0a0814'), transformOrigin: 'top center',
                boxShadow: isBombshell ? `8px 8px 0 #FF1493` : `8px 8px 0 #000`,
                border: '1.5px solid rgba(255,255,255,0.12)',
                willChange: 'transform, opacity',
              }}
            >
              <PackBagContents meta={meta} sampleCard={sampleCard} />
              {/* Glow leak at seam */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.8, 0.4, 0.9] }}
                transition={{ duration: 0.4 }}
                style={{
                  position: 'absolute', left: 0, right: 0, top: '46%', height: '10%',
                  background: `linear-gradient(180deg, transparent, ${meta.accent}99, transparent)`,
                  filter: 'blur(6px)',
                  zIndex: 40,
                }}
              />
            </motion.div>
            {/* Jitter edge fibers */}
            {Array.from({ length: 12 }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 0 }}
                animate={{
                  opacity: [0, 0.8, 0],
                  y: [(Math.random() - 0.5) * 4, (Math.random() - 0.5) * 8],
                  x: [(Math.random() - 0.5) * 3, (Math.random() - 0.5) * 6],
                }}
                transition={{ duration: 0.3, delay: i * 0.02 }}
                style={{
                  position: 'absolute',
                  left: `${8 + i * 7}%`, top: '48%',
                  width: '2px', height: '6px',
                  background: meta.accent, borderRadius: '1px',
                  filter: `blur(${Math.random()}px)`,
                  zIndex: 45,
                }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Torn halves — visible after snap */}
      <AnimatePresence>
        {isTorn && (
          <>
            <motion.div
              key="top-half"
              initial={{ rotateX: 0, y: 0, opacity: 1 }}
              animate={{ rotateX: -45, y: -60, opacity: 0.3 }}
              transition={{ duration: 0.12, ease: [0.4, 0, 0.2, 1] }}
              style={{
                position: 'absolute', inset: 0,
                clipPath: 'polygon(0 0, 100% 0, 98% 48%, 2% 50%)',
                borderRadius: '8px', overflow: 'hidden',
                background: isBombshell ? 'linear-gradient(165deg, #13010b 0%, #2d031c 40%, #0d0108 100%)' : (meta.gradient || '#0a0814'), transformOrigin: 'top center',
                border: '1.5px solid rgba(255,255,255,0.12)',
              }}
            >
              <PackBagContents meta={meta} sampleCard={sampleCard} />
            </motion.div>
            <motion.div
              key="bottom-half"
              initial={{ y: 0, opacity: 1 }}
              animate={{ y: 12, opacity: 0.4 }}
              transition={{ duration: 0.12, ease: [0.4, 0, 0.2, 1] }}
              style={{
                position: 'absolute', inset: 0,
                clipPath: 'polygon(2% 50%, 98% 48%, 100% 100%, 0 100%)',
                borderRadius: '8px', overflow: 'hidden',
                background: isBombshell ? 'linear-gradient(165deg, #13010b 0%, #2d031c 40%, #0d0108 100%)' : (meta.gradient || '#0a0814'),
                border: '1.5px solid rgba(255,255,255,0.12)',
              }}
            >
              <PackBagContents meta={meta} sampleCard={sampleCard} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

// ── FX Layer ─────────────────────────────────────────────────────────

function FXLayer({ phase }: { phase: Phase; accent: string }) {
  return (
    <>
      {/* Flash on snap */}
      <AnimatePresence>
        {phase === 'snap' && (
          <motion.div
            key="snap-flash"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.9, 0] }}
            transition={{ duration: 0.12 }}
            style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 300, pointerEvents: 'none' }}
          />
        )}
      </AnimatePresence>
      {/* Zoom pulse on snap */}
      <AnimatePresence>
        {phase === 'snap' && (
          <motion.div
            key="zoom-pulse"
            initial={{ scale: 1 }}
            animate={{ scale: 1.05 }}
            transition={{ duration: 0.12 }}
            style={{ position: 'fixed', inset: 0, zIndex: -1 }}
          />
        )}
      </AnimatePresence>
      {/* Rare reveal screen dim */}
      <AnimatePresence>
        {phase === 'flipping' && (
          <motion.div
            key="dim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.2 }}
            style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 50, pointerEvents: 'none' }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ── Foil shimmer for rare cards ──────────────────────────────────────

const shimmerKeyframes = `
@keyframes cine-shimmer {
  0% { transform: translateX(-150%) skewX(-20deg); }
  100% { transform: translateX(150%) skewX(-20deg); }
}
`;

// ── Main Component ───────────────────────────────────────────────────

export default function PackContainer({ meta, cards, accumulatedCards = cards, onComplete, onBuyAnother, isRepurchasing }: Props) {
  const isBombshell = meta.category === 'bombshell' || meta.category === 'bombshell_token' || meta.label?.toLowerCase().includes('bombshell') || cards.some(c => c.card?.cardSet === 'bombshell' || c.card?.coverUrl?.includes('girl-covers') || c.card?.coverUrl?.includes('rare_covers'));

  const stableCoverImage = useMemo(() => {
    if (meta.coverImage) return meta.coverImage;
    if (isBombshell) {
      const countNum = (meta.cardCount && meta.cardCount >= 50) ? 50 : (meta.cardCount && meta.cardCount >= 25) ? 25 : (meta.cardCount && meta.cardCount >= 10) ? 10 : (meta.cardCount && meta.cardCount >= 5) ? 5 : (meta.cardCount && meta.cardCount >= 2) ? 2 : 1;
      return getRandomBombshellPackCover(meta.category === 'bombshell_token' || countNum === 3 ? undefined : countNum);
    }
    return meta.coverImage;
  }, [meta.coverImage, isBombshell, meta.cardCount, meta.category]);

  const activeMeta = useMemo(() => ({
    ...meta,
    coverImage: stableCoverImage,
  }), [meta, stableCoverImage]);

  const [phase, setPhase] = useState<Phase>('preloading');
  const [flipIndex, setFlipIndex] = useState(-1); // current card being flipped
  const [flippedCards, setFlippedCards] = useState<Set<number>>(new Set());
  const [rareRevealing, setRareRevealing] = useState(false);
  const [nearMissFlash, setNearMissFlash] = useState(false);
  const [ultraTriggered, setUltraTriggered] = useState(false);
  const [inspectIndex, setInspectIndex] = useState<number | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [hasInteracted, setHasInteracted] = useState(false);
  const ambientStop = useRef<(() => void) | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sequenceRunning = useRef(false);
  const abortRef = useRef(false); // Aborts in-flight reveal sequences on re-purchase

  const collection = useVaultStore(s => s.collection);
  const [firstUnlockCard, setFirstUnlockCard] = useState<OwnedCard | null>(null);
  const unlockResolveRef = useRef<(() => void) | null>(null);
  const unlockAudioRef = useRef<HTMLAudioElement | null>(null);

  const checkFirstUnlock = useCallback((cardId: string) => {
    if (!collection || collection.length === 0) return true;
    const count = collection.filter(c => c && c.cardId === cardId).length;
    return count <= 1;
  }, [collection]);

  const [showFragmentDecrypter, setShowFragmentDecrypter] = useState(false);
  const [decrypterPhase, setDecrypterPhase] = useState<'idle' | 'shaking' | 'bursting' | 'revealed'>('idle');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<ShardParticle[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  // Adjust canvas size when fragment decrypter is shown
  useEffect(() => {
    if (!showFragmentDecrypter) return;
    
    const timer = setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const resize = () => {
        const parent = canvas.parentElement;
        if (parent) {
          canvas.width = parent.clientWidth;
          canvas.height = parent.clientHeight;
        }
      };

      resize();
      window.addEventListener('resize', resize);
      
      return () => {
        window.removeEventListener('resize', resize);
      };
    }, 50);

    return () => {
      clearTimeout(timer);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [showFragmentDecrypter]);

  interface FragmentReward {
    cardId: string;
    title: string;
    artist: string;
    coverArt: string | null;
    rarity: Rarity;
    added: number;
    oldTotal: number;
    newTotal: number;
    unlocked: boolean;
  }

  function FragmentRewardImgItem({ coverUrl, rarity, title }: { coverUrl: string | null; rarity: Rarity; title: string }) {
    const { src, handleError } = useSmartCoverArt(coverUrl, rarity);
    const rarityColor = RARITY_CONFIG[rarity]?.color || '#fff';

    return src ? (
      <img
        src={src}
        alt={title}
        onError={handleError}
        className="w-14 h-14 object-cover border-2 border-black flex-shrink-0"
        style={{ boxShadow: '2px 2px 0 #000' }}
      />
    ) : (
      <div
        className="w-14 h-14 border-2 border-black flex-shrink-0 flex items-center justify-center font-black"
        style={{
          background: rarityColor,
          color: '#000',
          boxShadow: '2px 2px 0 #000',
          fontFamily: 'Impact, sans-serif'
        }}
      >
        {rarity.substring(0, 2).toUpperCase()}
      </div>
    );
  }
  const [fragmentRewards, setFragmentRewards] = useState<FragmentReward[]>([]);

  const handleStartDecrypter = useCallback(() => {
    const grouped: { [cardId: string]: { card: OwnedCard['card']; totalGain: number } } = {};
    
    accumulatedCards.forEach((owned) => {
      const card = owned.card;
      const rarity = card.rarity as Rarity;
      let gain = 2;
      if (rarity === 'uncommon') gain = 3;
      else if (rarity === 'rare') gain = 5;
      else if (rarity === 'legendary' || rarity === 'mythic') gain = 10;
      
      if (!grouped[card.id]) {
        grouped[card.id] = {
          card,
          totalGain: 0
        };
      }
      grouped[card.id].totalGain += gain;
    });

    const rewards: FragmentReward[] = Object.values(grouped).map(({ card, totalGain }) => {
      const rarity = card.rarity as Rarity;
      const oldTotal = useVaultStore.getState().fragments[card.id] ?? 0;
      const newTotal = Math.min(10, oldTotal + totalGain);

      // Sync fragment count to database and store state
      useVaultStore.getState().syncFragments(card.id, newTotal);

      return {
        cardId: card.id,
        title: card.title,
        artist: (card as any).artist || 'TH3SCR1B3',
        coverArt: card.coverUrl || null,
        rarity,
        added: totalGain,
        oldTotal,
        newTotal,
        unlocked: newTotal >= 10 && oldTotal < 10,
      };
    });

    setFragmentRewards(rewards);
    setShowFragmentDecrypter(true);
    setDecrypterPhase('idle');
  }, [accumulatedCards]);

  useEffect(() => {
    if (firstUnlockCard && firstUnlockCard.card.audioUrl) {
      const audio = new Audio(firstUnlockCard.card.audioUrl);
      audio.volume = 0.55;
      audio.play().catch(e => {
        if (e.name !== 'AbortError') {
          console.warn("Audio snippet play failed:", e);
        }
      });
      unlockAudioRef.current = audio;
    } else {
      if (unlockAudioRef.current) {
        const audio = unlockAudioRef.current;
        let vol = audio.volume;
        const fade = setInterval(() => {
          vol = Math.max(0, vol - 0.05);
          audio.volume = vol;
          if (vol <= 0) {
            clearInterval(fade);
            audio.pause();
            audio.src = "";
          }
        }, 30);
        unlockAudioRef.current = null;
      }
    }
    return () => {
      if (unlockAudioRef.current) {
        unlockAudioRef.current.pause();
        unlockAudioRef.current.src = "";
      }
    };
  }, [firstUnlockCard]);

  // ── Manage Ambient Audio & State Reset ──────────────────────────
  useEffect(() => {
    // Abort any in-flight reveal sequence from the previous cards
    abortRef.current = true;

    // Stop previous ambient audio
    ambientStop.current?.();
    ambientStop.current = null;

    // Allow new sequence after a tick (to let the abort propagate)
    const resetTimer = setTimeout(() => {
      abortRef.current = false;
    }, 50);

    // Reset visual state
    setPhase('preloading');
    setFlipIndex(-1);
    setFlippedCards(new Set());
    setRareRevealing(false);
    setNearMissFlash(false);
    setUltraTriggered(false);
    setInspectIndex(null);
    setExpandedIndex(null);
    setHasInteracted(false);
    sequenceRunning.current = false;
    
    // Reset decrypter states
    setShowFragmentDecrypter(false);
    setDecrypterPhase('idle');
    setFragmentRewards([]);

    return () => {
      clearTimeout(resetTimer);
      abortRef.current = true;
      ambientStop.current?.();
      ambientStop.current = null;
      disposeAudioContext();
    };
  }, [cards]);

  // Audio trigger on interaction
  useEffect(() => {
    if (hasInteracted && !ambientStop.current) {
        ambientStop.current = playAmbient();
    }
  }, [hasInteracted]);

  // ── Preloading Hook ────────────────────────────────────────────────
  useEffect(() => {
    let isCancelled = false;

    async function preloadAssets() {
      const urls = new Set<string>();

      // Pre-resolve smart cover URLs for all cards in parallel before reveal phase
      await Promise.all(
        cards.map(async (owned) => {
          try {
            const workingCover = await resolveSmartCoverUrl(owned.card.coverUrl, owned.card.rarity);
            if (workingCover) urls.add(workingCover);
            if (owned.card.holographicUrl) urls.add(owned.card.holographicUrl);
          } catch {
            // non-fatal
          }
        })
      );

      const preloadPromise = Promise.all(
        Array.from(urls).map(url => new Promise((resolve) => {
          const img = new Image();
          img.onload = resolve;
          img.onerror = resolve; // Continue on error prevents total hang
          img.src = url;
        }))
      );

      // Failsafe timeout — 1200ms max ensures immediate interaction
      const timeoutPromise = new Promise(resolve => setTimeout(resolve, 1200));
      
      await Promise.race([preloadPromise, timeoutPromise]);
      if (!isCancelled) setPhase('idle');
    }

    preloadAssets();
    return () => { isCancelled = true; };
  }, [cards]);

  // Fast Reveal Handler for Multi-Card Packs
  const handleFastReveal = useCallback(() => {
    abortRef.current = true;
    setFlippedCards(new Set(cards.map((_, i) => i)));
    setPhase('layout');
    setRareRevealing(false);
    setNearMissFlash(false);
    setUltraTriggered(false);
    sequenceRunning.current = false;
    audioManager.playSfx('open_chest', 0.8);
  }, [cards]);

  // ── Timeline Controller (Post-Snap Reveal) ─────────────────────────

  const triggerRevealSequence = useCallback(async () => {
    if (sequenceRunning.current) return;
    if (abortRef.current) return;
    sequenceRunning.current = true;

    // Abortable wait — returns true if aborted
    const abortableWait = (ms: number) =>
      new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => resolve(abortRef.current), ms);
        // Check immediately in case abort was set before this call
        if (abortRef.current) {
          clearTimeout(timer);
          resolve(true);
        }
      });

    // Phase 3 & 4: TEAR START & SNAP
    setPhase('tearing');
    if (isBombshell) {
      playTear();
      playBombshellSwell();
    } else {
      playTear();
    }
    if (await abortableWait(400)) return;

    setPhase('snap');
    if (isBombshell) {
      playSnap();
      playBombshellShimmer();
    } else {
      playSnap();
    }
    if (await abortableWait(300)) return;

    // Phase 5: REVEAL PAUSE — anticipation builder
    setPhase('pause');
    if (isBombshell) {
      playBombshellShimmer();
    } else {
      playShimmer();
    }
    if (await abortableWait(1000)) return;

    // Phase 6: CARD STACK RISE
    setPhase('rise');
    if (await abortableWait(800)) return;

    // Phase 7: FLIP SEQUENCE
    setPhase('flipping');
    ambientStop.current?.(); // kill ambient
    ambientStop.current = null;

    for (let i = 0; i < cards.length; i++) {
      if (abortRef.current) return;
      setFlipIndex(i);
      const card = cards[i];
      const rarity = card.card.rarity as Rarity;

      if (isRareOrHigher(rarity) || isBombshell) {
        // Near-miss system (60% fake higher tier)
        if (shouldFakeNearMiss() && i > 0 && !isBombshell) {
          setNearMissFlash(true);
          playNearMiss();
          if (await abortableWait(250)) return;
          setNearMissFlash(false);
        }

        // Rare / Bombshell reveal sequence
        setRareRevealing(true);

        // Phase A: Silence — let the tension breathe
        if (await abortableWait(350)) return;

        // Phase B: Energy Build
        if (await abortableWait(450)) return;

        // Phase C: Slow flip — hold the moment
        setFlippedCards(prev => new Set(prev).add(i));
        if (isBombshell) {
          playBombshellShimmer();
          playRareHit();
        } else {
          playRareHit();
        }
        if (await abortableWait(650)) return;

        // Ultra trigger check (0.3%)
        if (isUltraTrigger()) {
          setUltraTriggered(true);
          if (await abortableWait(1000)) return;
          setUltraTriggered(false);
        }

        setRareRevealing(false);
        if (await abortableWait(500)) return; // Linger on the card
      } else if (rarity === 'uncommon') {
        // Uncommon — let it sit a beat
        setFlippedCards(prev => new Set(prev).add(i));
        playTick();
        if (await abortableWait(500)) return;
      } else {
        // Common — still give it a moment
        setFlippedCards(prev => new Set(prev).add(i));
        playTick();
        if (await abortableWait(450)) return;
      }

      // First-time card unlock overlay step (paused until resolved)
      if (checkFirstUnlock(card.card.id)) {
        setFirstUnlockCard(card);
        audioManager.playSfx('hidden_secret_found', 1.0);
        await new Promise<void>((resolve) => {
          unlockResolveRef.current = resolve;
        });
        setFirstUnlockCard(null);
        if (await abortableWait(400)) return;
      }
    }

    if (abortRef.current) return;

    // Phase 8: POST LAYOUT
    setPhase('layout');
    sequenceRunning.current = false;
    // We now pause here for the user to examine the cards and click continue.
  }, [cards, isBombshell]);

  // ── Mobile tap-to-rip (fallback for when drag is difficult) ─────────
  const handlePackTap = useCallback(() => {
    if (phase !== 'idle') return;
    setPhase('grip');
    if (isBombshell) {
      playCrinkle();
      playBombshellHeartbeat();
    } else {
      playCrinkle();
    }
    // Auto-advance through tension to rip after a brief grip
    setTimeout(() => {
      setPhase('tension');
      playTension();
      setTimeout(() => {
        triggerRevealSequence();
      }, 350);
    }, 300);
  }, [phase, isBombshell, triggerRevealSequence]);

  // ── Hover/Inspect/Lock Logic ─────────────────────────────────────────

  const handleCardHover = (index: number | null) => {
    if (phase !== 'layout' && phase !== 'inspect') return;
    setInspectIndex(index);
    if (index !== null) setPhase('inspect');
    else setPhase('layout');
  };

  const handleCardClick = (index: number) => {
    if (phase !== 'layout' && phase !== 'inspect') return;
    setExpandedIndex(prev => prev === index ? null : index);
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;
    if (!hasInteracted) setHasInteracted(true);
    const rect = containerRef.current.getBoundingClientRect();
    setMousePos({
      x: ((e.clientX - rect.left) / rect.width - 0.5) * 2,
      y: ((e.clientY - rect.top) / rect.height - 0.5) * 2,
    });
  }, [hasInteracted]);

  const triggerShardBurst = useCallback(() => {
    setDecrypterPhase('bursting');
    playTear();
    playSnap();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rewardColors = fragmentRewards.map(r => RARITY_CONFIG[r.rarity]?.color).filter(Boolean);
    const colors = rewardColors.length > 0 ? rewardColors : [
      '#39FF14', // Neon Green
      '#00F0FF', // Neon Cyan
      '#FF007F', // Neon Pink
      '#FFB800', // Neon Gold
      '#BD00FF', // Neon Purple
    ];

    const particles: ShardParticle[] = [];
    const count = Math.max(80, Math.min(150, fragmentRewards.length * 20));
    
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 4 + Math.random() * 9;
      
      particles.push({
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 5, // Shoot upward bias
        size: 5 + Math.random() * 8,
        color: colors[Math.floor(Math.random() * colors.length)],
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.2,
        alpha: 1,
        decay: 0.012 + Math.random() * 0.012,
        points: Math.floor(Math.random() * 3) + 3, // 3 to 5 points
      });
    }

    particlesRef.current = particles;

    let startTimestamp: number | null = null;
    const loop = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const elapsed = timestamp - startTimestamp;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const activeParticles = particlesRef.current.filter((p) => p.alpha > 0);
      
      for (const p of activeParticles) {
        // Apply physics
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.16; // Gravity
        p.vx *= 0.97; // Drag
        p.vy *= 0.97;
        p.angle += p.spin;
        p.alpha -= p.decay;

        // Draw glowing crystal shard
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 12;
        ctx.shadowColor = p.color;

        ctx.beginPath();
        for (let j = 0; j < p.points; j++) {
          const shardAngle = (j * Math.PI * 2) / p.points;
          const r = j % 2 === 0 ? p.size : p.size / 2; // Make it star-like/crystal-like
          const px = Math.cos(shardAngle) * r;
          const py = Math.sin(shardAngle) * r;
          if (j === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      particlesRef.current = activeParticles;

      // Transition to revealed phase once particles settle
      if (elapsed > 1500) {
        setDecrypterPhase('revealed');
        playShimmer();

        const hasUnlocks = fragmentRewards.some(r => r.unlocked);
        if (hasUnlocks) {
          setTimeout(() => {
            playUnlockChime();
          }, 400);
        }
      }

      if (activeParticles.length > 0 || elapsed < 1600) {
        animationFrameRef.current = requestAnimationFrame(loop);
      }
    };

    animationFrameRef.current = requestAnimationFrame(loop);
  }, [fragmentRewards]);

  const handleDecryptPodTap = useCallback(() => {
    if (decrypterPhase !== 'idle') return;
    setDecrypterPhase('shaking');
    playTension();
    
    setTimeout(() => {
      triggerShardBurst();
    }, 800);
  }, [decrypterPhase, triggerShardBurst]);


  // ── Card offset properties ──────────────────────────────

  const showPack = ['idle', 'grip', 'tension', 'tearing', 'snap'].includes(phase);
  const showCards = ['pause', 'rise', 'flipping', 'layout', 'inspect'].includes(phase);

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      style={{
        position: 'fixed', inset: 0, zIndex: 80,
        background: '#050402',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', cursor: phase === 'idle' ? 'pointer' : 'default',
      }}
    >
      <style>{shimmerKeyframes}</style>
      <GrainOverlay />
      <FXLayer phase={phase} accent={meta.accent} />

      {/* ── PRELOADING UI ───────────────────────────────────────── */}
      <AnimatePresence>
        {phase === 'preloading' && (
          <motion.div
            key="preloader"
            exit={{ opacity: 0 }}
            style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              zIndex: 400, background: '#050402'
            }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
              style={{
                width: '40px', height: '40px',
                border: '2px solid rgba(255,255,255,0.1)',
                borderTop: `2px solid ${meta.accent}`,
                borderRadius: '50%',
                marginBottom: '20px'
              }}
            />
            <div style={{
              fontFamily: '"JetBrains Mono", monospace', fontSize: '10px',
              color: 'rgba(255,255,255,0.5)', letterSpacing: '0.2em'
            }}>
              DECRYPTING ASSETS...
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ambient glow */}
      <motion.div
        animate={{ opacity: [0.2, 0.45, 0.2], scale: [1, 1.12, 1] }}
        transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
        style={{
          position: 'absolute', width: 'min(600px, 150vw)', height: 'min(600px, 150vw)', borderRadius: '50%',
          background: isBombshell 
            ? 'radial-gradient(ellipse, rgba(255,20,147,0.35), rgba(139,0,139,0.15), transparent 70%)'
            : `radial-gradient(ellipse, ${meta.accent}25, transparent 70%)`,
          filter: 'blur(80px)', pointerEvents: 'none',
        }}
      />

      {/* ── BOMBSHELL AMBIENT GLAMOUR PARTICLES ── */}
      {isBombshell && (
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 15, overflow: 'hidden' }}>
          {Array.from({ length: 22 }).map((_, i) => (
            <motion.div
              key={`petal-${i}`}
              initial={{
                x: `${(i * 17) % 100}vw`,
                y: '-20px',
                opacity: 0,
                rotate: 0,
                scale: 0.6 + ((i % 5) * 0.15),
              }}
              animate={{
                y: '110vh',
                x: `${((i * 17) % 100) + Math.sin(i) * 15}vw`,
                opacity: [0, 0.7, 0.7, 0],
                rotate: [0, 180, 360],
              }}
              transition={{
                duration: 5.5 + (i % 6) * 1.5,
                repeat: Infinity,
                delay: (i * 0.3) % 4,
                ease: 'linear',
              }}
              style={{
                position: 'absolute',
                width: i % 2 === 0 ? '7px' : '4px',
                height: i % 2 === 0 ? '11px' : '4px',
                borderRadius: i % 2 === 0 ? '50% 0 50% 50%' : '50%',
                background: i % 3 === 0 
                  ? 'radial-gradient(circle, #ff69b4, #ff1493)' 
                  : i % 3 === 1 
                  ? 'radial-gradient(circle, #ffffff, #ff69b4)' 
                  : 'radial-gradient(circle, #ff1493, #79003e)',
                filter: `blur(${i % 2 === 0 ? 0.5 : 1}px) drop-shadow(0 0 6px #ff1493)`,
              }}
            />
          ))}
        </div>
      )}

      {/* ── PACK SHELL ──────────────────────────────────────────── */}
      <AnimatePresence>
        {showPack && (
          <motion.div
            key="pack-wrapper"
            // Drag Interactive (desktop) + tap fallback (mobile)
            drag={['idle', 'grip', 'tension'].includes(phase) ? 'y' : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDragStart={() => {
              if (phase !== 'idle') return;
              setPhase('grip');
              playCrinkle();
            }}
            onDrag={(_, info) => {
              if (!['idle', 'grip', 'tension'].includes(phase)) return;
              const y = info.offset.y;

              if (y > 40 && phase !== 'tension') {
                setPhase('tension');
                playTension();
              }

              if (y > 150) {
                // Drag threshold passed! Trigger tear and snap
                triggerRevealSequence();
              }
            }}
            onDragEnd={(_, info) => {
              // Return to idle if drag didn't pass rip threshold
              if (['grip', 'tension'].includes(phase) && info.offset.y <= 150) {
                setPhase('idle');
              }
            }}
            // Mobile tap-to-rip fallback
            onClick={handlePackTap}
            // Idle float
            animate={
              phase === 'idle'
                ? { y: [-4, 4, -4], rotate: [-1, 1, -1], scale: 1 }
                : phase === 'grip'
                ? { y: 0, rotate: 0, scale: [1, 0.96, 0.96, 0.94], x: [0, -2, 2, -2, 2, -1, 1, 0] }
                : phase === 'tension'
                ? { y: 0, rotate: 0, scale: 0.94, scaleY: 1.08 }
                : phase === 'tearing'
                ? { y: 0, rotate: 0, scale: 0.94 }
                : phase === 'snap'
                ? { y: 0, rotate: 0, scale: 1.05 }
                : {}
            }
            transition={
              phase === 'idle'
                ? { duration: 4, repeat: Infinity, ease: 'easeInOut' }
                : phase === 'grip'
                ? { duration: 0.4, ease: [0.36, 0.07, 0.19, 0.97] }
                : phase === 'tension'
                ? { duration: 0.3, ease: 'easeOut' }
                : { duration: 0.12 }
            }
            exit={{ opacity: 0, scale: 0.8 }}
            style={{
              position: 'relative', width: '220px', height: '300px',
              perspective: '800px',
            }}
          >
            <PackShell meta={activeMeta} phase={phase} sampleCard={cards?.[0]?.card} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── TAP PROMPT ──────────────────────────────────────────── */}
      <AnimatePresence>
        {phase === 'idle' && (
          <motion.div
            key="prompt"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            style={{ textAlign: 'center', pointerEvents: 'none', marginTop: '24px' }}
          >
            <motion.p
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
              style={{
                fontFamily: '"JetBrains Mono", monospace', fontSize: '11px',
                fontWeight: 700, letterSpacing: '0.35em', textTransform: 'uppercase',
                color: meta.accent,
              }}
            >
              PULL TO RIP · TAP TO OPEN
            </motion.p>
            <p style={{
              fontFamily: '"JetBrains Mono", monospace', fontSize: '9px',
              letterSpacing: '0.15em', marginTop: '6px', opacity: 0.25,
              color: '#fff', textTransform: 'uppercase',
            }}>
              {meta.cardCount} card{meta.cardCount > 1 ? 's' : ''} inside
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── CARD STACK ──────────────────────────────────────────── */}
      <AnimatePresence>
        {showCards && (
          <motion.div
            key="card-stack"
            initial={{ opacity: 0, y: 10 }}
            animate={{
              opacity: 1,
              y: phase === 'rise' ? -20 : 0,
              rotateX: phase === 'rise' ? 10 : 0,
            }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            style={{
              display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              gap: phase === 'layout' || phase === 'inspect' ? '0px' : '0px',
              perspective: '1200px',
              position: 'relative',
              minHeight: '340px',
              width: '100%',
            }}
          >
            {/* Near-miss gold flash */}
            <AnimatePresence>
              {nearMissFlash && (
                <motion.div
                  key="near-miss"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 0.8, 0] }}
                  transition={{ duration: 0.12 }}
                  style={{
                    position: 'fixed', inset: 0, zIndex: 200,
                    background: 'radial-gradient(circle, rgba(255,215,0,0.4), transparent 70%)',
                    pointerEvents: 'none',
                  }}
                />
              )}
            </AnimatePresence>

            {/* Dim overlay behind expanded card (internal to stacking context) */}
            <AnimatePresence>
              {expandedIndex !== null && (phase === 'layout' || phase === 'inspect') && (
                <motion.div
                  key="expand-dim"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.7 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setExpandedIndex(null)}
                  style={{
                    position: 'fixed', inset: 0,
                    background: '#000', zIndex: 210, // Above normal cards (0-200), below expanded (250)
                    cursor: 'pointer',
                  }}
                />
              )}
            </AnimatePresence>

            {cards.map((owned, i) => {
              const rarity = owned.card.rarity as Rarity;
              const rarityColor = RARITY_CONFIG[rarity]?.color || '#fff';
              const isRevealed = flippedCards.has(i);
              const isCurrentFlip = flipIndex === i;
              const isRare = isRareOrHigher(rarity);
              const isInLayout = phase === 'layout' || phase === 'inspect';
              const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

              let targetX = 0;
              let targetY = i * 2; // Default stack offset
              let targetRotate = 0;
              let baseScale = 1;

              if (isInLayout) {
                // Determine max columns based on screen size and pack size
                const maxCols = isMobile ? Math.min(3, cards.length) : (cards.length > 5 ? 5 : cards.length);
                
                // Calculate grid indices
                const row = Math.floor(i / maxCols);
                const col = i % maxCols;

                // Center the specific row if it's the last row and not completely full
                const cardsInRow = Math.min(maxCols, cards.length - row * maxCols);
                const rowCenter = (cardsInRow - 1) / 2;

                // Vertically center the entire block
                const totalRows = Math.ceil(cards.length / maxCols);
                const verticalCenterOffset = (totalRows - 1) / 2;

                // Optimal scaling for large packs
                baseScale = isMobile 
                  ? (cards.length > 6 ? 0.35 : 0.45) 
                  : (cards.length > 5 ? 0.5 : 0.7);

                const stepX = isMobile 
                  ? (cards.length > 6 ? 85 : 120)
                  : (cards.length > 5 ? 130 : 170);
                  
                const stepY = isMobile 
                  ? (cards.length > 6 ? 120 : 160)
                  : (cards.length > 5 ? 180 : 230);

                targetX = (col - rowCenter) * stepX;
                targetY = (row - verticalCenterOffset) * stepY;
                
                // Slight organic rotation fan for each card in the row
                targetRotate = (col - rowCenter) * (isMobile ? 1.5 : 2.5);

                // If expanded or hovered
                if (expandedIndex === i) {
                  targetX = 0;
                  targetY = 0;
                  targetRotate = 0; // Straighten when inspecting
                  baseScale = isMobile ? 1.2 : 1.8;
                } else if (inspectIndex === i) {
                  targetY -= isMobile ? 10 : 20; // Raise slightly
                  baseScale *= 1.05; // Very slight scale on hover
                  targetRotate *= 0.9; // Lessen rotation slightly
                }
              }

              // Reveal pause glow intensity based on rarity
              const glowIntensity = phase === 'pause'
                ? (rarity === 'mythic' ? 0.8 : rarity === 'legendary' ? 0.5 : rarity === 'rare' ? 0.35 : 0.15)
                : 0;

              // Inspection tilt
              const isInspecting = expandedIndex === i || inspectIndex === i;
              const tiltX = isInspecting ? mousePos.y * (isMobile ? 0 : 12) : 0;
              const tiltY = isInspecting ? mousePos.x * (isMobile ? 0 : 12) : 0;

              return (
                <motion.div
                  key={owned.id}
                  onClick={() => handleCardClick(i)}
                  animate={{
                    x: targetX,
                    y: targetY,
                    rotate: targetRotate,
                    rotateX: tiltX,
                    rotateY: tiltY,
                    scale: rareRevealing && isCurrentFlip ? 1.08 : baseScale,
                    opacity: (!isRevealed && phase === 'flipping' && i > flipIndex) ? 0.6 : 1,
                  }}
                  transition={{
                    type: 'spring', stiffness: 300, damping: 25,
                    ...(isInLayout ? { delay: i * 0.06 } : {}),
                  }}
                  style={{
                    position: 'absolute',
                    width: '220px',
                    zIndex: expandedIndex === i ? 250 : (inspectIndex === i ? 200 : (isCurrentFlip ? 50 : i)),
                    cursor: isInLayout ? 'pointer' : 'default',
                    transformStyle: 'preserve-3d',
                  }}
                  onMouseEnter={() => handleCardHover(i)}
                  onMouseLeave={() => handleCardHover(null)}
                >
                  {/* Rarity glow under card during pause */}
                  {phase === 'pause' && (
                    <motion.div
                      animate={{ opacity: [glowIntensity * 0.5, glowIntensity, glowIntensity * 0.5] }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                      style={{
                        position: 'absolute', inset: '-16px', borderRadius: '16px',
                        background: `radial-gradient(ellipse, ${rarityColor}40, transparent 70%)`,
                        filter: 'blur(12px)', pointerEvents: 'none', zIndex: -1,
                      }}
                    />
                  )}

                  {/* Card shake during pause */}
                  <motion.div
                    animate={phase === 'pause' ? { x: [-1, 1, -1] } : {}}
                    transition={phase === 'pause' ? { repeat: Infinity, duration: 0.3 } : {}}
                  >
                        {/* Foil shimmer for rare+ */}
                        {isRare && isRevealed && (
                          <div style={{
                            position: 'absolute', inset: 0, borderRadius: '12px', zIndex: 10,
                            pointerEvents: 'none', overflow: 'hidden',
                            mixBlendMode: 'overlay',
                          }}>
                            <div style={{
                              position: 'absolute', inset: '-100%',
                              background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0) 40%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0) 60%, transparent 100%)',
                              animation: 'cine-shimmer 2.5s cubic-bezier(0.4, 0, 0.2, 1) infinite',
                              willChange: 'transform',
                              transform: 'translateZ(0)',
                            }} />
                          </div>
                        )}

                        {/* Screen flash on rare impact */}
                        {isRare && isCurrentFlip && isRevealed && (
                          <motion.div
                            initial={{ opacity: 0.8 }}
                            animate={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            style={{
                              position: 'fixed', inset: 0,
                              background: '#fff', zIndex: 300, pointerEvents: 'none',
                            }}
                          />
                        )}

                        <Card 
                            card={owned.card}
                            edition={owned.edition}
                            interactive={true} 
                            showAudio={false} 
                            isDailyOrigin={owned.source === 'daily_claim' || owned.source === 'pack_miss_out'} 
                            ultraReward={owned.ultraReward} 
                            isRevealed={isRevealed}
                            isEcho={owned.isEcho}
                            echoGeneration={owned.echoGeneration}
                        />
                        {isRevealed && (
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} style={{ marginTop: '8px', textAlign: 'center' }}>
                            <RarityBadge rarity={rarity} size="sm" />
                          </motion.div>
                        )}
                  </motion.div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ultra reward crackling overlay */}
      <AnimatePresence>
        {ultraTriggered && (
          <motion.div
            key="ultra"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0.7, 1, 0] }}
            transition={{ duration: 0.6 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 250, pointerEvents: 'none',
              background: 'radial-gradient(circle, rgba(255,215,0,0.3), rgba(255,100,0,0.15), transparent 70%)',
            }}
          >
            {/* Gold fracture lines */}
            {Array.from({ length: 8 }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: [0, 1, 0] }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                style={{
                  position: 'absolute',
                  top: `${30 + Math.random() * 40}%`,
                  left: `${20 + Math.random() * 60}%`,
                  width: `${40 + Math.random() * 80}px`,
                  height: '2px',
                  background: 'linear-gradient(90deg, transparent, #ffd700, transparent)',
                  transform: `rotate(${Math.random() * 360}deg)`,
                  transformOrigin: 'left center',
                  filter: 'blur(0.5px)',
                }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Flip counter + Fast Reveal Button */}
      <AnimatePresence>
        {phase === 'flipping' && (
          <motion.div
            key="flipping-hud"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            style={{
              position: 'fixed', bottom: '40px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
              zIndex: 350,
            }}
          >
            {flipIndex >= 0 && (
              <div
                style={{
                  fontFamily: '"JetBrains Mono", monospace', fontSize: '11px',
                  fontWeight: 800, letterSpacing: '0.3em', textTransform: 'uppercase',
                  color: isBombshell ? '#FF1493' : 'rgba(255,255,255,0.45)',
                  textShadow: isBombshell ? '0 0 10px #FF1493' : 'none',
                }}
              >
                CARD {flipIndex + 1} / {cards.length}
              </div>
            )}
            {cards.length > 1 && (
              <motion.button
                onClick={handleFastReveal}
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.94 }}
                style={{
                  padding: '8px 18px',
                  background: 'rgba(5,4,2,0.85)',
                  border: `1.5px solid ${isBombshell ? '#FF1493' : 'rgba(255,255,255,0.3)'}`,
                  borderRadius: '20px',
                  color: '#fff',
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: '10px',
                  fontWeight: 900,
                  letterSpacing: '0.15em',
                  cursor: 'pointer',
                  backdropFilter: 'blur(10px)',
                  boxShadow: isBombshell ? '0 0 18px rgba(255,20,147,0.4)' : '0 4px 14px rgba(0,0,0,0.5)',
                }}
              >
                [ ⚡ FLIP ALL ]
              </motion.button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Continue Button */}
      <AnimatePresence>
        {(phase === 'layout' || phase === 'inspect') && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            style={{
              position: 'fixed', bottom: '40px',
              display: 'flex', gap: '12px', zIndex: 300,
            }}
          >
            {onBuyAnother && (
              <motion.button
                onClick={onBuyAnother}
                disabled={isRepurchasing}
                style={{
                  padding: '12px 24px', borderRadius: '8px',
                  background: `${meta.accent}18`,
                  color: '#fff',
                  fontFamily: '"JetBrains Mono", monospace', fontWeight: 900,
                  letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: '12px',
                  border: `1px solid ${meta.accent}40`,
                  cursor: isRepurchasing ? 'default' : 'pointer',
                  opacity: isRepurchasing ? 0.5 : 1,
                  backdropFilter: 'blur(10px)',
                }}
                whileHover={!isRepurchasing ? { scale: 1.05 } : {}}
                whileTap={!isRepurchasing ? { scale: 0.98 } : {}}
              >
                {isRepurchasing ? 'RIPPING...' : 'RIP ANOTHER'}
              </motion.button>
            )}
            <motion.button
              onClick={handleStartDecrypter}
              style={{
                padding: '12px 24px', borderRadius: '8px',
                background: 'linear-gradient(135deg, #00f0ff, #7000ff)',
                color: '#fff',
                fontFamily: '"JetBrains Mono", monospace', fontWeight: 900,
                letterSpacing: '0.15em', textTransform: 'uppercase', fontSize: '11px',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 8px 32px rgba(0,240,255,0.25)'
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
            >
              [ Decrypt Fragments ]
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── FIRST-TIME UNLOCK OVERLAY ────────────────────────────── */}
      <AnimatePresence>
        {firstUnlockCard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1000,
              background: '#050402',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              padding: '24px'
            }}
          >
            {/* Pulsing glow background in rarity color */}
            <motion.div
              animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.15, 1] }}
              transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
              style={{
                position: 'absolute',
                width: '600px',
                height: '600px',
                borderRadius: '50%',
                background: `radial-gradient(circle, ${RARITY_CONFIG[firstUnlockCard.card.rarity]?.color || '#ffd700'}30, transparent 75%)`,
                filter: 'blur(80px)',
                pointerEvents: 'none',
              }}
            />

            {/* Scanning monitor scanlines */}
            <div style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 0, 0, 0.15) 2px, rgba(0, 0, 0, 0.15) 4px)'
            }} />

            {/* Underground header */}
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              style={{ textAlign: 'center', zIndex: 10, marginBottom: '32px' }}
            >
              <div style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: '11px',
                fontWeight: 900,
                color: RARITY_CONFIG[firstUnlockCard.card.rarity]?.color || '#ffd700',
                letterSpacing: '0.4em',
                textTransform: 'uppercase',
                textShadow: `0 0 10px ${RARITY_CONFIG[firstUnlockCard.card.rarity]?.color || '#ffd700'}50`
              }}>
                [ NEW SIGNAL UNLOCKED ]
              </div>
              <div style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: '8px',
                color: 'rgba(255,255,255,0.4)',
                letterSpacing: '0.2em',
                marginTop: '6px',
                textTransform: 'uppercase'
              }}>
                Neural Compatibility Confirmed // Minting Provenance
              </div>
            </motion.div>

            {/* Rising card in the center */}
            <motion.div
              initial={{ scale: 0.3, rotateY: -180, y: 100, opacity: 0 }}
              animate={{ scale: 1.15, rotateY: 0, y: 0, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0, transition: { duration: 0.2 } }}
              transition={{ type: 'spring', stiffness: 180, damping: 20, delay: 0.3 }}
              style={{
                perspective: '1000px',
                zIndex: 10,
                marginBottom: '40px',
                filter: `drop-shadow(0 0 35px ${RARITY_CONFIG[firstUnlockCard.card.rarity]?.color || '#ffd700'}30)`
              }}
            >
              <Card card={firstUnlockCard.card} interactive={false} showAudio={false} isRevealed={true} />
            </motion.div>

            {/* Title / Artist details */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
              style={{ textAlign: 'center', zIndex: 10, marginBottom: '36px', maxWidth: '300px' }}
            >
              <h2 style={{
                fontFamily: 'Impact, sans-serif',
                fontSize: '24px',
                fontWeight: 900,
                color: '#fff',
                margin: 0,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                transform: 'scaleY(1.15)'
              }}>
                {firstUnlockCard.card.title}
              </h2>
              <p style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: '11px',
                color: 'rgba(255,255,255,0.5)',
                margin: '8px 0 0',
                letterSpacing: '0.15em',
                textTransform: 'uppercase'
              }}>
                by {(firstUnlockCard.card as any).artist || 'TH3SCR1B3'}
              </p>
            </motion.div>

            {/* Continue / Integrate Button */}
            <motion.button
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.8 }}
              onClick={() => {
                if (unlockResolveRef.current) {
                  unlockResolveRef.current();
                  unlockResolveRef.current = null;
                }
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              style={{
                zIndex: 10,
                padding: '14px 32px',
                background: RARITY_CONFIG[firstUnlockCard.card.rarity]?.color || '#ffd700',
                color: '#000',
                fontFamily: '"JetBrains Mono", monospace',
                fontWeight: 900,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                fontSize: '12px',
                border: 'none',
                cursor: 'pointer',
                boxShadow: `0 8px 32px ${RARITY_CONFIG[firstUnlockCard.card.rarity]?.color || '#ffd700'}30`,
                borderRadius: '4px'
              }}
            >
              [ INTEGRATE SIGNAL ]
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── NEURAL FRAGMENT DECRYPTOR OVERLAY ───────────────────────── */}
      <AnimatePresence>
        {showFragmentDecrypter && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 900,
              background: '#050402',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px',
            }}
          >
            {/* Scanlines overlay */}
            <div style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              zIndex: 10,
              background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 0, 0, 0.15) 2px, rgba(0, 0, 0, 0.15) 4px)'
            }} />

            {/* Neon ambient glow */}
            <motion.div
              animate={{ opacity: [0.2, 0.4, 0.2], scale: [1, 1.15, 1] }}
              transition={{ repeat: Infinity, duration: 4.5, ease: 'easeInOut' }}
              style={{
                position: 'absolute', width: '600px', height: '600px', borderRadius: '50%',
                background: 'radial-gradient(circle, #00f0ff20, #7000ff10, transparent 70%)',
                filter: 'blur(100px)', pointerEvents: 'none',
              }}
            />

            {/* Canvas Layer for Shards */}
            <canvas
              ref={canvasRef}
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 85,
                pointerEvents: 'none',
              }}
            />

            {/* Closed/Shaking Bag Phase */}
            {(decrypterPhase === 'idle' || decrypterPhase === 'shaking') && (
              <div className="flex flex-col items-center gap-8 z-20 select-none">
                {/* Cyberpunk Header */}
                <div className="text-center space-y-2">
                  <div style={{
                    fontFamily: '"JetBrains Mono", monospace', fontSize: '10px',
                    fontWeight: 900, color: '#ffb800', letterSpacing: '0.4em',
                    textShadow: '0 0 10px rgba(255,184,0,0.4)', textTransform: 'uppercase',
                  }}>
                    [ NEURAL DECRYPTOR BAG v2.0 ]
                  </div>
                  <div style={{
                    fontFamily: '"JetBrains Mono", monospace', fontSize: '8px',
                    color: 'rgba(255,255,255,0.4)', letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                  }}>
                    ESTABLISHING DENSITY CORRELATION DATA
                  </div>
                </div>

                {/* Glowing Pouch Pushing / Shaking */}
                <motion.div
                  onClick={handleDecryptPodTap}
                  animate={
                    decrypterPhase === 'shaking'
                      ? {
                          x: [0, -8, 8, -6, 6, -3, 3, 0],
                          y: [0, 4, -4, 3, -3, 1, -1, 0],
                          scale: [1, 1.15, 1.25, 1.2, 1.3, 1.25, 1.35, 1.25],
                          rotate: [0, -4, 4, -3, 3, -1, 1, 0],
                        }
                      : {
                          y: [0, -10, 0],
                          scale: [1, 1.04, 1],
                        }
                  }
                  transition={
                    decrypterPhase === 'shaking'
                      ? { duration: 0.8, ease: 'easeInOut' }
                      : { repeat: Infinity, duration: 3, ease: 'easeInOut' }
                  }
                  style={{
                    width: '160px', height: '160px',
                    position: 'relative',
                    cursor: 'pointer',
                  }}
                  className="filter drop-shadow-[0_0_35px_rgba(255,184,0,0.4)]"
                >
                  {/* Premium Vector SVG Cyber Pouch */}
                  <svg viewBox="0 0 120 120" className="w-full h-full">
                    <defs>
                      <linearGradient id="bagGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#1a1200" />
                        <stop offset="50%" stopColor="#0a0700" />
                        <stop offset="100%" stopColor="#251a02" />
                      </linearGradient>
                      <linearGradient id="neonTrim" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#ffb800" />
                        <stop offset="50%" stopColor="#ff5500" />
                        <stop offset="100%" stopColor="#ffb800" />
                      </linearGradient>
                    </defs>

                    {/* Draw string ties */}
                    <path d="M 50,22 Q 60,35 70,22 M 45,20 L 35,15 M 75,20 L 85,15" stroke="#ffb800" strokeWidth="2.5" fill="none" strokeLinecap="round" />

                    {/* Hexagonal Bag body */}
                    <path
                      d="M 60,18 L 92,38 L 98,82 L 60,108 L 22,82 L 28,38 Z"
                      fill="url(#bagGrad)"
                      stroke="url(#neonTrim)"
                      strokeWidth="2.5"
                      strokeLinejoin="round"
                    />

                    {/* Futuristic detailing panels */}
                    <path d="M 34,42 L 54,34 L 54,92 L 28,78 Z" fill="#ffffff" fillOpacity="0.03" />
                    <path d="M 86,42 L 66,34 L 66,92 L 92,78 Z" fill="#ffffff" fillOpacity="0.03" />

                    {/* Matrix circuit lines */}
                    <path d="M 30,55 L 42,50 L 42,75" stroke="#ffb800" strokeWidth="1.5" strokeOpacity="0.4" fill="none" />
                    <path d="M 90,55 L 78,50 L 78,75" stroke="#ffb800" strokeWidth="1.5" strokeOpacity="0.4" fill="none" />

                    {/* central power core padlock */}
                    <circle cx="60" cy="62" r="14" fill="#111" stroke="#ffb800" strokeWidth="2" />
                    
                    {/* Glow Core */}
                    <circle cx="60" cy="62" r="8" fill="#ffb800" className="animate-pulse" />

                    {/* Lock icon grid */}
                    <path d="M 56,60 L 64,60 M 60,56 L 60,68" stroke="#000" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </motion.div>

                {/* Tap Prompt */}
                <div className="text-center space-y-2 pointer-events-none">
                  <motion.p
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
                    style={{
                      fontFamily: '"JetBrains Mono", monospace', fontSize: '11px',
                      fontWeight: 900, letterSpacing: '0.3em', textTransform: 'uppercase',
                      color: '#ffb800',
                    }}
                  >
                    {decrypterPhase === 'shaking' ? '✦ DECRYPTING TRANSMISSION ✦' : '✦ CLICK BAG TO DECRYPT ✦'}
                  </motion.p>
                  <p style={{
                    fontFamily: '"JetBrains Mono", monospace', fontSize: '8px',
                    letterSpacing: '0.12em', opacity: 0.3, color: '#fff',
                  }}>
                    EXTRACTS {accumulatedCards.map(c => {
                      const rarity = c.card.rarity;
                      return rarity === 'common' ? 2 : rarity === 'uncommon' ? 3 : rarity === 'rare' ? 5 : 10;
                    }).reduce((a, b) => a + b, 0)} TOTAL FRAGMENTS
                  </p>
                </div>
              </div>
            )}

            {decrypterPhase === 'bursting' && (
              <motion.div
                key="burst-core"
                initial={{ scale: 0 }}
                animate={{ scale: [1, 2.5, 2], opacity: [0.8, 1, 0] }}
                transition={{ duration: 0.8 }}
                style={{
                  position: 'absolute',
                  width: '120px',
                  height: '120px',
                  borderRadius: '50%',
                  background: '#ffb800',
                  filter: 'blur(20px)',
                  pointerEvents: 'none',
                  zIndex: 20,
                }}
              />
            )}

            {/* Full Screen White Flash Overlay */}
            <AnimatePresence>
              {decrypterPhase === 'bursting' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 0.95, 0] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  style={{
                    position: 'fixed', inset: 0, zIndex: 1000,
                    background: '#ffb800',
                    pointerEvents: 'none',
                  }}
                />
              )}
            </AnimatePresence>

            {decrypterPhase === 'revealed' && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-lg flex flex-col items-center gap-6 z-20"
              >
                {/* Title */}
                <div className="text-center space-y-1.5">
                  <h3 style={{
                    fontFamily: '"Impact", "Arial Black", sans-serif',
                    fontSize: '28px', color: '#fff', textTransform: 'uppercase',
                    letterSpacing: '0.05em', transform: 'scaleY(1.15)',
                    textShadow: '0 0 20px rgba(0,240,255,0.4)', margin: 0
                  }}>
                    FRAGMENTS EXTRACTED
                  </h3>
                  <p style={{
                    fontFamily: '"JetBrains Mono", monospace', fontSize: '9px',
                    color: 'rgba(255,255,255,0.4)', letterSpacing: '0.15em',
                    textTransform: 'uppercase'
                  }}>
                    Integrations synced to local cache
                  </p>
                </div>

                {/* Rewards Grid */}
                <div className="w-full space-y-4 max-h-[50vh] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                  {fragmentRewards.map((rew, index) => {
                    const rarityColor = RARITY_CONFIG[rew.rarity]?.color || '#fff';
                    return (
                      <motion.div
                        key={`${rew.cardId}-${index}`}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.15 }}
                        className="flex items-center gap-4 border-2 border-black p-3.5 relative overflow-hidden"
                        style={{
                          background: '#0d0d0d',
                          boxShadow: '4px 4px 0 #000',
                          border: `1.5px solid ${rarityColor}35`,
                        }}
                      >
                        <FragmentRewardImgItem
                          coverUrl={rew.coverArt}
                          rarity={rew.rarity}
                          title={rew.title}
                        />

                        {/* Song Details & Progress */}
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex justify-between items-start gap-2">
                            <div className="min-w-0">
                              <div
                                className="font-black truncate leading-tight text-sm uppercase"
                                style={{ fontFamily: '"Impact", "Arial Black", sans-serif', color: '#fff' }}
                              >
                                {rew.title}
                              </div>
                              <div className="text-[9px] font-mono opacity-50 truncate uppercase tracking-wider">
                                by {rew.artist}
                              </div>
                            </div>
                            
                            <div className="flex-shrink-0 text-right">
                              <span
                                className="text-xs font-black italic tracking-tight font-mono"
                                style={{ color: '#00f0ff' }}
                              >
                                +{rew.added} FRAGS
                              </span>
                            </div>
                          </div>

                          {/* Progress Bar Container */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-[8px] font-mono">
                              <span style={{ color: rarityColor }} className="uppercase font-bold tracking-widest">
                                {rew.rarity}
                              </span>
                              <span style={{ color: '#fff' }} className="font-bold">
                                {rew.newTotal} / 10 FRAGMENTS
                              </span>
                            </div>
                            
                            <div className="h-2 w-full bg-black/80 rounded-full overflow-hidden border border-white/5 relative">
                              {/* Old Total Bar */}
                              <div
                                className="absolute left-0 top-0 bottom-0 rounded-full"
                                style={{
                                  width: `${(rew.oldTotal / 10) * 100}%`,
                                  background: 'rgba(255,255,255,0.15)',
                                }}
                              />
                              {/* Animated Added Bar */}
                              <motion.div
                                initial={{ width: `${(rew.oldTotal / 10) * 100}%` }}
                                animate={{ width: `${(rew.newTotal / 10) * 100}%` }}
                                transition={{ duration: 1.2, delay: index * 0.15 + 0.3, ease: 'easeOut' }}
                                className="absolute left-0 top-0 bottom-0 rounded-full"
                                style={{
                                  background: `linear-gradient(90deg, ${rarityColor}, #00f0ff)`,
                                  boxShadow: `0 0 8px ${rarityColor}`,
                                }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Blinking unlocked notification banner */}
                        {rew.newTotal >= 10 && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: [0, 1, 0.4, 1], scale: 1 }}
                            transition={{ duration: 0.8, delay: index * 0.15 + 0.9 }}
                            className="absolute right-3 bottom-2 px-2 py-0.5 text-[8px] font-mono font-black rounded"
                            style={{
                              background: 'rgba(0, 240, 255, 0.15)',
                              border: '1px solid #00f0ff',
                              color: '#00f0ff',
                              boxShadow: '0 0 10px rgba(0, 240, 255, 0.3)',
                              letterSpacing: '0.15em',
                              textTransform: 'uppercase',
                            }}
                          >
                            UNLOCKED
                          </motion.div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>

                {/* Continue CTA */}
                <motion.button
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: fragmentRewards.length * 0.15 + 1.2 }}
                  onClick={onComplete}
                  className="w-full py-4 text-sm font-black italic tracking-wider uppercase border-2 border-black drop-shadow-[0_0_20px_rgba(255,215,0,0.3)] cursor-pointer"
                  style={{
                    background: 'linear-gradient(135deg, #ffd700, #ffaa00)',
                    color: '#000',
                    fontFamily: '"Impact", "Arial Black", sans-serif',
                    transform: 'rotate(-0.5deg)',
                    boxShadow: '4px 4px 0 #000',
                  }}
                >
                  {meta.category === 'daily_claim' || meta.redirectPath === '/tutorial' || meta.redirectPath?.startsWith('/play/') ? '[ START PIM GATEWAY ]' : '[ COMPLETE SYNC ]'}
                </motion.button>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
