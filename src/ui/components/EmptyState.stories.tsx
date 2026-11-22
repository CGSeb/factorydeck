import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { EmptyState } from './EmptyState.tsx';

const meta = {
  component: EmptyState,
  args: {
    title: 'No factory project yet',
    text: 'FactoryDeck reads the projects where the factory is installed.',
  },
  decorators: [
    (Story) => (
      <div style={{ background: 'var(--fd-page)', padding: 24 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof EmptyState>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithSteps: Story = {
  args: {
    eyebrow: 'Welcome to FactoryDeck',
    steps: [
      { key: 'install', content: 'Install the factory skills in a project.' },
      {
        key: 'setup',
        content: 'Run the setup skill to write its configuration.',
      },
      { key: 'build', content: 'Build a feature: its sessions appear here.' },
    ],
    footnote: 'Sessions of other projects are skipped.',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('heading', { level: 1, name: 'No factory project yet' }),
    ).toBeInTheDocument();
    await expect(
      within(canvas.getByRole('list'))
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      'Install the factory skills in a project.',
      'Run the setup skill to write its configuration.',
      'Build a feature: its sessions appear here.',
    ]);
    await expect(
      canvas.getByText('Sessions of other projects are skipped.'),
    ).toBeVisible();
  },
};

export const TitleAndText: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('list')).toBeNull();
  },
};
