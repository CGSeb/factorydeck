import type { Decorator } from '@storybook/react-vite';
import { type ReactElement, createElement } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { within } from 'storybook/test';

function Location(): ReactElement {
  const { search } = useLocation();
  return createElement('output', { 'aria-label': 'Address' }, search);
}

export const statsRouter: Decorator = (Story, { parameters }) =>
  createElement(
    MemoryRouter,
    {
      initialEntries: [
        typeof parameters['entry'] === 'string'
          ? parameters['entry']
          : '/stats?period=30d',
      ],
    },
    createElement(
      Routes,
      null,
      createElement(Route, {
        path: '/stats',
        element: createElement(
          'div',
          null,
          createElement(Story),
          createElement(Location),
        ),
      }),
    ),
  );

export function figureTexts(
  canvasElement: HTMLElement,
  selector: string,
): string[] {
  return [...canvasElement.querySelectorAll('.fd-stats-figures > div')].map(
    (figure) => figure.querySelector(selector)?.textContent ?? '',
  );
}

export async function loaded(canvasElement: HTMLElement): Promise<void> {
  await within(canvasElement).findByRole('heading', {
    name: 'Merged without a person, by week',
  });
}
