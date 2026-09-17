import { telemetryQueue } from './telemetryQueue';

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
}

/**
 * Explicitly flush any queued telemetry events immediately.
 */
export async function flushAnalyticsQueue() {
  await telemetryQueue.flush();
}

export { telemetryQueue };

