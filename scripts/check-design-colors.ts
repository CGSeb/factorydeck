import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

export const COMPONENTS_DIR = join('src', 'ui', 'components');

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

export function checkDesignColors(root: string): ColorLiteral[] {
  const folder = join(root, COMPONENTS_DIR);
  if (!existsSync(folder)) return [];
  return readdirSync(folder, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && CHECKED_FILE.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name))
    .toSorted()
    .flatMap((path) =>
      colorLiterals(relative(root, path), readFileSync(path, 'utf8')),
    );
}

export function formatColorLiterals(literals: ColorLiteral[]): string {
  return `Colour literals outside src/ui/design/ (use a --fd-* token or src/ui/design/palette.ts):\n${literals
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
