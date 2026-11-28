import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { parseDocument } from 'yaml';
import { z } from 'zod';
import { expandHome } from '../config/env.ts';
import {
  captureProblem,
  markerCapture,
  markerProblem,
} from './work-item-pattern.ts';
import { UNASSIGNED_ROLE } from './types.ts';
import { DEFAULT_ROLES } from './default-roles.ts';

export const MAIN_ROLE = 'main';
export { DEFAULT_ROLES, UNASSIGNED_ROLE };

export const WORK_ITEM_SOURCES = [
  'marker',
  'description',
  'branch',
  'title',
] as const;

export type WorkItemSource = (typeof WORK_ITEM_SOURCES)[number];

export interface RoleRule {
  name: string;
  description?: RegExp | undefined;
  agentType?: RegExp | undefined;
}

export interface WorkItemRule {
  from: WorkItemSource;
  pattern: RegExp;
  capture?: number | undefined;
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
  projectRoles?: Map<string, RoleRule[]> | undefined;
}

export const DEFAULT_RULES: WorkflowRules = {
  roles: [...DEFAULT_ROLES],
  workItems: [
    {
      from: 'marker',
      pattern: /^Work item: #(\d+)(?: \((?<role>[a-z][a-z0-9-]*)\))?$/i,
      capture: 1,
    },
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

const WorkItemRuleSchema = z
  .strictObject({ from: z.enum(WORK_ITEM_SOURCES), pattern: Pattern })
  .superRefine((rule, ctx) => {
    const problem =
      rule.from === 'marker'
        ? markerProblem(rule.pattern)
        : captureProblem(rule.pattern);
    if (problem !== undefined) {
      ctx.addIssue({ code: 'custom', path: ['pattern'], message: problem });
    }
  })
  .transform((rule): WorkItemRule =>
    rule.from === 'marker'
      ? { ...rule, capture: markerCapture(rule.pattern) }
      : rule,
  );

const RulesSchema = {
  roles: z.unknown().optional(),
  work_items: z.array(WorkItemRuleSchema).optional(),
};

function projectKeyProblem(key: string): string | undefined {
  if (key.startsWith('~')) {
    return key === '~' || key.startsWith('~/')
      ? undefined
      : 'a path starting with ~ must be ~ or start with ~/';
  }
  return isAbsolute(key)
    ? undefined
    : 'must be an absolute path or start with ~';
}

const ProjectsSchema = z
  .record(z.string(), z.strictObject(RulesSchema))
  .superRefine((projects, ctx) => {
    const seen = new Map<string, string>();
    for (const key of Object.keys(projects)) {
      const problem = projectKeyProblem(key);
      if (problem !== undefined) {
        ctx.addIssue({ code: 'custom', path: [key], message: problem });
        continue;
      }
      const normalised = projectKey(key);
      const first = seen.get(normalised);
      if (first === undefined) seen.set(normalised, key);
      else {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: `same project as ${JSON.stringify(first)}`,
        });
      }
    }
  });

const FileSchema = z.strictObject({
  version: z.literal(1),
  ...RulesSchema,
  projects: ProjectsSchema.optional(),
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
      roles: DEFAULT_RULES.roles,
      workItems: file.work_items ?? DEFAULT_RULES.workItems,
    },
    projects: new Map(
      Object.entries(file.projects ?? {}).map(([key, rules]) => [
        projectKey(key),
        rules.work_items === undefined ? {} : { workItems: rules.work_items },
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
  root: string,
  project?: string,
): WorkflowRules {
  const override = config.projects.get(root);
  const projectRoles =
    project === undefined ? undefined : config.projectRoles?.get(project);
  return {
    roles: projectRoles ?? override?.roles ?? config.rules.roles,
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
  title?: string | undefined;
}

export function issueNumber(capture: string | undefined): number | null {
  if (capture === undefined || !/^\d+$/.test(capture)) return null;
  const value = Number(capture);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

export function workItemOf(
  rules: WorkflowRules,
  texts: ThreadTexts,
): number | null {
  for (const { from, pattern } of rules.workItems) {
    if (from === 'marker') continue;
    const text = texts[from];
    if (text === undefined) continue;
    const value = issueNumber(pattern.exec(text)?.[1]);
    if (value !== null) return value;
  }
  return null;
}
