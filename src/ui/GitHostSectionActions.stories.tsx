import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { DATABASE_UNREACHABLE, SERVER_UNREACHABLE } from './auth-api.ts';
import { GitHostSection } from './GitHostSection.tsx';
import {
  githubWithToken,
  pendingTokenRemove,
  savedToken,
  tokenRemoverOf,
  tokenSaverOf,
} from './git-host-token-fixtures.ts';
import { GitHostHarness, saveTyped } from './git-host-story.ts';

const meta = {
  component: GitHostSection,
  args: {
    project: githubWithToken,
    secretKey: true,
    saveToken: fn(tokenSaverOf(savedToken)),
    removeToken: fn(tokenRemoverOf({ status: 'removed' })),
    onSaved: fn(),
  },
  render: (args) => <GitHostHarness {...args} />,
} satisfies Meta<typeof GitHostSection>;

export default meta;

type Story = StoryObj<typeof meta>;

const QUESTION = 'Remove the git host token of Billing?';

async function openRemoval(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole('button', { name: 'Remove token' }));
  return within(await canvas.findByRole('dialog', { name: QUESTION }));
}

async function failsUnderButtons(canvasElement: HTMLElement, message: string) {
  await saveTyped(canvasElement);
  const canvas = within(canvasElement);
  await expect(await canvas.findByText(message)).toBeVisible();
  await expect(canvas.getByLabelText('Token')).toHaveValue('ghp_example');
  await expect(
    canvas.getByRole('button', { name: 'Save token' }),
  ).toBeEnabled();
}

export const Checked: Story = {
  name: 'Saved: Token checked, field emptied, state from the answer',
  play: async ({ canvasElement, args }) => {
    await saveTyped(canvasElement, '  ghp_new  ');
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText(
        'Token checked: main has docs/agents/factory.yml.',
      ),
    ).toBeVisible();
    await expect(args.saveToken).toHaveBeenCalledWith(1, { token: 'ghp_new' });
    await expect(canvas.getByLabelText('Token')).toHaveValue('');
    await expect(canvas.getByText(/^Token set on/)).toHaveTextContent(
      'Token set on 12 Mar 2026 by Grace',
    );
    await expect(args.onSaved).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, tokenSetBy: { name: 'Grace' } }),
    );
    await userEvent.type(canvas.getByLabelText('Token'), 'x');
    await expect(
      canvas.queryByText('Token checked: main has docs/agents/factory.yml.'),
    ).toBeNull();
  },
};

export const BadToken: Story = {
  name: 'Refusal: the check message under Token, which keeps the token and the focus',
  args: {
    saveToken: fn(
      tokenSaverOf({
        status: 'invalid',
        field: 'token',
        message: 'Bad token',
      }),
    ),
  },
  play: async ({ canvasElement }) => {
    await saveTyped(canvasElement);
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Bad token')).toBeVisible();
    const token = canvas.getByLabelText('Token');
    await waitFor(() => expect(token).toHaveFocus());
    await expect(token).toHaveAttribute('aria-invalid', 'true');
    await expect(token).toHaveValue('ghp_example');
  },
};

export const NoFactoryFile: Story = {
  name: 'Refusal: no docs/agents/factory.yml on the default branch',
  args: {
    saveToken: fn(
      tokenSaverOf({
        status: 'invalid',
        field: 'token',
        message: 'No docs/agents/factory.yml on main',
      }),
    ),
  },
  play: async ({ canvasElement }) => {
    await saveTyped(canvasElement);
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText('No docs/agents/factory.yml on main'),
    ).toBeVisible();
  },
};

export const RemoteChanged: Story = {
  name: 'Refusal: the remote changed during the check, under the buttons',
  args: {
    saveToken: fn(
      tokenSaverOf({
        status: 'failed',
        message: 'The remote changed during the check: try again',
      }),
    ),
  },
  play: async ({ canvasElement }) => {
    await failsUnderButtons(
      canvasElement,
      'The remote changed during the check: try again',
    );
  },
};

export const CliMissing: Story = {
  name: 'Refusal: the git host CLI is missing on the server',
  args: {
    saveToken: fn(
      tokenSaverOf({
        status: 'failed',
        message: 'gh not found on the server',
      }),
    ),
  },
  play: async ({ canvasElement }) => {
    await failsUnderButtons(canvasElement, 'gh not found on the server');
  },
};

