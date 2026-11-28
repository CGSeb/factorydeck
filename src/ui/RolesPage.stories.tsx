import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { CATEGORY_COLORS, UNASSIGNED_COLOR } from './design/palette.ts';
import {
  CUSTOM_ORDER,
  customRoles,
  modelsLoader,
  oneModel,
  rolesLoader,
  rolesResponse,
  someModels,
  someRoles,
} from './role-fixtures.ts';
import type { LoadRoles } from './roles-api.ts';
import { RolesPage } from './RolesPage.tsx';
import { splitTokens } from './token-fixtures.ts';

function Location(): ReactElement {
  const { search } = useLocation();
  return <output aria-label="Address">{search}</output>;
}

const meta = {
  component: RolesPage,
  args: { loadOverview: modelsLoader(someModels) },
  decorators: [
    (Story, { parameters }) => (
      <MemoryRouter
        initialEntries={[
          typeof parameters['entry'] === 'string'
            ? parameters['entry']
            : '/roles?period=all',
        ]}
      >
        <Routes>
          <Route
            path="/roles"
            element={
              <>
                <Story />
                <Location />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof RolesPage>;

export default meta;

type Story = StoryObj<typeof meta>;

function rowNames(table: HTMLElement): string[] {
  return within(table)
    .getAllByRole('rowheader')
    .map((cell) => cell.textContent);
}

function segmentColor(canvasElement: HTMLElement, role: string): string {
  const segment = canvasElement.querySelector<HTMLElement>(
    `[data-segment="${role}"]`,
  );
  return segment?.style.background ?? '';
}

function hex(color: string): string {
  const parts = /^rgb\((\d+), (\d+), (\d+)\)$/.exec(color);
  if (parts === null) return color;
  return `#${parts
    .slice(1)
    .map((part) => Number(part).toString(16).padStart(2, '0'))
    .join('')}`;
}

export const DefaultRoles: Story = {
  args: { loadRoles: rolesLoader(someRoles) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const roles = await canvas.findByRole('table', { name: 'By role' });
    await expect(
      canvas.getByRole('heading', { level: 1, name: 'Roles' }),
    ).toBeVisible();
    await expect(canvas.getByText('Role rules of each project')).toBeVisible();
    await expect(
      canvas.getByRole('button', { name: 'All time', pressed: true }),
    ).toBeVisible();
    await expect(rowNames(roles)).toEqual([
      'builder',
      'main',
      'reviewer',
      'Explore',
      'unassigned',
      'Total',
    ]);
    const builder = within(roles).getByRole('row', { name: /^builder/ });
    await expect(
      within(builder)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual(['6', '320', '1.5M']);
    const total = within(roles).getByRole('row', { name: /^Total/ });
    await expect(total).toHaveTextContent('19');
    await expect(total).toHaveTextContent('662');
    await expect(hex(segmentColor(canvasElement, 'builder'))).toBe(
      CATEGORY_COLORS[0],
    );
    await expect(hex(segmentColor(canvasElement, 'reviewer'))).toBe(
      CATEGORY_COLORS[1],
    );
    await expect(
      canvas.getByRole('group', { name: 'Tokens by role' }),
    ).toHaveTextContent('builder 45%');
    const models = await canvas.findByRole('table', { name: 'By model' });
    await expect(rowNames(models)).toEqual([
      'claude-opus-example',
      'claude-sonnet-example',
    ]);
    await expect(
      canvas.getByRole('group', { name: 'Tokens by model' }),
    ).toHaveTextContent('claude-opus-example');
    await expect(hex(segmentColor(canvasElement, 'claude-opus-example'))).toBe(
      CATEGORY_COLORS[0],
    );
  },
};

export const CustomConfiguration: Story = {
  args: {
    loadRoles: rolesLoader(customRoles, CUSTOM_ORDER),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const roles = await canvas.findByRole('table', { name: 'By role' });
    await expect(rowNames(roles)).toEqual([
      'editor',
      'main',
      'writer',
      'Total',
    ]);
    await expect(hex(segmentColor(canvasElement, 'writer'))).toBe(
      CATEGORY_COLORS[0],
    );
    await expect(hex(segmentColor(canvasElement, 'editor'))).toBe(
      CATEGORY_COLORS[1],
    );
    const writer = within(roles).getByRole('row', { name: /^writer/ });
    await expect(within(writer).getAllByRole('cell')[2]).toHaveTextContent('—');
    await expect(canvas.getByText('Role rules of each project')).toBeVisible();
  },
};

const unassignedFirst = [
  ...someRoles.filter((row) => row.role !== 'unassigned'),
  {
    role: 'unassigned',
    threads: 7,
    apiCalls: 150,
    tokens: 12_000_000,
    tokenCounts: splitTokens(12_000_000),
    costUsd: 14.2,
  },
];

export const UnassignedPresent: Story = {
  args: { loadRoles: rolesLoader(unassignedFirst) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const roles = await canvas.findByRole('table', { name: 'By role' });
    await expect(rowNames(roles)[0]).toBe('unassigned');
    await expect(hex(segmentColor(canvasElement, 'unassigned'))).toBe(
      UNASSIGNED_COLOR,
    );
  },
};

export const OneModelOnly: Story = {
  args: {
    loadRoles: rolesLoader(someRoles),
    loadOverview: modelsLoader(oneModel),
  },
  play: async ({ canvasElement }) => {
    const models = await within(canvasElement).findByRole('table', {
      name: 'By model',
    });
    await expect(within(models).getAllByRole('row')).toHaveLength(2);
    await expect(models).toHaveTextContent('claude-opus-example');
  },
};

export const OneProject: Story = {
  args: { loadRoles: rolesLoader(someRoles) },
  parameters: {
    entry: '/roles?period=all&project=%2Fhome%2Fdev%2Fexample-lib',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const roles = await canvas.findByRole('table', { name: 'By role' });
    await waitFor(() => expect(rowNames(roles)).toEqual(['main', 'Total']));
    await userEvent.click(canvas.getByRole('button', { name: 'Last 30 days' }));
    await expect(
      canvas.getByRole('status', { name: 'Address' }),
    ).toHaveTextContent('?period=30d&project=%2Fhome%2Fdev%2Fexample-lib');
  },
};

export const NoActivity: Story = {
  args: { loadRoles: rolesLoader([]), loadOverview: modelsLoader([]) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('No activity in this period.');
    await expect(canvas.queryByRole('table')).toBeNull();
    await expect(
      canvas.queryByRole('group', { name: 'Tokens by role' }),
    ).toBeNull();
  },
};

export const Loading: Story = {
  args: {
    loadRoles: () => new Promise(() => undefined),
    loadOverview: () => new Promise(() => undefined),
  },
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByText('Loading…');
  },
};

export const DatabaseUnreachable: Story = {
  args: {
    loadRoles: () =>
      Promise.resolve({ status: 'unreachable', refreshSeconds: 3600 }),
    loadOverview: () =>
      Promise.resolve({ status: 'unreachable', refreshSeconds: 3600 }),
  },
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByText(
      'Database unreachable. Start it with pnpm db:up.',
    );
  },
};

function refreshingLoader(): LoadRoles {
  let calls = 0;
  return () => {
    calls += 1;
    const tokens = calls === 1 ? 8_400_000 : 9_600_000;
    const main = {
      role: 'main',
      threads: 4,
      apiCalls: 210,
      tokens,
      tokenCounts: splitTokens(tokens),
      costUsd: 12.4,
    };
    return Promise.resolve({
      ...rolesResponse([main]),
      refreshSeconds: 0.2,
    });
  };
}

export const RefreshesWithoutReload: Story = {
  args: { loadRoles: refreshingLoader() },
  play: async ({ canvasElement }) => {
    const roles = await within(canvasElement).findByRole('table', {
      name: 'By role',
    });
    await waitFor(() => expect(roles).toHaveTextContent('2.1M'));
    await waitFor(() => expect(roles).toHaveTextContent('2.4M'));
  },
};
