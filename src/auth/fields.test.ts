import { describe, expect, it } from 'vitest';
import { accountFields } from './fields.ts';

const valid = {
  email: 'ada@example.test',
  name: 'Ada',
  password: 'correct horse battery',
};

describe('accountFields', () => {
  it('trims the email and the name, never the password', () => {
    expect(
      accountFields({
        email: '  Ada@Example.test ',
        name: ' Ada  ',
        password: '  twelve chars  ',
      }),
    ).toEqual({
      ok: true,
      value: {
        email: 'Ada@Example.test',
        name: 'Ada',
        password: '  twelve chars  ',
      },
    });
  });

  it.each([
    ['email', undefined, 'Email is required'],
    ['email', 42, 'Email is required'],
    ['email', '   ', 'Email is required'],
    [
      'email',
      'ada.example.test',
      'Email must have one @ with text on both sides',
    ],
    [
      'email',
      'a@b@example.test',
      'Email must have one @ with text on both sides',
    ],
    ['email', '@example.test', 'Email must have one @ with text on both sides'],
    ['email', 'ada@', 'Email must have one @ with text on both sides'],
    ['email', ` a@${'b'.repeat(253)} `, 'Email must be at most 254 characters'],
    ['name', undefined, 'Name is required'],
    ['name', '  ', 'Name is required'],
    ['name', 'n'.repeat(81), 'Name must be at most 80 characters'],
    ['password', undefined, 'Password is required'],
    ['password', 'eleven char', 'Password must be at least 12 characters'],
    ['password', 'p'.repeat(201), 'Password must be at most 200 characters'],
  ])('rejects %s %j', (field, value, error) => {
    expect(accountFields({ ...valid, [field]: value })).toEqual({
      ok: false,
      error,
      field,
    });
  });

  it('accepts the limits of each field', () => {
    const email = `a@${'b'.repeat(252)}`;
    expect(
      accountFields({
        email: `  ${email}  `,
        name: ` ${'n'.repeat(80)} `,
        password: 'p'.repeat(200),
      }),
    ).toMatchObject({ ok: true, value: { email } });
    expect(
      accountFields({ ...valid, name: 'N', password: ' '.repeat(12) }),
    ).toMatchObject({ ok: true });
  });

  it('counts characters, not UTF-16 units', () => {
    expect(accountFields({ ...valid, name: '😀'.repeat(80) })).toMatchObject({
      ok: true,
    });
  });

  it('reports the first invalid field, in the order email, name, password', () => {
    expect(accountFields({})).toMatchObject({ field: 'email' });
    expect(accountFields({ email: valid.email })).toMatchObject({
      field: 'name',
    });
  });
});
