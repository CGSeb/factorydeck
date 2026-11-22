import type { RunCli } from './command.ts';
import {
  PAGE_SIZE,
  field,
  list,
  object,
  positive,
  text,
  time,
} from './parse.ts';
import type { LabelEvent } from './types.ts';

const LABEL_EVENTS = `timelineItems(first: ${String(PAGE_SIZE)}, after: $events, itemTypes: [LABELED_EVENT, UNLABELED_EVENT]) {
  nodes {
    __typename
    ... on LabeledEvent { createdAt label { name } }
    ... on UnlabeledEvent { createdAt label { name } }
  }
  pageInfo { hasNextPage endCursor }
}`;

const TIMELINE_QUERY = `query($owner: String!, $name: String!, $since: DateTime, $after: String, $events: String) {
  repository(owner: $owner, name: $name) {
    issues(first: ${String(PAGE_SIZE)}, after: $after, orderBy: {field: UPDATED_AT, direction: ASC}, filterBy: {since: $since}) {
      nodes {
        number
        reopened: timelineItems(itemTypes: [REOPENED_EVENT]) { totalCount }
        labelEvents: ${LABEL_EVENTS}
      }
      pageInfo { hasNextPage endCursor }
    }
  }
}`;

const LABEL_EVENTS_QUERY = `query($owner: String!, $name: String!, $number: Int!, $events: String) {
  repository(owner: $owner, name: $name) {
    issue(number: $number) {
      labelEvents: ${LABEL_EVENTS}
    }
  }
}`;

export interface IssueTimeline {
  reopened: boolean;
  labelEvents: LabelEvent[];
}

export function searchTime(value: string | Date): string {
  const at = new Date(value);
  return `${at.toISOString().slice(0, 19)}+00:00`;
}

export function githubLabelEvents(nodes: unknown): LabelEvent[] {
  return list(nodes).flatMap((node) => {
    const kind = text(node['__typename']);
    const label = text(field(node['label'], 'name'));
    const at = time(node['createdAt']);
    if (label === '' || at === null) return [];
    if (kind !== 'LabeledEvent' && kind !== 'UnlabeledEvent') return [];
    return [{ label, added: kind === 'LabeledEvent', at }];
  });
}

interface Graphql {
  run: RunCli;
  repository: string;
}

function graphqlArgs(
  { repository }: Graphql,
  query: string,
  variables: Record<string, string | null>,
): string[] {
  const [owner = '', name = ''] = repository.split('/');
  const args = ['api', 'graphql', '-f', `query=${query}`];
  args.push('-f', `owner=${owner}`, '-f', `name=${name}`);
  for (const [key, value] of Object.entries(variables)) {
    if (value === null) continue;
    args.push(key === 'number' ? '-F' : '-f', `${key}=${value}`);
  }
  return args;
}

function nextCursor(connection: unknown): string | null {
  const page = field(connection, 'pageInfo');
  const next = text(field(page, 'endCursor'));
  return field(page, 'hasNextPage') !== true || next === '' ? null : next;
}

async function remainingLabelEvents(
  graphql: Graphql,
  number: number,
  after: string,
): Promise<LabelEvent[]> {
  const events: LabelEvent[] = [];
  let cursor: string | null = after;
  while (cursor !== null) {
    const answer = object(
      await graphql.run(
        graphqlArgs(graphql, LABEL_EVENTS_QUERY, {
          number: String(number),
          events: cursor,
        }),
      ),
      'graphql',
    );
    const connection = field(
      field(field(field(answer, 'data'), 'repository'), 'issue'),
      'labelEvents',
    );
    events.push(...githubLabelEvents(field(connection, 'nodes')));
    cursor = nextCursor(connection);
  }
  return events;
}

export async function issueTimelines(
  run: RunCli,
  repository: string,
  since: Date | null,
): Promise<Map<number, IssueTimeline>> {
  const graphql = { run, repository };
  const timelines = new Map<number, IssueTimeline>();
  let after: string | null = null;
  for (;;) {
    const answer = object(
      await run(
        graphqlArgs(graphql, TIMELINE_QUERY, {
          since: since === null ? null : searchTime(since),
          after,
        }),
      ),
      'graphql',
    );
    const issues = field(field(field(answer, 'data'), 'repository'), 'issues');
    for (const node of list(field(issues, 'nodes'))) {
      const number = positive(node['number']);
      if (number === undefined) continue;
      const count = field(node['reopened'], 'totalCount');
      const connection = node['labelEvents'];
      const labelEvents = githubLabelEvents(field(connection, 'nodes'));
      const more = nextCursor(connection);
      if (more !== null) {
        labelEvents.push(
          ...(await remainingLabelEvents(graphql, number, more)),
        );
      }
      timelines.set(number, {
        reopened: typeof count === 'number' && count > 0,
        labelEvents,
      });
    }
    after = nextCursor(issues);
    if (after === null) return timelines;
  }
}
