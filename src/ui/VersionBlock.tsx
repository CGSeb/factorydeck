import type { ReactElement } from 'react';
import type { BugVersionSpan } from '../bugs/types.ts';
import { formatDateTime, formatElapsed } from './format.ts';

export const ONGOING_TEXT = 'Ongoing';

export function versionEnd(version: BugVersionSpan): {
  text: string;
  at: string | null;
} {
  if (version.reopenedAt !== null) {
    return {
      text: `Reopened ${formatDateTime(version.reopenedAt)}`,
      at: version.reopenedAt,
    };
  }
  if (version.endedAt !== null) {
    return {
      text: `Closed ${formatDateTime(version.endedAt)}`,
      at: version.endedAt,
    };
  }
  return { text: ONGOING_TEXT, at: null };
}

export function VersionBlock({
  version,
  now,
}: {
  version: BugVersionSpan | null;
  now: Date;
}): ReactElement | null {
  if (version === null || version.count < 2) return null;
  const start = formatDateTime(version.startedAt);
  const end = versionEnd(version);
  const until = end.at === null ? now.getTime() : Date.parse(end.at);
  return (
    <div className="fd-version">
      <p className="fd-summary-label">Version {version.number}</p>
      <dl className="fd-summary-list">
        <dt>Started</dt>
        <dd>
          {version.number === 1 ? `Opened ${start}` : `Reopened ${start}`}
        </dd>
        <dt>Ended</dt>
        <dd>{end.text}</dd>
        <dt>Duration</dt>
        <dd>{formatElapsed(until - Date.parse(version.startedAt))}</dd>
      </dl>
    </div>
  );
}
