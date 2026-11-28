import { describe, expect, it } from 'vitest';
import { DATABASE_UNREACHABLE, SERVER_UNREACHABLE } from './auth-api.ts';
import {
  roleRulesLoader,
  roleRulesSaver,
  roleRulesUrl,
} from './role-rules-api.ts';

const rules = [
  { name: 'builder', description: '^Build ', agentType: null },
  { name: 'explorer', description: null, agentType: '^Explore$' },
];

function answering(
  status: number,
  body: unknown,
  seen: { url?: string; init?: RequestInit } = {},
): typeof fetch {
  return (input, init) => {
    seen.url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    if (init !== undefined) seen.init = init;
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    );
  };
}

describe('roleRulesLoader', () => {
  it('reads the rules of a project in order', async () => {
    const seen: { url?: string } = {};
    const body = { status: 'ok', refreshSeconds: 30, rules };
    await expect(
      roleRulesLoader(answering(200, body, seen))(7),
    ).resolves.toEqual(body);
    expect(seen.url).toBe('/api/admin/projects/7/rules/role');
    expect(roleRulesUrl(7)).toBe(seen.url);
  });

  it('turns a 503 into unreachable and a 404 into missing', async () => {
    await expect(
      roleRulesLoader(
        answering(503, { status: 'unreachable', refreshSeconds: 30 }),
      )(1),
    ).resolves.toEqual({ status: 'unreachable', refreshSeconds: 30 });
    await expect(
      roleRulesLoader(answering(404, { error: 'Not found' }))(1),
    ).resolves.toEqual({ status: 'missing', refreshSeconds: 10 });
  });

  it('answers nothing for a body it cannot read or a failed request', async () => {
    for (const body of [
      { status: 'ok', refreshSeconds: 30 },
      { status: 'ok', refreshSeconds: 30, rules: [{ name: 1 }] },
      { status: 'ok', rules },
      [],
    ]) {
      await expect(
        roleRulesLoader(answering(200, body))(1),
      ).resolves.toBeUndefined();
    }
    await expect(
      roleRulesLoader(answering(403, { error: 'Managers only' }))(1),
    ).resolves.toBeUndefined();
    await expect(
      roleRulesLoader(() => Promise.reject(new Error('offline')))(1),
    ).resolves.toBeUndefined();
  });
});

describe('roleRulesSaver', () => {
  it('puts the rules and answers the rules saved', async () => {
    const seen: { url?: string; init?: RequestInit } = {};
    const save = roleRulesSaver(answering(200, { rules }, seen));
    await expect(save(3, rules)).resolves.toEqual({ status: 'saved', rules });
    expect(seen.url).toBe('/api/admin/projects/3/rules/role');
    expect(seen.init?.method).toBe('PUT');
    expect(
      JSON.parse(typeof seen.init?.body === 'string' ? seen.init.body : ''),
    ).toEqual({ rules });
  });

  it('reads a refusal of a field of a rule', async () => {
    const save = roleRulesSaver(
      answering(400, {
        error: 'Name is required',
        rule: 1,
        field: 'name',
      }),
    );
    await expect(save(3, rules)).resolves.toEqual({
      status: 'invalid',
      field: 'name',
      rule: 1,
      message: 'Name is required',
    });
  });

  it('reads a refusal of the whole list', async () => {
    const save = roleRulesSaver(
      answering(400, { error: 'At most 50 rules', field: 'rules' }),
    );
    await expect(save(3, rules)).resolves.toEqual({
      status: 'invalid',
      field: 'rules',
      rule: undefined,
      message: 'At most 50 rules',
    });
  });

  it('shows a refusal it cannot place under the section', async () => {
    await expect(
      roleRulesSaver(answering(400, { error: 'Odd', field: 'colour' }))(3, []),
    ).resolves.toEqual({ status: 'failed', message: 'Odd' });
    await expect(
      roleRulesSaver(answering(400, { error: 'Odd', field: 'name' }))(3, []),
    ).resolves.toEqual({ status: 'failed', message: 'Odd' });
    await expect(
      roleRulesSaver(answering(400, 'nope'))(3, []),
    ).resolves.toEqual({ status: 'failed', message: SERVER_UNREACHABLE });
  });

  it('turns 404, 503 and network failures into their outcomes', async () => {
    await expect(
      roleRulesSaver(answering(404, { error: 'Not found' }))(3, rules),
    ).resolves.toEqual({ status: 'missing' });
    await expect(
      roleRulesSaver(
        answering(503, { status: 'unreachable', refreshSeconds: 30 }),
      )(3, rules),
    ).resolves.toEqual({ status: 'failed', message: DATABASE_UNREACHABLE });
    await expect(
      roleRulesSaver(() => Promise.reject(new Error('offline')))(3, rules),
    ).resolves.toEqual({ status: 'failed', message: SERVER_UNREACHABLE });
    await expect(roleRulesSaver(answering(500, {}))(3, rules)).resolves.toEqual(
      { status: 'failed', message: SERVER_UNREACHABLE },
    );
  });
});