export const ProjectGone: Story = {
  name: '404: the project is no longer in FactoryDeck',
  args: { saveToken: fn(tokenSaverOf({ status: 'missing' })) },
  play: async ({ canvasElement }) => {
    await failsUnderButtons(
      canvasElement,
      'Billing is no longer in FactoryDeck.',
    );
  },
};

export const DatabaseUnreachable: Story = {
  name: '503: database unreachable',
  args: {
    saveToken: fn(
      tokenSaverOf({
        status: 'failed',
        message: DATABASE_UNREACHABLE,
      }),
    ),
  },
  play: async ({ canvasElement }) => {
    await failsUnderButtons(canvasElement, DATABASE_UNREACHABLE);
  },
};

export const ServerUnreachable: Story = {
  name: 'Network error or 401: could not reach the server',
  args: {
    saveToken: fn(
      tokenSaverOf({ status: 'failed', message: SERVER_UNREACHABLE }),
    ),
  },
  play: async ({ canvasElement }) => {
    await failsUnderButtons(canvasElement, SERVER_UNREACHABLE);
  },
};

export const RemoveDialog: Story = {
  name: 'Remove dialog: the question, focus on Cancel, Escape closes it',
  play: async ({ canvasElement, args }) => {
    const dialog = await openRemoval(canvasElement);
    await expect(
      dialog.getByText('Its issues and pull requests stop updating.'),
    ).toBeVisible();
    await waitFor(() =>
      expect(dialog.getByRole('button', { name: 'Cancel' })).toHaveFocus(),
    );
    await expect(
      dialog.getByRole('button', { name: 'Remove token' }),
    ).toBeEnabled();
    await userEvent.keyboard('{Escape}');
    await expect(within(canvasElement).queryByRole('dialog')).toBeNull();
    await expect(args.removeToken).not.toHaveBeenCalled();
  },
};

export const Removing: Story = {
  name: 'Remove dialog: Removing… while it runs',
  args: { removeToken: fn(pendingTokenRemove()) },
  play: async ({ canvasElement }) => {
    const dialog = await openRemoval(canvasElement);
    await userEvent.click(dialog.getByRole('button', { name: 'Remove token' }));
    await expect(
      await dialog.findByRole('button', { name: 'Removing…' }),
    ).toBeDisabled();
  },
};

export const RemoveError: Story = {
  name: 'Remove dialog: an error stays in the dialog',
  args: {
    removeToken: fn(
      tokenRemoverOf({
        status: 'failed',
        message: DATABASE_UNREACHABLE,
      }),
    ),
  },
  play: async ({ canvasElement }) => {
    const dialog = await openRemoval(canvasElement);
    await userEvent.click(dialog.getByRole('button', { name: 'Remove token' }));
    await expect(await dialog.findByText(DATABASE_UNREACHABLE)).toBeVisible();
    await expect(
      within(canvasElement).getByRole('dialog', { name: QUESTION }),
    ).toBeVisible();
  },
};

export const Removed: Story = {
  name: 'Removed: No token, and the focus goes to Token',
  play: async ({ canvasElement, args }) => {
    const dialog = await openRemoval(canvasElement);
    await userEvent.click(dialog.getByRole('button', { name: 'Remove token' }));
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.queryByRole('dialog')).toBeNull());
    await expect(canvas.getByText('No token')).toBeVisible();
    await waitFor(() => expect(canvas.getByLabelText('Token')).toHaveFocus());
    await expect(args.removeToken).toHaveBeenCalledWith(1);
    await expect(
      canvas.getByRole('button', { name: 'Remove token' }),
    ).toBeDisabled();
  },
};

export const RemoveWithoutKey: Story = {
  name: 'Remove token works without the secret key',
  args: { secretKey: false },
  play: async ({ canvasElement }) => {
    const dialog = await openRemoval(canvasElement);
    await userEvent.click(dialog.getByRole('button', { name: 'Remove token' }));
    await expect(
      await within(canvasElement).findByText('No token'),
    ).toBeVisible();
  },
};
