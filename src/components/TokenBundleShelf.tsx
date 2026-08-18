import { useState } from 'react';
import { motion } from 'framer-motion';
import { Zap, Sparkles, ShieldCheck } from 'lucide-react';
import { useVaultStore } from '../store/useVaultStore';
import { createStripeCheckoutSession, buyTokenBundleWithCrypto } from '../services/vaultService';
import { payWithCrypto } from '../services/coinbaseService';
import PaymentSelectModal from './PaymentSelectModal';
import { useLoadingToast } from '../store/useLoadingToast';
import type { PackSize } from '../utils/rarity';

interface TokenBundleShelfProps {
  onPurchased?: () => void;
  className?: string;
}

interface BundleTierConfig {
  size: PackSize;
  title: string;
  tokenAmount: number;
  bonus: number;
  bonusPercent?: string;
  price: string;
  priceValue: number;
  packsUnlocked: number;
  cardsUnlocked: number;
  popular?: boolean;
  bestValue?: boolean;
  whale?: boolean;
}

const BUNDLE_TIERS: BundleTierConfig[] = [
  {
    size: 'pouch',
    title: 'Pouch of Sparks',
    tokenAmount: 200,
    bonus: 0,
    price: '$0.99',
    priceValue: 0.99,
    packsUnlocked: 1,
    cardsUnlocked: 3,
  },
  {
    size: 'crate',
    title: 'Cipher Crate',
    tokenAmount: 1150,
    bonus: 150,
    bonusPercent: '+15% BONUS',
    price: '$4.99',
    priceValue: 4.99,
    packsUnlocked: 4,
    cardsUnlocked: 12,
    popular: true,
  },
  {
    size: 'stash',
    title: 'Vault Stash',
    tokenAmount: 2500,
    bonus: 500,
    bonusPercent: '+25% BONUS',
    price: '$9.99',
    priceValue: 9.99,
    packsUnlocked: 9,
    cardsUnlocked: 27,
    bestValue: true,
  },
  {
    size: 'hoard',
    title: 'Archon Hoard',
    tokenAmount: 7000,
    bonus: 2000,
    bonusPercent: '+40% BONUS',
    price: '$24.99',
    priceValue: 24.99,
    packsUnlocked: 25,
    cardsUnlocked: 75,
    whale: true,
  },
];

