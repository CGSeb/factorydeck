import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { categoryColor } from '../design/palette.ts';
import { ROLE_SEGMENTS } from './chart-fixtures.ts';
import { SplitLegend } from './SplitLegend.tsx';
import { surfaceFrame } from './story-frame.ts';

const meta = {
  title: 'Components/SplitLegend',
  component: SplitLegend,
  decorators: [surfaceFrame],
  args: { segments: ROLE_SEGMENTS },
} satisfies Meta<typeof SplitLegend>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithTokenCounts: Story = {
  name: 'With token counts',
  play: async ({ canvasElement }) => {
    const list = within(canvasElement).getByRole('list');
    await expect(list).toHaveStyle({
      display: 'flex',
      flexWrap: 'wrap',
      gap: '6px 18px',
    });
    const items = within(list).getAllByRole('listitem');
    await expect(items).toHaveLength(4);
    const [builder] = items;
    await expect(builder).toHaveTextContent(/^builder4\.5M/);
    await expect(builder?.querySelector('[aria-hidden="true"]')).toHaveStyle({
      width: '9px',
      height: '9px',
      background: categoryColor(0),
    });
    await expect(
      within(builder ?? canvasElement).getByRole('tooltip', { hidden: true }),
    ).toHaveTextContent('Cost ~$11.25');
  },
};

export const WithoutTokenCounts: Story = {
  name: 'Without token counts',
  args: {
    segments: [
      { label: 'build-feature', value: 1_240, color: categoryColor(0) },
      { label: 'write-spec', value: 318, color: categoryColor(1) },
      { label: 'check-spec', value: 0, color: categoryColor(2) },
    ],
  },
  play: async ({ canvasElement }) => {
    const items = within(canvasElement).getAllByRole('listitem');
    await expect(items.map((item) => item.textContent)).toEqual([
      'build-feature1,240',
      'write-spec318',
      'check-spec0',
    ]);
    await expect(
      within(canvasElement).queryByRole('tooltip', { hidden: true }),
    ).toBeNull();
  },
};
