import { field } from './parse.ts';
import type { ChecksSummary } from './types.ts';

const GITHUB_FAILED = new Set([
  'FAILURE',
  'ERROR',
  'CANCELLED',
  'TIMED_OUT',
  'STARTUP_FAILURE',
  'ACTION_REQUIRED',
]);

const GITHUB_RUNNING = new Set([
  'QUEUED',
  'IN_PROGRESS',
  'WAITING',
  'PENDING',
  'REQUESTED',
  'EXPECTED',
]);

function upper(value: unknown): string {
  return typeof value === 'string' ? value.toUpperCase() : '';
}

function githubCheckOutcome(check: unknown): 'failed' | 'running' | 'done' {
  const conclusion = upper(field(check, 'conclusion'));
  const state = upper(field(check, 'state'));
  const status = upper(field(check, 'status'));
  if (GITHUB_FAILED.has(conclusion) || GITHUB_FAILED.has(state)) {
    return 'failed';
  }
  if (
    GITHUB_RUNNING.has(state) ||
    (status !== '' && status !== 'COMPLETED' && conclusion === '')
  ) {
    return 'running';
  }
  return 'done';
}

export function githubChecks(rollup: unknown): ChecksSummary {
  if (!Array.isArray(rollup) || rollup.length === 0) return 'none';
  const outcomes = rollup.map(githubCheckOutcome);
  if (outcomes.includes('failed')) return 'failing';
  if (outcomes.includes('running')) return 'pending';
  return 'passing';
}

const GITLAB_FAILED = new Set(['failed', 'canceled', 'cancelled']);

const GITLAB_RUNNING = new Set([
  'created',
  'waiting_for_resource',
  'waiting_for_callback',
  'preparing',
  'pending',
  'running',
  'scheduled',
  'manual',
  'canceling',
]);

export function gitlabChecks(pipelineStatus: unknown): ChecksSummary {
  if (typeof pipelineStatus !== 'string' || pipelineStatus === '') {
    return 'none';
  }
  const status = pipelineStatus.toLowerCase();
  if (GITLAB_FAILED.has(status)) return 'failing';
  if (GITLAB_RUNNING.has(status)) return 'pending';
  return 'passing';
}
