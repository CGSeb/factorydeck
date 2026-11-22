import { type ReactElement, useId } from 'react';
import { Link, useParams } from 'react-router';
import type { Period } from '../overview/types.ts';
import type { SkillDetail, SkillResponse } from '../skills/types.ts';
import { ProjectName } from './ProjectName.tsx';
import { formatClock, formatCost, formatCount } from './format.ts';
import { LaunchChart } from './LaunchChart.tsx';
import { UNREACHABLE_MESSAGE } from './overview-api.ts';
import { PeriodSelector } from './PeriodSelector.tsx';
import { useProject } from './project-param.ts';
import { sessionPath, sessionTitle } from './SessionTable.tsx';
import {
  type LoadSkill,
  useRefreshing,
  useSkillFilters,
} from './skills-api.ts';
import { TokenCount } from './TokenCount.tsx';

export interface SkillPageProps {
  loadSkill: LoadSkill;
}

function SkillFacts({ skill }: { skill: SkillDetail }): ReactElement {
  return (
    <section className="panel" aria-label="Skill">
      <dl className="session-facts">
        <div>
          <dt>Launches</dt>
          <dd>{formatCount(skill.launches)}</dd>
        </div>
        <div>
          <dt>Tokens</dt>
          <dd>
            <TokenCount value={skill.tokens} />
          </dd>
        </div>
        <div>
          <dt>Cost</dt>
          <dd>{formatCost(skill.costUsd)}</dd>
        </div>
        <div>
          <dt>Average cost per launch</dt>
          <dd>{formatCost(skill.averageCostUsd)}</dd>
        </div>
      </dl>
    </section>
  );
}

function SkillSessions({ skill }: { skill: SkillDetail }): ReactElement {
  const project = useProject();
  const titleId = useId();
  return (
    <section className="panel" aria-labelledby={titleId}>
      <h2 id={titleId}>Sessions that launched it</h2>
      {skill.sessions.length === 0 ? (
        <p className="status">No session launched this skill in this period.</p>
      ) : (
        <div className="table-scroll">
          <table aria-labelledby={titleId}>
            <thead>
              <tr>
                <th scope="col">Session</th>
                <th scope="col" className="left">
                  Project
                </th>
                <th scope="col">Launches</th>
                <th scope="col">Tokens</th>
                <th scope="col">Cost</th>
              </tr>
            </thead>
            <tbody>
              {skill.sessions.map((row) => (
                <tr key={row.id}>
                  <th scope="row">
                    <Link to={sessionPath(row.id, project)}>
                      {sessionTitle(row)}
                    </Link>
                  </th>
                  <td className="left">
                    <ProjectName project={row.project} name={row.projectName} />
                  </td>
                  <td>{formatCount(row.launches)}</td>
                  <td>
                    <TokenCount value={row.tokens} />
                  </td>
                  <td>{formatCost(row.costUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function SkillContent({
  response,
}: {
  response: SkillResponse | undefined;
}): ReactElement {
  if (response === undefined) return <p className="status">Loading…</p>;
  if (response.status === 'unreachable') {
    return <p className="status">{UNREACHABLE_MESSAGE}</p>;
  }
  return (
    <>
      <SkillFacts skill={response.skill} />
      <LaunchChart series={response.skill.series} />
      <SkillSessions skill={response.skill} />
    </>
  );
}

export function SkillPage({ loadSkill }: SkillPageProps): ReactElement {
  const { name = '' } = useParams();
  const [filters, setFilters, search] = useSkillFilters();
  const response = useRefreshing(JSON.stringify({ name, ...filters }), () =>
    loadSkill(name, filters),
  );
  const updatedAt =
    response?.status === 'ok' && response.updatedAt !== null
      ? formatClock(new Date(response.updatedAt))
      : undefined;

  return (
    <div className="sessions">
      <Link className="back-link" to={`/skills${search}`}>
        Back to skills
      </Link>
      <div className="overview-header">
        <h1>{name}</h1>
        {updatedAt !== undefined && (
          <p className="updated">Updated {updatedAt}</p>
        )}
        <PeriodSelector
          value={filters.period}
          onChange={(period: Period) => setFilters({ ...filters, period })}
        />
      </div>
      <SkillContent response={response} />
    </div>
  );
}
