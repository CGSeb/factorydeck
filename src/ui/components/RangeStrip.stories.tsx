import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { formatTokens } from '../format.ts';
import { type RangeItem, RangeStrip } from './RangeStrip.tsx';
import { surfaceFrame } from './story-frame.ts';

const TITLES = [
  'Fold status groups',
  'Add period pills',
  'Show serenity reports',
  'Count unassigned work',
  'Link sessions to issues',
];

function issues(values: readonly number[]): RangeItem[] {
  return values.map((value, index) => {
    const number = 11 + index;
    return {
      label: `#${String(number)} ${TITLES[index % TITLES.length] ?? ''}`,
      value,
      href: `/issues/${String(number)}`,
    };
  });
}

const THIRTY = [
  ...Array.from({ length: 29 }, (_, index) => 400_000 + index * 95_000),
  12_000_000,
];

const meta = {
  title: 'Components/RangeStrip',
  component: RangeStrip,
  decorators: [surfaceFrame],
  args: {
    label: 'Tokens per merged issue',
    items: issues(THIRTY),
    format: formatTokens,
  },
} satisfies Meta<typeof RangeStrip>;

export default meta;

type Story = StoryObj<typeof meta>;

function tooltip(canvasElement: HTMLElement): string[] {
  const shown = canvasElement.querySelector('[data-tooltip]');
  if (shown === null) throw new Error('No tooltip');
  return [...shown.children].map((line) => line.textContent);
}

async function expectFixedHeight(canvasElement: HTMLElement): Promise<void> {
  const strip = canvasElement.querySelector<HTMLElement>('[data-strip]');
  await expect(strip?.style.height).toBe('116px');
  for (const row of canvasElement.querySelectorAll(
    '[data-axis], [data-notice]',
  )) {
    await expect(row).toHaveStyle({ height: '16px' });
  }
}

function markLabels(canvasElement: HTMLElement): string[] {
  return [...canvasElement.querySelectorAll('[data-mark-label]')].map(
    (mark) => mark.textContent,
  );
}

export const ThirtyIssues: Story = {
  name: '30 issues with one outlier',
  play: async ({ canvasElement }) => {
    await expectFixedHeight(canvasElement);
    const links = within(canvasElement).getAllByRole('link');
    await expect(links).toHaveLength(30);
    await expect(links[29]).toHaveAccessibleName(
      '#40 Link sessions to issues, 12.0M',
    );
    await expect(markLabels(canvasElement)).toEqual([
      'median 1.8M',
      'p90 2.9M',
    ]);
    await expect(
      [...(canvasElement.querySelector('[data-axis]')?.children ?? [])].map(
        (end) => end.textContent,
      ),
    ).toEqual(['0', '12.0M']);
  },
};

export const FoldedStack: Story = {
  name: 'Equal values stacking into a +k pill',
  args: {
    items: issues([
      500_000,
      1_000_000,
      ...Array.from({ length: 8 }, () => 2_000_000),
      4_000_000,
    ]),
  },
  play: async ({ canvasElement }) => {
    const pill = canvasElement.querySelector<HTMLElement>('[data-pill]');
    await expect(pill?.textContent).toBe('+4');
    await expect(canvasElement.querySelectorAll('[data-folded]')).toHaveLength(
      4,
    );
    for (let step = 0; step < 7; step += 1) await userEvent.tab();
    const focused = document.activeElement;
    await expect(focused).toHaveAttribute('data-folded');
    await expect(focused).toHaveAccessibleName('#17 Add period pills, 2.0M');
    await expect(tooltip(canvasElement)).toEqual([
      '#17 Add period pills',
      '2.0M',
    ]);
    await expect(pill?.style.boxShadow).toContain('var(--fd-accent)');
  },
};

export const CloseMarks: Story = {
  name: 'Close median and p90 labels',
  args: {
    items: issues([
      1_000_000, 1_000_000, 1_000_000, 1_000_000, 2_000_000, 2_000_000,
      2_000_000, 2_000_000, 2_100_000, 10_000_000,
    ]),
  },
  play: async ({ canvasElement }) => {
    await expectFixedHeight(canvasElement);
    const rows = [...canvasElement.querySelectorAll('[data-mark-label]')].map(
      (mark) => [mark.textContent, mark.getAttribute('data-row')],
    );
    await expect(rows).toEqual([
      ['median 2.0M', '0'],
      ['p90 2.1M', '1'],
    ]);
  },
};

export const ThreeItems: Story = {
  name: '3 items',
  args: { items: issues([800_000, 1_500_000, 3_100_000]) },
  play: async ({ canvasElement }) => {
    await expectFixedHeight(canvasElement);
    await expect(within(canvasElement).getAllByRole('link')).toHaveLength(3);
    await expect(markLabels(canvasElement)).toEqual([]);
    await expect(
      canvasElement.querySelector('[data-notice]')?.textContent,
    ).toBe('Not enough data for median and p90');
  },
};

export const NoItem: Story = {
  name: 'No item',
  args: { items: [] },
  play: async ({ canvasElement }) => {
    await expectFixedHeight(canvasElement);
    await expect(canvasElement.querySelector('[data-empty]')?.textContent).toBe(
      'No data',
    );
    await expect(canvasElement.querySelector('[data-line]')).toBeNull();
  },
};

export const FocusedDot: Story = {
  name: 'Focused dot',
  args: { items: issues([800_000, 1_500_000, 3_100_000, 2_400_000, 900_000]) },
  play: async ({ canvasElement }) => {
    await userEvent.tab();
    await userEvent.tab();
    const focused = document.activeElement;
    await expect(focused).toHaveAccessibleName(
      '#15 Link sessions to issues, 900.0K',
    );
    await expect(tooltip(canvasElement)).toEqual([
      '#15 Link sessions to issues',
      '900.0K',
    ]);
    await expect(
      focused instanceof HTMLElement ? focused.style.boxShadow : '',
    ).toContain('var(--fd-accent)');
    const other = within(canvasElement).getAllByRole('link')[4];
    if (other === undefined) throw new Error('No dot');
    await userEvent.hover(other);
    await expect(tooltip(canvasElement)[0]).toBe('#13 Show serenity reports');
    await expect(
      focused instanceof HTMLElement ? focused.style.boxShadow : '',
    ).toContain('var(--fd-accent)');
    await userEvent.unhover(other);
    await expect(tooltip(canvasElement)[0]).toBe('#15 Link sessions to issues');
    await expect(
      focused instanceof HTMLElement ? focused.style.boxShadow : '',
    ).toContain('var(--fd-accent)');
  },
};
