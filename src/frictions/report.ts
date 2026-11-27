import { homedir } from 'node:os';
import type { Database } from '../db/client.ts';
import { text } from '../features/values.ts';
import type { WorkItemIssue } from '../git-host/types.ts';
import { lookupIssues } from '../git-host/work-items.ts';
import { PERIOD_LABELS } from '../overview/types.ts';
import type { WorkflowConfig } from '../roles/config.ts';
import { formatTokens } from '../ui/format.ts';
import { type FrictionQuery, type FrictionWindow, loadWindow } from './load.ts';
import {
  isShellTool,
  latestOccurrences,
  locationOf,
  readLogTexts,
} from './occurrences.ts';
import { statsOfWindow } from './query.ts';
import {
  type ReportGroup,
  agentOf,
  pickDistinct,
  reportGroups,
} from './report-groups.ts';
import {
  MAX_GROUPS_WITH_OCCURRENCES,
  type ReportContext,
  type ReportHeader,
  reportMarkdown,
} from './report-markdown.ts';
import type { ReportOccurrence } from './report-occurrences.ts';
import { inPeriodOf, roleFrictionsOf } from './selection.ts';
import type { LoadedRow } from './threads.ts';
import {
  type FrictionStats,
  type FrictionSubject,
  KIND_LABELS,
} from './types.ts';

export const REPORT_OCCURRENCES = 3;
export const OTHER_TOOL_CANDIDATES = 30;

export interface ReportQuery extends FrictionQuery {
  project: string;
}

function dateTimeFormat(timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
}

function partsOf(format: Intl.DateTimeFormat, at: number): Map<string, string> {
  return new Map(
    format.formatToParts(new Date(at)).map((part) => [part.type, part.value]),
  );
}

export function dateTimeIn(timeZone: string): {
  dateTime: (at: string) => string;
  date: (at: number) => string;
} {
  const format = dateTimeFormat(timeZone);
  const date = (at: number): string => {
    const parts = partsOf(format, at);
    return `${parts.get('year') ?? ''}-${parts.get('month') ?? ''}-${parts.get('day') ?? ''}`;
  };
  return {
    date,
    dateTime: (at) => {
      const moment = Date.parse(at);
      const parts = partsOf(format, moment);
      return `${date(moment)} ${parts.get('hour') ?? ''}:${parts.get('minute') ?? ''}`;
    },
  };
}

function issueTitleOf(issue: WorkItemIssue): string | null {
  if (issue.status === 'found') return issue.title;
  if (issue.status === 'not-found') return '(not found)';
  return null;
}

function subjectFilter(subject: FrictionSubject | null): string[] {
  if (subject === null) return [];
  if (subject.kind === 'session') {
    const title = subject.title ?? '';
    return [`Session: ${title === '' ? subject.id : title}`];
  }
  const title = issueTitleOf(subject.issue);
  const number = `#${String(subject.number)}`;
  return [`Issue: ${title === null ? number : `${number} ${title}`}`];
}

function filtersOf(query: ReportQuery, subject: FrictionSubject | null) {
  return [
    ...(query.kind === undefined ? [] : [`Kind: ${KIND_LABELS[query.kind]}`]),
    ...(query.role === undefined ? [] : [`Role: ${query.role}`]),
    ...subjectFilter(subject),
  ];
}

function earliestOf(
  loaded: FrictionWindow,
  rows: readonly LoadedRow[],
  role: string | undefined,
): number | null {
  const moments = [
    ...loaded.calls
      .filter(
        (group) =>
          group.inPeriod && (role === undefined || group.role === role),
      )
      .flatMap((group) => (group.slot === null ? [] : [group.slot])),
    ...rows.map((row) => Date.parse(row.at)),
  ];
  return moments.length === 0 ? null : Math.min(...moments);
}

function contextOf(
  query: ReportQuery,
  stats: FrictionStats,
): ReportContext | null {
  if (query.kind !== undefined) return null;
  const { medianPeak } = stats.context;
  return {
    medianPeak:
      medianPeak === null
        ? '—'
        : formatTokens(medianPeak).replace(/\.0(?=[KMBT]$)/, ''),
    compacted: stats.context.compacted,
    threads: stats.context.threads.length,
  };
}

