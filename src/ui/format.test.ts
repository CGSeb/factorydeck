import { describe, expect, it } from 'vitest';
import {
  formatActivity,
  formatAgo,
  formatBucket,
  formatClock,
  formatCost,
  formatCount,
  formatDateTime,
  formatDuration,
  formatTokens,
  formatWorkItem,
} from './format.ts';

describe('formatCost', () => {
  it('shows an estimate in US dollars with two decimals', () => {
    expect(formatCost(12.345)).toBe('~$12.35');
    expect(formatCost(1234.5)).toBe('~$1,234.50');
    expect(formatCost(0)).toBe('~$0.00');
  });

  it('shows a non-zero cost under a cent as <$0.01', () => {
    expect(formatCost(0.004)).toBe('<$0.01');
  });

  it('shows an unknown cost as —', () => {
    expect(formatCost(null)).toBe('—');
  });
});

describe('formatTokens', () => {
  it('shows token counts in compact form with one decimal', () => {
    expect(formatTokens(0)).toBe('0');
    expect(formatTokens(950)).toBe('950');
    expect(formatTokens(12_400)).toBe('12.4K');
    expect(formatTokens(12_400_000)).toBe('12.4M');
    expect(formatTokens(3_000)).toBe('3.0K');
    expect(formatTokens(2_500_000_000)).toBe('2.5B');
  });

  it('moves to the next unit when rounding reaches 1000', () => {
    expect(formatTokens(999_960)).toBe('1.0M');
    expect(formatTokens(999)).toBe('999');
  });
});

describe('formatCount', () => {
  it('separates thousands', () => {
    expect(formatCount(12_345)).toBe('12,345');
  });
});

describe('formatClock', () => {
  it('shows the local time as hh:mm:ss', () => {
    expect(formatClock(new Date(2026, 0, 5, 9, 3, 7))).toBe('09:03:07');
  });
});

describe('formatBucket', () => {
  it('shows a day as month and day, an hour as hh:00', () => {
    expect(formatBucket('2026-11-05')).toBe('Nov 5');
    expect(formatBucket('2026-11-21T14:00')).toBe('14:00');
  });
});

describe('formatAgo', () => {
  const now = new Date('2026-01-07T12:00:00Z');

  it('shows how long ago, in the largest whole unit', () => {
    expect(formatAgo('2026-01-07T11:59:30Z', now)).toBe('just now');
    expect(formatAgo('2026-01-07T11:57:00Z', now)).toBe('3 min ago');
    expect(formatAgo('2026-01-07T09:10:00Z', now)).toBe('2 h ago');
    expect(formatAgo('2026-01-02T12:00:00Z', now)).toBe('5 d ago');
  });

  it('shows — when the time is unknown', () => {
    expect(formatAgo(null, now)).toBe('—');
  });
});

describe('formatDuration', () => {
  it('shows the time from first to last record', () => {
    const from = '2026-01-07T12:00:00Z';
    expect(formatDuration(from, '2026-01-07T12:00:42Z')).toBe('42 s');
    expect(formatDuration(from, '2026-01-07T12:17:59Z')).toBe('17 min');
    expect(formatDuration(from, '2026-01-07T14:05:00Z')).toBe('2 h 05 min');
    expect(formatDuration(from, '2026-01-09T15:00:00Z')).toBe('2 d 3 h');
  });

  it('shows — when either end is unknown', () => {
    expect(formatDuration(null, '2026-01-07T12:00:00Z')).toBe('—');
  });
});

describe('formatDateTime', () => {
  it('shows a local date and time', () => {
    expect(formatDateTime(new Date(2026, 0, 7, 9, 5).toISOString())).toBe(
      '7 Jan, 09:05',
    );
    expect(formatDateTime(null)).toBe('—');
  });
});

describe('formatWorkItem', () => {
  it('shows an issue number with #, and — without one', () => {
    expect(formatWorkItem(52)).toBe('#52');
    expect(formatWorkItem(null)).toBe('—');
  });
});

describe('formatActivity', () => {
  const local = (hour: number, minute: number, second = 0, day = 24): string =>
    new Date(2026, 10, day, hour, minute, second).toISOString();
  const now = new Date(2026, 10, 24, 14, 5, 0);

  it('reads just now under one minute, even in the future', () => {
    expect(formatActivity(local(14, 4, 1), now)).toBe('just now');
    expect(formatActivity(local(14, 6), now)).toBe('just now');
  });

  it('counts whole minutes from one minute to under one hour', () => {
    expect(formatActivity(local(14, 4, 0), now)).toBe('1 min ago');
    expect(formatActivity(local(13, 5, 1), now)).toBe('59 min ago');
  });

  it('shows the time of the same local day from one hour', () => {
    expect(formatActivity(local(13, 5, 0), now)).toBe('Today, 13:05');
    expect(formatActivity(local(0, 0, 0), now)).toBe('Today, 00:00');
  });

  it('shows the day and time before local midnight', () => {
    expect(formatActivity(local(23, 59, 59, 23), now)).toBe('23 Nov, 23:59');
    expect(formatActivity(local(17, 33, 0, 22), now)).toBe('22 Nov, 17:33');
  });

  it('keeps minutes across local midnight under one hour', () => {
    const justAfterMidnight = new Date(2026, 10, 24, 0, 10, 0);
    expect(formatActivity(local(23, 50, 0, 23), justAfterMidnight)).toBe(
      '20 min ago',
    );
  });
});
