import { appendFileSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  FakeGitHostSchema,
  fakeFactoryAnswer,
  fakeGitHostToken,
} from './fake-git-host.ts';

type Row = Record<string, unknown>;

function fail(message: string): never {
  process.stderr.write(`${message}\nmore detail on a second line\n`);
  process.exit(1);
}

function httpFail(status: number, reason: string): never {
  process.stderr.write(`${reason} (HTTP ${String(status)})\n`);
  process.exit(1);
}

const given = process.argv.slice(2);
const hostname = given.indexOf('--hostname');
const tokenMode = hostname !== -1;
const args = tokenMode
  ? given.filter((_, index) => index !== hostname && index !== hostname + 1)
  : given;
const token = process.env['GH_TOKEN'] ?? process.env['GITLAB_TOKEN'] ?? '';
const dataPath = tokenMode ? token : fakeGitHostToken(process.cwd());

function readData(): string {
  try {
    return readFileSync(dataPath, 'utf8');
  } catch {
    if (tokenMode) httpFail(401, 'Bad credentials');
    return fail(`no fake git host data in ${process.cwd()}`);
  }
}

const data = FakeGitHostSchema.parse(JSON.parse(readData()));
const root = dirname(dirname(dataPath));

if (data.log !== undefined) {
  appendFileSync(
    data.log,
    `${JSON.stringify({ args: given, cwd: process.cwd() })}\n`,
  );
}

