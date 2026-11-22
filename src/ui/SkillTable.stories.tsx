import type { Meta, StoryObj } from '@storybook/react-vite';
import { MemoryRouter } from 'react-router';
import { expect, within } from 'storybook/test';
import { noSkillUsage, someSkills } from './skill-fixtures.ts';
import { SkillTable } from './SkillTable.tsx';

const meta = {
  component: SkillTable,
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof SkillTable>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithSkills: Story = {
  args: { skills: someSkills, search: '?period=all' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('link', { name: 'kit:write-spec' }),
    ).toHaveAttribute('href', '/skills/kit%3Awrite-spec?period=all');
    await expect(canvas.getByText('No skill')).toBeVisible();
    await expect(canvas.getByText('600.0K')).toBeVisible();
    await expect(canvas.getAllByRole('rowheader').at(-1)).toHaveTextContent(
      'No skill',
    );
  },
};

export const OnlyNoSkill: Story = {
  args: { skills: [noSkillUsage], search: '?period=7d' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole('row')).toHaveLength(2);
    await expect(
      canvas.getByRole('table', { name: 'Skills' }).querySelector('a'),
    ).toBeNull();
  },
};
