import { type ReactElement, type ReactNode, useState } from 'react';
import { DataTable } from './components/DataTable.tsx';
import { Panel } from './components/Panel.tsx';
import { ShowMore } from './components/ShowMore.tsx';
import './frictions-page.css';

export const PAGE_ROWS = 10;

export interface PagedTableProps<T> {
  title: string;
  rows: readonly T[];
  head: ReactNode;
  renderRow: (row: T, index: number) => ReactElement;
  className?: string;
  empty?: string;
  paged?: boolean;
}

export function PagedTable<T>({
  title,
  rows,
  head,
  renderRow,
  className,
  empty,
  paged = true,
}: PagedTableProps<T>): ReactElement {
  const [all, setAll] = useState(false);
  const shown = all || !paged ? rows : rows.slice(0, PAGE_ROWS);
  return (
    <Panel>
      <h2 className="fd-panel-heading fd-friction-heading">{title}</h2>
      {rows.length === 0 && empty !== undefined ? (
        <p className="fd-friction-note">{empty}</p>
      ) : (
        <>
          <DataTable label={title}>
            <table className={className} aria-label={title}>
              <thead>
                <tr>{head}</tr>
              </thead>
              <tbody>{shown.map(renderRow)}</tbody>
            </table>
          </DataTable>
          <ShowMore
            shown={shown.length}
            total={rows.length}
            onShowMore={() => {
              setAll(true);
            }}
          />
        </>
      )}
    </Panel>
  );
}
