import type { Context } from './context.ts';
import { type ServerEntry, readCredentials } from './credentials.ts';
import { credentialsPath } from './home.ts';
import { type Answer, request } from './http.ts';

const OK = 'ok';

export function statusResult(answer: Answer): string {
  if (!answer.reached || answer.status === 503) return 'unreachable';
  if (answer.status === 200) return OK;
  if (answer.status === 401) return 'token refused';
  return `unexpected answer (HTTP ${answer.status})`;
}

async function check(
  origin: string,
  entry: ServerEntry,
  context: Context,
): Promise<string[]> {
  const answer = await request(context, `${origin}/api/cli/me`, {
    method: 'GET',
    token: entry.token,
  });
  return [
    origin,
    `${entry.account.name} ${entry.account.email}`,
    entry.machine,
    statusResult(answer),
  ];
}

export function formatRows(rows: string[][], terminal: boolean): string[] {
  const widths = (rows[0] ?? []).map((_, column) =>
    Math.max(...rows.map((row) => Array.from(row[column] ?? '').length)),
  );
  return rows.map((row) =>
    row
      .map((cell, column) =>
        terminal && column < row.length - 1
          ? cell + ' '.repeat((widths[column] ?? 0) - Array.from(cell).length)
          : cell,
      )
      .join('  '),
  );
}

function selected(
  servers: Record<string, ServerEntry>,
  only: string | undefined,
): [string, ServerEntry][] {
  return Object.entries(servers)
    .filter(([origin]) => only === undefined || origin === only)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

export async function status(
  only: string | undefined,
  context: Context,
): Promise<number> {
  const { servers } = await readCredentials(credentialsPath(context));
  const entries = selected(servers, only);
  if (entries.length === 0) {
    context.output.out(
      only === undefined
        ? 'Not logged in. Run factorydeck login <url>.'
        : `Not logged in to ${only}.`,
    );
    return 0;
  }
  const rows = await Promise.all(
    entries.map(([origin, entry]) => check(origin, entry, context)),
  );
  for (const line of formatRows(rows, context.output.terminal)) {
    context.output.out(line);
  }
  return rows.every((row) => row[3] === OK) ? 0 : 1;
}
