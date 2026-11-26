import type { BugBucket, BugCounts } from '../stats/types.ts';
import type { PairBucket } from './components/PairBars.tsx';
import { type Trend, trendLabels } from './stats-view.ts';

export function openingsTotal({ openings }: BugCounts): number {
  return openings.created + openings.reopened;
}

export function openingsText({ openings }: BugCounts): string {
  return `${String(openings.created)} created · ${String(openings.reopened)} reopened`;
}

export function reportedBuckets(
  trend: Trend<BugBucket>,
  now: Date,
): PairBucket[] {
  const labels = trendLabels(trend, now);
  return trend.buckets.map((bucket, index) => ({
    label: labels[index] ?? '',
    first: bucket.opened,
    second: bucket.bugs,
    text: `${String(bucket.opened)} reported · ${String(bucket.bugs)} fixed`,
  }));
}
