import { supabase, SUPABASE_URL } from './supabaseClient';

export interface QueuedTelemetryEvent {
  id: string;
  eventType: string;
  payload: Record<string, any>;
  timestamp: number;
  sessionId: string;
  route: string;
  isMobile: boolean;
}

type TelemetryListener = (event: QueuedTelemetryEvent) => void;

const BATCH_INTERVAL_MS = 5000;
const MAX_BATCH_SIZE = 10;
const MAX_QUEUE_LIMIT = 50;
const OFFLINE_STORAGE_KEY = 'pim_telemetry_offline_queue';

class TelemetryQueueManager {
  private queue: QueuedTelemetryEvent[] = [];
  private sessionId: string;
  private timer: any = null;
  private isFlushing = false;
  private listeners: Set<TelemetryListener> = new Set();

  constructor() {
    this.sessionId = this.initSessionId();
    this.restoreOfflineQueue();
    this.setupLifecycleListeners();
    this.startTimer();
  }

  private initSessionId(): string {
    if (typeof window === 'undefined') return 'server_session';
    try {
      let sId = sessionStorage.getItem('pim_session_id');
      if (!sId) {
        sId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        sessionStorage.setItem('pim_session_id', sId);
      }
      return sId;
    } catch {
      return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }
  }

  private isMobileDevice(): boolean {
    if (typeof window === 'undefined') return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
  }

  private getCurrentRoute(): string {
    if (typeof window === 'undefined') return '/';
    return window.location.pathname || '/';
  }

  private setupLifecycleListeners() {
    if (typeof window === 'undefined') return;

    // Flush on page hidden / background / tab close
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.flush({ useBeacon: true });
      }
    });

    window.addEventListener('beforeunload', () => {
      this.flush({ useBeacon: true });
    });

    // Auto-flush offline queue when back online
    window.addEventListener('online', () => {
      this.restoreOfflineQueue();
      this.flush();
    });
  }

  private startTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      if (this.queue.length > 0) {
        this.scheduleFlush();
      }
    }, BATCH_INTERVAL_MS);
  }

  /**
   * Subscribe to local telemetry events as they are dispatched.
   * Useful for HUD, live ticker, and debugging views without roundtrip latency.
   */
  public subscribe(listener: TelemetryListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(event: QueuedTelemetryEvent) {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.warn('[TelemetryQueue] Listener error:', err);
      }
    });
  }

  /**
   * Enqueue a new analytics event.
   */
  public enqueue(eventType: string, payload: Record<string, any> = {}, options: { immediate?: boolean } = {}) {
    const event: QueuedTelemetryEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      eventType,
      payload: { ...payload },
      timestamp: Date.now(),
      sessionId: this.sessionId,
      route: this.getCurrentRoute(),
      isMobile: this.isMobileDevice(),
    };

    // Notify local subscribers immediately (fast-path for HUD & ticker)
    this.notifyListeners(event);

    // If offline, store immediately
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.persistOffline([event]);
      return;
    }

    this.queue.push(event);

    // Limit in-memory queue size to avoid runaway memory
    if (this.queue.length > MAX_QUEUE_LIMIT) {
      this.queue.shift();
    }

    if (options.immediate || this.queue.length >= MAX_BATCH_SIZE) {
      this.flush();
    }
  }

  /**
   * Schedule a flush during browser idle time to avoid frame drops in canvas loops.
   */
  private scheduleFlush() {
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => this.flush(), { timeout: 2000 });
    } else {
      setTimeout(() => this.flush(), 0);
    }
  }

  /**
   * Flush the current queue to the vault-engine backend.
   */
  public async flush(options: { useBeacon?: boolean } = {}): Promise<void> {
    if (this.queue.length === 0 || this.isFlushing) return;

    // Extract batch
    const batch = this.queue.splice(0, MAX_BATCH_SIZE);
    this.isFlushing = true;

    try {
      const payloadBody = {
        action: 'batchLogClientTelemetry',
        payload: {
          events: batch.map((ev) => ({
            eventType: ev.eventType,
            payload: {
              ...ev.payload,
              _meta: {
                id: ev.id,
                sessionId: ev.sessionId,
                route: ev.route,
                isMobile: ev.isMobile,
                timestamp: ev.timestamp,
              },
            },
            timestamp: new Date(ev.timestamp).toISOString(),
          })),
        },
      };

      // Page unload beacon path
      if (options.useBeacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
        const edgeEndpoint = `${SUPABASE_URL}/functions/v1/vault-engine`;
        const blob = new Blob([JSON.stringify(payloadBody)], { type: 'application/json' });
        const sent = navigator.sendBeacon(edgeEndpoint, blob);
        if (sent) {
          this.isFlushing = false;
          return;
        }
      }

      // Normal Supabase edge function invocation
      const { error } = await supabase.functions.invoke('vault-engine', {
        body: payloadBody,
      });

      if (error) {
        throw error;
      }
    } catch (err) {
      // Re-queue failed batch or store offline
      console.warn('[TelemetryQueue] Failed to flush batch, storing for retry:', err);
      this.persistOffline(batch);
    } finally {
      this.isFlushing = false;
    }
  }

  private persistOffline(events: QueuedTelemetryEvent[]) {
    if (typeof window === 'undefined') return;
    try {
      const existing = localStorage.getItem(OFFLINE_STORAGE_KEY);
      const list: QueuedTelemetryEvent[] = existing ? JSON.parse(existing) : [];
      const updated = [...list, ...events].slice(-MAX_QUEUE_LIMIT);
      localStorage.setItem(OFFLINE_STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.warn('[TelemetryQueue] Failed to save offline telemetry:', err);
    }
  }

  private restoreOfflineQueue() {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(OFFLINE_STORAGE_KEY);
      if (raw) {
        const events: QueuedTelemetryEvent[] = JSON.parse(raw);
        if (Array.isArray(events) && events.length > 0) {
          this.queue.push(...events);
          localStorage.removeItem(OFFLINE_STORAGE_KEY);
        }
      }
    } catch {
      localStorage.removeItem(OFFLINE_STORAGE_KEY);
    }
  }
}

export const telemetryQueue = new TelemetryQueueManager();
