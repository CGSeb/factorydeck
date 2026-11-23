import type { ReactElement } from 'react';
import './frictions-page.css';

export const REMOVE_FILTER = 'Remove filter';

export function FrictionFilterChip({
  text,
  onRemove,
}: {
  text: string;
  onRemove: () => void;
}): ReactElement {
  return (
    <div className="fd-friction-chips">
      <span className="fd-friction-chip">
        <span className="fd-friction-chip-text" title={text}>
          {text}
        </span>
        <button
          type="button"
          className="fd-control fd-friction-chip-remove"
          aria-label={REMOVE_FILTER}
          onClick={onRemove}
        >
          <span aria-hidden="true">×</span>
        </button>
      </span>
    </div>
  );
}
