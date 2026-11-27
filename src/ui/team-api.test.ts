import { describe, expect, it } from 'vitest';
import { teamLoader } from './team-api.ts';
import { menuTarget } from './TeamTable.tsx';
import { aloneManager } from './team-fixtures.ts';
import { teamSummary } from './team-view.ts';

function answering(response: Response | Error): typeof fetch {
  return () =>
    response instanceof Error
      ? Promise.reject(response)
      : Promise.resolve(response);
}

describe('teamLoader', () => {
  it('asks for the accounts and gives the answer', async () => {
    const urls: string[] = [];
    const body = { status: 'ok', refreshSeconds: 10, accounts: aloneManager };
    const view = await teamLoader((input) => {
      urls.push(typeof input === 'string' ? input : '');
      return Promise.resolve(Response.json(body));
    })();
    expect(urls).toEqual(['/api/team/accounts']);
    expect(view).toEqual(body);
  });

  it('gives the unreachable answer of a 503', async () => {
    const body = { status: 'unreachable', refreshSeconds: 10 };
    await expect(
      teamLoader(answering(Response.json(body, { status: 503 })))(),
    ).resolves.toEqual(body);
  });

  it('gives the refusal for a 403', async () => {
    await expect(
      teamLoader(
        answering(Response.json({ error: 'Managers only' }, { status: 403 })),
      )(),
    ).resolves.toEqual({ status: 'refused', refreshSeconds: 10 });
  });

  it.each([
    ['a 401', Response.json({ error: 'Not signed in' }, { status: 401 })],
    ['a 500', new Response('oops', { status: 500 })],
    ['a 200 without accounts', Response.json({ status: 'ok' })],
    ['a body that is not JSON', new Response('<html>')],
    ['a network error', new Error('offline')],
  ])('gives nothing for %s', async (_, response) => {
    await expect(teamLoader(answering(response))()).resolves.toBeUndefined();
  });
});

describe('teamSummary', () => {
  it('counts every account, deactivated ones included, and every manager', () => {
    const rows = [
      ...aloneManager,
      { ...aloneManager[0]!, id: 2, role: 'dev' as const, you: false },
      {
        ...aloneManager[0]!,
        id: 3,
        role: 'manager' as const,
        active: false,
        you: false,
      },
    ];
    expect(teamSummary(rows)).toBe('3 accounts · 2 managers');
  });

  it('reads in the singular for one account and one manager', () => {
    expect(teamSummary(aloneManager)).toBe('1 account · 1 manager');
  });

  it('reads 0 managers', () => {
    expect(teamSummary([{ ...aloneManager[0]!, role: 'dev' }])).toBe(
      '1 account · 0 managers',
    );
  });
});

describe('menuTarget', () => {
  it.each([
    ['ArrowDown', 0, 1],
    ['ArrowDown', 2, 0],
    ['ArrowUp', 0, 2],
    ['ArrowUp', 2, 1],
    ['Home', 2, 0],
    ['End', 0, 2],
  ])('moves %s from %i to %i among 3 items', (key, from, to) => {
    expect(menuTarget(key, from, 3)).toBe(to);
  });

  it('ignores other keys', () => {
    expect(menuTarget('a', 0, 3)).toBeUndefined();
  });
});
