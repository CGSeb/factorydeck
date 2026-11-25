import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactElement } from 'react';
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { versionedBugLoader } from './bug-detail-fixtures.ts';
import { APP } from './feature-fixtures.ts';
import type { LoadFeature } from './features-api.ts';
import { FeaturePage } from './FeaturePage.tsx';
import { NO_FIX_TEXT } from './FixBlock.tsx';
import { ONGOING_TEXT } from './VersionBlock.tsx';

const NOW = new Date('2026-11-20T09:00:00.000Z');

const VERSIONED = `/bugs/76?project=${encodeURIComponent(APP)}&period=all`;

const LATEST_ADDRESS =
  /^\/bugs\/76\?project=%2Fhome%2Fdev%2Fexample-app&period=all$/;

function Location(): ReactElement {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output aria-label="Address">{`${pathname}${search}`}</output>
      <button
        type="button"
        onClick={() => {
          void navigate(-1);
        }}
      >
        Browser back
      </button>
    </>
  );
}

function BugPages({
  entry,
  loadFeature,
  now,
}: {
  entry: string;
  loadFeature: LoadFeature;
  now: Date | undefined;
}): ReactElement {
  return (
    <MemoryRouter initialEntries={['/', entry]} initialIndex={1}>
      <Routes>
        <Route
          path="/bugs/:number"
          element={
            <>
              <FeaturePage loadFeature={loadFeature} kind="bug" now={now} />
              <Location />
            </>
          }
        />
        <Route path="*" element={<Location />} />
      </Routes>
    </MemoryRouter>
  );
}

const meta = {
  title: 'BugPage/Versions',
  component: FeaturePage,
  args: { loadFeature: versionedBugLoader(), kind: 'bug', now: NOW },
  parameters: { entry: VERSIONED },
  render: (args, { parameters }) => {
    const entry: unknown = parameters['entry'];
    return (
      <BugPages
        entry={typeof entry === 'string' ? entry : VERSIONED}
        loadFeature={args.loadFeature}
        now={args.now}
      />
    );
  },
} satisfies Meta<typeof FeaturePage>;

export default meta;

type Story = StoryObj<typeof meta>;

function address(canvasElement: HTMLElement): HTMLElement {
  return within(canvasElement).getByRole('status', { name: 'Address' });
}

function versionBar(canvasElement: HTMLElement): HTMLElement {
  return within(canvasElement).getByRole('navigation', { name: 'Versions' });
}

function stepButton(
  canvasElement: HTMLElement,
  name: 'Previous version' | 'Next version',
): HTMLElement {
  return within(versionBar(canvasElement)).getByRole('button', { name });
}

function fixText(canvasElement: HTMLElement): string {
  return canvasElement.querySelector('.fd-fix')?.textContent ?? '';
}

function versionValue(canvasElement: HTMLElement, term: string): string {
  const block = canvasElement.querySelector<HTMLElement>('.fd-version');
  if (block === null) throw new Error('No version block');
  const dt = within(block).getByText(term, { selector: 'dt' });
  return dt.nextElementSibling?.textContent ?? '';
}

function firstTimelineItem(canvasElement: HTMLElement): string {
  return (
    canvasElement.querySelector('.fd-timeline > li:first-child')?.textContent ??
    ''
  );
}

async function heading(canvasElement: HTMLElement): Promise<HTMLElement> {
  return within(canvasElement).findByRole('heading', {
    name: 'Totals double after import (#76)',
  });
}

export const AtTheLatest: Story = {
  play: async ({ canvasElement }) => {
    await heading(canvasElement);
    await expect(versionBar(canvasElement)).toHaveTextContent('Version 3 of 3');
    await expect(stepButton(canvasElement, 'Next version')).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await expect(fixText(canvasElement)).toContain(
      'The totals read the rows before the import dedupes them.',
    );
    await expect(versionValue(canvasElement, 'Ended')).toBe(ONGOING_TEXT);
    await expect(firstTimelineItem(canvasElement)).toMatch(/^Reopened/);
  },
};

export const StepBack: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await heading(canvasElement);
    await userEvent.click(stepButton(canvasElement, 'Previous version'));
    await expect(address(canvasElement)).toHaveTextContent(
      /^\/bugs\/76\?project=%2Fhome%2Fdev%2Fexample-app&period=all&version=2$/,
    );
    await waitFor(() => expect(fixText(canvasElement)).toContain(NO_FIX_TEXT));
    await expect(versionValue(canvasElement, 'Ended')).toMatch(/^Reopened /);
    stepButton(canvasElement, 'Previous version').focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() =>
      expect(fixText(canvasElement)).toContain(
        'The import adds each row twice.',
      ),
    );
    await expect(address(canvasElement)).toHaveTextContent(/&version=1$/);
    await expect(
      canvas.getByRole('link', { name: '← Example App bugs' }),
    ).toHaveAttribute(
      'href',
      '/bugs?period=all&project=%2Fhome%2Fdev%2Fexample-app',
    );
  },
};

