import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Play, Pause, Volume2, Sparkles, ShieldCheck, Disc, Info,
  Flame, Award, Layers, Share2, Check, ExternalLink, Zap
} from 'lucide-react';
import { RARITY_CONFIG, getSupplyCap, getMintableCap, type Rarity } from '../utils/rarity';
import { getCoverUrlForRarity, useSmartCoverArt } from '../utils/rarityArtwork';
import { getArtTypeForDay, OUTFIT_STYLES } from '../utils/artTypes';
import RarityBadge from './RarityBadge';
import { audioManager } from '../game/audio';

interface TodayCardDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  day: number;
  song: {
    id: string;
    day: number;
    title: string;
    artist: string;
    duration?: number;
    coverArt?: string;
    audioUrl?: string;
    bpm?: number;
    mood?: string;
    energy?: number;
    valence?: number;
    tempo?: number;
  } | null;
  onPlay: () => void;
}

const VARIANTS: {
  rarity: Rarity;
  label: string;
  desc: string;
  badge: string;
  perk: string;
}[] = [
  {
    rarity: 'common',
    label: 'Standard Core',
    desc: 'Official daily drop album art with standard audio stem.',
    badge: 'BASE CORE',
    perk: 'Standard Edition • 100 Supply',
  },
  {
    rarity: 'uncommon',
    label: 'Alternate Edition',
    desc: 'High-contrast alternate concept cover with extended audio preview.',
    badge: 'ALT COVER',
    perk: 'Alternate Visuals • +25% Score Mult',
  },
  {
    rarity: 'rare',
    label: 'Holographic Rare',
    desc: 'Cyberpunk anime foil finish featuring exclusive girl-cover artwork.',
    badge: 'HOLO FOIL',
    perk: 'Exclusive Art • +50% Score Mult',
  },
  {
    rarity: 'legendary',
    label: 'Gold Master',
    desc: 'Pure golden gilding, high-valence master stem, and maximum prestige.',
    badge: 'GOLD FOIL',
    perk: 'Gilded Frame • +100% Score Mult',
  },
  {
    rarity: 'mythic',
    label: 'Chromatic 1/1',
    desc: 'Iridescent chromatic shimmer. Ultra-rare historical vault imprint.',
    badge: 'CHROMATIC',
    perk: '1/1 Aura • Maximum Multiplier',
  },
];

