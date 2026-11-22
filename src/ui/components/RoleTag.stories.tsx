import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { roleColors } from '../design/palette.ts';
import { RoleTag } from './RoleTag.tsx';
import { surfaceFrame } from './story-frame.ts';

const colors = roleColors(['Builder', 'Orchestration', 'unassigned']);

function colorOf(role: string): string {
  return colors.get(role) ?? '';
}

const meta = {
  title: 'Components/RoleTag',
  component: RoleTag,
  decorators: [surfaceFrame],
  args: { role: 'Builder', color: colorOf('Builder') },
} satisfies Meta<typeof RoleTag>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Role: Story = {
  play: async ({ canvasElement }) => {
    const tag = within(canvasElement).getByText('Builder');
    await expect(tag.querySelector('[aria-hidden="true"]')).toHaveStyle({
      width: '9px',
      height: '9px',
      borderRadius: '3px',
      background: colorOf('Builder'),
    });
    await expect(tag).not.toHaveStyle({ fontStyle: 'italic' });
  },
};

export const Orchestration: Story = {
  args: { role: 'Orchestration', color: colorOf('Orchestration') },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement)
        .getByText('Orchestration')
        .querySelector('[aria-hidden="true"]'),
    ).toHaveStyle({ background: colorOf('Orchestration') });
  },
};

export const Unassigned: Story = {
  args: { role: 'unassigned', color: colorOf('unassigned') },
  play: async ({ canvasElement }) => {
    const tag = within(canvasElement).getByText('unassigned');
    await expect(tag).toHaveStyle({ fontStyle: 'italic' });
    await expect(tag.style.color).toBe('var(--fd-muted)');
  },
};
