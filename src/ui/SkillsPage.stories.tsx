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

function bodyRows(canvasElement: HTMLElement): HTMLElement[] {
  return within(canvasElement)
    .getAllByRole('row')
    .slice(1)
    .filter((row) => row.closest('tbody') !== null);
}

export const WithSkills: Story = {
  args: { loadSkills: skillsLoader(someSkills) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('link', { name: 'kit:write-spec' });
    await expect(
      canvas.getByRole('heading', { level: 1, name: 'Skills' }),
    ).toBeVisible();
    await expect(
      canvas.getByText(
        '3 skills launched 7 times · 3.0M tokens in skill sessions',
      ),
    ).toBeVisible();
    await expect(
      canvas.getByRole('group', { name: 'Period' }),
    ).toBeInTheDocument();
    const table = canvas.getByRole('table', { name: 'Skills' });
    await expect(
      within(table)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['Skill', 'Launches', 'Sessions', 'Tokens per launch', 'Tokens']);
    await expect(
      bodyRows(canvasElement).map(
        (row) => within(row).getByRole('rowheader').textContent,
      ),
    ).toEqual(['kit:write-spec', 'kit:review', 'deploy', 'No skill']);
    const first = bodyRows(canvasElement)[0];
    await expect(
      within(first ?? canvasElement)
        .getAllByRole('cell')
        .map((cell) => cell.textContent)
        .slice(0, 3),
    ).toEqual(['4', '3', '600.0K']);
    await expect(
      within(first ?? canvasElement).getByText('2.4M'),
    ).toBeVisible();
    await expect(
      canvas.getByRole('link', { name: 'kit:write-spec' }),
    ).toHaveAttribute('href', '/skills/kit%3Awrite-spec?period=all');
    const noSkill = bodyRows(canvasElement).at(-1) ?? canvasElement;
    await expect(within(noSkill).queryByRole('link')).toBeNull();
    await expect(
      within(noSkill)
        .getAllByRole('cell')
        .map((cell) => cell.textContent)
        .slice(0, 3),
    ).toEqual(['—', '—', '—']);
    await expect(within(noSkill).getByText('5.1M')).toBeVisible();
    await expect(
      noSkill.querySelector<HTMLElement>('[data-bar]')?.style.background,
    ).toBe('var(--fd-stage-ready)');
    await expect(
      first?.querySelector<HTMLElement>('[data-bar]')?.style.background,
    ).toBe('var(--fd-accent)');
    await expect(
      canvas.queryByText('No skills launched in this period.'),
    ).toBeNull();
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
    await expect(
      canvas.getByText(
        '0 skills launched 0 times · 0 tokens in skill sessions',
      ),
    ).toBeVisible();
    await waitFor(() => expect(bodyRows(canvasElement)).toHaveLength(1));
    await userEvent.click(canvas.getByRole('button', { name: 'Last 30 days' }));
    await expect(
      canvas.getByRole('status', { name: 'Address' }),
    ).toHaveTextContent('?period=30d&project=%2Fhome%2Fdev%2Fexample-lib');
  },
};

export const NoActivity: Story = {
  args: { loadSkills: skillsLoader([noSkillUsage]) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('No skills launched in this period.');
    await expect(canvas.getByText('No skill')).toBeVisible();
    await expect(canvas.getByText('5.1M')).toBeVisible();
  },
};

export const Loading: Story = {
  args: { loadSkills: () => new Promise(() => undefined) },
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByText('Loading…');
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
