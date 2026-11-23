import { describe, expect, it } from 'vitest';
import { helpLeft } from './figure-help.ts';

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
