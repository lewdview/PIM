/**
 * Chart edition resolution — one place that decides which chart variant a
 * player gets. Chart Master (v6) is the default; v1 stays available to
 * everyone as "Classic"; the other editions need the chart-editions unlock.
 */

export type ChartVariant = 'v6_master' | 'v5_flagship' | 'v4_neural' | 'v3_master' | 'v1_gimmicks' | 'v2_minimal' | 'canonical';

export const DEFAULT_CHART_VARIANT: ChartVariant = 'v6_master';

/** Editions open to every player without the chart-editions unlock. */
export const OPEN_CHART_VARIANTS: ReadonlySet<string> = new Set(['v6_master', 'v1_gimmicks']);

/** Set when the player explicitly picks an edition in Options. */
export const CHART_VARIANT_CHOSEN_KEY = 'opt_chartVariant_chosen';

/**
 * Before v6, every locked player was forced onto v1_gimmicks, and that value
 * is persisted locally and in profile settings — so a stored 'v1_gimmicks'
 * only counts as a real choice once the player has picked an edition.
 */
function wasChosen(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(CHART_VARIANT_CHOSEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function resolveChartVariant(raw: string | null | undefined, editionsUnlocked: boolean): ChartVariant {
  if (!raw) return DEFAULT_CHART_VARIANT;
  if (raw === 'v1_gimmicks' && !wasChosen()) return DEFAULT_CHART_VARIANT;
  if (!editionsUnlocked && !OPEN_CHART_VARIANTS.has(raw)) return DEFAULT_CHART_VARIANT;
  return raw as ChartVariant;
}
