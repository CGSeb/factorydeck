import { mkdtemp, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
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

function errorOf(text: string): string {
  try {
    parseWorkflowConfig(text, PATH);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error('Expected an invalid configuration');
}

function errorLines(text: string): string[] {
  const [first, ...lines] = errorOf(text).split('\n');
  expect(first).toBe(`Invalid configuration in ${PATH}:`);
  return lines;
}

function rulesOf(text: string, project = '/p'): WorkflowRules {
  return rulesFor(parseWorkflowConfig(text, PATH), project);
}

describe('loadWorkflowConfig', () => {
  it('applies the defaults when the file is missing', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'factorydeck-config-'));
    const path = join(folder, 'factorydeck.yml');
    const config = loadWorkflowConfig(path);
    expect(config.path).toBe(path);
    expect(config.exists).toBe(false);
    expect(config.rules).toEqual(DEFAULT_RULES);
    expect(config.projects.size).toBe(0);
  });

  it('reads a valid file', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'factorydeck-config-'));
    const path = join(folder, 'factorydeck.yml');
    await writeFile(
      path,
      [
        'version: 1',
        'roles:',
        '  - name: builder',
        "    description: '^Build #\\d+'",
        "    agent_type: 'general-purpose'",
        '  - name: reviewer',
        "    description: '^Review '",
        'work_items:',
        '  - from: branch',
        "    pattern: '^[a-z]+/(\\d+)-'",
      ].join('\n'),
    );
    const config = loadWorkflowConfig(path);
    expect(config.exists).toBe(true);
    expect(config.rules.roles.map((rule) => rule.name)).toEqual([
      'builder',
      'reviewer',
    ]);
    expect(config.rules.roles[0]?.agentType?.source).toBe('general-purpose');
    expect(config.rules.roles[1]?.agentType).toBeUndefined();
    expect(config.rules.workItems).toHaveLength(1);
    expect(config.rules.workItems[0]?.from).toBe('branch');
  });

  it('reports a file it cannot read', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'factorydeck-config-'));
    expect(() => loadWorkflowConfig(folder)).toThrow(
      `Invalid configuration in ${folder}:`,
    );
  });
});

describe('parseWorkflowConfig', () => {
  it('replaces the global lists with a project override, list by list', () => {
    const text = [
      'version: 1',
      'roles:',
      '  - name: builder',
      '    description: Build',
      'projects:',
      '  /work/app/:',
      '    roles:',
      '      - name: coder',
      '        description: Build',
      '  ~/code/lib:',
      '    work_items:',
      '      - from: title',
      "        pattern: 'issue (\\d+)'",
    ].join('\n');
    const app = rulesOf(text, '/work/app');
    expect(app.roles.map((rule) => rule.name)).toEqual(['coder']);
    expect(app.workItems).toEqual(DEFAULT_RULES.workItems);
    const lib = rulesOf(text, join(homedir(), 'code', 'lib'));
    expect(lib.roles.map((rule) => rule.name)).toEqual(['builder']);
    expect(lib.workItems.map((rule) => rule.pattern.source)).toEqual([
      'issue (\\d+)',
    ]);
    expect(rulesOf(text, '/elsewhere').roles[0]?.name).toBe('builder');
  });

  it('reports YAML that does not parse', () => {
    const lines = errorLines('version: 1\nroles: [\n');
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0]).toMatch(/^ {2}\(yaml\) .*line \d+, column \d+/);
  });

  it('reports a missing or wrong version', () => {
    expect(errorLines('roles: []\n')).toEqual([
      expect.stringMatching(/^ {2}version: /),
    ]);
    expect(errorLines('version: 2\n')).toEqual([
      expect.stringMatching(/^ {2}version: /),
    ]);
  });

  it('reports unknown keys with their key path', () => {
    expect(
      errorLines(
        [
          'version: 1',
          'colour: blue',
          'roles:',
          '  - name: builder',
          '    description: Build',
          '    label: x',
        ].join('\n'),
      ),
    ).toEqual(
      expect.arrayContaining([
        '  colour: unknown key',
        '  roles[0].label: unknown key',
      ]),
    );
  });

  it('reports a wrong type with its key path', () => {
    expect(
      errorLines(
        [
          'version: 1',
          'roles:',
          '  - name: a',
          '    description: A',
          '  - name: b',
          '    description: B',
          '  - name: c',
          '    description: [1]',
        ].join('\n'),
      ),
    ).toEqual([expect.stringMatching(/^ {2}roles\[2\]\.description: /)]);
    expect(
      errorLines(
        "version: 1\nwork_items:\n  - from: body\n    pattern: '#(\\d+)'\n",
      ),
    ).toEqual([expect.stringMatching(/^ {2}work_items\[0\]\.from: /)]);
  });

  it('reports a regular expression that does not compile', () => {
    expect(
      errorLines('version: 1\nroles:\n  - name: a\n    agent_type: "("\n'),
    ).toEqual([
      expect.stringMatching(
        /^ {2}roles\[0\]\.agent_type: not a valid regular expression: /,
      ),
    ]);
  });

  it('reports a work item pattern without exactly one capture group', () => {
    expect(
      errorLines(
        [
          'version: 1',
          'work_items:',
          '  - from: title',
          "    pattern: '#\\d+'",
          '  - from: title',
          "    pattern: '(#)(\\d+)'",
        ].join('\n'),
      ),
    ).toEqual([
      '  work_items[0].pattern: needs exactly one capture group, found 0',
      '  work_items[1].pattern: needs exactly one capture group, found 2',
    ]);
  });

  it('reports a role named main or unassigned, and a rule with nothing to match', () => {
    expect(
      errorLines(
        [
          'version: 1',
          'roles:',
          '  - name: main',
          '    description: x',
          '  - name: unassigned',
          '    description: x',
          '  - name: lonely',
        ].join('\n'),
      ),
    ).toEqual([
      expect.stringMatching(/^ {2}roles\[0\]\.name: .*reserved/),
      expect.stringMatching(/^ {2}roles\[1\]\.name: .*reserved/),
      '  roles[2]: needs description, agent_type or both',
    ]);
  });

  it('reports a project key that is neither absolute nor under ~', () => {
    expect(
      errorLines('version: 1\nprojects:\n  code/app:\n    roles: []\n'),
    ).toEqual([
      expect.stringMatching(
        /^ {2}projects\["code\/app"\]: .*absolute path or start with ~/,
      ),
    ]);
  });

  it('reports a ~ key that is neither ~ nor under ~/', () => {
    expect(
      errorLines(
        [
          'version: 1',
          'projects:',
          '  ~bob/x:',
          '    roles: []',
          '  ~factorydeck:',
          '    roles: []',
          '  ~/ok:',
          '    roles: []',
          "  '~':",
          '    roles: []',
        ].join('\n'),
      ),
    ).toEqual([
      '  projects["~bob/x"]: a path starting with ~ must be ~ or start with ~/',
      '  projects["~factorydeck"]: a path starting with ~ must be ~ or start with ~/',
    ]);
  });

  it('reports two keys naming the same project, with both keys', () => {
    expect(
      errorLines(
        [
          'version: 1',
          'projects:',
          '  /a:',
          '    roles: []',
          '  /a/:',
          '    roles: []',
          `  ${homedir()}/code:`,
          '    roles: []',
          '  ~/code//:',
          '    roles: []',
        ].join('\n'),
      ),
    ).toEqual([
      '  projects["/a/"]: same project as "/a"',
      `  projects["~/code//"]: same project as ${JSON.stringify(`${homedir()}/code`)}`,
    ]);
  });
});
