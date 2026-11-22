import type { ReactElement } from 'react';
import { ProjectSelect, type ProjectSelectProps } from '../ProjectSelect.tsx';
import './controls.css';

export type ProjectPillProps = Omit<ProjectSelectProps, 'className'>;

export function ProjectPill(props: ProjectPillProps): ReactElement {
  return (
    <ProjectSelect
      {...props}
      className="fd-control fd-select-trigger fd-project-pill"
    />
  );
}
