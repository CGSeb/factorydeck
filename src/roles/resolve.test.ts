import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { roleRule } from '../test/role-rules.ts';
import { summarizeRoles } from './query.ts';
import {
  DEFAULT_CONFIG,
  DEFAULT_RULES,
  type WorkflowRules,
  loadWorkflowConfig,
  parseWorkflowConfig,
  roleOf,
  rulesFor,
  workItemOf,
} from './config.ts';

function rulesOf(text: string): WorkflowRules {
  return rulesFor(parseWorkflowConfig(text, '/configs/factorydeck.yml'), '/p');
}

describe('roleOf', () => {
  const rules: WorkflowRules = {
    ...DEFAULT_RULES,
    roles: [
      roleRule('builder', '^build '),
      roleRule('checker', 'check', '^general-purpose$'),
      roleRule('reviewer', '^Review '),
      roleRule('builder', '^Worker for '),
    ],
  };

  it('takes the first matching rule, case-insensitively', () => {
    expect(roleOf(rules, { agentType: 'x', description: 'Build #3 now' })).toBe(
      'builder',
    );
    expect(
      roleOf(rules, { agentType: 'x', description: 'Worker for #3' }),
    ).toBe('builder');
  });

  it('needs both patterns to match when a rule has both', () => {
    expect(
      roleOf(rules, {
        agentType: 'general-purpose',
        description: 'Check the spec',
      }),
    ).toBe('checker');
    expect(
      roleOf(rules, { agentType: 'Explore', description: 'Check the spec' }),
    ).toBe('Explore');
  });

  it('falls back to the type, then to unassigned', () => {
    expect(roleOf(rules, { agentType: 'Explore', description: 'Find' })).toBe(
      'Explore',
    );
    expect(roleOf(rules, { agentType: '', description: '' })).toBe(
      'unassigned',
    );
  });

  it('gives a sub-agent typed main or unassigned that role, joining that row', () => {
    expect(roleOf(rules, { agentType: 'main', description: 'Find' })).toBe(
      'main',
    );
    expect(
      roleOf(rules, { agentType: 'unassigned', description: 'Find' }),
    ).toBe('unassigned');
    const usage = {
      model: 'mystery-model',
      calls: 1,
      input: 1,
      cache_write: 0,
      cache_read: 0,
      output: 0,
    };
    const roles = summarizeRoles(DEFAULT_CONFIG, [
      { ...usage, session_id: 's1', project: '/p', sub_agent: '' },
      {
        ...usage,
        session_id: 's1',
        project: '/p',
        sub_agent: 'a1',
        agent_type: 'main',
        description: '',
      },
    ]);
    expect(roles).toEqual([
      {
        role: 'main',
        threads: 1,
        apiCalls: 2,
        tokens: 2,
        tokenCounts: { input: 2, cacheWrite: 0, cacheRead: 0, output: 0 },
        costUsd: null,
      },
    ]);
  });

  it('keeps a main row counting the sessions when only sub-agents called in the period', () => {
    const roles = summarizeRoles(DEFAULT_CONFIG, [
      {
        model: 'mystery-model',
        calls: 1,
        input: 1,
        cache_write: 0,
        cache_read: 0,
        output: 0,
        session_id: 's1',
        project: '/p',
        sub_agent: 'a1',
        agent_type: 'Explore',
        description: '',
      },
    ]);
    expect(roles).toEqual([
      {
        role: 'main',
        threads: 1,
        apiCalls: 0,
        tokens: 0,
        tokenCounts: { input: 0, cacheWrite: 0, cacheRead: 0, output: 0 },
        costUsd: 0,
      },
      {
        role: 'Explore',
        threads: 1,
        apiCalls: 1,
        tokens: 1,
        tokenCounts: { input: 1, cacheWrite: 0, cacheRead: 0, output: 0 },
        costUsd: null,
      },
    ]);
  });
});

