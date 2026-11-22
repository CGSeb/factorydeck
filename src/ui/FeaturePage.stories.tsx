import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { expect, userEvent, within } from 'storybook/test';
import { featureLoaderOf } from './feature-fixtures.ts';
import { FeaturePage } from './FeaturePage.tsx';

function Location(): ReactElement {
  const { pathname, search } = useLocation();
  return <output aria-label="Address">{`${pathname}${search}`}</output>;
}

function routed(fallback: string): Decorator {
  return (Story, { parameters }) => {
    const entry: unknown = parameters['entry'];
    return (
      <MemoryRouter
        initialEntries={[typeof entry === 'string' ? entry : fallback]}
      >
        <Routes>
          <Route
            path="/features/:number"
            element={
              <>
                <Story />
                <Location />
              </>
            }
          />
          <Route path="/features" element={<Location />} />
        </Routes>
      </MemoryRouter>
    );
  };
}

const meta = {
  component: FeaturePage,
  args: { loadFeature: featureLoaderOf() },
  decorators: [
    routed('/features/52?project=%2Fhome%2Fdev%2Fexample-app&period=all'),
  ],
} satisfies Meta<typeof FeaturePage>;

export default meta;

type Story = StoryObj<typeof meta>;

function address(canvasElement: HTMLElement): HTMLElement {
  return within(canvasElement).getByRole('status', { name: 'Address' });
}

export const Found: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('heading', { name: 'Issue #52' });
    await expect(
      canvas.getByRole('link', { name: '#52 Export button' }),
    ).toHaveAttribute(
      'href',
      'https://github.com/example-org/example-app/issues/52',
    );
    await expect(canvas.getByText('Outcome')).toBeVisible();
    const roles = canvas.getByRole('table', { name: 'By role' });
    await expect(
      within(roles)
        .getAllByRole('rowheader')
        .map((cell) => cell.textContent),
    ).toEqual(['builder', 'reviewer', 'Orchestration']);
    await expect(within(roles).getByText('500.0K')).toHaveAttribute(
      'title',
      '500,000',
    );
    await expect(
      canvas.getByRole('link', { name: 'Build the export button' }),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Last 7 days' }));
    await expect(address(canvasElement)).toHaveTextContent(
      '/features/52?project=%2Fhome%2Fdev%2Fexample-app&period=7d',
    );
    await canvas.findByRole('heading', { name: 'Issue #52' });
    await userEvent.click(
      canvas.getByRole('link', { name: 'Back to features' }),
    );
    await expect(address(canvasElement)).toHaveTextContent(
      '/features?period=7d&project=%2Fhome%2Fdev%2Fexample-app',
    );
  },
};

export const NotCollected: Story = {
  parameters: {
    entry: '/features/28?project=%2Fhome%2Fdev%2Fexample-lib&period=all',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('heading', { name: 'Issue #28' });
    await expect(canvas.getByText('No activity in this period.')).toBeVisible();
    await expect(
      canvas.getByText('No session worked on this issue in this period.'),
    ).toBeVisible();
  },
};

export const NotFound: Story = {
  parameters: {
    entry: '/features/404?project=%2Fhome%2Fdev%2Fexample-app&period=all',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('Issue not found.');
    await userEvent.click(
      canvas.getByRole('link', { name: 'Back to features' }),
    );
    await expect(address(canvasElement)).toHaveTextContent('/features');
  },
};

export const WithoutProject: Story = {
  parameters: { entry: '/features/52' },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('Issue not found.'),
    ).toBeVisible();
  },
};

export const DatabaseUnreachable: Story = {
  args: {
    loadFeature: () =>
      Promise.resolve({ status: 'unreachable', refreshSeconds: 3600 }),
  },
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByText(
      'Database unreachable. Start it with pnpm db:up.',
    );
  },
};
