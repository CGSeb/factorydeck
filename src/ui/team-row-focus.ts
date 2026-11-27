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