function option(name: string): string | undefined {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

function updatedOf(row: Row): string {
  const value = row['updatedAt'] ?? row['updated_at'];
  return typeof value === 'string' ? value : '';
}

function byUpdate(rows: Row[]): Row[] {
  return [...rows].sort((a, b) =>
    updatedOf(a) < updatedOf(b) ? -1 : updatedOf(a) > updatedOf(b) ? 1 : 0,
  );
}

function print(value: unknown): void {
  process.stdout.write(JSON.stringify(value));
}

function graphqlField(name: string): string | undefined {
  const prefix = `${name}=`;
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function labelEventsPage(number: unknown, query: string): Row {
  const size = Number(/timelineItems\(first: (\d+)/.exec(query)?.[1] ?? '100');
  const start = Number(graphqlField('events') ?? '0');
  const events = data.labelEvents?.[String(number)] ?? [];
  return {
    nodes: events.slice(start, start + size),
    pageInfo: {
      hasNextPage: start + size < events.length,
      endCursor: String(start + size),
    },
  };
}

function stateEventsPage(number: unknown, query: string): Row {
  const size = Number(
    /stateEvents: timelineItems\(first: (\d+)/.exec(query)?.[1] ?? '100',
  );
  const events = data.stateEvents?.[String(number)] ?? [];
  return {
    nodes: events.slice(0, size).map((event) => ({
      __typename: event.state === 'closed' ? 'ClosedEvent' : 'ReopenedEvent',
      createdAt: event.at,
    })),
  };
}

function githubGraphql(): void {
  const query = graphqlField('query') ?? '';
  if (
    `${graphqlField('owner') ?? ''}/${graphqlField('name') ?? ''}` !==
    data.repository
  ) {
    fail('GraphQL: Could not resolve to a Repository with the name.');
  }
  const issue = graphqlField('number');
  if (issue !== undefined) {
    print({
      data: {
        repository: {
          issue: { labelEvents: labelEventsPage(issue, query) },
        },
      },
    });
    return;
  }
  const size = Number(/first: (\d+)/.exec(query)?.[1] ?? '100');
  const since = graphqlField('since');
  const start = Number(graphqlField('after') ?? '0');
  const rows = byUpdate(data.issues).filter(
    (row) =>
      since === undefined ||
      new Date(updatedOf(row)).getTime() >= new Date(since).getTime(),
  );
  const page = rows.slice(start, start + size);
  print({
    data: {
      repository: {
        issues: {
          nodes: page.map((row) => ({
            number: row['number'],
            stateEvents: stateEventsPage(row['number'], query),
            labelEvents: labelEventsPage(row['number'], query),
          })),
          pageInfo: {
            hasNextPage: start + size < rows.length,
            endCursor: String(start + size),
          },
        },
      },
    },
  });
}

function github(): void {
  if (args[0] === 'api' && args[1] === 'graphql') {
    githubGraphql();
    return;
  }
  if (option('--repo') !== data.repository) {
    fail(
      `GraphQL: Could not resolve to a Repository with the name '${option('--repo') ?? ''}'.`,
    );
  }
  const [kind, verb, number] = args;
  const rows = kind === 'issue' ? data.issues : data.requests;
  if (verb === 'view') {
    const row = rows.find(
      (candidate) => String(candidate['number']) === number,
    );
    if (row === undefined) fail(`no pull requests found for ${number ?? ''}`);
    print(row);
    return;
  }
  const search = option('--search') ?? '';
  const match = /updated:(>=|>)(\S+)/.exec(search);
  const limit = Number(option('--limit') ?? '30');
  const found = byUpdate(rows).filter((row) => {
    if (match === null) return true;
    const updated = new Date(updatedOf(row)).getTime();
    const since = new Date(match[2] ?? '').getTime();
    return match[1] === '>=' ? updated >= since : updated > since;
  });
  print(found.slice(0, limit));
}

function gitlabPage(query: URLSearchParams, rows: Row[]): Row[] {
  const size = Number(query.get('per_page') ?? '20');
  const start = (Number(query.get('page') ?? '1') - 1) * size;
  const since = query.get('updated_after');
  const updated =
    since === null
      ? rows
      : byUpdate(rows).filter(
          (row) =>
            new Date(updatedOf(row)).getTime() >= new Date(since).getTime(),
        );
  return updated.slice(start, start + size);
}

function stateEvents(iid: string | undefined): Row[] {
  return (data.stateEvents?.[iid ?? ''] ?? []).map((event) => ({
    state: event.state,
    created_at: event.at,
  }));
}

function issueAnswer(
  iid: string | undefined,
  sub: string | undefined,
  query: URLSearchParams,
): unknown {
  if (iid === undefined) return gitlabPage(query, byUpdate(data.issues));
  return sub === 'resource_label_events'
    ? gitlabPage(query, data.labelEvents?.[iid] ?? [])
    : gitlabPage(query, stateEvents(iid));
}

function requestAnswer(
  iid: string | undefined,
  sub: string | undefined,
  query: URLSearchParams,
): unknown {
  if (iid === undefined) return gitlabPage(query, byUpdate(data.requests));
  const request = data.requests.find((row) => String(row['iid']) === iid);
  if (request === undefined) fail('404 Not found');
  if (sub === 'notes') return gitlabPage(query, data.notes?.[iid] ?? []);
  return sub === 'closes_issues'
    ? gitlabPage(query, data.closes?.[iid] ?? [])
    : request;
}

function gitlabAnswer(resource: string[], query: URLSearchParams): unknown {
  const [name, iid, sub] = resource;
  if (name === 'issues') return issueAnswer(iid, sub, query);
  if (name === 'labels') return gitlabPage(query, data.labels ?? []);
  return requestAnswer(iid, sub, query);
}

function gitlab(): void {
  const [verb, endpoint = ''] = args;
  if (verb !== 'api') fail(`unknown command "${verb ?? ''}" for "glab"`);
  const url = new URL(endpoint, 'https://gitlab.invalid/');
  const prefix = `/projects/${encodeURIComponent(data.repository)}/`;
  if (!url.pathname.startsWith(prefix)) fail('404 Project Not Found');
  print(
    gitlabAnswer(
      url.pathname.slice(prefix.length).split('/'),
      url.searchParams,
    ),
  );
}

function factoryEndpoint(): boolean {
  const answer = fakeFactoryAnswer(data, root, args);
  if (answer === undefined) return false;
  if (answer.status !== 200) httpFail(answer.status, 'Not Found');
  process.stdout.write(answer.text);
  return true;
}

function answer(): void {
  if (tokenMode && factoryEndpoint()) return;
  if (!tokenMode && data.fail !== undefined) fail(data.fail);
  if (!tokenMode && data.hang === true) {
    setTimeout(() => undefined, 600_000);
  } else if (data.host === 'github') {
    github();
  } else {
    gitlab();
  }
}

answer();
