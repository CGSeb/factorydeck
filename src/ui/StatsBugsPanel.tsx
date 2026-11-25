import type { ReactElement } from 'react';
import type { Period } from '../overview/types.ts';
import type { BugResponse, BugStats } from '../stats/types.ts';
import { Panel } from './components/Panel.tsx';
import { RangeStrip } from './components/RangeStrip.tsx';
import { StatFigure } from './components/StatFigure.tsx';
import { StatusLine } from './components/StatusLine.tsx';
import { TrendBars } from './components/TrendBars.tsx';
import { formatElapsed } from './format.ts';
import { UNREACHABLE_MESSAGE } from './overview-api.ts';
import { FIGURE_HELP, MERGED_NOUN } from './stats-help.ts';
import {
  bugBuckets,
  bugFigures,
  comparer,
  stripItems,
  trendTitle,
  wholePercent,
} from './stats-view.ts';
import { StatsSection } from './StatsSection.tsx';

const LOADING = 'Loading…';
const BUG_NOUN = { one: 'merged bug', other: 'merged bugs' };
const FIX_TITLE = 'Time to fix';
const SHARE_BASE = 'Bugs in delivered work';

function BugFiguresRow({
  bugs,
  period,
}: {
  bugs: BugStats;
  period: Period;
}): ReactElement {
  const { current, previous } = bugs;
  const now = bugFigures(current);
  const before = previous === undefined ? undefined : bugFigures(previous);
  const compare = comparer(period);
  return (
    <div className="fd-stats-figures">
      <StatFigure
        label="Time to fix"
        help={FIGURE_HELP['Time to fix']}
        value={now.fix}
        format={formatElapsed}
        kind="amount"
        n={current.bugs}
        noun={BUG_NOUN}
        better="lower"
        {...compare(before?.fix, previous?.bugs)}
      />
      <StatFigure
        label="Bugs in delivered work"
        help={FIGURE_HELP['Bugs in delivered work']}
        value={now.share}
        format={wholePercent}
        kind="share"
        n={current.merged}
        noun={MERGED_NOUN}
        better="lower"
        {...compare(before?.share, previous?.merged)}
      />
      <StatFigure
        label="Reopened bugs"
        help={FIGURE_HELP['Reopened bugs']}
        value={now.reopened}
        format={wholePercent}
        kind="share"
        n={current.bugs}
        noun={BUG_NOUN}
        better="lower"
        {...compare(before?.reopened, previous?.bugs)}
      />
    </div>
  );
}

function BugsContent({
  response,
  period,
  now,
}: {
  response: BugResponse | undefined;
  period: Period;
  now: Date;
}): ReactElement {
  if (response === undefined) return <StatusLine>{LOADING}</StatusLine>;
  if (response.status === 'unreachable') {
    return <StatusLine>{UNREACHABLE_MESSAGE}</StatusLine>;
  }
  const { bugs } = response;
  const trend = trendTitle(SHARE_BASE, bugs.unit);
  return (
    <div className="fd-stats-bugs">
      <BugFiguresRow bugs={bugs} period={period} />
      <StatsSection title={FIX_TITLE}>
        <RangeStrip
          label={FIX_TITLE}
          items={stripItems(bugs.issues, (issue) => issue.fixMs, period)}
          format={formatElapsed}
        />
      </StatsSection>
      <StatsSection title={trend}>
        <TrendBars
          label={trend}
          buckets={bugBuckets(bugs, now)}
          scale="share"
          color="var(--fd-danger)"
          height={64}
        />
      </StatsSection>
    </div>
  );
}

export function StatsBugsPanel({
  response,
  period,
  now = new Date(),
}: {
  response: BugResponse | undefined;
  period: Period;
  now?: Date | undefined;
}): ReactElement {
  return (
    <Panel heading="Bugs">
      <BugsContent response={response} period={period} now={now} />
    </Panel>
  );
}
