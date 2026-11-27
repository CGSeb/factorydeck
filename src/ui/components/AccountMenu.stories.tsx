import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { DATABASE_UNREACHABLE, SERVER_UNREACHABLE } from '../auth-api.ts';
import {
  ADA,
  ADA_NAME,
  GRACE,
  accountButton,
  expectMenuClosed,
  openMenu,
  signedIn,
  slotOf,
} from './account-stories.ts';
import { Sidebar } from './Sidebar.tsx';
import {
  expectDrawerClosed,
  expectFolded,
  inNarrowWindow,
  openDrawer,
  withStoredFold,
} from './sidebar-stories.ts';

const frame: Decorator = (Story) => (
  <div style={{ display: 'flex', height: 560, background: 'var(--fd-page)' }}>
    <Story />
    <button type="button" style={{ alignSelf: 'flex-start' }}>
      Outside
    </button>
  </div>
);

const LONG_NAME = 'Maximiliana Wilhelmina Featherstonehaugh-Cholmondeley';
const LONG_EMAIL =
  'maximiliana.wilhelmina.featherstonehaugh-cholmondeley@engineering.example.test';

const meta = {
  title: 'Components/Account menu',
  component: Sidebar,
  args: {
    links: [
      { label: 'Overview', icon: 'overview', href: '#overview', current: true },
      { label: 'Roles', icon: 'roles', href: '#roles', current: false },
    ],
    account: slotOf(signedIn()),
  },
  decorators: [frame, withStoredFold(undefined)],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Sidebar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  args: { account: slotOf({ status: 'loading' }) },
  play: async ({ canvasElement }) => {
    const button = accountButton(canvasElement, 'Account');
    await expect(button).toBeDisabled();
    await expect(button.querySelectorAll('.fd-account-bar')).toHaveLength(2);
  },
};

export const Manager: Story = {
  play: async ({ canvasElement }) => {
    const button = accountButton(canvasElement, ADA_NAME);
    await expect(button).toHaveTextContent('Ada LovelaceManager');
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    const bottom = within(canvasElement)
      .getByRole('complementary')
      .querySelector('.fd-sidebar-bottom');
    await expect(bottom?.lastElementChild).toContainElement(button);
    await expect(bottom?.lastElementChild?.previousElementSibling).toHaveClass(
      'fd-sidebar-credit',
    );
  },
};

export const Dev: Story = {
  args: { account: slotOf(signedIn(GRACE)) },
  play: async ({ canvasElement }) => {
    await expect(
      accountButton(canvasElement, 'Account: Grace Hopper, Dev'),
    ).toHaveTextContent('Grace HopperDev');
  },
};

export const Open: Story = {
  play: async ({ canvasElement }) => {
    const menu = await openMenu(canvasElement);
    await expect(menu).toHaveTextContent(ADA.email);
    await expect(menu.querySelector('hr')).not.toBeNull();
    await expect(
      within(menu)
        .getByRole('button', { name: 'Sign out' })
        .querySelector('[data-icon="sign-out"]'),
    ).not.toBeNull();
  },
};

export const KeyboardAndOutside: Story = {
  play: async ({ canvasElement }) => {
    const button = accountButton(canvasElement);
    button.focus();
    await userEvent.keyboard('{Enter}');
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await waitFor(() =>
      expect(
        within(canvasElement).getByRole('button', { name: 'Sign out' }),
      ).toHaveFocus(),
    );
    await userEvent.keyboard('{Escape}');
    await expectMenuClosed(button);
    await expect(button).toHaveFocus();
    await userEvent.keyboard(' ');
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await userEvent.tab();
    await expectMenuClosed(button);
    await openMenu(canvasElement);
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: 'Outside' }),
    );
    await expectMenuClosed(button);
  },
};

export const LongName: Story = {
  args: { account: slotOf(signedIn({ ...ADA, name: LONG_NAME })) },
  play: async ({ canvasElement }) => {
    const button = accountButton(
      canvasElement,
      `Account: ${LONG_NAME}, Manager`,
    );
    const name = button.querySelector('.fd-account-name');
    await expect(name).toHaveTextContent(LONG_NAME);
    await expect(name).toHaveAttribute('title', LONG_NAME);
  },
};

