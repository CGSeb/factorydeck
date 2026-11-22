import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { WarningBanner } from './WarningBanner.tsx';

const remove = fn();

const meta = {
  component: WarningBanner,
  args: {
    label: 'Projects without a factory',
    messages: [
      {
        key: 'old-app',
        text: 'Old App no longer has its factory configuration.',
        action: { label: 'Delete project', onClick: remove },
      },
    ],
  },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof WarningBanner>;

export default meta;

type Story = StoryObj<typeof meta>;

export const OneMessageWithAction: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const banner = canvas.getByRole('region', {
      name: 'Projects without a factory',
    });
    const button = within(banner).getByRole('button', {
      name: 'Delete project',
    });
    await expect(button).toHaveAccessibleDescription(
      'Old App no longer has its factory configuration.',
    );
    await userEvent.click(button);
    await expect(remove).toHaveBeenCalledOnce();
  },
};

export const TwoMessages: Story = {
  args: {
    messages: [
      {
        key: 'old-app',
        text: 'Old App no longer has its factory configuration.',
        action: { label: 'Delete project', onClick: fn() },
      },
      {
        key: 'collect',
        text: 'Issues could not be collected: the git host did not answer.',
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole('listitem')).toHaveLength(2);
    await expect(canvas.getAllByRole('button')).toHaveLength(1);
  },
};
