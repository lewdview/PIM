import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Play, Disc, Info, RotateCw, Flame, Share2, Sparkles
} from 'lucide-react';
import type { OwnedCard } from '../services/vaultService';
import { RARITY_CONFIG, getSupplyCap, type Rarity } from '../utils/rarity';
import { useSmartCoverArt } from '../utils/rarityArtwork';
import RarityBadge from './RarityBadge';

interface MobileCardActionSheetProps {
  card: OwnedCard | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenDetails: () => void;
  onPlayPim: () => void;
  onListen: () => void;
  onFlip?: () => void;
  onFuse?: () => void;
  canFuse?: boolean;
  onBurn?: () => void;
  canBurn?: boolean;
  count?: number;
}

export default function MobileCardActionSheet({
  card,
  isOpen,
  onClose,
  onOpenDetails,
  onPlayPim,
  onListen,
  onFlip,
  onFuse,
  canFuse = false,
  onBurn,
  canBurn = false,
  count = 1,
}: MobileCardActionSheetProps) {
  const { src: coverUrl, handleError: handleImgError } = useSmartCoverArt(
    card?.card.coverUrl,
    card?.card.rarity
  );

  if (!card) return null;

  const rarity = card.card.rarity as Rarity;
  const rc = RARITY_CONFIG[rarity] || RARITY_CONFIG.common;
  const supplyCap = getSupplyCap(rarity, card.card.day);

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator.share) {
      navigator.share({
        title: `${card.card.title} - PIM Day ${card.card.day}`,
        text: `Check out my Day ${card.card.day} card in PIM : th3v4ult!`,
        url: window.location.origin + `/hero/day-${card.card.day}`,
      }).catch(() => {});
    } else {
      navigator.clipboard?.writeText?.(window.location.origin + `/hero/day-${card.card.day}`);
      alert('Card link copied to clipboard!');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[120] flex flex-col justify-end md:hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-md"
          />

          {/* Drawer Container */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={0.2}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100 || info.velocity.y > 500) {
                onClose();
              }
            }}
            className="relative z-10 w-full bg-[#0d0d12] border-t-2 border-white/15 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.8)] pb-safe overflow-hidden flex flex-col max-h-[85vh]"
          >
            {/* Grab Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-12 h-1.5 rounded-full bg-white/20" />
            </div>

            {/* Header: Card Profile */}
            <div className="px-5 py-3 flex items-center gap-4 border-b border-white/10 bg-white/[0.02]">
              {/* Thumbnail */}
              <div
                className="relative w-14 h-18 rounded-lg overflow-hidden shrink-0 border-2"
                style={{
                  borderColor: rc.color,
                  boxShadow: `0 0 15px ${rc.color}30`,
                }}
              >
                <img
                  src={coverUrl}
                  alt={card.card.title}
                  onError={handleImgError}
                  className="w-full h-full object-cover"
                />
                {count > 1 && (
                  <div className="absolute top-0.5 right-0.5 bg-black/90 text-yellow-400 text-[8px] font-mono font-black px-1 rounded">
                    x{count}
                  </div>
                )}
              </div>

              {/* Title & Stats */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-mono font-bold tracking-widest text-white/50">
                    DAY {String(card.card.day).padStart(3, '0')}
                  </span>
                  <RarityBadge rarity={rarity} size="sm" />
                </div>
                <h3 className="text-base font-black text-white truncate tracking-tight">
                  {card.card.title}
                </h3>
                <div className="flex items-center gap-2 mt-1 text-[10px] font-mono text-white/60">
                  <span>ED. {card.edition || '?'}/{supplyCap}</span>
                  <span>•</span>
                  <span>{card.card.bpm || 120} BPM</span>
                  {card.proof && (
                    <>
                      <span>•</span>
                      <span className="text-purple-400 font-bold">1/1 PROOF</span>
                    </>
                  )}
                </div>
              </div>

              {/* Close Icon */}
              <button
                onClick={onClose}
                aria-label="Close"
                className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 active:scale-95 flex items-center justify-center text-white/50 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Action Buttons Section */}
            <div className="p-5 space-y-3 overflow-y-auto">
              
              {/* PRIMARY CTA: PLAY PIM */}
              <button
                onClick={() => {
                  onClose();
                  onPlayPim();
                }}
                className="w-full py-4 px-6 rounded-2xl font-mono font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-lg cursor-pointer"
                style={{
                  background: 'linear-gradient(135deg, #00f0ff, #ff1493)',
                  color: '#000',
                  boxShadow: '0 0 25px rgba(0, 240, 255, 0.4)',
                }}
              >
                <Play size={18} fill="#000" />
                <span>PLAY PIM RHYTHM GAME</span>
                <Sparkles size={16} />
              </button>

              {/* SECONDARY ROW: Dossier & Listen */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={() => {
                    onClose();
                    onOpenDetails();
                  }}
                  className="py-3.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 active:scale-[0.98] border border-white/15 flex items-center justify-center gap-2 text-white font-mono text-xs font-bold uppercase tracking-wider"
                >
                  <Info size={15} className="text-[#00E5FF]" />
                  <span>VIEW DOSSIER</span>
                </button>

                <button
                  onClick={() => {
                    onClose();
                    onListen();
                  }}
                  className="py-3.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 active:scale-[0.98] border border-white/15 flex items-center justify-center gap-2 text-white font-mono text-xs font-bold uppercase tracking-wider"
                >
                  <Disc size={15} className="text-[#39FF14]" />
                  <span>JUST LISTEN</span>
                </button>
              </div>

              {/* AUXILIARY ACTIONS ROW */}
              <div className="grid grid-cols-2 gap-2.5">
                {onFlip && (
                  <button
                    onClick={() => {
                      onFlip();
                      onClose();
                    }}
                    className="py-3 px-3 rounded-xl bg-white/5 hover:bg-white/10 active:scale-[0.98] border border-white/10 flex items-center justify-center gap-1.5 text-white/80 font-mono text-[11px] font-bold uppercase tracking-wider"
                  >
                    <RotateCw size={13} />
                    <span>FLIP 3D CARD</span>
                  </button>
                )}

                <button
                  onClick={handleShare}
                  className="py-3 px-3 rounded-xl bg-white/5 hover:bg-white/10 active:scale-[0.98] border border-white/10 flex items-center justify-center gap-1.5 text-white/80 font-mono text-[11px] font-bold uppercase tracking-wider"
                >
                  <Share2 size={13} />
                  <span>SHARE CARD</span>
                </button>
              </div>

              {/* FUSION / BURN ACTIONS (Conditional) */}
              {canFuse && onFuse && (
                <button
                  onClick={() => {
                    onClose();
                    onFuse();
                  }}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#ff3800] to-[#ff6600] text-white font-mono font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(255,56,0,0.4)]"
                >
                  <Flame size={16} fill="#fff" />
                  <span>FUSE 3 COPIES → NEXT TIER</span>
                </button>
              )}

              {canBurn && onBurn && (
                <button
                  onClick={() => {
                    onClose();
                    onBurn();
                  }}
                  className="w-full py-3 px-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2"
                >
                  <Flame size={15} />
                  <span>BURN MINTED OUT COPY</span>
                </button>
              )}

            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
