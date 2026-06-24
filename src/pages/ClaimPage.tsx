import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation } from 'wouter';
import { useVaultStore } from '../store/useVaultStore';
import { useAuthStore } from '../store/useAuthStore';
import { useLoadingToast } from '../store/useLoadingToast';
import { 
  Gift, Music, CheckCircle, AlertTriangle, ExternalLink, 
  Zap, Award, Image as ImageIcon, Sparkles, KeyRound 
} from 'lucide-react';
import { 
  redeemBonusCode, fetchAllCards, findCardWithFallback, 
  type VaultCard, type OwnedCard 
} from '../services/vaultService';
import { audioManager } from '../game/audio';
import DecryptionAnimation from '../components/DecryptionAnimation';

type FormState = 'idle' | 'submitting' | 'done' | 'error';
type CodeState = 'idle' | 'redeeming' | 'success' | 'error';

interface ClaimForm {
  name: string;
  email: string;
  farcaster: string;
  wallet: string;
  note: string;
}

const EMPTY: ClaimForm = { name: '', email: '', farcaster: '', wallet: '', note: '' };

function InputField({
  label, sublabel, value, onChange, type = 'text', placeholder, required,
}: {
  label: string; sublabel?: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#ffd700]/70">
          {label}{required && <span style={{ color: '#ff3800' }}> *</span>}
        </label>
        {sublabel && <span className="text-[9px] font-mono text-white/20">{sublabel}</span>}
      </div>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        style={{
          background: 'rgba(255,215,0,0.04)',
          border: '1px solid rgba(255,215,0,0.18)',
          borderRadius: '6px',
          padding: '10px 14px',
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: '13px',
          color: '#faf0d8',
          outline: 'none',
          width: '100%',
          transition: 'border-color 0.2s, box-shadow 0.2s',
        }}
        onFocus={e => {
          e.target.style.borderColor = 'rgba(255,215,0,0.5)';
          e.target.style.boxShadow = '0 0 0 3px rgba(255,215,0,0.06)';
        }}
        onBlur={e => {
          e.target.style.borderColor = 'rgba(255,215,0,0.18)';
          e.target.style.boxShadow = 'none';
        }}
      />
    </div>
  );
}

function TextareaField({
  label, sublabel, value, onChange, placeholder,
}: {
  label: string; sublabel?: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#ffd700]/70">
          {label}
        </label>
        {sublabel && <span className="text-[9px] font-mono text-white/20">{sublabel}</span>}
      </div>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={4}
        style={{
          background: 'rgba(255,215,0,0.04)',
          border: '1px solid rgba(255,215,0,0.18)',
          borderRadius: '6px',
          padding: '10px 14px',
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: '12px',
          color: '#faf0d8',
          outline: 'none',
          width: '100%',
          resize: 'vertical',
          minHeight: '96px',
          transition: 'border-color 0.2s, box-shadow 0.2s',
        }}
        onFocus={e => {
          e.target.style.borderColor = 'rgba(255,215,0,0.5)';
          e.target.style.boxShadow = '0 0 0 3px rgba(255,215,0,0.06)';
        }}
        onBlur={e => {
          e.target.style.borderColor = 'rgba(255,215,0,0.18)';
          e.target.style.boxShadow = 'none';
        }}
      />
    </div>
  );
}

