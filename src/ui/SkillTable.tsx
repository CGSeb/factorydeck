import { type ReactElement, useId } from 'react';
import { Link } from 'react-router';
import { NO_SKILL_LABEL, type SkillUsage } from '../skills/types.ts';
import { MISSING, formatCost, formatCount } from './format.ts';
import { skillPath } from './skills-api.ts';
import { TokenCount } from './TokenCount.tsx';

export interface SkillTableProps {
  skills: SkillUsage[];
  search: string;
}

export function SkillTable({ skills, search }: SkillTableProps): ReactElement {
  const titleId = useId();
  return (
    <section className="panel" aria-labelledby={titleId}>
      <h2 id={titleId}>By skill</h2>
      <table aria-labelledby={titleId}>
        <thead>
          <tr>
            <th scope="col">Skill</th>
            <th scope="col">Launches</th>
            <th scope="col">Sessions</th>
            <th scope="col">Tokens</th>
            <th scope="col">Cost</th>
            <th scope="col">Average cost per launch</th>
          </tr>
        </thead>
        <tbody>
          {skills.map((row) =>
            row.skill === null ? (
              <tr key="">
                <th scope="row">{NO_SKILL_LABEL}</th>
                <td>{MISSING}</td>
                <td>{MISSING}</td>
                <td>
                  <TokenCount value={row.tokens} />
                </td>
                <td>{formatCost(row.costUsd)}</td>
                <td>{MISSING}</td>
              </tr>
            ) : (
              <tr key={row.skill}>
                <th scope="row">
                  <Link to={skillPath(row.skill, search)}>{row.skill}</Link>
                </th>
                <td>{formatCount(row.launches)}</td>
                <td>{formatCount(row.sessions)}</td>
                <td>
                  <TokenCount value={row.tokens} />
                </td>
                <td>{formatCost(row.costUsd)}</td>
                <td>{formatCost(row.averageCostUsd)}</td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </section>
  );
}
