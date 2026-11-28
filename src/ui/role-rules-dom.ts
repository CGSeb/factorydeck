import { useEffect, useRef } from 'react';
import type { RuleFocus } from './role-rules-rows.ts';

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
