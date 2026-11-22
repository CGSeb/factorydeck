import type { ReactElement } from 'react';
import { UNASSIGNED_PROJECT, projectText } from '../../projects/label.ts';
import { dotStyle, tagStyle } from './label-styles.ts';

export function ProjectTag({
  project,
  name,
  color,
}: {
  project: string;
  name: string;
  color: string;
}): ReactElement {
  const { text, title } = projectText(project, name);
  const unassigned = project === UNASSIGNED_PROJECT;
  return (
    <span
      title={unassigned ? undefined : title}
      style={{ ...tagStyle, color: 'var(--fd-ink-2)' }}
    >
      {unassigned ? null : (
        <span aria-hidden="true" style={dotStyle(8, '2px', color)} />
      )}
      {text}
    </span>
  );
}
