import type {
  RemoveToken,
  RemoveTokenOutcome,
  SaveToken,
  SaveTokenOutcome,
} from './git-host-token-api.ts';
import type { ListedProject } from './projects-api.ts';

export const githubNoToken: ListedProject = {
  id: 3,
  name: 'Website',
  slug: 'website',
  remote: 'github.com/example-org/website',
  createdAt: '2026-03-10T08:45:00Z',
  sessions: 0,
  gitHost: 'github',
  tokenSet: false,
  tokenSetAt: null,
  tokenSetBy: null,
};

export const githubWithToken: ListedProject = {
  ...githubNoToken,
  id: 1,
  name: 'Billing',
  slug: 'billing-service',
  remote: 'github.com/example-org/billing-service',
  tokenSet: true,
  tokenSetAt: '2026-02-03T10:00:00Z',
  tokenSetBy: { name: 'Ada' },
};

export const selfHostedUnknown: ListedProject = {
  ...githubNoToken,
  id: 2,
  name: 'atlas',
  slug: 'atlas',
  remote: 'gitlab.example.test/platform/tools/atlas',
  gitHost: null,
};

export const selfHostedWithToken: ListedProject = {
  ...selfHostedUnknown,
  gitHost: 'gitlab',
  tokenSet: true,
  tokenSetAt: '2026-02-03T10:00:00Z',
  tokenSetBy: null,
};

export const savedToken: SaveTokenOutcome = {
  status: 'saved',
  token: {
    gitHost: 'github',
    tokenSet: true,
    tokenSetAt: '2026-03-12T09:30:00Z',
    tokenSetBy: { name: 'Grace' },
  },
  defaultBranch: 'main',
};

export function tokenSaverOf(outcome: SaveTokenOutcome): SaveToken {
  return () => Promise.resolve(outcome);
}

export function pendingTokenSave(): SaveToken {
  return () => new Promise<SaveTokenOutcome>(() => undefined);
}

export function tokenRemoverOf(outcome: RemoveTokenOutcome): RemoveToken {
  return () => Promise.resolve(outcome);
}

export function pendingTokenRemove(): RemoveToken {
  return () => new Promise<RemoveTokenOutcome>(() => undefined);
}
