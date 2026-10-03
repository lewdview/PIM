import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { audioManager } from '../game/audio';
import { useVaultStore } from '../store/useVaultStore';
import { useAuthStore } from '../store/useAuthStore';
import { supabase } from '../services/supabaseClient';
import {
  ArrowLeft, Zap, Flame, Gift, CheckCircle, Trophy,
  CalendarDays, KeyRound, Sparkles,
} from 'lucide-react';

// ── Reward math (mirrors public.claim_daily_streak server-side) ──────────────
// day 1 = 10 sparks, +2 per consecutive day, capped at 50/day.
// Milestone bonuses: +100 at exactly 7 days, +300 at exactly 30 days.
function baseRewardFor(streak: number): number {
  return Math.min(10 + 2 * (streak - 1), 50);
}
function milestoneFor(streak: number): number {
  if (streak === 7) return 100;
  if (streak === 30) return 300;
  return 0;
}

type StreakState = {
  streak: number;
  canClaim: boolean;
  baseReward: number;
  milestoneBonus: number;
  reward: number;
};

function msUntilUtcMidnight(): number {
  const now = new Date();
  const next = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0,
  ));
  return next.getTime() - now.getTime();
}

function formatCountdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export default function EarnPage() {
  const [, setLocation] = useLocation();
  const { tokenBalance } = useVaultStore();
  const { user, setShowAuthModal } = useAuthStore();

  const [streak, setStreak] = useState<StreakState | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [rpcMissing, setRpcMissing] = useState(false);
  const [feedback, setFeedback] = useState<{ amount: number; milestone: number; streak: number } | null>(null);
  const [countdown, setCountdown] = useState('');

  const loadStreak = useCallback(async () => {
    setLoading(true);
    setRpcMissing(false);
    try {
      const { data, error } = await supabase.rpc('claim_daily_streak', { p_dry_run: true });
      if (error) throw error;
      setStreak({
        streak: data.streak ?? 0,
        canClaim: !!data.can_claim,
        baseReward: data.base_reward ?? baseRewardFor(Math.max(1, data.streak ?? 1)),
        milestoneBonus: data.milestone_bonus ?? 0,
        reward: data.reward ?? 0,
      });
    } catch (e: any) {
      // The migration hasn't been applied yet → the RPC doesn't exist.
      // Show the page shell with an honest syncing state instead of crashing.
      if (e?.code === '42883' || /claim_daily_streak/i.test(e?.message || '')) {
        setRpcMissing(true);
      } else {
        console.error('[Streak] preview failed:', e?.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) void loadStreak();
    else setLoading(false);
  }, [user, loadStreak]);

  // Live countdown while claimed (resets at 00:00 UTC, same boundary as server).
  useEffect(() => {
    if (!streak || streak.canClaim) return;
    const tick = () => setCountdown(formatCountdown(msUntilUtcMidnight()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [streak]);

  const handleClaim = async () => {
    if (claiming || !streak?.canClaim) return;
    setClaiming(true);
    audioManager.playSfx('menu_confirm', 0.15);
    try {
      const { data, error } = await supabase.rpc('claim_daily_streak');
      if (error) throw error;
      if (!data?.success) {
        if (data?.error === 'ALREADY_CLAIMED') {
          await loadStreak();
          return;
        }
        throw new Error(data?.error || 'Claim failed');
      }
      // Server is the source of truth for the new balance.
      const nextTokens = typeof data.tokens === 'number' ? data.tokens : tokenBalance + data.reward;
      useVaultStore.setState({ tokenBalance: nextTokens });
      try { localStorage.setItem('pim_token_balance', String(nextTokens)); } catch {}
      audioManager.playSfx('hidden_secret_found', 0.3);
      setFeedback({ amount: data.reward, milestone: data.milestone_bonus || 0, streak: data.streak });
      window.dispatchEvent(new Event('vault:points_updated'));
      await loadStreak();
    } catch (e: any) {
      console.error('[Streak] claim failed:', e?.message);
      audioManager.playSfx('locked_out', 0.8);
    } finally {
      setClaiming(false);
    }
  };

  const handleBack = () => {
    audioManager.playSfx('back', 0.4);
    setLocation('/vault');
  };

  // ── Unauthenticated wall (same rule as the Claim page) ─────────────────────
  if (!user) {
    return (
      <div
        className="min-h-screen bg-[#07070a] text-white flex flex-col font-sans select-none relative overflow-y-auto"
        style={{
          minHeight: '100dvh',
          WebkitOverflowScrolling: 'touch',
          paddingBottom: 'calc(var(--fc-safe-area-bottom, 0px) + env(safe-area-inset-bottom, 0px) + 6rem)',
        }}
      >
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-16 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-6 text-center max-w-sm bg-white/[0.03] border border-white/10 p-8"
            style={{
              clipPath: 'polygon(10px 0%, 100% 0%, calc(100% - 10px) 100%, 0% 100%)',
            }}
          >
            <div className="w-16 h-16 rounded-full bg-white/[0.03] border border-white/10 flex items-center justify-center">
              <KeyRound size={26} className="text-[#ff3800]" />
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase mb-2 text-white" style={{ fontFamily: '"Impact", "Arial Black", sans-serif' }}>
                Identity Required
              </h1>
              <p className="text-xs font-mono leading-relaxed text-zinc-400">
                Connect your Web3 Identity or guest account to start your daily spark streak.
              </p>
            </div>
            <button
              onClick={() => { audioManager.playSfx('tap_nav', 0.4); setShowAuthModal(true); }}
              className="px-6 py-3 font-mono font-bold text-xs uppercase tracking-wider text-black bg-[#ff3800] border-2 border-black shadow-[3px_3px_0_#000] hover:scale-105 active:scale-95 transition-all cursor-pointer"
              style={{
                minHeight: '48px',
                clipPath: 'polygon(8px 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%)',
              }}
            >
              Connect Identity
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  const nextMilestone = streak && streak.streak < 7 ? 7 : streak && streak.streak < 30 ? 30 : null;
  const progressToMilestone = nextMilestone
    ? Math.min(100, Math.round(((streak?.streak || 0) / nextMilestone) * 100))
    : 100;

  return (
    <div
      className="min-h-screen bg-[#07070a] text-white flex flex-col font-sans select-none relative overflow-y-auto"
      style={{
        minHeight: '100dvh',
        WebkitOverflowScrolling: 'touch',
        paddingBottom: 'calc(var(--fc-safe-area-bottom, 0px) + env(safe-area-inset-bottom, 0px) + 6.5rem)',
      }}
    >
      {/* Background Grid Lines */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

      {/* Header Bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-black/40 backdrop-blur-md relative z-10">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 px-3 py-1.5 border border-white/10 hover:border-white/20 transition-all font-mono text-[10px] font-black uppercase tracking-wider text-white/60 hover:text-white cursor-pointer"
          style={{
            minHeight: '38px',
            clipPath: 'polygon(4px 0%, 100% 0%, calc(100% - 4px) 100%, 0% 100%)',
          }}
        >
          <ArrowLeft size={12} />
          Vault
        </button>

        <div className="text-center">
          <h1 className="font-mono text-xs font-black tracking-[0.25em] uppercase text-white/50">
            Streak_Terminal
          </h1>
        </div>

        <div className="flex items-center gap-2 border border-white/5 bg-black/30 px-3 py-1 rounded-lg">
          <Zap size={11} className="text-[#ff9900]" />
          <span className="font-mono text-xs font-black text-white">{tokenBalance}</span>
          <span className="font-mono text-[8px] uppercase tracking-widest text-white/40">sparks</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 relative z-10 max-w-lg mx-auto w-full">
        {/* Claim feedback toast */}
        <AnimatePresence>
          {feedback && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="w-full mb-6 bg-[#39FF14]/10 border border-[#39FF14]/30 rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-1.5 shadow-lg shadow-[#39FF14]/5 relative overflow-hidden"
            >
              <div className="absolute -top-1 left-4 right-4 h-[1px] bg-gradient-to-r from-transparent via-[#39FF14] to-transparent" />
              <div className="flex items-center gap-2 font-mono text-xs font-black text-[#39FF14] tracking-widest uppercase">
                <CheckCircle size={14} />
                Day {feedback.streak} streak claimed
              </div>
              <span className="font-mono text-lg font-black text-white">
                +{feedback.amount} SPARKS{feedback.milestone > 0 ? ` (incl. +${feedback.milestone} milestone)` : ''}
              </span>
              <button
                onClick={() => { audioManager.playSfx('tap_nav', 0.1); setFeedback(null); }}
                className="mt-2 text-[9px] font-mono font-bold uppercase tracking-wider border border-[#39FF14]/25 hover:border-[#39FF14]/60 px-4 py-1.5 rounded-lg text-[#39FF14] bg-transparent cursor-pointer transition-all"
              >
                Acknowledge
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
          <div className="font-mono text-[10px] uppercase tracking-widest text-white/40 animate-pulse">
            Syncing streak…
          </div>
        ) : rpcMissing ? (
          <div className="w-full bg-black/40 border border-white/10 rounded-2xl p-8 text-center space-y-3">
            <Sparkles size={22} className="mx-auto text-[#ffd700]" />
            <p className="font-mono text-xs font-black uppercase tracking-widest text-white/80">
              Streak engine syncing
            </p>
            <p className="font-mono text-[10px] text-white/40 leading-relaxed">
              The daily streak contract is deploying. Check back shortly — your future check-ins will count from day one.
            </p>
          </div>
        ) : streak && (
          <div className="w-full flex flex-col gap-5">
            {/* ── Streak readout ── */}
            <div className="bg-black/40 border border-white/10 rounded-2xl p-6 relative overflow-hidden text-center">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#ff9900] to-transparent" />
              <div className="font-mono text-[8px] tracking-[0.3em] text-white/40 uppercase mb-3 flex items-center justify-center gap-2">
                <CalendarDays size={12} /> Daily spark streak
              </div>
              <div className="flex items-center justify-center gap-3">
                <Flame size={40} className={streak.streak > 0 ? 'text-[#ff9900]' : 'text-white/20'} />
                <span className="font-mono text-6xl font-black text-white">{streak.streak}</span>
              </div>
              <p className="font-mono text-[9px] uppercase tracking-widest text-white/40 mt-2">
                {streak.streak === 0 ? 'No streak yet — claim to start day 1' : `day${streak.streak === 1 ? '' : 's'} strong · miss a day and it resets`}
              </p>
            </div>

            {/* ── Today's reward ── */}
            <div className="bg-black/40 border border-[#ffd700]/20 rounded-2xl p-6 relative overflow-hidden">
              <div className="font-mono text-[8px] tracking-[0.3em] text-[#ffd700]/70 uppercase mb-3 text-center">
                {streak.canClaim ? "Today's drop" : 'Claimed — next drop'}
              </div>
              <div className="text-center">
                <span className="font-mono text-4xl font-black text-[#ffd700]">
                  +{streak.canClaim ? streak.reward : baseRewardFor(streak.streak + 1)}
                </span>
                <span className="font-mono text-sm text-white/50 uppercase ml-2">sparks</span>
              </div>
              {streak.canClaim && streak.milestoneBonus > 0 && (
                <div className="mt-2 flex items-center justify-center gap-2 font-mono text-[10px] font-black uppercase tracking-wider text-[#39FF14]">
                  <Trophy size={12} /> includes +{streak.milestoneBonus} milestone bonus
                </div>
              )}
              {!streak.canClaim && (
                <p className="mt-2 text-center font-mono text-[10px] text-white/40 uppercase tracking-widest">
                  Resets in {countdown} UTC
                </p>
              )}
            </div>

            {/* ── Milestones ── */}
            <div className="bg-black/40 border border-white/10 rounded-2xl p-6 space-y-4">
              <div className="font-mono text-[8px] tracking-[0.3em] text-white/40 uppercase text-center">
                Milestones
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { day: 7, bonus: 100 },
                  { day: 30, bonus: 300 },
                ].map((m) => {
                  const done = streak.streak >= m.day;
                  const current = !done && nextMilestone === m.day;
                  return (
                    <div
                      key={m.day}
                      className={`rounded-xl border p-4 text-center transition-all ${
                        done
                          ? 'border-[#39FF14]/40 bg-[#39FF14]/5'
                          : current
                            ? 'border-[#ffd700]/40 bg-[#ffd700]/5'
                            : 'border-white/5 bg-black/30'
                      }`}
                    >
                      <div className={`font-mono text-[9px] font-black uppercase tracking-widest ${done ? 'text-[#39FF14]' : current ? 'text-[#ffd700]' : 'text-white/30'}`}>
                        Day {m.day}
                      </div>
                      <div className="font-mono text-lg font-black text-white mt-1">+{m.bonus} ⚡</div>
                      <div className="font-mono text-[7px] uppercase tracking-widest text-white/30 mt-1">
                        {done ? 'claimed' : current ? 'next up' : 'locked'}
                      </div>
                    </div>
                  );
                })}
              </div>
              {nextMilestone && (
                <div className="space-y-1.5">
                  <div className="w-full bg-white/5 border border-white/10 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-[#ff9900] to-[#ffd700] h-full rounded-full transition-all"
                      style={{ width: `${progressToMilestone}%` }}
                    />
                  </div>
                  <p className="text-center font-mono text-[8px] uppercase tracking-widest text-white/40">
                    {nextMilestone - streak.streak} day{nextMilestone - streak.streak === 1 ? '' : 's'} to the day-{nextMilestone} milestone
                  </p>
                </div>
              )}
              {!nextMilestone && streak.streak >= 30 && (
                <p className="text-center font-mono text-[8px] uppercase tracking-widest text-[#39FF14]">
                  All milestones crushed — streak pays {baseRewardFor(streak.streak)} sparks/day
                </p>
              )}
            </div>

            {/* ── Claim button ── */}
            <button
              onClick={handleClaim}
              disabled={!streak.canClaim || claiming}
              className={`w-full py-4 font-mono text-sm font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 ${
                streak.canClaim
                  ? 'text-black bg-gradient-to-r from-[#ffd700] to-[#ff9900] border-2 border-black shadow-[4px_4px_0_#000] hover:scale-[1.02] active:scale-95 cursor-pointer'
                  : 'bg-white/5 border border-white/10 text-white/25 cursor-not-allowed'
              }`}
              style={{
                minHeight: '52px',
                clipPath: 'polygon(8px 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%)',
              }}
            >
              <Gift size={16} />
              {claiming ? 'Claiming…' : streak.canClaim ? `Claim +${streak.reward} sparks` : 'Claimed for today'}
            </button>
            <p className="text-center font-mono text-[8px] text-white/30 uppercase tracking-widest leading-relaxed">
              One claim per day · UTC midnight reset · server-verified
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
