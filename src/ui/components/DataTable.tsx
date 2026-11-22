import type { ReactElement, ReactNode } from 'react';
import { Icon } from './Icon.tsx';
import { StageDot, type StageGroup } from './StageDot.tsx';
import './layout.css';

export const NUMERIC_CELL = 'fd-num';

export interface DataTableProps {
  label: string;
  children: ReactNode;
}

export function DataTable({ label, children }: DataTableProps): ReactElement {
  return (
    <div
      className="fd-table-scroll"
      role="region"
      aria-label={label}
      tabIndex={0}
    >
      {children}
    </div>
  );
}

export type GroupMarker = { stage: StageGroup } | { color: string };

export interface GroupHeaderRowProps {
  name: string;
  count: number;
  colSpan: number;
  marker: GroupMarker;
  /** With `onToggle`, the header becomes a button that folds the group's rows. */
  expanded?: boolean;
  onToggle?: () => void;
}

function Marker({ marker }: { marker: GroupMarker }): ReactElement {
  return 'stage' in marker ? (
    <StageDot group={marker.stage} />
  ) : (
    <span
      className="fd-table-dot"
      aria-hidden="true"
      style={{ background: marker.color }}
    />
  );
}

export function GroupHeaderRow({
  name,
  count,
  colSpan,
  marker,
  expanded = true,
  onToggle,
}: GroupHeaderRowProps): ReactElement {
  const label = (
    <span className="fd-table-group-label">
      <Marker marker={marker} />
      {name}
      <span className="fd-table-group-count">{count}</span>
    </span>
  );
  return (
    <tr className="fd-table-group">
      <th scope="colgroup" colSpan={colSpan}>
        {onToggle === undefined ? (
          label
        ) : (
          <button
            type="button"
            className="fd-table-group-toggle"
            aria-expanded={expanded}
            onClick={onToggle}
          >
            <Icon name="chevron" size={14} className="fd-table-group-chevron" />
            {label}
          </button>
        )}
      </th>
    </tr>
  );
}

export function TotalRow({ children }: { children: ReactNode }): ReactElement {
  return <tr className="fd-table-total">{children}</tr>;
}
