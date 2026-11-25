import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor, within } from 'storybook/test';
import type { BugStats } from '../stats/types.ts';
import { flowLoaderOf } from './flow-fixtures.ts';
import type { LoadBugStats } from './stats-api.ts';
import {
  bugStatsOf,
  bugStatsResponse,
  noBugTickets,
} from './stats-bug-fixtures.ts';
import { autonomyLoaderOf, qualityLoaderOf } from './stats-fixtures.ts';
import { flowLoaded, loaded, panelOf, statsRouter } from './stats-story.ts';
import { StatsPage } from './StatsPage.tsx';

const SLOW_MS = 300;

function slowBugs(bugs: BugStats): LoadBugStats {
  return () =>
    new Promise((resolve) => {
      setTimeout(() => {
        resolve(bugStatsResponse(bugs));
      }, SLOW_MS);
    });
}

const meta = {
  title: 'StatsPage/Kind row',
  component: StatsPage,
  args: {
    loadAutonomy: autonomyLoaderOf(),
    loadQuality: qualityLoaderOf(),
    loadFlow: flowLoaderOf(),
    loadBugStats: slowBugs(bugStatsOf()),
  },
  decorators: [statsRouter],
} satisfies Meta<typeof StatsPage>;

export default meta;

type Story = StoryObj<typeof meta>;

function controlsOf(canvasElement: HTMLElement): Element | null {
  return canvasElement.querySelector('.fd-page-header-controls');
}

export const SlowBugAnswer: Story = {
  name: 'Bug answer slower than the panels: the row is held, nothing moves',
  play: async ({ canvasElement }) => {
    await loaded(canvasElement);
    await flowLoaded(canvasElement);
    const controls = controlsOf(canvasElement);
    const autonomy = panelOf(canvasElement, 'Autonomy');
    await expect(controls?.querySelector('[data-pending]')).not.toBeNull();
    await expect(
      within(canvasElement).queryByRole('group', { name: 'Kind' }),
    ).toBeNull();
    await within(canvasElement).findByRole(
      'group',
      { name: 'Kind' },
      { timeout: SLOW_MS * 5 },
    );
    await expect(controlsOf(canvasElement)).toBe(controls);
    await expect(controls?.querySelector('[data-pending]')).toBeNull();
    await expect(panelOf(canvasElement, 'Autonomy')).toBe(autonomy);
  },
};

export const SlowNoBugTickets: Story = {
  name: 'Bug answer without bug tickets: the held row collapses',
  args: { loadBugStats: slowBugs(noBugTickets) },
  play: async ({ canvasElement }) => {
    await loaded(canvasElement);
    await expect(controlsOf(canvasElement)).not.toBeNull();
    await waitFor(
      async () => {
        await expect(controlsOf(canvasElement)).toBeNull();
      },
      { timeout: SLOW_MS * 5 },
    );
    await expect(
      within(canvasElement).queryByRole('group', { name: 'Kind' }),
    ).toBeNull();
  },
};
