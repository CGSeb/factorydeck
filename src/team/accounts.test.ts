import { describe, expect, it } from 'vitest';
import { byTeamOrder } from './accounts.ts';
import type { TeamAccount } from './types.ts';

function row(name: string, email: string, active = true): TeamAccount {
  return {
    id: 0,
    name,
    email,
    role: 'dev',
    active,
    lastSignInAt: null,
    cliConnections: 0,
  };
}

describe('byTeamOrder', () => {
  it('puts active accounts first, then sorts by name without letter case, then by email', () => {
    const rows = [
      row('Zed', 'zed@example.test', false),
      row('bea', 'b2@example.test'),
      row('Bea', 'b1@example.test'),
      row('alan', 'alan@example.test', false),
      row('Carl', 'carl@example.test'),
    ];
    expect(
      rows.sort(byTeamOrder).map(({ name, email }) => `${name} ${email}`),
    ).toEqual([
      'Bea b1@example.test',
      'bea b2@example.test',
      'Carl carl@example.test',
      'alan alan@example.test',
      'Zed zed@example.test',
    ]);
  });
});
