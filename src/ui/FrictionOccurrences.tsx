import {
  type ReactElement,
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useId,
  useState,
} from 'react';
import { Link } from 'react-router';
import type {
  FrictionOccurrence,
  OccurrenceTable,
  OccurrencesResponse,
} from '../frictions/occurrence-types.ts';
import { Icon } from './components/Icon.tsx';
import { RoleTag } from './components/RoleTag.tsx';
import { roleColors } from './design/palette.ts';
import { MISSING, formatDateTime } from './format.ts';
import { shortSessionTitle } from './frictions-view.ts';
import { UNREACHABLE_MESSAGE } from './overview-api.ts';
import { type LinkScope, issueHref, sessionHref } from './session-links.ts';
import './frictions-page.css';

export const LATEST_OCCURRENCES = 'Latest occurrences';
export const LOG_GONE = 'The session log is no longer on this computer.';
export const NO_OCCURRENCE = 'No occurrence in this period.';

export interface OccurrenceControls {
  scope: LinkScope;
  isOpen: (table: OccurrenceTable, row: string) => boolean;
  toggle: (table: OccurrenceTable, row: string) => void;
  load: (
    table: OccurrenceTable,
    row: string,
  ) => Promise<OccurrencesResponse | undefined>;
}

const OccurrencesContext = createContext<OccurrenceControls | null>(null);

export const OccurrencesProvider = OccurrencesContext.Provider;

export function occurrenceKey(table: OccurrenceTable, row: string): string {
  return `${table}\n${row}`;
}

export function useOpenRows(
  filtersKey: string,
): Pick<OccurrenceControls, 'isOpen' | 'toggle'> {
  const [open, setOpen] = useState<{ filters: string; keys: string[] }>({
    filters: filtersKey,
    keys: [],
  });
  const keys = open.filters === filtersKey ? open.keys : [];
  return {
    isOpen: (table, row) => keys.includes(occurrenceKey(table, row)),
    toggle: (table, row) => {
      const key = occurrenceKey(table, row);
      setOpen((previous) => {
        const current = previous.filters === filtersKey ? previous.keys : [];
        return {
          filters: filtersKey,
          keys: current.includes(key)
            ? current.filter((item) => item !== key)
            : [...current, key],
        };
      });
    },
  };
}

function Texts({ occurrence }: { occurrence: FrictionOccurrence }): ReactNode {
  const { texts } = occurrence;
  if (texts === null) {
    return <p className="fd-occurrence-gone">{LOG_GONE}</p>;
  }
  if (texts.kind === 'stop-blocked') {
    return <p className="fd-occurrence-text">{texts.message}</p>;
  }
  return (
    <>
      <p className="fd-occurrence-text">{texts.input}</p>
      {texts.error !== '' && (
        <p className="fd-occurrence-text fd-occurrence-error">{texts.error}</p>
      )}
    </>
  );
}

function OccurrenceItem({
  occurrence,
  color,
  scope,
}: {
  occurrence: FrictionOccurrence;
  color: string;
  scope: LinkScope;
}): ReactElement {
  return (
    <li className="fd-occurrence">
      <div className="fd-occurrence-meta">
        <time dateTime={occurrence.at}>{formatDateTime(occurrence.at)}</time>
        <RoleTag role={occurrence.role} color={color} />
        {occurrence.workItem === null ? (
          <span>{MISSING}</span>
        ) : (
          <Link to={issueHref(occurrence.workItem, occurrence.project, scope)}>
            #{occurrence.workItem}
          </Link>
        )}
        <Link
          className="fd-occurrence-session"
          to={sessionHref(occurrence.sessionId, scope)}
        >
          {shortSessionTitle(occurrence.sessionTitle, occurrence.sessionId)}
        </Link>
      </div>
      <Texts occurrence={occurrence} />
    </li>
  );
}

function OccurrenceBody({
  response,
  scope,
}: {
  response: OccurrencesResponse | undefined | null;
  scope: LinkScope;
}): ReactElement {
  if (response === null) {
    return <p className="fd-occurrence-status">Loading…</p>;
  }
  if (response?.status !== 'ok') {
    return <p className="fd-occurrence-status">{UNREACHABLE_MESSAGE}</p>;
  }
  const { occurrences } = response;
  if (occurrences.length === 0) {
    return <p className="fd-occurrence-status">{NO_OCCURRENCE}</p>;
  }
  const colors = roleColors(occurrences.map((item) => item.role));
  return (
    <ol className="fd-occurrence-list">
      {occurrences.map((occurrence, index) => (
        <OccurrenceItem
          key={`${String(index)} ${occurrence.at}`}
          occurrence={occurrence}
          color={colors.get(occurrence.role) ?? 'var(--fd-line)'}
          scope={scope}
        />
      ))}
    </ol>
  );
}

function OccurrencesRow({
  id,
  table,
  row,
  colSpan,
  controls,
}: {
  id: string;
  table: OccurrenceTable;
  row: string;
  colSpan: number;
  controls: OccurrenceControls;
}): ReactElement {
  const [response, setResponse] = useState<
    OccurrencesResponse | undefined | null
  >(null);
  const { load } = controls;
  useEffect(() => {
    let current = true;
    void load(table, row).then((body) => {
      if (current) setResponse(body);
    });
    return () => {
      current = false;
    };
  }, [load, table, row]);
  return (
    <tr className="fd-occurrences" id={id}>
      <td colSpan={colSpan}>
        <h3 className="fd-occurrences-title">{LATEST_OCCURRENCES}</h3>
        <OccurrenceBody response={response} scope={controls.scope} />
      </td>
    </tr>
  );
}

export interface OccurrenceRowsProps {
  table: OccurrenceTable;
  row: string;
  label: string;
  colSpan: number;
  headerClassName?: string;
  header: ReactNode;
  cells: ReactNode;
}

export function OccurrenceRows({
  table,
  row,
  label,
  colSpan,
  headerClassName,
  header,
  cells,
}: OccurrenceRowsProps): ReactElement {
  const controls = useContext(OccurrencesContext);
  const id = useId();
  const open = controls?.isOpen(table, row) ?? false;
  return (
    <>
      <tr className={open ? 'fd-occurrence-open' : undefined}>
        <th scope="row" className={headerClassName}>
          {controls === null ? (
            header
          ) : (
            <button
              type="button"
              className="fd-occurrence-toggle"
              aria-expanded={open}
              aria-controls={open ? id : undefined}
              aria-label={`Show occurrences of ${label}`}
              onClick={() => {
                controls.toggle(table, row);
              }}
            >
              <Icon
                name="chevron"
                size={14}
                className="fd-occurrence-chevron"
              />
              <span className="fd-occurrence-label">{header}</span>
            </button>
          )}
        </th>
        {cells}
      </tr>
      {open && controls !== null && (
        <OccurrencesRow
          id={id}
          table={table}
          row={row}
          colSpan={colSpan}
          controls={controls}
        />
      )}
    </>
  );
}
