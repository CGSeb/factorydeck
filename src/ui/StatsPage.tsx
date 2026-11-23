import type { ReactElement } from 'react';
import type { Period } from '../overview/types.ts';
import type {
  AutonomyResponse,
  AutonomyStats,
  QualityResponse,
  QualityStats,
} from '../stats/types.ts';
import { CountBars } from './components/CountBars.tsx';
import { PageHeader } from './components/PageHeader.tsx';
import { Panel } from './components/Panel.tsx';
import { PeriodPills } from './components/PeriodPills.tsx';
import { ScoreHistogram } from './components/ScoreHistogram.tsx';
import { StatFigure } from './components/StatFigure.tsx';
import { StatusLine } from './components/StatusLine.tsx';
import { TrendBars } from './components/TrendBars.tsx';
import { formatElapsed } from './format.ts';
import { UNREACHABLE_MESSAGE } from './overview-api.ts';
import { useRefreshing, useSkillFilters } from './skills-api.ts';
import type { LoadAutonomy, LoadFlow, LoadQuality } from './stats-api.ts';
import {
  autonomyFigures,
  autonomySummary,
  comparer,
  oneDecimal,
  qualityFigures,
  qualityWeekBuckets,
  reasonRows,
  waitingNote,
  weekBuckets,
  wholePercent,
} from './stats-view.ts';
import { StatsFlowPanel } from './StatsFlowPanel.tsx';
import { StatsSection } from './StatsSection.tsx';
import './stats-page.css';

export interface StatsPageProps {
  loadAutonomy: LoadAutonomy;
  loadQuality: LoadQuality;
  loadFlow: LoadFlow;
}

const LOADING = 'Loading…';
const TREND_TITLE = 'Merged without a person, by week';
const REASONS_TITLE = 'Why a person stepped in';
const MERGED_NOUN = { one: 'merged issue', other: 'merged issues' };
const ANSWERED_NOUN = { one: 'answered question', other: 'answered questions' };
const QUALITY_TREND_TITLE = 'Right the first time, by week';
const HISTOGRAM_TITLE = 'First serenity score';
const REPORTED_NOUN = {
  one: 'merged issue with a report',
  other: 'merged issues with a report',
};
const ENDED_NOUN = { one: 'ended issue', other: 'ended issues' };
const HELPED_NOUN = {
  one: 'merged issue helped by a person',
  other: 'merged issues helped by a person',
};

function Figures({
  autonomy,
  period,
}: {
  autonomy: AutonomyStats;
  period: Period;
}): ReactElement {
  const { current, previous } = autonomy;
  const now = autonomyFigures(current);
  const before = previous === undefined ? undefined : autonomyFigures(previous);
  const compare = comparer(period);
  const note = waitingNote(autonomy.waitingNow);
  return (
    <div className="fd-stats-figures">
      <StatFigure
        label="Merged without a person"
        value={now.withoutPerson}
        format={wholePercent}
        kind="share"
        n={current.merged}
        noun={MERGED_NOUN}
        better="higher"
        {...compare(before?.withoutPerson, previous?.merged)}
      />
      <StatFigure
        label="Spec questions"
        value={now.specQuestions}
        format={wholePercent}
        kind="share"
        n={current.merged}
        noun={MERGED_NOUN}
        better="lower"
        {...compare(before?.specQuestions, previous?.merged)}
      />
      <StatFigure
        label="Waiting for an answer"
        value={now.waiting}
        format={formatElapsed}
        kind="amount"
        n={current.answeredWaitsMs.length}
        noun={ANSWERED_NOUN}
        better="lower"
        {...compare(before?.waiting, previous?.answeredWaitsMs.length)}
        {...(note === undefined ? {} : { note })}
      />
    </div>
  );
}

