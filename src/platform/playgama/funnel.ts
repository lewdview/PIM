/**
 * Session-flow telemetry for the monthly build (spec section 12). Events go
 * through the Bridge's analytics module, so there's no server of our own.
 * Every event carries the build version, chapter, a pseudonymous session id
 * and a coarse device class; nothing per note, no keystrokes, nothing personal.
 *
 * Launch-relative times use performance.now(), which starts at navigation.
 */
import { BUILD_VERSION, PLAYGAMA_MONTH } from './month';
import { deviceClass, onSaveFailed, sendAnalytics, setAnalyticsGameVersion } from './bridge';

/** Bumped when the flow's settings (modes, intro treatment, timings) change. */
export const FLOW_CONFIG_VERSION = 'phaseA-1';

const SESSION_KEY = 'pg_funnel_session';
const VISITS_KEY = `pg_visits_m${PLAYGAMA_MONTH}`;
const sent = new Set<string>();
let started = false;
let session = '';
let firstVisit = false;
let device = '';
let errorsSent = 0;

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  }
}

/** Milliseconds since the page started loading. */
export const sinceLaunch = () => Math.round(performance.now());

/** Sends one event. With `onceKey`, a repeat in the same page load is dropped. */
export function track(event: string, data: Record<string, unknown> = {}, onceKey?: string): void {
  if (!PLAYGAMA_MONTH) return;
  if (onceKey) {
    if (sent.has(onceKey)) return;
    sent.add(onceKey);
  }
  if (!started) startFunnel();
  sendAnalytics(event, {
    build: BUILD_VERSION,
    config: FLOW_CONFIG_VERSION,
    chapter: PLAYGAMA_MONTH,
    session,
    first_visit: firstVisit,
    device,
    ...data,
  });
}

/** Opens the session: session_started, plus save-failure and runtime-error reporting. Safe to call twice. */
export function startFunnel(): void {
  if (started || !PLAYGAMA_MONTH) return;
  started = true;
  try {
    // Kept for the tab's life, so a quick reload stays the same session.
    session = sessionStorage.getItem(SESSION_KEY) || '';
    if (!session) {
      session = newId();
      sessionStorage.setItem(SESSION_KEY, session);
    }
  } catch {
    session = newId();
  }
  let visits = 0;
  try {
    visits = Number(localStorage.getItem(VISITS_KEY)) || 0;
    localStorage.setItem(VISITS_KEY, String(visits + 1));
  } catch { /* storage blocked */ }
  firstVisit = visits === 0;
  try {
    device = deviceClass();
  } catch {
    device = 'unknown';
  }
  setAnalyticsGameVersion(BUILD_VERSION);
  track('session_started', { since_launch_ms: sinceLaunch(), visits: visits + 1 });

  onSaveFailed((err) => track('save_failed', { op: 'bridge_storage_set', error: errorClass(err) }));
  const onError = (err: unknown, where: string) => {
    // A handful per session is enough to see a pattern.
    if (errorsSent >= 5) return;
    errorsSent++;
    track('runtime_error', { op: where, error: errorClass(err) });
  };
  window.addEventListener('error', (e) => onError(e.error ?? e.message, 'window_error'));
  window.addEventListener('unhandledrejection', (e) => onError(e.reason, 'unhandled_rejection'));
}

/** The error's class name and a short, path-free message. */
function errorClass(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message.replace(/https?:\/\/\S+/g, '<url>').slice(0, 80)}`;
  if (typeof err === 'string') return err.replace(/https?:\/\/\S+/g, '<url>').slice(0, 80);
  return 'unknown';
}

// ── Run bookkeeping shared by gameplay and results ─────────────────────────

const PLAY_AT_KEY = 'pg_funnel_play_at';
const RESULTS_AT_KEY = 'pg_funnel_results_at';

/** The moment Play was pressed (for first_note_reached's "from Play" time). */
export function markPlayPressed(): void {
  try { sessionStorage.setItem(PLAY_AT_KEY, String(Date.now())); } catch { /* ignore */ }
}
export function msSincePlayPressed(): number | null {
  try {
    const at = Number(sessionStorage.getItem(PLAY_AT_KEY));
    return at ? Date.now() - at : null;
  } catch {
    return null;
  }
}
export function markResultsShown(): void {
  try { sessionStorage.setItem(RESULTS_AT_KEY, String(Date.now())); } catch { /* ignore */ }
}
export function resultsDwellMs(): number | null {
  try {
    const at = Number(sessionStorage.getItem(RESULTS_AT_KEY));
    return at ? Date.now() - at : null;
  } catch {
    return null;
  }
}
