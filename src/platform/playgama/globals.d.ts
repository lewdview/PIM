// Compile-time constants from vite.config.ts `define`.
/** Month (1-12) of a monthly Playgama build; 0 for every other build. */
declare const __PIM_MONTH__: number;
/** True when the monthly build ships Bombshell artwork for perfect runs. */
declare const __PIM_BOMBSHELL__: boolean;
/** productId of the monthly build's bonus-songs bundle in the Playgama catalog. */
declare const __PIM_BONUS_PRODUCT_ID__: string;
/** Id of the monthly build's leaderboard (total of best scores), e.g. PIM_January_Score. */
declare const __PIM_LEADERBOARD_ID__: string;
