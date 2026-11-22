import type { ReactElement } from 'react';
import { projectText } from '../projects/label.ts';

export function ProjectName({
  project,
  name,
}: {
  project: string;
  name: string;
}): ReactElement {
  const { text, title } = projectText(project, name);
  return <span title={title}>{text}</span>;
}
