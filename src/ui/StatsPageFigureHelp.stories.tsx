import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { flowLoaderOf } from './flow-fixtures.ts';
import { autonomyLoaderOf, qualityLoaderOf } from './stats-fixtures.ts';
import { FIGURE_HELP } from './stats-help.ts';
import {
  flowLoaded,
  loaded,
  panelOf,
  qualityLoaded,
  statsRouter,
} from './stats-story.ts';
import { StatsPage } from './StatsPage.tsx';

const meta = {
  title: 'StatsPage/Figure help',
  component: StatsPage,
  args: {
    loadAutonomy: autonomyLoaderOf(),
    loadQuality: qualityLoaderOf(),
    loadFlow: flowLoaderOf(),
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 1024 }}>
        <Story />
      </div>
    ),
    statsRouter,
  ],
} satisfies Meta<typeof StatsPage>;

export default meta;

type Story = StoryObj<typeof meta>;

async function allLoaded(canvasElement: HTMLElement): Promise<void> {
  await loaded(canvasElement);
  await qualityLoaded(canvasElement);
  await flowLoaded(canvasElement);
}

export const EveryFigureHelp: Story = {
  name: 'Every figure with its help, and tokens on rework',
  play: async ({ canvasElement }) => {
    await allLoaded(canvasElement);
    const canvas = within(canvasElement);
    await expect(
      canvas
        .getAllByRole('button', { name: /^About / })
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual(Object.keys(FIGURE_HELP).map((label) => `About ${label}`));
    for (const [label, help] of Object.entries(FIGURE_HELP)) {
      const button = canvas.getByRole('button', { name: `About ${label}` });
      await userEvent.hover(button);
      await expect(canvas.getByRole('tooltip')).toHaveTextContent(help);
      await userEvent.unhover(button);
    }
    const went = within(panelOf(canvasElement, 'Flow and cost'));
    await expect(went.queryByText('Cache reads')).toBeNull();
    await expect(went.getByText('Tokens on rework')).toBeVisible();
  },
};

export const ReworkHelpOpen: Story = {
  name: 'Tokens on rework help open at 1024 px',
  play: async ({ canvasElement }) => {
    await allLoaded(canvasElement);
    const canvas = within(canvasElement);
    await userEvent.hover(
      canvas.getByRole('button', { name: 'About Tokens on rework' }),
    );
    await expect(canvas.getByRole('tooltip')).toHaveTextContent(
      FIGURE_HELP['Tokens on rework'],
    );
  },
};
