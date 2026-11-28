import type { Decorator } from '@storybook/react-vite';
import { createElement } from 'react';
import { Link } from 'react-router';
import { userEvent, within } from 'storybook/test';
import type { ListedProject } from './projects-api.ts';
import type {
  SaveRoleRules,
  SaveRoleRulesOutcome,
  StoredRoleRule,
} from './role-rules-api.ts';
import { memoryDataRouter } from './story-router.ts';

export const storyProject: ListedProject = {
  id: 2,
  name: 'atlas',
  slug: 'atlas',
  remote: 'gitlab.example.test/platform/tools/atlas',
  createdAt: '2026-02-03T09:00:00Z',
  sessions: 1,
};

export const rulesFrame: Decorator = (Story) =>
  memoryDataRouter('/projects/atlas', [
    {
      path: '/projects/:slug',
      element: createElement(
        'div',
        null,
        createElement(Story),
        createElement(Link, { to: '/roles' }, 'Roles'),
      ),
    },
    { path: '/roles', element: createElement('p', null, 'Roles page') },
  ]);

export function recordingPendingSave(): {
  save: SaveRoleRules;
  sent: StoredRoleRule[][];
} {
  const sent: StoredRoleRule[][] = [];
  return {
    sent,
    save: (_id, rules) => {
      sent.push(rules);
      return new Promise<SaveRoleRulesOutcome>(() => undefined);
    },
  };
}

export function ruleRows(canvasElement: HTMLElement): HTMLElement[] {
  return within(canvasElement).getAllByRole('row').slice(1);
}

export function rowAt(canvasElement: HTMLElement, index: number): HTMLElement {
  const row = ruleRows(canvasElement)[index];
  if (row === undefined) throw new Error(`No row ${String(index)}`);
  return row;
}

export function ruleNames(canvasElement: HTMLElement): string[] {
  return ruleRows(canvasElement).map(
    (row) =>
      within(row).getByLabelText<HTMLInputElement>(/^Name of rule \d+$/).value,
  );
}

export async function loadedRules(canvasElement: HTMLElement): Promise<void> {
  await within(canvasElement).findByRole('table');
}

export async function renameFirst(
  canvasElement: HTMLElement,
  name: string,
): Promise<void> {
  await loadedRules(canvasElement);
  const field = within(rowAt(canvasElement, 0)).getByLabelText(
    /^Name of rule \d+$/,
  );
  await userEvent.clear(field);
  await userEvent.type(field, name);
}
