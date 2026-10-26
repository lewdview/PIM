/**
 * holoGyro.ts — one shared deviceorientation listener for every holo card.
 *
 * Cards subscribe while they are on screen; the listener only runs while at
 * least one card is subscribed. Readings are normalised to -1..1 around a
 * baseline that slowly drifts toward the current pose, so a phone held at any
 * angle settles back to a centred sheen and only movement makes the foil shift.
 */

type GyroListener = (x: number, y: number) => void;

const listeners = new Set<GyroListener>();
let listening = false;
let baseline: { x: number; y: number } | null = null;
let permission: 'unknown' | 'granted' | 'denied' = 'unknown';

const RANGE_DEG = 22;
const BASELINE_DRIFT = 0.004;

const clamp = (v: number) => (v < -1 ? -1 : v > 1 ? 1 : v);

type OrientationCtor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

function orientationCtor(): OrientationCtor | null {
  if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) return null;
  return window.DeviceOrientationEvent as OrientationCtor;
}

/** iOS Safari gates orientation behind a permission prompt raised from a tap. */
export function gyroNeedsPermission(): boolean {
  const ctor = orientationCtor();
  return !!ctor && typeof ctor.requestPermission === 'function' && permission !== 'granted';
}

export function gyroAvailable(): boolean {
  return !!orientationCtor() && permission !== 'denied';
}

/** Must be called from a user gesture on iOS. Resolves true when readings can flow. */
export async function requestGyroPermission(): Promise<boolean> {
  const ctor = orientationCtor();
  if (!ctor) return false;
  if (typeof ctor.requestPermission !== 'function') {
    permission = 'granted';
    return true;
  }
  if (permission !== 'unknown') return permission === 'granted';
  try {
    permission = (await ctor.requestPermission()) === 'granted' ? 'granted' : 'denied';
  } catch {
    permission = 'denied';
  }
  if (permission === 'granted') ensureListening();
  return permission === 'granted';
}

function screenAngle(): number {
  if (typeof screen !== 'undefined' && screen.orientation) return screen.orientation.angle;
  // Older iOS only exposes the deprecated window.orientation.
  const legacy = (window as Window & { orientation?: number }).orientation;
  return typeof legacy === 'number' ? legacy : 0;
}

function handleOrientation(e: DeviceOrientationEvent) {
  if (e.beta == null || e.gamma == null) return;
  // Map device axes onto screen axes so landscape tilts the right way.
  let x = e.gamma;
  let y = e.beta;
  const angle = screenAngle();
  if (angle === 90) { x = e.beta; y = -e.gamma; }
  else if (angle === -90 || angle === 270) { x = -e.beta; y = e.gamma; }
  else if (angle === 180) { x = -e.gamma; y = -e.beta; }

  if (!baseline) baseline = { x, y };
  baseline.x += (x - baseline.x) * BASELINE_DRIFT;
  baseline.y += (y - baseline.y) * BASELINE_DRIFT;

  const nx = clamp((x - baseline.x) / RANGE_DEG);
  const ny = clamp((y - baseline.y) / RANGE_DEG);
  listeners.forEach((fn) => fn(nx, ny));
}

function ensureListening() {
  if (listening || listeners.size === 0 || gyroNeedsPermission()) return;
  window.addEventListener('deviceorientation', handleOrientation, { passive: true });
  listening = true;
}

function stopListening() {
  if (!listening) return;
  window.removeEventListener('deviceorientation', handleOrientation);
  listening = false;
  baseline = null;
}

export function subscribeGyro(fn: GyroListener): () => void {
  listeners.add(fn);
  ensureListening();
  return () => {
    listeners.delete(fn);
    if (listeners.size === 0) stopListening();
  };
}
