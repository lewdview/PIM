import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'wouter';
import { Clock, Gift, Play, Zap, Sparkles, X } from 'lucide-react';
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
import ClawCabinet, { PackToken } from './ClawCabinet';
import PrizeCounter, { type CounterTab } from './PrizeCounter';
import { CLAW_PITS, packsForPit, sparkCost, type PitPack } from './clawPits';
import '../../styles/clawMachine.css';

interface TrayItem { key: string; pack: PitPack; cards: OwnedCard[] }

export default function ClawMachinePage() {
  const [, setLocation] = useLocation();
  const user = useAuthStore(s => s.user);
  const {
    dailyCard, hasClaimed, tokenBalance, loadVaultData, setDailyCard, setHasClaimed,
    startReveal, addToCollection,
  } = useVaultStore();
  const today = getCurrentDay();

  const [pitId, setPitId] = useState('bombshell');
  const [bombshellArt, setBombshellArt] = useState<'dark' | 'light'>('dark');
  const pit = CLAW_PITS.find(p => p.id === pitId) ?? CLAW_PITS[1];
  const packs = useMemo(() => packsForPit(pit, bombshellArt), [pit, bombshellArt]);

  const [freeTaken, setFreeTaken] = useState(false);
  const lockedIds = useMemo(() => new Set(freeTaken ? ['free:single'] : []), [freeTaken]);

  const [prize, setPrize] = useState<PitPack | null>(null);
  const [paying, setPaying] = useState(false);
  const [checkout, setCheckout] = useState<PitPack | null>(null);
  const [tray, setTray] = useState<TrayItem[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [counterTab, setCounterTab] = useState<CounterTab>('sparks');

  const [songId, setSongId] = useState<string | null>(null);
  const { count: claimedCount, optimisticIncrement } = useLiveClaimCount(today);
  const [countdown, setCountdown] = useState(getTimeUntilNextDay());

  useEffect(() => { hasClaimedFreePackToday().then(setFreeTaken); }, []);
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
    setPrize(null);
  }, [addToCollection]);

  const payForPrize = useCallback(async () => {
    if (!prize) return;
    if (!user) { useAuthStore.getState().setShowAuthModal(true); return; }
    if (prize.currency === 'usd') { setCheckout(prize); return; }
    if (prize.currency === 'spark' && tokenBalance < sparkCost(prize)) {
      audioManager.playSfx('not_enough', 0.6);
      setCounterTab('sparks');
      document.getElementById('prize-counter')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setToast(`You need ${sparkCost(prize) - tokenBalance} more V⚡.`);
      return;
    }
    setPaying(true);
    useLoadingToast.getState().show('Opening the prize door…');
    try {
      const cards = prize.currency === 'spark'
        ? await buyTokenPack(prize.category as 'vault_token' | 'bombshell_token', prize.size)
        : await purchasePack(prize.category, prize.size);
      if (cards === 'insufficient') { setToast('Not enough V⚡ for this pack.'); return; }
      if (!cards.length) { setToast('That pack didn’t come through. You weren’t charged.'); return; }
      toTray(prize, cards);
    } catch (err: any) {
      console.error('Prize purchase failed:', err);
      setToast(err?.message || 'That didn’t go through. Try again.');
    } finally {
      useLoadingToast.getState().hide();
      setPaying(false);
      loadVaultData();
    }
  }, [prize, user, tokenBalance, toTray, loadVaultData]);

  const handlePaymentSelect = useCallback(async (method: 'crypto' | 'stripe') => {
    const pack = checkout;
    setCheckout(null);
    if (!pack) return;
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
      return;
    }
    try {
      useLoadingToast.getState().show('Confirm in your wallet…');
      const txHash = await payWithCrypto(pack.priceValue);
      if (txHash) {
        useLoadingToast.getState().show('Verifying transaction…');
        const cards = await purchasePack(pack.category, pack.size, undefined, txHash);
        if (cards.length) toTray(pack, cards);
        await loadVaultData();
      }
    } catch (err: any) {
      setToast(err?.message || 'Payment failed.');
    } finally {
      useLoadingToast.getState().hide();
    }
  }, [checkout, toTray, loadVaultData]);

  const openTray = useCallback(() => {
    if (!tray.length) return;
    const cards = tray.flatMap(t => t.cards);
    const last = tray[tray.length - 1];
    audioManager.playSfx('by_th3scr1b3', 0.9);
    startReveal(cards, {
      category: last.pack.category, size: last.pack.size,
      label: tray.length === 1 ? last.pack.label : `${tray.length} claw prizes`,
      icon: tray.length === 1 ? last.pack.icon : '🕹️',
      accent: '#ff1493', gradient: 'linear-gradient(145deg, #1a0716, #05010a)',
      price: `${tray.length} pack${tray.length === 1 ? '' : 's'}`,
      cardCount: cards.length, revealType: 'cinematic', redirectPath: '/next-vault',
    });
    setTray([]);
    setLocation('/vault/reveal');
  }, [tray, startReveal, setLocation]);

  const payLabel = !prize ? ''
    : !user ? 'Sign in to take it'
    : prize.currency === 'free' ? 'Take it · Free'
    : prize.currency === 'spark' ? `Spend ${prize.price}`
    : `Pay ${prize.price}`;

  const trayCards = tray.reduce((n, t) => n + t.cards.length, 0);
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div className="claw-page">
      <div className="claw-room" aria-hidden />

      <header className="claw-top">
        <div>
          <p className="claw-kicker">Arcade floor · Day {today}</p>
          <h1 className="claw-title">Claw machine</h1>
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
          {/* Pit picker */}
          <nav className="claw-pits" aria-label="Choose a claw pit">
            {CLAW_PITS.map(p => (
              <button
                key={p.id}
                type="button"
                className={`claw-pit${p.id === pitId ? ' is-on' : ''}`}
                style={{ ['--pit-accent' as string]: p.accent }}
                disabled={!!prize}
                onClick={() => { audioManager.playSfx('tap_nav', 0.15); setPitId(p.id); }}
              >
                <span aria-hidden>{p.icon}</span>{p.name}
              </button>
            ))}
          </nav>
          <div className="claw-pit-info">
            <span>{pit.blurb}</span>
            {(pit.id === 'bombshell') && (
              <button type="button" className="claw-link" onClick={() => setBombshellArt(a => (a === 'dark' ? 'light' : 'dark'))}>
                {bombshellArt === 'dark' ? '🌙 Dark art' : '☀️ Light art'}
              </button>
            )}
          </div>

          <ClawCabinet
            packs={packs}
            accent={pit.accent === '#ffffff' ? '#e5e7eb' : pit.accent}
            lockedIds={lockedIds}
            heldId={prize?.id ?? null}
            disabled={paying || !!checkout}
            onPrize={setPrize}
            onEmptyGrab={() => setToast('Nothing under the claw. Line it up over a pack.')}
            onLockedGrab={() => setToast('Today’s free pack is already yours. Back tomorrow.')}
            overlay={prize ? (
              <motion.div key="door" className="claw-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <motion.div
                  key="prize"
                  className="claw-ticket"
                  initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 16, opacity: 0 }}
                  style={{ ['--pack-accent' as string]: prize.accent }}
                >
                  <div className="claw-ticket-pack"><PackToken pack={prize} /></div>
                  <div className="claw-ticket-body">
                    <p className="claw-kicker">You grabbed</p>
                    <h3>{prize.label}</h3>
                    <p className="claw-muted">{prize.cardCount} card{prize.cardCount === 1 ? '' : 's'} · {prize.price}</p>
                    <div className="claw-row">
                      <button type="button" className="claw-btn claw-btn-gold" disabled={paying} onClick={payForPrize}>{payLabel}</button>
                      <button type="button" className="claw-btn claw-btn-ghost" disabled={paying} onClick={() => setPrize(null)}>
                        <X size={14} /> Put it back
                      </button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            ) : null}
          />

          {/* Prize door + tray */}
          <div className="claw-door">
            <AnimatePresence mode="wait">
              {!prize && (
                <motion.div key="tray" className="claw-tray" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="claw-tray-slots">
                    {tray.length === 0 && <span className="claw-muted">Prizes you take land here. Grab a few, then open them together.</span>}
                    {tray.map(t => (
                      <motion.span key={t.key} className="claw-tray-item" initial={{ y: -30, rotate: -12 }} animate={{ y: 0, rotate: 0 }}>
                        <PackToken pack={t.pack} />
                      </motion.span>
                    ))}
                  </div>
                  <button type="button" className="claw-btn claw-btn-pink" disabled={!tray.length} onClick={openTray}>
                    <Sparkles size={16} /> {tray.length ? `Open ${tray.length} · ${trayCards} cards` : 'Tray empty'}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
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
          onClose={() => setCheckout(null)}
          onSelect={handlePaymentSelect}
          packLabel={checkout.label}
          price={checkout.price}
          priceValue={checkout.priceValue}
          accent={checkout.accent}
        />
      )}
    </div>
  );
}
