import { type ReactElement, useId } from 'react';
import type {
  ChecksSummary,
  ClosingRequest,
  IssueDetail,
  IssueLabel,
} from '../git-host/types.ts';
import { labelTextColor } from './colors.ts';

const CHECKS: Record<ChecksSummary, string> = {
  passing: 'Passing',
  failing: 'Failing',
  pending: 'Pending',
  none: 'No checks',
};

function requestState({ state, draft }: ClosingRequest): {
  key: string;
  text: string;
} {
  if (state === 'merged') return { key: 'merged', text: 'Merged' };
  if (state === 'closed') return { key: 'closed', text: 'Closed' };
  return draft
    ? { key: 'draft', text: 'Draft' }
    : { key: 'open', text: 'Open' };
}

function LabelPill({ label }: { label: IssueLabel }): ReactElement {
  if (label.color === null) {
    return <li className="label label-neutral">{label.name}</li>;
  }
  return (
    <li
      className="label"
      style={{ background: label.color, color: labelTextColor(label.color) }}
    >
      {label.name}
    </li>
  );
}

export function IssuePanel({ issue }: { issue: IssueDetail }): ReactElement {
  const titleId = useId();
  const github = issue.gitHost === 'github';
  const kind = github ? 'pull request' : 'merge request';
  const prefix = github ? '#' : '!';
  return (
    <section className="panel issue" aria-labelledby={titleId}>
      <div className="issue-heading">
        <h2 id={titleId}>
          <a href={issue.url} target="_blank" rel="noreferrer">
            #{issue.number} {issue.title}
          </a>
        </h2>
        <span className={`state issue-${issue.state}`}>
          {issue.state === 'open' ? 'Open' : 'Closed'}
        </span>
        {issue.labels.length > 0 && (
          <ul className="labels" aria-label="Labels">
            {issue.labels.map((label) => (
              <LabelPill key={label.name} label={label} />
            ))}
          </ul>
        )}
      </div>
      {issue.requests.length === 0 ? (
        <p className="issue-empty">No {kind} closes this issue.</p>
      ) : (
        <ul
          className="requests"
          aria-label={`${github ? 'Pull' : 'Merge'} requests`}
        >
          {issue.requests.map((request) => {
            const state = requestState(request);
            return (
              <li key={request.number}>
                <a href={request.url} target="_blank" rel="noreferrer">
                  {prefix}
                  {request.number} {request.title}
                </a>
                <span className={`state request-${state.key}`}>
                  {state.text}
                </span>
                <span className={`state checks-${request.checks}`}>
                  {CHECKS[request.checks]}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
