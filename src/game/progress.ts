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
  const highScores = useVaultStore.getState().highScores;
  if (Object.keys(highScores).length > 0) {
    return Object.values(highScores).reduce((sum, score) => sum + score, 0);
  }
  let total = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('hs_')) total += parseInt(localStorage.getItem(key) ?? '0', 10);
  }
  return total;
}

export function getTotalPlatinums(): number {
  const medals = useVaultStore.getState().medals;
  if (Object.keys(medals).length > 0) {
    return Object.values(medals).filter(m => m === 'PLATINUM').length;
  }
  let count = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('medal_') && localStorage.getItem(key) === 'PLATINUM') count++;
  }
  return count;
}

export function getTotalCleared(): number {
  const cleared = new Set<string>();
  const highScores = useVaultStore.getState().highScores;
  const medals = useVaultStore.getState().medals;

  if (Object.keys(highScores).length > 0 || Object.keys(medals).length > 0) {
    Object.keys(highScores).forEach(id => {
      if (highScores[id] > 0) cleared.add(id);
    });
    Object.keys(medals).forEach(id => {
      if (medals[id] && medals[id] !== '') cleared.add(id);
    });
    return cleared.size;
  }

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('medal_')) {
      const val = localStorage.getItem(key);
      if (val && val !== '') {
        cleared.add(key.substring(6));
      }
    } else if (key?.startsWith('hs_')) {
      const val = parseInt(localStorage.getItem(key) ?? '0', 10);
      if (val > 0) {
        cleared.add(key.substring(3));
      }
    }
  }
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

