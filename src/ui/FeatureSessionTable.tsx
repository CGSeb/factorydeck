import { type ReactElement, useId } from 'react';
import { Link } from 'react-router';
import type { FeatureSession } from '../features/types.ts';
import { formatAgo, formatCost } from './format.ts';
import { SessionStateLabel } from './SessionStateLabel.tsx';
import { sessionPath, sessionTitle } from './SessionTable.tsx';
import { TokenCount } from './TokenCount.tsx';

export interface FeatureSessionTableProps {
  sessions: FeatureSession[];
  now: Date;
}

export function FeatureSessionTable({
  sessions,
  now,
}: FeatureSessionTableProps): ReactElement {
  const titleId = useId();
  return (
    <section className="panel" aria-labelledby={titleId}>
      <h2 id={titleId}>Sessions</h2>
      {sessions.length === 0 ? (
        <p className="status">
          No session worked on this issue in this period.
        </p>
      ) : (
        <table aria-labelledby={titleId}>
          <thead>
            <tr>
              <th scope="col">Session</th>
              <th scope="col" className="left">
                State
              </th>
              <th scope="col">Last activity</th>
              <th scope="col">Tokens</th>
              <th scope="col">Cost</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((row) => (
              <tr key={row.id}>
                <th scope="row">
                  <Link to={sessionPath(row.id)}>{sessionTitle(row)}</Link>
                </th>
                <td className="left">
                  <SessionStateLabel state={row.state} />
                </td>
                <td>{formatAgo(row.lastAt, now)}</td>
                <td>
                  <TokenCount value={Math.round(row.tokens)} />
                </td>
                <td>{formatCost(row.costUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
