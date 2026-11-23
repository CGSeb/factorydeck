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

export const AUTONOMY = '.fd-stats-autonomy';
export const QUALITY = '.fd-stats-quality';
export const FLOW = '.fd-stats-flow';

export function figureTexts(
  canvasElement: HTMLElement,
  selector: string,
  panel: string = AUTONOMY,
): string[] {
  return [
    ...canvasElement.querySelectorAll(`${panel} .fd-stats-figures > div`),
  ].map((figure) => figure.querySelector(selector)?.textContent ?? '');
}

export async function loaded(canvasElement: HTMLElement): Promise<void> {
  await within(canvasElement).findByRole('heading', {
    name: 'Merged without a person, by week',
  });
}

export async function qualityLoaded(canvasElement: HTMLElement): Promise<void> {
  await within(canvasElement).findByRole('heading', {
    name: 'Right the first time, by week',
  });
}

export function panelOf(canvasElement: HTMLElement, name: string): HTMLElement {
  const heading = within(canvasElement).getByRole('heading', {
    level: 2,
    name,
  });
  const section = heading.closest('section');
  if (section === null) throw new Error(`No panel ${name}`);
  return section;
}

export async function flowLoaded(canvasElement: HTMLElement): Promise<void> {
  await within(canvasElement).findByRole('heading', {
    name: 'Merged per week',
  });
}
