import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { DATABASE_UNREACHABLE } from './auth-api.ts';
import {
  CODE_INVALID,
  type CliDecisionOutcome,
  type CliLogin,
  type CliLoginRead,
} from './cli-api.ts';
import {
  CANCEL,
  CANCELLED,
  CLI_TITLE,
  CODE_LABEL,
  CONNECT,
  CONNECTED,
  CONTINUE,
  CliPage,
  askLine,
} from './CliPage.tsx';

const LOGIN: CliLogin = {
  machine: 'ada-laptop',
  userCode: 'WDJB-MJHT',
  account: { name: 'Ada Lovelace', email: 'ada@example.test' },
};

function reading(outcome: CliLoginRead) {
  return fn((_code: string) => Promise.resolve(outcome));
}

function deciding(outcome: CliDecisionOutcome) {
  return fn((_code: string, _decision: 'approve' | 'cancel') =>
    Promise.resolve(outcome),
  );
}

const meta = {
  component: CliPage,
  args: {
    code: LOGIN.userCode,
    readCliLogin: reading({ status: 'ok', login: LOGIN }),
    decideCliLogin: deciding({ status: 'done' }),
  },
} satisfies Meta<typeof CliPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const CodeInUrl: Story = {
  name: 'Code in the URL',
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('heading', { level: 1, name: CLI_TITLE }),
    ).toBeVisible();
    await expect(await canvas.findByText(askLine(LOGIN))).toBeVisible();
    await expect(
      canvas.getByText(
        'ada-laptop asks to send sessions as Ada Lovelace (ada@example.test).',
      ),
    ).toBeVisible();
    await expect(canvas.getByText(LOGIN.userCode)).toBeVisible();
    await expect(canvas.getByRole('button', { name: CONNECT })).toBeEnabled();
    await expect(canvas.getByRole('button', { name: CANCEL })).toBeEnabled();
    await expect(args.readCliLogin).toHaveBeenCalledWith(LOGIN.userCode);
    await expect(args.decideCliLogin).not.toHaveBeenCalled();
  },
};

export const CodeToType: Story = {
  name: 'Code to type',
  args: { code: '', readCliLogin: reading({ status: 'ok', login: LOGIN }) },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByLabelText(CODE_LABEL);
    await waitFor(() => expect(field).toHaveFocus());
    await expect(args.readCliLogin).not.toHaveBeenCalled();
    await userEvent.type(field, 'wdjb mjht');
    await userEvent.click(canvas.getByRole('button', { name: CONTINUE }));
    await expect(await canvas.findByText(askLine(LOGIN))).toBeVisible();
    await expect(args.readCliLogin).toHaveBeenCalledWith('wdjb mjht');
  },
};

export const Connected: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: CONNECT }));
    await expect(await canvas.findByRole('status')).toHaveTextContent(
      CONNECTED,
    );
    await expect(args.decideCliLogin).toHaveBeenCalledWith(
      LOGIN.userCode,
      'approve',
    );
    await expect(canvas.queryByRole('button')).toBeNull();
  },
};

export const Cancelled: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: CANCEL }));
    await expect(await canvas.findByRole('status')).toHaveTextContent(
      CANCELLED,
    );
    await expect(args.decideCliLogin).toHaveBeenCalledWith(
      LOGIN.userCode,
      'cancel',
    );
  },
};

export const InvalidCode: Story = {
  name: 'Invalid or expired code',
  args: { readCliLogin: reading({ status: 'invalid' }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      CODE_INVALID,
    );
    const field = canvas.getByLabelText(CODE_LABEL);
    await expect(field).toHaveAttribute('aria-invalid', 'true');
    await expect(field).toHaveAccessibleDescription(CODE_INVALID);
    await expect(canvas.queryByRole('button', { name: CONNECT })).toBeNull();
  },
};

export const ExpiredOnConnect: Story = {
  name: 'Code expired before Connect',
  args: { decideCliLogin: deciding({ status: 'invalid' }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: CONNECT }));
    await expect(await canvas.findByText(CODE_INVALID)).toBeVisible();
    await expect(canvas.getByLabelText(CODE_LABEL)).toBeVisible();
  },
};

export const ConnectFailed: Story = {
  name: 'Connect failed: database unreachable',
  args: {
    decideCliLogin: deciding({
      status: 'failed',
      message: DATABASE_UNREACHABLE,
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: CONNECT }));
    await waitFor(() =>
      expect(canvas.getByRole('alert')).toHaveTextContent(DATABASE_UNREACHABLE),
    );
    await expect(canvas.getByRole('button', { name: CONNECT })).toBeEnabled();
  },
};
