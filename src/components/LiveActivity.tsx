import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { supabase } from '../services/supabaseClient';
import { telemetryQueue, type QueuedTelemetryEvent } from '../services/telemetryQueue';
import { fetchAllCards } from '../services/vaultService';
import { useAuthStore } from '../store/useAuthStore';
import {
  ACTIVITY_EVENT_TYPES,
  actorsLabel,
  groupActivity,
  timeAgo,
  toActivityItem,
  type ActivityContext,
  type ActivityItem,
  type RawActivityEvent,
} from '../services/liveActivity';
import '../styles/liveActivity.css';

const POLL_MS = 20_000;
const TOAST_MS = 6_000;
const MAX_ITEMS = 40;
const HOUR = 60 * 60 * 1000;

/** Routes where nothing should pop over the player. */
const QUIET_ROUTES = [/^\/play\/.+/, /^\/vault\/reveal/, /^\/reveal/, /^\/tutorial/];

interface CatalogEntry { title: string; cover?: string }

/**
 * Navbar "● LIVE" pill + activity panel + one-at-a-time toasts.
 * Shows only real events, each with its age; never replays old ones.
 */
export default function LiveActivity() {
  const myUserId = useAuthStore((s) => s.user?.id ?? null);
  const [location, navigate] = useLocation();
  const quiet = QUIET_ROUTES.some((r) => r.test(location));

  const [items, setItems] = useState<ActivityItem[]>([]);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<ActivityItem | null>(null);
  const [counts, setCounts] = useState<{ players: number; cards: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [fresh, setFresh] = useState(false);

  const catalogRef = useRef<Record<number, CatalogEntry>>({});
  const namesRef = useRef<Record<string, string | null>>({});
  const seenRef = useRef<Set<string>>(new Set());
  const localRef = useRef<{ kind: string; key: string; at: number }[]>([]);
  const baselineRef = useRef(false);
  const toastQueueRef = useRef<ActivityItem[]>([]);
  const hoverRef = useRef(false);
  const myIdRef = useRef(myUserId);
  myIdRef.current = myUserId;

  const ctx = useCallback((): ActivityContext => ({
    myUserId: myIdRef.current,
    displayNames: namesRef.current,
    songTitle: (day) => catalogRef.current[day]?.title,
  }), []);

  // Song titles + covers
  useEffect(() => {
    fetchAllCards()
      .then((cards) => {
        const map: Record<number, CatalogEntry> = {};
        for (const c of cards) if (c.day && !map[c.day]) map[c.day] = { title: c.title, cover: c.coverUrl };
        catalogRef.current = map;
        // Re-render existing items with real titles
        setItems((prev) => [...prev]);
      })
      .catch(() => {});
  }, []);

  const enqueueToasts = useCallback((fresh: ActivityItem[]) => {
    if (!fresh.length) return;
    // Newest first in, but show oldest first so the story reads in order;
    // keep the queue short — everything is in the panel anyway.
    const grouped = groupActivity(fresh).reverse();
    toastQueueRef.current = [...toastQueueRef.current, ...grouped].slice(-4);
    setFresh(true);
  }, []);

  const addItems = useCallback((incoming: ActivityItem[]) => {
    if (!incoming.length) return;
    setItems((prev) => {
      const merged = [...incoming, ...prev].sort((a, b) => b.at - a.at);
      return merged.slice(0, MAX_ITEMS);
    });
  }, []);

  // Poll the public activity feed (raw telemetry is private to its owner)
  const poll = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_recent_activity', {
      p_types: [...ACTIVITY_EVENT_TYPES],
      p_limit: 30,
    });
    if (error || !Array.isArray(data)) return;
    const events = data as RawActivityEvent[];

    const unknown = [...new Set(events.map((e) => e.user_id).filter((u): u is string => !!u && !(u in namesRef.current)))];
    if (unknown.length) {
      const { data: profiles } = await supabase.rpc('get_public_profiles', { p_ids: unknown });
      for (const id of unknown) namesRef.current[id] = null;
      for (const p of (profiles as { id: string; display_name: string | null }[] | null) ?? []) {
        namesRef.current[p.id] = p.display_name;
      }
    }

    const newOnes: ActivityItem[] = [];
    for (const e of events) {
      if (seenRef.current.has(e.id)) continue;
      seenRef.current.add(e.id);
      const item = toActivityItem(e, ctx());
      if (!item) continue;
      // Your own song results were already shown instantly from the local queue
      if (e.user_id && e.user_id === myIdRef.current) {
        const key = String(item.day ?? '');
        const i = localRef.current.findIndex((l) => l.kind === item.kind && l.key === key && Math.abs(l.at - item.at) < 5 * 60_000);
        if (i >= 0) { localRef.current.splice(i, 1); continue; }
      }
      newOnes.push(item);
    }
    addItems(newOnes);
    if (baselineRef.current) enqueueToasts(newOnes);
    baselineRef.current = true;
  }, [addItems, ctx, enqueueToasts]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer) return;
      void poll();
      timer = setInterval(() => void poll(), POLL_MS);
    };
    const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
    const onVis = () => (document.visibilityState === 'visible' ? start() : stop());
    onVis();
    document.addEventListener('visibilitychange', onVis);
    return () => { stop(); document.removeEventListener('visibilitychange', onVis); };
  }, [poll]);

  // Your own actions appear instantly
  useEffect(() => telemetryQueue.subscribe((ev: QueuedTelemetryEvent) => {
    const item = toActivityItem(
      { id: ev.id, event_type: ev.eventType, payload: ev.payload, created_at: new Date(ev.timestamp || Date.now()).toISOString(), user_id: myIdRef.current },
      ctx(),
    );
    if (!item) return;
    if (!myIdRef.current) item.actors = [{ userId: null, label: 'You', isYou: true }];
    localRef.current.push({ kind: item.kind, key: String(item.day ?? ''), at: item.at });
    addItems([item]);
    enqueueToasts([item]);
  }), [addItems, ctx, enqueueToasts]);

  // Toast runner: one at a time, pauses while hovered, silent on quiet routes
  useEffect(() => {
    const tick = setInterval(() => {
      setNow(Date.now());
      if (toast || quiet || open) return;
      const next = toastQueueRef.current.shift();
      if (next) setToast(next);
    }, 1000);
    return () => clearInterval(tick);
  }, [toast, quiet, open]);

  useEffect(() => {
    if (!toast) return;
    let left = TOAST_MS;
    const step = 250;
    const t = setInterval(() => {
      if (!hoverRef.current) left -= step;
      if (left <= 0) { clearInterval(t); setToast(null); }
    }, step);
    return () => clearInterval(t);
  }, [toast]);

  useEffect(() => { if (quiet) setToast(null); }, [quiet]);

  // Real totals for the panel footer
  useEffect(() => {
    if (!open) return;
    setFresh(false);
    supabase.rpc('get_public_counts').then(({ data }) => {
      const c = data as { players?: number; cards?: number } | null;
      if (c) setCounts({ players: Number(c.players) || 0, cards: Number(c.cards) || 0 });
    });
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const grouped = useMemo(() => groupActivity(items), [items]);
  const lastHour = useMemo(() => items.filter((i) => now - i.at < HOUR).length, [items, now]);

  const go = (item: ActivityItem) => {
    setOpen(false);
    setToast(null);
    if (item.href) navigate(item.href);
  };

  return (
    <>
      <button
        type="button"
        className="pim-live"
        data-fresh={fresh}
        aria-expanded={open}
        aria-controls="pim-live-panel"
        aria-label={`Live vault activity, ${lastHour} in the last hour`}
        title={`${lastHour} vault event${lastHour === 1 ? '' : 's'} in the last hour`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="pim-live-dot" aria-hidden="true" />
        <span className="pim-live-word">Live</span>
        {lastHour > 0 && <span className="pim-live-count">{lastHour >= 30 ? '30+' : lastHour}</span>}
      </button>

      {open && (
        <>
          <div className="pim-live-scrim" onClick={() => setOpen(false)} />
          <section id="pim-live-panel" className="pim-live-panel" aria-label="Live vault activity">
            <header className="pim-live-head">
              <h3>Live in the vault</h3>
              <span>{lastHour} in the last hour</span>
            </header>
            {grouped.length === 0 ? (
              <div className="pim-live-empty">
                <p>Quiet right now.</p>
                <Link to="/vault" onClick={() => setOpen(false)}>Claim today's drop →</Link>
              </div>
            ) : (
              <ul className="pim-live-list">
                {grouped.slice(0, 14).map((item) => (
                  <li key={item.id}>
                    <ActivityRow item={item} now={now} cover={item.day ? catalogRef.current[item.day]?.cover : undefined} onGo={go} />
                  </li>
                ))}
              </ul>
            )}
            {counts && (
              <footer className="pim-live-foot">
                {counts.players.toLocaleString()} collectors · {counts.cards.toLocaleString()} cards in the vault
              </footer>
            )}
          </section>
        </>
      )}

      <div className="pim-live-toastzone" role="status" aria-live="polite">
        {toast && !quiet && (
          <div
            key={toast.id}
            className="pim-live-toast"
            onMouseEnter={() => { hoverRef.current = true; }}
            onMouseLeave={() => { hoverRef.current = false; }}
          >
            <ActivityRow
              item={toast}
              now={now}
              cover={toast.day ? catalogRef.current[toast.day]?.cover : undefined}
              onGo={go}
            />
            <button type="button" className="pim-live-toast-x" aria-label="Dismiss" onClick={() => setToast(null)}>×</button>
          </div>
        )}
      </div>
    </>
  );
}

function ActivityRow({ item, now, cover, onGo }: {
  item: ActivityItem;
  now: number;
  cover?: string;
  onGo: (item: ActivityItem) => void;
}) {
  const you = item.actors.some((a) => a.isYou);
  const [coverOk, setCoverOk] = useState(true);
  const repeats = item.kind === 'game_end' && item.count > 1 ? `${item.count} plays` : null;
  return (
    <button
      type="button"
      className="pim-live-row"
      data-you={you}
      style={{ ['--live-accent' as string]: item.accent }}
      onClick={() => onGo(item)}
    >
      <span className="pim-live-thumb" aria-hidden="true">
        {cover && coverOk
          ? <img src={cover} alt="" loading="lazy" onError={() => setCoverOk(false)} />
          : <span className="pim-live-glyph" />}
      </span>
      <span className="pim-live-text">
        <span className="pim-live-line">
          <b>{actorsLabel(item.actors)}</b> {item.verb} <em>{item.subject}</em>
        </span>
        <span className="pim-live-meta">
          {repeats && <>{repeats} · </>}
          {item.meta && <>{item.meta} · </>}
          {timeAgo(item.at, now)}
        </span>
      </span>
      {item.badge && (
        <span className="pim-live-badge" style={{ ['--badge' as string]: item.badge.color }}>{item.badge.text}</span>
      )}
    </button>
  );
}
