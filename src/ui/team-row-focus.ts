import {
  type KeyboardEvent,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
} from 'react';

export function closeOnKey(
  event: KeyboardEvent<HTMLDivElement>,
  setOpen: (open: boolean) => void,
  button: RefObject<HTMLButtonElement | null>,
): void {
  if (event.key === 'Tab') {
    setOpen(false);
    return;
  }
  if (event.key !== 'Escape') return;
  event.stopPropagation();
  setOpen(false);
  button.current?.focus();
}

export function useFocusWhenDone(
  busy: boolean,
  button: RefObject<HTMLButtonElement | null>,
): void {
  const wasBusy = useRef(busy);
  useEffect(() => {
    if (wasBusy.current && !busy) button.current?.focus();
    wasBusy.current = busy;
  }, [busy, button]);
}

export function useCloseAndFocus(
  setOpen: (open: boolean) => void,
  button: RefObject<HTMLButtonElement | null>,
): () => void {
  return useCallback(() => {
    setOpen(false);
    button.current?.focus();
  }, [setOpen, button]);
}

export function menuTarget(
  key: string,
  index: number,
  count: number,
): number | undefined {
  switch (key) {
    case 'ArrowDown':
      return (index + 1) % count;
    case 'ArrowUp':
      return (index - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return undefined;
  }
}

export function moveFocus(event: KeyboardEvent<HTMLUListElement>): void {
  const items = [
    ...event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'),
  ];
  const index = items.findIndex((item) => item === document.activeElement);
  const target = menuTarget(event.key, index, items.length);
  if (target === undefined) return;
  event.preventDefault();
  items[target]?.focus();
}
