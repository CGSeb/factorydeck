import { readFileSync } from 'node:fs';

const TYPES = [
  'feat',
  'fix',
  'docs',
  'style',
  'refactor',
  'perf',
  'test',
  'build',
  'ci',
  'chore',
  'revert',
];
const SUBJECT = new RegExp(
  `^(${TYPES.join('|')})(\\([a-z0-9-]+\\))?!?: :[a-z0-9_+-]+: [A-Z0-9].*[^.\\s]$`,
);
const EXEMPT = /^(Merge |Revert "|fixup! |squash! |amend! )/;

const file = process.argv[2];
if (file === undefined) {
  process.stderr.write(
    'Usage: node scripts/check-commit-message.ts <commit message file>\n',
  );
  process.exit(2);
}

const subject =
  readFileSync(file, 'utf8')
    .split('\n')
    .find((line) => line.trim() !== '' && !line.startsWith('#')) ?? '';

if (!EXEMPT.test(subject) && !SUBJECT.test(subject)) {
  process.stderr.write(
    [
      `Invalid commit message: "${subject}"`,
      'Expected "type: :gitmoji: Subject" in English, imperative, capital first letter, no final period.',
      `Types: ${TYPES.join(', ')}.`,
      'Example: feat: :sparkles: Add the cost-per-issue view',
      '',
    ].join('\n'),
  );
  process.exit(1);
}
