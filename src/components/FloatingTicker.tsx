import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap,
  Flame,
  Trophy,
  Layers,
  Sparkles,
  CheckCircle,
  Database,
  Radio,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { fetchAllCards, type VaultCard } from '../services/vaultService';
import { supabase } from '../services/supabaseClient';
import { telemetryQueue, type QueuedTelemetryEvent } from '../services/telemetryQueue';
import type { RealtimeChannel } from '@supabase/supabase-js';

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

const THEMES = {
  gold: { color: '#ffd700', glow: 'rgba(255, 215, 0, 0.22)', icon: Sparkles },
  cyan: { color: '#00ffff', glow: 'rgba(0, 255, 255, 0.22)', icon: Trophy },
  purple: { color: '#d45dff', glow: 'rgba(212, 93, 255, 0.22)', icon: Layers },
  orange: { color: '#ff7700', glow: 'rgba(255, 119, 0, 0.22)', icon: Flame },
  pink: { color: '#ff007f', glow: 'rgba(255, 0, 127, 0.22)', icon: Zap },
  green: { color: '#39ff14', glow: 'rgba(57, 255, 20, 0.22)', icon: CheckCircle },
  blue: { color: '#3b82f6', glow: 'rgba(59, 130, 246, 0.22)', icon: Database },
};

const VALID_EVENT_TYPES = [
  'pack_purchase',
  'game_end',
  'card_burn',
  'daily_claim',
  'targeted_pull',
  'rarity_upgrade',
  'duplicate_fusion',
  'nft_mint',
  'bonus_code_redeem',
  'invite_redeem',
];

