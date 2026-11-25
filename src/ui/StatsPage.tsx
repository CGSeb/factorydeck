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
import { FIGURE_HELP, MERGED_NOUN, REPORTED_NOUN } from './stats-help.ts';
import { StatusLine } from './components/StatusLine.tsx';
import { TrendBars } from './components/TrendBars.tsx';
import { formatElapsed } from './format.ts';
import { UNREACHABLE_MESSAGE } from './overview-api.ts';
import { KIND_PARAM, useKindParam } from './kind-filter.ts';
import { KindFilter } from './KindFilter.tsx';
import { useSkillFilters } from './skills-api.ts';
import {
  type StatsLoaders,
  showsBugsPanel,
  useStatsData,
} from './stats-loading.ts';
import {
  autonomyFigures,
  autonomySummary,
  comparer,
  oneDecimal,
  autonomyBuckets,
  qualityBuckets,
  qualityFigures,
  reasonRows,
  roundsLine,
  signedPoints,
  trendTitle,
  waitingNote,
  wholePercent,
} from './stats-view.ts';
import { StatsBugsPanel } from './StatsBugsPanel.tsx';
import { StatsFlowPanel } from './StatsFlowPanel.tsx';
import { StatsSection } from './StatsSection.tsx';
import './stats-page.css';

export interface StatsPageProps extends StatsLoaders {
  now?: Date | undefined;
}

const LOADING = 'Loading…';
const TREND_BASE = 'Merged without a person';
const REASONS_TITLE = 'Why a person stepped in';
const ANSWERED_NOUN = { one: 'answered stop', other: 'answered stops' };
const QUALITY_TREND_BASE = 'Right the first time';
const HISTOGRAM_TITLE = 'First serenity score';
const REVIEWED_NOUN = {
  one: 'merged issue reviewed twice or more',
  other: 'merged issues reviewed twice or more',
};
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
        help={FIGURE_HELP['Merged without a person']}
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
        help={FIGURE_HELP['Spec questions']}
        value={now.specQuestions}
        format={wholePercent}
        kind="share"
        n={current.merged}
        noun={MERGED_NOUN}
        better="lower"
        {...compare(before?.specQuestions, previous?.merged)}
      />
      <StatFigure
        label="Waiting for a person"
        help={FIGURE_HELP['Waiting for a person']}
        value={now.waiting}
        format={formatElapsed}
        kind="amount"
        n={current.stopWaitsMs.length}
        noun={ANSWERED_NOUN}
        better="lower"
        {...compare(before?.waiting, previous?.stopWaitsMs.length)}
        {...(note === undefined ? {} : { note })}
      />
    </div>
  );
}

function AutonomyContent({
  response,
  period,
  now,
}: {
  response: AutonomyResponse | undefined;
  period: Period;
  now: Date;
}): ReactElement {
  if (response === undefined) return <StatusLine>{LOADING}</StatusLine>;
  if (response.status === 'unreachable') {
    return <StatusLine>{UNREACHABLE_MESSAGE}</StatusLine>;
  }
  const { autonomy } = response;
  const trend = trendTitle(TREND_BASE, autonomy.unit);
  return (
    <div className="fd-stats-autonomy">
      <Figures autonomy={autonomy} period={period} />
      <StatsSection title={trend}>
        <TrendBars
          label={trend}
          buckets={autonomyBuckets(autonomy, now)}
          scale="share"
          color="var(--fd-stage-merged)"
          height={64}
        />
      </StatsSection>
      <StatsSection title={REASONS_TITLE}>
        {autonomy.reasons.total === 0 ? (
          <p className="fd-stats-note">No person had to step in.</p>
        ) : (
          <>
            <CountBars
              rows={reasonRows(autonomy.reasons)}
              total={autonomy.reasons.total}
              noun={HELPED_NOUN}
            />
            <p className="fd-stats-rounds">{roundsLine(autonomy.reasons)}</p>
          </>
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
    <div className="fd-stats-figures">
      <StatFigure
        label="Right the first time"
        help={FIGURE_HELP['Right the first time']}
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
        help={FIGURE_HELP['Review rounds']}
        value={now.rounds}
        format={oneDecimal}
        kind="amount"
        n={current.roundsCount}
        noun={MERGED_NOUN}
        better="lower"
        {...compare(before?.rounds, previous?.roundsCount)}
      />
      <StatFigure
        label="Score gain"
        help={FIGURE_HELP['Score gain']}
        value={now.gain}
        format={signedPoints}
        kind="points"
        n={current.gainCount}
        noun={REVIEWED_NOUN}
        better="higher"
        {...compare(before?.gain, previous?.gainCount)}
      />
    </div>
  );
}

function QualityContent({
  response,
  period,
  now,
}: {
  response: QualityResponse | undefined;
  period: Period;
  now: Date;
}): ReactElement {
  if (response === undefined) return <StatusLine>{LOADING}</StatusLine>;
  if (response.status === 'unreachable') {
    return <StatusLine>{UNREACHABLE_MESSAGE}</StatusLine>;
  }
  const { quality } = response;
  const trend = trendTitle(QUALITY_TREND_BASE, quality.unit);
  return (
    <div className="fd-stats-quality">
      <QualityFiguresRow quality={quality} period={period} />
      <StatsSection title={trend}>
        <TrendBars
          label={trend}
          buckets={qualityBuckets(quality, now)}
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
  now = new Date(),
  ...loaders
}: StatsPageProps): ReactElement {
  const [filters, setFilters] = useSkillFilters([KIND_PARAM]);
  const [wanted, setKind] = useKindParam();
  const data = useStatsData(loaders, filters, wanted);
  const { autonomy: response, quality, flow, bugs, kind } = data;
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
        {...(bugs?.status === 'ok' && bugs.bugs.bugTickets
          ? {
              controls: (
                <KindFilter
                  kinds={bugs.bugs.kinds}
                  value={kind}
                  onChange={setKind}
                />
              ),
            }
          : {})}
      />
      <Panel heading="Autonomy">
        <AutonomyContent
          response={response}
          period={filters.period}
          now={now}
        />
      </Panel>
      <Panel heading="Quality">
        <QualityContent response={quality} period={filters.period} now={now} />
      </Panel>
      <StatsFlowPanel
        response={flow}
        period={filters.period}
        now={now}
        kind={kind}
      />
      {showsBugsPanel(data) && (
        <StatsBugsPanel response={bugs} period={filters.period} now={now} />
      )}
    </div>
  );
}
