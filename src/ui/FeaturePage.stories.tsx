import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { expect, userEvent, within } from 'storybook/test';
import { featureLoaderOf } from './feature-detail-fixtures.ts';
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
          <Route path="/sessions/:id" element={<Location />} />
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

function stepTitles(canvasElement: HTMLElement): (string | null)[] {
  return [...canvasElement.querySelectorAll('.fd-timeline-title')].map(
    (title) => title.textContent,
  );
}

export const MergedByPerson: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('heading', { name: '#52 Export button' });
    const issueLink = canvas.getByRole('link', { name: 'Export button' });
    await expect(issueLink).toHaveAttribute(
      'href',
      'https://github.com/example-org/example-app/issues/52',
    );
    const icon = within(issueLink).getByText('↗');
    await expect(icon).toHaveAttribute('aria-hidden', 'true');
    await expect(issueLink).toHaveAccessibleName('Export button');
    await expect(canvas.getByText('Merged by a person')).toBeVisible();
    await expect(canvas.getByText(/ · 2 sessions$/)).toBeVisible();
    await expect(
      canvas.getByRole('heading', { name: 'How it got merged' }),
    ).toBeVisible();
    await expect(stepTitles(canvasElement)).toEqual([
      'builder ×2',
      'reviewer',
      'builder',
      'reviewer',
      'Orchestration',
    ]);
    await expect(
      canvas.getByText('Share of the orchestrating sessions'),
    ).toBeVisible();
    await expect(canvas.getByText('below threshold')).toBeVisible();
    await expect(canvas.getByText('spec, agent:review')).toBeVisible();
    await expect(canvas.queryByRole('table')).toBeNull();
    await userEvent.click(
      canvas.getByRole('link', { name: 'Review #58 round 1' }),
    );
    await expect(address(canvasElement)).toHaveTextContent(
      '/sessions/6f1c2d3e-0000-4000-8000-000000000001?project=%2Fhome%2Fdev%2Fexample-app',
    );
  },
};

export const ChangePeriod: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('heading', { name: '#52 Export button' });
    await userEvent.click(canvas.getByRole('button', { name: 'Last 7 days' }));
    await expect(address(canvasElement)).toHaveTextContent(
      '/features/52?project=%2Fhome%2Fdev%2Fexample-app&period=7d',
    );
    await canvas.findByRole('heading', { name: '#52 Export button' });
    await userEvent.click(
      canvas.getByRole('link', { name: '← Example App features' }),
    );
    await expect(address(canvasElement)).toHaveTextContent(
      '/features?period=7d&project=%2Fhome%2Fdev%2Fexample-app',
    );
  },
};

export const InReview: Story = {
  parameters: {
    entry: '/features/61?project=%2Fhome%2Fdev%2Fexample-app&period=all',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('heading', { name: '#61 Keyboard shortcuts' });
    await expect(canvas.getByText('In review')).toBeVisible();
    await expect(
      canvas.getByRole('heading', { name: 'Where it stands' }),
    ).toBeVisible();
    await expect(stepTitles(canvasElement)).toEqual(['builder ×2']);
    await expect(canvas.queryByText(/^Orchestration/)).toBeNull();
  },
};

export const OrchestrationOnly: Story = {
  parameters: {
    entry: '/features/70?project=%2Fhome%2Fdev%2Fexample-app&period=all',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('heading', { name: '#70 Release notes' });
    await expect(stepTitles(canvasElement)).toEqual(['Orchestration']);
    await expect(canvas.getByText('1 session')).toBeVisible();
  },
};

export const NoActivity: Story = {
  parameters: {
    entry: '/features/71?project=%2Fhome%2Fdev%2Fexample-app&period=all',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('heading', { name: '#71 Import button' });
    await expect(canvas.getByText('No activity in this period.')).toBeVisible();
    await expect(canvas.getByText('0 sessions')).toBeVisible();
  },
};

export const NotCollected: Story = {
  parameters: {
    entry: '/features/28?project=%2Fhome%2Fdev%2Fexample-lib&period=all',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('heading', { name: '#28' });
    await expect(canvas.getByText('No activity in this period.')).toBeVisible();
  },
};

export const NotFound: Story = {
  parameters: {
    entry: '/features/404?project=%2Fhome%2Fdev%2Fexample-app&period=all',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('Issue not found.');
    await userEvent.click(canvas.getByRole('link', { name: '← Features' }));
    await expect(address(canvasElement)).toHaveTextContent(
      /^\/features\?project=%2Fhome%2Fdev%2Fexample-app$/,
    );
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

export const At1024: Story = {
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 1024 }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByRole('heading', {
      name: '#52 Export button',
    });
  },
};

export const Loading: Story = {
  args: { loadFeature: () => new Promise(() => undefined) },
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByText('Loading…');
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
