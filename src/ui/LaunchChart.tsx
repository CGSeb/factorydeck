import { type ReactElement, useId } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { LaunchPoint } from '../skills/types.ts';
import { formatBucket, formatCount } from './format.ts';

export function LaunchChart({
  series,
}: {
  series: LaunchPoint[];
}): ReactElement {
  const titleId = useId();
  return (
    <section className="panel" aria-labelledby={titleId}>
      <h2 id={titleId}>Launches per day</h2>
      <ResponsiveContainer
        width="100%"
        height={240}
        initialDimension={{ width: 800, height: 240 }}
      >
        <BarChart
          data={series}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <CartesianGrid vertical={false} stroke="#e3e5e8" />
          <XAxis dataKey="day" tickFormatter={formatBucket} />
          <YAxis allowDecimals={false} tickFormatter={formatCount} width={40} />
          <Tooltip
            formatter={(value) => formatCount(Number(value))}
            labelFormatter={(label) =>
              typeof label === 'string' ? formatBucket(label) : ''
            }
          />
          <Bar
            dataKey="launches"
            name="Launches"
            fill="#2f6fd0"
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </section>
  );
}
