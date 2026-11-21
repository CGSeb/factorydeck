import type { ReactElement } from 'react';
import { PERIODS, type Period } from '../overview/types.ts';

const LABELS: Record<Period, string> = {
  today: 'Today',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  all: 'All time',
};

export interface PeriodSelectorProps {
  value: Period;
  onChange: (period: Period) => void;
}

export function PeriodSelector({
  value,
  onChange,
}: PeriodSelectorProps): ReactElement {
  return (
    <div className="periods" role="group" aria-label="Period">
      {PERIODS.map((period) => (
        <button
          key={period}
          type="button"
          aria-pressed={period === value}
          onClick={() => onChange(period)}
        >
          {LABELS[period]}
        </button>
      ))}
    </div>
  );
}
