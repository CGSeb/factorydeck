import type { ReactElement } from 'react';
import { PERIOD_LABELS, PERIODS, type Period } from '../../overview/types.ts';
import './controls.css';

export { PERIOD_LABELS };

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
