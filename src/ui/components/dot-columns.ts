export const DOT_COLUMN_PX = 28;
export const DOT_STACK_MAX_LEVELS = 5;
export const PILL_MAX_COUNT = 99;

export interface DotColumn {
  index: number;
  left: number;
  width: number;
  centre: number;
  items: number[];
}

export interface PlacedDot {
  item: number;
  stack: number;
  x: number;
  level: number;
  folded: boolean;
}

export interface StackPill {
  stack: number;
  x: number;
  left: number;
  width: number;
  level: number;
  hidden: number;
  text: string;
  items: number[];
}

export interface StackLayout {
  dots: PlacedDot[];
  pills: StackPill[];
}

export function columnCount(width: number): number {
  return Math.max(1, Math.ceil(width / DOT_COLUMN_PX));
}

export function columnOf(x: number, width: number): number {
  const last = columnCount(width) - 1;
  return Math.min(Math.max(Math.floor(x / DOT_COLUMN_PX), 0), last);
}

function columnBox(index: number, width: number): Omit<DotColumn, 'items'> {
  const left = index * DOT_COLUMN_PX;
  const right = Math.max(left, Math.min(left + DOT_COLUMN_PX, width));
  const columnWidth = right === left ? DOT_COLUMN_PX : right - left;
  return {
    index,
    left,
    width: columnWidth,
    centre: left + columnWidth / 2,
  };
}

export function dotColumns(xs: readonly number[], width: number): DotColumn[] {
  const columns = new Map<number, DotColumn>();
  xs.forEach((x, item) => {
    const index = columnOf(x, width);
    const column = columns.get(index);
    if (column === undefined) {
      columns.set(index, { ...columnBox(index, width), items: [item] });
    } else {
      column.items.push(item);
    }
  });
  return [...columns.values()].sort((a, b) => a.index - b.index);
}

export function pillText(hidden: number): string {
  return hidden > PILL_MAX_COUNT
    ? `${String(PILL_MAX_COUNT)}+`
    : `+${String(hidden)}`;
}

function pillBox(
  column: DotColumn,
  previous: DotColumn | undefined,
): { left: number; width: number } {
  const right = column.left + column.width;
  const previousIsFree =
    previous?.index !== column.index - 1 ||
    previous.items.length < DOT_STACK_MAX_LEVELS;
  if (column.width >= DOT_COLUMN_PX || !previousIsFree) {
    return { left: column.left, width: column.width };
  }
  const left = Math.max(0, right - DOT_COLUMN_PX);
  return { left, width: right - left };
}

export function columnLayout(
  xs: readonly number[],
  width: number,
): StackLayout {
  const dots: PlacedDot[] = [];
  const pills: StackPill[] = [];
  const columns = dotColumns(xs, width);
  columns.forEach((column, position) => {
    const folds = column.items.length > DOT_STACK_MAX_LEVELS;
    const shown = folds ? DOT_STACK_MAX_LEVELS - 1 : column.items.length;
    column.items.forEach((item, level) => {
      dots.push({
        item,
        stack: column.index,
        x: column.centre,
        level: Math.min(level, DOT_STACK_MAX_LEVELS - 1),
        folded: level >= shown,
      });
    });
    if (folds) {
      const items = column.items.slice(shown);
      pills.push({
        stack: column.index,
        x: column.centre,
        ...pillBox(column, columns[position - 1]),
        level: DOT_STACK_MAX_LEVELS - 1,
        hidden: items.length,
        text: pillText(items.length),
        items,
      });
    }
  });
  return { dots, pills };
}
