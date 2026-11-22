import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { IssueTimeline } from './IssueTimeline.tsx';
import { surfaceFrame } from './story-frame.ts';
import { TIMELINE_STEPS } from './work-fixtures.ts';
import type { TimelineMilestone } from './IssueTimeline.tsx';

function milestone(
  values: Omit<TimelineMilestone, 'id' | 'afterStep'>,
): TimelineMilestone[] {
  return [{ id: 'milestone-0', afterStep: 'step-2', ...values }];
}

function placed(canvasElement: HTMLElement): HTMLElement {
  const items = [
    ...canvasElement.querySelectorAll<HTMLElement>('.fd-timeline > li'),
  ];
  const item = items[3];
  if (item === undefined || !item.classList.contains('fd-timeline-milestone')) {
    throw new Error('No milestone after the third step');
  }
  return item;
}

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

export const RefusedReport: Story = {
  name: 'Refused report',
  args: {
    milestones: milestone({
      tone: 'warning',
      title:
        'Serenity 64/100 (threshold 80) · merge refused: below threshold, gates failed',
      detail: '2 Mar, 14:30',
      link: { href: 'https://git.example.com/demo/pull/57', text: '#57' },
    }),
  },
  play: async ({ canvasElement }) => {
    const item = placed(canvasElement);
    await expect(item).toHaveAttribute('data-tone', 'warning');
    await expect(item).toHaveTextContent('merge refused');
    await expect(
      within(item).queryAllByRole('tooltip', { hidden: true }),
    ).toHaveLength(0);
    await expect(
      within(canvasElement).getAllByRole('tooltip', { hidden: true }).length,
    ).toBeGreaterThan(0);
    await expect(item.querySelector('ul')).toBeNull();
    await expect(
      within(item).getByRole('link', { name: '#57' }),
    ).toHaveAttribute('href', 'https://git.example.com/demo/pull/57');
    await expect(
      within(canvasElement).getAllByRole('listitem').length,
    ).toBeGreaterThan(5);
  },
};

export const AllowedReport: Story = {
  name: 'Allowed report',
  args: {
    milestones: milestone({
      tone: 'success',
      title: 'Serenity 88/100 (threshold 80) · merge allowed',
      detail: '2 Mar, 15:10',
      link: { href: 'https://git.example.com/demo/pull/57', text: '#57' },
    }),
  },
  play: async ({ canvasElement }) => {
    const item = placed(canvasElement);
    await expect(item).toHaveAttribute('data-tone', 'success');
    await expect(item).toHaveTextContent('merge allowed');
  },
};

export const NeedsSpecAnswered: Story = {
  name: 'Needs spec answered',
  args: {
    milestones: milestone({
      tone: 'warning',
      title: 'Needs spec',
      detail: 'answered 2 Mar, 12:00',
    }),
  },
  play: async ({ canvasElement }) => {
    const item = placed(canvasElement);
    await expect(item).toHaveAttribute('data-tone', 'warning');
    await expect(item).toHaveTextContent('Needs specanswered 2 Mar, 12:00');
  },
};

export const NeedsSpecWaiting: Story = {
  name: 'Needs spec waiting',
  args: {
    milestones: milestone({
      tone: 'warning',
      title: 'Needs spec',
      detail: 'waiting for a person',
    }),
  },
  play: async ({ canvasElement }) => {
    await expect(placed(canvasElement)).toHaveTextContent(
      'Needs specwaiting for a person',
    );
  },
};
