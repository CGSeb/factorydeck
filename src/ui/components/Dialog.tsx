import {
  type ReactElement,
  type ReactNode,
  type RefObject,
  useId,
  useRef,
} from 'react';
import { useDialogFocus } from './dialog-focus.ts';
import './controls.css';
import './layout.css';

export interface DialogDanger {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export interface DialogProps {
  title: ReactNode;
  text: ReactNode;
  cancelLabel: string;
  onCancel: () => void;
  danger?: DialogDanger | undefined;
  children?: ReactNode;
}

function DialogActions({
  cancel,
  cancelLabel,
  onCancel,
  danger,
}: {
  cancel: RefObject<HTMLButtonElement | null>;
  cancelLabel: string;
  onCancel: () => void;
  danger: DialogDanger | undefined;
}): ReactElement {
  return (
    <div className="fd-dialog-actions">
      <button
        type="button"
        ref={cancel}
        className="fd-control fd-dialog-button"
        onClick={onCancel}
      >
        {cancelLabel}
      </button>
      {danger !== undefined && (
        <button
          type="button"
          className="fd-control fd-dialog-button"
          data-danger="true"
          disabled={danger.disabled === true}
          onClick={danger.onClick}
        >
          {danger.label}
        </button>
      )}
    </div>
  );
}

export function Dialog({
  title,
  text,
  cancelLabel,
  onCancel,
  danger,
  children,
}: DialogProps): ReactElement {
  const titleId = useId();
  const textId = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const cancel = useDialogFocus(onCancel, dialog);
  return (
    <div
      className="fd-dialog-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        ref={dialog}
        className="fd-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={textId}
      >
        <h2 id={titleId} className="fd-dialog-title">
          {title}
        </h2>
        <p id={textId} className="fd-dialog-text">
          {text}
        </p>
        {children !== undefined && (
          <div className="fd-dialog-body">{children}</div>
        )}
        <DialogActions
          cancel={cancel}
          cancelLabel={cancelLabel}
          onCancel={onCancel}
          danger={danger}
        />
      </div>
    </div>
  );
}
