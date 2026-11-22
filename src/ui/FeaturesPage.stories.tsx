import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import {
  APP,
  featureList,
  featuresLoaderOf,
  featuresResponse,
  someFeatures,
} from './feature-fixtures.ts';
import type { LoadFeatures } from './features-api.ts';
import { FeaturesPage } from './FeaturesPage.tsx';

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
            path="/features"
            element={
              <>
                <Story />
                <Location />
              </>
            }
          />
          <Route path="/features/:number" element={<Location />} />
        </Routes>
      </MemoryRouter>
    );
  };
}

const meta = {
  component: FeaturesPage,
  args: { loadFeatures: featuresLoaderOf(someFeatures) },
  decorators: [routed('/features?period=all')],
} satisfies Meta<typeof FeaturesPage>;

export default meta;

type Story = StoryObj<typeof meta>;

function address(canvasElement: HTMLElement): HTMLElement {
  return within(canvasElement).getByRole('status', { name: 'Address' });
}

function rowHeaders(canvasElement: HTMLElement): string[] {
  return within(canvasElement)
    .getAllByRole('rowheader')
    .map((cell) => cell.textContent);
}

export const AllProjects: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('rowheader', { name: '#52 Export button' });
    await expect(canvas.getByRole('heading', { name: 'Cost' })).toBeVisible();
    await expect(
      canvas.getByRole('columnheader', { name: 'Project' }),
    ).toBeVisible();
    await expect(
      canvas.getByText('example-lib', { selector: 'span' }),
    ).toHaveAttribute('title', '/home/dev/example-lib');
    await expect(
      canvas.getAllByText('Example App', { selector: 'span' })[0],
    ).toHaveAttribute('title', '/home/dev/example-app');
    await userEvent.click(canvas.getByRole('button', { name: 'Tokens' }));
    await expect(address(canvasElement)).toHaveTextContent(
      '/features?period=all&sort=tokens&order=asc',
    );
    await expect(rowHeaders(canvasElement).slice(0, 2)).toEqual([
      '#99 (not found)',
      '#40 Dark mode',
    ]);
    await userEvent.click(canvas.getByRole('button', { name: 'Tokens' }));
    await expect(address(canvasElement)).toHaveTextContent(
      '/features?period=all&sort=tokens&order=desc',
    );
    await expect(rowHeaders(canvasElement).at(-2)).toBe('No work item');
    await userEvent.click(canvas.getByRole('button', { name: 'Today' }));
    await expect(address(canvasElement)).toHaveTextContent(
      '/features?period=today&sort=tokens&order=desc',
    );
    await waitFor(() =>
      expect(rowHeaders(canvasElement)).toEqual([
        '#52 Export button',
        'No work item',
        'Total',
      ]),
    );
  },
};

export const OneProject: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('rowheader', { name: '#52 Export button' });
    await userEvent.selectOptions(
      canvas.getByRole('combobox', { name: 'Project' }),
      APP,
    );
    await expect(address(canvasElement)).toHaveTextContent(
      '/features?period=all&project=%2Fhome%2Fdev%2Fexample-app',
    );
    await waitFor(() =>
      expect(
        canvas.queryByRole('columnheader', { name: 'Project' }),
      ).toBeNull(),
    );
    await expect(canvas.queryByRole('rowheader', { name: '#28' })).toBeNull();
  },
};

export const SortedFromAddress: Story = {
  parameters: { entry: '/features?period=all&sort=number&order=asc' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('rowheader', { name: '#52 Export button' });
    await expect(rowHeaders(canvasElement)).toEqual([
      '#28 Session list',
      '#28',
      '#40 Dark mode',
      '#52 Export button',
      '#99 (not found)',
      'No work item',
      'Total',
    ]);
    await expect(
      canvas.getByRole('columnheader', { name: 'Issue' }),
    ).toHaveAttribute('aria-sort', 'ascending');
  },
};

export const OpensAnIssue: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const cell = await canvas.findByRole('cell', {
      name: 'Merged by a person',
    });
    await userEvent.click(cell);
    await expect(address(canvasElement)).toHaveTextContent(
      '/features/28?project=%2Fhome%2Fdev%2Fexample-app&period=all',
    );
  },
};

export const NoActivity: Story = {
  args: { loadFeatures: featuresLoaderOf([]) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('No activity in this period.');
    await expect(canvas.queryByRole('table')).toBeNull();
    await expect(canvas.queryByRole('region', { name: 'Totals' })).toBeNull();
  },
};

export const DatabaseUnreachable: Story = {
  args: {
    loadFeatures: () =>
      Promise.resolve({ status: 'unreachable', refreshSeconds: 3600 }),
  },
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByText(
      'Database unreachable. Start it with pnpm db:up.',
    );
  },
};

function refreshingLoader(): LoadFeatures {
  let calls = 0;
  return () => {
    calls += 1;
    const [first] = someFeatures;
    const row =
      first === undefined
        ? []
        : [{ ...first, costUsd: calls === 1 ? 8.5 : 9.75 }];
    return Promise.resolve({
      ...featuresResponse(featureList(row, null)),
      refreshSeconds: 0.2,
    });
  };
}

export const RefreshesWithoutReload: Story = {
  args: { loadFeatures: refreshingLoader() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findAllByRole('cell', { name: '~$8.50' });
    await canvas.findAllByRole('cell', { name: '~$9.75' });
  },
};
