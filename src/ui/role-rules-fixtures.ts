import { DEFAULT_ROLE_RULES } from '../roles/default-roles.ts';
import type {
  LoadRoleRules,
  RoleRulesView,
  SaveRoleRules,
  SaveRoleRulesOutcome,
  StoredRoleRule,
} from './role-rules-api.ts';

export const defaultRules: StoredRoleRule[] = DEFAULT_ROLE_RULES.map(
  (rule) => ({ ...rule }),
);

export const customRules: StoredRoleRule[] = [
  { name: 'implementer', description: '^Implement ', agentType: null },
  { name: 'auditor', description: 'audit', agentType: '^general-purpose$' },
  { name: 'explorer', description: null, agentType: '^Explore$' },
];

export function rulesView(
  rules: StoredRoleRule[],
  refreshSeconds = 3600,
): RoleRulesView {
  return { status: 'ok', refreshSeconds, rules };
}

export function rulesLoaderOf(view: RoleRulesView | undefined): LoadRoleRules {
  return () => Promise.resolve(view);
}

export function pendingRules(): LoadRoleRules {
  return () => new Promise<undefined>(() => undefined);
}

export function rulesSaverOf(outcome: SaveRoleRulesOutcome): SaveRoleRules {
  return () => Promise.resolve(outcome);
}

export function pendingRulesSave(): SaveRoleRules {
  return () => new Promise<SaveRoleRulesOutcome>(() => undefined);
}

export function rulesServer(initial: StoredRoleRule[]): {
  loadRoleRules: LoadRoleRules;
  saveRoleRules: SaveRoleRules;
} {
  let stored = initial;
  return {
    loadRoleRules: () => Promise.resolve(rulesView(stored)),
    saveRoleRules: (_id, rules) => {
      stored = rules.map((rule) => ({ ...rule, name: rule.name.trim() }));
      return Promise.resolve({ status: 'saved', rules: stored });
    },
  };
}
