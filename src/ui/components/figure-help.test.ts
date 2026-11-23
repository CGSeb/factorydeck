import { describe, expect, it } from 'vitest';
import { helpLeft, helpTop } from './figure-help.ts';

describe('figure help placement', () => {
  it('centres the tooltip under the icon when it fits', () => {
    expect(helpLeft({ left: 500, width: 14 }, 260, 1024)).toBe(377);
  });

  it('keeps the tooltip inside the viewport on the left', () => {
    expect(helpLeft({ left: 20, width: 14 }, 260, 360)).toBe(8);
  });

  it('keeps the tooltip inside the viewport on the right', () => {
    expect(helpLeft({ left: 340, width: 14 }, 260, 360)).toBe(92);
  });

  it('starts at the margin when the tooltip is as wide as the viewport allows', () => {
    expect(helpLeft({ left: 180, width: 14 }, 344, 360)).toBe(8);
  });
});

describe('figure help vertical placement', () => {
  it('opens under the icon when there is room below', () => {
    expect(helpTop({ top: 100, bottom: 114 }, 80, 800)).toEqual({
      top: 120,
      side: 'below',
    });
  });

  it('opens above the icon when there is no room below', () => {
    expect(helpTop({ top: 740, bottom: 754 }, 80, 800)).toEqual({
      top: 654,
      side: 'above',
    });
  });

  it('stays inside the viewport when there is no room either way', () => {
    expect(helpTop({ top: 60, bottom: 74 }, 100, 160)).toEqual({
      top: 52,
      side: 'below',
    });
    expect(helpTop({ top: 60, bottom: 74 }, 200, 160)).toEqual({
      top: 8,
      side: 'below',
    });
  });
});
