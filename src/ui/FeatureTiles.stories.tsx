import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { featureList, someFeatures } from './feature-fixtures.ts';
import { FeatureTiles } from './FeatureTiles.tsx';

const list = featureList(someFeatures);

const meta = {
  component: FeatureTiles,
  args: { totals: list.totals, merged: list.merged },
} satisfies Meta<typeof FeatureTiles>;

export default meta;

type Story = StoryObj<typeof meta>;

function tileValue(canvasElement: HTMLElement, name: string): string {
  const heading = within(canvasElement).getByRole('heading', { name });
  return heading.nextElementSibling?.textContent ?? '';
}

export const WithMergedIssues: Story = {
  play: async ({ canvasElement }) => {
    await expect(tileValue(canvasElement, 'Cost')).toBe('~$16.25');
    await expect(tileValue(canvasElement, 'Merged issues')).toBe('2');
    await expect(tileValue(canvasElement, 'Cost per merged issue')).toBe(
      '~$6.38',
    );
    await expect(tileValue(canvasElement, 'Merged without a person')).toBe(
      '50%',
    );
    await expect(
      within(canvasElement).getByText('Excludes 4 calls with unknown prices.'),
    ).toBeVisible();
  },
};

export const NoMergedIssue: Story = {
  args: {
    merged: {
      issues: 0,
      costPerIssueUsd: null,
      tokensPerIssue: null,
      withoutPerson: null,
      unknownPriceCalls: 0,
    },
  },
  play: async ({ canvasElement }) => {
    await expect(tileValue(canvasElement, 'Merged issues')).toBe('0');
    await expect(tileValue(canvasElement, 'Cost per merged issue')).toBe('—');
    await expect(tileValue(canvasElement, 'Merged without a person')).toBe('—');
  },
};