export default function FloatingTicker() {
  const [visibleItems, setVisibleItems] = useState<TickerItem[]>([]);
  const [, setCatalog] = useState<VaultCard[]>([]);
  const [isHovered, setIsHovered] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const [isLiveConnected, setIsLiveConnected] = useState(false);

  const eventsQueueRef = useRef<TickerItem[]>([]);
  const queueIndexRef = useRef(0);
  const catalogRef = useRef<VaultCard[]>([]);
  const profilesCacheRef = useRef<Record<string, { display_name: string | null; wallet_address: string | null }>>({});

  // Helper to format user display name
  const getUserLabel = useCallback((userId?: string | null) => {
    if (!userId) return 'Guest';
    const profile = profilesCacheRef.current[userId];
    if (profile?.display_name) return profile.display_name;
    if (profile?.wallet_address) {
      const wa = profile.wallet_address;
      return `${wa.slice(0, 6)}...${wa.slice(-4)}`;
    }
    return `User_${userId.slice(0, 4)}`;
  }, []);

  // Helper to get song title
  const getSongTitle = useCallback((songId?: string) => {
    if (!songId) return 'Unknown Release';
    const idStr = songId.replace('card-', '').replace('day-', '');
    const matched = catalogRef.current.find((c) => String(c.day) === idStr || c.id === songId);
    return matched ? matched.title : `Day ${idStr}`;
  }, []);

  // Convert raw telemetry event to TickerItem
  const parseTelemetryEvent = useCallback((e: {
    id?: string;
    event_type: string;
    payload?: any;
    user_id?: string | null;
  }): TickerItem => {
    const payload = e.payload || {};
    const userLabel = getUserLabel(e.user_id);
    const uniqueId = e.id || `ticker_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    switch (e.event_type) {
      case 'game_end': {
        const songName = getSongTitle(payload.songId);
        const scoreStr = payload.score ? Number(payload.score).toLocaleString() : '0';
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
          accentText: payload.medal || isCompleted,
        };
      }
      case 'card_burn': {
        const coinsEarned = payload.tokensEarned || 0;
        const rarity = String(payload.rarity || 'common').toUpperCase();
        return {
          id: uniqueId,
          type: 'achievement',
          color: THEMES.orange.color,
          glowColor: THEMES.orange.glow,
          icon: THEMES.orange.icon,
          title: 'Prestige Burn',
          detail: `${userLabel} burned a ${rarity} card for +${coinsEarned} V⚡`,
          accentText: `+${coinsEarned} V⚡`,
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
          accentText: 'RIP',
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
          accentText: 'CLAIMED',
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
          accentText: 'SECURED',
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
          accentText: 'UPGRADE',
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
          accentText: 'FUSION',
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
          accentText: 'CODE',
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
          accentText: 'ACTIVE',
        };
    }
  }, [getSongTitle, getUserLabel]);

  // Load cards catalog on mount
  useEffect(() => {
    async function loadCatalog() {
      const cards = await fetchAllCards();
      setCatalog(cards);
      catalogRef.current = cards;
    }
    loadCatalog();
  }, []);

  // Fetch initial telemetry snapshot from Supabase
  const fetchTelemetrySnapshot = useCallback(async () => {
    try {
      const { data: events, error: eventsErr } = await supabase
        .from('telemetry_events')
        .select('id, event_type, payload, created_at, user_id')
        .in('event_type', VALID_EVENT_TYPES)
        .order('created_at', { ascending: false })
        .limit(20);

      if (eventsErr || !events) {
        return;
      }

      // Fetch profiles for unknown user IDs
      const unknownUserIds = [
        ...new Set(
          events
            .map((e) => e.user_id)
            .filter((uid): uid is string => Boolean(uid) && !profilesCacheRef.current[uid])
        ),
      ];

      if (unknownUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name, wallet_address')
          .in('id', unknownUserIds);

        if (profiles) {
          profiles.forEach((p) => {
            profilesCacheRef.current[p.id] = {
              display_name: p.display_name,
              wallet_address: p.wallet_address,
            };
          });
        }
      }

      // Global network stats
      const { count: totalCards } = await supabase
        .from('vault_collections')
        .select('*', { count: 'exact', head: true });

      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      const parsedItems = events.map((e) => parseTelemetryEvent(e));

      const analyticsItems: TickerItem[] = [
        {
          id: `stat-collectors-${Date.now()}`,
          type: 'analytics',
          color: THEMES.cyan.color,
          glowColor: THEMES.cyan.glow,
          icon: THEMES.cyan.icon,
          title: 'Registered Collectors',
          detail: `Database archive profiles: ${totalUsers || 0}`,
          accentText: 'USERS',
        },
        {
          id: `stat-cards-${Date.now()}`,
          type: 'analytics',
          color: THEMES.purple.color,
          glowColor: THEMES.purple.glow,
          icon: THEMES.purple.icon,
          title: 'Total Cards Secured',
          detail: `${totalCards || 0} cards cataloged in vault archive`,
          accentText: 'SUPPLY',
        },
        {
          id: `stat-network-${Date.now()}`,
          type: 'analytics',
          color: THEMES.blue.color,
          glowColor: THEMES.blue.glow,
          icon: THEMES.blue.icon,
          title: 'Gas Metric',
          detail: '0.15 Gwei stable transaction fees on Base',
          accentText: 'STABLE',
        },
      ];

      const fullQueue = [...parsedItems, ...analyticsItems].slice(0, 30);
      eventsQueueRef.current = fullQueue;

      if (visibleItems.length === 0 && fullQueue.length > 0) {
        const initial = fullQueue.slice(0, 2);
        setVisibleItems(initial);
        queueIndexRef.current = initial.length % fullQueue.length;
      }
    } catch (err) {
      console.warn('[Ticker] Snapshot fetch error:', err);
    }
  }, [parseTelemetryEvent, visibleItems.length]);

  // Initial fetch and 60-second fallback heartbeat
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTelemetrySnapshot();
    }, 400);

    const pollInterval = setInterval(() => {
      fetchTelemetrySnapshot();
    }, 60000);

    return () => {
      clearTimeout(timer);
      clearInterval(pollInterval);
    };
  }, [fetchTelemetrySnapshot]);

  // 1. Supabase Realtime Subscription: Instant live updates when anyone plays
  useEffect(() => {
    let channel: RealtimeChannel | null = null;

    try {
      channel = supabase
        .channel('pim_live_telemetry_feed')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'telemetry_events',
          },
          (payload) => {
            if (payload.new && VALID_EVENT_TYPES.includes(payload.new.event_type)) {
              const newItem = parseTelemetryEvent({
                id: payload.new.id,
                event_type: payload.new.event_type,
                payload: payload.new.payload,
                user_id: payload.new.user_id,
              });

              eventsQueueRef.current = [newItem, ...eventsQueueRef.current.slice(0, 29)];
              setVisibleItems((prev) => [newItem, ...prev.slice(0, 2)]);
            }
          }
        )
        .subscribe((status) => {
          setIsLiveConnected(status === 'SUBSCRIBED');
        });
    } catch (err) {
      console.warn('[Ticker] Realtime subscription error:', err);
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [parseTelemetryEvent]);

  // 2. Local Telemetry Fast-Path: Immediately push active user's own actions
  useEffect(() => {
    const unsubscribe = telemetryQueue.subscribe((event: QueuedTelemetryEvent) => {
      if (!VALID_EVENT_TYPES.includes(event.eventType)) return;

      const localItem = parseTelemetryEvent({
        id: event.id,
        event_type: event.eventType,
        payload: event.payload,
        user_id: null, // Displayed as active player or guest
      });

      eventsQueueRef.current = [localItem, ...eventsQueueRef.current.slice(0, 29)];
      setVisibleItems((prev) => [localItem, ...prev.slice(0, 2)]);
    });

    return () => {
      unsubscribe();
    };
  }, [parseTelemetryEvent]);

  // Cycle visible items every 6 seconds (paused if user is hovering)
  useEffect(() => {
    const cycleInterval = setInterval(() => {
      if (isHovered) return;
      const queue = eventsQueueRef.current;
      if (queue.length === 0) return;

      const nextIndex = queueIndexRef.current;
      const nextItem = {
        ...queue[nextIndex],
        id: `${queue[nextIndex].id}-${Date.now()}`,
      };

      queueIndexRef.current = (nextIndex + 1) % queue.length;

      setVisibleItems((prev) => {
        const updated = [nextItem, ...prev];
        return updated.length > 3 ? updated.slice(0, 3) : updated;
      });
    }, 6000);

    return () => clearInterval(cycleInterval);
  }, [isHovered]);

  const activeMobileItem = visibleItems[0];

  return (
    <>
      {/* ── DESKTOP VIEW: Top-Right Cyber Brutalist Stack ────────────────────── */}
      <div
        className="hidden md:flex flex-col gap-2.5 fixed pointer-events-none z-[45]"
        style={{
          top: '64px',
          right: '32px',
          width: '275px',
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
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
                className="pointer-events-auto border-2 border-black flex flex-col p-2.5 relative overflow-hidden select-none cursor-default transition-transform hover:scale-[1.02]"
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
                    background:
                      'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%)',
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
                  <div className="flex items-center gap-1">
                    {isLiveConnected && (
                      <span
                        title="Live WebSocket Connected"
                        className="w-1.5 h-1.5 rounded-full bg-[#39ff14] animate-pulse"
                      />
                    )}
                    {item.accentText && (
                      <span
                        className="font-mono text-[7px] px-1 py-0.5 border border-black font-black uppercase tracking-tight shrink-0"
                        style={{
                          background: item.color,
                          color: '#000',
                          transform: 'skewX(-4deg) scale(0.95)',
                          boxShadow: '1px 1px 0 #000',
                        }}
                      >
                        {item.accentText}
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom Row: Detail text */}
                <div className="z-10">
                  <p className="font-mono text-[8px] leading-tight text-white/70" style={{ margin: 0 }}>
                    {item.detail}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* ── MOBILE VIEW: Sleek Live Pulse Strip & Expandable Drawer ─────────── */}
      <div className="md:hidden fixed top-[56px] right-2 left-2 z-[45] pointer-events-none">
        <AnimatePresence mode="wait">
          {activeMobileItem && (
            <motion.div
              key={mobileExpanded ? 'expanded' : activeMobileItem.id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="pointer-events-auto bg-black/95 backdrop-blur-md border border-white/15 p-2 shadow-lg flex flex-col gap-1.5 select-none"
              style={{
                borderLeft: `3px solid ${activeMobileItem.color}`,
              }}
              onClick={() => setMobileExpanded(!mobileExpanded)}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Radio size={10} style={{ color: activeMobileItem.color }} className="shrink-0 animate-pulse" />
                  <span
                    className="font-mono text-[8px] font-black uppercase tracking-wider truncate"
                    style={{ color: activeMobileItem.color }}
                  >
                    {activeMobileItem.title}
                  </span>
                  <span className="font-mono text-[8px] text-white/60 truncate">
                    — {activeMobileItem.detail}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {activeMobileItem.accentText && (
                    <span
                      className="font-mono text-[7px] px-1 py-0.2 border border-black font-black uppercase tracking-tight"
                      style={{ background: activeMobileItem.color, color: '#000' }}
                    >
                      {activeMobileItem.accentText}
                    </span>
                  )}
                  {mobileExpanded ? <ChevronUp size={12} className="text-white/40" /> : <ChevronDown size={12} className="text-white/40" />}
                </div>
              </div>

              {/* Mobile Expanded Drawer View */}
              {mobileExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex flex-col gap-1.5 pt-1.5 mt-1 border-t border-white/10"
                >
                  <div className="font-mono text-[8px] text-white/40 uppercase tracking-widest">
                    RECENT GLOBAL TRANSMISSIONS:
                  </div>
                  {visibleItems.slice(0, 3).map((item) => (
                    <div key={item.id} className="font-mono text-[8px] text-white/80 flex items-center justify-between gap-1">
                      <span className="truncate">{item.detail}</span>
                      <span className="shrink-0 font-bold" style={{ color: item.color }}>
                        {item.accentText}
                      </span>
                    </div>
                  ))}
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
