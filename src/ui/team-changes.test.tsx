// @vitest-environment happy-dom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { TeamAccountRow } from '../team/types.ts';
import type { AccountChangeOutcome } from './role-change-api.ts';
import type { TeamView } from './team-api.ts';
import { type TeamChangeOutcome, useTeamChanges } from './team-changes.ts';
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

  it.each([
    ['the first one started answers first', ['first', 'second']],
    ['the last one started answers first', ['second', 'first']],
  ] as const)(
    'with two actions running, shows the failure of the last one started when %s',
    async (_, order) => {
      const { answerList, hook } = setUp();
      await answerList(withBruno('dev'));
      const answer: Record<string, (outcome: AccountChangeOutcome) => void> =
        {};
      act(() => {
        hook.result.current.run(
          4,
          () =>
            new Promise((resolve) => {
              answer['first'] = resolve;
            }),
        );
        hook.result.current.run(
          2,
          () =>
            new Promise((resolve) => {
              answer['second'] = resolve;
            }),
        );
      });
      for (const which of order) {
        await act(async () => {
          answer[which]?.({ status: 'failed', message: `${which} failed` });
          await Promise.resolve();
        });
      }
      expect(hook.result.current.message).toEqual({
        accountId: 2,
        text: 'second failed',
      });
      expect(hook.result.current.busy.size).toBe(0);
    },
  );

  it('counts a done action as no row change: a list loaded meanwhile stays shown', async () => {
    const { answerList, hook, bruno } = setUp();
    await answerList(withBruno('dev'));
    let finish: (() => void) | undefined;
    act(() => {
      hook.result.current.run(
        4,
        () =>
          new Promise((resolve) => {
            finish = () => {
              resolve({ status: 'done' });
            };
          }),
      );
    });
    await answerList(withBruno('manager'));
    await act(async () => {
      finish?.();
      await Promise.resolve();
    });
    expect(bruno()?.role).toBe('manager');
    expect(hook.result.current.busy.size).toBe(0);
    expect(hook.result.current.message).toBeUndefined();
  });

  it.each([
    ['the first succeeds, the second fails, first answering first', 'first'],
    ['the first succeeds, the second fails, second answering first', 'second'],
  ] as const)(
    'keeps the failure of the last action started when %s',
    async (_, answersFirst) => {
      const { answerList, hook } = setUp();
      await answerList(withBruno('dev'));
      const answer = overlap(hook);
      const outcomes = {
        first: { status: 'done' } as const,
        second: { status: 'failed', message: 'second failed' } as const,
      };
      for (const which of answersFirst === 'first'
        ? (['first', 'second'] as const)
        : (['second', 'first'] as const)) {
        await act(async () => {
          answer[which]?.(outcomes[which]);
          await Promise.resolve();
        });
      }
      expect(hook.result.current.message).toEqual({
        accountId: 2,
        text: 'second failed',
      });
    },
  );

  it.each([
    ['first answering first', ['first', 'second']],
    ['second answering first', ['second', 'first']],
  ] as const)(
    'shows no line when the first fails and the last started succeeds, %s',
    async (_, order) => {
      const { answerList, hook } = setUp();
      await answerList(withBruno('dev'));
      const answer = overlap(hook);
      const outcomes = {
        first: { status: 'failed', message: 'first failed' } as const,
        second: MADE_MANAGER,
      };
      for (const which of order) {
        await act(async () => {
          answer[which]?.(outcomes[which]);
          await Promise.resolve();
        });
      }
      expect(hook.result.current.message).toBeUndefined();
      expect(hook.result.current.busy.size).toBe(0);
    },
  );
});

function overlap(
  hook: ReturnType<typeof setUp>['hook'],
): Record<string, (outcome: TeamChangeOutcome) => void> {
  const answer: Record<string, (outcome: TeamChangeOutcome) => void> = {};
  act(() => {
    hook.result.current.run(
      4,
      () =>
        new Promise((resolve) => {
          answer['first'] = resolve;
        }),
    );
    hook.result.current.run(
      2,
      () =>
        new Promise((resolve) => {
          answer['second'] = resolve;
        }),
    );
  });
  return answer;
}
