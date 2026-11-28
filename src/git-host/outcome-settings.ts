import type { FactorySettings } from '../factory/settings.ts';
import { bugLabelOf } from './kind.ts';
import type { StageLabels } from './outcome.ts';

export interface ProjectOutcomeSettings {
  labels: StageLabels;
  autoMerge: boolean | null;
  bugLabel: string | null;
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

export function outcomeSettingsOf(
  settings: FactorySettings,
): ProjectOutcomeSettings {
  const labels = stageLabels(settings);
  return {
    labels,
    autoMerge: settings.flag('build.auto_merge') ?? null,
    bugLabel: bugLabelOf(settings.text('bugs.label'), [
      settings.text('issues.labels.spec'),
      ...Object.values(labels),
    ]),
  };
}
