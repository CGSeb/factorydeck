import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { build } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PARSER_VERSION } from '../../src/cli-ingest/batch.ts';
import packageJson from '../package.json' with { type: 'json' };
import { CLI_DIST_DIR, CLI_ROOT, cliBuildConfig } from './build-config.ts';

const run = promisify(execFile);
const TIMEOUT_MS = 120_000;

let root: string;
let files: string[];
let installed: string;

interface Packed {
  filename: string;
  files: { path: string }[];
}

beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'factorydeck-pack-'));
  await build(cliBuildConfig());
  const { stdout } = await run(
    'npm',
    ['pack', '--json', '--pack-destination', root],
    { cwd: CLI_ROOT },
  );
  const [packed] = JSON.parse(stdout) as Packed[];
  if (packed === undefined) throw new Error('npm pack packed nothing');
  files = packed.files.map((file) => file.path).sort();
  installed = path.join(root, 'installed');
  await mkdir(installed);
  await run(
    'npm',
    [
      'install',
      '--offline',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--prefix',
      installed,
      path.join(root, packed.filename),
    ],
    { cwd: installed },
  );
}, TIMEOUT_MS);

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

function factorydeck(argv: string[]) {
  return run(
    path.join(installed, 'node_modules', '.bin', 'factorydeck'),
    argv,
    {
      cwd: installed,
      env: { ...process.env, FACTORYDECK_CLI_HOME: path.join(root, 'home') },
    },
  );
}

describe('the npm package', () => {
  it('holds only the bundled command, its README and its licence', async () => {
    expect(files).toEqual([
      'LICENSE',
      'README.md',
      'dist/main.js',
      'package.json',
    ]);
    expect(await readdir(CLI_DIST_DIR)).toEqual(['main.js']);
  });

  it('has factorydeck as its only command and needs no dependency', async () => {
    const manifest = JSON.parse(
      await readFile(
        path.join(installed, 'node_modules', 'factorydeck', 'package.json'),
        'utf8',
      ),
    ) as Record<string, unknown>;
    expect(manifest['bin']).toEqual({ factorydeck: 'dist/main.js' });
    expect(manifest['engines']).toEqual({ node: '>=22' });
    expect(manifest['license']).toBe('MIT');
    expect(manifest['dependencies']).toBeUndefined();
    expect(await readdir(path.join(installed, 'node_modules', '.bin'))).toEqual(
      ['factorydeck'],
    );
    expect(await readdir(path.join(installed, 'node_modules'))).toEqual([
      '.bin',
      '.package-lock.json',
      'factorydeck',
    ]);
  });

  it('starts with a shebang and imports only Node built-ins', async () => {
    const bundle = await readFile(path.join(CLI_DIST_DIR, 'main.js'), 'utf8');
    expect(bundle.startsWith('#!/usr/bin/env node\n')).toBe(true);
    const imported = [...bundle.matchAll(/^import .* from "([^"]+)";$/gm)].map(
      (match) => match[1],
    );
    expect(imported.length).toBeGreaterThan(0);
    expect(imported.every((name) => name?.startsWith('node:'))).toBe(true);
    expect(bundle).not.toContain('sourceMappingURL');
  });

  it('prints the CLI and parser versions once installed', async () => {
    const { stdout, stderr } = await factorydeck(['--version']);
    expect(stdout).toBe(
      `factorydeck ${packageJson.version}\nparser ${PARSER_VERSION}\n`,
    );
    expect(stderr).toBe('');
  });

  it('prints its help once installed', async () => {
    const { stdout } = await factorydeck(['--help']);
    expect(stdout.split('\n')[0]).toBe(
      'Usage: factorydeck <command> [options]',
    );
  });
});
