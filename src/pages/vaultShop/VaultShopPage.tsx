import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'wouter';
import { Clock, Gift, Play, Zap } from 'lucide-react';
import Card from '../../components/Card';
import PaymentSelectModal from '../../components/PaymentSelectModal';
import { useVaultStore } from '../../store/useVaultStore';
import { useLoadingToast } from '../../store/useLoadingToast';
import { useAuthStore } from '../../store/useAuthStore';
import { useLiveClaimCount } from '../../hooks/useLiveClaimCount';
import { audioManager } from '../../game/audio';
import { getCurrentDay, getTimeUntilNextDay } from '../../utils/dayCalc';
import { loadCatalog } from '../../game/api';
import { payWithCrypto } from '../../services/coinbaseService';
import {
  getCardByDay, hasClaimedToday, claimDailyCard, silentClaimGuestDailyCard,
  purchasePack, buyTokenPack, hasClaimedFreePackToday,
  createStripeCheckoutSession, redirectToStripeCheckout,
  type OwnedCard,
} from '../../services/vaultService';
import PrizeCounter, { type CounterTab } from './PrizeCounter';
import VendingMachine from './VendingMachine';
import { sparkCost, vendingSlots, type PitPack } from './clawPits';
import '../../styles/vaultShop.css';

interface TrayItem { key: string; pack: PitPack; cards: OwnedCard[] }

