import type { Decorator } from '@storybook/react-vite';
import { type ReactElement, createElement } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { within } from 'storybook/test';

function Location(): ReactElement {
  const { search } = useLocation();
  return createElement('output', { 'aria-label': 'Address' }, search);
}

export const frictionsRouter: Decorator = (Story, { parameters }) =>
  createElement(
    MemoryRouter,
    {
      initialEntries: [
        typeof parameters['entry'] === 'string'
          ? parameters['entry']
          : '/frictions?period=30d',
      ],
    },
    createElement(
      Routes,
      null,
      createElement(Route, {
        path: '/frictions',
        element: createElement(
          'div',
          null,
          createElement(Story),
          createElement(Location),
        ),
      }),
    ),
  );

export const tablesRouter: Decorator = (Story) =>
  createElement(
    MemoryRouter,
    { initialEntries: ['/frictions?period=30d'] },
    createElement(Story),
  );

export async function frictionsLoaded(
  canvasElement: HTMLElement,
): Promise<void> {
  await within(canvasElement).findByRole('heading', {
    name: /^Frictions per 100 API calls, by /,
  });
}

export function tableHeadings(canvasElement: HTMLElement): string[] {
  return within(canvasElement)
    .queryAllByRole('heading', { level: 2 })
    .map((heading) => heading.textContent);
}

export function columnTexts(table: HTMLElement, column: number): string[] {
  return [...table.querySelectorAll('tbody tr')].map(
    (row) => row.children[column]?.textContent ?? '',
  );
}
