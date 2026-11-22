import type { ReactElement } from 'react';
import { Link, useParams } from 'react-router';
import type { Period } from '../overview/types.ts';
import type {
  SkillDetail,
  SkillResponse,
  SkillSession,
} from '../skills/types.ts';
import { DataTable, NUMERIC_CELL } from './components/DataTable.tsx';
import { DayBars } from './components/DayBars.tsx';
import type { RenderLink } from './components/link.ts';
import { PageHeader } from './components/PageHeader.tsx';
import { Panel } from './components/Panel.tsx';
import { PeriodPills } from './components/PeriodPills.tsx';
import { ProjectTag } from './components/ProjectTag.tsx';
import { StatusLine } from './components/StatusLine.tsx';
import { TokenAmount } from './components/TokenAmount.tsx';
import { UNASSIGNED_COLOR, projectColors } from './design/palette.ts';
import { formatCount } from './format.ts';
import { UNREACHABLE_MESSAGE } from './overview-api.ts';
import { useProject } from './project-param.ts';
import { sessionPath, sessionTitle } from './session-links.ts';
import { sortedSessions, tokensPerLaunch } from './skill-view.ts';
import {
  type LoadSkill,
  useRefreshing,
  useSkillFilters,
} from './skills-api.ts';
import './skills.css';

export interface SkillPageProps {
  loadSkill: LoadSkill;
}

const renderRouterLink: RenderLink = ({ href, ...props }) => (
  <Link to={href} {...props} />
);

function SkillFigures({ skill }: { skill: SkillDetail }): ReactElement {
  return (
    <dl className="fd-skill-figures">
      <div>
        <dt>Launches</dt>
        <dd>{formatCount(skill.launches)}</dd>
      </div>
      <div>
        <dt>Tokens</dt>
        <dd>
          <TokenAmount
            counts={skill.tokenCounts}
            costUsd={skill.costUsd}
            placement="below"
          />
        </dd>
      </div>
      <div>
        <dt>Per launch</dt>
        <dd>{tokensPerLaunch(skill.tokens, skill.launches)}</dd>
      </div>
    </dl>
  );
}

function SkillLaunches({
  skill,
  period,
}: {
  skill: SkillDetail;
  period: Period;
}): ReactElement {
  const label = period === 'today' ? 'Launches per hour' : 'Launches per day';
  return (
    <section className="fd-skill-launches" aria-label={label}>
      <h2>{label}</h2>
      <DayBars
        label={label}
        buckets={skill.series.map((point) => ({
          label: point.day,
          value: point.launches,
        }))}
        color="var(--fd-accent)"
        height={80}
        showValues
      />
    </section>
  );
}

function SessionRow({
  row,
  project,
  color,
}: {
  row: SkillSession;
  project: string | undefined;
  color: string | undefined;
}): ReactElement {
  return (
    <tr>
      <th scope="row">
        <Link to={sessionPath(row.id, project)}>{sessionTitle(row)}</Link>
      </th>
      {color !== undefined && (
        <td>
          <ProjectTag
            project={row.project}
            name={row.projectName}
            color={color}
          />
        </td>
      )}
      <td className={NUMERIC_CELL}>{formatCount(row.launches)}</td>
      <td className={NUMERIC_CELL}>
        <TokenAmount
          counts={row.tokenCounts}
          costUsd={row.costUsd}
          size="strong"
        />
      </td>
    </tr>
  );
}

function SkillSessions({ skill }: { skill: SkillDetail }): ReactElement {
  const project = useProject();
  const allProjects = project === undefined;
  const colors = projectColors(skill.projects.map((option) => option.project));
  return (
    <Panel>
      <div className="fd-panel-head">
        <h2 className="fd-panel-heading">Sessions that launched it</h2>
      </div>
      {skill.sessions.length === 0 ? (
        <StatusLine>No session launched this skill in this period.</StatusLine>
      ) : (
        <DataTable label="Sessions that launched it">
          <table
            className="fd-skill-session-table"
            aria-label="Sessions that launched it"
          >
            <thead>
              <tr>
                <th scope="col">Session</th>
                {allProjects && <th scope="col">Project</th>}
                <th scope="col" className={NUMERIC_CELL}>
                  Launches
                </th>
                <th scope="col" className={NUMERIC_CELL}>
                  Tokens
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedSessions(skill.sessions).map((row) => (
                <SessionRow
                  key={row.id}
                  row={row}
                  project={project}
                  color={
                    allProjects
                      ? (colors.get(row.project) ?? UNASSIGNED_COLOR)
                      : undefined
                  }
                />
              ))}
            </tbody>
          </table>
        </DataTable>
      )}
    </Panel>
  );
}

function SkillContent({
  response,
  period,
}: {
  response: SkillResponse | undefined;
  period: Period;
}): ReactElement {
  if (response === undefined) return <StatusLine>Loading…</StatusLine>;
  if (response.status === 'unreachable') {
    return <StatusLine>{UNREACHABLE_MESSAGE}</StatusLine>;
  }
  const { skill } = response;
  return (
    <>
      <Panel>
        <div className="fd-skill-top">
          <SkillFigures skill={skill} />
          <SkillLaunches skill={skill} period={period} />
        </div>
      </Panel>
      <SkillSessions skill={skill} />
    </>
  );
}

export function SkillPage({ loadSkill }: SkillPageProps): ReactElement {
  const { name = '' } = useParams();
  const [filters, setFilters, search] = useSkillFilters();
  const response = useRefreshing(
    JSON.stringify({ name, ...filters }),
    () => loadSkill(name, filters),
    name,
  );
  return (
    <div className="fd-skills">
      <PageHeader
        back={{ label: 'Skills', href: `/skills${search}` }}
        title={<span className="fd-skill-title">{name}</span>}
        slot={
          <PeriodPills
            value={filters.period}
            onChange={(period: Period) => setFilters({ ...filters, period })}
          />
        }
        renderLink={renderRouterLink}
      />
      <SkillContent response={response} period={filters.period} />
    </div>
  );
}
