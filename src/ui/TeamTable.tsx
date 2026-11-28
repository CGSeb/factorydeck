import {
  type ReactElement,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import type { TeamAccountRow } from '../team/types.ts';
import { DataTable, NUMERIC_CELL } from './components/DataTable.tsx';
import { Icon } from './components/Icon.tsx';
import { formatAgo, formatDateTime } from './format.ts';
import type { RowMessage } from './team-changes.ts';
import {
  closeOnKey,
  moveFocus,
  useCloseAndFocus,
  useFocusWhenDone,
} from './team-row-focus.ts';

export { menuTarget } from './team-row-focus.ts';
import {
  NEVER,
  busyLabelOf,
  cliCountLabel,
  roleLabel,
  statusLabel,
} from './team-view.ts';
import './team.css';

export interface TeamAction {
  label: string;
  onSelect: (account: TeamAccountRow) => void;
  danger?: boolean;
  forYou?: boolean;
}

export type TeamActionsFor = (account: TeamAccountRow) => readonly TeamAction[];

export interface TeamTableProps {
  accounts: readonly TeamAccountRow[];
  now: Date;
  actionsFor?: TeamActionsFor | undefined;
  busy?: ReadonlySet<number> | undefined;
  message?: RowMessage | undefined;
  below?: ((account: TeamAccountRow) => ReactElement | undefined) | undefined;
}

const NO_ACTIONS: TeamActionsFor = () => [];
const NONE_BUSY: ReadonlySet<number> = new Set();
const COLUMNS = 6;

function LastSignIn({
  at,
  now,
}: {
  at: string | null;
  now: Date;
}): ReactElement {
  if (at === null) return <>{NEVER}</>;
  return (
    <time dateTime={at} title={formatDateTime(at)}>
      {formatAgo(at, now)}
    </time>
  );
}

function useCloseOnOutside(
  open: boolean,
  box: RefObject<HTMLDivElement | null>,
  close: () => void,
): void {
  useEffect(() => {
    if (!open) return undefined;
    function onPointer(event: PointerEvent): void {
      if (
        !(event.target instanceof Node) ||
        !box.current?.contains(event.target)
      ) {
        close();
      }
    }
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open, box, close]);
}

function ActionsMenu({
  id,
  account,
  actions,
  onDone,
}: {
  id: string;
  account: TeamAccountRow;
  actions: readonly TeamAction[];
  onDone: () => void;
}): ReactElement {
  return (
    <ul
      id={id}
      role="menu"
      className="fd-team-actions-menu"
      onKeyDown={moveFocus}
    >
      {actions.map((action) => (
        <li key={action.label} role="none">
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            className="fd-control fd-team-actions-item"
            data-danger={action.danger === true ? 'true' : undefined}
            onClick={() => {
              onDone();
              action.onSelect(account);
            }}
          >
            {action.label}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function TeamRowActions({
  account,
  actions,
  busy = false,
}: {
  account: TeamAccountRow;
  actions: readonly TeamAction[];
  busy?: boolean;
}): ReactElement {
  const id = useId();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useFocusWhenDone(busy, button);
  const close = useCallback(() => {
    setOpen(false);
  }, []);
  const choose = useCloseAndFocus(setOpen, button);
  useCloseOnOutside(open, box, close);
  useEffect(() => {
    if (open)
      box.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [open]);
  return (
    <div
      ref={box}
      className="fd-team-actions"
      onKeyDown={(event) => {
        if (open) closeOnKey(event, setOpen, button);
      }}
    >
      <button
        ref={button}
        type="button"
        className="fd-control fd-team-actions-button"
        aria-label={busyLabelOf(account, busy) ?? `Actions for ${account.name}`}
        title={busyLabelOf(account, busy)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-busy={busy || undefined}
        disabled={busy}
        onClick={() => {
          setOpen((current) => !current);
        }}
      >
        <Icon name="more" size={18} />
      </button>
      {open && (
        <ActionsMenu
          id={id}
          account={account}
          actions={actions}
          onDone={choose}
        />
      )}
    </div>
  );
}

function TeamRow({
  account,
  now,
  actions,
  withActions,
  busy,
  message,
  below,
}: {
  account: TeamAccountRow;
  now: Date;
  actions: readonly TeamAction[];
  withActions: boolean;
  busy: boolean;
  message: string | undefined;
  below: ReactElement | undefined;
}): ReactElement {
  return (
    <>
      <tr data-deactivated={account.active ? undefined : ''}>
        <th scope="row">
          <span className="fd-team-name">{account.name}</span>
          {account.you && <span className="fd-team-you">You</span>}
        </th>
        <td className="fd-team-email">{account.email}</td>
        <td>{roleLabel(account.role)}</td>
        <td>{statusLabel(account.active)}</td>
        <td>
          <LastSignIn at={account.lastSignInAt} now={now} />
        </td>
        <td className={NUMERIC_CELL}>
          {cliCountLabel(account.cliConnections)}
        </td>
        {withActions && (
          <td className="fd-team-actions-cell">
            {actions.length > 0 && (
              <TeamRowActions account={account} actions={actions} busy={busy} />
            )}
          </td>
        )}
      </tr>
      {message !== undefined && (
        <tr className="fd-team-message-row">
          <td colSpan={COLUMNS + (withActions ? 1 : 0)}>
            <div className="fd-team-message">{message}</div>
          </td>
        </tr>
      )}
      {below !== undefined && (
        <tr className="fd-team-message-row fd-team-below-row">
          <td colSpan={COLUMNS + (withActions ? 1 : 0)}>{below}</td>
        </tr>
      )}
    </>
  );
}

export function TeamTable({
  accounts,
  now,
  actionsFor = NO_ACTIONS,
  busy = NONE_BUSY,
  message,
  below,
}: TeamTableProps): ReactElement {
  const rows = accounts.map((account) => ({
    account,
    actions: actionsFor(account).filter(
      ({ forYou }) => !account.you || forYou === true,
    ),
  }));
  const withActions = rows.some(({ actions }) => actions.length > 0);
  return (
    <>
      <DataTable label="Team">
        <table className="fd-team-table" aria-label="Team">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Email</th>
              <th scope="col">Role</th>
              <th scope="col">Status</th>
              <th scope="col">Last sign-in</th>
              <th scope="col" className={NUMERIC_CELL}>
                CLI
              </th>
              {withActions && (
                <th scope="col">
                  <span className="fd-visually-hidden">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ account, actions }) => (
              <TeamRow
                key={account.id}
                account={account}
                now={now}
                actions={actions}
                withActions={withActions}
                busy={busy.has(account.id)}
                message={
                  message?.accountId === account.id ? message.text : undefined
                }
                below={below?.(account)}
              />
            ))}
          </tbody>
        </table>
      </DataTable>
      <span className="fd-visually-hidden" role="status">
        {message?.text ?? ''}
      </span>
    </>
  );
}
