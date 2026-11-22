export interface DesignToken {
  name: string;
  value: string;
}

const DECLARATION = /(--fd-[\w-]+)\s*:\s*([^;]+);/g;

export function parseTokens(css: string): DesignToken[] {
  return [...css.matchAll(DECLARATION)].map(([, name = '', value = '']) => ({
    name,
    value: value.replaceAll(/\s+/g, ' ').trim(),
  }));
}

export function tokenValues(css: string): Map<string, string> {
  return new Map(parseTokens(css).map(({ name, value }) => [name, value]));
}

const COLOR_VALUE = /^(?:#|rgba?\()/;

export function colorTokens(tokens: DesignToken[]): DesignToken[] {
  return tokens.filter(({ value }) => COLOR_VALUE.test(value));
}
