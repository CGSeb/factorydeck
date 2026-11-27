import { MISSING, formatCount } from '../ui/format.ts';
import { cutHead } from './log-texts.ts';
import {
  type ReportOccurrence,
  SEPARATOR,
  codeSpan,
  issueLabel,
  occurrenceLines,
} from './report-occurrences.ts';
import {
  MAX_ISSUES,
  type ReportGroup,
  type Tally,
  distinctCommands,
  exitCodes,
  issueTallies,
  repeatedThreads,
  roleTallies,
} from './report-groups.ts';
import { CATEGORY_LABELS } from './types.ts';

export const REPORT_TITLE = '# Friction report';
export const NO_FRICTION = 'No friction in this period.';
export const MAX_GROUPS_WITH_OCCURRENCES = 20;
export const MAX_HOOK_CELL = 80;

export interface ReportHeader {
  projectName: string;
  periodLabel: string;
  from: string;
  to: string;
  timeZone: string;
  filters: string[];
  frictions: number;
  apiCalls: number;
}

export interface ReportContext {
  medianPeak: string;
  compacted: number;
  threads: number;
}

export interface ReportData {
  header: ReportHeader;
  groups: ReportGroup[];
  occurrences: ReadonlyMap<string, ReportOccurrence[]>;
  issueTitle: (number: number) => string | null;
  formatAt: (at: string) => string;
  context: ReportContext | null;
}

function plural(count: number, one: string, other: string): string {
  return `${formatCount(count)} ${count === 1 ? one : other}`;
}

export function perHundredText(frictions: number, apiCalls: number): string {
  if (apiCalls === 0) return MISSING;
  return (Math.round((frictions / apiCalls) * 1000) / 10).toFixed(1);
}

export function headerLines(header: ReportHeader): string[] {
  return [
    REPORT_TITLE,
    '',
    [
      header.projectName,
      header.periodLabel,
      `${header.from} to ${header.to} (${header.timeZone})`,
    ].join(SEPARATOR),
    ...(header.filters.length === 0
      ? []
      : ['', header.filters.join(SEPARATOR)]),
    '',
    [
      plural(header.frictions, 'friction', 'frictions'),
      `${perHundredText(header.frictions, header.apiCalls)} per 100 API calls`,
      plural(header.apiCalls, 'API call', 'API calls'),
    ].join(SEPARATOR),
  ];
}

function cell(text: string): string {
  return text.replaceAll(/\r?\n/g, ' ').replaceAll('|', String.raw`\|`);
}

function orMissing(text: string | null): string {
  return text === null || text === '' ? MISSING : text;
}

const KIND_TEXT = {
  'tool-error': 'Tool error',
  'stop-blocked': 'Stop blocked',
};

export function groupsTable(
  groups: readonly ReportGroup[],
  formatAt: (at: string) => string,
): string[] {
  return [
    '| # | Kind | Category | Tool | Program | Hook | Frictions | Threads | Last |',
    '| --: | --- | --- | --- | --- | --- | --: | --: | --- |',
    ...groups.map((group, index) => {
      const stop = group.kind === 'stop-blocked';
      const cells = [
        String(index + 1),
        KIND_TEXT[group.kind],
        group.category === null ? MISSING : CATEGORY_LABELS[group.category],
        stop ? MISSING : orMissing(group.tool),
        stop ? MISSING : orMissing(group.program),
        stop ? cutHead(orMissing(group.hook), MAX_HOOK_CELL) : MISSING,
        formatCount(group.rows.length),
        formatCount(group.threads),
        formatAt(group.lastAt),
      ];
      return `| ${cells.map(cell).join(' | ')} |`;
    }),
  ];
}

export function groupTitle(group: ReportGroup, position: number): string {
  const parts =
    group.kind === 'stop-blocked'
      ? ['Stop blocked', group.hook]
      : [
          group.category === null ? null : CATEGORY_LABELS[group.category],
          group.tool,
          group.program,
        ];
  const shown = parts.filter(
    (part): part is string => part !== null && part !== '',
  );
  return `## ${String(position)}. ${shown.join(SEPARATOR)}`;
}

function talliesText<K>(
  tallies: readonly Tally<K>[],
  label: (key: K) => string,
  max = Number.POSITIVE_INFINITY,
): string {
  const shown = tallies
    .slice(0, max)
    .map((tally) => `${label(tally.key)} (${formatCount(tally.frictions)})`)
    .join(', ');
  return tallies.length > max ? `${shown}, …` : shown;
}

export function groupFacts(
  group: ReportGroup,
  issueTitle: (number: number) => string | null,
  formatAt: (at: string) => string,
): string[] {
  const codes = exitCodes(group);
  const repeated = repeatedThreads(group);
  return [
    `- Frictions: ${formatCount(group.rows.length)}`,
    `- Threads: ${formatCount(group.threads)}`,
    `- Roles: ${talliesText(roleTallies(group), (role) => role)}`,
    `- Issues: ${talliesText(
      issueTallies(group),
      (number) => issueLabel(number, issueTitle),
      MAX_ISSUES,
    )}`,
    ...(group.shell
      ? [
          `- Exit codes: ${codes.length === 0 ? MISSING : codes.join(', ')}`,
          `- Distinct commands: ${formatCount(distinctCommands(group))}`,
        ]
      : []),
    ...(repeated === 0
      ? []
      : [
          `- Threads where one command failed 3 times or more: ${formatCount(repeated)}`,
        ]),
    `- First: ${formatAt(group.firstAt)}`,
    `- Last: ${formatAt(group.lastAt)}`,
  ];
}

function groupSection(
  data: ReportData,
  group: ReportGroup,
  index: number,
): string[] {
  const occurrences = data.occurrences.get(group.key);
  return [
    '',
    groupTitle(group, index + 1),
    '',
    `Key: ${codeSpan(group.key)}`,
    '',
    ...groupFacts(group, data.issueTitle, data.formatAt),
    ...(occurrences === undefined
      ? []
      : [
          '',
          '### Occurrences',
          ...occurrences.flatMap((occurrence) => [
            '',
            ...occurrenceLines(occurrence, data.formatAt),
          ]),
        ]),
  ];
}

function moreGroupsLine(count: number): string[] {
  if (count <= 0) return [];
  return [
    '',
    count === 1
      ? '1 more group is listed without occurrences.'
      : `${formatCount(count)} more groups are listed without occurrences.`,
  ];
}

function contextLines(context: ReportContext | null): string[] {
  if (context === null) return [];
  return [
    '',
    '## Context',
    '',
    `Median context peak: ${context.medianPeak}${SEPARATOR}${formatCount(context.compacted)} of ${plural(context.threads, 'thread', 'threads')} compacted`,
  ];
}

export function reportMarkdown(data: ReportData): string {
  const lines = headerLines(data.header);
  if (data.groups.length === 0)
    return [...lines, '', NO_FRICTION, ''].join('\n');
  return [
    ...lines,
    '',
    '## Groups',
    '',
    ...groupsTable(data.groups, data.formatAt),
    ...data.groups.flatMap((group, index) => groupSection(data, group, index)),
    ...moreGroupsLine(data.groups.length - MAX_GROUPS_WITH_OCCURRENCES),
    ...contextLines(data.context),
    '',
  ].join('\n');
}
