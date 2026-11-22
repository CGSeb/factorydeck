import type { ReactElement } from 'react';
import { Select } from './components/Select.tsx';
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
  className?: string;
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
  className = 'fd-control fd-select-trigger',
}: ProjectSelectProps): ReactElement {
  const options = projectOptions(value, projects);
  return (
    <Select
      className={className}
      ariaLabel="Project"
      title={tooltipOf(value, options)}
      value={value ?? ''}
      align="end"
      options={[
        { value: '', label: ALL_PROJECTS },
        ...options.map((option) => ({
          value: option.project,
          label: projectText(option.project, option.name).text,
        })),
      ]}
      onChange={(next) => onChange(next || undefined)}
    />
  );
}