export default function TodayCardDetailModal({
  isOpen,
  onClose,
  day,
  song,
  onPlay,
}: TodayCardDetailModalProps) {
  const [selectedRarity, setSelectedRarity] = useState<Rarity>('common');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [copied, setCopied] = useState(false);

  // Compute cover URL for the selected variant
  const rawCoverUrl = useMemo(() => {
    return getCoverUrlForRarity(song?.coverArt, selectedRarity);
  }, [song?.coverArt, selectedRarity]);

  const { src: modalCoverUrl, handleError: handleCoverError } = useSmartCoverArt(rawCoverUrl, selectedRarity);

  // Art metadata
  const artData = useMemo(() => getArtTypeForDay(day), [day]);
  const outfitMeta = useMemo(() => OUTFIT_STYLES[artData.outfitStyle], [artData]);
  const rc = RARITY_CONFIG[selectedRarity] || RARITY_CONFIG.common;

  if (!isOpen || !song) return null;

  const togglePreviewAudio = () => {
    if (!song.audioUrl) return;
    if (isPlayingAudio) {
      audioManager.stopBgm();
      setIsPlayingAudio(false);
    } else {
      audioManager.playSfx('tap_nav', 0.4);
      audioManager.playBgm(song.audioUrl, 0.6);
      setIsPlayingAudio(true);
    }
  };

  const handleShare = () => {
    navigator.clipboard?.writeText?.(window.location.origin + `/hero/day-${day}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[220] flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/90 backdrop-blur-xl"
          onClick={() => {
            if (isPlayingAudio) audioManager.stopBgm();
            onClose();
          }}
        />

        {/* Modal Container */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 26, stiffness: 280 }}
          className="relative z-10 w-full max-w-5xl bg-[#0a0a0a] border border-white/15 rounded-2xl overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.9)] max-h-[90vh] flex flex-col"
        >
          {/* Scanline layer */}
          <div className="absolute inset-0 scanlines opacity-[0.03] pointer-events-none" />

          {/* Header Bar */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full animate-ping" style={{ background: rc.color }} />
              <div className="flex flex-col">
                <span className="text-[10px] font-mono font-bold uppercase tracking-[0.25em] text-white/50">
                  CARD DOSSIER // DAY {String(day).padStart(3, '0')} OF 365
                </span>
                <span className="text-sm font-bold text-white tracking-tight">{song.title}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleShare}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Share link"
              >
                {copied ? <Check size={14} className="text-[#39FF14]" /> : <Share2 size={14} />}
                <span className="hidden sm:inline">{copied ? 'COPIED' : 'SHARE'}</span>
              </button>
              <button
                onClick={() => {
                  if (isPlayingAudio) audioManager.stopBgm();
                  onClose();
                }}
                aria-label="Close modal"
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Body Content: 2-Column Responsive Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
            
            {/* LEFT COLUMN: 3D Visual Card & Preview */}
            <div className="p-6 sm:p-8 bg-black/40 border-b lg:border-b-0 lg:border-r border-white/5 flex flex-col items-center justify-between gap-6">
              
              {/* 3D Glowing Card Frame */}
              <div className="relative w-full max-w-[260px] aspect-[3/4] rounded-2xl overflow-hidden shadow-2xl border-2 transition-all duration-500 group"
                style={{
                  borderColor: rc.color,
                  boxShadow: `0 0 35px ${rc.color}30, 0 10px 40px rgba(0,0,0,0.8)`,
                }}
              >
                <img
                  src={modalCoverUrl}
                  alt={song.title}
                  onError={handleCoverError}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />

                {/* Ambient vignette */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/30 pointer-events-none" />

                {/* Top Badge */}
                <div className="absolute top-3 left-3 right-3 flex justify-between items-center pointer-events-none">
                  <span className="px-2 py-0.5 rounded bg-black/80 border border-white/20 text-[9px] font-mono font-bold text-white tracking-widest uppercase">
                    DAY {String(day).padStart(3, '0')}
                  </span>
                  <RarityBadge rarity={selectedRarity} size="sm" />
                </div>

                {/* Bottom Card Identity */}
                <div className="absolute bottom-3 inset-x-3 text-left pointer-events-none">
                  <p className="text-xs font-bold text-white truncate drop-shadow-md">{song.title}</p>
                  <p className="text-[10px] font-mono text-white/70 truncate">{song.artist}</p>
                </div>
              </div>

              {/* Audio Stem Preview Controller */}
              <div className="w-full bg-white/[0.03] border border-white/10 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="flex items-center gap-1.5 text-white/60">
                    <Disc size={13} className={isPlayingAudio ? 'animate-spin text-[#ff3800]' : ''} />
                    Audio Preview
                  </span>
                  <span className="text-[10px] font-bold uppercase" style={{ color: rc.color }}>
                    {selectedRarity.toUpperCase()} STEM
                  </span>
                </div>

                <button
                  onClick={togglePreviewAudio}
                  className="w-full py-2.5 px-4 rounded-lg bg-white/10 hover:bg-white/15 text-white font-mono text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {isPlayingAudio ? <Pause size={14} fill="#fff" /> : <Play size={14} fill="#fff" />}
                  <span>{isPlayingAudio ? 'PAUSE PREVIEW' : 'PLAY AUDIO STEM'}</span>
                </button>
              </div>

              {/* Quick Rarity Registry Info */}
              <div className="w-full grid grid-cols-2 gap-2 text-[10px] font-mono text-white/60">
                <div className="p-2.5 rounded-lg bg-white/5 border border-white/5">
                  <span className="block opacity-40 uppercase">Max Supply</span>
                  <span className="font-bold text-white">{getSupplyCap(selectedRarity, day)} Editions</span>
                </div>
                <div className="p-2.5 rounded-lg bg-white/5 border border-white/5">
                  <span className="block opacity-40 uppercase">Minting Chain</span>
                  <span className="font-bold text-[#00E5FF]">Base L2 (EVM)</span>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Variant Explorer & Song Stats */}
            <div className="p-6 sm:p-8 flex flex-col justify-between space-y-6">
              
              {/* SECTION 1: VARIANT SWITCHER */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono font-bold uppercase tracking-[0.2em] text-white/40 flex items-center gap-1.5">
                    <Layers size={13} />
                    SELECT CARD VARIANT TO INSPECT
                  </span>
                  <span className="text-[10px] font-mono text-white/30">[ 5 EDITIONS ]</span>
                </div>

                {/* Variant Tabs */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {VARIANTS.map((v) => {
                    const isSelected = selectedRarity === v.rarity;
                    const vConfig = RARITY_CONFIG[v.rarity];
                    return (
                      <button
                        key={v.rarity}
                        onClick={() => {
                          audioManager.playSfx('tap_nav', 0.3);
                          setSelectedRarity(v.rarity);
                        }}
                        className={`p-3 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                          isSelected
                            ? 'bg-white/10 shadow-lg scale-[1.02]'
                            : 'bg-white/[0.02] hover:bg-white/5 opacity-60 hover:opacity-100'
                        }`}
                        style={{
                          borderColor: isSelected ? vConfig.color : 'rgba(255,255,255,0.08)',
                          boxShadow: isSelected ? `0 0 15px ${vConfig.color}25` : 'none',
                        }}
                      >
                        <span className="text-[9px] font-mono font-black uppercase tracking-wider" style={{ color: vConfig.color }}>
                          {v.badge}
                        </span>
                        <span className="text-xs font-bold text-white truncate leading-tight">
                          {v.label}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Active Variant Description Banner */}
                <div className="p-3.5 rounded-xl border bg-white/[0.02] flex items-center justify-between gap-4" style={{ borderColor: `${rc.color}40` }}>
                  <div className="space-y-0.5 text-xs">
                    <p className="font-bold text-white">{VARIANTS.find(v => v.rarity === selectedRarity)?.desc}</p>
                    <p className="text-[10px] font-mono" style={{ color: rc.color }}>{VARIANTS.find(v => v.rarity === selectedRarity)?.perk}</p>
                  </div>
                  <Sparkles size={18} className="shrink-0" style={{ color: rc.color }} />
                </div>
              </div>

              {/* SECTION 2: TRACK SPECIFICATIONS & TRAITS */}
              <div className="space-y-3">
                <span className="text-[11px] font-mono font-bold uppercase tracking-[0.2em] text-white/40 flex items-center gap-1.5">
                  <Info size={13} />
                  SONIC SPECIFICATIONS & TRAITS
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-1">
                    <span className="text-[9px] font-mono uppercase opacity-40">BPM / Tempo</span>
                    <span className="block text-base font-black text-white font-mono">{song.bpm || 120} BPM</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-1">
                    <span className="text-[9px] font-mono uppercase opacity-40">Mood Tag</span>
                    <span className={`block text-xs font-black uppercase font-mono px-2 py-0.5 rounded w-fit ${song.mood === 'light' ? 'bg-yellow-400/20 text-yellow-400' : 'bg-blue-400/20 text-blue-400'}`}>
                      {song.mood || 'SYNTH'}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-1">
                    <span className="text-[9px] font-mono uppercase opacity-40">Art Spec</span>
                    <span className="block text-xs font-bold text-[#00f0ff] font-mono truncate">{artData.artType}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-1">
                    <span className="text-[9px] font-mono uppercase opacity-40">Outfit Theme</span>
                    <span className="block text-xs font-bold font-mono truncate" style={{ color: outfitMeta.tagColor }}>
                      {outfitMeta.label}
                    </span>
                  </div>
                </div>

                {/* Trait Bars */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="opacity-50">ENERGY DENSITY</span>
                      <span className="font-bold text-[#00E5FF]">84%</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-[#00E5FF] w-[84%]" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="opacity-50">HARMONIC VALENCE</span>
                      <span className="font-bold text-[#ffd700]">76%</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-[#ffd700] w-[76%]" />
                    </div>
                  </div>
                </div>
              </div>

              {/* ACTION FOOTER */}
              <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => {
                    if (isPlayingAudio) audioManager.stopBgm();
                    onClose();
                    onPlay();
                  }}
                  className="flex-1 py-3.5 px-6 rounded-xl bg-gradient-to-r from-[#ff3800] via-[#ff6a00] to-[#ffd700] text-black font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] transition-all shadow-[0_0_30px_rgba(255,56,0,0.35)] cursor-pointer"
                >
                  <Play size={16} fill="#000" />
                  <span>PLAY DAY {day} DROP NOW</span>
                </button>
              </div>

            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
