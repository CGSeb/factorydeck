import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

export const UI_DIR = join('src', 'ui');

const EXEMPT = [join(UI_DIR, 'design'), join(UI_DIR, 'colors.ts')];

const CHECKED_FILE = /\.(?:ts|tsx|css)$/;
const COLOR_LITERAL =
  /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b|\b(?:rgba?|hsla?)\(/gi;

export interface ColorLiteral {
  file: string;
  line: number;
  literal: string;
}

export function colorLiterals(file: string, source: string): ColorLiteral[] {
  return source.split('\n').flatMap((text, index) =>
    [...text.matchAll(COLOR_LITERAL)].map(([literal]) => ({
      file,
      line: index + 1,
      literal,
    })),
  );
}

function isExempt(path: string): boolean {
  return EXEMPT.some(
    (exempt) => path === exempt || path.startsWith(`${exempt}${sep}`),
  );
}

export function checkDesignColors(root: string): ColorLiteral[] {
  const folder = join(root, UI_DIR);
  if (!existsSync(folder)) return [];
  return readdirSync(folder, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && CHECKED_FILE.test(entry.name))
    .map((entry) => relative(root, join(entry.parentPath, entry.name)))
    .filter((path) => !isExempt(path))
    .toSorted()
    .flatMap((path) =>
      colorLiterals(path, readFileSync(join(root, path), 'utf8')),
    );
}

export function formatColorLiterals(literals: ColorLiteral[]): string {
  return `Colour literals outside src/ui/design/ and src/ui/colors.ts (use a --fd-* token or src/ui/design/palette.ts):\n${literals
    .map(({ file, line, literal }) => `${file}:${line}: ${literal}`)
    .join('\n')}\n`;
}

if (import.meta.main) {
  const literals = checkDesignColors(process.cwd());
  if (literals.length > 0) {
    process.stderr.write(formatColorLiterals(literals));
    process.exit(1);
  }
}
