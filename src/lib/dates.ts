/**
 * Pure, UTC-safe date-string math on 'YYYY-MM-DD' values. Everything is
 * computed from the Y/M/D components via `Date.UTC`, never from a locale-
 * dependent `Date` constructor, so results don't depend on the machine's
 * timezone — important both for deterministic tests and because a day
 * count like "187 days waiting" should mean the same thing everywhere.
 */

const MS_PER_DAY = 86_400_000;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function epochDay(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / MS_PER_DAY;
}

export function addDays(date: string, days: number): string {
  const ms = (epochDay(date) + days) * MS_PER_DAY;
  return new Date(ms).toISOString().slice(0, 10);
}

/** Number of days from `from` to `to` (positive when `to` is later). */
export function diffDays(from: string, to: string): number {
  return epochDay(to) - epochDay(from);
}

export function isBefore(a: string, b: string): boolean {
  return epochDay(a) < epochDay(b);
}

export function isSameOrAfter(a: string, b: string): boolean {
  return epochDay(a) >= epochDay(b);
}

export function maxDate(a: string, b: string): string {
  return epochDay(a) >= epochDay(b) ? a : b;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatLongDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${d}, ${y}`;
}

const MONTH_ABBR = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export function formatShortDate(date: string): string {
  const [, m, d] = date.split('-').map(Number);
  return `${MONTH_ABBR[m - 1]} ${d}`;
}

/** Formats a SQL `time` string ("HH:MM" or "HH:MM:SS") as "9:20 AM". */
export function formatTime12h(time: string): string {
  const [hStr, mStr] = time.split(':');
  const hour24 = Number(hStr);
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${mStr} ${period}`;
}
