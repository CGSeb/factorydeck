import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import type { LoadFrictions } from './frictions-api.ts';
import { frictionsLoaderOf } from './frictions-fixtures.ts';
import {
  frictionsLoaded,
  frictionsRouter,
  tableHeadings,
} from './frictions-story.ts';
import { FrictionsPage } from './FrictionsPage.tsx';

const meta = {
  component: FrictionsPage,
  args: { loadFrictions: frictionsLoaderOf() },
  decorators: [frictionsRouter],
} satisfies Meta<typeof FrictionsPage>;

export default meta;

type Story = StoryObj<typeof meta>;

const ONE_COLUMN = [
  'Frictions per 100 API calls, by day',
  'By category',
  'By tool',
  'Failed commands',
  'Repeated failures',
  'Stop blocked',
  'By role',
  'Issues with the most frictions',
  'Context peaks',
];

function address(canvasElement: HTMLElement): HTMLElement {
  return within(canvasElement).getByRole('status', { name: 'Address' });
}

function roleGroup(canvasElement: HTMLElement): HTMLElement {
  return within(canvasElement).getByRole('group', { name: 'Role' });
}

async function checkOrder(canvasElement: HTMLElement): Promise<void> {
  const canvas = within(canvasElement);
  await frictionsLoaded(canvasElement);
  const blocks = [
    canvas.getByRole('heading', { level: 1, name: 'Frictions' }),
    canvas.getByRole('group', { name: 'Kind' }),
    roleGroup(canvasElement),
    ...canvas.getAllByRole('heading', { level: 2 }),
  ];
  for (const [index, block] of blocks.slice(1).entries()) {
    await expect(
      (blocks[index]?.compareDocumentPosition(block) ?? 0) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  }
  await expect(tableHeadings(canvasElement)).toEqual(ONE_COLUMN);
}

export const SelectRole: Story = {
  name: 'Selecting and clearing a role',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await frictionsLoaded(canvasElement);
    await userEvent.click(
      within(roleGroup(canvasElement)).getByRole('button', {
        name: 'builder 26',
      }),
    );
    await expect(address(canvasElement)).toHaveTextContent(
      '?period=30d&role=builder',
    );
    await canvas.findByText('26 frictions · 2.5 per 100 API calls');
    await expect(
      within(roleGroup(canvasElement)).getByRole('button', {
        name: 'builder 26',
      }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(canvas.queryByRole('table', { name: 'By role' })).toBeNull();
    await expect(
      within(canvas.getByRole('group', { name: 'Kind' }))
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['All26', 'Tool errors25', 'Stop blocked1']);
    await userEvent.click(
      within(roleGroup(canvasElement)).getByRole('button', { name: /^All/ }),
    );
    await expect(address(canvasElement)).toHaveTextContent('?period=30d');
    await expect(address(canvasElement)).not.toHaveTextContent('role');
    await canvas.findByRole('table', { name: 'By role' });
  },
};

export const RoleWithKind: Story = {
  name: 'A role with a kind',
  parameters: { entry: '/frictions?period=30d&kind=stop-blocked&role=main' },
  play: async ({ canvasElement }) => {
    await frictionsLoaded(canvasElement);
    await expect(
      within(roleGroup(canvasElement)).getByRole('button', { name: /^main/ }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(tableHeadings(canvasElement)).toEqual([
      'Frictions per 100 API calls, by day',
      'Stop blocked',
      'Issues with the most frictions',
    ]);
  },
};

export const UnknownRole: Story = {
  name: 'A role with no thread in the period',
  parameters: { entry: '/frictions?period=30d&role=nobody&role=builder' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText('No activity in this period.'),
    ).toBeVisible();
    const role = within(roleGroup(canvasElement)).getByRole('button', {
      name: 'nobody 0',
    });
    await expect(role).toHaveAttribute('aria-pressed', 'true');
    await expect(canvas.getByRole('group', { name: 'Kind' })).toBeVisible();
    await expect(tableHeadings(canvasElement)).toEqual([]);
  },
};

export const OneColumnAt1024: Story = {
  name: 'One column at 1024 px',
  decorators: [
    (Story) => (
      <div style={{ width: 1024 }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    await checkOrder(canvasElement);
  },
};

export const OneColumnAt1280: Story = {
  name: 'One column at 1280 px',
  decorators: [
    (Story) => (
      <div style={{ width: 1280 }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    await checkOrder(canvasElement);
  },
};

function firstThenPending(): LoadFrictions {
  const load = frictionsLoaderOf();
  let calls = 0;
  return (filters) => {
    calls += 1;
    return calls === 1 ? load(filters) : new Promise(() => undefined);
  };
}

export const ClearRoleKeepsPills: Story = {
  name: 'Clearing a role with no activity keeps the pills while loading',
  parameters: { entry: '/frictions?period=30d&role=nobody' },
  args: { loadFrictions: firstThenPending() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('No activity in this period.');
    await userEvent.click(
      within(roleGroup(canvasElement)).getByRole('button', { name: /^All/ }),
    );
    await expect(address(canvasElement)).toHaveTextContent('?period=30d');
    await expect(address(canvasElement)).not.toHaveTextContent('role');
    await expect(canvas.getByRole('group', { name: 'Kind' })).toBeVisible();
    await expect(
      within(roleGroup(canvasElement)).getByRole('button', {
        name: 'nobody 0',
      }),
    ).toBeVisible();
    await expect(
      within(roleGroup(canvasElement)).getByRole('button', { name: /^All/ }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(canvas.getByText('No activity in this period.')).toBeVisible();
  },
};
