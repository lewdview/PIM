export interface MonthMediaEntry {
  kind: 'audio' | 'cover' | 'bombshell';
  day: number;
  remote: string;
  aliases: string[];
  local: string;
}
export function monthDays(month: number, dayFileMap: Record<string, unknown>): number[];
export function bombshellFileForDay(day: number, bombshellMap: Record<string, unknown>): string | null;
export function monthMediaEntries(
  month: number,
  dayFileMap: Record<string, unknown>,
  bombshellMap: Record<string, unknown>,
  withBombshell: boolean,
): MonthMediaEntry[];
