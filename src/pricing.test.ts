import { describe, expect, it } from 'vitest';
import { costOf, modelFamily } from './pricing.ts';

const oneMillionEach = {
  input: 1_000_000,
  cacheWrite: 1_000_000,
  cacheRead: 1_000_000,
  output: 1_000_000,
};

describe('modelFamily', () => {
  it('recognises the family whatever the version', () => {
    expect(modelFamily('claude-opus-5-5')).toBe('opus');
    expect(modelFamily('claude-sonnet-5-5')).toBe('sonnet');
    expect(modelFamily('Claude-Haiku-5-5')).toBe('haiku');
  });

  it('returns undefined for an unknown model', () => {
    expect(modelFamily('<synthetic>')).toBeUndefined();
  });
});

describe('costOf', () => {
  it('adds the four token kinds at their own rate', () => {
    expect(costOf('claude-opus-5-5', oneMillionEach)).toBeCloseTo(29.2);
    expect(costOf('claude-sonnet-5-5', oneMillionEach)).toBeCloseTo(14.6);
    expect(costOf('claude-haiku-5-5', oneMillionEach)).toBeCloseTo(0.735);
  });

  it('prices a cache read far below a fresh input', () => {
    const read = costOf('claude-opus-5-5', { ...zero(), cacheRead: 100_000 });
    const fresh = costOf('claude-opus-5-5', { ...zero(), input: 100_000 });
    expect(read).toBeCloseTo(0.02);
    expect(fresh).toBeCloseTo(0.4);
  });

  it('returns undefined when the price is unknown', () => {
    expect(costOf('gpt-5', oneMillionEach)).toBeUndefined();
  });
});

function zero(): {
  input: number;
  cacheWrite: number;
  cacheRead: number;
  output: number;
} {
  return { input: 0, cacheWrite: 0, cacheRead: 0, output: 0 };
}
