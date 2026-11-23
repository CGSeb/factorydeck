import type { ReactElement } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import type { SessionDetail, SubAgentSummary } from '../sessions/types.ts';
import { NO_SKILL_LABEL, type SkillUsage } from '../skills/types.ts';
import { DataTable, NUMERIC_CELL } from './components/DataTable.tsx';
import type { RenderLink } from './components/link.ts';
import { PageHeader } from './components/PageHeader.tsx';
import { ProjectTag } from './components/ProjectTag.tsx';
import { RoleTag } from './components/RoleTag.tsx';
import { AgentTag } from './components/AgentTag.tsx';
import { SessionStateBadge } from './components/SessionStateBadge.tsx';
import { SplitPage } from './components/SplitPage.tsx';
import { StatusLine } from './components/StatusLine.tsx';
import { TokenAmount } from './components/TokenAmount.tsx';
import { projectColors, roleColors } from './design/palette.ts';
import {
  MISSING,
  formatCount,
  formatDateTime,
  formatDuration,
} from './format.ts';
import { UNREACHABLE_MESSAGE } from './overview-api.ts';
import { SessionAside } from './SessionAside.tsx';
import { agentName, byStart, hasSkill, useSession } from './session-detail.ts';
import {
  type LinkScope,
  issueHref,
  scopeOf,
  sessionTitle,
  sessionsHref,
  skillHref,
} from './session-links.ts';
import type { LoadSession } from './sessions-api.ts';
import { IssueNumberLink } from './SessionsPage.tsx';
import './sessions.css';

export interface SessionPageProps {
  loadSession: LoadSession;
}

const renderRouterLink: RenderLink = ({ href, ...props }) => (
  <Link to={href} {...props} />
);

function SubAgentRow({
  agent,
  color,
  project,
  scope,
}: {
  agent: SubAgentSummary;
  color: string;
  project: string;
  scope: LinkScope;
}): ReactElement {
  return (
    <tr>
      <th scope="row">{agentName(agent)}</th>
      <td>
        <RoleTag role={agent.role} color={color} />
      </td>
      <td>
        <IssueNumberLink
          workItem={agent.workItem}
          issue={agent.issue}
          project={project}
          scope={scope}
        />
      </td>
      <td className={NUMERIC_CELL}>{formatDateTime(agent.firstAt)}</td>
      <td className={NUMERIC_CELL}>
        {formatDuration(agent.firstAt, agent.lastAt)}
      </td>
      <td className={NUMERIC_CELL}>
        <TokenAmount counts={agent.tokenCounts} costUsd={agent.costUsd} />
      </td>
    </tr>
  );
}

function SubAgents({
  session,
  scope,
}: {
  session: SessionDetail;
  scope: LinkScope;
}): ReactElement {
  const agents = byStart(session.subAgents);
  const colors = roleColors(agents.map((agent) => agent.role));
  return (
    <section className="fd-session-section">
      <h2>
        Sub-agents
        <span className="fd-session-count">{formatCount(agents.length)}</span>
      </h2>
      {agents.length === 0 ? (
        <p className="fd-session-empty">No sub-agents.</p>
      ) : (
        <DataTable label="Sub-agents">
          <table className="fd-sub-agent-table">
            <thead>
              <tr>
                <th scope="col">Sub-agent</th>
                <th scope="col">Role</th>
                <th scope="col">Work item</th>
                <th scope="col" className={NUMERIC_CELL}>
                  Started
                </th>
                <th scope="col" className={NUMERIC_CELL}>
                  Duration
                </th>
                <th scope="col" className={NUMERIC_CELL}>
                  Tokens
                </th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <SubAgentRow
                  key={agent.id}
                  agent={agent}
                  color={colors.get(agent.role) ?? 'var(--fd-muted)'}
                  project={session.project}
                  scope={scope}
                />
              ))}
            </tbody>
          </table>
        </DataTable>
      )}
    </section>
  );
}

function Skills({
  skills,
  scope,
}: {
  skills: SkillUsage[];
  scope: LinkScope;
}): ReactElement {
  return (
    <section className="fd-session-section">
      <h2>Skills</h2>
      <DataTable label="Skills">
        <table className="fd-skill-table">
          <thead>
            <tr>
              <th scope="col">Skill</th>
              <th scope="col" className={NUMERIC_CELL}>
                Launches
              </th>
              <th scope="col" className={NUMERIC_CELL}>
                Tokens
              </th>
            </tr>
          </thead>
          <tbody>
            {skills.map((row) => (
              <tr key={row.skill ?? ''}>
                <th scope="row">
                  {row.skill === null ? (
                    NO_SKILL_LABEL
                  ) : (
                    <Link
                      className="fd-session-mono"
                      to={skillHref(row.skill, scope)}
                    >
                      {row.skill}
                    </Link>
                  )}
                </th>
                <td className={NUMERIC_CELL}>
                  {row.skill === null ? MISSING : formatCount(row.launches)}
                </td>
                <td className={NUMERIC_CELL}>
                  <TokenAmount counts={row.tokenCounts} costUsd={row.costUsd} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTable>
    </section>
  );
}

function SessionLine({
  session,
  scope,
}: {
  session: SessionDetail;
  scope: LinkScope;
}): ReactElement {
  const colors = projectColors(session.projects.map((row) => row.project));
  return (
    <span className="fd-session-line">
      <SessionStateBadge state={session.state} />
      <AgentTag agent={session.agent} />
      <ProjectTag
        project={session.project}
        name={session.projectName}
        color={colors.get(session.project) ?? 'var(--fd-muted)'}
      />
      <span className="fd-session-mono">
        {session.gitBranches.length === 0
          ? MISSING
          : session.gitBranches.join(', ')}
      </span>
      {session.workItem !== null && (
        <span>
          Work item{' '}
          <Link to={issueHref(session.workItem, session.project, scope)}>
            #{session.workItem}
          </Link>
        </span>
      )}
    </span>
  );
}

export function SessionPage({ loadSession }: SessionPageProps): ReactElement {
  const { id = '' } = useParams();
  const [searchParams] = useSearchParams();
  const scope = scopeOf(searchParams);
  const response = useSession(loadSession, id);
  const back = { label: 'Sessions', href: sessionsHref(scope) };

  if (response?.status !== 'ok') {
    return (
      <div className="fd-sessions">
        <Link className="fd-back" to={back.href}>
          ← {back.label}
        </Link>
        <StatusLine>
          {response === undefined
            ? 'Loading…'
            : response.status === 'not-found'
              ? 'Session not found.'
              : UNREACHABLE_MESSAGE}
        </StatusLine>
      </div>
    );
  }

  const { session } = response;
  return (
    <div className="fd-sessions fd-session-card">
      <SplitPage aside={<SessionAside session={session} />}>
        <div className="fd-session-main">
          <PageHeader
            title={sessionTitle(session)}
            back={back}
            summary={<SessionLine session={session} scope={scope} />}
            renderLink={renderRouterLink}
          />
          <SubAgents session={session} scope={scope} />
          {hasSkill(session.skills) && (
            <Skills skills={session.skills} scope={scope} />
          )}
        </div>
      </SplitPage>
    </div>
  );
}
