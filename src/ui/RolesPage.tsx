import type { CSSProperties, ReactElement } from 'react';
import type { OverviewResponse, Period } from '../overview/types.ts';
import type { RoleListResponse } from '../roles/types.ts';
import { PageHeader } from './components/PageHeader.tsx';
import { PeriodPills } from './components/PeriodPills.tsx';
import { StatusLine } from './components/StatusLine.tsx';
import { ModelTokensTable } from './ModelTokensTable.tsx';
import { type LoadOverview, UNREACHABLE_MESSAGE } from './overview-api.ts';
import { RoleTokensTable } from './RoleTokensTable.tsx';
import type { LoadRoles } from './roles-api.ts';
import {
  byTokensDescending,
  colorsOfModels,
  colorsOfRoles,
} from './roles-view.ts';
import { useRefreshing, useSkillFilters } from './skills-api.ts';

export interface RolesPageProps {
  loadRoles: LoadRoles;
  loadOverview: LoadOverview;
}

const LOADING = 'Loading…';
const NO_ACTIVITY = 'No activity in this period.';

const page: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--fd-space-6)',
};

export const ROLE_SOURCE_TEXT = 'Role rules of each project';

function ModelsContent({
  response,
}: {
  response: OverviewResponse | undefined;
}): ReactElement {
  if (response === undefined) return <StatusLine>{LOADING}</StatusLine>;
  if (response.status === 'unreachable') {
    return <StatusLine>{UNREACHABLE_MESSAGE}</StatusLine>;
  }
  const models = byTokensDescending(
    response.overview.models,
    (row) => row.model,
  );
  return <ModelTokensTable models={models} colors={colorsOfModels(models)} />;
}

function RolesContent({
  response,
  overview,
}: {
  response: RoleListResponse | undefined;
  overview: OverviewResponse | undefined;
}): ReactElement {
  if (response === undefined) return <StatusLine>{LOADING}</StatusLine>;
  if (response.status === 'unreachable') {
    return <StatusLine>{UNREACHABLE_MESSAGE}</StatusLine>;
  }
  if (response.list.apiCalls === 0) {
    return <StatusLine>{NO_ACTIVITY}</StatusLine>;
  }
  const roles = byTokensDescending(response.list.roles, (row) => row.role);
  const colors = colorsOfRoles(response.list.order, roles);
  return (
    <>
      <RoleTokensTable roles={roles} colors={colors} />
      <ModelsContent response={overview} />
    </>
  );
}

export function RolesPage({
  loadRoles,
  loadOverview,
}: RolesPageProps): ReactElement {
  const [filters, setFilters] = useSkillFilters();
  const key = JSON.stringify(filters);
  const response = useRefreshing(key, () => loadRoles(filters), 'roles');
  const overview = useRefreshing(
    key,
    () => loadOverview(filters.period, filters.project),
    'roles',
  );

  return (
    <div style={page}>
      <PageHeader
        title="Roles"
        {...(response?.status === 'ok' ? { summary: ROLE_SOURCE_TEXT } : {})}
        pending={response === undefined}
        slot={
          <PeriodPills
            value={filters.period}
            onChange={(period: Period) => setFilters({ ...filters, period })}
          />
        }
      />
      <RolesContent response={response} overview={overview} />
    </div>
  );
}
