const COUNT = new Intl.NumberFormat('en-US');
const DOLLARS = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const COMPACT_UNITS = [
  { size: 1e3, suffix: 'K' },
  { size: 1e6, suffix: 'M' },
  { size: 1e9, suffix: 'B' },
  { size: 1e12, suffix: 'T' },
];

export const MISSING = '—';

export function formatCount(value: number): string {
  return COUNT.format(value);
}

export function formatAxisCost(usd: number): string {
  return `$${DOLLARS.format(usd)}`;
}

export function formatCost(usd: number | null): string {
  if (usd === null) return MISSING;
  if (usd > 0 && usd < 0.01) return '<$0.01';
  return `~$${DOLLARS.format(usd)}`;
}

export function formatTokens(value: number): string {
  if (Math.abs(value) < 1000) return String(value);
  const unit =
    COMPACT_UNITS.findLast(
      (candidate) => Math.round((value / candidate.size) * 10) / 10 >= 1,
    ) ?? COMPACT_UNITS[0];
  const size = unit?.size ?? 1e3;
  return `${(Math.round((value / size) * 10) / 10).toFixed(1)}${unit?.suffix ?? 'K'}`;
}

function twoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatClock(at: Date): string {
  return `${twoDigits(at.getHours())}:${twoDigits(at.getMinutes())}:${twoDigits(at.getSeconds())}`;
}

export function formatBucket(bucket: string): string {
  const [date = '', hour] = bucket.split('T');
  if (hour !== undefined) return hour;
  const [, month = 1, day = 1] = date.split('-').map(Number);
  return `${MONTHS[month - 1] ?? ''} ${day}`;
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export function formatAgo(at: string | null, now: Date): string {
  if (at === null) return MISSING;
  const elapsed = Math.max(0, now.getTime() - new Date(at).getTime());
  if (elapsed < MINUTE_MS) return 'just now';
  if (elapsed < HOUR_MS) return `${Math.floor(elapsed / MINUTE_MS)} min ago`;
  if (elapsed < DAY_MS) return `${Math.floor(elapsed / HOUR_MS)} h ago`;
  return `${Math.floor(elapsed / DAY_MS)} d ago`;
}

export function formatDuration(
  firstAt: string | null,
  lastAt: string | null,
): string {
  if (firstAt === null || lastAt === null) return MISSING;
  const elapsed = Math.max(
    0,
    new Date(lastAt).getTime() - new Date(firstAt).getTime(),
  );
  if (elapsed < MINUTE_MS) return `${Math.floor(elapsed / 1000)} s`;
  if (elapsed < HOUR_MS) return `${Math.floor(elapsed / MINUTE_MS)} min`;
  if (elapsed < DAY_MS) {
    return `${Math.floor(elapsed / HOUR_MS)} h ${twoDigits(Math.floor((elapsed % HOUR_MS) / MINUTE_MS))} min`;
  }
  return `${Math.floor(elapsed / DAY_MS)} d ${Math.floor((elapsed % DAY_MS) / HOUR_MS)} h`;
}

export function formatDateTime(at: string | null): string {
  if (at === null) return MISSING;
  const date = new Date(at);
  return `${MONTHS[date.getMonth()] ?? ''} ${date.getDate()}, ${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;
}

export function orMissing(value: string): string {
  return value === '' ? MISSING : value;
}

export function formatWorkItem(value: number | null): string {
  return value === null ? MISSING : `#${String(value)}`;
}
