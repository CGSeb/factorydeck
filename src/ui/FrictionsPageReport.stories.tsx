import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import {
  frictionStats,
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
  COPY_AND_MARK,
  COPY_FAILED,
  COPY_REPORT,
} from './FrictionReportButton.tsx';
import { FrictionsPage } from './FrictionsPage.tsx';
import { occurrencesLoaderOf, outputLoaderOf } from './occurrence-fixtures.ts';

const REPORT = '# Friction report\n';
const MARKED = '# Friction report\n\nNew\n';
const NOW = new Date('2026-11-23T09:00:00Z');
const MARKED_AT = '2026-11-23T07:00:00Z';
const withLastReport = frictionsLoaderOf({
  ...frictionStats,
  lastReportAt: MARKED_AT,
});
const IN_APP =
  '/frictions?period=7d&project=%2Fwork%2Fapp&kind=tool-error&role=builder';

const meta = {
  component: FrictionsPage,
  args: {
    loadFrictions: frictionsLoaderOf(),
    loadOccurrences: occurrencesLoaderOf(),
    loadOutput: outputLoaderOf(),
    loadReport: fn(() => Promise.resolve(REPORT)),
    markReport: fn(() => Promise.resolve(MARKED)),
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

function markButton(canvasElement: HTMLElement): HTMLElement {
  const buttons = canvasElement.querySelectorAll<HTMLElement>(
    '.fd-friction-report-buttons button',
  );
  const mark = buttons[1];
  if (mark === undefined) throw new Error('No mark button');
  return mark;
}

function lastReport(canvasElement: HTMLElement): HTMLElement | null {
  return canvasElement.querySelector('.fd-friction-last-report');
}

export const MarkReport: Story = {
  name: 'Copying and marking the report as reported',
  args: {
    loadReport: fn(() => Promise.resolve(REPORT)),
    markReport: fn(() => Promise.resolve(MARKED)),
    writeClipboard: fn(() => Promise.resolve()),
  },
  play: async ({ canvasElement, args }) => {
    await frictionsLoaded(canvasElement);
    const mark = markButton(canvasElement);
    await expect(mark).toHaveAccessibleName(COPY_AND_MARK);
    await expect(mark).toHaveAttribute('aria-disabled', 'false');
    await expect(lastReport(canvasElement)).toBeEmptyDOMElement();
    await userEvent.click(mark);
    await waitFor(() => expect(mark).toHaveAccessibleName(COPIED));
    await expect(args.markReport).toHaveBeenCalledWith(
      expect.objectContaining({
        period: '7d',
        project: '/work/app',
        kind: 'tool-error',
        role: 'builder',
      }),
    );
    await expect(args.loadReport).not.toHaveBeenCalled();
    await expect(args.writeClipboard).toHaveBeenCalledWith(MARKED);
    await expect(lastReport(canvasElement)).toHaveTextContent(
      'Last report just now',
    );
  },
};

export const MarkClipboardFails: Story = {
  name: 'Marked as reported, then the clipboard fails',
  args: {
    markReport: fn(() => Promise.resolve(MARKED)),
    writeClipboard: fn(() => Promise.reject(new Error('Denied'))),
  },
  play: async ({ canvasElement, args }) => {
    await frictionsLoaded(canvasElement);
    const mark = markButton(canvasElement);
    await userEvent.click(mark);
    await waitFor(() => expect(mark).toHaveAccessibleName(COPY_FAILED));
    await expect(args.markReport).toHaveBeenCalledOnce();
    await expect(lastReport(canvasElement)).toHaveTextContent(
      'Last report just now',
    );
  },
};

export const MarkAllProjects: Story = {
  name: 'Copy and mark disabled under All projects',
  args: {
    loadFrictions: withLastReport,
    markReport: fn(() => Promise.resolve(MARKED)),
  },
  parameters: { entry: '/frictions?period=30d' },
  play: async ({ canvasElement, args }) => {
    await frictionsLoaded(canvasElement);
    const mark = markButton(canvasElement);
    await expect(mark).toHaveAttribute('aria-disabled', 'true');
    await expect(mark).toHaveAccessibleDescription(ALL_PROJECTS_TIP);
    await userEvent.click(mark);
    await expect(args.markReport).not.toHaveBeenCalled();
    await expect(lastReport(canvasElement)).toBeEmptyDOMElement();
  },
};

export const LastReport: Story = {
  name: 'The last report of the project',
  args: { loadFrictions: withLastReport, now: NOW },
  play: async ({ canvasElement }) => {
    await frictionsLoaded(canvasElement);
    await expect(lastReport(canvasElement)).toHaveTextContent(
      'Last report 2 h ago',
    );
  },
};

function lastReportThenPending(): LoadFrictions {
  let calls = 0;
  return (filters) => {
    calls += 1;
    return calls === 1 ? withLastReport(filters) : new Promise(() => undefined);
  };
}

export const LastReportWhileReloading: Story = {
  name: 'The last report stays while a period reloads',
  args: { loadFrictions: lastReportThenPending(), now: NOW },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await frictionsLoaded(canvasElement);
    const line = lastReport(canvasElement);
    await userEvent.click(
      within(canvas.getByRole('group', { name: 'Period' })).getByRole(
        'button',
        { name: 'Last 30 days' },
      ),
    );
    await expect(lastReport(canvasElement)).toBe(line);
    await expect(line).toHaveTextContent('Last report 2 h ago');
  },
};
