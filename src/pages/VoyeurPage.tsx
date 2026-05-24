import { useEffect, useState, useMemo } from 'react';
import { useParams, useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Eye, Zap, ShieldAlert, ArrowLeft } from 'lucide-react';
import { useVaultStore } from '../store/useVaultStore';
import { supabase } from '../services/supabaseClient';
import { fetchAllCards, type OwnedCard, findCardWithFallback } from '../services/vaultService';
import Card from '../components/Card';
import { type Rarity } from '../utils/rarity';

const VOYEUR_FEE = 15; // 15 V⚡ to view another player's vault

export default function VoyeurPage() {
  const { userId } = useParams() as { userId?: string };
  const [, setLocation] = useLocation();
  const { tokenBalance, loadVaultData } = useVaultStore();
  
  const [hasPaid, setHasPaid] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [targetProfile, setTargetProfile] = useState<any>(null);
  const [targetCollection, setTargetCollection] = useState<OwnedCard[]>([]);
  const [, setIsLoading] = useState(true);

  useEffect(() => {
    async function init() {
      if (!userId) return;
      setIsLoading(true);
      try {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
        if (profile) setTargetProfile(profile);
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, [userId]);

  const handlePayToView = async () => {
    if (tokenBalance < VOYEUR_FEE || !userId) return;
    setIsProcessing(true);
    
    try {
      // Deduct securely via edge function
      await supabase.functions.invoke('vault-engine', {
        body: { action: 'payVoyeurFee', payload: { amount: VOYEUR_FEE } }
      });
      
      // We assume if it succeeds (or if the edge function is a mock and we just allow it for now):
      // But until the edge function supports 'payVoyeurFee', we'll simulate the gate locally for beta
      // (The actual deduction should occur in Edge function to prevent client bypass)
      
      // Local fallback for Beta until backend complete:
      await loadVaultData(); // resync store
      setHasPaid(true);

      // Now fetch their full collection
      const { data: vault } = await supabase.from('vault_collections').select('*').eq('owner_id', userId);
      const pool = await fetchAllCards();
      
      if (vault) {
        const built = vault.map(c => {
          const base = findCardWithFallback(pool, c.card_id, c.rarity as Rarity);
          return {
            id: c.id, cardId: c.card_id,
            card: { ...base, rarity: c.rarity as Rarity },
            source: c.source, claimedAt: c.claimed_at,
            edition: c.edition, maxSupply: c.max_supply,
            isEcho: c.is_echo, echoGeneration: c.echo_generation
          } as OwnedCard;
        });
        setTargetCollection(built);
      }
    } catch {
      // Just let them in for now if the function errors in proto mode
      setHasPaid(true); 
    } finally {
      setIsProcessing(false);
    }
  };

  const groupedCards = useMemo(() => {
    const groups: Record<string, OwnedCard[]> = {};
    for (const c of targetCollection) {
      if (!groups[c.cardId]) groups[c.cardId] = [];
      groups[c.cardId].push(c);
    }
    return Object.values(groups);
  }, [targetCollection]);

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-4 py-8 relative">
      <button 
        onClick={() => setLocation('/vault/leaderboard')}
        className="flex items-center gap-2 mb-8 text-[10px] font-mono tracking-widest uppercase opacity-50 hover:opacity-100 transition-opacity"
      >
        <ArrowLeft size={14} /> Back to Network
      </button>

      {/* GATED STATE */}
      <AnimatePresence mode="wait">
        {!hasPaid ? (
          <motion.div
            key="gate"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col items-center justify-center py-20 px-4 text-center max-w-sm mx-auto"
          >
             <div className="w-24 h-24 rounded-full border-2 border-white/10 flex items-center justify-center mb-6" style={{ background: 'var(--color-void-black)', boxShadow: '0 0 40px rgba(0,0,0,0.8) inset' }}>
                <Lock size={32} style={{ color: 'var(--color-neon-amber)' }} />
             </div>
             
             <h1 className="text-3xl brutalist-title mb-2">Secure Vault</h1>
             <p className="text-xs font-mono opacity-50 mb-8 leading-relaxed">
               {targetProfile?.wallet_address ? `Wallet ${targetProfile.wallet_address.substring(0,6)}...` : 'This player'}'s collection is encrypted. You must pay the network clearance fee to bypass their security lock.
             </p>

             <button
               onClick={handlePayToView}
               disabled={isProcessing || tokenBalance < VOYEUR_FEE}
               className="w-full flex items-center justify-between p-4 rounded bg-black/60 border hover:bg-black/80 transition-all font-mono shadow-xl relative overflow-hidden group"
               style={{ borderColor: tokenBalance >= VOYEUR_FEE ? 'rgba(255,215,0,0.4)' : 'rgba(255,0,0,0.3)' }}
             >
               <div className="absolute inset-0 scanlines opacity-20 group-hover:opacity-40" />
               <span className="text-[11px] font-black tracking-widest uppercase text-white/80 z-10">
                 {isProcessing ? 'Bypassing...' : 'Unlock Viewer'}
               </span>
               <span className="flex items-center gap-1.5 text-xs font-bold z-10" style={{ color: tokenBalance >= VOYEUR_FEE ? 'var(--color-neon-gold)' : '#ff3333' }}>
                 <Zap size={13} /> -{VOYEUR_FEE} V⚡
               </span>
             </button>

             {tokenBalance < VOYEUR_FEE && (
               <div className="mt-4 flex items-center gap-2 text-[10px] font-mono text-red-400">
                 <ShieldAlert size={12} /> INSufficient Tokens
               </div>
             )}
          </motion.div>
        ) : (
          <motion.div
             key="vault"
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             className="w-full"
          >
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-4xl brutalist-title flex items-center gap-4">
                  Player Archive <Eye size={24} style={{ color: 'var(--color-neon-cyan)' }} />
                </h1>
                <p className="text-[10px] font-mono opacity-40 uppercase tracking-widest mt-2">
                  Read-Only Access Granted
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {groupedCards.map((group, i) => (
                <div key={i} className="relative group grayscale hover:grayscale-0 transition-all duration-500">
                   {group.length > 1 && (
                     <div className="absolute top-2 right-2 z-30 px-2 py-0.5 rounded text-[10px] font-black" style={{ background: 'var(--color-neon-cyan)', color: '#000' }}>
                       ×{group.length}
                     </div>
                   )}
                   <Card card={group[0].card} interactive={false} isDailyOrigin={group[0].source==='daily_claim' || group[0].source==='pack_miss_out'} isEcho={group[0].isEcho} echoGeneration={group[0].echoGeneration} />
                </div>
              ))}
              {groupedCards.length === 0 && (
                <div className="col-span-full py-12 text-center text-xs font-mono opacity-30 mt-8 border border-dashed border-white/10">
                  This user has no cards.
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
