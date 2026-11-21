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