export default function TokenBundleShelf({ onPurchased, className = '' }: TokenBundleShelfProps) {
  const { loadVaultData } = useVaultStore();
  const [selectedBundle, setSelectedBundle] = useState<BundleTierConfig | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSelectBundle = (tier: BundleTierConfig) => {
    setSelectedBundle(tier);
  };

  const handlePaymentMethod = async (method: 'crypto' | 'stripe') => {
    if (!selectedBundle) return;
    const tier = selectedBundle;
    setSelectedBundle(null);
    setIsProcessing(true);

    if (method === 'crypto') {
      useLoadingToast.getState().show(`Waiting for Base wallet confirmation…`);
      try {
        const txHash = await payWithCrypto(tier.priceValue);
        if (txHash) {
          useLoadingToast.getState().show(`Crediting ${tier.tokenAmount} V⚡ Sparks…`);
          const res = await buyTokenBundleWithCrypto(tier.size, tier.tokenAmount, txHash);
          useLoadingToast.getState().hide();
          setIsProcessing(false);
          if (res.success) {
            await loadVaultData();
            if (onPurchased) onPurchased();
            alert(`⚡ Success! +${tier.tokenAmount} V⚡ Sparks credited to your vault wallet.`);
          }
        } else {
          useLoadingToast.getState().hide();
          setIsProcessing(false);
        }
      } catch (err: any) {
        useLoadingToast.getState().hide();
        setIsProcessing(false);
        alert(err.message || 'Crypto transaction failed');
      }
    } else {
      useLoadingToast.getState().show(`Redirecting to Stripe checkout…`);
      try {
        const res = await createStripeCheckoutSession('token_bundle', tier.size);
        useLoadingToast.getState().hide();
        setIsProcessing(false);
        if (res.success && res.checkoutUrl) {
          window.location.href = res.checkoutUrl;
        } else {
          alert(res.error || 'Could not initiate Stripe checkout');
        }
      } catch (err: any) {
        useLoadingToast.getState().hide();
        setIsProcessing(false);
        alert(err.message || 'Could not initiate Stripe checkout');
      }
    }
  };

  return (
    <div className={`w-full ${className}`}>
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">⚡</span>
            <h3 className="text-lg font-black uppercase tracking-wider text-white">
              V⚡ Token Bundles
            </h3>
            <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
              CARD & CRYPTO
            </span>
          </div>
          <p className="text-xs font-mono text-zinc-400 mt-1">
            Acquire V⚡ sparks to unlock <span className="text-amber-400 font-bold">⚡ Vault Packs (3% Mythic rate)</span>, execute Targeted Day Pulls, or boost cards in the Forge.
          </p>
        </div>

        <div className="text-[10px] font-mono text-zinc-400 bg-zinc-900/80 px-3 py-1.5 rounded-lg border border-zinc-800 flex items-center gap-2">
          <ShieldCheck size={13} className="text-amber-400" />
          <span>Instant Wallet Clearance • Stripe / Base EVM</span>
        </div>
      </div>

      {/* Grid of 4 Token Bundles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {BUNDLE_TIERS.map((tier) => {
          const isFeatured = tier.popular || tier.bestValue;
          return (
            <motion.div
              key={tier.size}
              whileHover={{ y: -3, scale: 1.01 }}
              className="flex flex-col justify-between p-5 rounded-2xl relative overflow-hidden transition-all duration-200"
              style={{
                background: tier.bestValue
                  ? 'linear-gradient(180deg, rgba(255,215,0,0.12) 0%, rgba(20,15,5,0.95) 100%)'
                  : tier.popular
                  ? 'linear-gradient(180deg, rgba(59,130,246,0.12) 0%, rgba(10,15,30,0.95) 100%)'
                  : tier.whale
                  ? 'linear-gradient(180deg, rgba(168,85,247,0.12) 0%, rgba(25,10,35,0.95) 100%)'
                  : 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(10,10,10,0.95) 100%)',
                border: tier.bestValue
                  ? '2px solid rgba(255,215,0,0.4)'
                  : tier.popular
                  ? '2px solid rgba(59,130,246,0.4)'
                  : tier.whale
                  ? '2px solid rgba(168,85,247,0.4)'
                  : '2px solid rgba(255,255,255,0.08)',
                boxShadow: isFeatured ? '0 10px 30px rgba(0,0,0,0.5), 0 0 20px rgba(255,215,0,0.08)' : 'none',
              }}
            >
              {/* Badges */}
              <div className="absolute top-3 right-3 flex items-center gap-1.5">
                {tier.bonusPercent && (
                  <span className="text-[8px] font-mono font-black uppercase px-1.5 py-0.5 rounded bg-amber-400 text-black">
                    {tier.bonusPercent}
                  </span>
                )}
                {tier.popular && (
                  <span className="text-[8px] font-mono font-black uppercase px-2 py-0.5 rounded-full bg-blue-500/30 text-blue-300 border border-blue-400/50">
                    POPULAR
                  </span>
                )}
                {tier.bestValue && (
                  <span className="text-[8px] font-mono font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/30 text-amber-300 border border-amber-400/50">
                    BEST VALUE
                  </span>
                )}
                {tier.whale && (
                  <span className="text-[8px] font-mono font-black uppercase px-2 py-0.5 rounded-full bg-purple-500/30 text-purple-300 border border-purple-400/50">
                    WHALE
                  </span>
                )}
              </div>

              {/* Title & Sparks */}
              <div>
                <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-400 mb-1">
                  {tier.title}
                </div>
                <div className="flex items-baseline gap-1.5 my-2">
                  <span className="text-3xl font-black font-mono tracking-tight text-white flex items-center gap-1">
                    <Zap size={22} className="text-amber-400 fill-amber-400" />
                    {tier.tokenAmount.toLocaleString()}
                  </span>
                  <span className="text-xs font-mono font-bold text-amber-400">V⚡</span>
                </div>

                {/* Pack Purchasing Power Breakdown */}
                <div className="p-3 rounded-xl bg-black/50 border border-white/5 space-y-1.5 my-4 text-[10px] font-mono">
                  <div className="flex justify-between items-center text-zinc-300">
                    <span className="flex items-center gap-1 text-amber-300 font-bold">
                      <Sparkles size={11} /> Vault / Bombshell:
                    </span>
                    <span className="text-white font-bold">{tier.packsUnlocked}× 3-Pks ({tier.cardsUnlocked} Cards)</span>
                  </div>
                  <div className="flex justify-between items-center text-zinc-400 text-[9px]">
                    <span>✦ Mythic Rolls:</span>
                    <span className="text-amber-400 font-semibold">{tier.cardsUnlocked}× at 3.0% each</span>
                  </div>
                  <div className="flex justify-between items-center text-zinc-400 text-[9px]">
                    <span>🎯 Targeted Day:</span>
                    <span className="text-zinc-300">~{Math.floor(tier.tokenAmount / 500)} Pulls</span>
                  </div>
                </div>
              </div>

              {/* Price & Buy Button */}
              <div>
                <div className="flex items-center justify-between text-[11px] font-mono mb-2">
                  <span className="text-zinc-400">Instant Clearance</span>
                  <span className="text-white font-extrabold text-sm">{tier.price}</span>
                </div>

                <button
                  disabled={isProcessing}
                  onClick={() => handleSelectBundle(tier)}
                  className="w-full py-3 rounded-xl font-black uppercase text-xs tracking-wider transition-all duration-150 active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
                  style={{
                    background: tier.bestValue
                      ? 'linear-gradient(135deg, #ffd700, #ff9900)'
                      : tier.popular
                      ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)'
                      : tier.whale
                      ? 'linear-gradient(135deg, #a855f7, #7e22ce)'
                      : '#ff9900',
                    color: tier.popular || tier.whale ? '#fff' : '#000',
                    border: '2px solid #000',
                    boxShadow: '2px 2px 0 #000',
                  }}
                >
                  <Zap size={13} className="fill-current" />
                  BUY FOR {tier.price}
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Payment Selection Modal */}
      {selectedBundle && (
        <PaymentSelectModal
          isOpen={true}
          onClose={() => setSelectedBundle(null)}
          onSelect={handlePaymentMethod}
          packLabel={`${selectedBundle.title} (${selectedBundle.tokenAmount} V⚡)`}
          price={selectedBundle.price}
          priceValue={selectedBundle.priceValue}
          accent={selectedBundle.bestValue ? '#ffd700' : selectedBundle.popular ? '#3b82f6' : '#ff9900'}
        />
      )}
    </div>
  );
}
