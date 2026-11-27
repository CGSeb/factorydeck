import { type RefObject, useEffect, useRef } from 'react';

const BUTTONS = 'button:not(:disabled)';
const LINKS_AND_BUTTONS = `a[href], ${BUTTONS}`;
export const FORM_STOPS = `input:not(:disabled), select:not(:disabled), ${BUTTONS}`;

function keepFocusInside(
  event: KeyboardEvent,
  dialog: HTMLElement,
  stops: string,
): void {
  const focusable = [...dialog.querySelectorAll<HTMLElement>(stops)];
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

export function useDialogFocus<T extends HTMLElement = HTMLButtonElement>(
  onCancel: () => void,
  dialog: RefObject<HTMLDivElement | null>,
  withLinks = false,
  stops?: string,
): RefObject<T | null> {
  const cancel = useRef<T>(null);
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
      if (event.key === 'Escape' && !event.defaultPrevented) onCancel();
      if (event.key === 'Tab' && dialog.current !== null) {
        keepFocusInside(
          event,
          dialog.current,
          stops ?? (withLinks ? LINKS_AND_BUTTONS : BUTTONS),
        );
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onCancel, dialog, withLinks, stops]);
  return cancel;
}
