import { useState } from 'react';
import { motion } from 'framer-motion';
import { Zap, Sparkles, ShieldCheck, ArrowRight, Flame } from 'lucide-react';
import { useVaultStore } from '../store/useVaultStore';
import { createStripeCheckoutSession, buyTokenBundleWithCrypto, redirectToStripeCheckout } from '../services/vaultService';
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
  badgeLabel?: string;
  tokenAmount: number;
  bonus: number;
  bonusPercent?: string;
  price: string;
  priceValue: number;
  packsUnlocked: number;
  cardsUnlocked: number;
  primaryPullLabel: string;
  secondaryPullLabel: string;
  mythicRollsLabel: string;
  targetedPullsLabel: string;
  popular?: boolean;
  bestValue?: boolean;
  whale?: boolean;
  crateImage: string;
  accentColor: string;
  glowColor: string;
}

const BUNDLE_TIERS: BundleTierConfig[] = [
  {
    size: 'pouch',
    title: 'Pouch of Sparks',
    badgeLabel: 'STARTER',
    tokenAmount: 200,
    bonus: 0,
    price: '$0.99',
    priceValue: 0.99,
    packsUnlocked: 0,
    cardsUnlocked: 2,
    primaryPullLabel: '2 Bombshell Pulls',
    secondaryPullLabel: 'Vault 3-Pk requires 275 V⚡',
    mythicRollsLabel: '2× Rolls at 3.0% each',
    targetedPullsLabel: 'Towards 500 V⚡ Day Pull',
    crateImage: '/data/crates/pouch_of_sparks.svg',
    accentColor: '#FFB800',
    glowColor: 'rgba(255, 184, 0, 0.25)',
  },
  {
    size: 'crate',
    title: 'Cipher Crate',
    badgeLabel: 'POPULAR',
    tokenAmount: 1150,
    bonus: 150,
    bonusPercent: '+15% BONUS',
    price: '$4.99',
    priceValue: 4.99,
    packsUnlocked: 4,
    cardsUnlocked: 12,
    primaryPullLabel: '4× Vault Packs (12 Cards)',
    secondaryPullLabel: 'or 11 Bombshell Pulls',
    mythicRollsLabel: '12× Rolls at 3.0% each',
    targetedPullsLabel: '2 Targeted Day Pulls',
    popular: true,
    crateImage: '/data/crates/cipher_crate.svg',
    accentColor: '#00F0FF',
    glowColor: 'rgba(0, 240, 255, 0.25)',
  },
  {
    size: 'stash',
    title: 'Vault Stash',
    badgeLabel: 'BEST VALUE',
    tokenAmount: 2500,
    bonus: 500,
    bonusPercent: '+25% BONUS',
    price: '$9.99',
    priceValue: 9.99,
    packsUnlocked: 9,
    cardsUnlocked: 27,
    primaryPullLabel: '9× Vault Packs (27 Cards)',
    secondaryPullLabel: 'or 25 Bombshell Pulls',
    mythicRollsLabel: '27× Rolls at 3.0% each',
    targetedPullsLabel: '5 Targeted Day Pulls',
    bestValue: true,
    crateImage: '/data/crates/vault_stash.svg',
    accentColor: '#FFD700',
    glowColor: 'rgba(255, 215, 0, 0.3)',
  },
  {
    size: 'hoard',
    title: 'Archon Hoard',
    badgeLabel: 'WHALE TIER',
    tokenAmount: 7000,
    bonus: 2000,
    bonusPercent: '+40% BONUS',
    price: '$24.99',
    priceValue: 24.99,
    packsUnlocked: 25,
    cardsUnlocked: 75,
    primaryPullLabel: '25× Vault Packs (75 Cards)',
    secondaryPullLabel: 'or 70 Bombshell Pulls',
    mythicRollsLabel: '75× Rolls at 3.0% each',
    targetedPullsLabel: '14 Targeted Day Pulls',
    whale: true,
    crateImage: '/data/crates/archon_hoard.svg',
    accentColor: '#C084FC',
    glowColor: 'rgba(192, 132, 252, 0.35)',
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
            alert(`⚡ Success! +${tier.tokenAmount.toLocaleString()} V⚡ Sparks credited to your vault wallet.`);
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
          await redirectToStripeCheckout(res.checkoutUrl);
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
    <div className={`w-full ${className}`} id="token-bundle-shelf">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl animate-pulse">⚡</span>
            <h3 className="text-xl font-black uppercase tracking-wider text-white">
              V⚡ Token Bundles
            </h3>
            <span className="text-[9px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
              STRIPE & BASE EVM
            </span>
          </div>
          <p className="text-xs font-mono text-zinc-400 mt-1">
            Fuel your card collection: unlock <span className="text-amber-400 font-bold">⚡ Vault Packs (275 V⚡ • 3% Mythic)</span>, execute <span className="text-pink-400 font-bold">💖 Bombshell Pulls (100 V⚡)</span>, or overclock in the Forge.
          </p>
        </div>

        <div className="text-[10px] font-mono text-zinc-300 bg-zinc-900/90 px-3.5 py-2 rounded-xl border border-zinc-800 flex items-center gap-2 shadow-inner">
          <ShieldCheck size={14} className="text-amber-400" />
          <span>Zero-Latency Clearance • Stripe & Coinbase Smart Wallet</span>
        </div>
      </div>

      {/* Grid of 4 Token Bundles with Bespoke Crate Images */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {BUNDLE_TIERS.map((tier) => {
          const isFeatured = tier.popular || tier.bestValue || tier.whale;
          return (
            <motion.div
              key={tier.size}
              whileHover={{ y: -4, scale: 1.015 }}
              transition={{ duration: 0.2 }}
              className="group flex flex-col justify-between p-5 rounded-2xl relative overflow-hidden transition-all duration-200"
              style={{
                background: tier.bestValue
                  ? 'linear-gradient(180deg, rgba(255,215,0,0.14) 0%, rgba(18,14,5,0.96) 100%)'
                  : tier.popular
                  ? 'linear-gradient(180deg, rgba(0,240,255,0.12) 0%, rgba(8,16,28,0.96) 100%)'
                  : tier.whale
                  ? 'linear-gradient(180deg, rgba(192,132,252,0.15) 0%, rgba(20,8,32,0.96) 100%)'
                  : 'linear-gradient(180deg, rgba(255,184,0,0.08) 0%, rgba(12,12,14,0.96) 100%)',
                border: `2px solid ${
                  tier.bestValue
                    ? 'rgba(255,215,0,0.5)'
                    : tier.popular
                    ? 'rgba(0,240,255,0.45)'
                    : tier.whale
                    ? 'rgba(192,132,252,0.5)'
                    : 'rgba(255,184,0,0.3)'
                }`,
                boxShadow: isFeatured
                  ? `0 12px 35px rgba(0,0,0,0.65), 0 0 24px ${tier.glowColor}`
                  : '0 8px 24px rgba(0,0,0,0.5)',
              }}
            >
              {/* Bespoke Crate Artwork Layer (Positioned behind content with atmospheric blending) */}
              <div 
                className="absolute -right-8 top-10 w-44 h-44 pointer-events-none opacity-30 group-hover:opacity-60 group-hover:scale-110 transition-all duration-500 ease-out"
                style={{
                  filter: `drop-shadow(0 0 16px ${tier.accentColor}40)`,
                }}
              >
                <img 
                  src={tier.crateImage} 
                  alt={tier.title} 
                  className="w-full h-full object-contain"
                  loading="lazy"
                />
              </div>

              {/* Subtle ambient lighting sweep */}
              <div 
                className="absolute inset-0 pointer-events-none opacity-20 group-hover:opacity-40 transition-opacity duration-300"
                style={{
                  background: `radial-gradient(circle at 80% 20%, ${tier.accentColor} 0%, transparent 60%)`,
                }}
              />

              {/* Badges & Status Flags */}
              <div className="relative z-10 flex items-center justify-between gap-1.5 mb-2">
                <span 
                  className="text-[9px] font-mono font-black uppercase px-2 py-0.5 rounded border"
                  style={{
                    color: tier.accentColor,
                    borderColor: `${tier.accentColor}60`,
                    background: `${tier.accentColor}15`,
                  }}
                >
                  {tier.badgeLabel}
                </span>

                {tier.bonusPercent && (
                  <span className="text-[9px] font-mono font-black uppercase px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 text-black shadow-sm flex items-center gap-1">
                    <Flame size={10} className="fill-black" />
                    {tier.bonusPercent}
                  </span>
                )}
              </div>

              {/* Title & Spark Counter */}
              <div className="relative z-10">
                <div className="text-[11px] font-mono font-black uppercase tracking-wider text-zinc-300">
                  {tier.title}
                </div>

                <div className="flex items-baseline gap-2 my-2">
                  <span 
                    className="text-3xl lg:text-4xl font-black font-mono tracking-tight text-white flex items-center gap-1"
                    style={{
                      textShadow: `0 0 16px ${tier.accentColor}50`,
                    }}
                  >
                    <Zap size={24} className="fill-current" style={{ color: tier.accentColor }} />
                    {tier.tokenAmount.toLocaleString()}
                  </span>
                  <span className="text-xs font-mono font-extrabold" style={{ color: tier.accentColor }}>
                    V⚡
                  </span>
                </div>

                {/* Pack Purchasing Power Breakdown Matrix */}
                <div className="p-3 rounded-xl bg-black/75 border border-white/10 space-y-2 my-3.5 text-[10px] font-mono backdrop-blur-md">
                  {/* Primary Purchasing Power */}
                  <div className="flex justify-between items-start text-zinc-200">
                    <span className="flex items-center gap-1 font-bold" style={{ color: tier.accentColor }}>
                      <Sparkles size={11} /> Power:
                    </span>
                    <span className="text-white font-black text-right">
                      {tier.primaryPullLabel}
                    </span>
                  </div>

                  {/* Secondary Context Note (e.g. Vault Pack cost vs Bombshell pulls) */}
                  <div className="flex justify-between items-center text-zinc-400 text-[9px] border-t border-white/5 pt-1.5">
                    <span>⚡ Note:</span>
                    <span className="text-zinc-300 text-right font-medium">
                      {tier.secondaryPullLabel}
                    </span>
                  </div>

                  {/* Mythic Roll Chances */}
                  <div className="flex justify-between items-center text-zinc-400 text-[9px]">
                    <span>✦ Mythic Odds:</span>
                    <span className="font-bold text-right" style={{ color: tier.accentColor }}>
                      {tier.mythicRollsLabel}
                    </span>
                  </div>

                  {/* Targeted Pulls Utility */}
                  <div className="flex justify-between items-center text-zinc-400 text-[9px]">
                    <span>🎯 Targeted Day:</span>
                    <span className="text-zinc-300 text-right">
                      {tier.targetedPullsLabel}
                    </span>
                  </div>
                </div>
              </div>

              {/* Price & Instant Buy Button */}
              <div className="relative z-10 pt-1">
                <div className="flex items-center justify-between text-[11px] font-mono mb-2">
                  <span className="text-zinc-400 uppercase text-[9px] tracking-wider">Direct Checkout</span>
                  <span className="text-white font-black text-base">{tier.price}</span>
                </div>

                <button
                  disabled={isProcessing}
                  onClick={() => handleSelectBundle(tier)}
                  className="w-full py-3 rounded-xl font-black uppercase text-xs tracking-wider transition-all duration-150 active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 shadow-md hover:brightness-110"
                  style={{
                    background: tier.bestValue
                      ? 'linear-gradient(135deg, #FFD700, #FF9900)'
                      : tier.popular
                      ? 'linear-gradient(135deg, #00F0FF, #0284C7)'
                      : tier.whale
                      ? 'linear-gradient(135deg, #C084FC, #7E22CE)'
                      : 'linear-gradient(135deg, #FFB800, #FF5500)',
                    color: tier.popular || tier.whale ? '#FFFFFF' : '#000000',
                    border: '2px solid #000000',
                    boxShadow: '3px 3px 0 #000000',
                  }}
                >
                  <Zap size={14} className="fill-current" />
                  <span>GET FOR {tier.price}</span>
                  <ArrowRight size={13} />
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
          packLabel={`${selectedBundle.title} (${selectedBundle.tokenAmount.toLocaleString()} V⚡)`}
          price={selectedBundle.price}
          priceValue={selectedBundle.priceValue}
          accent={selectedBundle.accentColor}
        />
      )}
    </div>
  );
}
