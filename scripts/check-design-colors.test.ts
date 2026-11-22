import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  checkDesignColors,
  colorLiterals,
  formatColorLiterals,
} from './check-design-colors.ts';

describe('colorLiterals', () => {
  it.each([
    ['#abc', 'color: #abc;'],
    ['#abcd', 'color: #abcd;'],
    ['#a1b2c3', "const ink = '#a1b2c3';"],
    ['#A1B2C3D4', 'background: #A1B2C3D4'],
    ['rgb(', 'color: rgb(0 0 0);'],
    ['rgba(', 'color: rgba(0, 0, 0, 0.5);'],
    ['hsl(', 'color: hsl(10 20% 30%);'],
    ['hsla(', 'color: hsla(10, 20%, 30%, 0.5);'],
    ['RGB(', 'color: RGB(0, 0, 0);'],
  ])('catches %s', (literal, line) => {
    expect(colorLiterals('a.css', line)).toEqual([
      { file: 'a.css', line: 1, literal },
    ]);
  });

  it.each([
    ['#ab', 'two digits'],
    ['#abcde', 'five digits'],
    ['#abcdefa', 'seven digits'],
    ['#root', 'an id selector'],
    ['var(--fd-ink)', 'a token'],
    ['background: color-mix(in srgb, var(--fd-ink), transparent)', 'a mix'],
    ['const hrgb = 1;', 'a name ending in rgb'],
  ])('ignores %s (%s)', (source) => {
    expect(colorLiterals('a.css', source)).toEqual([]);
  });

  it('reports each literal with its line', () => {
    expect(
      colorLiterals('a.tsx', 'ok\nstyle={{ color: "#fff", fill: "#000" }}'),
    ).toEqual([
      { file: 'a.tsx', line: 2, literal: '#fff' },
      { file: 'a.tsx', line: 2, literal: '#000' },
    ]);
  });
});

describe('checkDesignColors', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'design-colors-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  function write(path: string, content: string): void {
    const full = join(root, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }

  it('passes when there is no components folder', () => {
    expect(checkDesignColors(root)).toEqual([]);
  });

  it('passes on components that only use tokens', () => {
    write('src/ui/components/Card.css', '.card { color: var(--fd-ink); }\n');
    expect(checkDesignColors(root)).toEqual([]);
  });

  it('flags ts, tsx, css and story files of src/ui/components, nested too', () => {
    write('src/ui/components/Card.css', '.card {\n  color: #123456;\n}\n');
    write('src/ui/components/Card.tsx', "const a = 'rgb(1, 2, 3)';\n");
    write('src/ui/components/Card.stories.tsx', "const b = '#fff';\n");
    write('src/ui/components/charts/util.ts', "const c = 'hsl(1 2% 3%)';\n");
    expect(checkDesignColors(root)).toEqual([
      { file: 'src/ui/components/Card.css', line: 2, literal: '#123456' },
      { file: 'src/ui/components/Card.stories.tsx', line: 1, literal: '#fff' },
      { file: 'src/ui/components/Card.tsx', line: 1, literal: 'rgb(' },
      { file: 'src/ui/components/charts/util.ts', line: 1, literal: 'hsl(' },
    ]);
  });

  it('ignores files outside src/ui/components and other extensions', () => {
    write('src/ui/design/tokens.css', ':root { --fd-ink: #17201f; }\n');
    write('src/ui/OldTable.tsx', "const a = '#fff';\n");
    write('src/ui/components/notes.md', 'colour #fff\n');
    expect(checkDesignColors(root)).toEqual([]);
  });

  it('prints each file and line', () => {
    expect(
      formatColorLiterals([
        { file: 'src/ui/components/Card.css', line: 2, literal: '#123456' },
      ]),
    ).toContain('src/ui/components/Card.css:2: #123456');
  });
});
