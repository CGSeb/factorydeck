import { describe, expect, it } from 'vitest';
import { duplicateLabel, folderName, projectText } from './label.ts';

describe('folderName', () => {
  it('is the last segment of the root path', () => {
    expect(folderName('/home/me/factorydeck')).toBe('factorydeck');
    expect(folderName('/home/me/factorydeck/')).toBe('factorydeck');
    expect(folderName('C:\\work\\app')).toBe('app');
    expect(folderName('/')).toBe('/');
  });
});

describe('projectText', () => {
  it('shows a name with its root as tooltip', () => {
    expect(projectText('/work/app', 'App')).toEqual({
      text: 'App',
      title: '/work/app',
    });
  });

  it('keeps the root of a duplicated name in the text', () => {
    const label = duplicateLabel('Shop', '/work/web');
    expect(label).toBe('Shop (/work/web)');
    expect(projectText('/work/web', label)).toEqual({
      text: 'Shop (/work/web)',
      title: '/work/web',
    });
  });

  it('cuts a name longer than 60 characters, with the full name and root in the tooltip', () => {
    const name = `${'n'.repeat(60)}x`;
    expect(projectText('/work/app', name)).toEqual({
      text: `${'n'.repeat(60)}…`,
      title: `${name}\n/work/app`,
    });
    expect(projectText('/work/app', 'n'.repeat(60))).toEqual({
      text: 'n'.repeat(60),
      title: '/work/app',
    });
    expect(projectText('/work/app', duplicateLabel(name, '/work/app'))).toEqual(
      {
        text: `${'n'.repeat(60)}… (/work/app)`,
        title: `${name}\n/work/app`,
      },
    );
  });

  it('counts characters, not code units', () => {
    const name = '🚀'.repeat(61);
    expect(projectText('/work/app', name).text).toBe(`${'🚀'.repeat(60)}…`);
  });

  it('gives unassigned no tooltip', () => {
    expect(projectText('unassigned', 'unassigned')).toEqual({
      text: 'unassigned',
      title: undefined,
    });
  });
});
