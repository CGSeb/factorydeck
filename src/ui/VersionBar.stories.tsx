import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState, type ReactElement } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import { VersionBar } from './VersionBar.tsx';

function Stepping({
  start,
  count,
}: {
  start: number;
  count: number;
}): ReactElement {
  const [shown, setShown] = useState(start);
  return <VersionBar shown={shown} count={count} onChange={setShown} />;
}

const meta = {
  component: VersionBar,
  args: { shown: 3, count: 3, onChange: () => undefined },
  render: (args) => <Stepping start={args.shown} count={args.count} />,
} satisfies Meta<typeof VersionBar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Latest: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Version 3 of 3')).toBeVisible();
    await expect(
      canvas.getByRole('button', { name: 'Next version' }),
    ).toHaveAttribute('aria-disabled', 'true');
    const previous = canvas.getByRole('button', { name: 'Previous version' });
    await expect(previous).toHaveAttribute('aria-disabled', 'false');
    await userEvent.click(previous);
    await expect(canvas.getByText('Version 2 of 3')).toBeVisible();
  },
};

export const First: Story = {
  args: { shown: 1 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const previous = canvas.getByRole('button', { name: 'Previous version' });
    await expect(previous).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(previous);
    await expect(canvas.getByText('Version 1 of 3')).toBeVisible();
    previous.focus();
    await userEvent.keyboard('{Tab}');
    await expect(
      canvas.getByRole('button', { name: 'Next version' }),
    ).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect(canvas.getByText('Version 2 of 3')).toBeVisible();
    await userEvent.keyboard(' ');
    await expect(canvas.getByText('Version 3 of 3')).toBeVisible();
    await expect(
      canvas.getByRole('button', { name: 'Next version' }),
    ).toHaveFocus();
  },
};

export const Middle: Story = {
  args: { shown: 2 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Version 2 of 3')).toBeVisible();
    for (const name of ['Previous version', 'Next version']) {
      await expect(canvas.getByRole('button', { name })).toHaveAttribute(
        'aria-disabled',
        'false',
      );
    }
  },
};
