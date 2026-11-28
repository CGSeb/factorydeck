import { describe, expect, it } from 'vitest';
import {
  addedProject,
  somePendingRemotes,
  someProjects,
} from './projects-list-fixtures.ts';
import {
  addRemoteValue,
  projectsSummary,
  withoutProjects,
} from './projects-view.ts';

describe('projectsSummary', () => {
  it('counts the remotes not added only when there is one', () => {
    expect(projectsSummary(someProjects)).toBe('3 projects');
    expect(projectsSummary([addedProject], 0)).toBe('1 project');
    expect(projectsSummary(someProjects, 1)).toBe(
      '3 projects · 1 remote not added',
    );
    expect(projectsSummary([], 2)).toBe('0 projects · 2 remotes not added');
  });
});

describe('withoutProjects', () => {
  it('drops the line of a remote that has a project, and keeps the others', () => {
    expect(withoutProjects(somePendingRemotes, [addedProject])).toEqual([
      somePendingRemotes[1],
    ]);
  });

  it('keeps the line when the project added has another remote', () => {
    const edited = { ...addedProject, remote: 'github.com/example-org/other' };
    expect(withoutProjects(somePendingRemotes, [edited])).toEqual(
      somePendingRemotes,
    );
  });
});

describe('addRemoteValue', () => {
  it('fills the form with the https form of the remote', () => {
    expect(addRemoteValue('github.com/example-org/factorydeck')).toBe(
      'https://github.com/example-org/factorydeck',
    );
  });
});
