import type { ReactElement } from 'react';
import type { Period } from '../overview/types.ts';
import type {
  AutonomyResponse,
  AutonomyStats,
  FlowResponse,
  QualityResponse,
  QualityStats,
} from '../stats/types.ts';
import type { RenderLink } from './components/link.ts';
import { Panel } from './components/Panel.tsx';
import { StatFigure } from './components/StatFigure.tsx';
import { StatusLine } from './components/StatusLine.tsx';
import { TrendBars } from './components/TrendBars.tsx';
import { UNREACHABLE_MESSAGE } from './overview-api.ts';
import { FIGURE_HELP, MERGED_NOUN, REPORTED_NOUN } from './stats-help.ts';
import {
  autonomyFigures,
  comparer,
  mergedBuckets,
  mergedTitle,
  qualityFigures,
  wholePercent,
} from './stats-view.ts';
import { StatsSection } from './StatsSection.tsx';
import './overview-page.css';
import './stats-page.css';

export interface OverviewHealthProps {
  autonomy: AutonomyResponse | undefined;
  quality: QualityResponse | undefined;
  flow: FlowResponse | undefined;
  period: Period;
  statsHref: string;
  now: Date;
  renderLink?: RenderLink;
}

function Figures({
  autonomy,
  quality,
  period,
}: {
  autonomy: AutonomyStats;
  quality: QualityStats;
  period: Period;
}): ReactElement {
  const compare = comparer(period);
  const merged = autonomyFigures(autonomy.current);
  const mergedBefore =
    autonomy.previous === undefined
      ? undefined
      : autonomyFigures(autonomy.previous);
  const first = qualityFigures(quality.current);
  const firstBefore =
    quality.previous === undefined
      ? undefined
      : qualityFigures(quality.previous);
  return (
    <div className="fd-overview-health-figures">
      <StatFigure
        label="Merged without a person"
        help={FIGURE_HELP['Merged without a person']}
        value={merged.withoutPerson}
        format={wholePercent}
        kind="share"
        n={autonomy.current.merged}
        noun={MERGED_NOUN}
        better="higher"
        {...compare(mergedBefore?.withoutPerson, autonomy.previous?.merged)}
      />
      <StatFigure
        label="Right the first time"
        help={FIGURE_HELP['Right the first time']}
        value={first.firstTime}
        format={wholePercent}
        kind="share"
        n={quality.current.mergedWithReport}
        noun={REPORTED_NOUN}
        better="higher"
        {...compare(firstBefore?.firstTime, quality.previous?.mergedWithReport)}
      />
    </div>
  );
}

function Content({
  autonomy,
  quality,
  flow,
  period,
  now,
}: Omit<OverviewHealthProps, 'statsHref' | 'renderLink'>): ReactElement {
  const responses = [autonomy, quality, flow];
  if (responses.some((response) => response?.status === 'unreachable')) {
    return <StatusLine>{UNREACHABLE_MESSAGE}</StatusLine>;
  }
  if (
    autonomy?.status !== 'ok' ||
    quality?.status !== 'ok' ||
    flow?.status !== 'ok'
  ) {
    return <StatusLine>Loading…</StatusLine>;
  }
  const title = mergedTitle(flow.flow.unit);
  return (
    <div className="fd-overview-health">
      <Figures
        autonomy={autonomy.autonomy}
        quality={quality.quality}
        period={period}
      />
      <div className="fd-overview-health-trend">
        <StatsSection title={title}>
          <TrendBars
            label={title}
            buckets={mergedBuckets(flow.flow, now)}
            scale="count"
            color="var(--fd-stage-merged)"
            height={64}
          />
        </StatsSection>
      </div>
    </div>
  );
}

export function OverviewHealth({
  statsHref,
  renderLink,
  ...props
}: OverviewHealthProps): ReactElement {
  return (
    <Panel
      heading="Health"
      link={{ label: 'Stats', href: statsHref }}
      {...(renderLink === undefined ? {} : { renderLink })}
    >
      <Content {...props} />
    </Panel>
  );
}
