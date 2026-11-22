import type { ReactElement } from 'react';
import type { Period } from '../overview/types.ts';
import type { SkillListResponse } from '../skills/types.ts';
import { PageHeader } from './components/PageHeader.tsx';
import { Panel } from './components/Panel.tsx';
import { PeriodPills } from './components/PeriodPills.tsx';
import { StatusLine } from './components/StatusLine.tsx';
import { UNREACHABLE_MESSAGE } from './overview-api.ts';
import { skillsSummary } from './skill-view.ts';
import {
  type LoadSkills,
  useRefreshing,
  useSkillFilters,
} from './skills-api.ts';
import { SkillTable } from './SkillTable.tsx';
import './skills.css';

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
  if (response === undefined) return <StatusLine>Loading…</StatusLine>;
  if (response.status === 'unreachable') {
    return <StatusLine>{UNREACHABLE_MESSAGE}</StatusLine>;
  }
  const { list } = response;
  return (
    <>
      {list.launches === 0 && (
        <StatusLine>No skills launched in this period.</StatusLine>
      )}
      <Panel>
        <SkillTable skills={list.skills} search={search} />
      </Panel>
    </>
  );
}

export function SkillsPage({ loadSkills }: SkillsPageProps): ReactElement {
  const [filters, setFilters, search] = useSkillFilters();
  const response = useRefreshing(
    JSON.stringify(filters),
    () => loadSkills(filters),
    'skills',
  );
  return (
    <div className="fd-skills">
      <PageHeader
        title="Skills"
        summary={
          response?.status === 'ok'
            ? skillsSummary(response.list.skills)
            : undefined
        }
        pending={response === undefined}
        slot={
          <PeriodPills
            value={filters.period}
            onChange={(period: Period) => setFilters({ ...filters, period })}
          />
        }
      />
      <SkillsContent response={response} search={search} />
    </div>
  );
}
