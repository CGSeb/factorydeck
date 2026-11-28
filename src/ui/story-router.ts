import { type ReactElement, createElement } from 'react';
import {
  type RouteObject,
  RouterProvider,
  createMemoryRouter,
} from 'react-router';

export function memoryDataRouter(
  entry: string,
  routes: RouteObject[],
): ReactElement {
  return createElement(RouterProvider, {
    router: createMemoryRouter(routes, { initialEntries: [entry] }),
  });
}