export const LongEmail: Story = {
  args: { account: slotOf(signedIn({ ...ADA, email: LONG_EMAIL })) },
  play: async ({ canvasElement }) => {
    const menu = await openMenu(canvasElement);
    await expect(menu.querySelector('.fd-account-email')).toHaveTextContent(
      LONG_EMAIL,
    );
  },
};

export const SigningOut: Story = {
  args: {
    account: slotOf(signedIn(), () => new Promise(() => undefined)),
  },
  play: async ({ canvasElement, args }) => {
    const menu = await openMenu(canvasElement);
    await userEvent.click(
      within(menu).getByRole('button', { name: 'Sign out' }),
    );
    const busy = within(menu).getByRole('button', { name: 'Signing out…' });
    await expect(busy).toBeDisabled();
    await expect(args.account?.signOut).toHaveBeenCalledTimes(1);
    await expect(accountButton(canvasElement)).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  },
};

function failedStory(message: string): Story {
  return {
    args: {
      account: slotOf(signedIn(), () =>
        Promise.resolve({ status: 'failed', message }),
      ),
    },
    play: async ({ canvasElement, args }) => {
      const menu = await openMenu(canvasElement);
      await userEvent.click(
        within(menu).getByRole('button', { name: 'Sign out' }),
      );
      await expect(await within(menu).findByRole('alert')).toHaveTextContent(
        message,
      );
      const again = within(menu).getByRole('button', { name: 'Sign out' });
      await expect(again).toBeEnabled();
      await waitFor(() => expect(again).toHaveFocus());
      await expect(args.account?.onSignedOut).not.toHaveBeenCalled();
      await expect(accountButton(canvasElement)).toHaveAttribute(
        'aria-expanded',
        'true',
      );
    },
  };
}

export const SignOutFailedDatabase: Story = failedStory(DATABASE_UNREACHABLE);

export const SignOutFailedServer: Story = failedStory(SERVER_UNREACHABLE);

export const SignedOut: Story = {
  play: async ({ canvasElement, args }) => {
    const menu = await openMenu(canvasElement);
    await userEvent.click(
      within(menu).getByRole('button', { name: 'Sign out' }),
    );
    await waitFor(() =>
      expect(args.account?.onSignedOut).toHaveBeenCalledTimes(1),
    );
  },
};

export const Unavailable: Story = {
  args: { account: slotOf({ status: 'unavailable' }) },
  play: async ({ canvasElement }) => {
    const button = accountButton(canvasElement, 'Account');
    await expect(button).toBeDisabled();
    await expect(button.querySelector('[data-placeholder]')).not.toBeNull();
    await userEvent.click(button);
    await expect(button).toHaveAttribute('aria-expanded', 'false');
  },
};

export const Collapsed: Story = {
  decorators: [withStoredFold('collapsed')],
  play: async ({ canvasElement }) => {
    await expectFolded(canvasElement, true);
    const button = accountButton(canvasElement, ADA_NAME);
    await expect(button).toHaveTextContent(/^AL$/);
    button.focus();
    await expect(
      await within(canvasElement).findByRole('tooltip', { hidden: true }),
    ).toHaveTextContent('Ada Lovelace · Manager');
  },
};

export const CollapsedLoading: Story = {
  args: { account: slotOf({ status: 'loading' }) },
  decorators: [withStoredFold('collapsed')],
  play: async ({ canvasElement }) => {
    const button = accountButton(canvasElement, 'Account');
    await expect(button).toBeDisabled();
    await expect(
      button.querySelector('.fd-account-initials[data-placeholder]'),
    ).not.toBeNull();
  },
};

export const CollapsedOpen: Story = {
  decorators: [withStoredFold('collapsed')],
  play: async ({ canvasElement }) => {
    const menu = await openMenu(canvasElement, ADA_NAME);
    await expect(menu).toHaveTextContent(ADA.email);
    await expect(menu).toHaveAttribute('data-folded', 'true');
    await expectFolded(canvasElement, true);
  },
};

export const InDrawer: Story = {
  decorators: [inNarrowWindow],
  play: async ({ canvasElement }) => {
    await openDrawer(canvasElement);
    const drawer = within(canvasElement).getByRole('dialog');
    const button = within(drawer).getByRole('button', { name: ADA_NAME });
    await openMenu(drawer, ADA_NAME);
    await userEvent.keyboard('{Escape}');
    await expectMenuClosed(button);
    await expect(button).toHaveFocus();
    await expect(within(canvasElement).getByRole('dialog')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await expectDrawerClosed(canvasElement);
  },
};
