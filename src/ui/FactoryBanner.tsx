import type { ReactElement } from 'react';
import { type CollectionFailure, failureMessage } from '../git-host/types.ts';
import { projectText } from '../projects/label.ts';
import type { MissingFactory } from '../projects/types.ts';
import {
  type WarningMessage,
  WarningBanner,
} from './components/WarningBanner.tsx';

export interface FactoryBannerProps {
  missing: MissingFactory[];
  failures?: CollectionFailure[];
}

function missingMessage(project: MissingFactory): WarningMessage {
  const label = projectText(project.project, project.name);
  return {
    key: `factory ${project.project}`,
    text: (
      <span title={label.title}>
        Factory configuration not found for {label.text}: {project.factoryFile}.
        Its data is kept, but new sessions are no longer read.
      </span>
    ),
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

export function FactoryBanner({
  missing,
  failures = [],
}: FactoryBannerProps): ReactElement {
  return (
    <WarningBanner
      label="Factory configuration"
      messages={[...missing.map(missingMessage), ...failures.map(failureLine)]}
    />
  );
}
