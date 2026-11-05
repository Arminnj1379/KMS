const dateFormat = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' });
const dayFormat = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' });
const relativeFormat = new Intl.RelativeTimeFormat('fa-IR', { numeric: 'auto' });

const MINUTE = 60;
const HOUR = 3600;
const DAY = 86400;

function toDate(input: string | Date): Date {
  return typeof input === 'string' ? new Date(input) : input;
}

export function formatFaDate(input: string | Date): string {
  return dateFormat.format(toDate(input));
}

export function formatFaDay(input: string | Date): string {
  return dayFormat.format(toDate(input));
}

/** "۵ دقیقه پیش" for recent moments, calendar date once a week has passed. */
export function formatFaRelative(input: string | Date, now: number = Date.now()): string {
  const d = toDate(input);
  const seconds = Math.round((d.getTime() - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < MINUTE) return relativeFormat.format(0, 'second');
  if (abs < HOUR) return relativeFormat.format(Math.round(seconds / MINUTE), 'minute');
  if (abs < DAY) return relativeFormat.format(Math.round(seconds / HOUR), 'hour');
  if (abs < 7 * DAY) return relativeFormat.format(Math.round(seconds / DAY), 'day');
  return dayFormat.format(d);
}

export function formatFaNumber(n: number): string {
  return new Intl.NumberFormat('fa-IR').format(n);
}

export function formatFaSize(bytes: number): string {
  if (bytes < 1024) return `${formatFaNumber(bytes)} B`;
  if (bytes < 1024 * 1024) return `${formatFaNumber(Number((bytes / 1024).toFixed(1)))} KB`;
  return `${formatFaNumber(Number((bytes / 1024 / 1024).toFixed(1)))} MB`;
}
