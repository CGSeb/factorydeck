import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CODE_INVALID,
  type CliDecision,
  type CliDecisionOutcome,
  type CliLogin,
  type DecideCliLogin,
  type ReadCliLogin,
} from './cli-api.ts';

export type CliScreen =
  | { name: 'enter'; error: string | undefined; code: string }
  | { name: 'loading' }
  | {
      name: 'ask';
      login: CliLogin;
      deciding: CliDecision | undefined;
      error: string | undefined;
    }
  | { name: 'connected' }
  | { name: 'cancelled' };

export interface CliPageState {
  screen: CliScreen;
  read: (code: string) => void;
  decide: (decision: CliDecision) => void;
}

function initial(code: string | undefined): CliScreen {
  return code === undefined || code.trim() === ''
    ? { name: 'enter', error: undefined, code: '' }
    : { name: 'loading' };
}

type AskScreen = Extract<CliScreen, { name: 'ask' }>;

function decidedScreen(
  asked: AskScreen,
  decision: CliDecision,
  outcome: CliDecisionOutcome,
): CliScreen {
  if (outcome.status === 'done') {
    return decision === 'approve'
      ? { name: 'connected' }
      : { name: 'cancelled' };
  }
  if (outcome.status === 'invalid') {
    return { name: 'enter', error: CODE_INVALID, code: asked.login.userCode };
  }
  return { ...asked, deciding: undefined, error: outcome.message };
}

export function useCliPage(
  code: string | undefined,
  readCliLogin: ReadCliLogin,
  decideCliLogin: DecideCliLogin,
): CliPageState {
  const [screen, setScreen] = useState<CliScreen>(() => initial(code));
  const mounted = useRef(true);
  const busy = useRef(false);
  const read = useCallback(
    (typed: string) => {
      setScreen({ name: 'loading' });
      void readCliLogin(typed).then((outcome) => {
        if (!mounted.current) return;
        if (outcome.status === 'ok') {
          setScreen({
            name: 'ask',
            login: outcome.login,
            deciding: undefined,
            error: undefined,
          });
          return;
        }
        setScreen({
          name: 'enter',
          code: typed,
          error: outcome.status === 'invalid' ? CODE_INVALID : outcome.message,
        });
      });
    },
    [readCliLogin],
  );
  useEffect(() => {
    mounted.current = true;
    if (code !== undefined && code.trim() !== '') read(code);
    return () => {
      mounted.current = false;
    };
  }, [code, read]);
  function decide(decision: CliDecision): void {
    if (screen.name !== 'ask' || busy.current) return;
    busy.current = true;
    const asked = screen;
    setScreen({ ...asked, deciding: decision, error: undefined });
    void decideCliLogin(asked.login.userCode, decision).then((outcome) => {
      busy.current = false;
      if (!mounted.current) return;
      setScreen(decidedScreen(asked, decision, outcome));
    });
  }
  return { screen, read, decide };
}
