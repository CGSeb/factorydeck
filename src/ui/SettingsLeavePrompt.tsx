import type { ReactElement } from 'react';
import { Dialog } from './components/Dialog.tsx';
import { LEAVE_TOKEN } from './git-host-view.ts';
import { useLeaveGuard } from './leave-guard.ts';

export type UnsavedSection = 'gitHost';

export type Unsaved = Partial<Record<UnsavedSection, boolean>>;

interface LeaveWording {
  section: UnsavedSection;
  question: string;
  text: string;
}

const WORDINGS: readonly LeaveWording[] = [
  {
    section: 'gitHost',
    question: LEAVE_TOKEN,
    text: 'The token you typed and the host you chose are not saved.',
  },
];

export function leaveWording(unsaved: Unsaved): LeaveWording | undefined {
  return WORDINGS.find(({ section }) => unsaved[section] === true);
}

export function SettingsLeavePrompt({
  unsaved,
}: {
  unsaved: Unsaved;
}): ReactElement | null {
  const wording = leaveWording(unsaved);
  const blocker = useLeaveGuard(wording !== undefined);
  if (blocker.state !== 'blocked' || wording === undefined) return null;
  return (
    <Dialog
      title={wording.question}
      text={wording.text}
      cancelLabel="Stay"
      onCancel={() => {
        blocker.reset();
      }}
      danger={{
        label: 'Leave',
        onClick: () => {
          blocker.proceed();
        },
      }}
    />
  );
}
