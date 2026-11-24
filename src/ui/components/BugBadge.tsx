import type { ReactElement } from 'react';
import { pillStyle } from './label-styles.ts';

export function BugBadge(): ReactElement {
  return (
    <span
      className="fd-bug-badge"
      data-tone="danger"
      style={pillStyle('danger')}
    >
      Bug
    </span>
  );
}