function AutonomyContent({
  response,
  period,
}: {
  response: AutonomyResponse | undefined;
  period: Period;
}): ReactElement {
  if (response === undefined) return <StatusLine>{LOADING}</StatusLine>;
  if (response.status === 'unreachable') {
    return <StatusLine>{UNREACHABLE_MESSAGE}</StatusLine>;
  }
  const { autonomy } = response;
  return (
    <div className="fd-stats-autonomy">
      <Figures autonomy={autonomy} period={period} />
      <StatsSection title={TREND_TITLE}>
        <TrendBars
          label={TREND_TITLE}
          buckets={weekBuckets(autonomy.weeks)}
          scale="share"
          color="var(--fd-stage-merged)"
          height={64}
        />
      </StatsSection>
      <StatsSection title={REASONS_TITLE}>
        {autonomy.reasons.total === 0 ? (
          <p className="fd-stats-note">No person had to step in.</p>
        ) : (
          <CountBars
            rows={reasonRows(autonomy.reasons)}
            total={autonomy.reasons.total}
            noun={HELPED_NOUN}
          />
        )}
      </StatsSection>
    </div>
  );
}

function QualityFiguresRow({
  quality,
  period,
}: {
  quality: QualityStats;
  period: Period;
}): ReactElement {
  const { current, previous } = quality;
  const now = qualityFigures(current);
  const before = previous === undefined ? undefined : qualityFigures(previous);
  const compare = comparer(period);
  return (
    <div className="fd-stats-figures fd-stats-figures-four">
      <StatFigure
        label="Right the first time"
        value={now.firstTime}
        format={wholePercent}
        kind="share"
        n={current.mergedWithReport}
        noun={REPORTED_NOUN}
        better="higher"
        {...compare(before?.firstTime, previous?.mergedWithReport)}
      />
      <StatFigure
        label="Review rounds"
        value={now.rounds}
        format={oneDecimal}
        kind="amount"
        n={current.roundsCount}
        noun={MERGED_NOUN}
        better="lower"
        {...compare(before?.rounds, previous?.roundsCount)}
      />
      <StatFigure
        label="Reworked"
        value={now.reworked}
        format={wholePercent}
        kind="share"
        n={current.merged}
        noun={MERGED_NOUN}
        better="lower"
        {...compare(before?.reworked, previous?.merged)}
      />
      <StatFigure
        label="Closed without merge"
        value={now.closedWithoutMerge}
        format={wholePercent}
        kind="share"
        n={current.ended}
        noun={ENDED_NOUN}
        better="lower"
        {...compare(before?.closedWithoutMerge, previous?.ended)}
      />
    </div>
  );
}

function QualityContent({
  response,
  period,
}: {
  response: QualityResponse | undefined;
  period: Period;
}): ReactElement {
  if (response === undefined) return <StatusLine>{LOADING}</StatusLine>;
  if (response.status === 'unreachable') {
    return <StatusLine>{UNREACHABLE_MESSAGE}</StatusLine>;
  }
  const { quality } = response;
  return (
    <div className="fd-stats-quality">
      <QualityFiguresRow quality={quality} period={period} />
      <StatsSection title={QUALITY_TREND_TITLE}>
        <TrendBars
          label={QUALITY_TREND_TITLE}
          buckets={qualityWeekBuckets(quality.weeks)}
          scale="share"
          color="var(--fd-stage-merged)"
          height={64}
        />
      </StatsSection>
      <StatsSection title={HISTOGRAM_TITLE}>
        <ScoreHistogram
          label={HISTOGRAM_TITLE}
          reports={quality.firstReports}
        />
      </StatsSection>
    </div>
  );
}

export function StatsPage({
  loadAutonomy,
  loadQuality,
  loadFlow,
}: StatsPageProps): ReactElement {
  const [filters, setFilters] = useSkillFilters();
  const key = JSON.stringify(filters);
  const response = useRefreshing(key, () => loadAutonomy(filters), 'stats');
  const quality = useRefreshing(key, () => loadQuality(filters), 'stats');
  const flow = useRefreshing(key, () => loadFlow(filters), 'stats');
  return (
    <div className="fd-stats">
      <PageHeader
        title="Stats"
        {...(response?.status === 'ok'
          ? { summary: autonomySummary(response.autonomy.current) }
          : {})}
        pending={response === undefined}
        slot={
          <PeriodPills
            value={filters.period}
            onChange={(period: Period) => setFilters({ ...filters, period })}
          />
        }
      />
      <Panel heading="Autonomy">
        <AutonomyContent response={response} period={filters.period} />
      </Panel>
      <Panel heading="Quality">
        <QualityContent response={quality} period={filters.period} />
      </Panel>
      <StatsFlowPanel response={flow} period={filters.period} />
    </div>
  );
}
