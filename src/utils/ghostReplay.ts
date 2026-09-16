import { supabase } from '../services/supabaseClient';
import type { NoteType } from '../game/types';

export type GhostJudgment = 'PERFECT+' | 'PERFECT' | 'GOOD' | 'MISS' | 'SHIELDED';

export interface GhostEvent {
  /** Timestamp in ms from song audio start */
  t: number;
  /** Lane index (0, 1, 2) */
  lane: number;
  /** Note type */
  type: NoteType;
  /** Resulting judgment */
  judgment: GhostJudgment;
}

export interface GhostReplay {
  songId: string;
  displayName: string | null;
  score: number;
  accuracy: number;
  medal: string;
  events: GhostEvent[];
}

/** Encode replay events to a compact base64 JSON string */
export function encodeReplay(events: GhostEvent[]): string {
  try {
    return btoa(JSON.stringify(events));
  } catch {
    return '';
  }
}

/** Decode base64 replay back to GhostEvent[] */
export function decodeReplay(encoded: string): GhostEvent[] {
  try {
    return JSON.parse(atob(encoded)) as GhostEvent[];
  } catch {
    return [];
  }
}

/**
 * Upload a ghost replay if the score is better than the current record.
 * Non-blocking best-effort execution.
 */
export async function uploadGhostIfBetter(
  songId: string,
  events: GhostEvent[],
  score: number,
  accuracy: number,
  medal: string,
  displayName?: string
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Check current top ghost for this song
    const { data: existing } = await supabase
      .from('ghost_replays')
      .select('score, id')
      .eq('song_id', songId)
      .maybeSingle();

    if (existing && existing.score >= score) return; // Not a new top score

    const encoded = encodeReplay(events);
    if (!encoded) return;

    if (existing) {
      await supabase.from('ghost_replays').update({
        user_id: user.id,
        display_name: displayName ?? null,
        score,
        accuracy,
        medal,
        replay_data: encoded,
        created_at: new Date().toISOString(),
      }).eq('song_id', songId);
    } else {
      await supabase.from('ghost_replays').insert({
        song_id: songId,
        user_id: user.id,
        display_name: displayName ?? null,
        score,
        accuracy,
        medal,
        replay_data: encoded,
      });
    }
  } catch (e) {
    console.warn('[ghostReplay] Ghost upload skipped:', e);
  }
}

/**
 * Fetch the current top ghost replay for a song.
 */
export async function fetchGhost(songId: string): Promise<GhostReplay | null> {
  try {
    const { data, error } = await supabase
      .from('ghost_replays')
      .select('song_id, display_name, score, accuracy, medal, replay_data')
      .eq('song_id', songId)
      .maybeSingle();

    if (error || !data || !data.replay_data) return null;

    const events = decodeReplay(data.replay_data);
    if (!events.length) return null;

    return {
      songId: data.song_id,
      displayName: data.display_name,
      score: data.score,
      accuracy: data.accuracy,
      medal: data.medal,
      events,
    };
  } catch {
    return null;
  }
}
