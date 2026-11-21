import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { parseDocument } from 'yaml';
import { z } from 'zod';
import { expandHome } from '../config/env.ts';

export const MAIN_ROLE = 'main';
export const UNASSIGNED_ROLE = 'unassigned';

export const WORK_ITEM_SOURCES = ['description', 'branch', 'title'] as const;

export type WorkItemSource = (typeof WORK_ITEM_SOURCES)[number];

export interface RoleRule {
  name: string;
  description?: RegExp | undefined;
  agentType?: RegExp | undefined;
}

export interface WorkItemRule {
  from: WorkItemSource;
  pattern: RegExp;
}

export interface WorkflowRules {
  roles: RoleRule[];
  workItems: WorkItemRule[];
}

export interface WorkflowConfig {
  path: string;
  exists: boolean;
  rules: WorkflowRules;
  projects: Map<string, Partial<WorkflowRules>>;
}

export const DEFAULT_RULES: WorkflowRules = {
  roles: [],
  workItems: [
    { from: 'description', pattern: /#(\d+)/i },
    { from: 'title', pattern: /#(\d+)/i },
  ],
};

export const DEFAULT_CONFIG: WorkflowConfig = {
  path: '',
  exists: false,
  rules: DEFAULT_RULES,
  projects: new Map(),
};

export class WorkflowConfigError extends Error {}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function captureGroups(pattern: RegExp): number {
  return (new RegExp(`${pattern.source}|`).exec('')?.length ?? 1) - 1;
}

const Pattern = z.string().transform((value, ctx) => {
  try {
    return new RegExp(value, 'i');
  } catch (error) {
    ctx.addIssue({
      code: 'custom',
      message: `not a valid regular expression: ${errorText(error)}`,
    });
    return z.NEVER;
  }
});

const WorkItemPattern = Pattern.superRefine((pattern, ctx) => {
  const groups = captureGroups(pattern);
  if (groups !== 1) {
    ctx.addIssue({
      code: 'custom',
      message: `needs exactly one capture group, found ${String(groups)}`,
    });
  }
});

const RoleName = z
  .string()
  .min(1)
  .refine((name) => name !== MAIN_ROLE && name !== UNASSIGNED_ROLE, {
    message: `"${MAIN_ROLE}" and "${UNASSIGNED_ROLE}" are reserved role names`,
  });

const RoleRuleSchema = z
  .strictObject({
    name: RoleName,
    description: Pattern.optional(),
    agent_type: Pattern.optional(),
  })
  .superRefine((rule, ctx) => {
    if (rule.description === undefined && rule.agent_type === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'needs description, agent_type or both',
      });
    }
  })
  .transform((rule): RoleRule => ({
    name: rule.name,
    description: rule.description,
    agentType: rule.agent_type,
  }));

const WorkItemRuleSchema = z.strictObject({
  from: z.enum(WORK_ITEM_SOURCES),
  pattern: WorkItemPattern,
});

const RulesSchema = {
  roles: z.array(RoleRuleSchema).optional(),
  work_items: z.array(WorkItemRuleSchema).optional(),
};

const FileSchema = z.strictObject({
  version: z.literal(1),
  ...RulesSchema,
  projects: z
    .record(
      z.string().refine((key) => key.startsWith('~') || isAbsolute(key), {
        message: 'must be an absolute path or start with ~',
      }),
      z.strictObject(RulesSchema),
    )
    .optional(),
});

export function projectKey(path: string): string {
  const expanded = expandHome(path);
  return expanded.length > 1 ? expanded.replace(/\/+$/, '') : expanded;
}

function keyPath(path: readonly PropertyKey[]): string {
  let text = '';
  for (const key of path) {
    if (typeof key === 'number') text += `[${String(key)}]`;
    else if (typeof key === 'string' && /^[A-Za-z_]\w*$/.test(key)) {
      text += text === '' ? key : `.${key}`;
    } else text += `[${JSON.stringify(String(key))}]`;
  }
  return text === '' ? '(file)' : text;
}

function issueLines(issues: readonly z.core.$ZodIssue[]): string[] {
  return issues.flatMap((issue) => {
    if (issue.code === 'unrecognized_keys') {
      return issue.keys.map(
        (key) => `  ${keyPath([...issue.path, key])}: unknown key`,
      );
    }
    if (issue.code === 'invalid_key') {
      return issue.issues.map(
        (inner) => `  ${keyPath(issue.path)}: ${inner.message}`,
      );
    }
    return [`  ${keyPath(issue.path)}: ${issue.message}`];
  });
}

function invalid(path: string, lines: string[]): WorkflowConfigError {
  return new WorkflowConfigError(
    `Invalid configuration in ${path}:\n${lines.join('\n')}`,
  );
}

export function parseWorkflowConfig(
  text: string,
  path: string,
): WorkflowConfig {
  const document = parseDocument(text);
  if (document.errors.length > 0) {
    throw invalid(
      path,
      document.errors.map(
        (error) => `  (yaml) ${error.message.split('\n')[0] ?? ''}`,
      ),
    );
  }
  const parsed = FileSchema.safeParse(document.toJS());
  if (!parsed.success) throw invalid(path, issueLines(parsed.error.issues));
  const file = parsed.data;
  return {
    path,
    exists: true,
    rules: {
      roles: file.roles ?? DEFAULT_RULES.roles,
      workItems: file.work_items ?? DEFAULT_RULES.workItems,
    },
    projects: new Map(
      Object.entries(file.projects ?? {}).map(([key, rules]) => [
        projectKey(key),
        {
          ...(rules.roles === undefined ? {} : { roles: rules.roles }),
          ...(rules.work_items === undefined
            ? {}
            : { workItems: rules.work_items }),
        },
      ]),
    ),
  };
}

export function loadWorkflowConfig(path: string): WorkflowConfig {
  if (!existsSync(path)) return { ...DEFAULT_CONFIG, path };
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch (error) {
    throw invalid(path, [`  (file) ${errorText(error)}`]);
  }
  return parseWorkflowConfig(text, path);
}

export function rulesFor(
  config: WorkflowConfig,
  project: string,
): WorkflowRules {
  const override = config.projects.get(project);
  return {
    roles: override?.roles ?? config.rules.roles,
    workItems: override?.workItems ?? config.rules.workItems,
  };
}

export function roleOf(
  rules: WorkflowRules,
  agent: { agentType: string; description: string },
): string {
  const rule = rules.roles.find(
    ({ description, agentType }) =>
      (description === undefined || description.test(agent.description)) &&
      (agentType === undefined || agentType.test(agent.agentType)),
  );
  if (rule !== undefined) return rule.name;
  return agent.agentType === '' ? UNASSIGNED_ROLE : agent.agentType;
}

export interface ThreadTexts {
  description?: string | undefined;
  branch: string;
  title: string;
}

export function workItemOf(
  rules: WorkflowRules,
  texts: ThreadTexts,
): number | null {
  for (const { from, pattern } of rules.workItems) {
    const text = texts[from];
    if (text === undefined) continue;
    const capture = pattern.exec(text)?.[1];
    if (capture === undefined || !/^\d+$/.test(capture)) continue;
    const value = Number(capture);
    if (Number.isSafeInteger(value) && value > 0) return value;
  }
  return null;
}
