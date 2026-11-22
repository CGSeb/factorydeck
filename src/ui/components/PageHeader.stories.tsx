import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import { PageHeader } from './PageHeader.tsx';
import { PeriodPills } from './PeriodPills.tsx';
import { surfaceFrame } from './story-frame.ts';
import { TokenAmount } from './TokenAmount.tsx';

const meta = {
  component: PageHeader,
  args: { title: 'Features' },
  decorators: [surfaceFrame],
} satisfies Meta<typeof PageHeader>;

export default meta;

type Story = StoryObj<typeof meta>;

const pills = <PeriodPills value="7d" onChange={fn()} />;

export const Plain: Story = {
  args: { summary: '12 features · 4 in review' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('heading', { level: 1, name: 'Features' }),
    ).toBeInTheDocument();
    await expect(canvas.getByText('12 features · 4 in review')).toBeVisible();
    await expect(canvas.queryByRole('link')).toBeNull();
  },
};

export const WithBackLink: Story = {
  args: {
    title: '042 · Export to CSV',
    back: { label: 'Features', href: '/features' },
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('link', { name: '← Features' }),
    ).toHaveAttribute('href', '/features');
  },
};

export const HeadlineWithTokenAmount: Story = {
  args: {
    variant: 'headline',
    title: (
      <>
        <TokenAmount
          counts={{
            input: 1_200,
            output: 950,
            cacheRead: 41_800_000,
            cacheWrite: 320_000,
          }}
          costUsd={27.4}
        />{' '}
        tokens this week
      </>
    ),
    summary: '$27.40 across 3 projects',
  },
  play: async ({ canvasElement }) => {
    const heading = within(canvasElement).getByRole('heading', { level: 1 });
    await expect(within(heading).getByText('42.1M')).toBeVisible();
    await expect(heading).toHaveTextContent(/tokens this week$/);
  },
};

export const WithPeriodPills: Story = {
  args: { summary: '12 features · 4 in review', slot: pills },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('group', { name: 'Period' }),
    ).toBeInTheDocument();
  },
};

export const Narrow: Story = {
  args: {
    summary: '12 features · 4 in review',
    back: { label: 'Overview', href: '/' },
    slot: pills,
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 360 }}>
        <Story />
      </div>
    ),
  ],
};
