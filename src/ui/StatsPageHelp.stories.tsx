import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import {
  autonomyLoaderOf,
  autonomyOf,
  monthQuality,
  qualityLoaderOf,
  qualityOf,
  someReasons,
} from './stats-fixtures.ts';
import {
  QUALITY,
  figureTexts,
  loaded,
  panelOf,
  qualityLoaded,
  statsRouter,
} from './stats-story.ts';
import { flowLoaderOf } from './flow-fixtures.ts';
import { StatsPage } from './StatsPage.tsx';

const meta = {
  component: StatsPage,
  args: {
    loadAutonomy: autonomyLoaderOf(),
    loadQuality: qualityLoaderOf(),
    loadFlow: flowLoaderOf(),
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 1024 }}>
        <Story />
      </div>
    ),
    statsRouter,
  ],
} satisfies Meta<typeof StatsPage>;

export default meta;

type Story = StoryObj<typeof meta>;

function rowTexts(canvasElement: HTMLElement): (string | null)[] {
  return within(panelOf(canvasElement, 'Autonomy'))
    .getAllByRole('listitem')
    .map((item) => item.textContent);
}

export const SixRows: Story = {
  name: 'Six rows, rounds before a stop and a wait still open, at 1024 px',
  args: {
    loadAutonomy: autonomyLoaderOf(
      autonomyOf({
        reasons: {
          below1To5: 1,
          below6To15: 2,
          below16Plus: 3,
          gatesFailed: 4,
          specQuestion: 5,
          autoMergeOff: 6,
          total: 21,
          roundsSum: 9,
          roundsCount: 5,
        },
      }),
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await loaded(canvasElement);
    await qualityLoaded(canvasElement);
    await expect(rowTexts(canvasElement)).toEqual([
      expect.stringContaining('Auto-merge off'),
      expect.stringContaining('Spec question'),
      expect.stringContaining('Gates failed'),
      expect.stringContaining('16+ pts below threshold'),
      expect.stringContaining('6–15 pts below threshold'),
      expect.stringContaining('1–5 pts below threshold'),
    ]);
    await expect(
      canvas.getByText('among 21 merged issues helped by a person'),
    ).toBeVisible();
    await expect(
      canvas.getByText('1.8 review rounds on average before a stop'),
    ).toBeVisible();
    await expect(figureTexts(canvasElement, 'span')).toEqual([
      'Merged without a person',
      'Spec questions',
      'Waiting for a person',
    ]);
    await expect(figureTexts(canvasElement, '[data-note]')).toEqual([
      '',
      '',
      '2 still waiting',
    ]);
    await expect(figureTexts(canvasElement, '[data-value]', QUALITY)).toEqual([
      '68%',
      '1.4',
      '+12 pts',
    ]);
  },
};

export const RoundsBelowMinimum: Story = {
  name: 'Rounds before a stop below the minimum sample, nobody waiting, at 1024 px',
  args: {
    loadAutonomy: autonomyLoaderOf(
      autonomyOf({
        waitingNow: 0,
        reasons: { ...someReasons, roundsSum: 7, roundsCount: 4 },
      }),
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await loaded(canvasElement);
    await expect(
      canvas.getByText('Not enough data for review rounds before a stop'),
    ).toBeVisible();
    await expect(figureTexts(canvasElement, '[data-value]')).toEqual([
      '75%',
      '25%',
      '4 h 03 min',
    ]);
    await expect(
      canvasElement.querySelector(
        '.fd-stats-autonomy .fd-stats-figures [data-note]',
      ),
    ).toBeNull();
  },
};

export const ScoreGainNegative: Story = {
  name: 'Score gain falling below zero, at 1024 px',
  args: {
    loadQuality: qualityLoaderOf(
      qualityOf({ current: { ...monthQuality, gainSum: -27, gainCount: 9 } }),
    ),
  },
  play: async ({ canvasElement }) => {
    await qualityLoaded(canvasElement);
    await expect(figureTexts(canvasElement, '[data-value]', QUALITY)).toEqual([
      '68%',
      '1.4',
      '−3 pts',
    ]);
    await expect(figureTexts(canvasElement, '[data-change]', QUALITY)[2]).toBe(
      '▼down 11 pts vs previous 30 days',
    );
  },
};

export const ScoreGainBelowMinimum: Story = {
  name: 'Score gain below the minimum sample, at 1024 px',
  args: {
    loadQuality: qualityLoaderOf(
      qualityOf({ current: { ...monthQuality, gainSum: 40, gainCount: 4 } }),
    ),
  },
  play: async ({ canvasElement }) => {
    await qualityLoaded(canvasElement);
    await expect(figureTexts(canvasElement, '[data-value]', QUALITY)).toEqual([
      '68%',
      '1.4',
      '—',
    ]);
    await expect(figureTexts(canvasElement, '[data-sample]', QUALITY)).toEqual([
      'n = 22 merged issues with a report',
      'n = 22 merged issues',
      'Not enough data',
    ]);
  },
};