export default function ClaimPage() {
  const [form, setForm] = useState<ClaimForm>(EMPTY);
  const [state, setState] = useState<FormState>('idle');

  // Bonus Code States
  const [bonusCode, setBonusCode] = useState('');
  const [codeState, setCodeState] = useState<CodeState>('idle');
  const [codeError, setCodeError] = useState('');
  const [rewardClaimed, setRewardClaimed] = useState<{
    type: string;
    value: string;
    details?: {
      tokensGranted?: number;
      card?: VaultCard;
      skinUnlocked?: string;
    };
  } | null>(null);

  // Decryption Animation flow
  const [animationReward, setAnimationReward] = useState<{
    type: string;
    value: string;
    details?: any;
    result?: any;
  } | null>(null);

  const [, setLocation] = useLocation();
  const { user, setShowAuthModal } = useAuthStore();
  const { collection, loadVaultData, startReveal, addToCollection } = useVaultStore();

  // Check for ultra rewards in the user's collection
  const ultraCards = useMemo(() => {
    return collection.filter(c => c.ultraReward);
  }, [collection]);

  const hasReward = ultraCards.length > 0;

  // Check claimed status for Ultra Cards
  const ultraClaims = useMemo(() => {
    const claimsMap: Record<string, boolean> = {};
    let count = 0;
    for (const c of ultraCards) {
      const isClaimed = localStorage.getItem(`ultra_claimed_${c.id}`) === 'true';
      claimsMap[c.id] = isClaimed;
      if (isClaimed) count++;
    }
    return { claimsMap, claimedCount: count };
  }, [ultraCards]);

  const allPrizesClaimed = ultraCards.length > 0 && ultraClaims.claimedCount === ultraCards.length;

  const handleAnimationClose = async () => {
    if (!animationReward) return;

    const reward = animationReward;
    setAnimationReward(null);

    // If card or pack, we trigger the redirect to reveal
    if (reward.type === 'pack' && reward.result?.cards) {
      const pool = await fetchAllCards();
      const mappedCards = reward.result.cards.map((c: any) => {
        const parent = findCardWithFallback(pool, c.card_id, c.rarity);
        return {
          id: c.id || crypto.randomUUID(),
          cardId: parent.id,
          card: { ...parent, rarity: c.rarity },
          source: c.source || 'promo_code',
          claimedAt: c.claimed_at,
          edition: c.edition,
          maxSupply: c.max_supply,
          isEcho: c.is_echo,
          echoGeneration: c.echo_generation,
          echoSourceDay: c.echo_source_day,
          proof: c.proof,
          ultraReward: c.ultra_reward,
          blockchainStatus: c.blockchain_status,
          fingerprint: c.fingerprint
        };
      });
      if (mappedCards.length > 0) {
        addToCollection(mappedCards);
        audioManager.playSfx('open_chest', 0.9);
        startReveal(mappedCards, {
          category: 'promo_code',
          label: 'Promo Pack',
          icon: '🎁',
          accent: '#ffd700',
          gradient: 'linear-gradient(145deg, #1a1200, #0c0800)',
          price: 'PROMO',
          cardCount: mappedCards.length,
          revealType: 'cinematic',
          redirectPath: '/vault'
        });
        await loadVaultData();
        setLocation('/vault/reveal');
        return;
      }
    }

    if (reward.type === 'card' && reward.result?.card) {
      const pool = await fetchAllCards();
      const c = reward.result.card;
      const parent = findCardWithFallback(pool, c.card_id, c.rarity);
      const mappedCard = {
        id: c.id || crypto.randomUUID(),
        cardId: parent.id,
        card: { ...parent, rarity: c.rarity },
        source: c.source || 'promo_code',
        claimedAt: c.claimed_at,
        edition: c.edition,
        maxSupply: c.max_supply,
        isEcho: c.is_echo,
        echoGeneration: c.echo_generation,
        echoSourceDay: c.echo_source_day,
        proof: c.proof,
        ultraReward: c.ultra_reward,
        blockchainStatus: c.blockchain_status,
        fingerprint: c.fingerprint
      };
      addToCollection([mappedCard]);
      audioManager.playSfx('open_chest', 0.9);
      startReveal([mappedCard], {
        category: 'promo_code',
        label: 'Promo Card',
        icon: '⭐',
        accent: '#ffd700',
        gradient: 'linear-gradient(145deg, #1a1200, #0c0800)',
        price: 'PROMO',
        cardCount: 1,
        revealType: 'cinematic',
        redirectPath: '/vault'
      });
      await loadVaultData();
      setLocation('/vault/reveal');
      return;
    }

    // Otherwise, show static success box on ClaimPage
    setRewardClaimed(reward);
    setCodeState('success');
  };

  const field = (key: keyof ClaimForm) => ({
    value: form[key],
    onChange: (v: string) => setForm(f => ({ ...f, [key]: v })),
  });

  const handleBonusRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bonusCode.trim()) return;

    setCodeState('redeeming');
    setCodeError('');
    setRewardClaimed(null);
    setAnimationReward(null);
    useLoadingToast.getState().show('Decrypting bonus code…');

    try {
      const res = await redeemBonusCode(bonusCode);
      useLoadingToast.getState().hide();

      if (res.success && res.rewardType && res.rewardValue) {
        let details: any = {};
        if (res.rewardType === 'tokens') {
          details.tokensGranted = parseInt(res.rewardValue, 10);
        } else if (res.rewardType === 'background_skin') {
          details.skinUnlocked = res.rewardValue;
        } else if (res.rewardType === 'card' && res.result?.card) {
          const pool = await fetchAllCards();
          const parent = findCardWithFallback(pool, res.result.card.card_id, res.result.card.rarity);
          details.card = parent;
        } else if (res.rewardType === 'pack' && res.result?.cards?.[0]) {
          const pool = await fetchAllCards();
          const parent = findCardWithFallback(pool, res.result.cards[0].card_id, res.result.cards[0].rarity);
          details.card = parent;
        }

        setAnimationReward({
          type: res.rewardType,
          value: res.rewardValue,
          details,
          result: res.result
        });
        setCodeState('success');
        setBonusCode('');

        // Refresh store balances in background
        await loadVaultData();
      } else {
        audioManager.playSfx('error', 0.6);
        setCodeError(res.error || 'Invalid or expired code.');
        setCodeState('error');
      }
    } catch (err: any) {
      useLoadingToast.getState().hide();
      audioManager.playSfx('error', 0.6);
      setCodeError(err.message || 'Verification link failed.');
      setCodeState('error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email) return;

    setState('submitting');
    audioManager.playSfx('tap_nav', 0.3);

    // Simulate submission (mailto fallback)
    await new Promise(r => setTimeout(r, 1400));

    // Save claim status in localStorage for all Ultra cards currently being claimed
    ultraCards.forEach(c => {
      localStorage.setItem(`ultra_claimed_${c.id}`, 'true');
    });

    const subject = encodeURIComponent('TH3V4ULT ULTRA REWARD CLAIM');
    const body = encodeURIComponent(
      `Name: ${form.name}\nEmail: ${form.email}\nFarcaster: ${form.farcaster || '-'}\nWallet: ${form.wallet || '-'}\n\nNote from winner:\n${form.note || '-'}\n\n---\nCard IDs: ${ultraCards.map(c => c.cardId).join(', ')}\nClaim submitted via th3vault`
    );
    window.open(`mailto:claim@th3scr1b3.art?subject=${subject}&body=${body}`, '_blank');

    setState('done');
  };

  // ── 1. Unauthenticated Wall ────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-16 min-h-[70vh]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-6 text-center max-w-sm glass-panel p-8 border border-white/10"
        >
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <KeyRound size={26} className="text-[#ff3800]" />
          </div>
          <div>
            <h1 className="text-2xl font-black uppercase mb-2 text-white" style={{ fontFamily: '"Impact", "Arial Black", sans-serif' }}>
              Identity Required
            </h1>
            <p className="text-xs font-mono leading-relaxed text-zinc-400">
              You must connect your Web3 Identity or guest account before claiming promotional rewards or elite prizes.
            </p>
          </div>
          <button
            onClick={() => {
              audioManager.playSfx('tap_nav', 0.4);
              setShowAuthModal(true);
            }}
            className="px-6 py-3 font-mono font-bold text-xs uppercase tracking-wider text-black bg-[#ff3800] border-2 border-black rounded shadow-[3px_3px_0_#000] hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            Connect Identity
          </button>
        </motion.div>
      </div>
    );
  }

  // ── 2. Claim Done State ────────────────────────────────────────────────────
  if (state === 'done') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-16 min-h-[70vh]">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-6 text-center max-w-sm glass-panel p-8 border border-[#ffd700]/30 shadow-2xl"
        >
          <motion.div
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
            style={{
              width: '80px', height: '80px', borderRadius: '50%',
              background: 'linear-gradient(145deg, #ffd700, #ff9900)',
              display: 'flex', alignItems: 'center', justify: 'center',
              boxShadow: '0 0 30px rgba(255,180,0,0.4), 0 0 0 6px rgba(255,215,0,0.06)',
            }}
          >
            <CheckCircle size={32} color="#000" strokeWidth={2.5} />
          </motion.div>

          <div>
            <p className="text-[9px] font-mono font-bold tracking-widest uppercase mb-2 text-[#ffd700]">
              ★ CLAIM RECEIVED ★
            </p>
            <h1 className="text-3xl font-black uppercase mb-3 text-white" style={{ fontFamily: '"Impact", "Arial Black", sans-serif' }}>
              Success
            </h1>
            <p className="text-xs font-mono leading-relaxed text-zinc-400">
              th3scr1b3 will review your creative direction and reach out to coordinate your custom track.
            </p>
          </div>

          <Link
            to="/vault"
            onClick={() => audioManager.playSfx('tap_nav', 0.2)}
            className="px-6 py-2.5 bg-white/5 border border-white/10 rounded font-mono font-bold text-xs uppercase tracking-wider text-white hover:bg-white/10"
          >
            Return to Vault
          </Link>
        </motion.div>
      </div>
    );
  }

  // ── 3. Unified Claim & Redeem View ─────────────────────────────────────────
  return (
    <div className="flex-1 px-4 py-12 max-w-xl mx-auto w-full space-y-12">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-8"
      >
        {/* Title */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-black uppercase tracking-tight text-white" style={{ fontFamily: '"Impact", "Arial Black", sans-serif' }}>
            Redeem Rewards
          </h1>
          <p className="text-xs font-mono text-zinc-400 uppercase tracking-widest">// DECRYPT TRANSMISSIONS & EXCLUSIVE CODES</p>
        </div>

        {/* SECTION A: BONUS CODE DECRYPTOR */}
        <div className="glass-panel p-6 border-t-2 border-white/20 shadow-xl space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t border-r border-[#ffd700]/30" />
          <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b border-l border-[#ffd700]/30" />

          <div>
            <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-[0.3em]">// PROMO_DECRYPTOR_v1.02</span>
            <h2 className="text-lg font-mono font-bold uppercase text-white mt-1">Enter Bonus Code</h2>
          </div>

          <form onSubmit={handleBonusRedeem} className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={bonusCode}
                onChange={e => setBonusCode(e.target.value)}
                placeholder="e.g. BETA2026"
                disabled={codeState === 'redeeming'}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-3 font-mono text-sm tracking-wider uppercase text-white outline-none focus:border-[#ffd700]/50"
              />
              <button
                type="submit"
                disabled={codeState === 'redeeming' || !bonusCode.trim()}
                className="px-6 py-3 font-mono font-bold text-xs uppercase tracking-wider text-black bg-[#ffd700] rounded hover:scale-102 active:scale-98 transition-all disabled:opacity-40"
              >
                {codeState === 'redeeming' ? 'Decrypting...' : 'Redeem Code'}
              </button>
            </div>

            {/* Error Message */}
            {codeState === 'error' && (
              <div className="flex items-center gap-2 text-xs font-mono text-[#ff3800] bg-[#ff3800]/5 border border-[#ff3800]/20 p-3 rounded">
                <AlertTriangle size={14} className="shrink-0" />
                <span>{codeError}</span>
              </div>
            )}
          </form>

          {/* Decryption Animation */}
          <AnimatePresence>
            {codeState === 'success' && animationReward && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-4"
              >
                <DecryptionAnimation reward={animationReward} onClose={handleAnimationClose} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Success Reward Splash */}
          <AnimatePresence>
            {codeState === 'success' && !animationReward && rewardClaimed && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="border border-[#39FF14]/30 bg-[#39FF14]/5 p-5 rounded-lg space-y-4 text-center animate-in fade-in zoom-in-95 duration-200"
              >
                <div className="flex items-center justify-center gap-1.5 text-xs font-mono font-bold text-[#39FF14] tracking-widest uppercase">
                  <Sparkles size={13} />
                  <span>Reward Unlocked successfully</span>
                </div>

                {/* Tokens display */}
                {rewardClaimed.type === 'tokens' && (
                  <div className="py-2 flex flex-col items-center">
                    <Zap size={36} className="text-[#ffb800] animate-bounce" />
                    <div className="text-3xl font-black font-mono text-[#ffb800] mt-2">
                      +{rewardClaimed.details?.tokensGranted?.toLocaleString()}
                    </div>
                    <div className="text-[9px] font-mono text-white/50 tracking-wider mt-1 uppercase">VAULT TOKENS CREDITED</div>
                  </div>
                )}

                {/* Card display */}
                {rewardClaimed.type === 'card' && rewardClaimed.details?.card && (
                  <div className="py-2 flex flex-col items-center">
                    <div className="w-16 h-16 rounded overflow-hidden border border-white/20 mb-3 shadow-lg">
                      <img 
                        src={rewardClaimed.details.card.coverUrl} 
                        alt="Reward card Art" 
                        className="w-full h-full object-cover" 
                      />
                    </div>
                    <div className="font-mono text-[9px] tracking-widest uppercase" style={{ color: 'var(--color-neon-cyan)' }}>
                      [{rewardClaimed.details.card.rarity}] CARD CLAIM
                    </div>
                    <div className="text-lg font-black uppercase text-white mt-1 leading-none">
                      {rewardClaimed.details.card.title}
                    </div>
                    <div className="text-[8px] font-mono text-white/40 mt-1 uppercase">
                      ADDED TO YOUR COLLECTION
                    </div>
                  </div>
                )}

                {/* Skin display */}
                {rewardClaimed.type === 'background_skin' && (
                  <div className="py-2 flex flex-col items-center">
                    <div className="w-20 h-10 rounded border border-[#ff3800]/40 bg-radial-gradient flex items-center justify-center mb-3 shadow-[0_0_15px_rgba(255,56,0,0.15)]">
                      <ImageIcon size={20} className="text-[#ffd700]" />
                    </div>
                    <div className="font-mono text-[9px] tracking-widest text-[#ffd700] uppercase">
                      EXCLUSIVE THEME
                    </div>
                    <div className="text-base font-black uppercase text-white mt-1">
                      {rewardClaimed.details?.skinUnlocked?.replace('_', ' ')}
                    </div>
                    <div className="text-[8px] font-mono text-white/40 mt-1.5 leading-relaxed max-w-xs mx-auto uppercase">
                      Background theme is now permanently unlocked in options.
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* SECTION B: ELITE REWARDS (CUSTOM SONGS FOR ULTRA CARD OWNERS) */}
        <div className="glass-panel p-6 border border-white/10 shadow-xl space-y-6 relative">
          <div>
            <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-[0.3em]">// ELITE_REPLAY_GATE</span>
            <h2 className="text-lg font-mono font-bold uppercase text-white mt-1">Elite Custom Song Claim</h2>
          </div>

          {!hasReward ? (
            <div className="border border-white/5 bg-white/[0.01] p-6 rounded-lg text-center space-y-3">
              <AlertTriangle size={24} className="mx-auto text-white/20" />
              <div className="text-xs font-mono font-bold text-white/40 uppercase tracking-widest">Locked — No Ultra Card Found</div>
              
              <div className="inline-block px-3 py-1 bg-white/5 border border-white/10 rounded font-mono text-[9px] text-[#ff3800] uppercase tracking-wider">
                No Secret Prizes Claimed (0 / 5 Found)
              </div>

              <p className="text-[10px] font-mono text-zinc-500 leading-relaxed max-w-sm mx-auto uppercase">
                Flip cards in your collection. If they have an Ultra reward hidden on the back, this section will unlock to claim your personalized track.
              </p>
              <Link
                to="/vault/collection"
                onClick={() => audioManager.playSfx('tap_nav', 0.2)}
                className="inline-block mt-2 px-4 py-2 border border-white/10 rounded font-mono font-bold text-[9px] uppercase tracking-wider text-white hover:bg-white/5"
              >
                Inspect Collection
              </Link>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Prize Count Statistics Banner */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-white/5 border border-white/10 rounded-lg text-center">
                  <div className="text-[8px] font-mono text-zinc-400 uppercase tracking-wider">Prizes Found</div>
                  <div className="text-xl font-black font-mono text-white mt-1">{ultraCards.length} / 5</div>
                </div>
                <div className="p-3 bg-white/5 border border-white/10 rounded-lg text-center">
                  <div className="text-[8px] font-mono text-zinc-400 uppercase tracking-wider">Prizes Claimed</div>
                  <div className="text-xl font-black font-mono text-[#ffd700] mt-1">
                    {ultraClaims.claimedCount} / {ultraCards.length}
                  </div>
                </div>
              </div>

              {allPrizesClaimed && (
                <div className="p-4 bg-[#39FF14]/10 border border-[#39FF14]/30 rounded-lg text-center space-y-2">
                  <div className="text-xs font-mono font-bold text-[#39FF14] uppercase tracking-widest flex items-center justify-center gap-1.5">
                    <span>🏆</span>
                    <span>All Prizes Claimed</span>
                  </div>
                  <p className="text-[9px] font-mono text-zinc-400 leading-relaxed uppercase">
                    You have successfully submitted claims for all secret prize cards in your collection. th3scr1b3 is preparing your custom tracks!
                  </p>
                </div>
              )}

              {/* List of Ultra Cards with claim badges */}
              <div className="space-y-2.5">
                <div className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider">// SECRET_VAULT_ASSETS</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ultraCards.map((c) => {
                    const isClaimed = ultraClaims.claimsMap[c.id];
                    return (
                      <div key={c.id} className="flex items-center gap-3 p-2 bg-black/40 border border-white/5 rounded-lg">
                        <div className="w-10 h-10 rounded overflow-hidden border border-white/10 shrink-0">
                          <img src={c.card.coverUrl} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[9px] font-mono text-zinc-400">Day #{c.card.day}</div>
                          <div className="text-xs font-bold text-white truncate leading-tight">{c.card.title}</div>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[8px] font-mono font-bold uppercase shrink-0 border ${
                          isClaimed 
                            ? 'bg-[#39FF14]/10 border-[#39FF14]/30 text-[#39FF14]' 
                            : 'bg-[#ffd700]/10 border-[#ffd700]/30 text-[#ffd700]'
                        }`}>
                          {isClaimed ? 'Claimed' : 'Unclaimed'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {!allPrizesClaimed && (
                <form onSubmit={handleSubmit} className="space-y-5 border-t border-white/5 pt-6">
                  <div className="flex items-center gap-2.5 p-3.5 bg-[#ffd700]/5 border border-[#ffd700]/20 rounded-lg">
                    <Gift size={16} className="text-[#ffd700]" />
                    <span className="text-[10px] font-mono font-bold text-[#ffd700] uppercase tracking-wider">
                      {ultraCards.length - ultraClaims.claimedCount} Unclaimed Prize Card{ultraCards.length - ultraClaims.claimedCount > 1 ? 's' : ''} detected. Form Unlocked!
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InputField label="Your Name" required placeholder="First & last" {...field('name')} />
                    <InputField label="Email Address" type="email" required placeholder="you@example.com" sublabel="keeps it private" {...field('email')} />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InputField label="Farcaster Handle" placeholder="@handle" sublabel="optional" {...field('farcaster')} />
                    <InputField label="Recipient Wallet" placeholder="0x..." sublabel="optional" {...field('wallet')} />
                  </div>

                  <TextareaField
                    label="Creative Direction"
                    sublabel="optional — helps th3scr1b3 write"
                    placeholder="Give th3scr1b3 a mood, a topic, a specific speed/bpm, or general direction. We will write and record this just for you."
                    {...field('note')}
                  />

                  <button
                    type="submit"
                    disabled={!form.name || !form.email || state === 'submitting'}
                    className="w-full py-3.5 font-mono font-bold text-xs uppercase tracking-widest text-black bg-[#ffd700] rounded hover:scale-101 active:scale-98 transition-all disabled:opacity-40"
                  >
                    {state === 'submitting' ? 'Submitting...' : '✦ Submit Creative Claim'}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
