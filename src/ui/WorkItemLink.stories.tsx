import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { WorkItemLink } from './WorkItemLink.tsx';

const meta = {
  component: WorkItemLink,
  args: {
    workItem: 52,
    issue: {
      status: 'found',
      title: 'Export button',
      url: 'https://github.com/example-org/example-app/issues/52',
    },
  },
} satisfies Meta<typeof WorkItemLink>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Found: Story = {
  play: async ({ canvasElement }) => {
    const link = within(canvasElement).getByRole('link', { name: '#52' });
    await expect(link).toHaveAttribute(
      'href',
      'https://github.com/example-org/example-app/issues/52',
    );
    await expect(link).toHaveAttribute('title', 'Export button');
    await expect(link).toHaveAttribute('target', '_blank');
  },
};

export const NotFound: Story = {
  args: { issue: { status: 'not-found' } },
  play: async ({ canvasElement }) => {
    await expect(canvasElement).toHaveTextContent('#52 (not found)');
    await expect(within(canvasElement).queryByRole('link')).toBeNull();
  },
};

export const NotCollectedYet: Story = {
  args: { issue: { status: 'not-collected' } },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.textContent).toBe('#52');
    await expect(within(canvasElement).queryByRole('link')).toBeNull();
  },
};

export const NoWorkItem: Story = {
  args: { workItem: null, issue: null },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.textContent).toBe('—');
  },
};
