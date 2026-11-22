import { type ReactElement, useState } from 'react';
import { type CollectionFailure, failureMessage } from '../git-host/types.ts';
import { projectText } from '../projects/label.ts';
import type { MissingFactory } from '../projects/types.ts';
import {
  type WarningMessage,
  WarningBanner,
} from './components/WarningBanner.tsx';
import {
  type DeleteDialogState,
  DeleteProjectDialog,
} from './DeleteProjectDialog.tsx';
import type { DeleteProject } from './factory-api.ts';

export interface FactoryBannerProps {
  missing: MissingFactory[];
  failures?: CollectionFailure[];
  deleteProject: DeleteProject;
  onDeleted: (project: string) => void;
}

interface OpenDialog {
  project: string;
  name: string;
  sessions: number;
  state: DeleteDialogState;
}

function missingMessage(
  project: MissingFactory,
  onDelete: () => void,
): WarningMessage {
  const label = projectText(project.project, project.name);
  return {
    key: `factory ${project.project}`,
    text: (
      <span title={label.title}>
        Factory configuration not found for {label.text}: {project.factoryFile}.
        Its data is kept, but new sessions are no longer read.
      </span>
    ),
    action: { label: 'Delete project', onClick: onDelete },
  };
}

function failureLine(failure: CollectionFailure): WarningMessage {
  const label = projectText(failure.project, failure.name);
  return {
    key: `git-host ${failure.project}`,
    text: (
      <span title={label.title}>
        {failureMessage({ ...failure, name: label.text })}
      </span>
    ),
  };
}

function useDeleteDialog(
  missing: MissingFactory[],
  deleteProject: DeleteProject,
  onDeleted: (project: string) => void,
): {
  shown: OpenDialog | undefined;
  setDialog: (dialog: OpenDialog | undefined) => void;
  confirm: (open: OpenDialog) => Promise<void>;
} {
  const [dialog, setDialog] = useState<OpenDialog>();
  const shown =
    dialog !== undefined &&
    missing.some((project) => project.project === dialog.project)
      ? dialog
      : undefined;
  if (dialog !== undefined && shown === undefined) setDialog(undefined);

  async function confirm(open: OpenDialog): Promise<void> {
    setDialog({ ...open, state: 'deleting' });
    const outcome = await deleteProject(open.project);
    if (outcome === 'deleted') {
      setDialog((current) =>
        current?.project === open.project ? undefined : current,
      );
      onDeleted(open.project);
      return;
    }
    setDialog((current) =>
      current?.project === open.project
        ? { ...current, state: outcome }
        : current,
    );
  }

  return { shown, setDialog, confirm };
}

export function FactoryBanner({
  missing,
  failures = [],
  deleteProject,
  onDeleted,
}: FactoryBannerProps): ReactElement {
  const { shown, setDialog, confirm } = useDeleteDialog(
    missing,
    deleteProject,
    onDeleted,
  );
  const messages = [
    ...missing.map((project) =>
      missingMessage(project, () =>
        setDialog({
          project: project.project,
          name: project.name,
          sessions: project.sessions,
          state: 'idle',
        }),
      ),
    ),
    ...failures.map(failureLine),
  ];
  return (
    <>
      <WarningBanner label="Factory configuration" messages={messages} />
      {shown !== undefined && (
        <DeleteProjectDialog
          project={shown.project}
          name={shown.name}
          sessions={shown.sessions}
          state={shown.state}
          onCancel={() => setDialog(undefined)}
          onConfirm={() => void confirm(shown)}
        />
      )}
    </>
  );
}
