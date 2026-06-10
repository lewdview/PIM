import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Flame, Trophy, Layers, Sparkles, CheckCircle, Database, Coins, CreditCard, Share2 } from 'lucide-react';
import { fetchAllCards, type VaultCard } from '../services/vaultService';
import { supabase } from '../services/supabaseClient';

interface TickerItem {
  id: string;
  type: 'achievement' | 'analytics';
  color: string;
  glowColor: string;
  icon: any;
  title: string;
  detail: string;
  accentText?: string;
}

// Color schemes and icons
const THEMES = {
  gold: { color: '#ffd700', glow: 'rgba(255, 215, 0, 0.22)', icon: Sparkles },
  cyan: { color: '#00ffff', glow: 'rgba(0, 255, 255, 0.22)', icon: Trophy },
  purple: { color: '#d45dff', glow: 'rgba(212, 93, 255, 0.22)', icon: Layers },
  orange: { color: '#ff7700', glow: 'rgba(255, 119, 0, 0.22)', icon: Flame },
  pink: { color: '#ff007f', glow: 'rgba(255, 0, 127, 0.22)', icon: Zap },
  green: { color: '#39ff14', glow: 'rgba(57, 255, 20, 0.22)', icon: CheckCircle },
  blue: { color: '#3b82f6', glow: 'rgba(59, 130, 246, 0.22)', icon: Database }
};

const VALID_EVENT_TYPES = [
  'pack_purchase', 'game_end', 'card_burn', 'daily_claim', 
  'targeted_pull', 'rarity_upgrade', 'duplicate_fusion', 
  'nft_mint', 'bonus_code_redeem', 'invite_redeem'
];

