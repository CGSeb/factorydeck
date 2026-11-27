import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { DeactivateDialog } from './DeactivateDialog.tsx';

const meta = {
  component: DeactivateDialog,
  args: {
    name: 'Dara',
    deactivating: false,
    onCancel: fn(),
    onConfirm: fn(),
  },
} satisfies Meta<typeof DeactivateDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Confirmation: Story = {
  args: { onCancel: fn(), onConfirm: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const dialog = canvas.getByRole('dialog', { name: 'Deactivate Dara?' });
    await expect(dialog).toHaveAccessibleDescription(
      'They are signed out at once.',
    );
    await expect(
      within(dialog)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Cancel', 'Deactivate']);
    await userEvent.click(canvas.getByRole('button', { name: 'Deactivate' }));
    await expect(args.onConfirm).toHaveBeenCalledTimes(1);
    await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }));
    await expect(args.onCancel).toHaveBeenCalledTimes(1);
  },
};

export const Deactivating: Story = {
  args: { deactivating: true, onCancel: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: 'Deactivating…' });
    await expect(button).toBeDisabled();
    await userEvent.keyboard('{Escape}');
    await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }));
    await expect(args.onCancel).not.toHaveBeenCalled();
    await expect(canvas.getByRole('dialog')).toBeVisible();
  },
};

export const LongName: Story = {
  name: 'A long name wraps in the title',
  args: { name: 'Bruno Delacroix-Montgomery the Second of the Long Names' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('heading', {
        name: 'Deactivate Bruno Delacroix-Montgomery the Second of the Long Names?',
      }),
    ).toBeVisible();
  },
};
