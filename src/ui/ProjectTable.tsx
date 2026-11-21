import { type ReactElement, useId } from 'react';
import type { ProjectUsage } from '../overview/types.ts';
import { formatCost, formatCount } from './format.ts';
import { TokenCount } from './TokenCount.tsx';

export function ProjectTable({
  projects,
}: {
  projects: ProjectUsage[];
}): ReactElement {
  const titleId = useId();
  return (
    <section className="panel" aria-labelledby={titleId}>
      <h2 id={titleId}>By project</h2>
      <table aria-labelledby={titleId}>
        <thead>
          <tr>
            <th scope="col">Project</th>
            <th scope="col">Sessions</th>
            <th scope="col">API calls</th>
            <th scope="col">Tokens</th>
            <th scope="col">Cost</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((row) => (
            <tr key={row.project}>
              <th scope="row">{row.project}</th>
              <td>{formatCount(row.sessions)}</td>
              <td>{formatCount(row.apiCalls)}</td>
              <td>
                <TokenCount value={row.tokens} />
              </td>
              <td>{formatCost(row.costUsd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
