import { type ReactElement, useId } from 'react';
import type { SubAgentSummary } from '../sessions/types.ts';
import {
  formatCost,
  formatDateTime,
  formatDuration,
  orMissing,
} from './format.ts';
import { TokenCount } from './TokenCount.tsx';

export function SubAgentTable({
  subAgents,
}: {
  subAgents: SubAgentSummary[];
}): ReactElement {
  const titleId = useId();
  return (
    <section className="panel" aria-labelledby={titleId}>
      <h2 id={titleId}>Sub-agents</h2>
      {subAgents.length === 0 ? (
        <p className="status">No sub-agents.</p>
      ) : (
        <table aria-labelledby={titleId}>
          <thead>
            <tr>
              <th scope="col">Type</th>
              <th scope="col" className="left">
                Description
              </th>
              <th scope="col" className="left">
                Model
              </th>
              <th scope="col">First activity</th>
              <th scope="col">Duration</th>
              <th scope="col">Tokens</th>
              <th scope="col">Cost</th>
            </tr>
          </thead>
          <tbody>
            {subAgents.map((agent) => (
              <tr key={agent.id}>
                <th scope="row">{orMissing(agent.agentType)}</th>
                <td className="left">{orMissing(agent.description)}</td>
                <td className="left">{orMissing(agent.model)}</td>
                <td>{formatDateTime(agent.firstAt)}</td>
                <td>{formatDuration(agent.firstAt, agent.lastAt)}</td>
                <td>
                  <TokenCount value={agent.tokens} />
                </td>
                <td>{formatCost(agent.costUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
