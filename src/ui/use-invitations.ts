import { useState } from 'react';
import type { TeamInvitation } from '../team/types.ts';
import type { InviteDialogView } from './InviteDialog.tsx';
import type {
  CreatedInvitation,
  InvitationActions,
} from './invitations-api.ts';
import type { RowFeedback } from './PendingInvitations.tsx';

export interface InvitationControls {
  dialog: InviteDialogView | undefined;
  feedback: Readonly<Record<number, RowFeedback>>;
  open: () => void;
  close: () => void;
  created: (invitation: CreatedInvitation) => void;
  newLink: (invitation: TeamInvitation) => void;
  revoke: (invitation: TeamInvitation) => void;
  visible: (invitations: readonly TeamInvitation[]) => TeamInvitation[];
}

export function useInvitations(
  actions: InvitationActions | undefined,
  refresh: () => void,
): InvitationControls {
  const [dialog, setDialog] = useState<InviteDialogView>();
  const [feedback, setFeedback] = useState<Record<number, RowFeedback>>({});
  const [removed, setRemoved] = useState<ReadonlySet<number>>(new Set());

  function setRow(id: number, row: RowFeedback | undefined): void {
    setFeedback((previous) => {
      const next = { ...previous };
      if (row === undefined) delete next[id];
      else next[id] = row;
      return next;
    });
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
    setRow(invitation.id, undefined);
    setRemoved((previous) => new Set(previous).add(invitation.id));
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
    setRow(invitation.id, undefined);
    setRemoved((previous) => new Set(previous).add(invitation.id));
    refresh();
  }

  return {
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
