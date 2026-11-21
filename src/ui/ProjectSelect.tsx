import { type ReactElement, useId } from 'react';

export interface ProjectSelectProps {
  value: string | undefined;
  projects: string[];
  onChange: (project: string | undefined) => void;
}

export function ProjectSelect({
  value,
  projects,
  onChange,
}: ProjectSelectProps): ReactElement {
  const id = useId();
  const options =
    value === undefined || projects.includes(value)
      ? projects
      : [...projects, value];
  return (
    <div className="filters">
      <label htmlFor={id}>
        Project
        <select
          id={id}
          value={value ?? ''}
          onChange={(event) => onChange(event.target.value || undefined)}
        >
          <option value="">All projects</option>
          {options.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
