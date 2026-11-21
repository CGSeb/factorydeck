import { type ReactElement, useId } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  FAMILIES,
  type Family,
  type UsageOverview,
} from '../overview/types.ts';
import { formatAxisCost, formatBucket, formatCost } from './format.ts';

const COLORS: Record<Family, string> = {
  opus: '#6d4fc2',
  sonnet: '#2f6fd0',
  haiku: '#1a9a8a',
  other: '#9aa0a8',
};

export type CostChartProps = Pick<UsageOverview, 'bucket' | 'series'>;

export function CostChart({ bucket, series }: CostChartProps): ReactElement {
  const titleId = useId();
  return (
    <section className="panel" aria-labelledby={titleId}>
      <h2 id={titleId}>
        {bucket === 'hour' ? 'Cost per hour' : 'Cost per day'}
      </h2>
      <ResponsiveContainer
        width="100%"
        height={280}
        initialDimension={{ width: 800, height: 280 }}
      >
        <BarChart
          data={series}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <CartesianGrid vertical={false} stroke="#e3e5e8" />
          <XAxis dataKey="bucket" tickFormatter={formatBucket} />
          <YAxis tickFormatter={formatAxisCost} width={56} />
          <Tooltip
            formatter={(value) => formatCost(Number(value))}
            labelFormatter={(label) =>
              typeof label === 'string' ? formatBucket(label) : ''
            }
          />
          <Legend itemSorter={null} />
          {FAMILIES.map((family) => (
            <Bar
              key={family}
              dataKey={family}
              name={family}
              stackId="cost"
              fill={COLORS[family]}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </section>
  );
}
