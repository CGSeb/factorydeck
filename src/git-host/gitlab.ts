import { gitlabChecks } from './checks.ts';
import type { RunCli } from './command.ts';
import { reportHistory } from './report.ts';
import {
  type GitHostReader,
  type Json,
  PAGE_SIZE,
  byNumber,
  field,
  labelColor,
  list,
  object,
  objects,
  positive,
  requiredTime,
  text,
  time,
} from './parse.ts';
import type {
  IssueLabel,
  IssueRecord,
  LabelEvent,
  RequestRecord,
  RequestState,
} from './types.ts';

type Colors = Map<string, string | null>;

function labelsOf(value: unknown, colors: Colors): IssueLabel[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((label: unknown) => {
    const name = typeof label === 'string' ? label : text(field(label, 'name'));
    if (name === '') return [];
    const own = labelColor(field(label, 'color'));
    return [{ name, color: own ?? colors.get(name) ?? null }];
  });
}

export interface IssueEvents {
  reopened: boolean;
  labelEvents: LabelEvent[];
}

export function gitlabIssue(
  row: Json,
  colors: Colors,
  now: string,
  events: ReadonlyMap<number, IssueEvents> = new Map(),
): IssueRecord | undefined {
  const number = positive(row['iid']);
  if (number === undefined) return undefined;
  const createdAt = requiredTime(row['created_at'], now);
  return {
    number,
    title: text(row['title']),
    state: text(row['state']) === 'closed' ? 'closed' : 'open',
    labels: labelsOf(row['labels'], colors),
    url: text(row['web_url']),
    createdAt,
    closedAt: time(row['closed_at']),
    updatedAt: requiredTime(row['updated_at'], createdAt),
    reopened: events.get(number)?.reopened ?? false,
    labelEvents: events.get(number)?.labelEvents ?? [],
  };
}

export function gitlabLabelEvents(rows: readonly Json[]): LabelEvent[] {
  return rows.flatMap((row) => {
    const action = text(row['action']);
    const label = text(field(row['label'], 'name'));
    const at = time(row['created_at']);
    if (label === '' || at === null) return [];
    if (action !== 'add' && action !== 'remove') return [];
    return [{ label, added: action === 'add', at }];
  });
}

function requestState(value: unknown): RequestState {
  const state = text(value);
  if (state === 'merged') return 'merged';
  if (state === 'closed' || state === 'locked') return 'closed';
  return 'open';
}

function closesOf(value: unknown, projectId: unknown): number[] {
  const numbers = list(value).flatMap((issue) => {
    const number = positive(issue['iid']);
    const otherProject =
      projectId !== undefined &&
      issue['project_id'] !== undefined &&
      issue['project_id'] !== projectId;
    return number === undefined || otherProject ? [] : [number];
  });
  return [...new Set(numbers)].sort((a, b) => a - b);
}

export function gitlabRequest(
  row: Json,
  closes: unknown,
  now: string,
  notes: unknown = [],
): RequestRecord | undefined {
  const number = positive(row['iid']);
  if (number === undefined) return undefined;
  const createdAt = requiredTime(row['created_at'], now);
  return {
    number,
    title: text(row['title']),
    state: requestState(row['state']),
    draft: row['draft'] === true || row['work_in_progress'] === true,
    headBranch: text(row['source_branch']),
    url: text(row['web_url']),
    createdAt,
    mergedAt: time(row['merged_at']),
    closedAt: time(row['closed_at']),
    updatedAt: requiredTime(row['updated_at'], createdAt),
    closes: closesOf(closes, row['target_project_id'] ?? row['project_id']),
    checks: gitlabChecks(field(row['head_pipeline'], 'status')),
    ...reportsOf(notes),
  };
}

function reportsOf(notes: unknown): Pick<RequestRecord, 'report' | 'reports'> {
  const reports = reportHistory(
    list(notes)
      .filter((note) => note['system'] !== true)
      .map((note) => ({
        body: text(note['body']),
        createdAt: time(note['created_at']),
      })),
  );
  return { report: reports.at(-1) ?? null, reports };
}

function updatedQuery(since: Date | null): URLSearchParams {
  const query = new URLSearchParams({ order_by: 'updated_at', sort: 'asc' });
  if (since !== null) query.set('updated_after', since.toISOString());
  return query;
}

interface Api {
  run: RunCli;
  project: string;
  now: () => string;
}

async function pages(
  { run, project }: Api,
  resource: string,
  query: URLSearchParams,
): Promise<Json[]> {
  const rows: Json[] = [];
  for (let page = 1; ; page += 1) {
    query.set('per_page', String(PAGE_SIZE));
    query.set('page', String(page));
    const found = objects(
      await run(['api', `${project}/${resource}?${query.toString()}`]),
      resource,
    );
    rows.push(...found);
    if (found.length < PAGE_SIZE) return rows;
  }
}

async function labelColors(api: Api): Promise<Colors> {
  const colors: Colors = new Map();
  for (const label of await pages(api, 'labels', new URLSearchParams())) {
    colors.set(text(label['name']), labelColor(label['color']));
  }
  return colors;
}

async function requestsOf(
  api: Api,
  numbers: number[],
): Promise<RequestRecord[]> {
  const found: RequestRecord[] = [];
  for (const iid of numbers) {
    const path = `${api.project}/merge_requests/${String(iid)}`;
    const detail = object(await api.run(['api', path]), 'merge request');
    const closes = await pages(
      api,
      `merge_requests/${String(iid)}/closes_issues`,
      new URLSearchParams(),
    );
    const notes = await pages(
      api,
      `merge_requests/${String(iid)}/notes`,
      new URLSearchParams({ order_by: 'created_at', sort: 'asc' }),
    );
    const record = gitlabRequest(detail, closes, api.now(), notes);
    if (record !== undefined) found.push(record);
  }
  return found;
}

async function issueEvents(
  api: Api,
  numbers: number[],
): Promise<Map<number, IssueEvents>> {
  const found = new Map<number, IssueEvents>();
  for (const iid of numbers) {
    const states = await pages(
      api,
      `issues/${String(iid)}/resource_state_events`,
      new URLSearchParams(),
    );
    const labels = await pages(
      api,
      `issues/${String(iid)}/resource_label_events`,
      new URLSearchParams(),
    );
    found.set(iid, {
      reopened: states.some((event) => text(event['state']) === 'reopened'),
      labelEvents: gitlabLabelEvents(labels),
    });
  }
  return found;
}

export function gitlabReader(
  run: RunCli,
  repository: string,
  now: () => string = () => new Date().toISOString(),
): GitHostReader {
  const api: Api = {
    run,
    project: `projects/${encodeURIComponent(repository)}`,
    now,
  };
  return {
    changes: async (since) => {
      const issueRows = await pages(api, 'issues', updatedQuery(since));
      const colors = issueRows.length > 0 ? await labelColors(api) : new Map();
      const events = await issueEvents(
        api,
        issueRows.flatMap((row) => positive(row['iid']) ?? []),
      );
      const at = now();
      const requestQuery = updatedQuery(since);
      requestQuery.set('state', 'all');
      const requestRows = await pages(api, 'merge_requests', requestQuery);
      const numbers = requestRows.flatMap((row) => positive(row['iid']) ?? []);
      return {
        issues: byNumber(
          issueRows.flatMap(
            (row) => gitlabIssue(row, colors, at, events) ?? [],
          ),
        ),
        requests: byNumber(await requestsOf(api, numbers)),
      };
    },
    requests: (numbers) => requestsOf(api, numbers),
  };
}
