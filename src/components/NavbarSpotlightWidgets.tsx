// ════════════════════════════════════════════════════════════════════════════════
// NavbarSpotlightWidgets.tsx — Live Contextual Telemetry Widgets for Mega-Menus
// High-density cyberpunk interactive displays embedded directly into mega flyouts
// ════════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'wouter';
import {
  Gamepad2, Sparkles, Flame, Zap, Shield, Trophy, ChevronRight,
  Radio, Disc, Play, Layers, CheckCircle2, Clock, Volume2, Monitor
} from 'lucide-react';
import { useVaultStore } from '../store/useVaultStore';
import { useAuthStore } from '../store/useAuthStore';
import { useDisplayMode } from '../store/useDisplayMode';
import { getCurrentDay, formatDate, getMonthFromDay, getMonthNumFromDay } from '../utils/dayCalc';
import { CHAPTERS } from '../game/campaign';
import staticSongCatalog from '../data/song_catalog.json';
import { haptics } from '../utils/haptics';

// ── PLAY SPOTLIGHT WIDGET ─────────────────────────────────────────────────────
export function PlaySpotlight({ onClose }: { onClose?: () => void }) {
  const currentDay = getCurrentDay();
  const monthNum = getMonthNumFromDay(currentDay);
  const chapter = CHAPTERS.find(c => c.month === monthNum) || CHAPTERS[0];

  const todaySong = useMemo(() => {
    if (Array.isArray(staticSongCatalog)) {
      const found = staticSongCatalog.find((s: any) => s.day === currentDay);
      if (found) return found;
    }
    return {
      day: currentDay,
      title: `Transmission ${currentDay}`,
      bpm: 120,
      mood: 'high-energy',
      genre: ['Electronic', 'Bass'],
    };
  }, [currentDay]);

  const paddedDay = String(currentDay).padStart(3, '0');

  return (
    <div
      className="flex flex-col justify-between p-4 h-full rounded border"
      style={{
        background: 'linear-gradient(135deg, rgba(255,20,147,0.12) 0%, rgba(10,10,18,0.85) 100%)',
        borderColor: 'rgba(255,20,147,0.3)',
        boxShadow: 'inset 0 0 30px rgba(255,20,147,0.08)',
        clipPath: 'polygon(6px 0%, 100% 0%, calc(100% - 6px) 100%, 0% 100%)',
      }}
    >
      <div>
        {/* Top Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 font-mono text-[9px] font-black uppercase tracking-widest text-[#ff1493]">
            <Radio size={12} className="animate-pulse" />
            <span>TODAY'S FEATURED BEAT</span>
          </div>
          <span className="font-mono text-[8px] font-black bg-[#ff1493]/20 text-[#ff60b5] px-1.5 py-0.5 rounded border border-[#ff1493]/30">
            DAY {currentDay} / 365
          </span>
        </div>

        {/* Track Title & Metadata */}
        <div className="mb-3">
          <h4 className="font-impact text-lg text-white uppercase tracking-tight leading-tight line-clamp-1">
            {todaySong.title}
          </h4>
          <div className="flex items-center gap-2 mt-1 font-mono text-[9px] text-white/50 uppercase">
            <span>{formatDate(currentDay)}</span>
            <span>•</span>
            <span className="text-[#ff1493] font-bold">{todaySong.bpm} BPM</span>
            <span>•</span>
            <span className="text-white/70">{chapter.name} ({chapter.diff})</span>
          </div>
        </div>

        {/* Audio Lane Meters preview */}
        <div className="grid grid-cols-3 gap-1.5 p-2 mb-3 bg-black/40 border border-white/10 rounded">
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-[7px] text-[#A855F7] font-black uppercase">LANE 0 // BASS</span>
            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-[#A855F7] w-[85%] rounded-full animate-pulse" />
            </div>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-[7px] text-[#00E5FF] font-black uppercase">LANE 1 // MIDS</span>
            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-[#00E5FF] w-[65%] rounded-full animate-pulse" />
            </div>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-[7px] text-[#39FF14] font-black uppercase">LANE 2 // LEAD</span>
            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-[#39FF14] w-[95%] rounded-full animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      {/* Action Button */}
      <Link
        to={`/play/day-${paddedDay}`}
        onClick={() => {
          haptics.mediumTap();
          onClose?.();
        }}
        className="flex items-center justify-center gap-2 w-full py-2.5 bg-[#FF1493] hover:bg-[#ff33a3] text-black font-impact text-sm uppercase tracking-wider transition-all active:scale-95 shadow-[0_0_20px_rgba(255,20,147,0.4)] no-underline cursor-pointer"
        style={{
          clipPath: 'polygon(4px 0%, 100% 0%, calc(100% - 4px) 100%, 0% 100%)',
        }}
      >
        <Play size={13} fill="currentColor" />
        <span>LAUNCH TODAY'S TRANSMISSION</span>
        <ChevronRight size={14} />
      </Link>
    </div>
  );
}

// ── VAULT SPOTLIGHT WIDGET ────────────────────────────────────────────────────
export function VaultSpotlight({ onClose }: { onClose?: () => void }) {
  const collection = useVaultStore((s) => s.collection);
  const echoPrestigeScore = useVaultStore((s) => s.echoPrestigeScore);
  const tokenBalance = useVaultStore((s) => s.tokenBalance);

  const cardCount = collection.length;
  const completionPct = Math.min(100, Math.round((cardCount / 365) * 100));

  // Count rarities
  const mythicCount = collection.filter(c => c.card?.rarity === 'mythic').length;
  const legendaryCount = collection.filter(c => c.card?.rarity === 'legendary').length;

  return (
    <div
      className="flex flex-col justify-between p-4 h-full rounded border"
      style={{
        background: 'linear-gradient(135deg, rgba(255,85,0,0.12) 0%, rgba(10,10,18,0.85) 100%)',
        borderColor: 'rgba(255,85,0,0.3)',
        boxShadow: 'inset 0 0 30px rgba(255,85,0,0.08)',
        clipPath: 'polygon(6px 0%, 100% 0%, calc(100% - 6px) 100%, 0% 100%)',
      }}
    >
      <div>
        {/* Top Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 font-mono text-[9px] font-black uppercase tracking-widest text-[#ff5500]">
            <Layers size={12} />
            <span>TH3SCR1B3 VAULT TELEMETRY</span>
          </div>
          <span className="font-mono text-[8px] font-black bg-[#ff5500]/20 text-[#ff8800] px-1.5 py-0.5 rounded border border-[#ff5500]/30">
            BASE EVM SYNC
          </span>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="p-2 bg-black/40 border border-white/10 rounded">
            <span className="font-mono text-[8px] text-white/40 uppercase">CARDS COLLECTED</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="font-impact text-xl text-white">{cardCount}</span>
              <span className="font-mono text-[9px] text-white/40">/ 365 ({completionPct}%)</span>
            </div>
          </div>

          <div className="p-2 bg-black/40 border border-white/10 rounded">
            <span className="font-mono text-[8px] text-white/40 uppercase">ECHO PRESTIGE</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="font-impact text-xl text-[#ffaa00]">{echoPrestigeScore}</span>
              <span className="font-mono text-[8px] text-[#ffaa00]/70">PTS</span>
            </div>
          </div>
        </div>

        {/* Rarities Snapshot */}
        <div className="flex items-center justify-between px-2 py-1.5 bg-black/30 border border-white/5 rounded font-mono text-[9px]">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#A855F7]" />
            <span className="text-white/60">MYTHIC:</span>
            <span className="text-white font-bold">{mythicCount}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#E5B800]" />
            <span className="text-white/60">LEGENDARY:</span>
            <span className="text-white font-bold">{legendaryCount}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Zap size={10} className="text-[#ff9900]" />
            <span className="text-[#ff9900] font-bold">{tokenBalance} TK</span>
          </div>
        </div>
      </div>

      {/* Action Button */}
      <Link
        to="/vault/collection"
        onClick={() => {
          haptics.mediumTap();
          onClose?.();
        }}
        className="flex items-center justify-center gap-2 w-full py-2.5 bg-[#FF5500] hover:bg-[#ff7700] text-black font-impact text-sm uppercase tracking-wider transition-all active:scale-95 shadow-[0_0_20px_rgba(255,85,0,0.4)] no-underline cursor-pointer"
        style={{
          clipPath: 'polygon(4px 0%, 100% 0%, calc(100% - 4px) 100%, 0% 100%)',
        }}
      >
        <Sparkles size={13} fill="currentColor" />
        <span>EXPLORE FULL BINDER</span>
        <ChevronRight size={14} />
      </Link>
    </div>
  );
}

// ── FORGE SPOTLIGHT WIDGET ────────────────────────────────────────────────────
export function ForgeSpotlight({ onClose }: { onClose?: () => void }) {
  const collection = useVaultStore((s) => s.collection);
  const duplicates = collection.length > 5 ? Math.floor(collection.length * 0.3) : 0;

  return (
    <div
      className="flex flex-col justify-between p-4 h-full rounded border"
      style={{
        background: 'linear-gradient(135deg, rgba(57,255,20,0.12) 0%, rgba(10,10,18,0.85) 100%)',
        borderColor: 'rgba(57,255,20,0.3)',
        boxShadow: 'inset 0 0 30px rgba(57,255,20,0.08)',
        clipPath: 'polygon(6px 0%, 100% 0%, calc(100% - 6px) 100%, 0% 100%)',
      }}
    >
      <div>
        {/* Top Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 font-mono text-[9px] font-black uppercase tracking-widest text-[#39FF14]">
            <Flame size={12} className="animate-pulse" />
            <span>FUSION CHAMBER LAB</span>
          </div>
          <span className="font-mono text-[8px] font-black bg-[#39FF14]/20 text-[#39FF14] px-1.5 py-0.5 rounded border border-[#39FF14]/30">
            2.0X CATALYST ACTIVE
          </span>
        </div>

        {/* Fusion Status Banner */}
        <div className="p-3 bg-black/40 border border-white/10 rounded mb-3">
          <span className="font-mono text-[8px] text-white/40 uppercase">UPGRADE ENGINE</span>
          <p className="font-mono text-[10px] text-white/80 mt-1 leading-relaxed">
            Synthesize duplicate session cards into permanent higher-tier holographic foils.
          </p>
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/5 font-mono text-[9px] text-[#39FF14]">
            <CheckCircle2 size={11} />
            <span>FUSION CHAMBER READY FOR SYNTHESIS</span>
          </div>
        </div>
      </div>

      {/* Action Button */}
      <Link
        to="/vault/forge"
        onClick={() => {
          haptics.mediumTap();
          onClose?.();
        }}
        className="flex items-center justify-center gap-2 w-full py-2.5 bg-[#39FF14] hover:bg-[#5aff33] text-black font-impact text-sm uppercase tracking-wider transition-all active:scale-95 shadow-[0_0_20px_rgba(57,255,20,0.4)] no-underline cursor-pointer"
        style={{
          clipPath: 'polygon(4px 0%, 100% 0%, calc(100% - 4px) 100%, 0% 100%)',
        }}
      >
        <Flame size={13} fill="currentColor" />
        <span>ENTER FUSION LAB</span>
        <ChevronRight size={14} />
      </Link>
    </div>
  );
}

// ── EARN SPOTLIGHT WIDGET ─────────────────────────────────────────────────────
export function EarnSpotlight({ onClose }: { onClose?: () => void }) {
  const tokenBalance = useVaultStore((s) => s.tokenBalance);
  const streakCount = useVaultStore((s) => s.streakCount);

  return (
    <div
      className="flex flex-col justify-between p-4 h-full rounded border"
      style={{
        background: 'linear-gradient(135deg, rgba(229,184,0,0.12) 0%, rgba(10,10,18,0.85) 100%)',
        borderColor: 'rgba(229,184,0,0.3)',
        boxShadow: 'inset 0 0 30px rgba(229,184,0,0.08)',
        clipPath: 'polygon(6px 0%, 100% 0%, calc(100% - 6px) 100%, 0% 100%)',
      }}
    >
      <div>
        {/* Top Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 font-mono text-[9px] font-black uppercase tracking-widest text-[#E5B800]">
            <Zap size={12} />
            <span>TOKEN ENGINE & STREAK HUD</span>
          </div>
          <span className="font-mono text-[8px] font-black bg-[#E5B800]/20 text-[#ffd700] px-1.5 py-0.5 rounded border border-[#E5B800]/30">
            {streakCount} DAY STREAK
          </span>
        </div>

        {/* Balance Card */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="p-2 bg-black/40 border border-white/10 rounded">
            <span className="font-mono text-[8px] text-white/40 uppercase">ACTIVE TOKENS</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="font-impact text-2xl text-[#E5B800]">{tokenBalance}</span>
              <span className="font-mono text-[9px] text-[#E5B800]/70">TK</span>
            </div>
          </div>

          <div className="p-2 bg-black/40 border border-white/10 rounded">
            <span className="font-mono text-[8px] text-white/40 uppercase">STREAK BONUS</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="font-impact text-xl text-white">{streakCount >= 7 ? '3.0X' : streakCount >= 3 ? '2.0X' : '1.0X'}</span>
              <span className="font-mono text-[8px] text-white/40">BOOST</span>
            </div>
          </div>
        </div>

        <p className="font-mono text-[9px] text-white/50 leading-tight">
          Complete daily 3-lane stages or redeem login bonuses to earn Vault Tokens for packs & cosmetics.
        </p>
      </div>

      {/* Action Button */}
      <Link
        to="/vault/claim"
        onClick={() => {
          haptics.mediumTap();
          onClose?.();
        }}
        className="flex items-center justify-center gap-2 w-full py-2.5 bg-[#E5B800] hover:bg-[#ffcc00] text-black font-impact text-sm uppercase tracking-wider transition-all active:scale-95 shadow-[0_0_20px_rgba(229,184,0,0.4)] no-underline cursor-pointer"
        style={{
          clipPath: 'polygon(4px 0%, 100% 0%, calc(100% - 4px) 100%, 0% 100%)',
        }}
      >
        <Zap size={13} fill="currentColor" />
        <span>REDEEM REWARDS</span>
        <ChevronRight size={14} />
      </Link>
    </div>
  );
}

// ── MORE / SYSTEM SPOTLIGHT WIDGET ────────────────────────────────────────────
export function SystemSpotlight({ onClose }: { onClose?: () => void }) {
  const { is4K, toggle: toggle4K } = useDisplayMode();
  const setOptionsModalOpen = useVaultStore((s) => s.setOptionsModalOpen);

  return (
    <div
      className="flex flex-col justify-between p-4 h-full rounded border"
      style={{
        background: 'linear-gradient(135deg, rgba(168,85,247,0.12) 0%, rgba(10,10,18,0.85) 100%)',
        borderColor: 'rgba(168,85,247,0.3)',
        boxShadow: 'inset 0 0 30px rgba(168,85,247,0.08)',
        clipPath: 'polygon(6px 0%, 100% 0%, calc(100% - 6px) 100%, 0% 100%)',
      }}
    >
      <div>
        {/* Top Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 font-mono text-[9px] font-black uppercase tracking-widest text-[#A855F7]">
            <Radio size={12} />
            <span>TH3SCR1B3 PROTOCOL MATRIX</span>
          </div>
          <span className="font-mono text-[8px] font-black bg-[#A855F7]/20 text-[#c084fc] px-1.5 py-0.5 rounded border border-[#A855F7]/30">
            v2.1 ONLINE
          </span>
        </div>

        {/* System Settings Mini-Toggles */}
        <div className="space-y-2 mb-3">
          <div
            onClick={toggle4K}
            className="flex items-center justify-between p-2 bg-black/40 border border-white/10 hover:border-[#A855F7]/50 rounded cursor-pointer transition-all"
          >
            <div className="flex items-center gap-2">
              <Monitor size={14} className={is4K ? "text-[#ffd700]" : "text-white/40"} />
              <span className="font-mono text-[9px] font-bold text-white uppercase">4K HDR DISPLAY SHADERS</span>
            </div>
            <span className={`font-mono text-[8px] font-black px-1.5 py-0.5 rounded ${is4K ? 'bg-[#ffd700]/20 text-[#ffd700]' : 'bg-white/5 text-white/40'}`}>
              {is4K ? 'ENABLED' : 'OFF'}
            </span>
          </div>

          <div className="p-2 bg-black/40 border border-white/10 rounded">
            <span className="font-mono text-[8px] text-white/40 uppercase">EVM NETWORK NODE</span>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-2 h-2 rounded-full bg-[#0052FF] animate-pulse" />
              <span className="font-mono text-[9px] text-white font-bold">BASE MAINNET (8453)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Button */}
      <button
        onClick={() => {
          haptics.mediumTap();
          onClose?.();
          setOptionsModalOpen(true);
        }}
        className="flex items-center justify-center gap-2 w-full py-2.5 bg-[#A855F7] hover:bg-[#b86dfa] text-black font-impact text-sm uppercase tracking-wider transition-all active:scale-95 shadow-[0_0_20px_rgba(168,85,247,0.4)] border-none cursor-pointer"
        style={{
          clipPath: 'polygon(4px 0%, 100% 0%, calc(100% - 4px) 100%, 0% 100%)',
        }}
      >
        <Volume2 size={13} fill="currentColor" />
        <span>AUDIO DSP & CALIBRATION</span>
        <ChevronRight size={14} />
      </button>
    </div>
  );
}