function candidatesOf(group: ReportGroup): LoadedRow[] {
  if (group.kind === 'tool-error' && !group.shell) {
    return group.rows.slice(0, OTHER_TOOL_CANDIDATES);
  }
  const keyOf = (row: LoadedRow): string =>
    group.kind === 'stop-blocked'
      ? rowKey(row)
      : (row.commandHash ?? rowKey(row));
  return pickDistinct(group.rows, keyOf, REPORT_OCCURRENCES);
}

function rowKey(row: LoadedRow): string {
  return `id:${text(row.source['id'])}`;
}

async function occurrencesOf(
  groups: readonly ReportGroup[],
  home: string,
): Promise<Map<string, ReportOccurrence[]>> {
  const shown = groups.slice(0, MAX_GROUPS_WITH_OCCURRENCES);
  const candidates = new Map(
    shown.map((group) => [group.key, candidatesOf(group)]),
  );
  const found = await readLogTexts(
    [...candidates.values()]
      .flat()
      .map((row) => locationOf(row.source, rowKey(row))),
    home,
  );
  const textsOf = (row: LoadedRow) => found.get(rowKey(row)) ?? null;
  return new Map(
    shown.map((group) => {
      const rows = candidates.get(group.key) ?? [];
      const picked =
        group.kind === 'tool-error' && !group.shell
          ? pickDistinct(
              rows,
              (row) => {
                const texts = textsOf(row);
                return texts?.kind === 'tool-error'
                  ? `input:${texts.input}`
                  : rowKey(row);
              },
              REPORT_OCCURRENCES,
            )
          : rows;
      return [
        group.key,
        latestOccurrences(picked).map((row) => ({
          at: row.at,
          role: row.thread.role,
          workItem: row.thread.workItem,
          sessionId: row.sessionId,
          sessionTitle:
            row.sessionTitle === ''
              ? row.sessionId.slice(0, 8)
              : row.sessionTitle,
          shell: isShellTool(agentOf(row), row.tool),
          exitCode: row.exitCode,
          texts: textsOf(row),
        })),
      ];
    }),
  );
}

async function issueTitles(
  db: Database,
  project: string,
  groups: readonly ReportGroup[],
): Promise<(number: number) => string | null> {
  const numbers = [
    ...new Set(
      groups.flatMap((group) =>
        group.rows.flatMap((row) =>
          row.thread.workItem === null ? [] : [row.thread.workItem],
        ),
      ),
    ),
  ];
  if (numbers.length === 0) return () => null;
  const issueOf = await lookupIssues(
    db,
    numbers.map((number) => ({ project, number })),
  );
  return (number) => {
    const issue = issueOf({ project, number });
    return issue === null ? null : issueTitleOf(issue);
  };
}

export async function frictionReport(
  db: Database,
  query: ReportQuery,
  config: WorkflowConfig,
  home: string = homedir(),
): Promise<string> {
  const loaded = await loadWindow(db, query, config);
  const stats = await statsOfWindow(db, query, config, loaded);
  const rows = roleFrictionsOf(loaded, query.role)
    .filter(inPeriodOf(loaded))
    .filter((row) => query.kind === undefined || row.kind === query.kind);
  const groups = reportGroups(rows);
  const { date, dateTime } = dateTimeIn(query.timeZone);
  const now = (query.now ?? new Date()).getTime();
  const from = loaded.startMs ?? earliestOf(loaded, rows, query.role) ?? now;
  const header: ReportHeader = {
    projectName: loaded.names.label(query.project),
    periodLabel: PERIOD_LABELS[query.period],
    from: date(from),
    to: date(now),
    timeZone: query.timeZone,
    filters: filtersOf(query, loaded.subject),
    frictions: stats.frictions,
    apiCalls: stats.apiCalls,
  };
  const [occurrences, issueTitle] = await Promise.all([
    occurrencesOf(groups, home),
    issueTitles(db, query.project, groups),
  ]);
  return reportMarkdown({
    header,
    groups,
    occurrences,
    issueTitle,
    formatAt: dateTime,
    context: contextOf(query, stats),
  });
}
