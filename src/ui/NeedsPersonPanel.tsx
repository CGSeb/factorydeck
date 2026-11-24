import { type ReactElement, useState } from 'react';
import type { WaitingResponse } from '../stats/types.ts';
import { DataTable, NUMERIC_CELL } from './components/DataTable.tsx';
import { type RenderLink, renderAnchor } from './components/link.ts';
import { Panel } from './components/Panel.tsx';
import { ProjectTag } from './components/ProjectTag.tsx';
import { ShowMore } from './components/ShowMore.tsx';
import { StatusLine } from './components/StatusLine.tsx';
import {
  NEEDS_PERSON_ROWS,
  type NeedsPersonRow,
  needsPersonRows,
} from './needs-person.ts';
import { UNREACHABLE_MESSAGE } from './overview-api.ts';
import type { SkillFilters } from './skills-api.ts';
import './overview-page.css';

export interface NeedsPersonPanelProps {
  response: WaitingResponse | undefined;
  filters: SkillFilters;
  now: Date;
  renderLink?: RenderLink;
}

const HEADING = 'Needs a person';

function Row({
  row,
  showProject,
  renderLink,
}: {
  row: NeedsPersonRow;
  showProject: boolean;
  renderLink: RenderLink;
}): ReactElement {
  return (
    <tr>
      <td>
        {renderLink({
          href: row.href,
          className: 'fd-needs-person-link',
          children: row.label,
        })}
      </td>
      {showProject && (
        <td>
          <ProjectTag
            project={row.project}
            name={row.projectName}
            color={row.projectColor}
          />
        </td>
      )}
      <td>
        <ul className="fd-needs-person-reasons">
          {row.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </td>
      <td className={NUMERIC_CELL}>
        {row.since === null ? (
          row.wait
        ) : (
          <time dateTime={row.since}>{row.wait}</time>
        )}
      </td>
    </tr>
  );
}

function Rows({
  rows,
  showProject,
  renderLink,
}: {
  rows: NeedsPersonRow[];
  showProject: boolean;
  renderLink: RenderLink;
}): ReactElement {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, NEEDS_PERSON_ROWS);
  return (
    <div className="fd-needs-person">
      <DataTable label="Issues waiting for a person">
        <table className="fd-needs-person-table">
          <thead>
            <tr>
              <th scope="col">Issue</th>
              {showProject && <th scope="col">Project</th>}
              <th scope="col">Reason</th>
              <th scope="col" className={NUMERIC_CELL}>
                Waiting
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <Row
                key={`${row.project} ${String(row.number)}`}
                row={row}
                showProject={showProject}
                renderLink={renderLink}
              />
            ))}
          </tbody>
        </table>
      </DataTable>
      <ShowMore
        shown={shown.length}
        total={rows.length}
        onShowMore={() => {
          setAll(true);
        }}
      />
    </div>
  );
}

export function NeedsPersonPanel({
  response,
  filters,
  now,
  renderLink = renderAnchor,
}: NeedsPersonPanelProps): ReactElement | null {
  if (response?.status === 'ok' && response.waiting.issues.length === 0) {
    return null;
  }
  return (
    <Panel heading={HEADING}>
      {response === undefined ? (
        <StatusLine>Loading…</StatusLine>
      ) : response.status === 'unreachable' ? (
        <StatusLine>{UNREACHABLE_MESSAGE}</StatusLine>
      ) : (
        <Rows
          rows={needsPersonRows(response.waiting, filters, now)}
          showProject={filters.project === undefined}
          renderLink={renderLink}
        />
      )}
    </Panel>
  );
}
