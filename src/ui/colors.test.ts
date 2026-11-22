import { describe, expect, it } from 'vitest';
import { BLACK, WHITE, contrastRatio, labelTextColor } from './colors.ts';

function hex(value: number): string {
  return `#${value.toString(16).padStart(6, '0')}`;
}

describe('labelTextColor', () => {
  it('picks black on light colours and white on dark ones', () => {
    expect(labelTextColor('#fbca04')).toBe(BLACK);
    expect(labelTextColor('#ffffff')).toBe(BLACK);
    expect(labelTextColor('#5319e7')).toBe(WHITE);
    expect(labelTextColor('#000000')).toBe(WHITE);
  });

  it('reaches WCAG AA (4.5:1) whatever the background', () => {
    let lowest = Number.POSITIVE_INFINITY;
    for (let value = 0; value <= 0xffffff; value += 0x010203) {
      const background = hex(value);
      lowest = Math.min(
        lowest,
        contrastRatio(background, labelTextColor(background)),
      );
    }
    expect(lowest).toBeGreaterThanOrEqual(4.5);
  });

  it('measures contrast like WCAG', () => {
    expect(contrastRatio(BLACK, WHITE)).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', WHITE)).toBeCloseTo(4.48, 2);
  });
});
