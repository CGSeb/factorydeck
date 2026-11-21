import type { ReactElement } from 'react';
import type { WorkItemIssue } from '../git-host/types.ts';
import { formatWorkItem } from './format.ts';

export interface WorkItemLinkProps {
  workItem: number | null;
  issue: WorkItemIssue | null;
}

export function WorkItemLink({
  workItem,
  issue,
}: WorkItemLinkProps): ReactElement {
  const label = formatWorkItem(workItem);
  if (workItem === null || issue === null) return <>{label}</>;
  if (issue.status === 'found') {
    return (
      <a
        className="work-item"
        href={issue.url}
        title={issue.title}
        target="_blank"
        rel="noreferrer"
      >
        {label}
      </a>
    );
  }
  if (issue.status === 'not-found') return <>{label} (not found)</>;
  return <>{label}</>;
}
