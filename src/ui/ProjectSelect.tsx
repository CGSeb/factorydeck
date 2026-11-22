import { type ReactElement, useId } from 'react';
import {
  type ProjectOption,
  folderName,
  projectText,
} from '../projects/label.ts';

export interface ProjectSelectProps {
  value: string | undefined;
  projects: ProjectOption[];
  onChange: (project: string | undefined) => void;
}

export function ProjectSelect({
  value,
  projects,
  onChange,
}: ProjectSelectProps): ReactElement {
  const id = useId();
  const options =
    value === undefined || projects.some((option) => option.project === value)
      ? projects
      : [...projects, { project: value, name: folderName(value) }];
  return (
    <label htmlFor={id}>
      Project
      <select
        id={id}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value || undefined)}
      >
        <option value="">All projects</option>
        {options.map((option) => (
          <option key={option.project} value={option.project}>
            {projectText(option.project, option.name).text}
          </option>
        ))}
      </select>
    </label>
  );
}
