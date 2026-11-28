import {
  DEFAULT_CONFIG,
  type RoleRule,
  type WorkflowConfig,
} from '../roles/config.ts';
import { compiledRoleRule } from '../roles/default-roles.ts';

export function roleRule(
  name: string,
  description: string | null,
  agentType: string | null = null,
): RoleRule {
  return compiledRoleRule({ name, description, agentType });
}

export function withRoles(
  roles: RoleRule[],
  projects: Record<string, RoleRule[]> = {},
  config: WorkflowConfig = DEFAULT_CONFIG,
): WorkflowConfig {
  const byRoot = new Map(config.projects);
  for (const [root, list] of Object.entries(projects)) {
    byRoot.set(root, { ...byRoot.get(root), roles: list });
  }
  return { ...config, rules: { ...config.rules, roles }, projects: byRoot };
}
