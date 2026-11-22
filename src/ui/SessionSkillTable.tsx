import { type ReactElement, useId } from 'react';
import { NO_SKILL_LABEL, type SkillUsage } from '../skills/types.ts';
import { MISSING, formatCost, formatCount } from './format.ts';
import { TokenCount } from './TokenCount.tsx';

export function SessionSkillTable({
  skills,
}: {
  skills: SkillUsage[];
}): ReactElement {
  const titleId = useId();
  return (
    <section className="panel" aria-labelledby={titleId}>
      <h2 id={titleId}>Skills</h2>
      <div className="table-scroll">
        <table aria-labelledby={titleId}>
          <thead>
            <tr>
              <th scope="col">Skill</th>
              <th scope="col">Launches</th>
              <th scope="col">Tokens</th>
              <th scope="col">Cost</th>
            </tr>
          </thead>
          <tbody>
            {skills.map((row) => (
              <tr key={row.skill ?? ''}>
                <th scope="row">{row.skill ?? NO_SKILL_LABEL}</th>
                <td>
                  {row.skill === null ? MISSING : formatCount(row.launches)}
                </td>
                <td>
                  <TokenCount value={row.tokens} />
                </td>
                <td>{formatCost(row.costUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
