import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { BLACK, WHITE } from '../colors.ts';
import {
  ROLE_SEGMENTS,
  TINY_SEGMENTS,
  ZERO_SEGMENTS,
} from './chart-fixtures.ts';
import { SplitBar } from './SplitBar.tsx';
import { surfaceFrame } from './story-frame.ts';

const meta = {
  title: 'Components/SplitBar',
  component: SplitBar,
  decorators: [
    (Story, { args }) => (
      <figure style={{ margin: 0 }}>
        <figcaption
          style={{
            fontSize: 'var(--fd-text-xs)',
            color: 'var(--fd-muted)',
            marginBottom: 'var(--fd-space-2)',
          }}
        >
          {args.label}
        </figcaption>
        <Story />
      </figure>
    ),
    surfaceFrame,
  ],
  args: { label: 'Tokens by role', segments: ROLE_SEGMENTS, height: 'medium' },
} satisfies Meta<typeof SplitBar>;

export default meta;

type Story = StoryObj<typeof meta>;

function bar(canvasElement: HTMLElement): HTMLElement {
  return within(canvasElement).getByRole('group', { name: 'Tokens by role' });
}

function track(canvasElement: HTMLElement): HTMLElement {
  const element = bar(canvasElement).querySelector('[aria-hidden="true"]');
  if (!(element instanceof HTMLElement)) throw new Error('No track');
  return element;
}

function segments(canvasElement: HTMLElement): HTMLElement[] {
  return [
    ...track(canvasElement).querySelectorAll<HTMLElement>('[data-segment]'),
  ];
}

function spokenSegments(canvasElement: HTMLElement): string[] {
  return within(bar(canvasElement))
    .queryAllByRole('listitem')
    .map((item) => item.textContent);
}

export const Thin: Story = {
  args: { height: 'thin' },
  play: async ({ canvasElement }) => {
    await expect(track(canvasElement)).toHaveStyle({
      height: '8px',
      borderRadius: '4px',
      gap: '2px',
    });
    await expect(segments(canvasElement)).toHaveLength(4);
    await expect(track(canvasElement)).not.toHaveTextContent('%');
  },
};

export const Medium: Story = {
  play: async ({ canvasElement }) => {
    await expect(track(canvasElement)).toHaveStyle({
      height: '12px',
      borderRadius: '6px',
    });
    await expect(spokenSegments(canvasElement)).toEqual([
      'builder 45%',
      'reviewer 30%',
      'shipper 15%',
      'spec checker 10%',
    ]);
  },
};

export const TallWithShares: Story = {
  name: 'Tall with shares',
  args: { height: 'tall' },
  play: async ({ canvasElement }) => {
    await expect(track(canvasElement)).toHaveStyle({
      height: '40px',
      borderRadius: '20px',
    });
    const [builder, reviewer] = segments(canvasElement);
    const share = builder?.querySelector('span');
    await expect(share).toHaveTextContent(/^45%$/);
    await expect(share).toHaveStyle({
      color: WHITE,
      fontSize: '12px',
      fontWeight: '600',
    });
    await expect(reviewer?.querySelector('span')).toHaveTextContent(/^30%$/);
    await expect(reviewer?.querySelector('span')).toHaveStyle({ color: BLACK });
    await expect(builder).toHaveStyle({ containerType: 'inline-size' });
  },
};

export const OneSegment: Story = {
  name: 'One segment',
  args: { height: 'tall', segments: ROLE_SEGMENTS.slice(0, 1) },
  play: async ({ canvasElement }) => {
    await expect(segments(canvasElement)).toHaveLength(1);
    await expect(spokenSegments(canvasElement)).toEqual(['builder 100%']);
  },
};

export const TinySegment: Story = {
  name: 'Tiny segment',
  args: { segments: TINY_SEGMENTS },
  play: async ({ canvasElement }) => {
    const [, tiny] = segments(canvasElement);
    await expect(tiny).toHaveStyle({ minWidth: '2px' });
    await expect(spokenSegments(canvasElement)).toEqual([
      'builder 100%',
      'reviewer 0%',
    ]);
  },
};

export const AllZero: Story = {
  name: 'All zero',
  args: { segments: ZERO_SEGMENTS },
  play: async ({ canvasElement }) => {
    await expect(segments(canvasElement)).toHaveLength(0);
    await expect(spokenSegments(canvasElement)).toEqual([]);
    await expect(track(canvasElement).style.background).toBe('var(--fd-line)');
  },
};

export const HoveredSegment: Story = {
  name: 'Hovered segment',
  args: { height: 'thin' },
  play: async ({ canvasElement }) => {
    const reviewer = bar(canvasElement).querySelector<HTMLElement>(
      '[data-hit="reviewer"]',
    );
    if (reviewer === null) throw new Error('No hover zone');
    await userEvent.hover(reviewer);
    const tooltip = bar(canvasElement).querySelector('[data-tooltip]');
    await expect(tooltip).toHaveTextContent(/^reviewer30%$/);
    await expect(tooltip).toHaveStyle({ position: 'fixed' });
    const [builder, hovered] = segments(canvasElement);
    await expect(hovered).toHaveStyle({ opacity: '1' });
    await expect(builder).toHaveStyle({ opacity: '0.45' });
    await userEvent.unhover(reviewer);
    await expect(bar(canvasElement).querySelector('[data-tooltip]')).toBeNull();
  },
};
