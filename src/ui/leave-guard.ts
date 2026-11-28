import { useEffect } from 'react';
import { type Blocker, useBlocker } from 'react-router';

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

export function useReportChanged(
  changed: boolean,
  onChanged: ((changed: boolean) => void) | undefined,
): void {
  useEffect(() => {
    onChanged?.(changed);
  }, [onChanged, changed]);
  useEffect(() => () => onChanged?.(false), [onChanged]);
}
