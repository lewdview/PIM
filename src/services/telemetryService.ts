import { supabase } from './supabaseClient';

/**
 * Log an analytics/telemetry event to the remote database via the vault-engine.
 * This is robust, performance-safe, and decoupled from gameplay render loops.
 */
export async function logAnalyticsEvent(eventType: string, payload: any = {}) {
  try {
    // Call vault-engine backend to write to telemetry_events securely
    await supabase.functions.invoke('vault-engine', {
      body: {
        action: 'logClientTelemetry',
        payload: { eventType, payload }
      }
    });
  } catch (err) {
    console.warn('[Analytics] Failed to log event:', eventType, err);
  }
}

