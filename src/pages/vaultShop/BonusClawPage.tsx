import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'wouter';
import { ArrowLeft, Ticket, Play } from 'lucide-react';
import { useVaultStore } from '../../store/useVaultStore';
import { useLoadingToast } from '../../store/useLoadingToast';
import { useAuthStore } from '../../store/useAuthStore';
import { audioManager } from '../../game/audio';
import {
  redirectToStripeCheckout,
  getClawCredits, redeemClawCode, createClawPullCheckout, verifyClawPullCheckout, clawPull,
  CLAW_PULL_PRICE,
  type OwnedCard,
} from '../../services/vaultService';
import ClawEvent, { CartoonClaw, type ClawWinResult } from './ClawEvent';
import { PackToken } from './PackToken';
import { clawPrizePacks, type PitPack } from './clawPits';
import '../../styles/vaultShop.css';

const PENDING_KEY = 'pim_claw_pending_session';
const CENTS = CLAW_PULL_PRICE.replace('$0.', '') + '¢';

/** /bonus-claw: the claw machine on its own floor. One pull = one full-screen claw event. */
export default function BonusClawPage() {
  const [, setLocation] = useLocation();
  const user = useAuthStore(s => s.user);
  const { startReveal, addToCollection, loadVaultData } = useVaultStore();

  const packs = useMemo(() => clawPrizePacks('dark'), []);
  const preview = useMemo(() => packs.slice(0, 5), [packs]);
  const [credits, setCredits] = useState(0);
  const [code, setCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setCredits(0); return; }
    getClawCredits().then(setCredits);
  }, [user]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  // Back from a 99¢ checkout: credit the pull. The session id is kept until it verifies,
  // so a failed check retries on the next visit.
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('claw_session');
    if (fromUrl) {
      try { localStorage.setItem(PENDING_KEY, fromUrl); } catch { /* storage blocked */ }
      window.history.replaceState({}, '', '/bonus-claw');
    }
    let sessionId = fromUrl;
    try { sessionId = sessionId || localStorage.getItem(PENDING_KEY); } catch { /* storage blocked */ }
    if (!sessionId || !user) return;
    (async () => {
      useLoadingToast.getState().show('Confirming your pull…');
      const res = await verifyClawPullCheckout(sessionId);
      useLoadingToast.getState().hide();
      if (res.success || /another account|Not a claw checkout/.test(res.error || '')) {
        try { localStorage.removeItem(PENDING_KEY); } catch { /* storage blocked */ }
      }
      if (res.success) {
        setCredits(res.credits ?? await getClawCredits());
        audioManager.playSfx('open_case', 0.6);
        setToast('Pull added. Hit PLAY!');
      } else {
        setToast(`Couldn’t confirm that payment yet. ${res.error || ''}`.trim());
      }
    })();
  }, [user]);

  const buyPull = useCallback(async () => {
    if (!user) { useAuthStore.getState().setShowAuthModal(true); return; }
    useLoadingToast.getState().show('Opening checkout…');
    const res = await createClawPullCheckout();
    useLoadingToast.getState().hide();
    if (res.success && res.checkoutUrl) await redirectToStripeCheckout(res.checkoutUrl);
    else setToast(`Checkout didn’t open. ${res.error || 'Try again.'}`);
  }, [user]);

  const play = useCallback(() => {
    if (!user) { useAuthStore.getState().setShowAuthModal(true); return; }
    if (credits <= 0) { buyPull(); return; }
    audioManager.playSfx('tap_nav', 0.3);
    setPlaying(true);
  }, [user, credits, buyPull]);

  const redeem = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const c = code.trim();
    if (!c) return;
    if (!user) { useAuthStore.getState().setShowAuthModal(true); return; }
    setRedeeming(true);
    const res = await redeemClawCode(c);
    setRedeeming(false);
    if (res.success) {
      setCode('');
      setCredits(res.credits ?? credits + (res.pulls ?? 1));
      audioManager.playSfx('open_case', 0.6);
      setToast(`${res.pulls ?? 1} pull${res.pulls === 1 ? '' : 's'} added. Hit PLAY!`);
    } else {
      audioManager.playSfx('locked_out', 0.5);
      setToast(res.error || 'That code didn’t work.');
    }
  }, [code, user, credits]);

  const onWin = useCallback(async (pack: PitPack): Promise<ClawWinResult> => {
    const res = await clawPull(pack.category, pack.size);
    if (res.status === 'won') { setCredits(res.credits); return { cards: res.cards }; }
    if (res.status === 'slipped') { setCredits(res.credits); return { error: 'It slipped at the last second!', pullUsed: true }; }
    if (res.status === 'no_credits') { setCredits(0); return { error: 'You’re out of pulls.', pullUsed: false }; }
    getClawCredits().then(setCredits);
    return { error: `The claw jammed. ${res.error}`, pullUsed: false };
  }, []);

  const onOpen = useCallback((pack: PitPack, cards: OwnedCard[]) => {
    addToCollection(cards);
    loadVaultData();
    startReveal(cards, {
      category: pack.category, size: pack.size, label: pack.label, icon: '🕹️',
      accent: pack.accent, gradient: 'linear-gradient(145deg, #1a0716, #05010a)',
      price: 'BONUS CLAW', cardCount: cards.length, revealType: 'cinematic', redirectPath: '/bonus-claw',
    });
    setPlaying(false);
    setLocation('/vault/reveal');
  }, [addToCollection, loadVaultData, startReveal, setLocation]);

  const playLabel = !user ? 'Sign in to play' : credits > 0 ? 'PLAY' : `${CENTS} · PLAY`;

  return (
    <div className="claw-page">
      <div className="claw-room" aria-hidden />

      <header className="claw-top">
        <div>
          <p className="claw-kicker">Arcade floor</p>
          <h1 className="claw-title">Bonus claw</h1>
        </div>
        <div className="claw-top-actions">
          <span className="claw-pulls" aria-live="polite"><Ticket size={16} /> <b>{credits}</b> pull{credits === 1 ? '' : 's'}</span>
          <button type="button" className="claw-chip" onClick={() => setLocation('/next-vault')}>
            <ArrowLeft size={14} /> Vending machine
          </button>
        </div>
      </header>

      <main className="clawl">
        <section className="clawl-cab">
          <div className="clawl-marquee"><span>BONUS</span> CLAW</div>
          <div className="clawl-glass" onClick={play} role="presentation">
            <div className="clawx-rays" aria-hidden />
            <div className="clawl-rail" aria-hidden />
            <div className="clawl-claw" aria-hidden><CartoonClaw open /></div>
            <div className="clawl-pile" aria-hidden>
              {preview.map((p, i) => (
                <span key={p.id} className="clawl-pack" style={{ rotate: `${[-10, 6, -3, 9, -7][i]}deg`, zIndex: i % 2 ? 1 : 2 }}>
                  <PackToken pack={p} hidePrice />
                </span>
              ))}
            </div>
          </div>
          <motion.button
            type="button"
            className="clawl-play"
            onClick={play}
            whileTap={{ scale: 0.94 }}
            animate={{ scale: [1, 1.04, 1] }}
            transition={{ repeat: Infinity, duration: 1.4 }}
          >
            <Play size={26} fill="currentColor" /> {playLabel}
          </motion.button>
          <ol className="clawl-how">
            <li><b>1</b> The claw swings on its own. Tap to drop it.</li>
            <li><b>2</b> Every pull gets you 3 tries.</li>
            <li><b>3</b> Win any pack in the machine, then watch it open.</li>
          </ol>
        </section>

        <section className="claw-pullbar clawl-bar">
          <span className="claw-pulls"><Ticket size={16} /> <b>{credits}</b> pull{credits === 1 ? '' : 's'}</span>
          <button type="button" className="claw-btn claw-btn-gold" onClick={buyPull}>{CENTS} · 1 pull</button>
          <form className="claw-code" onSubmit={redeem}>
            <input
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="Bonus code"
              aria-label="Bonus code for a claw pull"
              autoCapitalize="characters" autoComplete="off" spellCheck={false}
            />
            <button type="submit" className="claw-btn claw-btn-ghost" disabled={redeeming || !code.trim()}>Redeem</button>
          </form>
        </section>
      </main>

      <AnimatePresence>
        {playing && <ClawEvent packs={packs} onWin={onWin} onOpen={onOpen} onClose={() => setPlaying(false)} />}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div className="claw-toast" role="status" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
