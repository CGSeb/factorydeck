import type { ReactElement } from 'react';
import {
  type ProjectOption,
  folderName,
  projectText,
} from '../projects/label.ts';

export const ALL_PROJECTS = 'All projects';

export interface ProjectSelectProps {
  value: string | undefined;
  projects: ProjectOption[];
  onChange: (project: string | undefined) => void;
}

function projectOptions(
  value: string | undefined,
  projects: ProjectOption[],
): ProjectOption[] {
  return value === undefined ||
    projects.some((option) => option.project === value)
    ? projects
    : [...projects, { project: value, name: folderName(value) }];
}

function tooltipOf(
  value: string | undefined,
  options: ProjectOption[],
): string {
  const selected = options.find((option) => option.project === value);
  if (selected === undefined) return ALL_PROJECTS;
  const { text, title } = projectText(selected.project, selected.name);
  return title === undefined || title.includes('\n')
    ? (title ?? text)
    : `${text}\n${title}`;
}

export function ProjectSelect({
  value,
  projects,
  onChange,
}: ProjectSelectProps): ReactElement {
  const options = projectOptions(value, projects);
  return (
    <select
      className="project-select"
      aria-label="Project"
      title={tooltipOf(value, options)}
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value || undefined)}
    >
      <option value="">{ALL_PROJECTS}</option>
      {options.map((option) => (
        <option key={option.project} value={option.project}>
          {projectText(option.project, option.name).text}
        </option>
      ))}
    </select>
  );
}
