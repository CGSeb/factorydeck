import type { RoleRule } from './config.ts';

export interface StoredRoleRule {
  name: string;
  description: string | null;
  agentType: string | null;
}

export const DEFAULT_ROLE_RULES: readonly StoredRoleRule[] = [
  { name: 'builder', description: '^(Build|Worker for) ', agentType: null },
  { name: 'reviewer', description: '^Review ', agentType: null },
  { name: 'shipper', description: '^(Ship|Merge|Push) ', agentType: null },
  {
    name: 'reworker',
    description: '^(Rework|Rebase|Update) ',
    agentType: null,
  },
  { name: 'spec-checker', description: 'check-spec', agentType: null },
  { name: 'debugger', description: '^Debug ', agentType: null },
  { name: 'bug-checker', description: 'check-bug', agentType: null },
];

function patternOf(source: string | null): RegExp | undefined {
  return source === null ? undefined : new RegExp(source, 'i');
}

export function compiledRoleRule(rule: StoredRoleRule): RoleRule {
  return {
    name: rule.name,
    description: patternOf(rule.description),
    agentType: patternOf(rule.agentType),
  };
}

export const DEFAULT_ROLES: readonly RoleRule[] =
  DEFAULT_ROLE_RULES.map(compiledRoleRule);
