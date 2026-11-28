import { useEffect, useRef } from 'react';
import { type Blocker, useBlocker } from 'react-router';
import type { RuleFocus } from './role-rules-rows.ts';

export function useLeaveGuard(changed: boolean): Blocker {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      changed && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (!changed) return undefined;
    const ask = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', ask);
    return () => {
      window.removeEventListener('beforeunload', ask);
    };
  }, [changed]);
  return blocker;
}

export function useFocusTarget(
  focus: RuleFocus | undefined,
): (element: HTMLElement | null) => void {
  const body = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (focus === undefined) return;
    const root = body.current;
    const selector = `[data-control="${focus.control}"]`;
    const target =
      focus.control === 'add'
        ? root?.querySelector<HTMLElement>(selector)
        : root
            ?.querySelectorAll('tbody tr')
            [focus.index]?.querySelector<HTMLElement>(selector);
    target?.focus();
  }, [focus]);
  return (element) => {
    body.current = element;
  };
}
