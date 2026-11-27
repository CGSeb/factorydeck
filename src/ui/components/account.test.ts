import { describe, expect, it } from 'vitest';
import { accountName, accountTip, initialsOf } from './account.ts';

describe('initials', () => {
  it.each([
    ['Ada Lovelace', 'AL'],
    ['ada lovelace', 'AL'],
    ['Ada', 'A'],
    ['Grace Brewster Hopper', 'GH'],
    ['  Ada   Lovelace  ', 'AL'],
    ['Jean-Luc Picard', 'JP'],
    ['Émile Zola', 'ÉZ'],
    ['émile zola', 'ÉZ'],
    ['👩‍💻 Coder', '👩‍💻C'],
    ['', ''],
    ['   ', ''],
  ])('%j gives %j', (name, initials) => {
    expect(initialsOf(name)).toBe(initials);
  });
});

describe('account labels', () => {
  const ada = {
    id: 1,
    email: 'ada@example.test',
    name: 'Ada Lovelace',
    role: 'manager',
  } as const;

  it('names the button with the name and role', () => {
    expect(accountName(ada)).toBe('Account: Ada Lovelace, Manager');
    expect(accountName({ ...ada, role: 'dev' })).toBe(
      'Account: Ada Lovelace, Dev',
    );
  });

  it('writes the tooltip as the folded links do', () => {
    expect(accountTip(ada)).toBe('Ada Lovelace · Manager');
  });
});
