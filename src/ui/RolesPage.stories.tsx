import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { NO_CONFIG_FILE, rolesLoader, someRoles } from './role-fixtures.ts';
import { RolesPage } from './RolesPage.tsx';

function Location(): ReactElement {
  const { search } = useLocation();
  return <output aria-label="Address">{search}</output>;
}

const meta = {
  component: RolesPage,
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/roles?period=all']}>
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

export const WithRoles: Story = {
  args: { loadRoles: rolesLoader(someRoles) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('rowheader', { name: 'builder' });
    await expect(
      canvas.getByText('Rules from /home/dev/factorydeck/factorydeck.yml'),
    ).toBeVisible();
    await expect(canvas.getAllByRole('row')).toHaveLength(6);
    await userEvent.selectOptions(
      canvas.getByRole('combobox', { name: 'Project' }),
      '/home/dev/example-lib',
    );
    await waitFor(() => expect(canvas.getAllByRole('row')).toHaveLength(2));
    await userEvent.click(canvas.getByRole('button', { name: 'Last 30 days' }));
    await expect(
      canvas.getByRole('status', { name: 'Address' }),
    ).toHaveTextContent('?period=30d&project=%2Fhome%2Fdev%2Fexample-lib');
  },
};

export const WithoutConfigFile: Story = {
  args: { loadRoles: rolesLoader(someRoles, NO_CONFIG_FILE) },
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByText(
      'No configuration file at /home/dev/factorydeck/factorydeck.yml: sub-agents are grouped by type.',
    );
  },
};

export const NoActivity: Story = {
  args: { loadRoles: rolesLoader([]) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('No activity in this period.');
    await expect(canvas.queryByRole('table')).toBeNull();
  },
};

export const DatabaseUnreachable: Story = {
  args: {
    loadRoles: () =>
      Promise.resolve({ status: 'unreachable', refreshSeconds: 3600 }),
  },
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByText(
      'Database unreachable. Start it with pnpm db:up.',
    );
  },
};
