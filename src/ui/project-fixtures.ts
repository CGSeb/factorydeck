import { type ProjectOption, folderName } from '../projects/label.ts';

const NAMES: Readonly<Record<string, string>> = {
  '/home/dev/example-app': 'Example App',
  '/home/dev/old-app': 'Old App',
  'example-app': 'Example App',
  'old-app': 'Old App',
};

export function nameOf(project: string): string {
  return NAMES[project] ?? folderName(project);
}

export function optionsOf(projects: readonly string[]): ProjectOption[] {
  return projects
    .map((project) => ({ project, name: nameOf(project) }))
    .sort((a, b) =>
      a.name.toLowerCase() < b.name.toLowerCase()
        ? -1
        : a.name.toLowerCase() > b.name.toLowerCase()
          ? 1
          : 0,
    );
}
