import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { formatDateTime } from './format.ts';
import { ONGOING_TEXT, VersionBlock } from './VersionBlock.tsx';

const NOW = new Date('2026-11-20T09:00:00.000Z');

const meta = {
  component: VersionBlock,
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 360, fontSize: 'var(--fd-text-md)' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    now: NOW,
    version: {
      number: 2,
      count: 3,
      startedAt: '2026-11-14T09:00:00.000Z',
      endedAt: '2026-11-16T09:00:00.000Z',
      reopenedAt: '2026-11-17T09:00:00.000Z',
    },
  },
} satisfies Meta<typeof VersionBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

function valueOf(canvasElement: HTMLElement, term: string): HTMLElement {
  const dt = within(canvasElement).getByText(term, { selector: 'dt' });
  const dd = dt.nextElementSibling;
  if (!(dd instanceof HTMLElement)) throw new Error(`No value for ${term}`);
  return dd;
}

export const EndedByAReopen: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Version 2')).toBeVisible();
    await expect(valueOf(canvasElement, 'Started')).toHaveTextContent(
      `Reopened ${formatDateTime('2026-11-14T09:00:00.000Z')}`,
    );
    await expect(valueOf(canvasElement, 'Ended')).toHaveTextContent(
      `Reopened ${formatDateTime('2026-11-17T09:00:00.000Z')}`,
    );
    await expect(valueOf(canvasElement, 'Duration')).toHaveTextContent(
      '3 d 0 h',
    );
  },
};

export const FirstVersion: Story = {
  args: {
    version: {
      number: 1,
      count: 3,
      startedAt: '2026-11-10T09:00:00.000Z',
      endedAt: '2026-11-12T09:00:00.000Z',
      reopenedAt: '2026-11-14T09:00:00.000Z',
    },
  },
  play: async ({ canvasElement }) => {
    await expect(valueOf(canvasElement, 'Started')).toHaveTextContent(
      `Opened ${formatDateTime('2026-11-10T09:00:00.000Z')}`,
    );
  },
};

export const Ongoing: Story = {
  args: {
    version: {
      number: 3,
      count: 3,
      startedAt: '2026-11-17T09:00:00.000Z',
      endedAt: null,
      reopenedAt: null,
    },
  },
  play: async ({ canvasElement }) => {
    await expect(valueOf(canvasElement, 'Ended')).toHaveTextContent(
      ONGOING_TEXT,
    );
    await expect(valueOf(canvasElement, 'Duration')).toHaveTextContent(
      '3 d 0 h',
    );
  },
};

export const ClosedLatest: Story = {
  args: {
    version: {
      number: 3,
      count: 3,
      startedAt: '2026-11-17T09:00:00.000Z',
      endedAt: '2026-11-18T15:30:00.000Z',
      reopenedAt: null,
    },
  },
  play: async ({ canvasElement }) => {
    await expect(valueOf(canvasElement, 'Ended')).toHaveTextContent(
      `Closed ${formatDateTime('2026-11-18T15:30:00.000Z')}`,
    );
    await expect(valueOf(canvasElement, 'Duration')).toHaveTextContent(
      '1 d 6 h',
    );
  },
};
