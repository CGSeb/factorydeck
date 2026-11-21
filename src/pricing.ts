const MILLION = 1_000_000;

/** Token counts reported by one Claude API call. */
export interface TokenUsage {
  input: number;
  cacheWrite: number;
  cacheRead: number;
  output: number;
}

interface Rates {
  family: string;
  input: number;
  cacheWrite: number;
  cacheRead: number;
  output: number;
}

/** API list prices in US dollars per million tokens. */
const RATES: readonly Rates[] = [
  { family: 'opus', input: 4, cacheWrite: 5, cacheRead: 0.2, output: 20 },
  { family: 'sonnet', input: 2, cacheWrite: 2.5, cacheRead: 0.1, output: 10 },
  {
    family: 'haiku',
    input: 0.1,
    cacheWrite: 0.125,
    cacheRead: 0.01,
    output: 0.5,
  },
];

/** Returns the model family (`opus`, `sonnet`, `haiku`) of a model id, if known. */
export function modelFamily(model: string): string | undefined {
  const id = model.toLowerCase();
  return RATES.find((rates) => id.includes(rates.family))?.family;
}

/**
 * Cost in US dollars of one call at API list prices.
 * Returns `undefined` for a model whose price is unknown.
 */
export function costOf(model: string, usage: TokenUsage): number | undefined {
  const family = modelFamily(model);
  const rates = RATES.find((candidate) => candidate.family === family);
  if (rates === undefined) {
    return undefined;
  }
  return (
    (usage.input * rates.input +
      usage.cacheWrite * rates.cacheWrite +
      usage.cacheRead * rates.cacheRead +
      usage.output * rates.output) /
    MILLION
  );
}