export default function VaultShopPage() {
  const [, setLocation] = useLocation();
  const user = useAuthStore(s => s.user);
  const {
    dailyCard, hasClaimed, tokenBalance, loadVaultData, setDailyCard, setHasClaimed,
    startReveal, addToCollection,
  } = useVaultStore();
  const today = getCurrentDay();

  const [bombshellArt, setBombshellArt] = useState<'dark' | 'light'>('dark');
  const vendRows = useMemo(() => vendingSlots(bombshellArt), [bombshellArt]);

  const [freeTaken, setFreeTaken] = useState(false);
  const lockedIds = useMemo(() => new Set(freeTaken ? ['free:single'] : []), [freeTaken]);

  const [paying, setPaying] = useState(false);
  const [checkout, setCheckout] = useState<{ pack: PitPack; resolve: (cards: OwnedCard[] | null) => void } | null>(null);
  const vendedCards = useRef<OwnedCard[]>([]);
  const [tray, setTray] = useState<TrayItem[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [counterTab, setCounterTab] = useState<CounterTab>('sparks');

  const [songId, setSongId] = useState<string | null>(null);
  const { count: claimedCount, optimisticIncrement } = useLiveClaimCount(today);
  const [countdown, setCountdown] = useState(getTimeUntilNextDay());

  useEffect(() => { hasClaimedFreePackToday().then(setFreeTaken); }, []);
  // Old 99¢ claw checkouts returned here; the claw has its own page now.
  useEffect(() => {
    const q = window.location.search;
    if (q.includes('claw_session=')) setLocation(`/bonus-claw${q}`);
  }, [setLocation]);
  useEffect(() => {
    const t = setInterval(() => setCountdown(getTimeUntilNextDay()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const card = await getCardByDay(today);
      if (!alive) return;
      setDailyCard(card);
      setHasClaimed(await hasClaimedToday(today));
      await loadVaultData();
      try {
        const catalog = await loadCatalog();
        const matched = catalog.find(s => s.day === today) || catalog.find(s => s.id === card?.id);
        if (alive && matched) setSongId(matched.id);
      } catch (err) {
        console.error('Catalog load failed:', err);
      }
    })();
    return () => { alive = false; };
  }, [today, setDailyCard, setHasClaimed, loadVaultData]);

  // ===== Daily drop =====
  const handleClaim = useCallback(async () => {
    if (hasClaimed) return;
    useLoadingToast.getState().show('Claiming today’s drop…');
    try {
      const owned = user ? await claimDailyCard(today) : await silentClaimGuestDailyCard(today);
      useLoadingToast.getState().hide();
      if (!owned) { setToast('Couldn’t claim today’s drop. It may already be on this account.'); return; }
      addToCollection([owned]);
      setHasClaimed(true);
      optimisticIncrement();
      audioManager.playSfx('open_chest', 0.9);
      startReveal([owned], {
        category: 'daily_claim', label: 'Daily Drop', icon: '⭐',
        accent: '#3b82f6', gradient: 'linear-gradient(145deg, #0a192f, #020c1b)',
        price: 'FREE', cardCount: 1, revealType: 'cinematic', redirectPath: `/play/${owned.cardId}`,
      });
      setLocation('/vault/reveal');
    } catch (err: any) {
      useLoadingToast.getState().hide();
      setToast(`Couldn’t claim today’s drop: ${err?.message || err}`);
    }
  }, [hasClaimed, user, today, addToCollection, setHasClaimed, optimisticIncrement, startReveal, setLocation]);

  // ===== Prize checkout =====
  const toTray = useCallback((pack: PitPack, cards: OwnedCard[]) => {
    addToCollection(cards);
    setTray(prev => [...prev, { key: crypto.randomUUID(), pack, cards }]);
    audioManager.playSfx('open_chest', 0.8);
    if (pack.category === 'free') setFreeTaken(true);
  }, [addToCollection]);

  /**
   * Charge for one pack, whichever machine it came from.
   * Resolves with the cards, or null if nothing was bought (no charge).
   */
  const buy = useCallback(async (pack: PitPack): Promise<OwnedCard[] | null> => {
    if (!user) { useAuthStore.getState().setShowAuthModal(true); return null; }
    if (pack.currency === 'usd') {
      return new Promise(resolve => setCheckout({ pack, resolve }));
    }
    if (pack.currency === 'spark' && tokenBalance < sparkCost(pack)) {
      audioManager.playSfx('not_enough', 0.6);
      setCounterTab('sparks');
      document.getElementById('prize-counter')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setToast(`You need ${sparkCost(pack) - tokenBalance} more V⚡.`);
      return null;
    }
    setPaying(true);
    useLoadingToast.getState().show('Paying…');
    try {
      const cards = pack.currency === 'spark'
        ? await buyTokenPack(pack.category as 'vault_token' | 'bombshell_token', pack.size)
        : await purchasePack(pack.category, pack.size);
      if (cards === 'insufficient') { setToast('Not enough V⚡ for this pack.'); return null; }
      if (!cards.length) { setToast('That pack didn’t come through. You weren’t charged.'); return null; }
      return cards;
    } catch (err: any) {
      console.error('Pack purchase failed:', err);
      setToast(err?.message || 'That didn’t go through. Try again.');
      return null;
    } finally {
      useLoadingToast.getState().hide();
      setPaying(false);
      loadVaultData();
    }
  }, [user, tokenBalance, loadVaultData]);

  const vend = useCallback(async (pack: PitPack) => {
    const cards = await buy(pack);
    if (!cards) return false;
    vendedCards.current = cards;
    return true;
  }, [buy]);

  const vendDropped = useCallback((pack: PitPack) => {
    toTray(pack, vendedCards.current);
    vendedCards.current = [];
  }, [toTray]);

  const closeCheckout = useCallback(() => {
    checkout?.resolve(null);
    setCheckout(null);
  }, [checkout]);

  const handlePaymentSelect = useCallback(async (method: 'crypto' | 'stripe') => {
    if (!checkout) return;
    const { pack, resolve } = checkout;
    setCheckout(null);
    if (method === 'stripe') {
      try {
        useLoadingToast.getState().show('Opening checkout…');
        const res = await createStripeCheckoutSession(pack.category, pack.size);
        useLoadingToast.getState().hide();
        if (res.success && res.checkoutUrl) await redirectToStripeCheckout(res.checkoutUrl);
        else setToast(`Checkout didn’t open. ${res.error || 'Try again.'}`);
      } catch (err: any) {
        useLoadingToast.getState().hide();
        setToast(err?.message || 'Checkout didn’t open. Try again.');
      }
      resolve(null);
      return;
    }
    try {
      useLoadingToast.getState().show('Confirm in your wallet…');
      const txHash = await payWithCrypto(pack.priceValue);
      if (!txHash) { resolve(null); return; }
      useLoadingToast.getState().show('Verifying transaction…');
      const cards = await purchasePack(pack.category, pack.size, undefined, txHash);
      await loadVaultData();
      resolve(cards.length ? cards : null);
    } catch (err: any) {
      setToast(err?.message || 'Payment failed.');
      resolve(null);
    } finally {
      useLoadingToast.getState().hide();
    }
  }, [checkout, loadVaultData]);

  const openTray = useCallback(() => {
    if (!tray.length) return;
    const cards = tray.flatMap(t => t.cards);
    const last = tray[tray.length - 1];
    audioManager.playSfx('by_th3scr1b3', 0.9);
    startReveal(cards, {
      category: last.pack.category, size: last.pack.size,
      label: tray.length === 1 ? last.pack.label : `${tray.length} packs`,
      icon: tray.length === 1 ? last.pack.icon : '🎰',
      accent: '#ff1493', gradient: 'linear-gradient(145deg, #1a0716, #05010a)',
      price: `${tray.length} pack${tray.length === 1 ? '' : 's'}`,
      cardCount: cards.length, revealType: 'cinematic', redirectPath: '/next-vault',
    });
    setTray([]);
    setLocation('/vault/reveal');
  }, [tray, startReveal, setLocation]);

  const trayCards = tray.reduce((n, t) => n + t.cards.length, 0);
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div className="claw-page">
      <div className="claw-room" aria-hidden />

      <header className="claw-top">
        <div>
          <p className="claw-kicker">Arcade floor · Day {today}</p>
          <h1 className="claw-title">Vending machine</h1>
        </div>
        <div className="claw-top-actions">
          <button
            type="button" className="claw-balance"
            onClick={() => { setCounterTab('sparks'); document.getElementById('prize-counter')?.scrollIntoView({ behavior: 'smooth' }); }}
            title="Get more V⚡"
          >
            <Zap size={16} /> {tokenBalance.toLocaleString()} <span>V⚡</span>
          </button>
          <button type="button" className="claw-chip" onClick={() => setLocation('/arcade')}>
            <Play size={14} /> Arcade
          </button>
        </div>
      </header>

      <main className="claw-layout">
        <div className="claw-main">
          <div className="shop-switch">
            <button type="button" className="shop-claw-link" onClick={() => setLocation('/bonus-claw')}>
              🕹️ Bonus claw →
            </button>
            <button type="button" className="claw-link shop-art" onClick={() => setBombshellArt(a => (a === 'dark' ? 'light' : 'dark'))}>
              {bombshellArt === 'dark' ? '🌙 Dark art' : '☀️ Light art'}
            </button>
          </div>

              <p className="claw-muted">Tap a pack or punch in its code, then hit VEND. Your packs drop into the flap; push it to open them all.</p>
              <VendingMachine
                rows={vendRows}
                lockedIds={lockedIds}
                credit={tokenBalance}
                onVend={vend}
                onDropped={vendDropped}
                trayPacks={tray.map(t => t.pack)}
                trayCards={trayCards}
                onOpenTray={openTray}
                busy={paying || !!checkout}
              />
        </div>

        <aside className="claw-side">
          <section className="claw-daily">
            <header>
              <h2>Today’s drop</h2>
              <span className="claw-timer"><Clock size={13} /> {pad(countdown.hours)}:{pad(countdown.minutes)}:{pad(countdown.seconds)}</span>
            </header>
            <div className="claw-daily-card">
              {dailyCard ? (
                <Card card={{ ...dailyCard, claimedCount }} interactive={false} showAudio isDailyOrigin={false} />
              ) : (
                <div className="claw-daily-loading">Loading today’s drop…</div>
              )}
            </div>
            {!hasClaimed ? (
              <button type="button" className="claw-btn claw-btn-gold claw-btn-wide" onClick={handleClaim} disabled={!dailyCard}>
                <Gift size={18} /> Claim free card
              </button>
            ) : (
              <button type="button" className="claw-btn claw-btn-blue claw-btn-wide" onClick={() => setLocation(songId ? `/play/${songId}` : '/arcade')}>
                <Play size={18} /> Play today’s song
              </button>
            )}
            <p className="claw-muted claw-center">{claimedCount}/100 claimed today</p>
          </section>
        </aside>
      </main>

      <div className="claw-counter-wide">
        <PrizeCounter today={today} tab={counterTab} onTab={setCounterTab} />
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div className="claw-toast" role="status" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {checkout && (
        <PaymentSelectModal
          isOpen
          onClose={closeCheckout}
          onSelect={handlePaymentSelect}
          packLabel={checkout.pack.label}
          price={checkout.pack.price}
          priceValue={checkout.pack.priceValue}
          accent={checkout.pack.accent}
        />
      )}
    </div>
  );
}
