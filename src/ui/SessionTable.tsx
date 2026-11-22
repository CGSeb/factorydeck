import type { ReactElement } from 'react';
import { Link, useNavigate } from 'react-router';
import type { SessionSummary } from '../sessions/types.ts';
import { ProjectName } from './ProjectName.tsx';
import { formatAgo, formatCost, formatDuration, orMissing } from './format.ts';
import { SessionStateLabel } from './SessionStateLabel.tsx';
import { TokenCount } from './TokenCount.tsx';
import { WorkItemLink } from './WorkItemLink.tsx';
import { useProject, withProject } from './project-param.ts';

export function sessionTitle({
  title,
  id,
}: {
  title: string;
  id: string;
}): string {
  return title === '' ? id.slice(0, 8) : title;
}

export function sessionPath(id: string, project?: string): string {
  return withProject(`/sessions/${encodeURIComponent(id)}`, project);
}

function SessionTableHead(): ReactElement {
  return (
    <thead>
      <tr>
        <th scope="col">State</th>
        <th scope="col" className="left">
          Title
        </th>
        <th scope="col" className="left">
          Project
        </th>
        <th scope="col" className="left">
          Branch
        </th>
        <th scope="col">Work item</th>
        <th scope="col">Last activity</th>
        <th scope="col">Duration</th>
        <th scope="col">Tokens</th>
        <th scope="col">Cost</th>
      </tr>
    </thead>
  );
}

export interface SessionTableProps {
  sessions: SessionSummary[];
  now: Date;
}

export function SessionTable({
  sessions,
  now,
}: SessionTableProps): ReactElement {
  const navigate = useNavigate();
  const project = useProject();
  return (
    <table className="session-table" aria-label="Sessions">
      <SessionTableHead />
      <tbody>
        {sessions.map((row) => (
          <tr
            key={row.id}
            className="session-row"
            onClick={(event) => {
              if (
                event.target instanceof Element &&
                event.target.closest('a') !== null
              ) {
                return;
              }
              void navigate(sessionPath(row.id, project));
            }}
          >
            <td className="left">
              <SessionStateLabel state={row.state} />
            </td>
            <th scope="row" className="left">
              <Link to={sessionPath(row.id, project)}>{sessionTitle(row)}</Link>
            </th>
            <td className="left">
              <ProjectName project={row.project} name={row.projectName} />
            </td>
            <td className="left">{orMissing(row.gitBranch)}</td>
            <td>
              <WorkItemLink workItem={row.workItem} issue={row.issue} />
            </td>
            <td>{formatAgo(row.lastAt, now)}</td>
            <td>{formatDuration(row.firstAt, row.lastAt)}</td>
            <td>
              <TokenCount value={row.tokens} />
            </td>
            <td>{formatCost(row.costUsd)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
