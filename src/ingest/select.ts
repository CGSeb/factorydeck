import { stat } from 'node:fs/promises';
import { inArray } from 'drizzle-orm';
import { UNASSIGNED_PROJECT, session, skippedFile } from '../db/schema.ts';
import { type FactoryCheck, sessionCwd } from './factory.ts';
import type { LogFile } from './files.ts';
import { resolveProjects } from './project.ts';
import type { Run } from './store.ts';

type SkippedRow = typeof skippedFile.$inferSelect;

export interface Selection {
  files: LogFile[];
  projects: Map<string, string>;
  skippedSessions: number;
}

interface Group {
  id: string;
  files: LogFile[];
  sizes: Map<string, number>;
  changed: boolean;
}

function groupBySession(files: readonly LogFile[]): Map<string, LogFile[]> {
  const groups = new Map<string, LogFile[]>();
  for (const file of files) {
    const group = groups.get(file.sessionId) ?? [];
    group.push(file);
    groups.set(file.sessionId, group);
  }
  return groups;
}

async function sizeOf(path: string): Promise<number | undefined> {
  return stat(path).then(
    (stats) => stats.size,
    () => undefined,
  );
}

interface Choices {
  hasFactory: FactoryCheck;
  stored: Map<string, string>;
  skipped: Map<string, SkippedRow>;
  ingested: Map<string, string | undefined>;
  toSkip: { group: Group; project: string | null }[];
  toResolve: { group: Group; cwd: string | null }[];
}

async function startChoices(
  run: Run,
  hasFactory: FactoryCheck,
): Promise<Choices> {
  const stored = await run.tx
    .select({ id: session.id, project: session.project })
    .from(session);
  const skipped = await run.tx.select().from(skippedFile);
  return {
    hasFactory,
    stored: new Map(stored.map((row) => [row.id, row.project])),
    skipped: new Map(skipped.map((row) => [row.path, row])),
    ingested: new Map(),
    toSkip: [],
    toResolve: [],
  };
}

async function chooseStored(
  choices: Choices,
  group: Group,
  project: string,
): Promise<void> {
  if (project !== UNASSIGNED_PROJECT && (await choices.hasFactory(project))) {
    choices.ingested.set(group.id, undefined);
  } else {
    choices.toSkip.push({ group, project });
  }
}

async function chooseNew(choices: Choices, group: Group): Promise<void> {
  const recorded = recordedProject(group, choices.skipped);
  if (!group.changed && recorded !== undefined) {
    if (recorded !== null && (await choices.hasFactory(recorded))) {
      choices.ingested.set(group.id, recorded);
    }
    return;
  }
  const cwd = await sessionCwd(logsOf(group.files));
  if (cwd !== undefined) choices.toResolve.push({ group, cwd });
}

async function resolveNew(choices: Choices): Promise<void> {
  const known = [...choices.stored.values()].filter(
    (project) => project !== UNASSIGNED_PROJECT,
  );
  const roots = await resolveProjects(
    choices.toResolve.flatMap(({ cwd }) => (cwd === null ? [] : [cwd])),
    known,
  );
  for (const { group, cwd } of choices.toResolve) {
    const project = cwd === null ? null : (roots.get(cwd) ?? null);
    if (project !== null && (await choices.hasFactory(project))) {
      choices.ingested.set(group.id, project);
    } else {
      choices.toSkip.push({ group, project });
    }
  }
}

async function forgetSkipped(run: Run, choices: Choices): Promise<void> {
  const ids = new Set(
    [...choices.skipped.values()]
      .map((row) => row.sessionId)
      .filter((id) => choices.ingested.has(id)),
  );
  if (ids.size > 0) {
    await run.tx
      .delete(skippedFile)
      .where(inArray(skippedFile.sessionId, [...ids]));
  }
}

export async function selectFactorySessions(
  run: Run,
  files: readonly LogFile[],
  hasFactory: FactoryCheck,
): Promise<Selection> {
  const choices = await startChoices(run, hasFactory);
  for (const [id, sessionFiles] of groupBySession(files)) {
    const group = await describeGroup(run, id, sessionFiles, choices.skipped);
    const project = choices.stored.get(id);
    await (project === undefined
      ? chooseNew(choices, group)
      : chooseStored(choices, group, project));
  }
  await resolveNew(choices);
  const skippedSessions = await recordSkipped(run, choices.toSkip);
  await forgetSkipped(run, choices);
  const projects = new Map<string, string>();
  for (const [id, project] of choices.ingested) {
    if (project !== undefined) projects.set(id, project);
  }
  return {
    files: files.filter((file) => choices.ingested.has(file.sessionId)),
    projects,
    skippedSessions,
  };
}

async function describeGroup(
  run: Run,
  id: string,
  files: LogFile[],
  skipped: Map<string, SkippedRow>,
): Promise<Group> {
  const sizes = new Map<string, number>();
  let changed = false;
  for (const file of files) {
    const size = await sizeOf(file.path);
    if (size === undefined) continue;
    sizes.set(file.path, size);
    const seen =
      skipped.get(file.path)?.sizeBytes ??
      run.storedFiles.get(file.path)?.sizeBytes;
    if (seen !== size) changed = true;
  }
  return { id, files, sizes, changed };
}

function recordedProject(
  group: Group,
  skipped: Map<string, SkippedRow>,
): string | null | undefined {
  const rows = group.files.map((file) => skipped.get(file.path));
  const first = rows[0];
  return first !== undefined && rows.every((row) => row !== undefined)
    ? first.project
    : undefined;
}

function logsOf(files: readonly LogFile[]): Parameters<typeof sessionCwd>[0] {
  return {
    main: files.find((file) => file.subAgent === undefined)?.path,
    subAgents: files.flatMap((file) =>
      file.subAgent === undefined
        ? []
        : [{ id: file.subAgent.id, path: file.path }],
    ),
  };
}

async function recordSkipped(
  run: Run,
  toSkip: { group: Group; project: string | null }[],
): Promise<number> {
  let count = 0;
  for (const { group, project } of toSkip) {
    if (!group.changed) continue;
    count += 1;
    for (const [path, sizeBytes] of group.sizes) {
      const row = { path, sessionId: group.id, sizeBytes, project };
      await run.tx
        .insert(skippedFile)
        .values(row)
        .onConflictDoUpdate({ target: skippedFile.path, set: row });
    }
  }
  return count;
}