export default function FloatingTicker() {
  const [visibleItems, setVisibleItems] = useState<TickerItem[]>([]);
  const [catalog, setCatalog] = useState<VaultCard[]>([]);
  
  // Keep tracking queues
  const eventsQueueRef = useRef<TickerItem[]>([]);
  const queueIndexRef = useRef(0);
  const catalogRef = useRef<VaultCard[]>([]);

  // Load cards catalog on mount
  useEffect(() => {
    async function loadCatalog() {
      const cards = await fetchAllCards();
      setCatalog(cards);
      catalogRef.current = cards;
    }
    loadCatalog();
  }, []);

  // Fetch actual data from Supabase
  const fetchSupabaseEvents = async () => {
    try {
      // 1. Fetch latest telemetry events
      const { data: events, error: eventsErr } = await supabase
        .from('telemetry_events')
        .select('id, event_type, payload, created_at, user_id')
        .in('event_type', VALID_EVENT_TYPES)
        .order('created_at', { ascending: false })
        .limit(20);

      if (eventsErr || !events) {
        console.warn('[Ticker] Telemetry fetch failed:', eventsErr?.message);
        return;
      }

      // 2. Fetch profiles for user IDs to resolve identities
      const userIds = [...new Set(events.map(e => e.user_id).filter(Boolean))];
      const profilesMap: Record<string, { display_name: string | null; wallet_address: string | null }> = {};
      
      if (userIds.length > 0) {
        const { data: profiles, error: profErr } = await supabase
          .from('profiles')
          .select('id, display_name, wallet_address')
          .in('id', userIds);
        
        if (!profErr && profiles) {
          profiles.forEach(p => {
            profilesMap[p.id] = {
              display_name: p.display_name,
              wallet_address: p.wallet_address
            };
          });
        }
      }

      // 3. Fetch global stats for real-time analytics
      const { count: totalCards } = await supabase
        .from('vault_collections')
        .select('*', { count: 'exact', head: true });

      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Helper to format user display name
      const getUserLabel = (userId: string) => {
        if (!userId) return 'Guest';
        const profile = profilesMap[userId];
        if (profile?.display_name) return profile.display_name;
        if (profile?.wallet_address) {
          const wa = profile.wallet_address;
          return `${wa.slice(0, 6)}...${wa.slice(-4)}`;
        }
        return `User_${userId.slice(0, 4)}`;
      };

      // Helper to get song title
      const getSongTitle = (songId: string) => {
        if (!songId) return 'Unknown Release';
        const idStr = songId.replace('card-', '');
        const matched = catalogRef.current.find(c => String(c.day) === idStr || c.id === songId);
        return matched ? matched.title : `Day ${idStr}`;
      };

      // 4. Map DB records to TickerItem objects
      const parsedItems: TickerItem[] = events.map(e => {
        const payload = e.payload || {};
        const userLabel = getUserLabel(e.user_id);
        const uniqueId = e.id || Math.random().toString(36).substring(2, 9);
        
        switch (e.event_type) {
          case 'game_end': {
            const songName = getSongTitle(payload.songId);
            const scoreStr = payload.score ? payload.score.toLocaleString() : '0';
            const accuracyVal = payload.accuracy ? `${payload.accuracy}%` : '';
            const isCompleted = payload.completed ? 'Cleared' : 'Failed';
            return {
              id: uniqueId,
              type: 'achievement',
              color: THEMES.cyan.color,
              glowColor: THEMES.cyan.glow,
              icon: THEMES.cyan.icon,
              title: 'Song Cleared',
              detail: `${userLabel} scored ${scoreStr} (${accuracyVal}) on "${songName}"`,
              accentText: payload.medal || isCompleted
            };
          }
          case 'card_burn': {
            const coinsEarned = payload.tokensEarned || 0;
            const rarity = String(payload.rarity).toUpperCase();
            return {
              id: uniqueId,
              type: 'achievement',
              color: THEMES.orange.color,
              glowColor: THEMES.orange.glow,
              icon: THEMES.orange.icon,
              title: 'Prestige Burn',
              detail: `${userLabel} burned a ${rarity} card for +${coinsEarned} V⚡`,
              accentText: `+${coinsEarned} V⚡`
            };
          }
          case 'pack_purchase': {
            const category = payload.packType ? String(payload.packType).toUpperCase() : 'VAULT';
            const cardCount = payload.count || 1;
            return {
              id: uniqueId,
              type: 'achievement',
              color: THEMES.pink.color,
              glowColor: THEMES.pink.glow,
              icon: THEMES.pink.icon,
              title: 'Pack Ripped',
              detail: `${userLabel} opened ${category} pack containing ${cardCount} cards`,
              accentText: 'RIP'
            };
          }
          case 'daily_claim': {
            const dayNum = payload.day || '';
            const rarity = String(payload.rarity || 'common').toUpperCase();
            return {
              id: uniqueId,
              type: 'achievement',
              color: THEMES.green.color,
              glowColor: THEMES.green.glow,
              icon: THEMES.green.icon,
              title: 'Daily Drop Claim',
              detail: `${userLabel} claimed Day ${dayNum} Drop (${rarity})`,
              accentText: 'CLAIMED'
            };
          }
          case 'nft_mint': {
            const songName = getSongTitle(payload.cardId);
            return {
              id: uniqueId,
              type: 'achievement',
              color: THEMES.blue.color,
              glowColor: THEMES.blue.glow,
              icon: THEMES.blue.icon,
              title: 'On-Chain Mint',
              detail: `${userLabel} minted "${songName}" on Base mainnet`,
              accentText: 'SECURED'
            };
          }
          case 'rarity_upgrade': {
            const nextRar = String(payload.to || 'rare').toUpperCase();
            return {
              id: uniqueId,
              type: 'achievement',
              color: THEMES.gold.color,
              glowColor: THEMES.gold.glow,
              icon: THEMES.gold.icon,
              title: 'Card Upgraded',
              detail: `${userLabel} upgraded card rarity to ${nextRar}`,
              accentText: 'UPGRADE'
            };
          }
          case 'duplicate_fusion': {
            const nextRar = String(payload.to || 'rare').toUpperCase();
            return {
              id: uniqueId,
              type: 'achievement',
              color: THEMES.purple.color,
              glowColor: THEMES.purple.glow,
              icon: THEMES.purple.icon,
              title: 'Duplicate Fusion',
              detail: `${userLabel} fused 3 duplicates into ${nextRar} Card`,
              accentText: 'FUSION'
            };
          }
          case 'bonus_code_redeem': {
            const reward = String(payload.rewardType || 'reward').toUpperCase();
            return {
              id: uniqueId,
              type: 'achievement',
              color: THEMES.gold.color,
              glowColor: THEMES.gold.glow,
              icon: THEMES.gold.icon,
              title: 'Promo Claimed',
              detail: `${userLabel} redeemed promo code for ${reward}`,
              accentText: 'CODE'
            };
          }
          default:
            return {
              id: uniqueId,
              type: 'achievement',
              color: THEMES.green.color,
              glowColor: THEMES.green.glow,
              icon: THEMES.green.icon,
              title: 'Vault Event',
              detail: `${userLabel} executed ${e.event_type} action`,
              accentText: 'ACTIVE'
            };
        }
      });

      // 5. Append real-time global analytics items
      const analyticsItems: TickerItem[] = [
        {
          id: `stat-collectors-${Date.now()}`,
          type: 'analytics',
          color: THEMES.cyan.color,
          glowColor: THEMES.cyan.glow,
          icon: THEMES.cyan.icon,
          title: 'Registered Collectors',
          detail: `Total database archive profiles: ${totalUsers || 0}`,
          accentText: 'USERS'
        },
        {
          id: `stat-cards-${Date.now()}`,
          type: 'analytics',
          color: THEMES.purple.color,
          glowColor: THEMES.purple.glow,
          icon: THEMES.purple.icon,
          title: 'Total Cards Collected',
          detail: `${totalCards || 0} cards safely locked inside the vault`,
          accentText: 'SUPPLY'
        },
        {
          id: `stat-network-${Date.now()}`,
          type: 'analytics',
          color: THEMES.blue.color,
          glowColor: THEMES.blue.glow,
          icon: THEMES.blue.icon,
          title: 'Gas Metric',
          detail: '0.15 Gwei stable transaction fees on Base',
          accentText: 'STABLE'
        }
      ];

      // Mix them together (events first, then stats)
      const fullQueue = [...parsedItems, ...analyticsItems];
      eventsQueueRef.current = fullQueue;

      // Seed first items on initial load
      if (visibleItems.length === 0 && fullQueue.length > 0) {
        const initial = fullQueue.slice(0, 2);
        setVisibleItems(initial);
        queueIndexRef.current = initial.length % fullQueue.length;
      }
    } catch (err) {
      console.error('[Ticker] Failed to update telemetry queue:', err);
    }
  };

  // Run initial fetch and start poll
  useEffect(() => {
    // Wait for catalog load to resolve titles correctly
    const catalogTimer = setTimeout(() => {
      fetchSupabaseEvents();
    }, 400);

    // Poll Supabase for new telemetry logs every 20 seconds
    const pollInterval = setInterval(() => {
      fetchSupabaseEvents();
    }, 20000);

    return () => {
      clearTimeout(catalogTimer);
      clearInterval(pollInterval);
    };
  }, [catalog]);

  // Constantly cycle items (sliding down effect) every 6 seconds
  useEffect(() => {
    const cycleInterval = setInterval(() => {
      const queue = eventsQueueRef.current;
      if (queue.length === 0) return;

      const nextIndex = queueIndexRef.current;
      const nextItem = { 
        ...queue[nextIndex], 
        // Assign fresh unique key for animation state refresh
        id: `${queue[nextIndex].id}-${Date.now()}` 
      };
      
      queueIndexRef.current = (nextIndex + 1) % queue.length;

      setVisibleItems(prev => {
        const updated = [nextItem, ...prev];
        if (updated.length > 3) {
          return updated.slice(0, 3);
        }
        return updated;
      });
    }, 6000);

    return () => clearInterval(cycleInterval);
  }, []);

  if (visibleItems.length === 0) return null;

  return (
    <div 
      className="hidden md:flex flex-col gap-2.5 fixed pointer-events-none z-[45]"
      style={{
        top: '64px',
        right: '32px',
        width: '265px',
      }}
    >
      <AnimatePresence initial={false}>
        {visibleItems.map((item) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={item.id}
              initial={{ y: -30, opacity: 0, scale: 0.94 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 15, opacity: 0, scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 350, damping: 25 }}
              className="pointer-events-auto border-2 border-black flex flex-col p-2.5 relative overflow-hidden select-none"
              style={{
                background: 'rgba(10, 8, 6, 0.94)',
                boxShadow: `3px 3px 0 #000, 0 0 15px ${item.glowColor}`,
                borderLeft: `3.5px solid ${item.color}`,
              }}
            >
              {/* Scanline pattern overlay */}
              <div 
                className="absolute inset-0 pointer-events-none opacity-5"
                style={{
                  background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%)',
                  backgroundSize: '100% 4px',
                }}
              />
              
              {/* Top Row: Icon + Title + Accent tag */}
              <div className="flex items-center justify-between gap-1.5 mb-1 z-10">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Icon size={11} style={{ color: item.color, flexShrink: 0 }} />
                  <span 
                    className="font-mono text-[9px] uppercase tracking-wider font-extrabold truncate"
                    style={{ color: item.color }}
                  >
                    {item.title}
                  </span>
                </div>
                {item.accentText && (
                  <span 
                    className="font-mono text-[7px] px-1 py-0.5 border border-black font-black uppercase tracking-tight shrink-0"
                    style={{ 
                      background: item.color, 
                      color: '#000', 
                      transform: 'skewX(-4deg) scale(0.95)',
                      boxShadow: '1px 1px 0 #000'
                    }}
                  >
                    {item.accentText}
                  </span>
                )}
              </div>

              {/* Bottom Row: Detail text */}
              <div className="z-10">
                <p 
                  className="font-mono text-[8px] leading-tight text-white/70"
                  style={{ margin: 0 }}
                >
                  {item.detail}
                </p>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
