import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { surfaceFrame } from './components/story-frame.ts';
import { formatDateTime } from './format.ts';
import { LATEST_OCCURRENCES } from './FrictionOccurrences.tsx';
import { frictionStats } from './frictions-fixtures.ts';
import { tablesRouter } from './frictions-story.ts';
import { FrictionTables } from './FrictionTables.tsx';
import {
  LONG_ERROR,
  errorOccurrences,
  occurrencesLoaderOf,
  offlineOccurrences,
  outputLoaderOf,
  pendingOccurrences,
  toolOccurrences,
  unreachableOccurrences,
} from './occurrence-fixtures.ts';
import {
  LOG_GONE,
  REMOTE_DETAILS,
  fullOutputLabel,
} from './OccurrenceTexts.tsx';
import type { OccurrenceRequest } from './occurrences-api.ts';
import { UNREACHABLE_MESSAGE } from './overview-api.ts';

const requests: OccurrenceRequest[] = [];

const meta = {
  title: 'Frictions/FrictionOccurrences',
  component: FrictionTables,
  decorators: [surfaceFrame, tablesRouter],
  args: {
    stats: frictionStats,
    kind: undefined,
    scope: { project: '/work/app', period: '30d' },
    filters: {
      period: '30d',
      project: '/work/app',
      kind: undefined,
      role: 'builder',
    },
    loadOccurrences: (request) => {
      requests.push(request);
      return occurrencesLoaderOf()(request);
    },
    loadOutput: outputLoaderOf(),
  },
} satisfies Meta<typeof FrictionTables>;

export default meta;

type Story = StoryObj<typeof meta>;

function toggle(canvasElement: HTMLElement, label: string): HTMLElement {
  return within(canvasElement).getByRole('button', {
    name: `Show occurrences of ${label}`,
  });
}

async function openGit(canvasElement: HTMLElement): Promise<HTMLElement> {
  const table = within(canvasElement).getByRole('table', {
    name: 'Failed commands',
  });
  await userEvent.click(toggle(table, 'git'));
  await within(table).findByRole('heading', { name: LATEST_OCCURRENCES });
  return table;
}

function width(size: number): NonNullable<Story['decorators']> {
  return [
    (Story) => (
      <div style={{ maxWidth: size }}>
        <Story />
      </div>
    ),
  ];
}

const openRow: Story['play'] = async ({ canvasElement }) => {
  requests.length = 0;
  const table = await openGit(canvasElement);
  await expect(requests).toEqual([
    {
      filters: {
        period: '30d',
        project: '/work/app',
        kind: undefined,
        role: 'builder',
      },
      table: 'command',
      row: 'git',
    },
  ]);
  const rows = within(table).getAllByRole('row');
  const inserted = rows[3];
  await expect(inserted?.querySelector('td')).toHaveAttribute('colspan', '4');
  const items = within(table).getAllByRole('listitem');
  await expect(items).toHaveLength(3);
  const [first, second, third] = items;
  await expect(first).toHaveTextContent(
    formatDateTime(toolOccurrences[0]?.at ?? ''),
  );
  await expect(
    within(first ?? table).getByRole('link', { name: '#41' }),
  ).toHaveAttribute('href', '/features/41?project=%2Fwork%2Fapp&period=30d');
  await expect(
    within(first ?? table).getByRole('link', {
      name: 'Build the frictions page',
    }),
  ).toBeVisible();
  await expect(
    within(first ?? table).getByText(
      'cd ~/work/app && git push origin feat/41-frictions',
    ),
  ).toBeVisible();
  await expect(within(second ?? table).getByText(LONG_ERROR)).toBeVisible();
  await expect(third).toHaveTextContent('—');
  await expect(
    within(third ?? table).getByRole('link', { name: '0a1b2c3d' }),
  ).toBeVisible();
  await expect(within(third ?? table).getByText(LOG_GONE)).toBeVisible();
};

export const RowOpen: Story = {
  name: 'A row open',
  decorators: width(1024),
  globals: { theme: 'light' },
  play: openRow,
};

export const RowOpenDark: Story = {
  ...RowOpen,
  name: 'A row open, dark',
  globals: { theme: 'dark' },
};

export const RowOpenNarrow: Story = {
  name: 'A row open at 360 px',
  decorators: width(360),
  globals: { theme: 'light' },
  play: openRow,
};

export const RowOpenNarrowDark: Story = {
  ...RowOpenNarrow,
  name: 'A row open at 360 px, dark',
  globals: { theme: 'dark' },
};

export const LogGone: Story = {
  name: 'An occurrence whose log is gone',
  args: {
    loadOccurrences: occurrencesLoaderOf(
      toolOccurrences.map((item) => ({
        ...item,
        details: 'gone' as const,
        texts: null,
      })),
    ),
  },
  play: async ({ canvasElement }) => {
    const table = await openGit(canvasElement);
    await expect(within(table).getAllByText(LOG_GONE)).toHaveLength(3);
  },
};

