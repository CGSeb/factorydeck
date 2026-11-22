/** Project of a session with no working directory in any record. */
export const UNASSIGNED_PROJECT = 'unassigned';

export const NAME_LIMIT = 60;

export interface ProjectOption {
  project: string;
  name: string;
}

export function folderName(project: string): string {
  return project.split(/[\\/]/).findLast((part) => part !== '') ?? project;
}

export function duplicateLabel(name: string, project: string): string {
  return `${name} (${project})`;
}

export interface ProjectText {
  text: string;
  title: string | undefined;
}

export function projectText(project: string, label: string): ProjectText {
  if (project === UNASSIGNED_PROJECT) return { text: label, title: undefined };
  const suffix = ` (${project})`;
  const duplicated = label.endsWith(suffix) && label.length > suffix.length;
  const name = duplicated ? label.slice(0, -suffix.length) : label;
  const chars = Array.from(
    new Intl.Segmenter().segment(name),
    (part) => part.segment,
  );
  if (chars.length <= NAME_LIMIT) return { text: label, title: project };
  const short = `${chars.slice(0, NAME_LIMIT).join('')}…`;
  return {
    text: duplicated ? `${short}${suffix}` : short,
    title: `${name}\n${project}`,
  };
}
