import { type RefObject, useCallback, useEffect, useState } from 'react';
import type {
  CliConnectionItem,
  CliConnectionsView,
  DisconnectCliConnection,
  LoadCliConnections,
} from './cli-connections-api.ts';
import { useRefreshing } from './skills-api.ts';

export interface Confirming {
  connection: CliConnectionItem;
  busy: boolean;
  error?: string | undefined;
}

export function useConnections(load: LoadCliConnections): {
  view: CliConnectionsView | undefined;
  removed: (id: number) => void;
} {
  const [version, setVersion] = useState(0);
  const [gone, setGone] = useState<ReadonlySet<number>>(new Set());
  const loaded = useRefreshing(
    `cli-connections:${String(version)}`,
    load,
    'cli-connections',
  );
  const view =
    loaded?.status === 'ok'
      ? {
          ...loaded,
          connections: loaded.connections.filter(({ id }) => !gone.has(id)),
        }
      : loaded;
  const removed = useCallback((id: number) => {
    setGone((previous) => new Set([...previous, id]));
    setVersion((previous) => previous + 1);
  }, []);
  return { view, removed };
}

export function useDisconnect(
  disconnect: DisconnectCliConnection,
  onDisconnected: (connection: CliConnectionItem) => void,
): {
  confirming: Confirming | undefined;
  ask: (connection: CliConnectionItem) => void;
  cancel: () => void;
  confirm: () => void;
} {
  const [confirming, setConfirming] = useState<Confirming>();
  async function run(connection: CliConnectionItem): Promise<void> {
    setConfirming({ connection, busy: true });
    const outcome = await disconnect(connection.id);
    if (outcome.status === 'disconnected') {
      onDisconnected(connection);
      setConfirming(undefined);
      return;
    }
    setConfirming({ connection, busy: false, error: outcome.message });
  }
  return {
    confirming,
    ask: (connection) => {
      setConfirming({ connection, busy: false });
    },
    cancel: () => {
      setConfirming(undefined);
    },
    confirm: () => {
      if (confirming !== undefined && !confirming.busy) {
        void run(confirming.connection);
      }
    },
  };
}

export function useRowFocus(
  page: RefObject<HTMLElement | null>,
): (index: number) => void {
  const [target, setTarget] = useState<number>();
  useEffect(() => {
    const root = page.current;
    if (target === undefined || root === null) return;
    const buttons = [...root.querySelectorAll<HTMLElement>('tbody button')];
    (buttons[Math.min(target, buttons.length - 1)] ?? root).focus();
    setTarget(undefined);
  }, [target, page]);
  return setTarget;
}
