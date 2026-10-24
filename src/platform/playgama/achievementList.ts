/**
 * The monthly build's achievements. Plain data so vite.config.ts can write the
 * same list into playgama-bridge-config.json; the rules that earn them live in
 * achievements.ts. Ids are the same for every month (each month is its own
 * game on the portal), so a portal with native achievements maps them once.
 */
export interface AchievementDef {
  id: string;
  name: string;
  description: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_clear', name: 'First Transmission', description: 'Clear your first track' },
  { id: 'first_gold', name: 'Gold Standard', description: 'Earn a gold medal' },
  { id: 'first_platinum', name: 'Perfect Run', description: 'Earn a platinum medal' },
  { id: 'full_combo', name: 'Flawless', description: 'Full combo any track' },
  { id: 'bonus_open', name: 'Bonus Round', description: 'Earn enough platinums to open the bonus songs' },
  { id: 'chapter_clear', name: 'Chapter Clear', description: 'Clear every track of the month' },
  { id: 'epilogue', name: 'Epilogue', description: 'Clear every bonus track' },
  { id: 'deluxe_clear', name: 'Deluxe Debut', description: 'Clear a Deluxe chart' },
  { id: 'deluxe_platinum', name: 'Deluxe Perfection', description: 'Platinum on a Deluxe chart' },
  { id: 'all_gold', name: 'Golden Month', description: 'Gold or better on every track' },
  { id: 'true_ending', name: 'True Ending', description: 'Platinum on every track' },
  { id: 'bombshell_ending', name: 'Bombshell', description: 'Platinum on every track and every Deluxe chart' },
];
