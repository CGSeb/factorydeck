import { ORCHESTRATION_ROLE } from '../../features/types.ts';
import { UNASSIGNED_ROLE } from '../../roles/types.ts';

export const CATEGORY_COLORS = [
  '#0f766e',
  '#c27a12',
  '#b4442c',
  '#3d8bd4',
  '#7c9a5a',
  '#8a6fb8',
  '#b5582a',
  '#2f8f9d',
] as const;

export const PROJECT_COLORS = [
  '#7c3aed',
  '#c2410c',
  '#2f5fb3',
  '#0f766e',
  '#b45309',
  '#be185d',
  '#4d7c0f',
  '#0369a1',
] as const;

export const ORCHESTRATION_COLOR = '#5b6b8c';
export const UNASSIGNED_COLOR = '#a9b3b0';

function cycle(colors: readonly string[], index: number): string {
  const position = Number.isInteger(index) && index > 0 ? index : 0;
  return colors[position % colors.length] ?? colors[0] ?? '';
}

export function categoryColor(index: number): string {
  return cycle(CATEGORY_COLORS, index);
}

export function projectColor(index: number): string {
  return cycle(PROJECT_COLORS, index);
}

export function roleColors(roles: string[]): Map<string, string> {
  const colors = new Map<string, string>();
  let position = 0;
  for (const role of roles) {
    if (colors.has(role)) continue;
    if (role === ORCHESTRATION_ROLE) colors.set(role, ORCHESTRATION_COLOR);
    else if (role === UNASSIGNED_ROLE) colors.set(role, UNASSIGNED_COLOR);
    else colors.set(role, categoryColor(position++));
  }
  return colors;
}

export function projectColors(projects: string[]): Map<string, string> {
  const colors = new Map<string, string>();
  for (const project of projects) {
    if (!colors.has(project)) colors.set(project, projectColor(colors.size));
  }
  return colors;
}
