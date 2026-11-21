import type { ReactElement } from 'react';
import { Link, useNavigate } from 'react-router';
import type { SessionSummary } from '../sessions/types.ts';
import { formatAgo, formatCost, formatDuration, orMissing } from './format.ts';
import { SessionStateLabel } from './SessionStateLabel.tsx';
import { TokenCount } from './TokenCount.tsx';

export function sessionTitle({
  title,
  id,
}: {
  title: string;
  id: string;
}): string {
  return title === '' ? id.slice(0, 8) : title;
}

export function sessionPath(id: string): string {
  return `/sessions/${encodeURIComponent(id)}`;
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
  return (
    <table aria-label="Sessions">
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
          <th scope="col">Last activity</th>
          <th scope="col">Duration</th>
          <th scope="col">Tokens</th>
          <th scope="col">Cost</th>
        </tr>
      </thead>
      <tbody>
        {sessions.map((row) => (
          <tr
            key={row.id}
            className="session-row"
            onClick={() => void navigate(sessionPath(row.id))}
          >
            <td className="left">
              <SessionStateLabel state={row.state} />
            </td>
            <th scope="row" className="left">
              <Link to={sessionPath(row.id)}>{sessionTitle(row)}</Link>
            </th>
            <td className="left">{row.project}</td>
            <td className="left">{orMissing(row.gitBranch)}</td>
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
