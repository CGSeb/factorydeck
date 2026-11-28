import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_ROLE_RULES } from '../roles/default-roles.ts';
import { type AuthHarness, authHarness } from '../test/auth-app.ts';
import { roleRule as rule, roleRuleClient } from '../test/role-rule-client.ts';

let h: AuthHarness;

beforeEach(async () => {
  h = await authHarness({ linkRoots: false });
});

afterEach(async () => {
  await h.close();
});

const {
  manager,
  added,
  stored,
  put,
  refusal: answer,
} = roleRuleClient(() => h);

describe('PUT /api/admin/projects/<id>/rules/role refusals', () => {
  it.each([
    [[rule('')], 'Name is required', 'name'],
    [[rule('   ')], 'Name is required', 'name'],
    [[{ description: 'x' }], 'Name is required', 'name'],
    [['builder'], 'Name is required', 'name'],
    [[rule('main')], 'main and unassigned are reserved', 'name'],
    [[rule('unassigned')], 'main and unassigned are reserved', 'name'],
    [
      [rule('Builder')],
      'Use lower-case letters, digits and -, starting with a letter',
      'name',
    ],
    [
      [rule('1st')],
      'Use lower-case letters, digits and -, starting with a letter',
      'name',
    ],
    [
      [rule('spec_checker')],
      'Use lower-case letters, digits and -, starting with a letter',
      'name',
    ],
    [[rule('a'.repeat(41))], 'At most 40 characters', 'name'],
    [
      [{ name: 'lonely', description: '', agentType: null }],
      'Give a description or an agent type pattern',
      'description',
    ],
    [
      [{ name: 'lonely' }],
      'Give a description or an agent type pattern',
      'description',
    ],
    [[rule('x', '😀'.repeat(251))], 'At most 500 characters', 'description'],
    [
      [{ name: 'x', description: null, agentType: 'a'.repeat(501) }],
      'At most 500 characters',
      'agentType',
    ],
  ])(
    'refuses rule %# with its message on its field',
    async (rules, error, field) => {
      const cookie = await manager();
      const id = await added(cookie);
      const response = await put(id, { rules }, cookie);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error, rule: 0, field });
      expect(await stored(cookie, id)).toEqual(DEFAULT_ROLE_RULES);
    },
  );

  it('accepts a name of 40 characters and a pattern of 500 UTF-16 code units', async () => {
    const cookie = await manager();
    const id = await added(cookie);
    const rules = [rule('a'.repeat(40), '😀'.repeat(250))];
    const response = await put(id, { rules }, cookie);
    expect(response.status).toBe(200);
    expect(await stored(cookie, id)).toEqual(rules);
  });

  it('refuses a pattern that does not compile, with the reason', async () => {
    const cookie = await manager();
    const id = await added(cookie);
    const response = await put(
      id,
      { rules: [{ name: 'x', description: null, agentType: '(' }] },
      cookie,
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ rule: 0, field: 'agentType' });
    expect(body['error']).toMatch(/^Not a valid regular expression: .+/);
  });

  it('answers the first failing rule, then its fields in order name, description, agentType', async () => {
    const cookie = await manager();
    const id = await added(cookie);
    const refusal = (rules: unknown) => answer(id, { rules }, cookie);
    expect(
      await refusal([
        rule('ok'),
        { name: 'Bad', description: '(', agentType: '(' },
        rule('main'),
      ]),
    ).toEqual({
      error: 'Use lower-case letters, digits and -, starting with a letter',
      rule: 1,
      field: 'name',
    });
    expect(
      await refusal([
        rule('ok'),
        { name: 'b', description: '(', agentType: '(' },
      ]),
    ).toMatchObject({ rule: 1, field: 'description' });
    expect(
      await refusal([
        { name: 'b', description: 'x'.repeat(10), agentType: '(' },
      ]),
    ).toMatchObject({ rule: 0, field: 'agentType' });
    expect(await stored(cookie, id)).toEqual(DEFAULT_ROLE_RULES);
  });

  it.each([
    [{}, 'Give a list of rules'],
    [{ rules: 'builder' }, 'Give a list of rules'],
    [{ rules: { name: 'builder' } }, 'Give a list of rules'],
    ['not json', 'Give a list of rules'],
    [
      { rules: Array.from({ length: 51 }, () => rule('x')) },
      'At most 50 rules',
    ],
  ])(
    'refuses body %# with its message on the field rules',
    async (body, error) => {
      const cookie = await manager();
      const id = await added(cookie);
      const response = await put(id, body, cookie);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error, field: 'rules' });
      expect(await stored(cookie, id)).toEqual(DEFAULT_ROLE_RULES);
    },
  );

  it('accepts 50 rules', async () => {
    const cookie = await manager();
    const id = await added(cookie);
    const rules = Array.from({ length: 50 }, () => rule('x'));
    expect((await put(id, { rules }, cookie)).status).toBe(200);
    expect(await stored(cookie, id)).toHaveLength(50);
  });
});
