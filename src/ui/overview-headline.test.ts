import { describe, expect, it } from 'vitest';
import { headlineKinds, openBugsText } from './overview-board.ts';

describe('headline by kind', () => {
  it('names the merged features and bugs apart with bug tickets', () => {
    expect(headlineKinds({ feature: 5, bug: 2 }, true)).toBe(
      '5 features and 2 bugs merged for ',
    );
    expect(headlineKinds({ feature: 1, bug: 1 }, true)).toBe(
      '1 feature and 1 bug merged for ',
    );
    expect(headlineKinds({ feature: 1_200, bug: 0 }, true)).toBe(
      '1,200 features merged for ',
    );
    expect(headlineKinds({ feature: 0, bug: 3 }, true)).toBe(
      '3 bugs merged for ',
    );
    expect(headlineKinds({ feature: 0, bug: 0 }, true)).toBe(
      'No issue merged · ',
    );
  });

  it('names the merged issues as today without bug tickets', () => {
    expect(headlineKinds({ feature: 7, bug: 0 }, false)).toBe(
      '7 issues merged for ',
    );
    expect(headlineKinds({ feature: 1, bug: 0 }, false)).toBe(
      '1 issue merged for ',
    );
    expect(headlineKinds({ feature: 0, bug: 0 }, false)).toBe(
      'No issue merged · ',
    );
  });

  it('counts the open bugs', () => {
    expect(openBugsText(1)).toBe('1 open bug');
    expect(openBugsText(4)).toBe('4 open bugs');
  });
});
