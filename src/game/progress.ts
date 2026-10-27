import { useVaultStore } from '../store/useVaultStore';

// ── medal/score persistence ──────────────────────────────────────
const MEDAL_ORDER = ['', 'NONE', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM'] as const;

export function getMedalForSong(songId: string): string {
  const storeMedal = useVaultStore.getState().medals[songId];
  if (storeMedal !== undefined) return storeMedal;
  return localStorage.getItem(`medal_${songId}`) ?? '';
}

export function saveMedal(songId: string, medal: string): void {
  const current = getMedalForSong(songId);
  if (MEDAL_ORDER.indexOf(medal as any) > MEDAL_ORDER.indexOf(current as any)) {
    localStorage.setItem(`medal_${songId}`, medal);
    useVaultStore.getState().syncMedal(songId, medal);
  }
}

export function getHighScore(songId: string): number {
  const storeScore = useVaultStore.getState().highScores[songId];
  if (storeScore !== undefined) return storeScore;
  return parseInt(localStorage.getItem(`hs_${songId}`) ?? '0', 10);
}

export function saveHighScore(songId: string, score: number, accuracy = 0, maxCombo = 0, medal = 'NONE', telemetry?: any): void {
  const current = getHighScore(songId);
  if (score > current) {
    localStorage.setItem(`hs_${songId}`, String(score));
    if (telemetry) {
      localStorage.setItem(`telemetry_${songId}`, JSON.stringify(telemetry));
    }
    useVaultStore.getState().syncHighScore(songId, score, accuracy, maxCombo, medal, telemetry);
  }
}

export function getSongScore(songId: string): number {
  return getHighScore(songId);
}

export function getTotalScore(): number {
  const highScores = useVaultStore.getState().highScores || {};
  return Object.values(highScores).reduce((sum, score) => sum + (score ?? 0), 0);
}

export function getTotalPlatinums(): number {
  const medals = useVaultStore.getState().medals || {};
  return Object.values(medals).filter(m => m === 'PLATINUM').length;
}

export function getTotalCleared(): number {
  const cleared = new Set<string>();
  const highScores = useVaultStore.getState().highScores || {};
  const medals = useVaultStore.getState().medals || {};

  Object.keys(highScores).forEach(id => {
    if (highScores[id] > 0) cleared.add(id);
  });
  Object.keys(medals).forEach(id => {
    if (medals[id] && medals[id] !== '') cleared.add(id);
  });
  return cleared.size;
}

export function getChapterPlatinums(songIds: string[]): number {
  return songIds.filter(id => getMedalForSong(id) === 'PLATINUM').length;
}

export function getChapterCleared(songIds: string[]): number {
  return songIds.filter(id => {
    const m = getMedalForSong(id);
    const hs = getHighScore(id);
    return (m && m !== '') || hs > 0;
  }).length;
}

export function saveScoreHistory(songId: string, score: number): void {
  const h = getScoreHistory(songId);
  h.unshift(score);
  localStorage.setItem(`scores_${songId}`, JSON.stringify(h.slice(0, 10)));
}

export function getScoreHistory(songId: string): number[] {
  try { return JSON.parse(localStorage.getItem(`scores_${songId}`) ?? '[]'); }
  catch { return []; }
}


// ── campaign progress ────────────────────────────────────────────
// Campaign clears are kept apart from on-demand plays (collection, codex,
// award play, search): only a passed run launched from a chapter, at the
// campaign's own difficulty, unlocks the next stage. Any saved key means the
// stage is cleared (a pass with medal NONE still counts).
interface CampaignRecord { medal: string; score: number }

const campaignKey = (songId: string) => `campaign_clear_${songId}`;
const CAMPAIGN_SEEDED_KEY = 'campaign_progress_seeded_v1';

export function getCampaignRecord(songId: string): CampaignRecord | null {
  seedCampaignProgressOnce();
  try {
    const raw = localStorage.getItem(campaignKey(songId));
    return raw ? (JSON.parse(raw) as CampaignRecord) : null;
  } catch { return null; }
}

export function hasCampaignClear(songId: string): boolean {
  return getCampaignRecord(songId) !== null;
}

export function getCampaignMedal(songId: string): string {
  return getCampaignRecord(songId)?.medal ?? '';
}

export function saveCampaignClear(songId: string, medal: string, score: number): void {
  const cur = getCampaignRecord(songId);
  const better = !cur || MEDAL_ORDER.indexOf(medal as any) > MEDAL_ORDER.indexOf(cur.medal as any);
  const next: CampaignRecord = {
    medal: better ? medal : cur!.medal,
    score: Math.max(score, cur?.score ?? 0),
  };
  if (cur && cur.medal === next.medal && cur.score === next.score) return;
  try { localStorage.setItem(campaignKey(songId), JSON.stringify(next)); } catch { /* ignore */ }
  // Signed-in players also persist to Supabase (no-op for guests).
  useVaultStore.getState().syncCampaignClear(songId, next.medal, next.score);
}

export function getCampaignPlatinums(songIds: string[]): number {
  return songIds.filter(id => getCampaignMedal(id) === 'PLATINUM').length;
}

export function getCampaignCleared(songIds: string[]): number {
  return songIds.filter(hasCampaignClear).length;
}

/**
 * One-time carry-over from before campaign progress was tracked separately,
 * so returning players keep the stages they had already opened. Runs on the
 * first campaign read after vault data has loaded.
 */
let seeding = false;
export function seedCampaignProgressOnce(): void {
  if (seeding) return;
  try {
    if (localStorage.getItem(CAMPAIGN_SEEDED_KEY)) return;
    if (!useVaultStore.getState().hasLoadedData) return;
    seeding = true;
    const { medals = {}, highScores = {} } = useVaultStore.getState();
    const ids = new Set<string>([...Object.keys(medals), ...Object.keys(highScores)]);
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith('medal_')) ids.add(k.slice(6));
    }
    ids.forEach(id => {
      const medal = getMedalForSong(id);
      const score = getHighScore(id);
      if (!hasCampaignClear(id) && ((medal && medal !== '') || score > 0)) {
        saveCampaignClear(id, medal || 'NONE', score);
      }
    });
    localStorage.setItem(CAMPAIGN_SEEDED_KEY, '1');
  } catch { /* ignore */ } finally { seeding = false; }
}
