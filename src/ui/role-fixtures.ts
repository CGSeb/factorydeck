import type { RoleList, RoleListResponse, RoleUsage } from '../roles/types.ts';
import type { ModelUsage, OverviewResponse } from '../overview/types.ts';
import { okResponse, weekOverview } from './fixtures.ts';
import type { LoadOverview } from './overview-api.ts';
import type { LoadRoles } from './roles-api.ts';
import { optionsOf } from './project-fixtures.ts';
import { splitTokens } from './token-fixtures.ts';

const PROJECTS = ['/home/dev/example-app', '/home/dev/example-lib'];

export const someRoles: RoleUsage[] = [
  {
    role: 'main',
    threads: 4,
    apiCalls: 210,
    tokens: 8_400_000,
    tokenCounts: splitTokens(8_400_000),
    costUsd: 12.4,
  },
  {
    role: 'builder',
    threads: 6,
    apiCalls: 320,
    tokens: 9_100_000,
    tokenCounts: splitTokens(9_100_000),
    costUsd: 9.75,
  },
  {
    role: 'reviewer',
    threads: 5,
    apiCalls: 90,
    tokens: 2_300_000,
    tokenCounts: splitTokens(2_300_000),
    costUsd: 3.1,
  },
  {
    role: 'Explore',
    threads: 3,
    apiCalls: 40,
    tokens: 610_000,
    tokenCounts: splitTokens(610_000),
    costUsd: 0.42,
  },
  {
    role: 'unassigned',
    threads: 1,
    apiCalls: 2,
    tokens: 3_000,
    tokenCounts: splitTokens(3_000),
    costUsd: null,
  },
];

export const libRoles: RoleUsage[] = [
  {
    role: 'main',
    threads: 1,
    apiCalls: 12,
    tokens: 300_000,
    tokenCounts: splitTokens(300_000),
    costUsd: 0.6,
  },
];

export const DEFAULT_ORDER = ['builder', 'reviewer', 'shipper'];

export const customRoles: RoleUsage[] = [
  {
    role: 'main',
    threads: 2,
    apiCalls: 80,
    tokens: 1_200_000,
    tokenCounts: splitTokens(1_200_000),
    costUsd: 2.1,
  },
  {
    role: 'editor',
    threads: 3,
    apiCalls: 60,
    tokens: 2_600_000,
    tokenCounts: splitTokens(2_600_000),
    costUsd: 3.4,
  },
  {
    role: 'writer',
    threads: 0,
    apiCalls: 4,
    tokens: 90_000,
    tokenCounts: splitTokens(90_000),
    costUsd: 0.2,
  },
];

export const CUSTOM_ORDER = ['writer', 'editor'];

export function roleList(
  roles: RoleUsage[],
  order: string[] = DEFAULT_ORDER,
): RoleList {
  return {
    roles,
    order,
    apiCalls: roles.reduce((sum, row) => sum + row.apiCalls, 0),
    projects: optionsOf(PROJECTS),
  };
}

export function rolesResponse(
  roles: RoleUsage[],
  order: string[] = DEFAULT_ORDER,
): RoleListResponse {
  return {
    status: 'ok',
    updatedAt: '2026-01-07T09:41:05.000Z',
    refreshSeconds: 3600,
    list: roleList(roles, order),
  };
}

export function rolesLoader(
  roles: RoleUsage[],
  order: string[] = DEFAULT_ORDER,
): LoadRoles {
  return (filters) =>
    Promise.resolve(
      rolesResponse(
        filters.project === '/home/dev/example-lib'
          ? libRoles
          : filters.project === undefined
            ? roles
            : [],
        order,
      ),
    );
}

function model(name: string, apiCalls: number, tokens: number): ModelUsage {
  return {
    model: name,
    apiCalls,
    tokens,
    tokenCounts: splitTokens(tokens),
    costUsd: name === '' ? null : tokens / 1_000_000,
  };
}

export const someModels: ModelUsage[] = [
  model('claude-sonnet-example', 402, 5_413_000),
  model('claude-opus-example', 260, 15_000_000),
];

export const oneModel: ModelUsage[] = [
  model('claude-opus-example', 662, 20_413_000),
];

export function modelsResponse(models: ModelUsage[]): OverviewResponse {
  const apiCalls = models.reduce((sum, row) => sum + row.apiCalls, 0);
  return okResponse({
    ...weekOverview,
    totals: { ...weekOverview.totals, apiCalls },
    models,
  });
}

export function modelsLoader(models: ModelUsage[]): LoadOverview {
  return () => Promise.resolve(modelsResponse(models));
}
