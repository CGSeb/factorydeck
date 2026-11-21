import { describe, expect, it } from 'vitest';
import {
  formatBucket,
  formatClock,
  formatCost,
  formatCount,
  formatTokens,
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
