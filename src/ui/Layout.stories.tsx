import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { MemoryRouter, Route, Routes } from 'react-router';
import { expect, within } from 'storybook/test';
import { Layout } from './Layout.tsx';

function at(path: string): Decorator {
  return (Story) => (
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<Story />}>
          <Route index element={<p>Section content</p>} />
          <Route path="sessions" element={<p>Session list</p>} />
          <Route path="roles" element={<p>Role list</p>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

const meta = {
  component: Layout,
} satisfies Meta<typeof Layout>;

export default meta;

type Story = StoryObj<typeof meta>;

export const OverviewActive: Story = {
  decorators: [at('/')],
};

export const SessionsActive: Story = {
  decorators: [at('/sessions')],
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('link', { name: 'Sessions' }),
    ).toHaveAttribute('aria-current', 'page');
  },
};

export const RolesActive: Story = {
  decorators: [at('/roles')],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const links = canvas.getAllByRole('link');
    await expect(links.map((link) => link.textContent)).toEqual([
      'Overview',
      'Sessions',
      'Skills',
      'Roles',
    ]);
    await expect(canvas.getByRole('link', { name: 'Roles' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  },
};
