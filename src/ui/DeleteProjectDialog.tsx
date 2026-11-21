import {
  type ReactElement,
  type RefObject,
  useEffect,
  useId,
  useRef,
} from 'react';

export type DeleteDialogState =
  'idle' | 'deleting' | 'failed' | 'has-factory' | 'not-found';

export interface DeleteProjectDialogProps {
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

function useDialogFocus(
  onCancel: () => void,
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
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);
  return cancel;
}

export function DeleteProjectDialog({
  name,
  sessions,
  state,
  onCancel,
  onConfirm,
}: DeleteProjectDialogProps): ReactElement {
  const titleId = useId();
  const textId = useId();
  const cancel = useDialogFocus(onCancel);
  const message = MESSAGES[state]?.(name);
  const deleting = state === 'deleting';

  return (
    <div
      className="dialog-backdrop"
      data-testid="dialog-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={textId}
      >
        <h2 id={titleId}>Delete {name}?</h2>
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
      </div>
    </div>
  );
}
