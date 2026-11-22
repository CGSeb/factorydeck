import {
  type ReactElement,
  type RefObject,
  useEffect,
  useId,
  useRef,
} from 'react';
import { projectText } from '../projects/label.ts';

export type DeleteDialogState =
  'idle' | 'deleting' | 'failed' | 'has-factory' | 'not-found';

export interface DeleteProjectDialogProps {
  project: string;
  name: string;
  sessions: number;
  state: DeleteDialogState;
  onCancel: () => void;
  onConfirm: () => void;
}

const MESSAGES: Readonly<
  Partial<Record<DeleteDialogState, (name: string) => string>>
> = {
  failed: (name) => `Could not delete ${name}. Try again.`,
  'has-factory': (name) =>
    `${name} has its factory configuration again, so it was not deleted.`,
  'not-found': (name) => `${name} is no longer in FactoryDeck.`,
};

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

function useDialogFocus(
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

function DialogActions({
  cancel,
  deleting,
  onCancel,
  onConfirm,
}: {
  cancel: RefObject<HTMLButtonElement | null>;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}): ReactElement {
  return (
    <div className="dialog-actions">
      <button type="button" ref={cancel} onClick={onCancel}>
        Cancel
      </button>
      <button
        type="button"
        className="danger"
        disabled={deleting}
        onClick={onConfirm}
      >
        {deleting ? 'Deleting…' : 'Delete project'}
      </button>
    </div>
  );
}

export function DeleteProjectDialog({
  project,
  name,
  sessions,
  state,
  onCancel,
  onConfirm,
}: DeleteProjectDialogProps): ReactElement {
  const titleId = useId();
  const textId = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const cancel = useDialogFocus(onCancel, dialog);
  const label = projectText(project, name);
  const message = MESSAGES[state]?.(label.text);
  return (
    <div
      className="dialog-backdrop"
      data-testid="dialog-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        ref={dialog}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={textId}
      >
        <h2 id={titleId} title={label.title}>
          Delete {label.text}?
        </h2>
        <p id={textId}>
          This removes its {sessions} sessions and everything FactoryDeck stored
          about them (sub-agents, API calls, skill launches, prompts). The
          session logs on disk are not touched. If the factory is installed
          again in this project, its sessions are read again.
        </p>
        {message !== undefined && (
          <p className="dialog-message" role="alert">
            {message}
          </p>
        )}
        <DialogActions
          cancel={cancel}
          deleting={state === 'deleting'}
          onCancel={onCancel}
          onConfirm={onConfirm}
        />
      </div>
    </div>
  );
}
