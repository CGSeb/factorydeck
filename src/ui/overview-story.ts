import type { Decorator } from '@storybook/react-vite';
import { type ReactElement, createElement } from 'react';
import { MemoryRouter, useLocation } from 'react-router';
import { expect, waitFor, within } from 'storybook/test';
import { featuresLoaderOf } from './feature-fixtures.ts';
import {
  fixedLoader,
  okResponse,
  todayOverview,
  weekOverview,
} from './fixtures.ts';
import { flowLoaderOf } from './flow-fixtures.ts';
import type { OverviewPageProps } from './OverviewPage.tsx';
import { fullBoardFeatures } from './overview-fixtures.ts';
import { rolesLoader, someRoles } from './role-fixtures.ts';
import { autonomyLoaderOf, qualityLoaderOf } from './stats-fixtures.ts';
import { waitingLoaderOf } from './waiting-fixtures.ts';

export const UNREACHABLE = {
  status: 'unreachable',
  refreshSeconds: 3600,
} as const;

export const UNREACHABLE_TEXT =
  'Database unreachable. Start it with pnpm db:up.';

export const pending = (): Promise<undefined> => new Promise(() => undefined);

export const overviewArgs: OverviewPageProps = {
  loadOverview: fixedLoader((period) =>
    okResponse(period === 'today' ? todayOverview : weekOverview),
  ),
  loadFeatures: featuresLoaderOf(fullBoardFeatures),
  loadRoles: rolesLoader(someRoles),
  loadAutonomy: autonomyLoaderOf(),
  loadQuality: qualityLoaderOf(),
  loadFlow: flowLoaderOf(),
  loadWaiting: waitingLoaderOf(),
  now: new Date('2026-01-07T09:13:00.000Z'),
};

function Location(): ReactElement {
  const { pathname, search } = useLocation();
  return createElement(
    'output',
    { 'aria-label': 'Address' },
    `${pathname}${search}`,
  );
}

export const overviewRouter: Decorator = (Story, { parameters }) =>
  createElement(
    MemoryRouter,
    {
      initialEntries: [
        typeof parameters['entry'] === 'string'
          ? parameters['entry']
          : '/?period=7d',
      ],
    },
    createElement(Story),
    createElement(Location),
  );

export function address(canvasElement: HTMLElement): HTMLElement {
  return within(canvasElement).getByRole('status', { name: 'Address' });
}

export function section(canvasElement: HTMLElement, name: RegExp): HTMLElement {
  const heading = within(canvasElement).getByRole('heading', {
    level: 2,
    name,
  });
  const found = heading.closest('section');
  if (found === null) throw new Error(`No section ${String(name)}`);
  return found;
}

export function column(canvasElement: HTMLElement, name: string): HTMLElement {
  return section(canvasElement, new RegExp(`^${name} \\d+$`));
}

export function title(canvasElement: HTMLElement): Promise<HTMLElement> {
  return within(canvasElement).findByRole('heading', { level: 1 });
}

export async function headlineLoaded(
  canvasElement: HTMLElement,
): Promise<void> {
  await waitFor(async () =>
    expect(await title(canvasElement)).toHaveTextContent(/tokens$/),
  );
}
