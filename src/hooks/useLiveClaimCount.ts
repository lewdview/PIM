import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { getClaimedCountForDay } from '../services/vaultService';

const REALTIME_CHANNEL_NAME = 'global-daily-claims';
let globalChannel: ReturnType<typeof supabase.channel> | null = null;
const claimListeners = new Set<(day: number) => void>();

function getOrCreateChannel() {
  if (!globalChannel) {
    globalChannel = supabase.channel(REALTIME_CHANNEL_NAME, {
      config: { broadcast: { self: false } }
    });

    globalChannel
      .on('broadcast', { event: 'card_claimed' }, (payload: any) => {
        const day = payload?.payload?.day;
        if (day) {
          claimListeners.forEach((fn) => fn(Number(day)));
        }
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'global_supply' },
        (payload: any) => {
          const cardIdRarity = (payload?.new as any)?.card_id_rarity || (payload?.old as any)?.card_id_rarity;
          if (cardIdRarity) {
            const parsedDay = parseInt(cardIdRarity.split('-')[0], 10);
            if (!isNaN(parsedDay)) {
              claimListeners.forEach((fn) => fn(parsedDay));
            }
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[LiveClaim] Subscribed to global-daily-claims channel');
        }
      });
  }
  return globalChannel;
}

/**
 * Broadcasts a card claim event to all currently connected clients across the globe.
 */
export function broadcastClaim(day: number) {
  try {
    const channel = getOrCreateChannel();
    channel.send({
      type: 'broadcast',
      event: 'card_claimed',
      payload: { day: Number(day), timestamp: Date.now() },
    }).catch((err) => {
      console.warn('[LiveClaim] Realtime broadcast send failed:', err);
    });
  } catch (err) {
    console.warn('[LiveClaim] Broadcast claim error:', err);
  }
}

/**
 * React hook that maintains a live, synchronized claim count for a given day.
 * Synchronizes via Supabase Realtime broadcast, PostgreSQL changes, and fallback polling.
 */
export function useLiveClaimCount(day: number) {
  const [count, setCount] = useState<number>(0);
  const isMountedRef = useRef(true);

  const fetchLatest = useCallback(async () => {
    try {
      const liveCount = await getClaimedCountForDay(day);
      if (isMountedRef.current) {
        setCount(liveCount);
      }
    } catch (err) {
      console.warn('[LiveClaim] Failed to fetch claimed count for day', day, err);
    }
  }, [day]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchLatest();

    const onClaimEvent = (eventDay: number) => {
      if (eventDay === day) {
        fetchLatest();
      }
    };

    claimListeners.add(onClaimEvent);
    getOrCreateChannel();

    // 10-second polling fallback to catch any dropped connections
    const interval = setInterval(fetchLatest, 10000);

    return () => {
      isMountedRef.current = false;
      claimListeners.delete(onClaimEvent);
      clearInterval(interval);
    };
  }, [day, fetchLatest]);

  const optimisticIncrement = useCallback(() => {
    setCount((prev) => prev + 1);
  }, []);

  return {
    count,
    optimisticIncrement,
    refresh: fetchLatest,
  };
}