export const SentByCli: Story = {
  name: 'An occurrence sent by a CLI',
  args: {
    loadOccurrences: occurrencesLoaderOf(
      toolOccurrences.map((item) => ({
        ...item,
        details: 'remote' as const,
        hasMore: false,
        texts: null,
      })),
    ),
  },
  play: async ({ canvasElement }) => {
    const table = await openGit(canvasElement);
    await expect(within(table).getAllByText(REMOTE_DETAILS)).toHaveLength(3);
    await expect(within(table).getByText('Exit code 128')).toBeVisible();
    await expect(within(table).queryByText(LOG_GONE)).toBeNull();
    await expect(
      within(table).queryByRole('button', { name: /Show full output/ }),
    ).toBeNull();
  },
};

export const Loading: Story = {
  name: 'Occurrences loading',
  args: { loadOccurrences: pendingOccurrences },
  play: async ({ canvasElement }) => {
    const table = await openGit(canvasElement);
    await expect(within(table).getByText('Loading…')).toBeVisible();
  },
};

export const Unreachable: Story = {
  name: 'Occurrences unreachable',
  args: { loadOccurrences: unreachableOccurrences },
  play: async ({ canvasElement }) => {
    const table = await openGit(canvasElement);
    await expect(
      await within(table).findByText(UNREACHABLE_MESSAGE),
    ).toBeVisible();
  },
};

export const Offline: Story = {
  name: 'Occurrences when the API does not answer',
  args: { loadOccurrences: offlineOccurrences },
  play: async ({ canvasElement }) => {
    const table = await openGit(canvasElement);
    await expect(
      await within(table).findByText(UNREACHABLE_MESSAGE),
    ).toBeVisible();
  },
};

export const Keyboard: Story = {
  name: 'Open and close rows with the keyboard',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const git = toggle(
      canvas.getByRole('table', { name: 'Failed commands' }),
      'git',
    );
    await expect(git).toHaveAttribute('aria-expanded', 'false');
    git.focus();
    await userEvent.keyboard('{Enter}');
    await expect(git).toHaveAttribute('aria-expanded', 'true');
    const panel = document.getElementById(
      git.getAttribute('aria-controls') ?? '',
    );
    await expect(panel).not.toBeNull();
    await expect(
      await within(panel ?? canvasElement).findByRole('heading', {
        name: LATEST_OCCURRENCES,
      }),
    ).toBeVisible();
    const category = toggle(canvasElement, 'Command failed');
    category.focus();
    await userEvent.keyboard(' ');
    await expect(category).toHaveAttribute('aria-expanded', 'true');
    await expect(
      await canvas.findAllByRole('heading', { name: LATEST_OCCURRENCES }),
    ).toHaveLength(2);
    git.focus();
    await userEvent.keyboard('{Enter}');
    await expect(git).toHaveAttribute('aria-expanded', 'false');
    await expect(git).not.toHaveAttribute('aria-controls');
    await expect(
      canvas.getAllByRole('heading', { name: LATEST_OCCURRENCES }),
    ).toHaveLength(1);
  },
};

export const EveryTable: Story = {
  name: 'A disclosure on every table',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const [table, label] of [
      ['By category', 'Permission denied'],
      ['By tool', 'Bash'],
      ['Failed commands', 'no program'],
      ['Repeated failures', 'pnpm'],
    ] as const) {
      await expect(
        toggle(canvas.getByRole('table', { name: table }), label),
      ).toBeVisible();
    }
    const hooks = canvas.getByRole('table', { name: 'Stop blocked' });
    const [hook] = within(hooks).getAllByRole('button');
    await userEvent.click(hook ?? hooks);
    await expect(
      await within(hooks).findByText(/pnpm check failed: 2 type errors/),
    ).toBeVisible();
  },
};

const SHELL_AT = errorOccurrences[0]?.at ?? '';
const READ_AT = errorOccurrences[2]?.at ?? '';

function moreButton(canvasElement: HTMLElement, at: string): HTMLElement {
  return within(canvasElement).getByRole('button', {
    name: fullOutputLabel(false, at),
  });
}

function outputs(table: HTMLElement): HTMLElement[] {
  return within(table).queryAllByRole('region', { name: /^Full output of/ });
}

async function press(button: HTMLElement, key: string): Promise<void> {
  button.focus();
  await userEvent.keyboard(key);
}

export const OutputsInRow: Story = {
  name: 'Several full outputs open, closed with the row',
  args: { loadOccurrences: occurrencesLoaderOf(errorOccurrences) },
  decorators: width(360),
  play: async ({ canvasElement }) => {
    const table = await openGit(canvasElement);
    const shell = moreButton(table, SHELL_AT);
    await press(shell, '{Enter}');
    await press(moreButton(table, READ_AT), ' ');
    await expect(shell).toHaveAttribute('aria-expanded', 'true');
    await expect(outputs(table)).toHaveLength(2);
    await press(toggle(table, 'git'), '{Enter}');
    await press(toggle(table, 'git'), '{Enter}');
    await within(table).findByRole('heading', { name: LATEST_OCCURRENCES });
    await expect(moreButton(table, SHELL_AT)).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    await expect(outputs(table)).toHaveLength(0);
  },
};
