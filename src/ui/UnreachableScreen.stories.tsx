import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { DATABASE_UNREACHABLE, SERVER_UNREACHABLE } from './auth-api.ts';
import { RETRY, RETRYING, UnreachableScreen } from './UnreachableScreen.tsx';

const meta = {
  component: UnreachableScreen,
  args: {
    message: DATABASE_UNREACHABLE,
    retrying: false,
    onRetry: fn(),
  },
} satisfies Meta<typeof UnreachableScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const DatabaseUnreachable: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('alert')).toHaveTextContent(
      DATABASE_UNREACHABLE,
    );
    await expect(canvas.queryByRole('textbox')).toBeNull();
    const retry = canvas.getByRole('button', { name: RETRY });
    await waitFor(() => expect(retry).toHaveFocus());
    await userEvent.keyboard('{Enter}');
    await expect(args.onRetry).toHaveBeenCalledOnce();
  },
};

export const ServerUnreachable: Story = {
  args: { message: SERVER_UNREACHABLE },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('alert')).toHaveTextContent(
      SERVER_UNREACHABLE,
    );
  },
};

export const Retrying: Story = {
  args: { retrying: true, onRetry: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const retry = canvas.getByRole('button', { name: RETRYING });
    await expect(retry).toHaveAttribute('aria-disabled', 'true');
    await waitFor(() => expect(retry).toHaveFocus());
    await userEvent.click(retry);
    await expect(args.onRetry).not.toHaveBeenCalled();
  },
};
