import type { ReactElement } from 'react';
import { agentLabel } from '../../sessions/types.ts';
import { pillStyle } from './label-styles.ts';

export function AgentTag({ agent }: { agent: string }): ReactElement {
  return (
    <span data-tone="neutral" style={pillStyle('neutral')}>
      {agentLabel(agent)}
    </span>
  );
}
