import { eq } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import { project, projectRoot } from '../db/schema.ts';
import type { Transaction } from '../ingest/store.ts';
import { type ProjectOption, duplicateLabel, folderName } from './label.ts';

export interface ProjectNames {
  label: (project: string) => string;
  rootLabel: (root: string) => string;
  options: (projects?: readonly string[]) => ProjectOption[];
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export async function projectNames(
  db: Database | Transaction,
): Promise<ProjectNames> {
  const [projects, roots] = await Promise.all([
    db.select({ slug: project.slug, name: project.name }).from(project),
    db.select().from(projectRoot),
  ]);
  const names = new Map(projects.map((row) => [row.slug, row.name]));
  const counts = new Map<string, number>();
  for (const { name } of projects) {
    const key = name.toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const label = (slug: string): string => {
    const name = names.get(slug);
    if (name === undefined) return slug;
    return (counts.get(name.toLowerCase()) ?? 0) > 1
      ? duplicateLabel(name, slug)
      : name;
  };
  const projectOfRoot = new Map(roots.map((row) => [row.root, row.project]));
  const listed = projects.map((row) => row.slug);
  return {
    label,
    rootLabel: (root) => {
      const slug = projectOfRoot.get(root);
      return slug === undefined ? folderName(root) : label(slug);
    },
    options: (selected = listed) =>
      selected
        .map((slug) => ({
          project: slug,
          name: label(slug),
          key: (names.get(slug) ?? slug).toLowerCase(),
        }))
        .sort(
          (a, b) =>
            compareText(a.key, b.key) || compareText(a.project, b.project),
        )
        .map(({ project: slug, name }) => ({ project: slug, name })),
  };
}

export async function rootsOfProject(
  db: Database | Transaction,
  slug: string,
): Promise<string[]> {
  const rows = await db
    .select({ root: projectRoot.root })
    .from(projectRoot)
    .where(eq(projectRoot.project, slug))
    .orderBy(projectRoot.root);
  return rows.map((row) => row.root);
}
