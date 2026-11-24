import type { Meta, StoryObj } from '@storybook/react-vite';
import { MemoryRouter } from 'react-router';
import { expect, userEvent, within } from 'storybook/test';
import { boardFeatures } from './feature-board-fixtures.ts';
import { APP, featureList, found } from './feature-fixtures.ts';
import type { ListGroup } from './features-list.ts';
import { IssueGroupsTable } from './IssueGroupsTable.tsx';
import {
  COLLAPSED_GROUPS_KEY,
  writeCollapsedGroups,
} from './issue-groups-state.ts';

function storedGroups(): string | null {
  try {
    return window.localStorage.getItem(COLLAPSED_GROUPS_KEY);
  } catch {
    return null;
  }
}

const meta = {
  component: IssueGroupsTable,
  args: {
    list: featureList(boardFeatures),
    filters: { period: 'all', project: undefined },
    sort: 'last',
    stage: null,
  },
  decorators: [
    (Story, { parameters }) => {
      writeCollapsedGroups(
        new Set(
          (parameters as { collapsedGroups?: ListGroup[] }).collapsedGroups,
        ),
      );
      return (
        <MemoryRouter>
          <Story />
        </MemoryRouter>
      );
    },
  ],
} satisfies Meta<typeof IssueGroupsTable>;

export default meta;

type Story = StoryObj<typeof meta>;

function cellsOf(canvasElement: HTMLElement, header: string): string[] {
  const row = within(canvasElement).getByRole('rowheader', {
    name: header,
  }).parentElement;
  if (row === null) throw new Error(`No row ${header}`);
  return within(row)
    .getAllByRole('cell')
    .map((cell) => cell.textContent);
}

export const GroupedWithTotal: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('region', { name: 'Issues' })).toBeVisible();
    await expect(
      canvas.getByRole('link', { name: 'Export button (#52)' }),
    ).toHaveAttribute(
      'href',
      '/features/52?project=%2Fhome%2Fdev%2Fexample-app&period=all',
    );
    await expect(
      canvas.getByRole('group', { name: 'Tokens by role for #61' }),
    ).toHaveTextContent('builder 60%reviewer 25%Orchestration 15%');
    await expect(cellsOf(canvasElement, 'Export button (#52)')).toEqual([
      'Example App',
      'builder 60%reviewer 25%Orchestration 15%',
      '3',
      '1',
      '86',
      expect.stringMatching(/^4\.2MCost ~\$8\.40/),
    ]);
    await expect(canvas.getByRole('cell', { name: '86' })).toHaveAttribute(
      'data-tone',
      'success',
    );
    await expect(
      canvas.getByRole('cell', { name: '70 below threshold' }),
    ).toHaveAttribute('data-tone', 'warning');
    await expect(cellsOf(canvasElement, 'Retry policy (#60)').slice(3)).toEqual(
      ['—', '—', expect.stringMatching(/^1\.9M/)],
    );
    await expect(cellsOf(canvasElement, 'No work item')).toEqual([
      '',
      '2',
      '',
      expect.stringMatching(/^900\.0K/),
    ]);
    await expect(cellsOf(canvasElement, 'Total')).toEqual([
      '',
      '26',
      '',
      expect.stringMatching(/^27\.6M/),
    ]);
  },
};

export const OneProject: Story = {
  args: {
    list: featureList(boardFeatures.filter((row) => row.project === APP)),
    filters: { period: 'all', project: APP },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.queryByRole('columnheader', { name: 'Project' }),
    ).toBeNull();
    await expect(cellsOf(canvasElement, 'Export button (#52)')).toEqual([
      'builder 60%reviewer 25%Orchestration 15%',
      '3',
      '1',
      '86',
      expect.stringMatching(/^4\.2M/),
    ]);
  },
};

export const StageSelected: Story = {
  args: { stage: 'working', sort: 'tokens' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getAllByRole('rowheader').map((cell) => cell.textContent),
    ).toEqual(['Typed errors (#58)', 'Dark mode (#57)']);
    await expect(canvas.queryByRole('rowheader', { name: 'Total' })).toBeNull();
  },
};

export const ClosedAndUnknown: Story = {
  args: {
    list: featureList(
      boardFeatures.filter((row) => [44, 70, 12].includes(row.number)),
      null,
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas
        .getAllByRole('columnheader')
        .filter((cell) => cell.getAttribute('scope') === 'colgroup')
        .map((cell) => cell.textContent),
    ).toEqual(['Closed1', 'Unknown2']);
    await expect(
      canvas.queryByRole('rowheader', { name: 'No work item' }),
    ).toBeNull();
    await expect(canvas.getByRole('rowheader', { name: '#12' })).toBeVisible();
  },
};

export const FoldGroup: Story = {
  args: { stage: 'working', sort: 'tokens' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole('button', { name: 'Working 2' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(canvas.queryAllByRole('rowheader')).toEqual([]);
    await expect(storedGroups()).toBe('["working"]');
    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(canvas.getAllByRole('rowheader')).toHaveLength(2);
    await expect(storedGroups()).toBeNull();
  },
};

export const KeptFolded: Story = {
  parameters: { collapsedGroups: ['merged', 'ready'] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas
        .getAllByRole('button', { expanded: false })
        .map((button) => button.textContent),
    ).toEqual(['Ready2', 'Merged3']);
    await expect(
      canvas.queryByRole('rowheader', { name: 'Export button (#52)' }),
    ).toBeNull();
    await expect(
      canvas.getByRole('rowheader', { name: 'Total' }),
    ).toBeVisible();
  },
};

const LONG_TITLE =
  'Explain on the overview why a feature waited for a person before it could be merged';

function issueNumberOf(header: HTMLElement): string | null {
  return header.querySelector('.fd-issue-number')?.textContent ?? null;
}

export const IssueTitleFirst: Story = {
  args: {
    list: featureList(
      [
        ...boardFeatures.filter((row) => [52, 70, 12].includes(row.number)),
        ...boardFeatures
          .filter((row) => row.number === 52)
          .map((row) => ({ ...row, ...found(APP, 75, LONG_TITLE) })),
      ],
      null,
    ),
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 360 }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const exportRow = canvas.getByRole('rowheader', {
      name: 'Export button (#52)',
    });
    await expect(exportRow).toHaveTextContent(/^Export button \(#52\)$/);
    await expect(issueNumberOf(exportRow)).toBe('(#52)');
    await expect(
      canvas.getByRole('link', { name: 'Export button (#52)' }),
    ).toHaveAttribute(
      'href',
      '/features/52?project=%2Fhome%2Fdev%2Fexample-app&period=all',
    );
    const longRow = canvas.getByRole('rowheader', {
      name: `${LONG_TITLE} (#75)`,
    });
    await expect(issueNumberOf(longRow)).toBe('(#75)');
    await expect(
      canvas.getByRole('link', { name: `${LONG_TITLE} (#75)` }),
    ).toHaveAttribute(
      'href',
      '/features/75?project=%2Fhome%2Fdev%2Fexample-app&period=all',
    );
    const notFound = canvas.getByRole('rowheader', {
      name: '#70 (not found)',
    });
    await expect(issueNumberOf(notFound)).toBe('#70');
    const notCollected = canvas.getByRole('rowheader', { name: '#12' });
    await expect(issueNumberOf(notCollected)).toBe('#12');
    await expect(
      canvas.getByRole('group', { name: 'Tokens by role for #52' }),
    ).toBeVisible();
  },
};
