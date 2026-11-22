import { type RefObject, useEffect, useRef } from 'react';

function keepFocusInside(event: KeyboardEvent, dialog: HTMLElement): void {
  const focusable = [
    ...dialog.querySelectorAll<HTMLElement>('button:not(:disabled)'),
  ];
  const first = focusable.at(0);
  const last = focusable.at(-1);
  if (first === undefined || last === undefined) {
    event.preventDefault();
    return;
  }
  const active = document.activeElement;
  const inside = active instanceof Node && dialog.contains(active);
  if (event.shiftKey && (!inside || active === first)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (!inside || active === last)) {
    event.preventDefault();
    first.focus();
  }
}

export function useDialogFocus(
  onCancel: () => void,
  dialog: RefObject<HTMLDivElement | null>,
): RefObject<HTMLButtonElement | null> {
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : undefined;
    cancel.current?.focus();
    return () => {
      if (opener?.isConnected === true) opener.focus();
    };
  }, []);
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') onCancel();
      if (event.key === 'Tab' && dialog.current !== null) {
        keepFocusInside(event, dialog.current);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onCancel, dialog]);
  return cancel;
}
