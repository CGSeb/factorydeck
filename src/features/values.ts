export function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function addCost(
  total: number | null,
  cost: number | undefined,
): number | null {
  return cost === undefined ? total : (total ?? 0) + cost;
}

export function timestamp(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return new Date(value).toISOString();
  return null;
}

export function latest(
  left: string | null,
  right: string | null,
): string | null {
  if (left === null) return right;
  if (right === null) return left;
  return left > right ? left : right;
}

export function issueKey(project: string, number: number): string {
  return `${String(number)} ${project}`;
}
