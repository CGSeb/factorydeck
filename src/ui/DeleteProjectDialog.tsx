import type { ReactElement } from 'react';
import { projectText } from '../projects/label.ts';
import { Dialog } from './components/Dialog.tsx';
import './shell.css';

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

export function DeleteProjectDialog({
  project,
  name,
  sessions,
  state,
  onCancel,
  onConfirm,
}: DeleteProjectDialogProps): ReactElement {
  const label = projectText(project, name);
  const message = MESSAGES[state]?.(label.text);
  const deleting = state === 'deleting';
  return (
    <Dialog
      title={`Delete ${label.text}?`}
      titleTooltip={label.title}
      text={`This removes its ${sessions} sessions and everything FactoryDeck stored about them (sub-agents, API calls, skill launches, prompts). The session logs on disk are not touched. If the factory is installed again in this project, its sessions are read again.`}
      cancelLabel="Cancel"
      onCancel={onCancel}
      danger={{
        label: deleting ? 'Deleting…' : 'Delete project',
        onClick: onConfirm,
        disabled: deleting,
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
