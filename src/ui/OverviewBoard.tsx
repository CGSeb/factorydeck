import type { ReactElement } from 'react';
import type { FeatureList } from '../features/types.ts';
import type { IssueKind } from '../git-host/kind.ts';
import { StageColumn } from './components/StageColumn.tsx';
import { StatusLine } from './components/StatusLine.tsx';
import { noKindText, shownKind } from './kind-filter.ts';
import { KindFilter } from './KindFilter.tsx';
import { renderRouterLink } from './Layout.tsx';
import { UNREACHABLE_MESSAGE } from './overview-api.ts';
import { boardColumns, isBoardEmpty } from './overview-board.ts';
import type { SkillFilters } from './skills-api.ts';
import type { Block } from './TokensDialog.tsx';
import './overview-page.css';

export interface OverviewBoardProps {
  features: Block<FeatureList>;
  filters: SkillFilters;
  kind: IssueKind | null;
  onKindChange: (kind: IssueKind | null) => void;
  now: Date;
}

function BoardColumns({
  features,
  filters,
  kind,
  now,
}: {
  features: FeatureList;
  filters: SkillFilters;
  kind: IssueKind | null;
  now: Date;
}): ReactElement {
  const columns = boardColumns(features, filters, now, kind);
  if (kind !== null && isBoardEmpty(columns)) {
    return <StatusLine>{noKindText(kind)}</StatusLine>;
  }
  return (
    <div className="fd-overview-board">
      {columns.map((column) => (
        <StageColumn
          key={column.group}
          {...column}
          renderLink={renderRouterLink}
        />
      ))}
    </div>
  );
}

export function OverviewBoard({
  features,
  filters,
  kind,
  onKindChange,
  now,
}: OverviewBoardProps): ReactElement {
  if (typeof features === 'string') {
    return (
      <section aria-label="Board" className="fd-overview-board-area">
        <StatusLine>
          {features === 'loading' ? 'Loading…' : UNREACHABLE_MESSAGE}
        </StatusLine>
      </section>
    );
  }
  const shown = shownKind(features, kind);
  return (
    <section aria-label="Board" className="fd-overview-board-area">
      {features.bugTickets && (
        <KindFilter
          kinds={features.kinds}
          value={shown}
          onChange={onKindChange}
        />
      )}
      <BoardColumns
        features={features}
        filters={filters}
        kind={shown}
        now={now}
      />
    </section>
  );
}
