import type { ReactElement } from 'react';
import { formatCount, formatTokens } from './format.ts';

export function TokenCount({ value }: { value: number }): ReactElement {
  return <span title={formatCount(value)}>{formatTokens(value)}</span>;
}
