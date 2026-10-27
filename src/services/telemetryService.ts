import { telemetryQueue } from './telemetryQueue';
import { mirrorGameEvent } from './ecosystemActivity';

export interface TelemetryOptions {
  immediate?: boolean;
}

/**
 * Log an analytics/telemetry event to the remote database via the vault-engine.
 * Events are automatically micro-batched, queued during idle frames to prevent 60fps
 * render stutters, and persisted offline if disconnected.
 */
export async function logAnalyticsEvent(
  eventType: string,
  payload: any = {},
  options?: TelemetryOptions
) {
  try {
    telemetryQueue.enqueue(eventType, payload, options);
  } catch (err) {
    console.warn('[Analytics] Failed to enqueue event:', eventType, err);
  }
  // Game starts/ends also count as plays in the ecosystem-wide play log.
  mirrorGameEvent(eventType, payload);
}

/**
 * Explicitly flush any queued telemetry events immediately.
 */
export async function flushAnalyticsQueue() {
  await telemetryQueue.flush();
}

export { telemetryQueue };

