// ════════════════════════════════════════════════════════════════════════════════
// useDailyRewards.ts — Today's three daily actions for the Stage home:
//   • the day card: claim it free, or buy another pull of it with sparks
//   • the free pack (once per day)
//   • the spark streak check-in (public.claim_daily_streak), which pays sparks
//     per consecutive day and drives the streak counter
// Every grant is server-side; this hook only calls the existing services and
// keeps the vault store in sync.
// ════════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useVaultStore } from '../store/useVaultStore';
import { useAuthStore } from '../store/useAuthStore';
import { useLoadingToast } from '../store/useLoadingToast';
import { supabase } from '../services/supabaseClient';
import {
  hasClaimedToday, hasClaimedFreePackToday, claimDailyCard, targetedPull, purchasePack,
} from '../services/vaultService';
import { getAdminConfig } from '../utils/adminConfig';
import { PACK_CONFIGS } from '../utils/rarity';
import { audioManager } from '../game/audio';

export interface SparkStreak {
  streak: number;
  canClaim: boolean;
  reward: number;
  milestoneBonus: number;
}

type Busy = 'card' | 'buy' | 'pack' | 'streak' | null;

export function useDailyRewards(day: number) {
  const [, setLocation] = useLocation();
  const user = useAuthStore((s) => s.user);
  const setShowAuthModal = useAuthStore((s) => s.setShowAuthModal);
  const hasClaimed = useVaultStore((s) => s.hasClaimed);
  const tokenBalance = useVaultStore((s) => s.tokenBalance);

  const [freePackClaimed, setFreePackClaimed] = useState<boolean | null>(null);
  const [streak, setStreak] = useState<SparkStreak | null>(null);
  const [busy, setBusy] = useState<Busy>(null);

  const buyCost = getAdminConfig().targetedPullCost ?? 275;

  const loadStreak = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('claim_daily_streak', { p_dry_run: true });
      if (error) throw error;
      setStreak({
        streak: data.streak ?? 0,
        canClaim: !!data.can_claim,
        reward: data.reward ?? 0,
        milestoneBonus: data.milestone_bonus ?? 0,
      });
    } catch (e: any) {
      console.warn('[useDailyRewards] streak preview failed:', e?.message);
      setStreak(null);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setFreePackClaimed(null);
      setStreak(null);
      return;
    }
    let live = true;
    hasClaimedToday(day).then((v) => live && useVaultStore.getState().setHasClaimed(v));
    hasClaimedFreePackToday().then((v) => live && setFreePackClaimed(v));
    void loadStreak();
    return () => { live = false; };
  }, [user, day, loadStreak]);

  const needUser = useCallback(() => {
    if (user) return false;
    setShowAuthModal(true);
    return true;
  }, [user, setShowAuthModal]);

  const run = useCallback(async (kind: Busy, label: string, fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(kind);
    useLoadingToast.getState().show(label);
    try {
      await fn();
    } catch (err) {
      console.error(`[useDailyRewards] ${kind} failed:`, err);
    } finally {
      useLoadingToast.getState().hide();
      setBusy(null);
    }
  }, [busy]);

  const claimCard = useCallback(() => {
    if (hasClaimed || needUser()) return;
    void run('card', 'Claiming daily card…', async () => {
      const owned = await claimDailyCard(day);
      if (!owned) {
        alert("Couldn't claim today's card. It may already be claimed on this account.");
        return;
      }
      const vault = useVaultStore.getState();
      vault.addToCollection([owned]);
      vault.setHasClaimed(true);
      audioManager.playSfx('open_chest', 0.9);
      vault.startReveal([owned], {
        category: 'daily_claim', label: 'Daily Drop', icon: '⭐', accent: '#ffd700',
        gradient: 'linear-gradient(145deg, #1a1200, #0c0800)', price: 'FREE', cardCount: 1,
        revealType: 'cinematic', redirectPath: `/play/${owned.cardId}`,
      });
      setLocation('/vault/reveal');
    });
  }, [day, hasClaimed, needUser, run, setLocation]);

  const buyCard = useCallback(() => {
    if (needUser()) return;
    if (tokenBalance < buyCost) {
      setLocation('/vault/earn');
      return;
    }
    void run('buy', 'Pulling another copy…', async () => {
      const owned = await targetedPull(day);
      if (!owned) return;
      const vault = useVaultStore.getState();
      vault.addToCollection([owned]);
      audioManager.playSfx('open_chest', 0.9);
      vault.startReveal([owned], {
        category: 'targeted', label: `Day ${day} pull`, icon: '🎯', accent: '#ff9900',
        gradient: 'linear-gradient(145deg, #1a1000, #0a0800)', price: `${buyCost} V⚡`, cardCount: 1,
        revealType: 'cinematic',
      });
      await vault.loadVaultData(true);
      setLocation('/vault/reveal');
    });
  }, [day, tokenBalance, buyCost, needUser, run, setLocation]);

  const openFreePack = useCallback(() => {
    if (freePackClaimed || needUser()) return;
    void run('pack', 'Opening free pack…', async () => {
      const cards = await purchasePack('free', 'single');
      setFreePackClaimed(true);
      if (cards.length === 0) return;
      const vault = useVaultStore.getState();
      vault.addToCollection(cards);
      const cfg = PACK_CONFIGS.free;
      const tier = cfg?.tiers[0];
      audioManager.playSfx('open_chest', 0.9);
      vault.startReveal(cards, cfg && tier ? {
        category: 'free', size: tier.size, label: cfg.label, icon: cfg.icon, accent: cfg.accent,
        gradient: cfg.gradient, price: tier.price, cardCount: cards.length, coverImage: tier.coverImage,
        revealType: 'cinematic',
      } : undefined);
      await vault.loadVaultData(true);
      setLocation('/vault/reveal');
    });
  }, [freePackClaimed, needUser, run, setLocation]);

  const claimStreak = useCallback(() => {
    if (needUser() || !streak?.canClaim) return;
    void run('streak', 'Collecting sparks…', async () => {
      const { data, error } = await supabase.rpc('claim_daily_streak');
      if (error) throw error;
      if (data?.success && typeof data.tokens === 'number') {
        useVaultStore.setState({ tokenBalance: data.tokens });
        try { localStorage.setItem('pim_token_balance', String(data.tokens)); } catch { /* storage off */ }
        window.dispatchEvent(new Event('vault:points_updated'));
        audioManager.playSfx('hidden_secret_found', 0.3);
      }
      await loadStreak();
    });
  }, [needUser, streak, run, loadStreak]);

  return {
    signedIn: !!user,
    hasClaimed,
    freePackClaimed,
    streak,
    buyCost,
    canAffordBuy: tokenBalance >= buyCost,
    busy,
    claimCard,
    buyCard,
    openFreePack,
    claimStreak,
  };
}

/** Sparks paid on a given streak day, mirroring public.claim_daily_streak. */
export function sparksForStreakDay(n: number) {
  const base = Math.min(10 + 2 * (n - 1), 50);
  return base + (n === 7 ? 100 : n === 30 ? 300 : 0);
}