describe('roleOf with the default role rules', () => {
  const role = (description: string, agentType = 'general-purpose'): string =>
    roleOf(DEFAULT_RULES, { agentType, description });

  it('gives each build-feature sub-agent its role', () => {
    expect(role('Worker for #31')).toBe('builder');
    expect(role('Review #31')).toBe('reviewer');
    expect(role('Ship #31')).toBe('shipper');
    expect(role('Rebase feat/31-x')).toBe('reworker');
    expect(role('check-spec #31')).toBe('spec-checker');
    expect(role('worker FOR #31')).toBe('builder');
  });

  it('gives each fix-bug sub-agent its role', () => {
    expect(role('Debug #12')).toBe('debugger');
    expect(role('check-bug #12')).toBe('bug-checker');
    expect(role('Review #12')).toBe('reviewer');
    expect(role('Ship #12')).toBe('shipper');
    expect(role('check-spec #12')).toBe('spec-checker');
    expect(role('debug #12')).toBe('debugger');
    expect(role('Run the Debug #12 checks')).toBe('general-purpose');
  });

  it('keeps the first match when a description fits an earlier rule too', () => {
    expect(role('Review check-bug #12')).toBe('reviewer');
    expect(role('Debug check-spec #12')).toBe('spec-checker');
  });

  it('keeps the type, or unassigned, when no default rule matches', () => {
    expect(role('Find the role routes', 'Explore')).toBe('Explore');
    expect(role('Fix the build')).toBe('general-purpose');
    expect(role('Fix the build', '')).toBe('unassigned');
  });
});

describe('workItemOf', () => {
  it('reads the description first, then the title, by default', () => {
    expect(
      workItemOf(DEFAULT_RULES, {
        description: 'Build #12',
        branch: '',
        title: 'Work on #7',
      }),
    ).toBe(12);
    expect(
      workItemOf(DEFAULT_RULES, {
        description: 'Explore',
        branch: '',
        title: 'Work on #7',
      }),
    ).toBe(7);
  });

  it('skips description rules for a main thread, and has none without a match', () => {
    expect(workItemOf(DEFAULT_RULES, { branch: '#4', title: 'Fix' })).toBe(
      null,
    );
  });

  it('reads the branch with a branch rule', () => {
    const rules = rulesOf(
      "version: 1\nwork_items:\n  - from: branch\n    pattern: '^[a-z]+/(\\d+)-'\n",
    );
    expect(
      workItemOf(rules, { branch: 'feat/52-export', title: 'Fix #9' }),
    ).toBe(52);
  });

  it('skips a capture that is not a positive whole number', () => {
    const rules = rulesOf(
      [
        'version: 1',
        'work_items:',
        '  - from: title',
        "    pattern: 'issue (\\w+)'",
        '  - from: title',
        "    pattern: '#(\\d+)'",
      ].join('\n'),
    );
    expect(workItemOf(rules, { branch: '', title: 'issue abc #0' })).toBe(null);
    expect(workItemOf(rules, { branch: '', title: 'issue abc #5' })).toBe(5);
  });
});

describe('factorydeck.example.yml', () => {
  it('is a valid configuration with the default roles', () => {
    const path = join(
      import.meta.dirname,
      '..',
      '..',
      'factorydeck.example.yml',
    );
    const config = loadWorkflowConfig(path);
    expect(config.exists).toBe(true);
    expect(config.rules.roles.map((rule) => rule.name)).toEqual([
      'builder',
      'reviewer',
      'shipper',
      'reworker',
      'spec-checker',
      'debugger',
      'bug-checker',
    ]);
    const role = (description: string): string =>
      roleOf(config.rules, { agentType: 'general-purpose', description });
    expect(role('Worker for #23')).toBe('builder');
    expect(role('Review #23')).toBe('reviewer');
    expect(role('Ship #23')).toBe('shipper');
    expect(role('Rebase #23')).toBe('reworker');
    expect(role('Run check-spec on 006')).toBe('spec-checker');
    expect(role('Debug #23')).toBe('debugger');
    expect(role('check-bug #23')).toBe('bug-checker');
    expect(config.rules.workItems).toEqual(DEFAULT_RULES.workItems);
    expect(config.rules.roles).toEqual(DEFAULT_RULES.roles);
  });
});
