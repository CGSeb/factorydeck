import { describe, expect, it } from 'vitest';
import { errorExcerpt, firstLines } from './log-texts.ts';

const HOME = '/home/dev';

describe('excerpts', () => {
  it('keeps the first 3 non-empty lines', () => {
    expect(firstLines('one\n\n  \ntwo\r\nthree\nfour')).toBe('one\ntwo\nthree');
  });

  it('removes colour codes and the Exit code line', () => {
    expect(
      errorExcerpt(
        'Exit code 1\n\u001b[31mFAIL\u001b[0m src/a.test.ts\n\u001b[1mExpected 2\u001b[22m',
        HOME,
      ),
    ).toBe('FAIL src/a.test.ts\nExpected 2');
  });

  it('writes the home folder ~ and cuts past 300 characters with …', () => {
    const long = `${HOME}/app ${'x'.repeat(400)}`;
    const excerpt = errorExcerpt(long, HOME);
    expect(excerpt.startsWith('~/app xxx')).toBe(true);
    expect(excerpt).toHaveLength(301);
    expect(excerpt.endsWith('…')).toBe(true);
    expect(errorExcerpt('x'.repeat(300), HOME)).toBe('x'.repeat(300));
  });
});