export const StepForwardToTheLatest: Story = {
  parameters: { entry: `${VERSIONED}&version=1` },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('Version 1 of 3');
    stepButton(canvasElement, 'Next version').focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard('{Enter}');
    await waitFor(() =>
      expect(versionBar(canvasElement)).toHaveTextContent('Version 3 of 3'),
    );
    await expect(address(canvasElement)).toHaveTextContent(LATEST_ADDRESS);
    await expect(stepButton(canvasElement, 'Next version')).toHaveFocus();
    await userEvent.click(canvas.getByRole('button', { name: 'Browser back' }));
    await waitFor(() =>
      expect(address(canvasElement)).toHaveTextContent(/^\/$/),
    );
  },
};

export const AtVersionOne: Story = {
  parameters: { entry: `${VERSIONED}&version=1` },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('Version 1 of 3');
    await expect(stepButton(canvasElement, 'Previous version')).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await expect(stepButton(canvasElement, 'Next version')).toHaveAttribute(
      'aria-disabled',
      'false',
    );
    await expect(versionValue(canvasElement, 'Started')).toMatch(/^Opened /);
    await expect(versionValue(canvasElement, 'Ended')).toMatch(/^Reopened /);
    await expect(firstTimelineItem(canvasElement)).not.toMatch(/^Reopened/);
    await userEvent.click(stepButton(canvasElement, 'Previous version'));
    await expect(address(canvasElement)).toHaveTextContent(/&version=1$/);
  },
};

export const InTheMiddle: Story = {
  parameters: { entry: `${VERSIONED}&version=2` },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('Version 2 of 3');
    for (const name of ['Previous version', 'Next version'] as const) {
      await expect(stepButton(canvasElement, name)).toHaveAttribute(
        'aria-disabled',
        'false',
      );
    }
    await expect(fixText(canvasElement)).toContain(NO_FIX_TEXT);
    await expect(firstTimelineItem(canvasElement)).toMatch(/^Reopened/);
  },
};

export const OneVersion: Story = {
  parameters: {
    entry: `/bugs/70?project=${encodeURIComponent(APP)}&period=all`,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('heading', {
      name: 'Empty state shows twice (#70)',
    });
    await expect(
      canvas.queryByRole('navigation', { name: 'Versions' }),
    ).toBeNull();
    await expect(canvasElement.querySelector('.fd-version')).toBeNull();
  },
};

export const LoadingAnotherVersion: Story = {
  args: { loadFeature: versionedBugLoader((version) => version === 2) },
  play: async ({ canvasElement }) => {
    const title = await heading(canvasElement);
    const bar = versionBar(canvasElement);
    await userEvent.click(stepButton(canvasElement, 'Previous version'));
    await expect(bar).toHaveTextContent('Version 2 of 3');
    await expect(versionBar(canvasElement)).toBe(bar);
    await expect(await heading(canvasElement)).toBe(title);
    await expect(
      canvasElement.querySelector('.fd-issue-content'),
    ).toHaveAttribute('aria-busy', 'true');
    await expect(fixText(canvasElement)).toContain(
      'The totals read the rows before the import dedupes them.',
    );
  },
};

export const VersionOutOfRange: Story = {
  parameters: { entry: `${VERSIONED}&version=9` },
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByText('Version 3 of 3');
    await expect(address(canvasElement)).toHaveTextContent(LATEST_ADDRESS);
  },
};

export const VersionNotANumber: Story = {
  parameters: { entry: `${VERSIONED}&version=two` },
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByText('Version 3 of 3');
    await expect(address(canvasElement)).toHaveTextContent(LATEST_ADDRESS);
  },
};

export const LatestVersionInTheAddress: Story = {
  parameters: { entry: `${VERSIONED}&version=3` },
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByText('Version 3 of 3');
    await waitFor(() =>
      expect(address(canvasElement)).toHaveTextContent(LATEST_ADDRESS),
    );
  },
};

export const PeriodKeepsTheVersion: Story = {
  parameters: { entry: `${VERSIONED}&version=2` },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('Version 2 of 3');
    await userEvent.click(canvas.getByRole('button', { name: 'Last 7 days' }));
    await expect(address(canvasElement)).toHaveTextContent(
      /^\/bugs\/76\?project=%2Fhome%2Fdev%2Fexample-app&period=7d&version=2$/,
    );
    await expect(versionBar(canvasElement)).toHaveTextContent('Version 2 of 3');
  },
};
