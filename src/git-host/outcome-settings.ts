import {
  type FactorySettings,
  FactorySettingsError,
  readFactorySettings,
} from '../factory/settings.ts';
import { GitHostConfigError } from './config.ts';
import type { StageLabels } from './outcome.ts';
import type { GitHostName } from './types.ts';

export interface ProjectOutcomeSettings {
  labels: StageLabels;
  autoMerge: boolean | null;
}

function stageLabels(settings: FactorySettings): StageLabels {
  const label = (key: string): string =>
    settings.requireText(`issues.labels.${key}`);
  return {
    ready: label('ready'),
    working: label('working'),
    needs_spec: label('needs_spec'),
    review: label('review'),
    blocked: label('blocked'),
  };
}

export async function readOutcomeSettings(
  root: string,
  gitHost: GitHostName,
): Promise<ProjectOutcomeSettings> {
  try {
    const settings = await readFactorySettings(root);
    return {
      labels: stageLabels(settings),
      autoMerge: settings.flag('build.auto_merge') ?? null,
    };
  } catch (error) {
    if (error instanceof FactorySettingsError) {
      throw new GitHostConfigError(error.message, gitHost);
    }
    throw error;
  }
}
