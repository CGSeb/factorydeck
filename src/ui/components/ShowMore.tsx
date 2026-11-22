import type { ReactElement } from 'react';
import './controls.css';

export interface ShowMoreProps {
  shown: number;
  total: number;
  onShowMore: () => void;
}

export function ShowMore({
  shown,
  total,
  onShowMore,
}: ShowMoreProps): ReactElement | null {
  if (shown >= total) return null;
  return (
    <div className="fd-show-more">
      <span className="fd-show-more-count">
        {shown} of {total}
      </span>
      <button type="button" className="fd-control" onClick={onShowMore}>
        Show more
      </button>
    </div>
  );
}
