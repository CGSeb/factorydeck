import { useCallback, useRef, useState } from 'react';
import type { TeamAccountRow } from '../team/types.ts';
import type { AccountChangeOutcome } from './role-change-api.ts';
import { useRefreshing } from './skills-api.ts';
import {
  REFUSED_RETRY_SECONDS,
  type LoadTeam,
  type TeamView,
} from './team-api.ts';

export interface RowMessage {
  accountId: number;
  text: string;
}

interface Loaded {
  view: TeamView;
  sent: number;
  refreshSeconds: number;
}

interface Local {
  epoch: number;
  rows: ReadonlyMap<number, { account: TeamAccountRow; epoch: number }>;
  refusedAt: number | undefined;
  busy: ReadonlySet<number>;
  message: RowMessage | undefined;
}

export interface TeamChanges {
  view: TeamView | undefined;
  busy: ReadonlySet<number>;
  message: RowMessage | undefined;
  run: (accountId: number, send: () => Promise<AccountChangeOutcome>) => void;
}

const START: Local = {
  epoch: 0,
  rows: new Map(),
  refusedAt: undefined,
  busy: new Set(),
  message: undefined,
};

function without(busy: ReadonlySet<number>, id: number): Set<number> {
  const next = new Set(busy);
  next.delete(id);
  return next;
}

export function settle(
  local: Local,
  accountId: number,
  outcome: AccountChangeOutcome,
  epoch: number,
): Local {
  const busy = without(local.busy, accountId);
  if (outcome.status === 'failed') {
    return { ...local, busy, message: { accountId, text: outcome.message } };
  }
  if (outcome.status === 'refused') {
    return { ...local, busy, epoch, refusedAt: epoch };
  }
  const rows = new Map(local.rows);
  rows.set(accountId, { account: outcome.account, epoch });
  return { ...local, busy, epoch, rows, message: undefined };
}

export function shownView(
  loaded: Loaded | undefined,
  local: Local,
): TeamView | undefined {
  const sent = loaded?.sent ?? -1;
  if (local.refusedAt !== undefined && sent < local.refusedAt) {
    return { status: 'refused', refreshSeconds: REFUSED_RETRY_SECONDS };
  }
  const view = loaded?.view;
  if (view?.status !== 'ok') return view;
  return {
    ...view,
    accounts: view.accounts.map((row) => {
      const changed = local.rows.get(row.id);
      return changed !== undefined && changed.epoch > sent
        ? changed.account
        : row;
    }),
  };
}

export function useTeamChanges(loadTeam: LoadTeam): TeamChanges {
  const epoch = useRef(0);
  const load = useCallback(async (): Promise<Loaded | undefined> => {
    const sent = epoch.current;
    const view = await loadTeam();
    return view === undefined
      ? undefined
      : { view, sent, refreshSeconds: view.refreshSeconds };
  }, [loadTeam]);
  const loaded = useRefreshing('team', load, 'team');
  const [local, setLocal] = useState<Local>(START);
  const [accepted, setAccepted] = useState<Loaded | undefined>(loaded);
  if (
    loaded !== accepted &&
    loaded !== undefined &&
    loaded.sent >= local.epoch
  ) {
    setAccepted(loaded);
  }
  const run = useCallback(
    (accountId: number, send: () => Promise<AccountChangeOutcome>) => {
      setLocal((current) => ({
        ...current,
        busy: new Set(current.busy).add(accountId),
        message: undefined,
      }));
      void send().then((outcome) => {
        if (outcome.status !== 'failed') epoch.current += 1;
        const settledAt = epoch.current;
        setLocal((current) => settle(current, accountId, outcome, settledAt));
      });
    },
    [],
  );
  return {
    view: shownView(accepted, local),
    busy: local.busy,
    message: local.message,
    run,
  };
}
