import { describe, expect, it } from 'vitest';
import { checkedMessage, gitHostCell, readOnlyHost } from './git-host-view.ts';

describe('gitHostCell', () => {
  it('reads the host and whether a token is set', () => {
    expect(
      gitHostCell({
        remote: 'github.com/acme/app',
        gitHost: 'github',
        tokenSet: true,
      }),
    ).toBe('GitHub · token');
    expect(
      gitHostCell({
        remote: 'git.example.test/acme/app',
        gitHost: 'gitlab',
        tokenSet: false,
      }),
    ).toBe('GitLab · no token');
  });

  it('shows a dash alone when the host is unknown', () => {
    expect(
      gitHostCell({
        remote: 'git.example.test/acme/app',
        gitHost: null,
        tokenSet: false,
      }),
    ).toBe('—');
  });

  it('reads the host of a project just added from its remote', () => {
    expect(gitHostCell({ remote: 'gitlab.com/acme/app' })).toBe(
      'GitLab · no token',
    );
    expect(gitHostCell({ remote: 'git.example.test/acme/app' })).toBe('—');
  });
});

describe('readOnlyHost', () => {
  it('fixes the host of github.com and gitlab.com only', () => {
    expect(readOnlyHost('github.com/acme/app')).toBe('github');
    expect(readOnlyHost('gitlab.com/group/sub/app')).toBe('gitlab');
    expect(readOnlyHost('github.example.test/acme/app')).toBeUndefined();
    expect(readOnlyHost('gitlab.com.example.test/acme/app')).toBeUndefined();
  });
});

describe('checkedMessage', () => {
  it('names the default branch', () => {
    expect(checkedMessage('trunk')).toBe(
      'Token checked: trunk has docs/agents/factory.yml.',
    );
  });
});
