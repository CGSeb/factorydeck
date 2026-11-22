import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { IssueTimeline } from './IssueTimeline.tsx';
import { surfaceFrame } from './story-frame.ts';
import { TIMELINE_STEPS } from './work-fixtures.ts';

const meta = {
  title: 'Components/IssueTimeline',
  component: IssueTimeline,
  decorators: [surfaceFrame],
  args: { steps: TIMELINE_STEPS },
} satisfies Meta<typeof IssueTimeline>;

export default meta;

type Story = StoryObj<typeof meta>;

export const FiveSteps: Story = {
  name: 'Five steps',
  play: async ({ canvasElement }) => {
    const list = canvasElement.querySelector('ol.fd-timeline');
    await expect(list).not.toBeNull();
    const steps =
      canvasElement.querySelectorAll<HTMLElement>('.fd-timeline-step');
    await expect(steps).toHaveLength(5);
    const [first, second] = steps;
    await expect(first?.querySelector('.fd-timeline-marker')).toHaveStyle({
      borderColor: TIMELINE_STEPS[0]?.color,
    });
    await expect(first).toHaveAttribute('data-role', 'spec checker');
    await expect(
      within(second ?? canvasElement).getAllByRole('link'),
    ).toHaveLength(2);
    await expect(
      within(second ?? canvasElement).getByRole('link', {
        name: 'Build issue #42',
      }),
    ).toHaveAttribute('href', '/sessions/s2');
    await expect(
      within(second ?? canvasElement).getByText('Mar 2, 09:40'),
    ).toBeInTheDocument();
  },
};

export const StepWithoutThreads: Story = {
  name: 'Step without threads',
  args: {
    steps: TIMELINE_STEPS.map((item, index) =>
      index === 3 ? { ...item, threads: [] } : item,
    ),
  },
  play: async ({ canvasElement }) => {
    const step = canvasElement.querySelectorAll('.fd-timeline-step')[3];
    await expect(step).toHaveTextContent('Shipped');
    await expect(step?.querySelector('ul')).toBeNull();
  },
};
