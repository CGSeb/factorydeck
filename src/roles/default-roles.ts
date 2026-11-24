import type { RoleRule } from './config.ts';

export const DEFAULT_ROLES: readonly RoleRule[] = [
  { name: 'builder', description: /^(Build|Worker for) /i },
  { name: 'reviewer', description: /^Review /i },
  { name: 'shipper', description: /^(Ship|Merge|Push) /i },
  { name: 'reworker', description: /^(Rework|Rebase|Update) /i },
  { name: 'spec-checker', description: /check-spec/i },
  { name: 'debugger', description: /^Debug /i },
  { name: 'bug-checker', description: /check-bug/i },
];
