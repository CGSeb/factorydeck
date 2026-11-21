import type { Meta, StoryObj } from '@storybook/react-vite';
import { MemoryRouter } from 'react-router';
import { expect, userEvent, within } from 'storybook/test';
import { App } from './App.tsx';
import { fixedLoader, okResponse, weekOverview } from './fixtures.ts';
import {
  detailLoader,
  detailResponse,
  listLoader,
  sessionWithSubAgents,
  someSessions,
} from './session-fixtures.ts';
import {
  skillLoader,
  skillsLoader,
  someSkills,
  writeSpecDetail,
} from './skill-fixtures.ts';

const meta = {
  component: App,
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/']}>
        <Story />
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof App>;

export default meta;

type Story = StoryObj<typeof meta>;

const loaders = {
  loadOverview: fixedLoader(() => okResponse(weekOverview)),
  loadSessions: listLoader(someSessions),
  loadSession: detailLoader(detailResponse(sessionWithSubAgents)),
  loadSkills: skillsLoader(someSkills),
  loadSkill: skillLoader(writeSpecDetail),
};

export const Home: Story = {
  args: loaders,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('link', { name: 'Overview' }),
    ).toHaveAttribute('aria-current', 'page');
    await canvas.findByText('~$48.27');
    await expect(
      canvas.getByRole('button', { name: 'Last 7 days' }),
    ).toHaveAttribute('aria-pressed', 'true');
  },
};

export const Sessions: Story = {
  args: loaders,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('link', { name: 'Sessions' }));
    await expect(
      canvas.getByRole('link', { name: 'Sessions' }),
    ).toHaveAttribute('aria-current', 'page');
    await canvas.findByText('1 working · 1 waiting for you · 1 inactive');
    await userEvent.click(
      canvas.getByRole('link', { name: 'Add the export button' }),
    );
    await canvas.findByRole('heading', { name: 'Add the export button' });
    await expect(canvas.getByText('Find the export code')).toBeVisible();
  },
};

export const Skills: Story = {
  args: loaders,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('link', { name: 'Skills' }));
    await expect(canvas.getByRole('link', { name: 'Skills' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await userEvent.click(
      await canvas.findByRole('link', { name: 'kit:write-spec' }),
    );
    await canvas.findByRole('heading', { name: 'kit:write-spec' });
    await expect(canvas.getByText('Launches per day')).toBeVisible();
  },
};
