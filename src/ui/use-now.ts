import { useEffect, useState } from 'react';

export const NOW_TICK_MS = 30_000;

export function useNow(fixed?: Date): Date {
  const [now, setNow] = useState(() => fixed ?? new Date());
  useEffect(() => {
    if (fixed !== undefined) return undefined;
    const timer = setInterval(() => {
      setNow(new Date());
    }, NOW_TICK_MS);
    return () => {
      clearInterval(timer);
    };
  }, [fixed]);
  return fixed ?? now;
}
