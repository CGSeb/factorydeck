import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import { FrictionReportActions } from './FrictionReportActions.tsx';
import { COPY_AND_MARK, COPY_REPORT } from './FrictionReportButton.tsx';

const meta = {
  component: FrictionReportActions,
  args: {
    blocked: null,
    onCopy: fn(() => Promise.resolve()),
    onMark: fn(() => Promise.resolve()),
    lastReportAt: '2026-11-23T07:00:00Z',
    now: new Date('2026-11-23T09:00:00Z'),
  },
} satisfies Meta<typeof FrictionReportActions>;

export default meta;

type Story = StoryObj<typeof meta>;

function lastReport(canvasElement: HTMLElement): HTMLElement | null {
  return canvasElement.querySelector('.fd-friction-last-report');
}

export const LastReport: Story = {
  name: 'A report was marked',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('button', { name: COPY_REPORT }),
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole('button', { name: COPY_AND_MARK }),
    ).toBeInTheDocument();
    await expect(lastReport(canvasElement)).toHaveTextContent(
      'Last report 2 h ago',
    );
  },
};

export const NoReport: Story = {
  name: 'No report marked',
  args: { lastReportAt: null },
  play: async ({ canvasElement }) => {
    await expect(lastReport(canvasElement)).toBeEmptyDOMElement();
  },
};
