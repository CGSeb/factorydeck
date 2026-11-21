import { type ReactElement, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import {
  DEFAULT_PERIOD,
  type OverviewResponse,
  type Period,
  isPeriod,
} from '../overview/types.ts';
import { CostChart } from './CostChart.tsx';
import { formatClock } from './format.ts';
import { ModelTable } from './ModelTable.tsx';
import { type LoadOverview, UNREACHABLE_MESSAGE } from './overview-api.ts';
import { PeriodSelector } from './PeriodSelector.tsx';
import { ProjectTable } from './ProjectTable.tsx';
import { UsageTiles } from './UsageTiles.tsx';

const RETRY_SECONDS = 10;

export interface OverviewPageProps {
  loadOverview: LoadOverview;
}

function OverviewContent({
  response,
}: {
  response: OverviewResponse | undefined;
}): ReactElement {
  if (response === undefined) return <p className="status">Loading…</p>;
  if (response.status === 'unreachable') {
    return <p className="status">{UNREACHABLE_MESSAGE}</p>;
  }
  const { overview } = response;
  if (!overview.hasData) {
    return (
      <p className="status">
        No sessions yet. FactoryDeck reads {response.sessionsFolder}.
      </p>
    );
  }
  return (
    <>
      <UsageTiles totals={overview.totals} />
      <CostChart bucket={overview.bucket} series={overview.series} />
      <div className="tables">
        <ProjectTable projects={overview.projects} />
        <ModelTable models={overview.models} />
      </div>
    </>
  );
}

export function OverviewPage({
  loadOverview,
}: OverviewPageProps): ReactElement {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('period');
  const period: Period = isPeriod(requested) ? requested : DEFAULT_PERIOD;
  const [loaded, setLoaded] = useState<{
    period: Period;
    response: OverviewResponse;
  }>();
  const response = loaded?.period === period ? loaded.response : undefined;

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function refresh(): Promise<void> {
      const next = await loadOverview(period);
      if (!active) return;
      if (next !== undefined) setLoaded({ period, response: next });
      timer = setTimeout(
        () => void refresh(),
        (next?.refreshSeconds ?? RETRY_SECONDS) * 1000,
      );
    }
    void refresh();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [loadOverview, period]);

  const updatedAt =
    response?.status === 'ok' && response.updatedAt !== null
      ? formatClock(new Date(response.updatedAt))
      : undefined;

  return (
    <div className="overview">
      <div className="overview-header">
        <h1>Overview</h1>
        {updatedAt !== undefined && (
          <p className="updated">Updated {updatedAt}</p>
        )}
        <PeriodSelector
          value={period}
          onChange={(next) => setSearchParams({ period: next })}
        />
      </div>
      <OverviewContent response={response} />
    </div>
  );
}
