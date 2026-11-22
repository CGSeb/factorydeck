import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { Dialog } from './Dialog.tsx';

const meta = {
  component: Dialog,
  args: {
    title: 'Delete Old App?',
    text: 'This removes its 12 sessions from FactoryDeck. The session logs on disk are not touched.',
    cancelLabel: 'Cancel',
    onCancel: fn(),
    danger: { label: 'Delete project', onClick: fn() },
  },
} satisfies Meta<typeof Dialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithDanger: Story = {
  args: { onCancel: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const dialog = canvas.getByRole('dialog', { name: 'Delete Old App?' });
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(dialog).toHaveAccessibleDescription(
      'This removes its 12 sessions from FactoryDeck. The session logs on disk are not touched.',
    );
    const cancel = canvas.getByRole('button', { name: 'Cancel' });
    const remove = canvas.getByRole('button', { name: 'Delete project' });
    await expect(cancel).toHaveFocus();
    await userEvent.tab();
    await expect(remove).toHaveFocus();
    await userEvent.tab();
    await expect(cancel).toHaveFocus();
    await userEvent.tab({ shift: true });
    await expect(remove).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    await expect(args.onCancel).toHaveBeenCalledOnce();
  },
};

export const BackdropCancels: Story = {
  args: {
    onCancel: fn(),
    danger: { label: 'Delete project', onClick: fn() },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const dialog = canvas.getByRole('dialog', { name: 'Delete Old App?' });
    const backdrop = canvasElement.querySelector('.fd-dialog-backdrop');
    if (!(backdrop instanceof HTMLElement)) throw new Error('No backdrop');
    await userEvent.click(backdrop);
    await expect(args.onCancel).toHaveBeenCalledOnce();
    await userEvent.click(dialog);
    await expect(args.onCancel).toHaveBeenCalledOnce();
    await userEvent.click(
      canvas.getByRole('button', { name: 'Delete project' }),
    );
    await expect(args.danger?.onClick).toHaveBeenCalledOnce();
  },
};

export const CancelOnly: Story = {
  args: {
    title: 'Nothing to delete',
    text: 'Old App is no longer in FactoryDeck.',
    cancelLabel: 'Close',
    danger: undefined,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const close = canvas.getByRole('button', { name: 'Close' });
    await expect(close).toHaveFocus();
    await userEvent.tab();
    await expect(close).toHaveFocus();
  },
};

function Opener(): React.ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Delete Old App
      </button>
      {open && (
        <Dialog
          title="Delete Old App?"
          text="This removes its 12 sessions from FactoryDeck."
          cancelLabel="Cancel"
          onCancel={() => setOpen(false)}
          danger={{ label: 'Delete project', onClick: fn() }}
        />
      )}
    </>
  );
}

export const ReturnsFocusToOpener: Story = {
  render: () => <Opener />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const opener = canvas.getByRole('button', { name: 'Delete Old App' });
    await userEvent.click(opener);
    await expect(canvas.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(canvas.queryByRole('dialog')).toBeNull());
    await expect(opener).toHaveFocus();
  },
};
