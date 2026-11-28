import { describe, expect, it } from 'vitest';
import { freeSlug, parseRemote, slugBase } from './remote.ts';

describe('parseRemote', () => {
  it.each([
    ['git@github.com:owner/repo.git', 'github.com/owner/repo', 'repo'],
    ['git@github.com:owner/repo', 'github.com/owner/repo', 'repo'],
    ['git@GitHub.com:Owner/Repo/', 'github.com/owner/repo', 'Repo'],
    ['ssh://git@github.com/owner/repo.git', 'github.com/owner/repo', 'repo'],
    ['ssh://github.com/owner/repo', 'github.com/owner/repo', 'repo'],
    [
      'ssh://git@gitlab.example.test:2222/group/sub/repo.git/',
      'gitlab.example.test/group/sub/repo',
      'repo',
    ],
    ['https://github.com/owner/repo.git', 'github.com/owner/repo', 'repo'],
    ['https://GitHub.com/Owner/Repo.git', 'github.com/owner/repo', 'Repo'],
    [
      'https://user@gitlab.example.test:8443/Group/Sub/My.Repo/',
      'gitlab.example.test/group/sub/my.repo',
      'My.Repo',
    ],
    [
      'http://git.example.test/owner/repo',
      'git.example.test/owner/repo',
      'repo',
    ],
    ['  HTTPS://github.com/owner/repo  ', 'github.com/owner/repo', 'repo'],
  ])('normalises %s', (input, remote, repository) => {
    expect(parseRemote(input)).toEqual({ remote, repository });
  });

  it.each([
    [''],
    ['   '],
    ['foo'],
    ['https://github.com/owner'],
    ['https://github.com/owner/'],
    ['git@github.com:repo.git'],
    ['/home/someone/repo'],
    ['./repo'],
    ['~/code/repo'],
    ['file:///home/someone/repo.git'],
    ['ftp://github.com/owner/repo'],
    ['https://github.com/owner//repo'],
    ['https://github.com/owner/../repo'],
    ['https://github.com/owner/repo?tab=readme'],
    ['https://github.com:abc/owner/repo'],
    ['git@github.com:owner/my repo'],
    ['https:///owner/repo'],
    [`https://github.com/owner/${'r'.repeat(500)}`],
  ])('refuses %j', (input) => {
    expect(parseRemote(input)).toBeUndefined();
  });

  it('accepts a remote of exactly 500 characters', () => {
    const remote = `https://github.com/owner/${'r'.repeat(475)}`;
    expect(remote).toHaveLength(500);
    expect(parseRemote(remote)?.repository).toHaveLength(475);
  });
});

describe('slugBase', () => {
  it.each([
    ['My.Repo', 'my-repo'],
    ['factorydeck', 'factorydeck'],
    ['--Hello__World!!', 'hello-world'],
    ['___', 'project'],
    ['a'.repeat(39) + '-b', 'a'.repeat(39)],
    ['x'.repeat(60), 'x'.repeat(40)],
  ])('turns %s into %s', (repository, slug) => {
    expect(slugBase(repository)).toBe(slug);
  });
});

describe('freeSlug', () => {
  it('keeps a free slug and numbers a taken one from 2', () => {
    expect(freeSlug('my-repo', new Set())).toBe('my-repo');
    expect(freeSlug('my-repo', new Set(['my-repo']))).toBe('my-repo-2');
    expect(freeSlug('my-repo', new Set(['my-repo', 'my-repo-2']))).toBe(
      'my-repo-3',
    );
  });
});
