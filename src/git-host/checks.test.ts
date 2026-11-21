import { describe, expect, it } from 'vitest';
import { githubChecks, gitlabChecks } from './checks.ts';

const run = (status: string, conclusion = ''): Record<string, string> => ({
  __typename: 'CheckRun',
  status,
  conclusion,
});
const context = (state: string): Record<string, string> => ({
  __typename: 'StatusContext',
  state,
});

describe('githubChecks', () => {
  it('is failing when any check failed, was cancelled or timed out', () => {
    for (const conclusion of ['FAILURE', 'CANCELLED', 'TIMED_OUT']) {
      expect(
        githubChecks([
          run('COMPLETED', 'SUCCESS'),
          run('IN_PROGRESS'),
          run('COMPLETED', conclusion),
        ]),
      ).toBe('failing');
    }
    expect(githubChecks([context('ERROR')])).toBe('failing');
    expect(githubChecks([context('FAILURE')])).toBe('failing');
  });

  it('is pending when none failed and any is queued or running', () => {
    expect(githubChecks([run('COMPLETED', 'SUCCESS'), run('QUEUED')])).toBe(
      'pending',
    );
    expect(githubChecks([run('IN_PROGRESS')])).toBe('pending');
    expect(githubChecks([context('PENDING')])).toBe('pending');
  });

  it('is passing with at least one finished check and none failed or running', () => {
    expect(
      githubChecks([
        run('COMPLETED', 'SUCCESS'),
        run('COMPLETED', 'SKIPPED'),
        context('SUCCESS'),
      ]),
    ).toBe('passing');
  });

  it('is no checks without any', () => {
    expect(githubChecks([])).toBe('none');
    expect(githubChecks(null)).toBe('none');
  });
});

describe('gitlabChecks', () => {
  it('maps the head pipeline status', () => {
    expect(gitlabChecks('failed')).toBe('failing');
    expect(gitlabChecks('canceled')).toBe('failing');
    expect(gitlabChecks('running')).toBe('pending');
    expect(gitlabChecks('pending')).toBe('pending');
    expect(gitlabChecks('created')).toBe('pending');
    expect(gitlabChecks('success')).toBe('passing');
    expect(gitlabChecks(undefined)).toBe('none');
    expect(gitlabChecks('')).toBe('none');
  });
});
