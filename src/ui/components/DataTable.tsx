import type { ReactElement, ReactNode } from 'react';
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
}: GroupHeaderRowProps): ReactElement {
  return (
    <tr className="fd-table-group">
      <th scope="colgroup" colSpan={colSpan}>
        <span className="fd-table-group-label">
          <Marker marker={marker} />
          {name}
          <span className="fd-table-group-count">{count}</span>
        </span>
      </th>
    </tr>
  );
}

export function TotalRow({ children }: { children: ReactNode }): ReactElement {
  return <tr className="fd-table-total">{children}</tr>;
}
