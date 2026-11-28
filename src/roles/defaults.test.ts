import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RULES,
  type WorkflowRules,
  loadWorkflowConfig,
  parseWorkflowConfig,
  rulesFor,
} from './config.ts';

const PATH = '/configs/factorydeck.yml';

function rulesOf(text: string, project = '/p'): WorkflowRules {
  return rulesFor(parseWorkflowConfig(text, PATH), project);
}

describe('default role rules', () => {
  it('apply in their order when the file is missing', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'factorydeck-config-'));
    const config = loadWorkflowConfig(join(folder, 'factorydeck.yml'));
    expect(config.exists).toBe(false);
    expect(
      config.rules.roles.map(({ name, description }) => [
        name,
        description?.source,
      ]),
    ).toEqual([
      ['builder', '^(Build|Worker for) '],
      ['reviewer', '^Review '],
      ['shipper', '^(Ship|Merge|Push) '],
      ['reworker', '^(Rework|Rebase|Update) '],
      ['spec-checker', 'check-spec'],
      ['debugger', '^Debug '],
      ['bug-checker', 'check-bug'],
    ]);
    expect(
      config.rules.roles.every((rule) => rule.agentType === undefined),
    ).toBe(true);
    expect(
      config.rules.roles.every((rule) => rule.description?.flags === 'i'),
    ).toBe(true);
  });

  it('keeps the default roles and work items when the file has neither key', () => {
    const config = parseWorkflowConfig('version: 1\n', PATH);
    expect(config.exists).toBe(true);
    expect(rulesFor(config, '/p')).toEqual(DEFAULT_RULES);
  });

  it('has no work item rule with work_items: [], and keeps the default roles', () => {
    const rules = rulesOf('version: 1\nwork_items: []\n');
    expect(rules.workItems).toEqual([]);
    expect(rules.roles).toEqual(DEFAULT_RULES.roles);
  });

  it('ignores roles: [] and project roles of the file', () => {
    const text = [
      'version: 1',
      'roles: []',
      'projects:',
      '  /work/app:',
      '    roles:',
      '      - name: coder',
      "        description: '^Code '",
    ].join('\n');
    expect(rulesOf(text).roles).toEqual(DEFAULT_RULES.roles);
    expect(rulesOf(text, '/work/app').roles).toEqual(DEFAULT_RULES.roles);
  });
});
