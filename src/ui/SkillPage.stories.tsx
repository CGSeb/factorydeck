import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import {
  skillLoader,
  unlaunchedDetail,
  writeSpecDetail,
} from './skill-fixtures.ts';
import { SkillPage } from './SkillPage.tsx';

function Location(): ReactElement {
  const { search } = useLocation();
  return <output aria-label="Address">{search}</output>;
}

const meta = {
  component: SkillPage,
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/skills/kit%3Awrite-spec?period=all']}>
        <Routes>
          <Route
            path="/skills/:name"
            element={
              <>
                <Story />
                <Location />
              </>
            }
          />
          <Route path="/skills" element={<p>Skill list</p>} />
          <Route path="/sessions/:id" element={<p>Session page</p>} />
        </Routes>
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof SkillPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithLaunches: Story = {
  args: { loadSkill: skillLoader(writeSpecDetail) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('heading', { name: 'kit:write-spec' });
    await expect(canvas.getByText('Launches per day')).toBeVisible();
    await expect(canvas.getByText('~$0.80')).toBeVisible();
    await expect(
      canvas.getByRole('link', { name: 'Add the export button' }),
    ).toHaveAttribute('href', '/sessions/7f3a9c21-0000-4000-8000-000000000001');
    await userEvent.selectOptions(
      canvas.getByRole('combobox', { name: 'Project' }),
      '/home/dev/example-lib',
    );
    await waitFor(() =>
      expect(
        canvas.queryByRole('link', { name: 'Add the export button' }),
      ).toBeNull(),
    );
    await expect(canvas.getByRole('link', { name: 'b81e44d0' })).toBeVisible();
    await expect(
      canvas.getByRole('status', { name: 'Address' }),
    ).toHaveTextContent('?period=all&project=%2Fhome%2Fdev%2Fexample-lib');
    await userEvent.click(canvas.getByRole('link', { name: 'b81e44d0' }));
    await canvas.findByText('Session page');
  },
};

export const NotLaunchedInPeriod: Story = {
  args: { loadSkill: skillLoader(unlaunchedDetail) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('No session launched this skill in this period.');
    await userEvent.click(canvas.getByRole('link', { name: 'Back to skills' }));
    await canvas.findByText('Skill list');
  },
};

export const DatabaseUnreachable: Story = {
  args: {
    loadSkill: () =>
      Promise.resolve({ status: 'unreachable', refreshSeconds: 3600 }),
  },
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByText(
      'Database unreachable. Start it with pnpm db:up.',
    );
  },
};
