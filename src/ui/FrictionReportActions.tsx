import type { ReactElement } from 'react';
import type { FrictionsResponse } from '../frictions/types.ts';
import { formatAgo } from './format.ts';
import {
  COPY_AND_MARK,
  FrictionReportButton,
  type ReportBlock,
} from './FrictionReportButton.tsx';
import './frictions-page.css';

export const LAST_REPORT = 'Last report';

export function lastReportText(at: string | null, now: Date): string {
  return at === null ? '' : `${LAST_REPORT} ${formatAgo(at, now)}`;
}

export interface MarkedReport {
  project: string;
  at: string;
}

export function lastReportOf(
  response: FrictionsResponse | undefined,
  project: string | undefined,
  marked: MarkedReport | undefined,
): string | null {
  if (project === undefined) return null;
  const loaded =
    response?.status === 'ok' ? response.frictions.lastReportAt : null;
  if (marked?.project !== project) return loaded;
  return loaded === null || Date.parse(marked.at) > Date.parse(loaded)
    ? marked.at
    : loaded;
}

export interface FrictionReportActionsProps {
  blocked: ReportBlock;
  onCopy: () => Promise<void>;
  onMark: () => Promise<void>;
  lastReportAt: string | null;
  now: Date;
}

export function FrictionReportActions({
  blocked,
  onCopy,
  onMark,
  lastReportAt,
  now,
}: FrictionReportActionsProps): ReactElement {
  return (
    <div className="fd-friction-actions">
      <div className="fd-friction-report-buttons">
        <FrictionReportButton blocked={blocked} onCopy={onCopy} />
        <FrictionReportButton
          label={COPY_AND_MARK}
          blocked={blocked}
          onCopy={onMark}
        />
      </div>
      <p className="fd-friction-last-report">
        {lastReportText(lastReportAt, now)}
      </p>
    </div>
  );
}
