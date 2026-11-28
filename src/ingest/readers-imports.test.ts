import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(import.meta.dirname, '..');
const IMPORT = /(?:^|\n)\s*(?:import|export)\s[^;]*?from\s+'([^']+)'/g;
const FORBIDDEN = [
  /^drizzle-orm/,
  /^(node:)?fs(\/|$)/,
  /^pg$/,
  /^hono/,
  /\/src\/db\//,
  /\/src\/server\//,
];

function specifiersOf(path: string): string[] {
  return [...readFileSync(path, 'utf8').matchAll(IMPORT)].flatMap((match) =>
    match[1] === undefined ? [] : [match[1]],
  );
}

function importsOf(entries: readonly string[]): Set<string> {
  const seen = new Set<string>();
  const queue = [...entries];
  for (let path = queue.pop(); path !== undefined; path = queue.pop()) {
    for (const specifier of specifiersOf(path)) {
      const target = specifier.startsWith('.')
        ? resolve(dirname(path), specifier)
        : specifier;
      if (seen.has(target)) continue;
      seen.add(target);
      if (specifier.startsWith('.')) queue.push(target);
    }
  }
  return seen;
}

function forbidden(modules: Set<string>): string[] {
  return [...modules].filter((module) =>
    FORBIDDEN.some((pattern) => pattern.test(module)),
  );
}

describe('the parser without the database', () => {
  it('reaches neither the database, drizzle, the server nor the file system from a reader', () => {
    const folder = join(SRC, 'ingest', 'readers');
    const readers = readdirSync(folder)
      .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
      .map((name) => join(folder, name));
    const modules = importsOf(readers);
    expect(modules).toContain(join(SRC, 'ingest', 'records.ts'));
    expect(forbidden(modules)).toEqual([]);
  });

  it('keeps the plain batch module free of imports, and the schema off the server', () => {
    expect(specifiersOf(join(SRC, 'cli-ingest', 'batch.ts'))).toEqual([]);
    const schema = importsOf([join(SRC, 'cli-ingest', 'batch-schema.ts')]);
    expect(schema).toContain('zod');
    expect(forbidden(schema)).toEqual([]);
  });

  it('catches a forbidden import', () => {
    expect(
      forbidden(importsOf([join(SRC, 'cli-ingest', 'store-thread.ts')])),
    ).toEqual(expect.arrayContaining(['drizzle-orm']));
  });
});
