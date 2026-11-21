export const BLACK = '#000000';
export const WHITE = '#ffffff';

function channel(value: number): number {
  const ratio = value / 255;
  return ratio <= 0.040_45 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const digits = hex.replace(/^#/, '');
  const [red = 0, green = 0, blue = 0] = [0, 2, 4].map((start) =>
    channel(Number.parseInt(digits.slice(start, start + 2), 16) || 0),
  );
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

export function labelTextColor(background: string): string {
  return contrastRatio(background, BLACK) >= contrastRatio(background, WHITE)
    ? BLACK
    : WHITE;
}
