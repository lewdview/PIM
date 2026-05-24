import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Clock, Gift } from 'lucide-react';
import type { VaultCard } from '../services/vaultService';
import { getClaimedCountForDay } from '../services/vaultService';
import { RARITY_CONFIG } from '../utils/rarity';
import RarityBadge from './RarityBadge';
import AudioPreview from './AudioPreview';
import { formatDate, getTimeUntilNextDay } from '../utils/dayCalc';

interface HeroCardProps {
  card: VaultCard;
  hasClaimed: boolean;
  onClaim: () => void;
  day: number;
}

export default function HeroCard({ card, hasClaimed, onClaim, day }: HeroCardProps) {
  const [countdown, setCountdown] = useState(getTimeUntilNextDay());
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const [isHovering, setIsHovering] = useState(false);
  const [isFaceDown, setIsFaceDown] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [realClaimedCount, setRealClaimedCount] = useState<number>(0);

  const rc = RARITY_CONFIG[card.rarity] || RARITY_CONFIG.common;

  useEffect(() => {
    const interval = setInterval(() => setCountdown(getTimeUntilNextDay()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    getClaimedCountForDay(day).then(setRealClaimedCount);
  }, [day, hasClaimed]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    });
  }, []);

  // 3D rotation based on mouse or idle animation + Flip state
  const flipRotation = isFaceDown ? 180 : 0;
  const rotateX = isHovering ? (mousePos.y - 0.5) * -20 : 0;
  const rotateY = (isHovering ? (mousePos.x - 0.5) * 20 : 0) + flipRotation;

  const handleFlip = (e: React.MouseEvent) => {
    // Prevent flip if clicking audio preview
    if ((e.target as HTMLElement).closest('.audio-preview-btn')) return;
    setIsFaceDown(!isFaceDown);
  };

  return (
    <section className="relative py-8">
      {/* Ambient glow behind the card */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-80 h-96 rounded-full blur-[80px] opacity-30" style={{
          background: `radial-gradient(ellipse, ${rc.color}40, transparent 70%)`,
        }} />
      </div>

      <div className="flex flex-col lg:flex-row items-center justify-center gap-8 max-w-5xl mx-auto px-4">
        {/* 3D Floating Card */}
        <div
          className="relative"
          style={{ perspective: '1200px' }}
          onMouseMove={handleMouseMove}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => { setIsHovering(false); setMousePos({ x: 0.5, y: 0.5 }); }}
        >
          <motion.div
            onClick={handleFlip}
            animate={isHovering ? {
              rotateX,
              rotateY,
              y: -10,
            } : {
              rotateX: 0,
              rotateY: isFaceDown ? 180 : [0, 5, 0, -5, 0],
              y: [-4, 4, -4],
            }}
            transition={isHovering ? {
              duration: 0.15,
              ease: 'easeOut',
            } : {
              rotateY: { duration: 8, repeat: Infinity, ease: 'easeInOut' },
              y: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
            }}
            style={{
              transformStyle: 'preserve-3d',
              width: 'min(300px, 70vw)',
              aspectRatio: '3 / 4',
              cursor: 'pointer',
            }}
            className="relative"
          >
            {/* Card shadow */}
            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-4/5 h-8 rounded-full blur-xl" style={{
              background: `${rc.color}20`,
            }} />

            {/* The card itself */}
            <div className="relative w-full h-full rounded-2xl overflow-hidden" style={{
              border: `2px solid rgba(255,215,0,0.35)`,
              boxShadow: `
                0 25px 50px rgba(0,0,0,0.5),
                0 0 30px ${rc.color}15,
                inset 0 0 30px rgba(0,0,0,0.1)
              `,
            }}>
              {/* Cover art */}
              {!imgError && card.coverUrl ? (
                <img
                  src={card.coverUrl}
                  alt={card.title}
                  className="absolute inset-0 w-full h-full object-cover rotate-90 scale-[1.35] brightness-125"
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center p-8 text-center" style={{
                  background: `linear-gradient(135deg, ${rc.color}20, var(--color-void-deep), ${rc.color}10)`,
                }}>
                  <div className="brutalist-title text-8xl opacity-10" style={{ '--neon-accent': rc.color } as any}>
                    {day}
                  </div>
                </div>
              )}

              {/* CRIMP EDGES */}
              <div className="absolute inset-x-0 top-0 h-4 crimp-edge z-50 rounded-t-2xl shadow-lg" />
              <div className="absolute inset-x-0 bottom-0 h-4 crimp-edge z-50 rounded-b-2xl shadow-lg" />

              {/* Gradient overlay */}
              <div className="absolute inset-0" style={{
                background: `linear-gradient(180deg,
                  rgba(0,0,0,0.3) 0%, transparent 20%,
                  transparent 50%, rgba(0,0,0,0.6) 75%, rgba(0,0,0,0.93) 100%)`,
              }} />

              {/* STICKER TAGS */}
              <div className="absolute top-6 left-6 z-[60] pointer-events-none flex flex-col items-start gap-1">
                {/* Main Label */}
                <div className="sticker-gun-tag sticker-slits drop-shadow-xl" style={{ 
                  transform: 'rotate(-4deg)',
                  background: `linear-gradient(${rc.color}90, ${rc.color}90), #ffffff`,
                  '--slit-color': `${rc.color}25`,
                  padding: '6px 14px',
                  minWidth: '130px'
                } as any}>
                   <span className="text-[8px] font-black tracking-tighter opacity-70 mb-1 leading-none" style={{ fontFamily: 'Impact, sans-serif' }}>
                    VAULT DEP: 365
                  </span>
                  <div className="flex items-center gap-2 leading-none">
                    <Gift size={11} className="opacity-80" />
                    <span className="text-[13px] font-black uppercase tracking-tighter">DAILY DROP</span>
                  </div>
                </div>
                {/* Pack Card Counter */}
                <div className="sticker-gun-tag sticker-slits drop-shadow-md ml-2" style={{ 
                  transform: 'rotate(2deg)',
                  background: 'linear-gradient(135deg, #ffd700, #ff9900)',
                  '--slit-color': 'rgba(0,0,0,0.15)',
                  padding: '4px 10px',
                } as any}>
                  <span className="text-[9px] font-black leading-none tracking-tight" style={{ color: '#000' }}>
                    ✦ MYTHIC CHANCE
                  </span>
                </div>
              </div>

              <div className="absolute top-6 right-6 z-[60] pointer-events-none" style={{ transform: 'rotate(2deg)' }}>
                <div className="sticker-gun-tag sticker-slits drop-shadow-lg" style={{ 
                   background: '#ffffff',
                  '--slit-color': 'rgba(0,0,0,0.06)',
                  padding: '6px 12px',
                  minWidth: '75px'
                } as any}>
                  <span className="text-[16px] font-black leading-none" style={{ letterSpacing: '-0.5px' }}>
                    #{String(day).padStart(3, '0')}
                  </span>
                </div>
              </div>

              {/* Bottom info */}
              <div className="absolute bottom-0 left-0 right-0 p-5 space-y-2">
                <div className="flex items-end justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-3xl brutalist-title truncate mb-2" style={{
                      '--neon-accent': rc.color,
                      textShadow: `0 0 20px ${rc.color}40`,
                    } as any}>
                      {card.title}
                    </h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] font-mono" style={{ color: 'var(--color-text-muted)' }}>
                        DAY {day}
                      </span>
                      <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                        {formatDate(day)}
                      </span>
                    </div>
                  </div>
                  <RarityBadge rarity={card.rarity} size="sm" />
                </div>

                <div className="flex items-center justify-between text-[10px] font-mono" style={{ color: 'var(--color-text-muted)' }}>
                  <span>★ full song</span>
                  <span>{card.mood === 'light' ? '☀' : '🌙'} {card.mood}</span>
                </div>

                <AudioPreview
                  audioUrl={card.audioUrl}
                  title={card.title}
                  rarity={card.rarity}
                  coverUrl={card.coverUrl}
                  day={day}
                  isDailyClaim
                />
              </div>

              {/* Gold accent border */}
              <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{
                border: '2px solid rgba(255,215,0,0.2)',
              }} />

              {/* CARD BACK */}
              <div style={{
                position: 'absolute', inset: 0, 
                background: 'linear-gradient(135deg, #1a1a1a, #0a0a0a)',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                borderRadius: '16px',
                border: '1px solid rgba(255,215,0,0.15)',
              }}>
                <div style={{
                  width: '120px', height: '120px', borderRadius: '50%',
                  background: 'rgba(255,215,0,0.03)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '1px solid rgba(255,215,0,0.1)',
                  position: 'relative'
                }}>
                  <span style={{ fontSize: '60px', filter: 'grayscale(1) brightness(0.5)', opacity: 0.2 }}>V</span>
                  <div className="absolute inset-0 scanlines opacity-10" />
                </div>
                <div className="mt-6 text-center">
                  <div className="text-[10px] font-mono tracking-[0.3em] opacity-30 uppercase">TH3V4ULT // GEN 0</div>
                  <div className="text-[8px] font-mono opacity-20 mt-1 uppercase">SOUND ARCHIVE PROTOCOL</div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right side — claim info */}
        <div className="flex flex-col items-center lg:items-start gap-4 text-center lg:text-left">
          <div className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gradient">
              Today's Drop
            </h1>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Day {day} of 365 — Claim your free card
            </p>
          </div>

          {/* Countdown Sticker */}
          <div className="sticker-gun-tag sticker-slits drop-shadow-xl" style={{
            background: '#ffffff',
            '--slit-color': 'var(--color-neon-gold)',
            transform: 'rotate(0.5deg)',
            padding: '10px 20px',
            minWidth: '200px'
          } as any}>
            <div className="flex flex-col items-center gap-1">
               <span className="text-[8px] font-black tracking-tighter opacity-50 uppercase flex items-center gap-1">
                <Clock size={10} /> NEXT DROP COUNTER
              </span>
              <span className="text-2xl font-black italic tracking-tighter italic">
                {String(countdown.hours).padStart(2, '0')}:{String(countdown.minutes).padStart(2, '0')}:{String(countdown.seconds).padStart(2, '0')}
              </span>
            </div>
          </div>

          {/* Claim button or status */}
          {!hasClaimed ? (
            <motion.button
              whileHover={{ scale: 1.05, rotate: -1 }}
              whileTap={{ scale: 0.95 }}
              onClick={onClaim}
              className="sticker-gun-tag sticker-slits text-sm uppercase px-10 py-5 transition-all drop-shadow-[0_0_20px_rgba(255,215,0,0.3)]"
              style={{
                background: 'linear-gradient(135deg, var(--color-neon-gold), #ffaa00)',
                color: '#000',
                padding: '12px 32px',
                '--slit-color': 'rgba(0,0,0,0.2)',
                transform: 'rotate(-2deg)'
              } as any}
            >
              <div className="flex flex-col items-center leading-none">
                <Gift size={18} className="mb-1" />
                <span className="font-black text-xl italic uppercase tracking-tighter" style={{ transform: 'scaleY(1.3)' }}>Claim Free Card</span>
              </div>
            </motion.button>
          ) : (
            <div className="px-6 py-3 rounded-xl text-sm font-mono" style={{
              background: 'rgba(74,222,128,0.08)',
              border: '1px solid rgba(74,222,128,0.2)',
              color: 'var(--color-rarity-uncommon)',
            }}>
              ✓ Claimed today
            </div>
          )}

          {/* Quick stats */}
          <div className="text-[11px] font-mono space-y-1" style={{ color: 'var(--color-text-muted)' }}>
            <div>{realClaimedCount}/100 claimed</div>
            <div>Rarity rolls on claim • Mythic possible today only</div>
          </div>
        </div>
      </div>
    </section>
  );
}
