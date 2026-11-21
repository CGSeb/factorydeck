import { appendFileSync, readFileSync } from 'node:fs';
import { FakeGitHostSchema } from './fake-git-host.ts';

type Row = Record<string, unknown>;

const [dataPath = '', ...args] = process.argv.slice(2);
const data = FakeGitHostSchema.parse(
  JSON.parse(readFileSync(dataPath, 'utf8')),
);

if (data.log !== undefined) {
  appendFileSync(data.log, `${JSON.stringify({ args, cwd: process.cwd() })}\n`);
}

function fail(message: string): never {
  process.stderr.write(`${message}\nmore detail on a second line\n`);
  process.exit(1);
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

function github(): void {
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

function gitlabAnswer(resource: string[], query: URLSearchParams): unknown {
  const [name, iid, sub] = resource;
  if (name === 'issues') return gitlabPage(query, byUpdate(data.issues));
  if (name === 'labels') return gitlabPage(query, data.labels ?? []);
  if (name === 'merge_requests' && iid === undefined) {
    return gitlabPage(query, byUpdate(data.requests));
  }
  const request = data.requests.find((row) => String(row['iid']) === iid);
  if (request === undefined) fail('404 Not found');
  return sub === 'closes_issues' ? (data.closes?.[iid ?? ''] ?? []) : request;
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

if (data.fail !== undefined) fail(data.fail);
if (data.hang === true) {
  setTimeout(() => undefined, 600_000);
} else if (data.host === 'github') {
  github();
} else {
  gitlab();
}
