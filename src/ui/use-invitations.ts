import { type RefObject, useRef, useState } from 'react';
import type { TeamInvitation } from '../team/types.ts';
import type { InviteDialogView } from './InviteDialog.tsx';
import type {
  CreatedInvitation,
  InvitationActions,
} from './invitations-api.ts';
import type { RowFeedback } from './PendingInvitations.tsx';

export interface InvitationControls {
  button: RefObject<HTMLButtonElement | null>;
  dialog: InviteDialogView | undefined;
  feedback: Readonly<Record<number, RowFeedback>>;
  open: () => void;
  close: () => void;
  created: (invitation: CreatedInvitation) => void;
  newLink: (invitation: TeamInvitation) => void;
  revoke: (invitation: TeamInvitation) => void;
  visible: (invitations: readonly TeamInvitation[]) => TeamInvitation[];
}

function withRow(
  feedback: Record<number, RowFeedback>,
  id: number,
  row: RowFeedback | undefined,
): Record<number, RowFeedback> {
  const next = { ...feedback };
  if (row === undefined) delete next[id];
  else next[id] = row;
  return next;
}

export function useInvitations(
  actions: InvitationActions | undefined,
  refresh: () => void,
): InvitationControls {
  const button = useRef<HTMLButtonElement | null>(null);
  const [dialog, setDialog] = useState<InviteDialogView>();
  const [feedback, setFeedback] = useState<Record<number, RowFeedback>>({});
  const [removed, setRemoved] = useState<ReadonlySet<number>>(new Set());

  function setRow(id: number, row: RowFeedback | undefined): void {
    setFeedback((previous) => withRow(previous, id, row));
  }

  function gone(id: number): void {
    button.current?.focus();
    setRow(id, undefined);
    setRemoved((previous) => new Set(previous).add(id));
  }

  function created(invitation: CreatedInvitation): void {
    setDialog({ kind: 'link', invitation });
    refresh();
  }

  async function newLink(invitation: TeamInvitation): Promise<void> {
    if (actions === undefined) return;
    setRow(invitation.id, { busy: true });
    const outcome = await actions.newLink(invitation.id);
    if (outcome.status === 'failed') {
      setRow(invitation.id, { error: outcome.message });
      return;
    }
    gone(invitation.id);
    created(outcome.invitation);
  }

  async function revoke(invitation: TeamInvitation): Promise<void> {
    if (actions === undefined) return;
    setRow(invitation.id, { busy: true });
    const outcome = await actions.revoke(invitation.id);
    if (outcome.status === 'failed') {
      setRow(invitation.id, { error: outcome.message });
      return;
    }
    gone(invitation.id);
    refresh();
  }

  return {
    button,
    dialog,
    feedback,
    open: () => {
      setDialog({ kind: 'form' });
    },
    close: () => {
      setDialog(undefined);
    },
    created,
    newLink: (invitation) => void newLink(invitation),
    revoke: (invitation) => void revoke(invitation),
    visible: (invitations) => invitations.filter(({ id }) => !removed.has(id)),
  };
}
