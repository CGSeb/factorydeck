import type { ReactElement } from 'react';
import { PERIODS, type Period } from '../../overview/types.ts';
import './controls.css';

export const PERIOD_LABELS: Record<Period, string> = {
  today: 'Today',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  all: 'All time',
};

export interface PeriodPillsProps {
  value: Period;
  onChange: (period: Period) => void;
}

export function PeriodPills({
  value,
  onChange,
}: PeriodPillsProps): ReactElement {
  return (
    <div className="fd-pills" role="group" aria-label="Period">
      {PERIODS.map((period) => (
        <button
          key={period}
          type="button"
          className="fd-control fd-pill"
          aria-pressed={period === value}
          onClick={() => {
            if (period !== value) onChange(period);
          }}
        >
          {PERIOD_LABELS[period]}
        </button>
      ))}
    </div>
  );
}
