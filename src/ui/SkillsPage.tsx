import type { ReactElement } from 'react';
import type { Period } from '../overview/types.ts';
import type { SkillListResponse } from '../skills/types.ts';
import { formatClock } from './format.ts';
import { UNREACHABLE_MESSAGE } from './overview-api.ts';
import { PeriodSelector } from './PeriodSelector.tsx';
import { ProjectSelect } from './ProjectSelect.tsx';
import {
  type LoadSkills,
  useRefreshing,
  useSkillFilters,
} from './skills-api.ts';
import { SkillTable } from './SkillTable.tsx';

export interface SkillsPageProps {
  loadSkills: LoadSkills;
}

function SkillsContent({
  response,
  search,
}: {
  response: SkillListResponse | undefined;
  search: string;
}): ReactElement {
  if (response === undefined) return <p className="status">Loading…</p>;
  if (response.status === 'unreachable') {
    return <p className="status">{UNREACHABLE_MESSAGE}</p>;
  }
  const { list } = response;
  return (
    <>
      {list.launches === 0 && (
        <p className="status">No skills launched in this period.</p>
      )}
      <SkillTable skills={list.skills} search={search} />
    </>
  );
}

export function SkillsPage({ loadSkills }: SkillsPageProps): ReactElement {
  const [filters, setFilters, search] = useSkillFilters();
  const response = useRefreshing(JSON.stringify(filters), () =>
    loadSkills(filters),
  );
  const updatedAt =
    response?.status === 'ok' && response.updatedAt !== null
      ? formatClock(new Date(response.updatedAt))
      : undefined;

  return (
    <div className="sessions">
      <div className="overview-header">
        <h1>Skills</h1>
        {updatedAt !== undefined && (
          <p className="updated">Updated {updatedAt}</p>
        )}
        <PeriodSelector
          value={filters.period}
          onChange={(period: Period) => setFilters({ ...filters, period })}
        />
      </div>
      <div className="filters">
        <ProjectSelect
          value={filters.project}
          projects={response?.status === 'ok' ? response.list.projects : []}
          onChange={(project) => setFilters({ ...filters, project })}
        />
      </div>
      <SkillsContent response={response} search={search} />
    </div>
  );
}
