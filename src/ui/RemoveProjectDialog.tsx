import type { ReactElement } from 'react';
import { Dialog } from './components/Dialog.tsx';
import { formatCount } from './format.ts';

export type RemoveDialogState = 'idle' | 'removing' | 'failed' | 'not-found';

export interface RemoveProjectDialogProps {
  name: string;
  sessions: number | undefined;
  state: RemoveDialogState;
  onCancel: () => void;
  onConfirm: () => void;
}

export const REAPPEARS =
  'A developer who works in this repository again makes it reappear under Remotes not added yet.';

export function removeText(sessions: number | undefined): string {
  if (sessions === 0) return `It has no sessions. ${REAPPEARS}`;
  const count =
    sessions === undefined
      ? 'sessions'
      : `${formatCount(sessions)} session${sessions === 1 ? '' : 's'}`;
  return `Its ${count} and every figure from them are deleted. ${REAPPEARS}`;
}

const MESSAGES: Readonly<
  Partial<Record<RemoveDialogState, (name: string) => string>>
> = {
  failed: (name) => `Could not remove ${name}. Try again.`,
  'not-found': (name) => `${name} is no longer in FactoryDeck.`,
};

export function RemoveProjectDialog({
  name,
  sessions,
  state,
  onCancel,
  onConfirm,
}: RemoveProjectDialogProps): ReactElement {
  const message = MESSAGES[state]?.(name);
  const removing = state === 'removing';
  return (
    <Dialog
      title={`Remove ${name}?`}
      text={removeText(sessions)}
      cancelLabel="Cancel"
      onCancel={onCancel}
      danger={{
        label: removing ? 'Removing…' : 'Remove',
        onClick: onConfirm,
        disabled: removing,
      }}
    >
      {message === undefined ? undefined : (
        <p className="fd-dialog-message" role="alert">
          {message}
        </p>
      )}
    </Dialog>
  );
}
