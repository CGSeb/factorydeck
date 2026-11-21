import type { Meta, StoryObj } from '@storybook/react-vite';
import { MemoryRouter, Route, Routes } from 'react-router';
import { Layout } from './Layout.tsx';

const meta = {
  component: Layout,
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Routes>
          <Route element={<Story />}>
            <Route index element={<p>Section content</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof Layout>;

export default meta;

type Story = StoryObj<typeof meta>;

export const OverviewActive: Story = {};
