import { readFile } from 'node:fs/promises';
import { inArray, ne, sql } from 'drizzle-orm';
import { parseDocument } from 'yaml';
import type { Database } from '../db/client.ts';
import { UNASSIGNED_PROJECT, projectName, session } from '../db/schema.ts';
import { factoryFile } from '../ingest/factory.ts';
import { isObject } from '../ingest/records.ts';
import type { Transaction } from '../ingest/store.ts';
import { type ProjectOption, duplicateLabel, folderName } from './label.ts';

export function cleanProjectName(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const name = value.replace(/\s+/g, ' ').trim();
  return name === '' ? undefined : name;
}

export async function readProjectName(
  root: string,
): Promise<string | undefined> {
  const source = await readFile(factoryFile(root), 'utf8').catch(
    () => undefined,
  );
  if (source === undefined) return undefined;
  try {
    const document = parseDocument(source);
    if (document.errors.length > 0) return undefined;
    const content: unknown = document.toJS();
    if (!isObject(content)) return undefined;
    const project = content['project'];
    return isObject(project) ? cleanProjectName(project['name']) : undefined;
  } catch {
    return undefined;
  }
}

export async function storeProjectNames(tx: Transaction): Promise<void> {
  const projects = await tx
    .selectDistinct({ project: session.project })
    .from(session)
    .where(ne(session.project, UNASSIGNED_PROJECT));
  const names: { project: string; name: string }[] = [];
  for (const { project } of projects) {
    const name = await readProjectName(project);
    if (name !== undefined) names.push({ project, name });
  }
  if (names.length === 0) return;
  await tx
    .insert(projectName)
    .values(names)
    .onConflictDoUpdate({
      target: projectName.project,
      set: { name: sql`excluded.name` },
    });
}

export async function forgetProjectNames(
  tx: Transaction,
  projects: string[],
): Promise<void> {
  await tx.delete(projectName).where(inArray(projectName.project, projects));
}

export interface ProjectNames {
  label: (project: string) => string;
  options: (projects?: readonly string[]) => ProjectOption[];
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export async function projectNames(
  db: Database | Transaction,
): Promise<ProjectNames> {
  const [stored, withSessions] = await Promise.all([
    db.select().from(projectName),
    db.selectDistinct({ project: session.project }).from(session),
  ]);
  const names = new Map(stored.map((row) => [row.project, row.name]));
  const nameOf = (project: string): string =>
    project === UNASSIGNED_PROJECT
      ? project
      : (names.get(project) ?? folderName(project));
  const counts = new Map<string, number>();
  for (const { project } of withSessions) {
    if (project === UNASSIGNED_PROJECT) continue;
    const key = nameOf(project).toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const label = (project: string): string => {
    const name = nameOf(project);
    return project !== UNASSIGNED_PROJECT &&
      (counts.get(name.toLowerCase()) ?? 0) > 1
      ? duplicateLabel(name, project)
      : name;
  };
  const listed = withSessions.map((row) => row.project);
  return {
    label,
    options: (projects = listed) =>
      projects
        .map((project) => ({
          project,
          name: label(project),
          key: nameOf(project).toLowerCase(),
        }))
        .sort(
          (a, b) =>
            compareText(a.key, b.key) || compareText(a.project, b.project),
        )
        .map(({ project, name }) => ({ project, name })),
  };
}
