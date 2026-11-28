import { and, eq, isNotNull, isNull, ne, notExists, sql } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import {
  UNASSIGNED_PROJECT,
  project,
  removedSession,
  rootRemote,
  session,
} from '../db/schema.ts';
import { compareText } from './project-order.ts';
import type { PendingRemote, RemotesNotAdded } from './project-types.ts';

export function byLastSession(
  left: PendingRemote,
  right: PendingRemote,
): number {
  if (left.lastAt !== right.lastAt) {
    if (left.lastAt === null) return 1;
    if (right.lastAt === null) return -1;
    const order = compareText(right.lastAt, left.lastAt);
    if (order !== 0) return order;
  }
  return compareText(left.remote, right.remote);
}

function isoOf(value: Date | null): string | null {
  return value === null ? null : value.toISOString();
}

const SESSION_REMOTE = sql<
  string | null
>`coalesce(${rootRemote.remote}, ${session.remote})`;

function sessions(db: Database) {
  return db
    .select({
      remote: SESSION_REMOTE.as('remote'),
      root: session.project,
      firstAt: session.firstAt,
      lastAt: session.lastAt,
    })
    .from(session)
    .leftJoin(rootRemote, eq(rootRemote.root, session.project))
    .where(
      notExists(
        db
          .select({ id: removedSession.sessionId })
          .from(removedSession)
          .where(eq(removedSession.sessionId, session.id)),
      ),
    )
    .as('remote_session');
}

export async function remotesNotAdded(db: Database): Promise<RemotesNotAdded> {
  const rows = sessions(db);
  const pending = await db
    .select({
      remote: sql<string>`${rows.remote}`,
      sessions: sql<number>`count(*)`.mapWith(Number),
      firstAt:
        sql<Date | null>`least(min(${rows.firstAt}), min(${rows.lastAt}))`.mapWith(
          session.firstAt,
        ),
      lastAt:
        sql<Date | null>`greatest(max(${rows.firstAt}), max(${rows.lastAt}))`.mapWith(
          session.lastAt,
        ),
    })
    .from(rows)
    .where(
      and(
        isNotNull(rows.remote),
        notExists(
          db
            .select({ id: project.id })
            .from(project)
            .where(eq(project.remote, rows.remote)),
        ),
      ),
    )
    .groupBy(rows.remote);
  const [none] = await db
    .select({
      sessions: sql<number>`count(*)`.mapWith(Number),
      folders:
        sql<number>`count(distinct ${rows.root}) filter (where ${ne(rows.root, UNASSIGNED_PROJECT)})`.mapWith(
          Number,
        ),
    })
    .from(rows)
    .where(isNull(rows.remote));
  return {
    pendingRemotes: pending
      .map((row) => ({
        remote: row.remote,
        sessions: row.sessions,
        firstAt: isoOf(row.firstAt),
        lastAt: isoOf(row.lastAt),
      }))
      .sort(byLastSession),
    noRemote:
      none === undefined || none.sessions === 0
        ? null
        : { sessions: none.sessions, folders: none.folders },
  };
}
