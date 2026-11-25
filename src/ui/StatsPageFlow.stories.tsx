import type { Meta, StoryObj } from '@storybook/react-vite';
import { bugStatsLoaderOf } from './stats-bug-fixtures.ts';
import { expect, within } from 'storybook/test';
import { flowLoaderOf, unreachableFlow } from './flow-fixtures.ts';
import { autonomyLoaderOf, qualityLoaderOf } from './stats-fixtures.ts';
import {
  figureTexts,
  flowLoaded,
  loaded,
  panelOf,
  qualityLoaded,
  statsRouter,
} from './stats-story.ts';
import { StatsPage } from './StatsPage.tsx';

const meta = {
  title: 'StatsPage/Flow and cost',
  component: StatsPage,
  args: {
    loadAutonomy: autonomyLoaderOf(),
    loadQuality: qualityLoaderOf(),
    loadFlow: flowLoaderOf(),
    loadBugStats: bugStatsLoaderOf(),
  },
  decorators: [statsRouter],
} satisfies Meta<typeof StatsPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AfterQuality: Story = {
  name: 'Flow and cost after the quality panel',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await loaded(canvasElement);
    await qualityLoaded(canvasElement);
    await flowLoaded(canvasElement);
    await expect(
      canvas
        .getAllByRole('heading', { level: 2 })
        .map((heading) => heading.textContent),
    ).toEqual(['Autonomy', 'Quality', 'Flow and cost']);
    await expect(
      canvas
        .getByRole('link', { name: '#50 Link sessions to issues, 9.6M' })
        .getAttribute('href'),
    ).toBe('/features/50?project=%2Fwork%2Fexample-app&period=30d');
  },
};

export const FlowUnreachable: Story = {
  name: 'Flow API unreachable while the other panels render',
  args: { loadFlow: unreachableFlow },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await loaded(canvasElement);
    await expect(figureTexts(canvasElement, '[data-value]')).toEqual([
      '75%',
      '25%',
      '4 h 03 min',
    ]);
    await qualityLoaded(canvasElement);
    await expect(
      await within(panelOf(canvasElement, 'Flow and cost')).findByText(
        /Database unreachable/,
      ),
    ).toBeVisible();
    await expect(canvas.getAllByText(/Database unreachable/)).toHaveLength(1);
  },
};

export const At1024: Story = {
  name: 'At 1024 px',
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 1024 }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    await loaded(canvasElement);
    await qualityLoaded(canvasElement);
    await flowLoaded(canvasElement);
    await expect(
      canvasElement.querySelectorAll('.fd-stats-flow .fd-stats-figures > div'),
    ).toHaveLength(6);
  },
};
