// Day calculation logic — Day 1 = January 1, 2026
const EPOCH = new Date('2026-01-01T00:00:00');

const MONTHS = [
  { name: 'january', start: 1, end: 31 },
  { name: 'february', start: 32, end: 59 },
  { name: 'march', start: 60, end: 90 },
  { name: 'april', start: 91, end: 120 },
  { name: 'may', start: 121, end: 151 },
  { name: 'june', start: 152, end: 181 },
  { name: 'july', start: 182, end: 212 },
  { name: 'august', start: 213, end: 243 },
  { name: 'september', start: 244, end: 273 },
  { name: 'october', start: 274, end: 304 },
  { name: 'november', start: 305, end: 334 },
  { name: 'december', start: 335, end: 365 },
] as const;

export function getCurrentDay(): number {
  const now = new Date();
  const diff = now.getTime() - EPOCH.getTime();
  const day = Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, Math.min(365, day));
}

export function getMonthFromDay(day: number): string {
  for (const m of MONTHS) {
    if (day >= m.start && day <= m.end) return m.name;
  }
  return 'january';
}

export function getRelativeDay(day: number): number {
  for (const m of MONTHS) {
    if (day >= m.start && day <= m.end) return day - m.start + 1;
  }
  return day;
}

export function getDateFromDay(day: number): Date {
  const date = new Date(EPOCH);
  date.setDate(date.getDate() + day - 1);
  return date;
}

export function formatDate(day: number): string {
  const date = getDateFromDay(day);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function getTimeUntilNextDay(): { hours: number; minutes: number; seconds: number } {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setHours(24, 0, 0, 0);
  const diff = tomorrow.getTime() - now.getTime();

  return {
    hours: Math.floor(diff / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((diff % (1000 * 60)) / 1000),
  };
}

export function getDayFromDate(dateInput: Date | string): number {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const diff = d.getTime() - EPOCH.getTime();
  const day = Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, Math.min(365, day));
}

