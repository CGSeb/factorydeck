import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import {
  autonomyLoaderOf,
  autonomyOf,
  emptyWeeks,
  monthCounts,
  noCounts,
  noReasons,
  pendingAutonomy,
  unreachableAutonomy,
} from './stats-fixtures.ts';
import { figureTexts, loaded, statsRouter } from './stats-story.ts';
import { StatsPage } from './StatsPage.tsx';

const meta = {
  component: StatsPage,
  args: { loadAutonomy: autonomyLoaderOf() },
  decorators: [statsRouter],
} satisfies Meta<typeof StatsPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NoMergedIssue: Story = {
  name: 'No merged issue',
  args: {
    loadAutonomy: autonomyLoaderOf(
      autonomyOf({
        current: { ...noCounts, answeredWaitsMs: [3_600_000] },
        previous: noCounts,
        waitingNow: 0,
        weeks: emptyWeeks,
        reasons: noReasons,
      }),
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await loaded(canvasElement);
    await expect(canvas.getByText('No issue merged')).toBeVisible();
    await expect(figureTexts(canvasElement, '[data-sample]')).toEqual([
      'Not enough data',
      'Not enough data',
      'Not enough data',
    ]);
    await expect(
      canvas.getByRole('img', { name: 'Merged without a person, by week' }),
    ).toBeInTheDocument();
    await expect(canvas.getByText('No person had to step in.')).toBeVisible();
  },
};

export const NoPersonSteppedIn: Story = {
  name: 'No person stepped in',
  args: {
    loadAutonomy: autonomyLoaderOf(
      autonomyOf({
        current: { ...monthCounts, mergedWithoutPerson: 24 },
        reasons: noReasons,
      }),
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await loaded(canvasElement);
    await expect(canvas.getByText('No person had to step in.')).toBeVisible();
    await expect(canvas.queryByRole('list')).toBeNull();
  },
};

export const Loading: Story = {
  args: { loadAutonomy: pendingAutonomy },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('heading', { level: 1, name: 'Stats' }),
    ).toBeVisible();
    await expect(
      canvas.getByRole('heading', { name: 'Autonomy' }),
    ).toBeVisible();
    await expect(canvas.getByText('Loading…')).toBeVisible();
  },
};

export const Unreachable: Story = {
  args: { loadAutonomy: unreachableAutonomy },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText(/Database unreachable/)).toBeVisible();
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
    await expect(
      canvasElement.querySelectorAll('.fd-stats-figures > div'),
    ).toHaveLength(3);
  },
};

export const ChangePeriod: Story = {
  name: 'Changing the period',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await loaded(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Last 7 days' }));
    await expect(
      canvas.getByRole('status', { name: 'Address' }),
    ).toHaveTextContent('?period=7d');
    await expect(
      (await canvas.findAllByText(/vs previous 7 days$/)).length,
    ).toBe(3);
    await userEvent.click(canvas.getByRole('button', { name: 'Today' }));
    await expect((await canvas.findAllByText(/vs yesterday$/)).length).toBe(3);
    await expect(
      canvas.getByRole('status', { name: 'Address' }),
    ).toHaveTextContent('?period=today');
  },
};
