import {
  type ReactElement,
  type RefObject,
  useEffect,
  useId,
  useRef,
} from 'react';
import type { WriteClipboard } from './frictions-api.ts';
import { COPY_LABELS, linkText, useCopyState } from './invite-dialog-state.ts';
import { type CreatedInvitation, inviteLink } from './invitations-api.ts';
import './components/controls.css';
import './components/layout.css';
import './setup-page.css';
import './invitations.css';

export const LINK_TITLE = 'Invitation link';
export const DONE = 'Done';

export interface Ids {
  title: string;
  text: string;
}

export function DialogHeading({
  ids,
  title,
  text,
}: {
  ids: Ids;
  title: string;
  text: string;
}): ReactElement {
  return (
    <>
      <h2 id={ids.title} className="fd-dialog-title">
        {title}
      </h2>
      <p id={ids.text} className="fd-dialog-text">
        {text}
      </p>
    </>
  );
}

function LinkField({
  link,
  input,
}: {
  link: string;
  input: RefObject<HTMLInputElement | null>;
}): ReactElement {
  const id = useId();
  return (
    <div className="fd-setup-field fd-invite-link">
      <label htmlFor={`${id}-link`}>Link</label>
      <input
        ref={input}
        id={`${id}-link`}
        type="text"
        readOnly
        value={link}
        onFocus={(event) => {
          event.currentTarget.select();
        }}
      />
    </div>
  );
}

export function InviteLink({
  ids,
  invitation,
  origin,
  copy,
  onClose,
}: {
  ids: Ids;
  invitation: CreatedInvitation;
  origin: string;
  copy: WriteClipboard;
  onClose: () => void;
}): ReactElement {
  const link = inviteLink(origin, invitation.token);
  const input = useRef<HTMLInputElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const [state, setState] = useCopyState();
  useEffect(() => {
    button.current?.focus();
  }, [invitation.token]);
  async function copyLink(): Promise<void> {
    try {
      await copy(link);
      setState('copied');
    } catch {
      setState('failed');
      input.current?.focus();
      input.current?.select();
    }
  }
  return (
    <>
      <DialogHeading ids={ids} title={LINK_TITLE} text={linkText(invitation)} />
      <LinkField link={link} input={input} />
      <span className="fd-visually-hidden" role="status">
        {state === 'idle' ? '' : COPY_LABELS[state]}
      </span>
      <div className="fd-dialog-actions">
        <button
          ref={button}
          type="button"
          className="fd-control fd-dialog-button fd-invite-copy"
          onClick={() => void copyLink()}
        >
          {COPY_LABELS[state]}
        </button>
        <button
          type="button"
          className="fd-control fd-dialog-button"
          data-primary="true"
          onClick={onClose}
        >
          {DONE}
        </button>
      </div>
    </>
  );
}
