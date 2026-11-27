import {
  type KeyboardEvent,
  type ReactElement,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import type { TeamAccountRow } from '../team/types.ts';
import { DataTable } from './components/DataTable.tsx';
import { Icon } from './components/Icon.tsx';
import { formatAgo, formatDateTime } from './format.ts';
import { NEVER, roleLabel, statusLabel } from './team-view.ts';
import './team.css';

export interface TeamAction {
  label: string;
  onSelect: (account: TeamAccountRow) => void;
}

export type TeamActionsFor = (account: TeamAccountRow) => readonly TeamAction[];

export interface TeamTableProps {
  accounts: readonly TeamAccountRow[];
  now: Date;
  actionsFor?: TeamActionsFor | undefined;
}

const NO_ACTIONS: TeamActionsFor = () => [];

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
    <ul id={id} role="menu" className="fd-team-actions-menu">
      {actions.map((action) => (
        <li key={action.label} role="none">
          <button
            type="button"
            role="menuitem"
            className="fd-control fd-team-actions-item"
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
}: {
  account: TeamAccountRow;
  actions: readonly TeamAction[];
}): ReactElement {
  const id = useId();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => {
    setOpen(false);
  }, []);
  useCloseOnOutside(open, box, close);
  useEffect(() => {
    if (open)
      box.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [open]);
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key !== 'Escape' || !open) return;
    event.stopPropagation();
    setOpen(false);
    button.current?.focus();
  }
  return (
    <div ref={box} className="fd-team-actions" onKeyDown={onKeyDown}>
      <button
        ref={button}
        type="button"
        className="fd-control fd-team-actions-button"
        aria-label={`Actions for ${account.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
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
          onDone={close}
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
}: {
  account: TeamAccountRow;
  now: Date;
  actions: readonly TeamAction[];
  withActions: boolean;
}): ReactElement {
  return (
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
      {withActions && (
        <td className="fd-team-actions-cell">
          {actions.length > 0 && (
            <TeamRowActions account={account} actions={actions} />
          )}
        </td>
      )}
    </tr>
  );
}

export function TeamTable({
  accounts,
  now,
  actionsFor = NO_ACTIONS,
}: TeamTableProps): ReactElement {
  const rows = accounts.map((account) => ({
    account,
    actions: account.you ? [] : actionsFor(account),
  }));
  const withActions = rows.some(({ actions }) => actions.length > 0);
  return (
    <DataTable label="Team">
      <table className="fd-team-table" aria-label="Team">
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Email</th>
            <th scope="col">Role</th>
            <th scope="col">Status</th>
            <th scope="col">Last sign-in</th>
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
            />
          ))}
        </tbody>
      </table>
    </DataTable>
  );
}
