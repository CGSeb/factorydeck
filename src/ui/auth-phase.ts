import { useEffect, useRef, useState } from 'react';
import {
  SERVER_UNREACHABLE,
  type Account,
  type LoadAuthState,
  type LoadMe,
  type MeResult,
  type SignIn,
} from './auth-api.ts';
import type { SessionGate } from './auth-gate.ts';
import type { AccountView } from './components/Sidebar.tsx';

export type AuthPhase =
  | { name: 'checking' }
  | { name: 'setup' }
  | { name: 'signed-out' }
  | { name: 'unreachable'; message: string; retrying: boolean }
  | { name: 'ready'; account: Account | undefined };

type Checked = Exclude<AuthPhase, { name: 'checking' }>;

function phaseOfMe(outcome: MeResult): Checked {
  switch (outcome.status) {
    case 'account':
      return { name: 'ready', account: outcome.account };
    case 'signed-out':
      return { name: 'signed-out' };
    case 'unreachable':
      return { name: 'unreachable', message: outcome.message, retrying: false };
  }
}

async function checkAuth(
  loadAuthState: LoadAuthState,
  loadMe: LoadMe | undefined,
): Promise<Checked> {
  const state = await loadAuthState();
  if ('unreachable' in state) {
    return { name: 'unreachable', message: state.unreachable, retrying: false };
  }
  if (state.setup) return { name: 'setup' };
  if (loadMe === undefined) return { name: 'ready', account: undefined };
  return phaseOfMe(await loadMe());
}

export interface AuthSources {
  loadAuthState?: LoadAuthState | undefined;
  loadMe?: LoadMe | undefined;
  sessionGate?: SessionGate | undefined;
}

export function useAuthPhase({
  loadAuthState,
  loadMe,
  sessionGate,
}: AuthSources): [AuthPhase, (phase: AuthPhase) => void, () => void] {
  const [phase, setPhase] = useState<AuthPhase>(
    loadAuthState === undefined
      ? { name: 'ready', account: undefined }
      : { name: 'checking' },
  );
  const current = useRef(true);
  useEffect(() => {
    current.current = true;
    if (loadAuthState !== undefined) {
      void checkAuth(loadAuthState, loadMe).then((checked) => {
        if (current.current) setPhase(checked);
      });
    }
    return () => {
      current.current = false;
    };
  }, [loadAuthState, loadMe]);
  useEffect(
    () => sessionGate?.onSignedOut(() => setPhase({ name: 'signed-out' })),
    [sessionGate],
  );
  function retry(): void {
    if (loadAuthState === undefined) return;
    setPhase((previous) =>
      previous.name === 'unreachable'
        ? { ...previous, retrying: true }
        : previous,
    );
    void checkAuth(loadAuthState, loadMe).then((checked) => {
      if (current.current) setPhase(checked);
    });
  }
  return [phase, setPhase, retry];
}

export function signInThenRead(
  signIn: SignIn,
  loadMe: LoadMe | undefined,
  sessionGate: SessionGate | undefined,
): SignIn {
  return async (input) => {
    const outcome = await signIn(input);
    if (outcome.status !== 'signed-in') return outcome;
    sessionGate?.reopen();
    if (loadMe === undefined) return outcome;
    const me = await loadMe();
    if (me.status === 'account') {
      return { status: 'signed-in', account: me.account };
    }
    return {
      status: 'failed',
      message: me.status === 'unreachable' ? me.message : SERVER_UNREACHABLE,
    };
  };
}

export function useAccountView(
  loadMe: LoadMe | undefined,
  phase: AuthPhase,
  onSignedOut: () => void,
): AccountView {
  const known = phase.name === 'ready' ? phase.account : undefined;
  const unread = phase.name === 'ready' && phase.account === undefined;
  const [view, setView] = useState<AccountView>({ status: 'loading' });
  const signedOut = useRef(onSignedOut);
  signedOut.current = onSignedOut;
  useEffect(() => {
    if (loadMe === undefined || !unread) return;
    let current = true;
    void loadMe().then((result) => {
      if (!current) return;
      setView(
        result.status === 'account'
          ? { status: 'account', account: result.account }
          : { status: 'unavailable' },
      );
      if (result.status === 'signed-out') signedOut.current();
    });
    return () => {
      current = false;
    };
  }, [loadMe, unread]);
  return known === undefined ? view : { status: 'account', account: known };
}
