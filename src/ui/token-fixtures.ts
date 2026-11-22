import type { TokenCounts } from '../overview/types.ts';

export function splitTokens(tokens: number): TokenCounts {
  const input = Math.round(tokens * 0.05);
  const output = Math.round(tokens * 0.03);
  const cacheWrite = Math.round(tokens * 0.12);
  return {
    input,
    output,
    cacheWrite,
    cacheRead: tokens - input - output - cacheWrite,
  };
}
