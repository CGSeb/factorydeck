import type {
  RoleList,
  RoleListResponse,
  RoleSourceFile,
  RoleUsage,
} from '../roles/types.ts';
import type { LoadRoles } from './roles-api.ts';

const PROJECTS = ['/home/dev/example-app', '/home/dev/example-lib'];

export const CONFIG_FILE: RoleSourceFile = {
  path: '/home/dev/factorydeck/factorydeck.yml',
  exists: true,
};

export const NO_CONFIG_FILE: RoleSourceFile = { ...CONFIG_FILE, exists: false };

export const someRoles: RoleUsage[] = [
  { role: 'main', threads: 4, apiCalls: 210, tokens: 8_400_000, costUsd: 12.4 },
  {
    role: 'builder',
    threads: 6,
    apiCalls: 320,
    tokens: 9_100_000,
    costUsd: 9.75,
  },
  {
    role: 'reviewer',
    threads: 5,
    apiCalls: 90,
    tokens: 2_300_000,
    costUsd: 3.1,
  },
  { role: 'Explore', threads: 3, apiCalls: 40, tokens: 610_000, costUsd: 0.42 },
  { role: 'unassigned', threads: 1, apiCalls: 2, tokens: 3_000, costUsd: null },
];

export const libRoles: RoleUsage[] = [
  { role: 'main', threads: 1, apiCalls: 12, tokens: 300_000, costUsd: 0.6 },
];

export function roleList(roles: RoleUsage[]): RoleList {
  return {
    roles,
    apiCalls: roles.reduce((sum, row) => sum + row.apiCalls, 0),
    projects: PROJECTS,
  };
}

export function rolesResponse(
  roles: RoleUsage[],
  config: RoleSourceFile = CONFIG_FILE,
): RoleListResponse {
  return {
    status: 'ok',
    updatedAt: '2026-01-07T09:41:05.000Z',
    refreshSeconds: 3600,
    list: roleList(roles),
    config,
  };
}

export function rolesLoader(
  roles: RoleUsage[],
  config: RoleSourceFile = CONFIG_FILE,
): LoadRoles {
  return (filters) =>
    Promise.resolve(
      rolesResponse(
        filters.project === '/home/dev/example-lib'
          ? libRoles
          : filters.project === undefined
            ? roles
            : [],
        config,
      ),
    );
}
