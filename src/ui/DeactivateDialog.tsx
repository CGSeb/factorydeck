import type { ReactElement } from 'react';
import { Dialog } from './components/Dialog.tsx';

export interface DeactivateDialogProps {
  name: string;
  deactivating: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function stayOpen(): void {}

export function DeactivateDialog({
  name,
  deactivating,
  onCancel,
  onConfirm,
}: DeactivateDialogProps): ReactElement {
  return (
    <Dialog
      title={`Deactivate ${name}?`}
      text="They are signed out at once."
      cancelLabel="Cancel"
      onCancel={deactivating ? stayOpen : onCancel}
      danger={{
        label: deactivating ? 'Deactivating…' : 'Deactivate',
        onClick: onConfirm,
        disabled: deactivating,
      }}
    />
  );
}
