import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { noSkillUsage, skillsLoader, someSkills } from './skill-fixtures.ts';
import { SkillsPage } from './SkillsPage.tsx';

function Location(): ReactElement {
  const { search } = useLocation();
  return <output aria-label="Address">{search}</output>;
}

const meta = {
  component: SkillsPage,
  decorators: [
    (Story, { parameters }) => (
      <MemoryRouter
        initialEntries={[
          typeof parameters['entry'] === 'string'
            ? parameters['entry']
            : '/skills?period=all',
        ]}
      >
        <Routes>
          <Route
            path="/skills"
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
} satisfies Meta<typeof SkillsPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithSkills: Story = {
  args: { loadSkills: skillsLoader(someSkills) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('link', { name: 'kit:write-spec' });
    await expect(canvas.getAllByRole('row')).toHaveLength(5);
    await expect(
      canvas.queryByText('No skills launched in this period.'),
    ).toBeNull();
    await expect(canvas.queryByRole('combobox')).toBeNull();
  },
};

export const OneProject: Story = {
  args: { loadSkills: skillsLoader(someSkills) },
  parameters: {
    entry: '/skills?period=all&project=%2Fhome%2Fdev%2Fexample-lib',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('No skills launched in this period.');
    await waitFor(() => expect(canvas.getAllByRole('row')).toHaveLength(2));
    await expect(canvas.queryByRole('combobox')).toBeNull();
    await userEvent.click(canvas.getByRole('button', { name: 'Last 30 days' }));
    await expect(
      canvas.getByRole('status', { name: 'Address' }),
    ).toHaveTextContent('?period=30d&project=%2Fhome%2Fdev%2Fexample-lib');
  },
};

export const NoneLaunched: Story = {
  args: { loadSkills: skillsLoader([noSkillUsage]) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('No skills launched in this period.');
    await expect(canvas.getByText('No skill')).toBeVisible();
    await expect(canvas.getByText('~$6.10')).toBeVisible();
  },
};

export const DatabaseUnreachable: Story = {
  args: {
    loadSkills: () =>
      Promise.resolve({ status: 'unreachable', refreshSeconds: 3600 }),
  },
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByText(
      'Database unreachable. Start it with pnpm db:up.',
    );
  },
};
