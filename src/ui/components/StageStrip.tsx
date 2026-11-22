import type { ReactElement } from 'react';
import { type StageGroup, StageDot } from './StageDot.tsx';
import { TokenAmount } from './TokenAmount.tsx';
import type { TokenCounts } from './token-amount.ts';
import './controls.css';

export const STAGE_GROUP_LABELS: Record<StageGroup, string> = {
  ready: 'Ready',
  working: 'Working',
  'in-review': 'In review',
  merged: 'Merged',
};

export interface StageStripItem {
  group: StageGroup;
  count: number;
  counts: TokenCounts;
  costUsd: number | null;
  unknownPriceCalls?: number;
}

export interface StageStripProps {
  stages: StageStripItem[];
  value: StageGroup | null;
  onChange: (group: StageGroup | null) => void;
}

export function StageStrip({
  stages,
  value,
  onChange,
}: StageStripProps): ReactElement {
  return (
    <div className="fd-stage-strip">
      <div className="fd-stage-grid" role="group" aria-label="Stages">
        {stages.map((stage) => {
          const selected = stage.group === value;
          return (
            <div
              key={stage.group}
              className="fd-stage-cell"
              data-group={stage.group}
              data-selected={selected}
            >
              <button
                type="button"
                className="fd-control fd-stage-button"
                aria-pressed={selected}
                onClick={() => onChange(selected ? null : stage.group)}
              >
                <span className="fd-stage-name">
                  <StageDot group={stage.group} />
                  {STAGE_GROUP_LABELS[stage.group]}
                </span>
                <span className="fd-stage-count">{stage.count}</span>
              </button>
              <span className="fd-stage-tokens">
                <TokenAmount
                  counts={stage.counts}
                  costUsd={stage.costUsd}
                  unknownPriceCalls={stage.unknownPriceCalls ?? 0}
                  placement="below"
                />{' '}
                tokens
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
