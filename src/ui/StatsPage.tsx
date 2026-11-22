import { type ReactElement, useId } from 'react';
import type { Period } from '../overview/types.ts';
import type { AutonomyResponse, AutonomyStats } from '../stats/types.ts';
import { CountBars } from './components/CountBars.tsx';
import { PageHeader } from './components/PageHeader.tsx';
import { Panel } from './components/Panel.tsx';
import { PeriodPills } from './components/PeriodPills.tsx';
import { StatFigure } from './components/StatFigure.tsx';
import { StatusLine } from './components/StatusLine.tsx';
import { TrendBars } from './components/TrendBars.tsx';
import { formatElapsed } from './format.ts';
import { UNREACHABLE_MESSAGE } from './overview-api.ts';
import { useRefreshing, useSkillFilters } from './skills-api.ts';
import type { LoadAutonomy } from './stats-api.ts';
import {
  autonomyFigures,
  autonomySummary,
  comparisonText,
  reasonRows,
  waitingNote,
  weekBuckets,
  wholePercent,
} from './stats-view.ts';
import './stats-page.css';

export interface StatsPageProps {
  loadAutonomy: LoadAutonomy;
}

const LOADING = 'Loading…';
const TREND_TITLE = 'Merged without a person, by week';
const REASONS_TITLE = 'Why a person stepped in';
const MERGED_NOUN = { one: 'merged issue', other: 'merged issues' };
const ANSWERED_NOUN = { one: 'answered question', other: 'answered questions' };
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
  const comparison = comparisonText(period);
  const compare = (
    value: number | null | undefined,
    n: number | undefined,
  ): {
    previous?: number | null;
    previousN?: number;
    comparison?: string;
  } =>
    comparison === undefined || value === undefined || n === undefined
      ? {}
      : { previous: value, previousN: n, comparison };
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
        value={current.merged === 0 ? null : now.waiting}
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

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactElement;
}): ReactElement {
  const id = useId();
  return (
    <section className="fd-stats-section" aria-labelledby={id}>
      <h3 id={id} className="fd-stats-section-title">
        {title}
      </h3>
      {children}
    </section>
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
      <Section title={TREND_TITLE}>
        <TrendBars
          label={TREND_TITLE}
          buckets={weekBuckets(autonomy.weeks)}
          scale="share"
          color="var(--fd-stage-merged)"
          height={64}
        />
      </Section>
      <Section title={REASONS_TITLE}>
        {autonomy.reasons.total === 0 ? (
          <p className="fd-stats-note">No person had to step in.</p>
        ) : (
          <CountBars
            rows={reasonRows(autonomy.reasons)}
            total={autonomy.reasons.total}
            noun={HELPED_NOUN}
          />
        )}
      </Section>
    </div>
  );
}

export function StatsPage({ loadAutonomy }: StatsPageProps): ReactElement {
  const [filters, setFilters] = useSkillFilters();
  const response = useRefreshing(
    JSON.stringify(filters),
    () => loadAutonomy(filters),
    'stats',
  );
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
    </div>
  );
}
