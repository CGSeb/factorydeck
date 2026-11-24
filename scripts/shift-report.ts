/** The top of each watched element, or `null` when it is not on the page. */
export type Sample = Record<string, number | null>;

/** One animation frame: its time on the page clock and where each element was. */
export interface Frame {
  at: number;
  tops: Sample;
}

export interface Move {
  element: string;
  from: number;
  to: number;
  frame: number;
  /** True when the element moved before the data of the action had arrived: a layout shift. */
  beforeData: boolean;
}

const TOLERANCE_PX = 0.5;

/**
 * The first frame where each element sits away from where it was before the action. `dataAt` is
 * when the last response the action started ended, or `null` when it started none.
 */
export function movesOf(
  before: Sample,
  frames: readonly Frame[],
  elements: readonly string[],
  dataAt: number | null,
): Move[] {
  return elements.flatMap((element) => {
    const from = before[element];
    if (from === null || from === undefined) return [];
    const frame = frames.findIndex(({ tops }) => {
      const top = tops[element];
      return (
        top !== null && top !== undefined && Math.abs(top - from) > TOLERANCE_PX
      );
    });
    const moved = frames[frame];
    const to = moved?.tops[element];
    if (moved === undefined || to === null || to === undefined) return [];
    return [
      {
        element,
        from,
        to,
        frame,
        beforeData: dataAt === null || moved.at < dataAt,
      },
    ];
  });
}

function px(value: number): string {
  return `${String(Math.round(value * 10) / 10)} px`;
}

function listed(moves: readonly Move[]): string {
  return moves
    .map(
      ({ element, from, to, frame }) =>
        `${element} ${px(from)} → ${px(to)} at frame ${String(frame + 1)}`,
    )
    .join(', ');
}

export function describeMoves(
  action: string,
  frames: number,
  moves: readonly Move[],
): string {
  const shifts = moves.filter(({ beforeData }) => beforeData);
  if (shifts.length > 0) return `SHIFT ${action}: ${listed(shifts)}`;
  if (moves.length > 0) {
    return `ok    ${action}: moved only once the data arrived (${listed(moves)})`;
  }
  return `ok    ${action}: nothing moved over ${String(frames)} frames`;
}
