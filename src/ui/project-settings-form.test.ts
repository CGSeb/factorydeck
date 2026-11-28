import { describe, expect, it } from 'vitest';
import { changedFields, keptEdits } from './project-settings-form.ts';
import { someProjects } from './projects-list-fixtures.ts';

const project = someProjects[1];
if (project === undefined) throw new Error('No project fixture');

describe('changedFields', () => {
  it('keeps only the edited fields that differ from the project', () => {
    expect(changedFields(project, {})).toEqual({});
    expect(
      changedFields(project, { name: project.name, remote: project.remote }),
    ).toEqual({});
    expect(changedFields(project, { name: 'Payments', remote: '' })).toEqual({
      name: 'Payments',
      remote: '',
    });
  });
});

describe('keptEdits', () => {
  it('drops the edits that were saved and keeps the newer ones', () => {
    expect(
      keptEdits(
        { name: 'Payments', remote: 'r2' },
        { name: 'Payments', remote: 'r1' },
      ),
    ).toEqual({ remote: 'r2' });
    expect(keptEdits({ name: 'Payments' }, { name: 'Payments' })).toEqual({});
  });
});
