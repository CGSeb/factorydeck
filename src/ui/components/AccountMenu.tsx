import {
  type CSSProperties,
  type FocusEvent,
  type ReactElement,
  type RefObject,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import type { Account } from '../../auth/types.ts';
import type { SignOut } from '../auth-api.ts';
import { ROLE_LABELS, accountName, accountTip, initialsOf } from './account.ts';
import { Icon } from './Icon.tsx';
import { useDismiss, useMenuPlace } from './account-menu-state.ts';
import type { TipHandlers } from './sidebar-state.ts';
import './account-menu.css';

export type AccountView =
  | { status: 'loading' }
  | { status: 'unavailable' }
  | { status: 'account'; account: Account };

export interface SidebarAccount {
  view: AccountView;
  signOut: SignOut;
  onSignedOut: () => void;
}

export const SIGN_OUT = 'Sign out';
export const SIGNING_OUT = 'Signing out…';

function ButtonContent({
  account,
  folded,
}: {
  account: Account | undefined;
  folded: boolean;
}): ReactElement {
  if (folded) {
    return account === undefined ? (
      <span className="fd-account-initials" data-placeholder aria-hidden />
    ) : (
      <span className="fd-account-initials" aria-hidden>
        {initialsOf(account.name)}
      </span>
    );
  }
  return account === undefined ? (
    <span className="fd-account-text" data-placeholder aria-hidden>
      <span className="fd-account-bar fd-account-bar-name" />
      <span className="fd-account-bar fd-account-bar-role" />
    </span>
  ) : (
    <span className="fd-account-text" aria-hidden>
      <span className="fd-account-name" title={account.name}>
        {account.name}
      </span>
      <span className="fd-account-role">{ROLE_LABELS[account.role]}</span>
    </span>
  );
}

function useSignOut(
  slot: SidebarAccount,
  signOutButton: RefObject<HTMLButtonElement | null>,
): {
  busy: boolean;
  error: string | undefined;
  clearError: () => void;
  run: () => void;
} {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => {
    if (error !== undefined) signOutButton.current?.focus();
  }, [error, signOutButton]);
  async function run(): Promise<void> {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    const outcome = await slot.signOut();
    if (outcome.status === 'signed-out') {
      slot.onSignedOut();
      return;
    }
    setBusy(false);
    setError(outcome.message);
  }
  return {
    busy,
    error,
    clearError: () => {
      setError(undefined);
    },
    run: () => void run(),
  };
}

function useAccountMenu(slot: SidebarAccount): {
  root: RefObject<HTMLDivElement | null>;
  button: RefObject<HTMLButtonElement | null>;
  signOutButton: RefObject<HTMLButtonElement | null>;
  open: boolean;
  openMenu: () => void;
  close: () => boolean;
  onBlur: (event: FocusEvent<HTMLDivElement>) => void;
  signOut: ReturnType<typeof useSignOut>;
} {
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const signOutButton = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const signOut = useSignOut(slot, signOutButton);
  function close(): boolean {
    if (signOut.busy) return false;
    setOpen(false);
    signOut.clearError();
    return true;
  }
  useDismiss(
    open,
    root,
    () => {
      if (close()) button.current?.focus();
    },
    close,
  );
  useEffect(() => {
    if (open) signOutButton.current?.focus();
  }, [open]);
  return {
    root,
    button,
    signOutButton,
    open,
    openMenu: () => {
      setOpen(true);
    },
    close,
    onBlur: (event) => {
      const next = event.relatedTarget;
      if (next instanceof Node && event.currentTarget.contains(next)) return;
      close();
    },
    signOut,
  };
}

function MenuPanel({
  id,
  email,
  folded,
  place,
  signOutButton,
  signOut: { busy, error, run },
}: {
  id: string;
  email: string;
  folded: boolean;
  place: CSSProperties | undefined;
  signOutButton: RefObject<HTMLButtonElement | null>;
  signOut: ReturnType<typeof useSignOut>;
}): ReactElement {
  const errorId = `${id}-error`;
  return (
    <div
      id={id}
      className="fd-account-menu"
      data-folded={folded}
      tabIndex={-1}
      style={place}
    >
      <p className="fd-account-email">{email}</p>
      <hr className="fd-account-separator" />
      <button
        ref={signOutButton}
        type="button"
        className="fd-account-sign-out"
        disabled={busy}
        aria-busy={busy}
        aria-describedby={error === undefined ? undefined : errorId}
        onClick={run}
      >
        <Icon name="sign-out" size={16} />
        {busy ? SIGNING_OUT : SIGN_OUT}
      </button>
      {error !== undefined && (
        <p id={errorId} className="fd-account-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function AccountMenu({
  account: slot,
  folded,
  tip,
}: {
  account: SidebarAccount;
  folded: boolean;
  tip: (text: string) => TipHandlers | undefined;
}): ReactElement {
  const id = useId();
  const menu = useAccountMenu(slot);
  const { open, button } = menu;
  const place = useMenuPlace(open, folded, button);
  const account =
    slot.view.status === 'account' ? slot.view.account : undefined;
  const tipHandlers =
    folded && account !== undefined ? tip(accountTip(account)) : undefined;
  return (
    <div
      ref={menu.root}
      className="fd-account"
      data-folded={folded}
      onBlur={open ? menu.onBlur : undefined}
    >
      <button
        ref={button}
        type="button"
        className="fd-control fd-account-button"
        aria-label={account === undefined ? 'Account' : accountName(account)}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        disabled={account === undefined}
        onClick={() => {
          if (open) {
            menu.close();
            return;
          }
          tipHandlers?.onMouseLeave();
          menu.openMenu();
        }}
        {...tipHandlers}
      >
        <ButtonContent account={account} folded={folded} />
      </button>
      {open && account !== undefined && (
        <MenuPanel
          id={id}
          email={account.email}
          folded={folded}
          place={place}
          signOutButton={menu.signOutButton}
          signOut={menu.signOut}
        />
      )}
    </div>
  );
}
