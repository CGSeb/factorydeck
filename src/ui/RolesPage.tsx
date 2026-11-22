import type { ReactElement } from 'react';
import type { Period } from '../overview/types.ts';
import type { RoleListResponse, RoleSourceFile } from '../roles/types.ts';
import { formatClock } from './format.ts';
import { UNREACHABLE_MESSAGE } from './overview-api.ts';
import { PeriodSelector } from './PeriodSelector.tsx';
import { RoleTable } from './RoleTable.tsx';
import type { LoadRoles } from './roles-api.ts';
import { useRefreshing, useSkillFilters } from './skills-api.ts';

export interface RolesPageProps {
  loadRoles: LoadRoles;
}

export function roleSourceText({ path, exists }: RoleSourceFile): string {
  return exists
    ? `Rules from ${path}`
    : `No configuration file at ${path}: default roles of the build-feature workflow.`;
}

function RolesContent({
  response,
}: {
  response: RoleListResponse | undefined;
}): ReactElement {
  if (response === undefined) return <p className="status">Loading…</p>;
  if (response.status === 'unreachable') {
    return <p className="status">{UNREACHABLE_MESSAGE}</p>;
  }
  if (response.list.apiCalls === 0) {
    return <p className="status">No activity in this period.</p>;
  }
  return <RoleTable roles={response.list.roles} />;
}

export function RolesPage({ loadRoles }: RolesPageProps): ReactElement {
  const [filters, setFilters] = useSkillFilters();
  const response = useRefreshing(JSON.stringify(filters), () =>
    loadRoles(filters),
  );
  const updatedAt =
    response?.status === 'ok' && response.updatedAt !== null
      ? formatClock(new Date(response.updatedAt))
      : undefined;

  return (
    <div className="sessions">
      <div className="overview-header">
        <h1>Roles</h1>
        {updatedAt !== undefined && (
          <p className="updated">Updated {updatedAt}</p>
        )}
        <PeriodSelector
          value={filters.period}
          onChange={(period: Period) => setFilters({ ...filters, period })}
        />
      </div>
      {response?.status === 'ok' && (
        <p className="source">{roleSourceText(response.config)}</p>
      )}
      <RolesContent response={response} />
    </div>
  );
}
