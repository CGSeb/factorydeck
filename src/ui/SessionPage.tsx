import { type ReactElement, type ReactNode, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import type { TokenCounts } from '../overview/types.ts';
import type { SessionDetail, SessionResponse } from '../sessions/types.ts';
import {
  formatClock,
  formatCost,
  formatDateTime,
  orMissing,
} from './format.ts';
import { ProjectName } from './ProjectName.tsx';
import { IssuePanel } from './IssuePanel.tsx';
import { useProject, withProject } from './project-param.ts';
import { UNREACHABLE_MESSAGE } from './overview-api.ts';
import type { LoadSession } from './sessions-api.ts';
import { SessionSkillTable } from './SessionSkillTable.tsx';
import { SessionStateLabel } from './SessionStateLabel.tsx';
import { sessionTitle } from './SessionTable.tsx';
import { SubAgentTable } from './SubAgentTable.tsx';
import { TokenCount } from './TokenCount.tsx';
import { WorkItemLink } from './WorkItemLink.tsx';

const RETRY_SECONDS = 10;

export interface SessionPageProps {
  loadSession: LoadSession;
}

function TokenBreakdown({ tokens }: { tokens: TokenCounts }): ReactElement {
  const kinds = [
    { label: 'Input', value: tokens.input },
    { label: 'Cache write', value: tokens.cacheWrite },
    { label: 'Cache read', value: tokens.cacheRead },
    { label: 'Output', value: tokens.output },
  ];
  return (
    <>
      <TokenCount value={kinds.reduce((sum, { value }) => sum + value, 0)} />
      <dl className="breakdown">
        {kinds.map(({ label, value }) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>
              <TokenCount value={value} />
            </dd>
          </div>
        ))}
      </dl>
    </>
  );
}

function SessionHeader({
  session,
  updatedAt,
}: {
  session: SessionDetail;
  updatedAt: string | null;
}): ReactElement {
  const { tokens } = session;
  const facts: { label: string; value: ReactNode }[] = [
    {
      label: 'Project',
      value: (
        <ProjectName project={session.project} name={session.projectName} />
      ),
    },
    { label: 'Working directory', value: orMissing(session.cwd ?? '') },
    { label: 'Branch', value: orMissing(session.gitBranch) },
    {
      label: 'Work item',
      value: <WorkItemLink workItem={session.workItem} issue={session.issue} />,
    },
    { label: 'First activity', value: formatDateTime(session.firstAt) },
    { label: 'Last activity', value: formatDateTime(session.lastAt) },
    { label: 'Cost', value: formatCost(session.costUsd) },
  ];
  return (
    <>
      <div className="session-title">
        <h1>{sessionTitle(session)}</h1>
        <SessionStateLabel state={session.state} />
        {updatedAt !== null && (
          <p className="updated">Updated {formatClock(new Date(updatedAt))}</p>
        )}
      </div>
      <section className="panel" aria-label="Session">
        <dl className="session-facts">
          {facts.map(({ label, value }) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
          <div>
            <dt>Tokens</dt>
            <dd>
              <TokenBreakdown tokens={tokens} />
            </dd>
          </div>
        </dl>
      </section>
      {session.issueDetail !== null && (
        <IssuePanel issue={session.issueDetail} />
      )}
    </>
  );
}

function SessionNotFound(): ReactElement {
  const project = useProject();
  return (
    <>
      <p className="status">Session not found.</p>
      <Link className="back-link" to={withProject('/sessions', project)}>
        Back to sessions
      </Link>
    </>
  );
}

function SessionContent({
  response,
}: {
  response: SessionResponse | undefined;
}): ReactElement {
  if (response === undefined) return <p className="status">Loading…</p>;
  if (response.status === 'unreachable') {
    return <p className="status">{UNREACHABLE_MESSAGE}</p>;
  }
  if (response.status === 'not-found') {
    return <SessionNotFound />;
  }
  return (
    <>
      <SessionHeader
        session={response.session}
        updatedAt={response.updatedAt}
      />
      <SessionSkillTable skills={response.session.skills} />
      <SubAgentTable subAgents={response.session.subAgents} />
    </>
  );
}

export function SessionPage({ loadSession }: SessionPageProps): ReactElement {
  const { id = '' } = useParams();
  const [loaded, setLoaded] = useState<{
    id: string;
    response: SessionResponse;
  }>();
  const response = loaded?.id === id ? loaded.response : undefined;

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function refresh(): Promise<void> {
      const next = await loadSession(id);
      if (!active) return;
      if (next !== undefined) setLoaded({ id, response: next });
      timer = setTimeout(
        () => void refresh(),
        (next?.refreshSeconds ?? RETRY_SECONDS) * 1000,
      );
    }
    void refresh();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [loadSession, id]);

  return (
    <div className="sessions">
      <SessionContent response={response} />
    </div>
  );
}
