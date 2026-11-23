import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import {
  frictionsLoaderOf,
  noActivityStats,
  noFrictionStats,
  pendingFrictions,
  unreachableFrictions,
} from './frictions-fixtures.ts';
import {
  frictionsLoaded,
  frictionsRouter,
  tableHeadings,
} from './frictions-story.ts';
import { FrictionsPage } from './FrictionsPage.tsx';

const meta = {
  component: FrictionsPage,
  args: { loadFrictions: frictionsLoaderOf() },
  decorators: [frictionsRouter],
} satisfies Meta<typeof FrictionsPage>;

export default meta;

type Story = StoryObj<typeof meta>;

const TREND = 'Frictions per 100 API calls, by day';
const TOOL_TABLES = [
  TREND,
  'By category',
  'By tool',
  'Failed commands',
  'Repeated failures',
  'By role',
  'Issues with the most frictions',
];

function address(canvasElement: HTMLElement): HTMLElement {
  return within(canvasElement).getByRole('status', { name: 'Address' });
}

async function pick(canvasElement: HTMLElement, name: RegExp): Promise<void> {
  const kinds = within(canvasElement).getByRole('group', { name: 'Kind' });
  await userEvent.click(within(kinds).getByRole('button', { name }));
}

export const SelectEachKind: Story = {
  name: 'Selecting each kind',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await frictionsLoaded(canvasElement);
    await pick(canvasElement, /^Tool errors/);
    await expect(address(canvasElement)).toHaveTextContent(
      '?period=30d&kind=tool-error',
    );
    await canvas.findByText('41 frictions · 2.0 per 100 API calls');
    await expect(tableHeadings(canvasElement)).toEqual(TOOL_TABLES);
    await pick(canvasElement, /^Stop blocked/);
    await expect(address(canvasElement)).toHaveTextContent(
      '?period=30d&kind=stop-blocked',
    );
    await canvas.findByText('5 frictions · 0.2 per 100 API calls');
    await expect(tableHeadings(canvasElement)).toEqual([
      TREND,
      'Stop blocked',
      'By role',
      'Issues with the most frictions',
    ]);
    await expect(
      within(canvas.getByRole('group', { name: 'Kind' }))
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['All46', 'Tool errors41', 'Stop blocked5']);
    await pick(canvasElement, /^All/);
    await expect(address(canvasElement)).toHaveTextContent('?period=30d');
    await expect(address(canvasElement)).not.toHaveTextContent('kind');
    await canvas.findByText('46 frictions · 2.2 per 100 API calls');
    await expect(tableHeadings(canvasElement)).toHaveLength(9);
  },
};

export const KindFromAddress: Story = {
  name: 'Kind read from the address',
  parameters: {
    entry: '/frictions?period=7d&kind=stop-blocked&kind=compaction',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('table', { name: 'Stop blocked' });
    const kinds = canvas.getByRole('group', { name: 'Kind' });
    await expect(
      within(kinds).getByRole('button', { name: /^Stop blocked/ }),
    ).toHaveAttribute('aria-pressed', 'true');
  },
};

export const UnknownKind: Story = {
  name: 'Compaction or an unknown kind in the address',
  parameters: { entry: '/frictions?period=7d&kind=compaction' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await frictionsLoaded(canvasElement);
    const kinds = canvas.getByRole('group', { name: 'Kind' });
    await expect(
      within(kinds).getByRole('button', { name: /^All/ }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(
      within(kinds).queryByRole('button', { name: /^Compactions/ }),
    ).toBeNull();
    await expect(tableHeadings(canvasElement)).toHaveLength(9);
  },
};

export const PeriodKeepsKind: Story = {
  name: 'Changing the period keeps the kind',
  parameters: { entry: '/frictions?period=30d&kind=stop-blocked' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await frictionsLoaded(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Last 7 days' }));
    await expect(address(canvasElement)).toHaveTextContent(
      '?period=7d&kind=stop-blocked',
    );
  },
};

export const NoFriction: Story = {
  name: 'No friction',
  args: { loadFrictions: frictionsLoaderOf(noFrictionStats) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await frictionsLoaded(canvasElement);
    await expect(
      canvas.getByText('No friction · 2,048 API calls'),
    ).toBeVisible();
    await expect(canvas.getByText('No friction in this period.')).toBeVisible();
    await expect(canvas.getByRole('group', { name: 'Kind' })).toBeVisible();
    await expect(tableHeadings(canvasElement)).toEqual([
      TREND,
      'Context peaks',
    ]);
  },
};

export const NoActivity: Story = {
  name: 'No activity',
  args: { loadFrictions: frictionsLoaderOf(noActivityStats) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText('No activity in this period.'),
    ).toBeVisible();
    await expect(canvas.getByText('No friction · 0 API calls')).toBeVisible();
    await expect(canvas.queryByRole('group', { name: 'Kind' })).toBeNull();
    await expect(tableHeadings(canvasElement)).toEqual([]);
  },
};

export const Loading: Story = {
  args: { loadFrictions: pendingFrictions },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('heading', { level: 1, name: 'Frictions' }),
    ).toBeVisible();
    await expect(canvas.getByText('Loading…')).toBeVisible();
    await expect(
      canvasElement.querySelector('.fd-page-summary[aria-hidden="true"]'),
    ).not.toBeNull();
  },
};

export const Unreachable: Story = {
  args: { loadFrictions: unreachableFrictions },
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
    await frictionsLoaded(canvasElement);
    await expect(tableHeadings(canvasElement)).toHaveLength(9);
  },
};

export const LoadingWithFilter: Story = {
  name: 'Loading a session filter shows no chip yet',
  args: { loadFrictions: pendingFrictions },
  parameters: { entry: '/frictions?period=7d&session=s-1' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Loading…')).toBeVisible();
    await expect(canvas.queryByText(/^Session:/)).toBeNull();
  },
};
