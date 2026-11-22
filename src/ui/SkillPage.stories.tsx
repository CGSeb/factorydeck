import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { expect, userEvent, within } from 'storybook/test';
import {
  skillLoader,
  todayDetail,
  unlaunchedDetail,
  weekDetail,
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
    (Story, { parameters }) => (
      <MemoryRouter
        initialEntries={[
          typeof parameters['entry'] === 'string'
            ? parameters['entry']
            : '/skills/kit%3Awrite-spec?period=all',
        ]}
      >
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
          <Route
            path="/sessions/:id"
            element={
              <>
                <p>Session page</p>
                <Location />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof SkillPage>;

export default meta;

type Story = StoryObj<typeof meta>;

function figures(canvasElement: HTMLElement): string[] {
  return [...canvasElement.querySelectorAll('.fd-skill-figures > div')].map(
    (figure) =>
      `${figure.querySelector('dt')?.textContent ?? ''}: ${
        figure.querySelector('dd [tabindex]')?.textContent ??
        figure.querySelector('dd')?.textContent ??
        ''
      }`,
  );
}

function columnValues(canvasElement: HTMLElement, name: string): string[] {
  return [
    ...within(canvasElement)
      .getByRole('img', { name })
      .querySelectorAll('[data-value]'),
  ].map((value) => value.textContent);
}

export const SevenDays: Story = {
  name: '7 days of launches',
  args: { loadSkill: skillLoader(weekDetail) },
  parameters: { entry: '/skills/kit%3Awrite-spec?period=7d' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('heading', { level: 1, name: 'kit:write-spec' });
    await expect(
      canvas.getByRole('link', { name: '← Skills' }),
    ).toHaveAttribute('href', '/skills?period=7d');
    await expect(
      canvas.getByRole('button', { name: 'Last 7 days' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(figures(canvasElement)).toEqual([
      'Launches: 15',
      'Tokens: 6.0M',
      'Per launch: 400.0K',
    ]);
    await expect(
      canvas.getByRole('heading', { name: 'Launches per day' }),
    ).toBeVisible();
    await expect(columnValues(canvasElement, 'Launches per day')).toEqual([
      '2',
      '0',
      '5',
      '1',
      '3',
      '0',
      '4',
    ]);
    const sessions = canvas.getByRole('table', {
      name: 'Sessions that launched it',
    });
    await expect(
      within(sessions)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['Session', 'Project', 'Launches', 'Tokens']);
    await expect(
      within(sessions)
        .getAllByRole('rowheader')
        .map((cell) => cell.textContent),
    ).toEqual(['Add the export button', 'b81e44d0']);
    await expect(
      canvas.getByRole('link', { name: 'Add the export button' }),
    ).toHaveAttribute('href', '/sessions/7f3a9c21-0000-4000-8000-000000000001');
    await expect(within(sessions).getByText('Example App')).toBeVisible();
  },
};

export const TodayByHour: Story = {
  name: 'Today by hour',
  args: { loadSkill: skillLoader(todayDetail) },
  parameters: { entry: '/skills/kit%3Awrite-spec?period=today' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('heading', { name: 'Launches per hour' });
    await expect(canvas.queryByText('Launches per day')).toBeNull();
    await expect(columnValues(canvasElement, 'Launches per hour')).toHaveLength(
      12,
    );
    await expect(
      canvas.getByRole('row', { name: '09:00 2' }),
    ).toBeInTheDocument();
  },
};

export const OneProject: Story = {
  args: { loadSkill: skillLoader(writeSpecDetail) },
  parameters: {
    entry:
      '/skills/kit%3Awrite-spec?period=all&project=%2Fhome%2Fdev%2Fexample-lib',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('link', { name: 'b81e44d0' });
    await expect(
      canvas.queryByRole('link', { name: 'Add the export button' }),
    ).toBeNull();
    await expect(
      canvas.queryByRole('columnheader', { name: 'Project' }),
    ).toBeNull();
    await expect(
      canvas.getByRole('link', { name: '← Skills' }),
    ).toHaveAttribute(
      'href',
      '/skills?period=all&project=%2Fhome%2Fdev%2Fexample-lib',
    );
    await userEvent.click(canvas.getByRole('link', { name: 'b81e44d0' }));
    await canvas.findByText('Session page');
    await expect(
      canvas.getByRole('status', { name: 'Address' }),
    ).toHaveTextContent('?project=%2Fhome%2Fdev%2Fexample-lib');
  },
};

export const NoLaunch: Story = {
  args: { loadSkill: skillLoader(unlaunchedDetail) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('No session launched this skill in this period.');
    await expect(figures(canvasElement)).toEqual([
      'Launches: 0',
      'Tokens: 0',
      'Per launch: —',
    ]);
    await userEvent.click(canvas.getByRole('link', { name: '← Skills' }));
    await canvas.findByText('Skill list');
  },
};

export const Loading: Story = {
  args: { loadSkill: () => new Promise(() => undefined) },
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByText('Loading…');
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
