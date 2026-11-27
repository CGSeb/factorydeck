import { useCallback, useState } from 'react';
import type { CreateResetLink, CreatedResetLink } from './reset-api.ts';
import type { RowMessage } from './team-changes.ts';

export interface ResetLinks {
  links: ReadonlyMap<number, CreatedResetLink>;
  busy: ReadonlySet<number>;
  message: RowMessage | undefined;
  create: (accountId: number) => void;
  close: (accountId: number) => void;
}

function withoutKey<T>(
  map: ReadonlyMap<number, T>,
  key: number,
): Map<number, T> {
  const next = new Map(map);
  next.delete(key);
  return next;
}

function withoutId(set: ReadonlySet<number>, id: number): Set<number> {
  const next = new Set(set);
  next.delete(id);
  return next;
}

export function useResetLinks(
  createResetLink: CreateResetLink | undefined,
): ResetLinks {
  const [links, setLinks] = useState<ReadonlyMap<number, CreatedResetLink>>(
    () => new Map(),
  );
  const [busy, setBusy] = useState<ReadonlySet<number>>(() => new Set());
  const [message, setMessage] = useState<RowMessage | undefined>();
  const create = useCallback(
    (accountId: number) => {
      if (createResetLink === undefined) return;
      setBusy((current) => new Set(current).add(accountId));
      setMessage(undefined);
      void createResetLink(accountId).then((outcome) => {
        setBusy((current) => withoutId(current, accountId));
        if (outcome.status === 'created') {
          setLinks((current) => new Map(current).set(accountId, outcome.link));
          return;
        }
        setMessage({ accountId, text: outcome.message });
      });
    },
    [createResetLink],
  );
  const close = useCallback((accountId: number) => {
    setLinks((current) => withoutKey(current, accountId));
  }, []);
  return { links, busy, message, create, close };
}
