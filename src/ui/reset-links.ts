import { useCallback, useState } from 'react';
import type { TeamAccountRow } from '../team/types.ts';
import type { CreateResetLink, CreatedResetLink } from './reset-api.ts';
import type { TeamChangeOutcome, TeamChanges } from './team-changes.ts';

export interface ResetLinks {
  links: ReadonlyMap<number, CreatedResetLink>;
  create: (account: TeamAccountRow) => void;
  close: (accountId: number) => void;
}

function withoutKeys<T>(
  map: ReadonlyMap<number, T>,
  keys: readonly number[],
): Map<number, T> {
  const next = new Map(map);
  for (const key of keys) next.delete(key);
  return next;
}

export function deactivatedLinks(
  links: ReadonlyMap<number, unknown>,
  accounts: readonly TeamAccountRow[] | undefined,
): number[] {
  return (accounts ?? [])
    .filter(({ id, active }) => !active && links.has(id))
    .map(({ id }) => id);
}

export function useResetLinks(
  createResetLink: CreateResetLink | undefined,
  run: TeamChanges['run'],
  accounts: readonly TeamAccountRow[] | undefined,
): ResetLinks {
  const [links, setLinks] = useState<ReadonlyMap<number, CreatedResetLink>>(
    () => new Map(),
  );
  const closed = deactivatedLinks(links, accounts);
  if (closed.length > 0) setLinks(withoutKeys(links, closed));
  const create = useCallback(
    (account: TeamAccountRow) => {
      if (createResetLink === undefined) return;
      run(account.id, async (): Promise<TeamChangeOutcome> => {
        const outcome = await createResetLink(account.id);
        if (outcome.status !== 'created') return outcome;
        setLinks((current) => new Map(current).set(account.id, outcome.link));
        return { status: 'done' };
      });
    },
    [createResetLink, run],
  );
  const close = useCallback((accountId: number) => {
    setLinks((current) => withoutKeys(current, [accountId]));
  }, []);
  return { links, create, close };
}
