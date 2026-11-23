import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { BUILD_SESSION } from './friction-breakdown-fixtures.ts';
import { UNKNOWN_SESSION, filteredFrictions } from './frictions-fixtures.ts';
import {
  columnTexts,
  frictionsLoaded,
  frictionsRouter,
  tableHeadings,
} from './frictions-story.ts';
import { FrictionsPage } from './FrictionsPage.tsx';

const meta = {
  component: FrictionsPage,
  args: { loadFrictions: filteredFrictions },
  decorators: [frictionsRouter],
} satisfies Meta<typeof FrictionsPage>;

export default meta;

type Story = StoryObj<typeof meta>;

function address(canvasElement: HTMLElement): HTMLElement {
  return within(canvasElement).getByRole('status', { name: 'Address' });
}

async function checkRoles(canvasElement: HTMLElement): Promise<void> {
  const canvas = within(canvasElement);
  const roles = canvas.getByRole('table', { name: 'By role' });
  await expect(columnTexts(roles, 0)).toEqual([
    'builder',
    'reviewer',
    'main',
    'unassigned',
    'shipper',
  ]);
  await expect(columnTexts(roles, 3)).toEqual([
    '4.3',
    '2.3',
    '1.6',
    '1.0',
    '0.0',
  ]);
  await expect(columnTexts(roles, 4)).toEqual([
    'Tool errors',
    'Tool errors',
    'Stop blocked',
    'Tool errors',
    '—',
  ]);
}

async function checkIssues(canvasElement: HTMLElement): Promise<void> {
  const canvas = within(canvasElement);
  const issues = canvas.getByRole('table', {
    name: 'Issues with the most frictions',
  });
  await expect(columnTexts(issues, 0).slice(0, 4)).toEqual([
    '#41 Frictions page',
    '#40 Read Codex sessions next to Claude Code sessions, with their own sub-agents and models',
    '#39 (not found)',
    '#38',
  ]);
  await expect(columnTexts(issues, 2).slice(0, 4)).toEqual([
    'Working',
    'In review',
    '—',
    '—',
  ]);
  await expect(
    within(issues).getByRole('link', { name: '#41 Frictions page' }),
  ).toHaveAttribute('href', '/features/41?project=%2Fwork%2Fapp&period=30d');
  await expect(columnTexts(issues, 0)).toHaveLength(10);
  const panel = issues.closest('section') ?? canvasElement;
  await userEvent.click(
    within(panel).getByRole('button', { name: 'Show more' }),
  );
  await expect(columnTexts(issues, 0)).toHaveLength(12);
}

async function checkPeaks(canvasElement: HTMLElement): Promise<void> {
  const canvas = within(canvasElement);
  const peaks = canvas.getByRole('region', { name: 'Context peaks' });
  await expect(within(peaks).getByText('131.3K')).toBeVisible();
  await expect(within(peaks).getByText('n = 8 threads')).toBeVisible();
  await expect(within(peaks).getByText(/vs previous 30 days/)).toBeVisible();
  await expect(
    within(peaks).getByText('3 of 8 threads compacted'),
  ).toBeVisible();
  await expect(
    within(peaks).getByRole('link', { name: 'Build #41, 182K' }),
  ).toHaveAttribute('href', `/sessions/${BUILD_SESSION}?period=30d`);
  await expect(
    within(peaks).getByRole('link', {
      name: 'Build the frictions page, 142K',
    }),
  ).toBeVisible();
  await expect(
    within(peaks).getByRole('link', { name: 'session-, 38K' }),
  ).toBeVisible();
}

export const NewBlocks: Story = {
  name: 'By role, issues and context peaks',
  play: async ({ canvasElement }) => {
    await frictionsLoaded(canvasElement);
    await expect(tableHeadings(canvasElement).slice(-3)).toEqual([
      'By role',
      'Issues with the most frictions',
      'Context peaks',
    ]);
    await checkRoles(canvasElement);
    await checkIssues(canvasElement);
    await checkPeaks(canvasElement);
  },
};

export const OneProject: Story = {
  name: 'Issues of one project, without the project column',
  parameters: { entry: '/frictions?period=7d&project=%2Fwork%2Fapp' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await frictionsLoaded(canvasElement);
    const issues = canvas.getByRole('table', {
      name: 'Issues with the most frictions',
    });
    await expect(
      within(issues)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['Issue', 'Stage', 'Frictions', 'Repeated failures']);
  },
};

export const StopBlockedHidesPeaks: Story = {
  name: 'Context peaks left out for another kind',
  parameters: { entry: '/frictions?period=7d&kind=tool-error' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('table', { name: 'By role' });
    await expect(
      canvas.queryByRole('region', { name: 'Context peaks' }),
    ).toBeNull();
  },
};

export const SessionFilter: Story = {
  name: 'Filtered on a session',
  parameters: {
    entry: `/frictions?period=all&project=%2Fwork%2Fapp&session=${BUILD_SESSION}&kind=stop-blocked`,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const chip = await canvas.findByText('Session: Build the frictions page');
    await expect(
      canvas
        .getByRole('group', { name: 'Role' })
        .compareDocumentPosition(chip) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    await expect(
      chip.compareDocumentPosition(
        canvas.getByRole('heading', { name: /^Frictions per 100 API calls/ }),
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    await expect(canvas.getByRole('table', { name: 'By role' })).toBeVisible();
    await expect(
      canvas.getByRole('table', { name: 'Issues with the most frictions' }),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole('button', { name: 'Remove filter' }),
    );
    await expect(address(canvasElement)).toHaveTextContent(
      '?period=all&project=%2Fwork%2Fapp&kind=stop-blocked',
    );
    await expect(canvas.queryByText(/^Session:/)).toBeNull();
  },
};

export const IssueFilter: Story = {
  name: 'Filtered on an issue',
  parameters: {
    entry: '/frictions?period=30d&project=%2Fwork%2Fapp&issue=41',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('Issue: #41 Frictions page');
    await expect(canvas.getByRole('table', { name: 'By role' })).toBeVisible();
    await expect(
      canvas.queryByRole('table', { name: 'Issues with the most frictions' }),
    ).toBeNull();
    await userEvent.click(
      canvas.getByRole('button', { name: 'Remove filter' }),
    );
    await expect(address(canvasElement)).toHaveTextContent(
      '?period=30d&project=%2Fwork%2Fapp',
    );
    await expect(address(canvasElement)).not.toHaveTextContent('issue');
    await expect(canvas.queryByText(/^Issue:/)).toBeNull();
  },
};

export const IssueWithoutProject: Story = {
  name: 'An issue without a project is ignored',
  parameters: { entry: '/frictions?period=30d&issue=41' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await frictionsLoaded(canvasElement);
    await expect(canvas.queryByText(/^Issue:/)).toBeNull();
    await expect(
      canvas.queryByRole('button', { name: 'Remove filter' }),
    ).toBeNull();
  },
};

export const UnknownSession: Story = {
  name: 'An unknown session',
  parameters: {
    entry: `/frictions?period=7d&session=${UNKNOWN_SESSION}`,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText('No activity in this period.'),
    ).toBeVisible();
    await expect(canvas.getByText(`Session: ${UNKNOWN_SESSION}`)).toBeVisible();
    await expect(
      canvas.getByRole('button', { name: 'Remove filter' }),
    ).toBeVisible();
  },
};
