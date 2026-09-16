import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';

export interface AdaptiveDifficultyResult {
  /** The adjusted difficulty (±1 of baseDifficulty based on player accuracy history) */
  effectiveDifficulty: number;
  /** Human-readable explanation of why the difficulty was adjusted */
  adjustmentReason: string;
  /** Whether historical analysis is in flight */
  loading: boolean;
}

/**
 * Task 4G: Computes an adaptive difficulty modifier based on the player's
 * historical accuracy across recent plays on a given song.
 *
 * - 5+ plays averaging >90% accuracy: increases difficulty by 1 (max 10)
 * - 5+ plays averaging <45% accuracy: eases difficulty by 1 (min 1)
 * - Otherwise: retains base difficulty
 *
 * Serves as the foundation layer for future in-browser ONNX difficulty inference.
 */
export function useAdaptiveDifficulty(
  songId: string | null | undefined,
  baseDifficulty: number
): AdaptiveDifficultyResult {
  const [result, setResult] = useState<AdaptiveDifficultyResult>({
    effectiveDifficulty: baseDifficulty,
    adjustmentReason: 'Standard difficulty',
    loading: !!songId,
  });

  useEffect(() => {
    if (!songId) {
      setResult({ effectiveDifficulty: baseDifficulty, adjustmentReason: 'Standard difficulty', loading: false });
      return;
    }

    let cancelled = false;

    async function evaluatePerformance() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) {
          setResult({ effectiveDifficulty: baseDifficulty, adjustmentReason: 'Base difficulty', loading: false });
          return;
        }

        const { data: records, error } = await supabase
          .from('gameplay_records')
          .select('accuracy')
          .eq('user_id', user.id)
          .eq('song_id', songId)
          .order('created_at', { ascending: false })
          .limit(10);

        if (cancelled || error) return;

        if (!records || records.length < 5) {
          setResult({
            effectiveDifficulty: baseDifficulty,
            adjustmentReason: 'Calibrating (< 5 plays)',
            loading: false,
          });
          return;
        }

        const avgAccuracy = records.reduce((sum, r) => sum + (Number(r.accuracy) || 0), 0) / records.length;

        if (avgAccuracy > 90) {
          setResult({
            effectiveDifficulty: Math.min(10, baseDifficulty + 1),
            adjustmentReason: `Mastery (${avgAccuracy.toFixed(0)}% avg) — difficulty +1`,
            loading: false,
          });
        } else if (avgAccuracy < 45) {
          setResult({
            effectiveDifficulty: Math.max(1, baseDifficulty - 1),
            adjustmentReason: `Assistance (${avgAccuracy.toFixed(0)}% avg) — difficulty -1`,
            loading: false,
          });
        } else {
          setResult({
            effectiveDifficulty: baseDifficulty,
            adjustmentReason: `Balanced (${avgAccuracy.toFixed(0)}% avg)`,
            loading: false,
          });
        }
      } catch {
        if (!cancelled) {
          setResult({ effectiveDifficulty: baseDifficulty, adjustmentReason: 'Base difficulty', loading: false });
        }
      }
    }

    evaluatePerformance();
    return () => {
      cancelled = true;
    };
  }, [songId, baseDifficulty]);

  return result;
}

export default useAdaptiveDifficulty;
