import { type ReactElement, useId, useState } from 'react';
import { type CollectionFailure, failureMessage } from '../git-host/types.ts';
import type { MissingFactory } from '../projects/types.ts';
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

function BannerLine({
  project,
  onDelete,
}: {
  project: MissingFactory;
  onDelete: () => void;
}): ReactElement {
  const textId = useId();
  return (
    <li>
      <span id={textId}>
        Factory configuration not found for {project.name}:{' '}
        {project.factoryFile}. Its data is kept, but new sessions are no longer
        read.
      </span>
      <button type="button" aria-describedby={textId} onClick={onDelete}>
        Delete project
      </button>
    </li>
  );
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
  return (
    <section className="factory-banner" aria-label="Factory configuration">
      <ul>
        {missing.map((project) => (
          <BannerLine
            key={project.project}
            project={project}
            onDelete={() =>
              setDialog({
                project: project.project,
                name: project.name,
                sessions: project.sessions,
                state: 'idle',
              })
            }
          />
        ))}
        {failures.map((failure) => (
          <li key={`git-host ${failure.project}`}>
            <span>{failureMessage(failure)}</span>
          </li>
        ))}
      </ul>
      {shown !== undefined && (
        <DeleteProjectDialog
          name={shown.name}
          sessions={shown.sessions}
          state={shown.state}
          onCancel={() => setDialog(undefined)}
          onConfirm={() => void confirm(shown)}
        />
      )}
    </section>
  );
}
