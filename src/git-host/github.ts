import { githubChecks } from './checks.ts';
import type { RunCli } from './command.ts';
import {
  type IssueTimeline,
  issueTimelines,
  searchTime,
} from './github-timeline.ts';
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
  RequestRecord,
  RequestState,
} from './types.ts';

const ISSUE_FIELDS =
  'number,title,state,labels,url,createdAt,closedAt,updatedAt';

const REQUEST_FIELDS =
  'number,title,state,isDraft,headRefName,url,createdAt,mergedAt,closedAt,updatedAt,closingIssuesReferences,statusCheckRollup,comments';

function labelsOf(value: unknown): IssueLabel[] {
  return list(value).flatMap((label) => {
    const name = text(label['name']);
    return name === '' ? [] : [{ name, color: labelColor(label['color']) }];
  });
}

export function githubIssue(
  row: Json,
  now: string,
  timelines: ReadonlyMap<number, IssueTimeline> = new Map(),
): IssueRecord | undefined {
  const number = positive(row['number']);
  if (number === undefined) return undefined;
  const createdAt = requiredTime(row['createdAt'], now);
  return {
    number,
    title: text(row['title']),
    state: text(row['state']).toUpperCase() === 'CLOSED' ? 'closed' : 'open',
    labels: labelsOf(row['labels']),
    url: text(row['url']),
    createdAt,
    closedAt: time(row['closedAt']),
    updatedAt: requiredTime(row['updatedAt'], createdAt),
    reopened: timelines.get(number)?.reopened ?? false,
    labelEvents: timelines.get(number)?.labelEvents ?? [],
  };
}

function requestState(value: unknown): RequestState {
  const state = text(value).toUpperCase();
  if (state === 'MERGED') return 'merged';
  if (state === 'CLOSED') return 'closed';
  return 'open';
}

function sameRepository(reference: Json, repository: string): boolean {
  const repo = reference['repository'];
  const login = text(field(field(repo, 'owner'), 'login'));
  const name = text(field(repo, 'name'));
  if (login === '' || name === '') return true;
  return `${login}/${name}`.toLowerCase() === repository.toLowerCase();
}

function closesOf(value: unknown, repository: string): number[] {
  const numbers = list(value).flatMap((reference) => {
    const number = positive(reference['number']);
    return number === undefined || !sameRepository(reference, repository)
      ? []
      : [number];
  });
  return [...new Set(numbers)].sort((a, b) => a - b);
}

export function githubRequest(
  row: Json,
  repository: string,
  now: string,
): RequestRecord | undefined {
  const number = positive(row['number']);
  if (number === undefined) return undefined;
  const createdAt = requiredTime(row['createdAt'], now);
  return {
    number,
    title: text(row['title']),
    state: requestState(row['state']),
    draft: row['isDraft'] === true,
    headBranch: text(row['headRefName']),
    url: text(row['url']),
    createdAt,
    mergedAt: time(row['mergedAt']),
    closedAt: time(row['closedAt']),
    updatedAt: requiredTime(row['updatedAt'], createdAt),
    closes: closesOf(row['closingIssuesReferences'], repository),
    checks: githubChecks(row['statusCheckRollup']),
    ...reportsOf(row['comments']),
  };
}

function reportsOf(
  comments: unknown,
): Pick<RequestRecord, 'report' | 'reports'> {
  const reports = reportHistory(
    list(comments).map((comment) => ({
      body: text(comment['body']),
      createdAt: time(comment['createdAt']),
    })),
  );
  return { report: reports.at(-1) ?? null, reports };
}

interface Search {
  run: RunCli;
  repository: string;
  kind: 'issue' | 'pr';
  fields: string;
}

function searchArgs(
  { repository, kind, fields }: Search,
  cursor: string | null,
  after: string,
): string[] {
  const search = [
    'sort:updated-asc',
    ...(cursor === null ? [] : [`updated:${after}${cursor}`]),
  ].join(' ');
  return [
    kind,
    'list',
    '--repo',
    repository,
    '--state',
    'all',
    '--limit',
    String(PAGE_SIZE),
    '--search',
    search,
    '--json',
    fields,
  ];
}

async function searchAll(query: Search, since: Date | null): Promise<Json[]> {
  const rows: Json[] = [];
  let cursor = since === null ? null : searchTime(since);
  let after = '>=';
  for (;;) {
    const page = objects(
      await query.run(searchArgs(query, cursor, after)),
      `${query.kind} list`,
    );
    rows.push(...page);
    const last = time(page.at(-1)?.['updatedAt']);
    if (page.length < PAGE_SIZE || last === null) return rows;
    const next = searchTime(last);
    after = next === cursor ? '>' : '>=';
    cursor = next;
  }
}

export function githubReader(
  run: RunCli,
  repository: string,
  now: () => string = () => new Date().toISOString(),
): GitHostReader {
  async function view(number: number): Promise<RequestRecord | undefined> {
    const args = ['pr', 'view', String(number), '--repo', repository];
    const row = object(
      await run([...args, '--json', REQUEST_FIELDS]),
      'pr view',
    );
    return githubRequest(row, repository, now());
  }

  return {
    changes: async (since) => {
      const at = now();
      const search = { run, repository };
      const issues = await searchAll(
        { ...search, kind: 'issue', fields: ISSUE_FIELDS },
        since,
      );
      const timelines =
        issues.length === 0
          ? new Map<number, IssueTimeline>()
          : await issueTimelines(run, repository, since);
      const requests = await searchAll(
        { ...search, kind: 'pr', fields: REQUEST_FIELDS },
        since,
      );
      return {
        issues: byNumber(
          issues.flatMap((row) => githubIssue(row, at, timelines) ?? []),
        ),
        requests: byNumber(
          requests.flatMap((row) => githubRequest(row, repository, at) ?? []),
        ),
      };
    },
    requests: async (numbers) => {
      const rows: RequestRecord[] = [];
      for (const number of numbers) {
        const request = await view(number);
        if (request !== undefined) rows.push(request);
      }
      return rows;
    },
  };
}
