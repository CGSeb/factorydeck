import { contrastRatio, labelTextColor } from '../colors.ts';
import { describe, expect, it } from 'vitest';
import {
  CATEGORY_COLORS,
  ORCHESTRATION_COLOR,
  UNASSIGNED_COLOR,
  categoryColor,
  projectColor,
  projectColors,
  roleColors,
} from './palette.ts';

const CATEGORY = [
  '#0f766e',
  '#c27a12',
  '#b4442c',
  '#3d8bd4',
  '#7c9a5a',
  '#8a6fb8',
  '#b5582a',
  '#2f8f9d',
];

const PROJECT = [
  '#7c3aed',
  '#c2410c',
  '#2f5fb3',
  '#0f766e',
  '#b45309',
  '#be185d',
  '#4d7c0f',
  '#0369a1',
];

describe('categoryColor', () => {
  it('returns the category palette from index 0', () => {
    expect(CATEGORY.map((_, index) => categoryColor(index))).toEqual(CATEGORY);
  });

  it('starts again after the last colour', () => {
    expect(categoryColor(8)).toBe(CATEGORY[0]);
    expect(categoryColor(9)).toBe(CATEGORY[1]);
    expect(categoryColor(17)).toBe(CATEGORY[1]);
  });

  it('treats a negative or non-integer index as 0', () => {
    expect(categoryColor(-1)).toBe(CATEGORY[0]);
    expect(categoryColor(2.5)).toBe(CATEGORY[0]);
    expect(categoryColor(Number.NaN)).toBe(CATEGORY[0]);
    expect(categoryColor(Number.POSITIVE_INFINITY)).toBe(CATEGORY[0]);
  });
});

describe('projectColor', () => {
  it('returns the project palette from index 0', () => {
    expect(PROJECT.map((_, index) => projectColor(index))).toEqual(PROJECT);
  });

  it('starts again after the last colour', () => {
    expect(projectColor(8)).toBe(PROJECT[0]);
    expect(projectColor(15)).toBe(PROJECT[7]);
  });

  it('treats a negative or non-integer index as 0', () => {
    expect(projectColor(-3)).toBe(PROJECT[0]);
    expect(projectColor(0.1)).toBe(PROJECT[0]);
  });
});

describe('fixed colours', () => {
  it('has the orchestration and unassigned colours', () => {
    expect(ORCHESTRATION_COLOR).toBe('#5b6b8c');
    expect(UNASSIGNED_COLOR).toBe('#a9b3b0');
  });
});

describe('roleColors', () => {
  it('colours other roles by their position among them, skipping orchestration and unassigned', () => {
    const colors = roleColors([
      'Builder',
      'Orchestration',
      'Reviewer',
      'unassigned',
      'Shipper',
    ]);
    expect([...colors]).toEqual([
      ['Builder', CATEGORY[0]],
      ['Orchestration', ORCHESTRATION_COLOR],
      ['Reviewer', CATEGORY[1]],
      ['unassigned', UNASSIGNED_COLOR],
      ['Shipper', CATEGORY[2]],
    ]);
  });

  it('follows the given order, not the names', () => {
    expect(roleColors(['Zeta', 'Alpha']).get('Zeta')).toBe(CATEGORY[0]);
    expect(roleColors(['Alpha', 'Zeta']).get('Zeta')).toBe(CATEGORY[1]);
  });

  it('wraps around past eight roles', () => {
    const roles = Array.from({ length: 9 }, (_, index) => `role-${index}`);
    expect(roleColors(roles).get('role-8')).toBe(CATEGORY[0]);
  });

  it('keeps the first position of a repeated role', () => {
    const colors = roleColors(['Builder', 'Builder', 'Reviewer']);
    expect(colors.get('Builder')).toBe(CATEGORY[0]);
    expect(colors.get('Reviewer')).toBe(CATEGORY[1]);
  });

  it('returns an empty map for no role', () => {
    expect(roleColors([]).size).toBe(0);
  });
});

describe('projectColors', () => {
  it('colours projects by their position', () => {
    expect([...projectColors(['web', 'api', 'docs'])]).toEqual([
      ['web', PROJECT[0]],
      ['api', PROJECT[1]],
      ['docs', PROJECT[2]],
    ]);
  });

  it('follows the given order and keeps the first position of a repeated project', () => {
    const colors = projectColors(['api', 'web', 'api', 'docs']);
    expect(colors.get('api')).toBe(PROJECT[0]);
    expect(colors.get('docs')).toBe(PROJECT[2]);
  });

  it('wraps around past eight projects', () => {
    const projects = Array.from({ length: 10 }, (_, index) => `p${index}`);
    expect(projectColors(projects).get('p9')).toBe(PROJECT[1]);
  });
});

describe('text on palette colours', () => {
  it.each([...CATEGORY_COLORS, ORCHESTRATION_COLOR, UNASSIGNED_COLOR])(
    'labelTextColor on %s reaches 4.5:1',
    (color) => {
      expect(
        contrastRatio(labelTextColor(color), color),
      ).toBeGreaterThanOrEqual(4.5);
    },
  );
});
