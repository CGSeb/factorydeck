import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { OverviewPage } from './OverviewPage.tsx';
import { fixedLoader, unreachableResponse } from './fixtures.ts';
import {
  UNREACHABLE,
  UNREACHABLE_TEXT,
  address,
  headlineLoaded,
  overviewArgs,
  overviewRouter,
  pending,
  section,
} from './overview-story.ts';
import { pendingWaiting, unreachableWaiting } from './waiting-fixtures.ts';

const meta = {
  component: OverviewPage,
  args: overviewArgs,
  decorators: [overviewRouter],
} satisfies Meta<typeof OverviewPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  args: {
    loadOverview: pending,
    loadFeatures: pending,
    loadRoles: pending,
    loadAutonomy: pending,
    loadQuality: pending,
    loadFlow: pending,
    loadWaiting: pendingWaiting,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByText('Loading…')).toHaveLength(4);
    await expect(
      canvas.getByRole('heading', { level: 1, name: 'Overview' }),
    ).toBeVisible();
  },
};

export const FeaturesLoading: Story = {
  args: { loadFeatures: pending },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await headlineLoaded(canvasElement);
    const board = canvas.getByRole('region', { name: 'Board' });
    await expect(within(board).getByText('Loading…')).toBeVisible();
    await canvas.findByText('Merged without a person');
  },
};

export const DatabaseUnreachable: Story = {
  args: {
    loadOverview: fixedLoader(() => unreachableResponse),
    loadFeatures: () => Promise.resolve(UNREACHABLE),
    loadRoles: () => Promise.resolve(UNREACHABLE),
    loadAutonomy: () => Promise.resolve(UNREACHABLE),
    loadQuality: () => Promise.resolve(UNREACHABLE),
    loadFlow: () => Promise.resolve(UNREACHABLE),
    loadWaiting: unreachableWaiting,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() =>
      expect(canvas.getAllByText(UNREACHABLE_TEXT)).toHaveLength(4),
    );
    await userEvent.click(canvas.getByRole('button', { name: 'All time' }));
    await expect(address(canvasElement)).toHaveTextContent('/?period=all');
  },
};

export const HealthUnreachable: Story = {
  args: { loadQuality: () => Promise.resolve(UNREACHABLE) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('link', { name: '#61 Bulk import' });
    await headlineLoaded(canvasElement);
    const health = section(canvasElement, /^Health$/);
    await expect(within(health).getByText(UNREACHABLE_TEXT)).toBeVisible();
    await expect(
      canvas.getByRole('heading', { name: 'Needs a person' }),
    ).toBeVisible();
  },
};

export const OverviewUnreachable: Story = {
  args: { loadOverview: fixedLoader(() => unreachableResponse) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('link', { name: '#61 Bulk import' });
    await expect(
      canvas.getByRole('heading', { level: 1, name: 'Overview' }),
    ).toBeVisible();
    await expect(canvas.getAllByText(UNREACHABLE_TEXT)).toHaveLength(1);
  },
};

export const FeaturesUnreachable: Story = {
  args: { loadFeatures: () => Promise.resolve(UNREACHABLE) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await headlineLoaded(canvasElement);
    const board = canvas.getByRole('region', { name: 'Board' });
    await waitFor(() =>
      expect(within(board).getByText(UNREACHABLE_TEXT)).toBeVisible(),
    );
  },
};
