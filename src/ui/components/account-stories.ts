import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import type { Account } from '../../auth/types.ts';
import type { SignOutOutcome } from '../auth-api.ts';
import type { AccountView, SidebarAccount } from './AccountMenu.tsx';

export const ADA: Account = {
  id: 1,
  email: 'ada@example.test',
  name: 'Ada Lovelace',
  role: 'manager',
};

export const GRACE: Account = {
  id: 2,
  email: 'grace@example.test',
  name: 'Grace Hopper',
  role: 'dev',
};

export const ADA_NAME = 'Account: Ada Lovelace, Manager';

export function slotOf(
  view: AccountView,
  signOut: () => Promise<SignOutOutcome> = () =>
    Promise.resolve({ status: 'signed-out' }),
): SidebarAccount {
  return { view, signOut: fn(signOut), onSignedOut: fn() };
}

export function signedIn(account: Account = ADA): AccountView {
  return { status: 'account', account };
}

export function accountButton(
  canvasElement: HTMLElement,
  name: string | RegExp = /^Account/,
): HTMLElement {
  return within(canvasElement).getByRole('button', { name });
}

export async function openMenu(
  canvasElement: HTMLElement,
  name: string | RegExp = /^Account/,
): Promise<HTMLElement> {
  const button = accountButton(canvasElement, name);
  await expect(button).toHaveAttribute('aria-expanded', 'false');
  await userEvent.click(button);
  await expect(button).toHaveAttribute('aria-expanded', 'true');
  const controls = button.getAttribute('aria-controls') ?? '';
  const menu = document.getElementById(controls);
  if (menu === null) throw new Error('The account menu is not open');
  await waitFor(() =>
    expect(
      within(menu).getByRole('button', { name: 'Sign out' }),
    ).toHaveFocus(),
  );
  return menu;
}

export async function expectMenuClosed(button: HTMLElement): Promise<void> {
  await waitFor(() => expect(button).toHaveAttribute('aria-expanded', 'false'));
  await expect(button).not.toHaveAttribute('aria-controls');
}
