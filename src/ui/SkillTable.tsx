import type { ReactElement } from 'react';
import { Link } from 'react-router';
import { NO_SKILL_LABEL, type SkillUsage } from '../skills/types.ts';
import { BarCell } from './components/BarCell.tsx';
import { DataTable, NUMERIC_CELL } from './components/DataTable.tsx';
import { MISSING, formatCount } from './format.ts';
import { largestTokens, sortedSkills, tokensPerLaunch } from './skill-view.ts';
import { skillPath } from './skills-api.ts';
import './skills.css';

export interface SkillTableProps {
  skills: SkillUsage[];
  search: string;
}

function SkillRow({
  row,
  largest,
  search,
}: {
  row: SkillUsage;
  largest: number;
  search: string;
}): ReactElement {
  const named = row.skill !== null;
  return (
    <tr data-no-skill={named ? undefined : ''}>
      <th scope="row">
        {row.skill === null ? (
          <span className="fd-skill-none">{NO_SKILL_LABEL}</span>
        ) : (
          <Link className="fd-skill-name" to={skillPath(row.skill, search)}>
            {row.skill}
          </Link>
        )}
      </th>
      <td className={NUMERIC_CELL}>
        {named ? formatCount(row.launches) : MISSING}
      </td>
      <td className={NUMERIC_CELL}>
        {named ? formatCount(row.sessions) : MISSING}
      </td>
      <td className={`${NUMERIC_CELL} fd-skill-per-launch`}>
        {tokensPerLaunch(row.tokens, named ? row.launches : 0)}
      </td>
      <td className="fd-skill-bar">
        <BarCell
          counts={row.tokenCounts}
          costUsd={row.costUsd}
          largest={largest}
          color={named ? 'var(--fd-accent)' : 'var(--fd-stage-ready)'}
        />
      </td>
    </tr>
  );
}

export function SkillTable({ skills, search }: SkillTableProps): ReactElement {
  const rows = sortedSkills(skills);
  const largest = largestTokens(rows);
  return (
    <DataTable label="Skills">
      <table className="fd-skill-table" aria-label="Skills">
        <thead>
          <tr>
            <th scope="col">Skill</th>
            <th scope="col" className={NUMERIC_CELL}>
              Launches
            </th>
            <th scope="col" className={NUMERIC_CELL}>
              Sessions
            </th>
            <th scope="col" className={NUMERIC_CELL}>
              Tokens per launch
            </th>
            <th scope="col" className="fd-skill-bar">
              Tokens
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <SkillRow
              key={row.skill ?? ''}
              row={row}
              largest={largest}
              search={search}
            />
          ))}
        </tbody>
      </table>
    </DataTable>
  );
}
