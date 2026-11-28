import type { TeamProject } from './project-types.ts';

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  return left > right ? 1 : 0;
}

export function byProjectOrder(left: TeamProject, right: TeamProject): number {
  return (
    compareText(left.name.toLowerCase(), right.name.toLowerCase()) ||
    compareText(left.name, right.name) ||
    left.id - right.id
  );
}
