// @vitest-environment happy-dom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { TeamAccountRow } from '../team/types.ts';
import type { AccountChangeOutcome } from './role-change-api.ts';
import type { TeamView } from './team-api.ts';
import { useTeamChanges } from './team-changes.ts';
import { someTeam } from './team-fixtures.ts';

afterEach(cleanup);

function withBruno(role: 'manager' | 'dev'): TeamView {
  return {
    status: 'ok',
    refreshSeconds: 0,
    accounts: someTeam.map((row) => (row.id === 4 ? { ...row, role } : row)),
  };
}

function setUp() {
  const answers: ((view: TeamView) => void)[] = [];
  const hook = renderHook(() =>
    useTeamChanges(
      () =>
        new Promise<TeamView>((resolve) => {
          answers.push(resolve);
        }),
    ),
  );
  async function answerList(view: TeamView): Promise<void> {
    await waitFor(() => {
      expect(answers.length).toBeGreaterThan(0);
    });
    await act(async () => {
      answers.shift()?.(view);
      await Promise.resolve();
    });
  }
  async function change(outcome: AccountChangeOutcome): Promise<void> {
    await waitFor(() => {
      expect(answers).toHaveLength(1);
    });
    await act(async () => {
      hook.result.current.run(4, () => Promise.resolve(outcome));
      await Promise.resolve();
    });
  }
  function bruno(): TeamAccountRow | undefined {
    const view = hook.result.current.view;
    return view?.status === 'ok'
      ? view.accounts.find(({ id }) => id === 4)
      : undefined;
  }
  return { hook, answerList, change, bruno };
}

const MADE_MANAGER: AccountChangeOutcome = {
  status: 'changed',
  account: { ...(someTeam[1] as TeamAccountRow), role: 'manager' },
};

describe('useTeamChanges', () => {
  it('ignores list answers to requests sent before the change answered', async () => {
    const { answerList, change, bruno, hook } = setUp();
    await answerList(withBruno('dev'));
    expect(bruno()?.role).toBe('dev');
    await change(MADE_MANAGER);
    expect(bruno()?.role).toBe('manager');
    expect(hook.result.current.busy.size).toBe(0);
    await answerList(withBruno('dev'));
    expect(bruno()?.role).toBe('manager');
    await answerList(withBruno('dev'));
    expect(bruno()?.role).toBe('dev');
  });

  it('reloads at once on request, still ignoring answers sent before a change', async () => {
    const { answerList, bruno, hook } = setUp();
    await answerList(withBruno('dev'));
    act(() => {
      hook.result.current.reload();
    });
    await act(async () => {
      hook.result.current.run(4, () => Promise.resolve(MADE_MANAGER));
      await Promise.resolve();
    });
    expect(bruno()?.role).toBe('manager');
    await answerList(withBruno('dev'));
    expect(bruno()?.role).toBe('manager');
    act(() => {
      hook.result.current.reload();
    });
    await answerList(withBruno('dev'));
    await waitFor(() => {
      expect(bruno()?.role).toBe('dev');
    });
  });

  it('keeps the message across refreshes until the next action starts', async () => {
    const { answerList, change, hook } = setUp();
    await answerList(withBruno('dev'));
    await change({ status: 'failed', message: 'Could not reach the server' });
    await answerList(withBruno('dev'));
    expect(hook.result.current.message).toEqual({
      accountId: 4,
      text: 'Could not reach the server',
    });
    act(() => {
      hook.result.current.run(2, () => new Promise(() => undefined));
    });
    expect(hook.result.current.message).toBeUndefined();
    expect([...hook.result.current.busy]).toEqual([2]);
  });

  it('shows the refusal after a 403 until a newer list answers', async () => {
    const { answerList, change, hook } = setUp();
    await answerList(withBruno('dev'));
    await change({ status: 'refused' });
    expect(hook.result.current.view?.status).toBe('refused');
    await answerList(withBruno('dev'));
    expect(hook.result.current.view?.status).toBe('refused');
    await answerList(withBruno('dev'));
    expect(hook.result.current.view?.status).toBe('ok');
  });
});
