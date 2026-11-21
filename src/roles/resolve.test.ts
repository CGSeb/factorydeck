import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
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
  const rules = rulesOf(
    [
      'version: 1',
      'roles:',
      '  - name: builder',
      "    description: '^build '",
      '  - name: checker',
      "    description: 'check'",
      "    agent_type: '^general-purpose$'",
      '  - name: reviewer',
      "    description: '^Review '",
      '  - name: builder',
      "    description: '^Worker for '",
    ].join('\n'),
  );

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
  it('is a valid configuration with the build-feature roles', () => {
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
    ]);
    const role = (description: string): string =>
      roleOf(config.rules, { agentType: 'general-purpose', description });
    expect(role('Worker for #23')).toBe('builder');
    expect(role('Review #23')).toBe('reviewer');
    expect(role('Ship #23')).toBe('shipper');
    expect(role('Rebase #23')).toBe('reworker');
    expect(role('Run check-spec on 006')).toBe('spec-checker');
    expect(config.rules.workItems).toEqual(DEFAULT_RULES.workItems);
  });
});
