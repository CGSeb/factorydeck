import { describe, expect, it } from 'vitest';
import {
  cleanMessage,
  cleanOutput,
  firstLines,
  fullOutput,
  hasMoreThan,
  headExcerpt,
  tailExcerpt,
} from './log-texts.ts';

const HOME = '/home/dev';

function errorExcerpt(text: string): string {
  return headExcerpt(cleanOutput(text, HOME));
}

describe('excerpts', () => {
  it('keeps the first 3 non-empty lines', () => {
    expect(firstLines('one\n\n  \ntwo\r\nthree\nfour')).toBe('one\ntwo\nthree');
  });

  it('removes colour codes and the Exit code line', () => {
    expect(
      errorExcerpt(
        'Exit code 1\n\u001b[31mFAIL\u001b[0m src/a.test.ts\n\u001b[1mExpected 2\u001b[22m',
      ),
    ).toBe('FAIL src/a.test.ts\nExpected 2');
  });

  it('writes the home folder ~ and cuts past 300 characters with …', () => {
    const long = `${HOME}/app ${'x'.repeat(400)}`;
    const excerpt = errorExcerpt(long);
    expect(excerpt.startsWith('~/app xxx')).toBe(true);
    expect(excerpt).toHaveLength(301);
    expect(excerpt.endsWith('…')).toBe(true);
    expect(errorExcerpt('x'.repeat(300))).toBe('x'.repeat(300));
  });
});

describe('cleanOutput', () => {
  it('drops a last Shell cwd was reset line and keeps blank lines inside', () => {
    expect(
      cleanOutput(
        `\nExit code 2\nerror one\n\nerror two\n\nShell cwd was reset to ${HOME}/app\n`,
        HOME,
      ),
    ).toBe('error one\n\nerror two');
  });

  it('keeps a Shell cwd line that is not the last one', () => {
    expect(cleanOutput('Shell cwd was reset to /x\nfailed', HOME)).toBe(
      'Shell cwd was reset to /x\nfailed',
    );
  });

  it('answers an empty text when nothing is left', () => {
    expect(cleanOutput('Exit code 1\n\n  \n', HOME)).toBe('');
  });

  it('cleans a hook message with the home folder as ~', () => {
    expect(cleanMessage(`\n${HOME}/hooks failed\n\n`, HOME)).toBe(
      '~/hooks failed',
    );
  });
});

describe('tailExcerpt', () => {
  it('keeps the last 5 non-empty lines of a chained command', () => {
    const output = [
      'step 1 ok',
      'step 2 ok',
      'step 3 ok',
      '',
      'Building…',
      'src/a.ts(3,1): error TS2322',
      '',
      'src/b.ts(9,4): error TS2304',
      'Found 2 errors.',
    ].join('\n');
    expect(tailExcerpt(output)).toBe(
      'step 3 ok\nBuilding…\nsrc/a.ts(3,1): error TS2322\nsrc/b.ts(9,4): error TS2304\nFound 2 errors.',
    );
  });

  it('keeps the last 300 characters, starting with …', () => {
    const output = `${'a'.repeat(200)}\n${'b'.repeat(200)}`;
    const excerpt = tailExcerpt(output);
    expect(excerpt).toBe(`…${'a'.repeat(99)}\n${'b'.repeat(200)}`);
    expect(excerpt).toHaveLength(301);
    expect(tailExcerpt('c'.repeat(300))).toBe('c'.repeat(300));
  });

  it('never splits a surrogate pair', () => {
    const output = `x😀${'y'.repeat(299)}`;
    expect(tailExcerpt(output)).toBe(`…${'y'.repeat(299)}`);
  });
});

describe('hasMoreThan', () => {
  it('is false when the excerpt shows every non-empty line', () => {
    const text = 'one\n\ntwo';
    expect(hasMoreThan(text, tailExcerpt(text))).toBe(false);
    expect(hasMoreThan(text, headExcerpt(text))).toBe(false);
    expect(hasMoreThan('', tailExcerpt(''))).toBe(false);
  });

  it('is true with more lines, or an excerpt that was cut', () => {
    const lines = 'a\nb\nc\nd\ne\nf';
    expect(hasMoreThan(lines, tailExcerpt(lines))).toBe(true);
    expect(hasMoreThan(lines, headExcerpt(lines))).toBe(true);
    const long = 'z'.repeat(301);
    expect(hasMoreThan(long, tailExcerpt(long))).toBe(true);
  });
});

describe('fullOutput', () => {
  it('keeps a short output whole, blank lines included', () => {
    expect(fullOutput('one\n\ntwo')).toBe('one\n\ntwo');
  });

  it('keeps the last 400 lines of a longer output', () => {
    const lines = Array.from({ length: 450 }, (_, index) => `line ${index}`);
    const shown = fullOutput(lines.join('\n')).split('\n');
    expect(shown[0]).toBe('… 50 earlier lines not shown.');
    expect(shown[1]).toBe('line 50');
    expect(shown.at(-1)).toBe('line 449');
    expect(shown).toHaveLength(401);
  });

  it('says 1 earlier line for one', () => {
    const lines = Array.from({ length: 401 }, (_, index) => `l${index}`);
    expect(fullOutput(lines.join('\n')).split('\n')[0]).toBe(
      '… 1 earlier line not shown.',
    );
  });

  it('keeps the end within 20,000 characters', () => {
    const lines = Array.from(
      { length: 30 },
      (_, index) => `${String(index).padStart(2, '0')}${'x'.repeat(998)}`,
    );
    const shown = fullOutput(lines.join('\n')).split('\n');
    expect(shown[0]).toBe('… 11 earlier lines not shown.');
    expect(shown[1]?.startsWith('11')).toBe(true);
    expect(shown.slice(1).join('\n').length).toBeLessThanOrEqual(20_000);
  });

  it('cuts a single line longer than 20,000 characters at its start', () => {
    const shown = fullOutput(`${'a'.repeat(100)}${'b'.repeat(20_000)}`);
    expect(shown).toBe(`…${'b'.repeat(20_000)}`);
  });
});
