import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { GitHostSection } from './GitHostSection.tsx';
import {
  githubNoToken,
  githubWithToken,
  pendingTokenSave,
  savedToken,
  selfHostedUnknown,
  selfHostedWithToken,
  tokenRemoverOf,
  tokenSaverOf,
} from './git-host-token-fixtures.ts';
import { GitHostHarness, saveTyped, typeToken } from './git-host-story.ts';

const meta = {
  component: GitHostSection,
  args: {
    project: githubNoToken,
    secretKey: true,
    saveToken: fn(tokenSaverOf(savedToken)),
    removeToken: fn(tokenRemoverOf({ status: 'removed' })),
    onSaved: fn(),
  },
  render: (args) => <GitHostHarness {...args} />,
} satisfies Meta<typeof GitHostSection>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NoToken: Story = {
  name: 'No token: read-only host, empty field, Save token disabled',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('heading', { level: 2, name: 'Git host' }),
    ).toBeVisible();
    await expect(canvas.getByText('GitHub')).toBeVisible();
    await expect(canvas.queryByRole('combobox')).toBeNull();
    await expect(canvas.getByText('No token')).toBeVisible();
    const token = canvas.getByLabelText('Token');
    await expect(token).toHaveValue('');
    await expect(token).toHaveAttribute('type', 'password');
    await expect(token).toHaveAttribute('autocomplete', 'new-password');
    const save = canvas.getByRole('button', { name: 'Save token' });
    await expect(save).toBeDisabled();
    await expect(
      canvas.getByRole('button', { name: 'Remove token' }),
    ).toBeDisabled();
    await userEvent.type(token, '   ');
    await expect(save).toBeDisabled();
    await userEvent.type(token, 'x');
    await expect(save).toBeEnabled();
  },
};

export const TokenSet: Story = {
  name: 'Token set: date, time in a tooltip and the manager who set it',
  args: { project: githubWithToken },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const state = canvas.getByText(/^Token set on/);
    await expect(state).toHaveTextContent('Token set on 3 Feb 2026 by Ada');
    const date = within(state).getByText('3 Feb 2026');
    await expect(date).toHaveAttribute(
      'title',
      expect.stringMatching(/^3 Feb, \d\d:\d\d$/),
    );
    await expect(canvas.getByLabelText('Token')).toHaveValue('');
    await expect(
      canvas.getByRole('button', { name: 'Remove token' }),
    ).toBeEnabled();
  },
};

export const TokenSetAccountGone: Story = {
  name: 'Token set by an account since deleted',
  args: { project: selfHostedWithToken },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/^Token set on/)).toHaveTextContent(
      /^Token set on 3 Feb 2026$/,
    );
  },
};

export const UnknownHost: Story = {
  name: 'Unknown host: a select starting on Choose…',
  args: { project: selfHostedUnknown },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const select = canvas.getByLabelText('Host');
    await expect(select).toHaveValue('');
    await expect(
      within(select)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Choose…', 'GitHub', 'GitLab']);
    await userEvent.selectOptions(select, 'gitlab');
    await expect(
      canvas.getByRole('button', { name: 'Save token' }),
    ).toBeDisabled();
  },
};

export const ChooseHost: Story = {
  name: 'Refusal: Choose GitHub or GitLab under the select, which takes the focus',
  args: { project: selfHostedUnknown },
  play: async ({ canvasElement, args }) => {
    await saveTyped(canvasElement);
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText('Choose GitHub or GitLab'),
    ).toBeVisible();
    const select = canvas.getByLabelText('Host');
    await waitFor(() => expect(select).toHaveFocus());
    await expect(select).toHaveAttribute('aria-invalid', 'true');
    await expect(args.saveToken).not.toHaveBeenCalled();
    await expect(canvas.getByLabelText('Token')).toHaveValue('ghp_example');
  },
};

export const StoredHost: Story = {
  name: 'Stored host: the select starts on it and is sent with the token',
  args: { project: selfHostedWithToken },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const select = canvas.getByLabelText('Host');
    await expect(select).toHaveValue('gitlab');
    await expect(
      within(select)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['GitHub', 'GitLab']);
    await userEvent.selectOptions(select, 'github');
    await saveTyped(canvasElement, '  glpat-example  ');
    await waitFor(() =>
      expect(args.saveToken).toHaveBeenCalledWith(2, {
        token: 'glpat-example',
        gitHost: 'github',
      }),
    );
  },
};

export const Checking: Story = {
  name: 'Checking: buttons disabled, field and select enabled',
  args: { project: selfHostedWithToken, saveToken: fn(pendingTokenSave()) },
  play: async ({ canvasElement }) => {
    await saveTyped(canvasElement);
    const canvas = within(canvasElement);
    const checking = await canvas.findByRole('button', { name: 'Checking…' });
    await expect(checking).toBeDisabled();
    await expect(
      canvas.getByRole('button', { name: 'Remove token' }),
    ).toBeDisabled();
    await expect(canvas.getByLabelText('Token')).toBeEnabled();
    await expect(canvas.getByLabelText('Host')).toBeEnabled();
  },
};

export const NoSecretKey: Story = {
  name: 'No secret key: the message, Save token disabled, Remove token enabled',
  args: { project: githubWithToken, secretKey: false },
  play: async ({ canvasElement }) => {
    await typeToken(canvasElement);
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText(
        'Set FACTORYDECK_SECRET_KEY on the server to store tokens.',
      ),
    ).toBeVisible();
    await expect(
      canvas.getByRole('button', { name: 'Save token' }),
    ).toBeDisabled();
    await expect(
      canvas.getByRole('button', { name: 'Remove token' }),
    ).toBeEnabled();
  },
};

export const NoSecretKeyAnswer: Story = {
  name: 'No secret key: the 503 of the key switches the section',
  args: { saveToken: fn(tokenSaverOf({ status: 'no-key' })) },
  play: async ({ canvasElement }) => {
    await saveTyped(canvasElement);
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText(
        'Set FACTORYDECK_SECRET_KEY on the server to store tokens.',
      ),
    ).toBeVisible();
    await expect(
      canvas.getByRole('button', { name: 'Save token' }),
    ).toBeDisabled();
  },
};
