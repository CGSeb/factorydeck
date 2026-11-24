import type { Decorator } from '@storybook/react-vite';
import { type ReactElement, Fragment, createElement } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { within } from 'storybook/test';

function Location(): ReactElement {
  const { pathname, search } = useLocation();
  return createElement(
    'output',
    { 'aria-label': 'Address' },
    `${pathname}${search}`,
  );
}

export function routed(fallback: string): Decorator {
  return (Story, { parameters }) => {
    const entry: unknown = parameters['entry'];
    return createElement(
      MemoryRouter,
      { initialEntries: [typeof entry === 'string' ? entry : fallback] },
      createElement(
        Routes,
        null,
        createElement(Route, {
          path: '/features',
          element: createElement(
            Fragment,
            null,
            createElement(Story),
            createElement(Location),
          ),
        }),
        createElement(Route, {
          path: '/features/:number',
          element: createElement(Location),
        }),
      ),
    );
  };
}

export function address(canvasElement: HTMLElement): HTMLElement {
  return within(canvasElement).getByRole('status', { name: 'Address' });
}

export function rowHeaders(canvasElement: HTMLElement): string[] {
  return within(canvasElement)
    .getAllByRole('rowheader')
    .map((cell) => cell.textContent);
}

export async function ready(canvasElement: HTMLElement): Promise<void> {
  await within(canvasElement).findByRole('rowheader', { name: / \(#61\)$/ });
}
