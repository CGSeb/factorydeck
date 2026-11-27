import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import {
  frictionsLoaderOf,
  noActivityStats,
  noFrictionStats,
  pendingFrictions,
} from './frictions-fixtures.ts';
import type { LoadFrictions } from './frictions-api.ts';
import { frictionsLoaded, frictionsRouter } from './frictions-story.ts';
import {
  ALL_PROJECTS_TIP,
  COPIED,
  COPY_REPORT,
} from './FrictionReportButton.tsx';
import { FrictionsPage } from './FrictionsPage.tsx';
import { occurrencesLoaderOf, outputLoaderOf } from './occurrence-fixtures.ts';

const REPORT = '# Friction report\n';
const IN_APP =
  '/frictions?period=7d&project=%2Fwork%2Fapp&kind=tool-error&role=builder';

const meta = {
  component: FrictionsPage,
  args: {
    loadFrictions: frictionsLoaderOf(),
    loadOccurrences: occurrencesLoaderOf(),
    loadOutput: outputLoaderOf(),
    loadReport: fn(() => Promise.resolve(REPORT)),
    writeClipboard: fn(() => Promise.resolve()),
  },
  parameters: { entry: IN_APP },
  decorators: [frictionsRouter],
} satisfies Meta<typeof FrictionsPage>;

export default meta;

type Story = StoryObj<typeof meta>;

function copyButton(canvasElement: HTMLElement): HTMLElement {
  return within(canvasElement).getByRole('button', {
    name: /^(Copy friction report|Copying…|Copied|Could not copy)$/,
  });
}

export const CopyReport: Story = {
  name: 'Copying the report of one project',
  play: async ({ canvasElement, args }) => {
    await frictionsLoaded(canvasElement);
    const copy = copyButton(canvasElement);
    await expect(copy).toHaveAttribute('aria-disabled', 'false');
    const controls = canvasElement.querySelector('.fd-friction-controls');
    await expect(controls?.lastElementChild).toContainElement(copy);
    await expect(controls?.firstElementChild).toContainElement(
      within(canvasElement).getByRole('group', { name: 'Kind' }),
    );
    await userEvent.click(copy);
    await waitFor(() => expect(copy).toHaveAccessibleName(COPIED));
    await expect(args.loadReport).toHaveBeenCalledWith(
      expect.objectContaining({
        period: '7d',
        project: '/work/app',
        kind: 'tool-error',
        role: 'builder',
      }),
    );
    await expect(args.writeClipboard).toHaveBeenCalledWith(REPORT);
  },
};

export const AllProjects: Story = {
  name: 'Disabled under All projects',
  args: { loadReport: fn(() => Promise.resolve(REPORT)) },
  parameters: { entry: '/frictions?period=30d' },
  play: async ({ canvasElement, args }) => {
    await frictionsLoaded(canvasElement);
    const copy = copyButton(canvasElement);
    await expect(copy).toHaveAttribute('aria-disabled', 'true');
    await expect(copy).toHaveAccessibleDescription(ALL_PROJECTS_TIP);
    await userEvent.hover(copy);
    await expect(within(canvasElement).getByRole('tooltip')).toBeVisible();
    await userEvent.click(copy);
    await expect(args.loadReport).not.toHaveBeenCalled();
  },
};

export const WhileLoading: Story = {
  name: 'Disabled while the page loads',
  args: { loadFrictions: pendingFrictions },
  play: async ({ canvasElement }) => {
    const copy = copyButton(canvasElement);
    await expect(copy).toHaveAccessibleName(COPY_REPORT);
    await expect(
      canvasElement.querySelector('.fd-friction-controls')?.lastElementChild,
    ).toContainElement(copy);
    await expect(copy).toHaveAttribute('aria-disabled', 'true');
  },
};

function firstThenPending(): LoadFrictions {
  const loaded = frictionsLoaderOf();
  let calls = 0;
  return (filters) => {
    calls += 1;
    return calls === 1 ? loaded(filters) : new Promise(() => undefined);
  };
}

export const WhileReloading: Story = {
  name: 'Disabled while a period reloads',
  args: { loadFrictions: firstThenPending() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await frictionsLoaded(canvasElement);
    const copy = copyButton(canvasElement);
    await expect(copy).toHaveAttribute('aria-disabled', 'false');
    const summary =
      canvasElement.querySelector('.fd-page-summary')?.textContent;
    await userEvent.click(
      within(canvas.getByRole('group', { name: 'Period' })).getByRole(
        'button',
        { name: 'Last 30 days' },
      ),
    );
    await expect(copyButton(canvasElement)).toBe(copy);
    await expect(copy).toHaveAttribute('aria-disabled', 'true');
    await expect(copy).toHaveAccessibleName(COPY_REPORT);
    await expect(
      canvasElement.querySelector('.fd-friction-controls')?.lastElementChild,
    ).toContainElement(copy);
    await expect(
      canvasElement.querySelector('.fd-page-summary')?.textContent,
    ).toBe(summary);
  },
};

export const AfterReload: Story = {
  name: 'Enabled again once the period has loaded',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await frictionsLoaded(canvasElement);
    await userEvent.click(
      within(canvas.getByRole('group', { name: 'Period' })).getByRole(
        'button',
        { name: 'Last 30 days' },
      ),
    );
    await waitFor(() =>
      expect(copyButton(canvasElement)).toHaveAttribute(
        'aria-disabled',
        'false',
      ),
    );
  },
};

export const NoFriction: Story = {
  name: 'Disabled with no friction',
  args: { loadFrictions: frictionsLoaderOf(noFrictionStats) },
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByText('No friction in this period.');
    await expect(copyButton(canvasElement)).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  },
};

export const NoActivity: Story = {
  name: 'Disabled with no activity',
  args: { loadFrictions: frictionsLoaderOf(noActivityStats) },
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByText('No activity in this period.');
    await expect(copyButton(canvasElement)).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  },
};
