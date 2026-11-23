import type { ReactElement } from 'react';
import type { Period } from '../overview/types.ts';
import type { FlowResponse, FlowStats } from '../stats/types.ts';
import { Panel } from './components/Panel.tsx';
import { RangeStrip } from './components/RangeStrip.tsx';
import { StatFigure } from './components/StatFigure.tsx';
import { StatusLine } from './components/StatusLine.tsx';
import { TrendBars } from './components/TrendBars.tsx';
import { formatElapsed, formatTokens } from './format.ts';
import { UNREACHABLE_MESSAGE } from './overview-api.ts';
import { StatsSection } from './StatsSection.tsx';
import {
  comparer,
  flowFigures,
  mergedWeekBuckets,
  stripItems,
  tokenShares,
  wholePercent,
} from './stats-view.ts';

const LOADING = 'Loading…';
const MERGED_NOUN = { one: 'merged issue', other: 'merged issues' };
const WORKED_NOUN = {
  one: 'merged issue with agent work',
  other: 'merged issues with agent work',
};
const CALL_NOUN = { one: 'API call', other: 'API calls' };
const MERGED_WEEKS_TITLE = 'Merged per week';
const LEAD_TITLE = 'Lead time';
const TOKENS_TITLE = 'Tokens per merged issue';
const WENT_TITLE = 'Where the tokens went';

function FlowFigures({
  flow,
  period,
}: {
  flow: FlowStats;
  period: Period;
}): ReactElement {
  const now = flowFigures(flow.current.issues);
  const before =
    flow.previous === undefined ? undefined : flowFigures(flow.previous.issues);
  const compare = comparer(period);
  return (
    <div className="fd-stats-figures">
      <StatFigure
        label="Lead time"
        value={now.lead.value}
        format={formatElapsed}
        kind="amount"
        n={now.lead.n}
        noun={MERGED_NOUN}
        better="lower"
        {...compare(before?.lead.value, before?.lead.n)}
      />
      <StatFigure
        label="Cycle time"
        value={now.cycle.value}
        format={formatElapsed}
        kind="amount"
        n={now.cycle.n}
        noun={WORKED_NOUN}
        better="lower"
        {...compare(before?.cycle.value, before?.cycle.n)}
      />
      <StatFigure
        label="Tokens per merged issue"
        value={now.tokens.value}
        format={formatTokens}
        kind="amount"
        n={now.tokens.n}
        noun={WORKED_NOUN}
        better="lower"
        {...compare(before?.tokens.value, before?.tokens.n)}
      />
    </div>
  );
}

function TokenFigures({
  flow,
  period,
}: {
  flow: FlowStats;
  period: Period;
}): ReactElement {
  const { tokens } = flow.current;
  const now = tokenShares(tokens);
  const previous = flow.previous?.tokens;
  const before = previous === undefined ? undefined : tokenShares(previous);
  const compare = comparer(period);
  const calls = previous?.apiCalls;
  return (
    <div className="fd-stats-figures">
      <StatFigure
        label="Tokens on dropped work"
        value={now.droppedWork}
        format={wholePercent}
        kind="share"
        n={tokens.apiCalls}
        noun={CALL_NOUN}
        better="lower"
        {...compare(before?.droppedWork, calls)}
      />
      <StatFigure
        label="No work item"
        value={now.noWorkItem}
        format={wholePercent}
        kind="share"
        n={tokens.apiCalls}
        noun={CALL_NOUN}
        better="lower"
        {...compare(before?.noWorkItem, calls)}
      />
      <StatFigure
        label="Cache reads"
        value={now.cacheReads}
        format={wholePercent}
        kind="share"
        n={tokens.apiCalls}
        noun={CALL_NOUN}
        better="higher"
        {...compare(before?.cacheReads, calls)}
      />
    </div>
  );
}

function FlowContent({
  response,
  period,
}: {
  response: FlowResponse | undefined;
  period: Period;
}): ReactElement {
  if (response === undefined) return <StatusLine>{LOADING}</StatusLine>;
  if (response.status === 'unreachable') {
    return <StatusLine>{UNREACHABLE_MESSAGE}</StatusLine>;
  }
  const { flow } = response;
  const { issues } = flow.current;
  return (
    <div className="fd-stats-flow">
      <StatsSection title={MERGED_WEEKS_TITLE}>
        <TrendBars
          label={MERGED_WEEKS_TITLE}
          buckets={mergedWeekBuckets(flow.weeks)}
          scale="count"
          color="var(--fd-stage-merged)"
          height={64}
        />
      </StatsSection>
      <FlowFigures flow={flow} period={period} />
      <StatsSection title={LEAD_TITLE}>
        <RangeStrip
          label={LEAD_TITLE}
          items={stripItems(issues, (issue) => issue.leadMs, period)}
          format={formatElapsed}
        />
      </StatsSection>
      <StatsSection title={TOKENS_TITLE}>
        <RangeStrip
          label={TOKENS_TITLE}
          items={stripItems(issues, (issue) => issue.tokens, period)}
          format={formatTokens}
        />
      </StatsSection>
      <StatsSection title={WENT_TITLE}>
        <TokenFigures flow={flow} period={period} />
      </StatsSection>
    </div>
  );
}

export function StatsFlowPanel({
  response,
  period,
}: {
  response: FlowResponse | undefined;
  period: Period;
}): ReactElement {
  return (
    <Panel heading="Flow and cost">
      <FlowContent response={response} period={period} />
    </Panel>
  );
}
