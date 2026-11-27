import type { Reproduced, SerenityReport } from './types.ts';

export interface ReportComment {
  body: string;
  createdAt: string | null;
}

const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const HEADING = /^ {0,3}## Serenity: (\d+)\/100 \(threshold (\d+)\)/;
const ROUNDS = /(?:^|[.;]\s+)Review: (\d+) rounds?\b/;
const GATES_PASSED = /^Gates: (?:all )?passed(?:$|[.,;\s(])/i;
const ROOT_CAUSE = 'Root cause:';
const REPRODUCED = 'Reproduced:';
const ROOT_CAUSE_LIMIT = 200;

const REPRODUCED_TEXTS: Readonly<Record<string, Reproduced>> = {
  'failed on main': 'failed-on-main',
  'passed on main': 'passed-on-main',
  'did not run on main': 'did-not-run-on-main',
  'no test': 'no-test',
};

function closes(fence: string, marker: string | undefined): boolean {
  return (
    marker !== undefined &&
    marker[0] === fence[0] &&
    marker.length >= fence.length
  );
}

function proseLines(body: string): string[] {
  const lines: string[] = [];
  let fence: string | null = null;
  for (const line of body.split(/\r?\n/)) {
    const marker = FENCE.exec(line)?.[1];
    if (fence === null && marker === undefined) lines.push(line);
    else if (fence === null) fence = marker ?? null;
    else if (closes(fence, marker)) fence = null;
  }
  return lines;
}

function valueOf(lines: readonly string[], prefix: string): string | undefined {
  return lines.find((line) => line.startsWith(prefix))?.slice(prefix.length);
}

function rootCauseOf(lines: readonly string[]): string | undefined {
  const text = valueOf(lines, ROOT_CAUSE)?.trim();
  if (text === undefined || text === '' || text === 'none') return undefined;
  const chars = Array.from(text);
  return chars.length <= ROOT_CAUSE_LIMIT
    ? text
    : `${chars.slice(0, ROOT_CAUSE_LIMIT - 1).join('')}…`;
}

function reproducedOf(lines: readonly string[]): Reproduced | undefined {
  const text = valueOf(lines, REPRODUCED)?.trim();
  return text === undefined || !Object.hasOwn(REPRODUCED_TEXTS, text)
    ? undefined
    : REPRODUCED_TEXTS[text];
}

export function parseReport(
  body: string,
  at: string,
): SerenityReport | undefined {
  const lines = proseLines(body);
  const heading = lines
    .map((line) => HEADING.exec(line))
    .find((match) => match !== null);
  if (heading === undefined) return undefined;
  const gates = lines.find((line) => line.startsWith('Gates:'));
  const rounds = lines
    .map((line) => ROUNDS.exec(line)?.[1])
    .find((value) => value !== undefined);
  const rootCause = rootCauseOf(lines);
  const reproduced = reproducedOf(lines);
  return {
    score: Number(heading[1]),
    threshold: Number(heading[2]),
    rounds: rounds === undefined ? null : Number(rounds),
    gatesPassed: gates === undefined || GATES_PASSED.test(gates),
    at,
    ...(rootCause === undefined ? {} : { rootCause }),
    ...(reproduced === undefined ? {} : { reproduced }),
  };
}

export function reportHistory(
  comments: readonly ReportComment[],
): SerenityReport[] {
  const reports = comments.flatMap(({ body, createdAt }) =>
    createdAt === null ? [] : (parseReport(body, createdAt) ?? []),
  );
  return reports.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}

export function latestReport(
  comments: readonly ReportComment[],
): SerenityReport | null {
  return reportHistory(comments).at(-1) ?? null;
}
