import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import packageJson from '../package.json' with { type: 'json' };
import { PARSER_VERSION } from '../../src/cli-ingest/parser-version.ts';
import { COMMAND_HELP, MAIN_HELP } from './help.ts';
import {
  type FakeContext,
  fakeContext,
  removeContext,
  runIn,
} from './test/fake-context.ts';

let context: FakeContext;

beforeEach(async () => {
  context = await fakeContext();
});

afterEach(async () => {
  await removeContext(context);
});

describe('help', () => {
  it('prints the help on stdout for --help', async () => {
    const ran = await runIn(context, ['--help']);
    expect(ran).toEqual({ code: 0, stdout: MAIN_HELP, stderr: [] });
    expect(MAIN_HELP[0]).toBe('Usage: factorydeck <command> [options]');
    expect(
      MAIN_HELP.filter((line) =>
        /^ {2}(login|logout|status|--server)\b/.test(line),
      ),
    ).toHaveLength(4);
  });

  it.each(['login', 'logout', 'status'] as const)(
    'prints the help of %s for <command> --help, without its server URL',
    async (command) => {
      expect(await runIn(context, [command, '--help'])).toEqual({
        code: 0,
        stdout: COMMAND_HELP[command],
        stderr: [],
      });
      const url = command === 'status' ? [] : ['http://a.test/x'];
      expect(await runIn(context, ['-h', command, ...url])).toEqual({
        code: 0,
        stdout: COMMAND_HELP[command],
        stderr: [],
      });
    },
  );

  it.each([
    [
      ['login', 'not-a-url', '--help'],
      'Invalid server URL: not-a-url. It needs http:// or https://.',
    ],
    [['status', 'extra', '--help'], 'Unexpected argument: extra.'],
    [
      ['logout', 'http://a.test', 'http://b.test', '-h'],
      'Unexpected argument: http://b.test.',
    ],
    [
      ['login', '--help', '--server', 'ftp://a.test'],
      'Invalid server URL: ftp://a.test. It needs http:// or https://.',
    ],
  ])('lets a usage error win over --help in %j', async (argv, message) => {
    const ran = await runIn(context, argv);
    expect(ran.code).toBe(2);
    expect(ran.stdout).toEqual([]);
    expect(ran.stderr[0]).toBe(message);
  });

  it('prints the help on stderr with exit 2 without a command', async () => {
    expect(await runIn(context, [])).toEqual({
      code: 2,
      stdout: [],
      stderr: MAIN_HELP,
    });
  });

  it('prints the help with exit 2 for an unknown command', async () => {
    expect(await runIn(context, ['push'])).toEqual({
      code: 2,
      stdout: [],
      stderr: ['Unknown command: push.', ...MAIN_HELP],
    });
  });
});

describe('version', () => {
  const lines = [
    `factorydeck ${packageJson.version}`,
    `parser ${PARSER_VERSION}`,
  ];

  it.each([
    [['--version']],
    [['-v']],
    [['--help', '--version']],
    [['login', '--version']],
    [['status', '-v', '--server', 'http://a.test']],
  ])('prints the CLI and parser versions on stdout for %j', async (argv) => {
    expect(await runIn(context, argv)).toEqual({
      code: 0,
      stdout: lines,
      stderr: [],
    });
  });

  it('reads the CLI version from cli/package.json', () => {
    expect(packageJson.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(Number.isInteger(PARSER_VERSION) && PARSER_VERSION > 0).toBe(true);
  });

  it.each([
    [['--version=2'], 'Option --version takes no value.'],
    [['push', '--version'], 'Unknown command: push.'],
    [
      ['login', 'not-a-url', '--version'],
      'Invalid server URL: not-a-url. It needs http:// or https://.',
    ],
  ])('lets a usage error win over --version in %j', async (argv, message) => {
    const ran = await runIn(context, argv);
    expect(ran.code).toBe(2);
    expect(ran.stdout).toEqual([]);
    expect(ran.stderr[0]).toBe(message);
  });
});

describe('usage errors', () => {
  it.each([
    [['status', '--verbose'], 'Unknown option: --verbose.'],
    [['login', '-x', 'http://a.test'], 'Unknown option: -x.'],
    [['login'], 'Missing server URL.'],
    [['logout'], 'Missing server URL.'],
    [
      ['login', 'http://a.test', 'http://b.test'],
      'Unexpected argument: http://b.test.',
    ],
    [['status', 'http://a.test'], 'Unexpected argument: http://a.test.'],
    [['login', '--server'], 'Option --server needs a URL.'],
    [
      ['login', 'example.test'],
      'Invalid server URL: example.test. It needs http:// or https://.',
    ],
    [
      ['login', '--server', ''],
      'Invalid server URL: . It needs http:// or https://.',
    ],
    [
      ['status', '--server', 'ftp://a.test'],
      'Invalid server URL: ftp://a.test. It needs http:// or https://.',
    ],
    [
      ['login', 'http://a.test', '--server', 'http://127.0.0.1:4317'],
      '--server http://127.0.0.1:4317 and http://a.test name different servers.',
    ],
  ])('exits 2 for %j', async (argv, message) => {
    const ran = await runIn(context, argv);
    expect(ran.code).toBe(2);
    expect(ran.stdout).toEqual([]);
    expect(ran.stderr[0]).toBe(message);
  });

  it('accepts --server with the same server as the argument, or alone', async () => {
    context.launch = () => Promise.resolve(false);
    const ran = await runIn(context, [
      'logout',
      'HTTP://A.test:80/x',
      '--server=http://a.test',
    ]);
    expect(ran).toEqual({
      code: 0,
      stdout: ['Not logged in to http://a.test.'],
      stderr: [],
    });
    expect(
      (await runIn(context, ['logout', '--server', 'http://a.test'])).code,
    ).toBe(0);
  });

  it('checks the usage before reading the credentials', async () => {
    await mkdir(context.home, { recursive: true });
    await writeFile(context.credentials, '{ not json');
    expect((await runIn(context, ['login'])).code).toBe(2);
    expect(await runIn(context, ['status'])).toEqual({
      code: 1,
      stdout: [],
      stderr: [`Could not read ${context.credentials}.`],
    });
    expect((await runIn(context, ['logout', 'http://a.test'])).code).toBe(1);
    expect((await runIn(context, ['login', 'http://a.test'])).code).toBe(1);
    expect(await readFile(context.credentials, 'utf8')).toBe('{ not json');
  });
});
