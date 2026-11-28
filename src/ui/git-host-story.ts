import { type ReactElement, createElement, useState } from 'react';
import { userEvent, within } from 'storybook/test';
import { GitHostSection, type GitHostSectionProps } from './GitHostSection.tsx';
import type { ListedProject } from './projects-api.ts';

export function GitHostHarness(props: GitHostSectionProps): ReactElement {
  const [project, setProject] = useState<ListedProject>(props.project);
  return createElement(GitHostSection, {
    ...props,
    project,
    onSaved: (next: ListedProject) => {
      props.onSaved(next);
      setProject(next);
    },
  });
}

export async function typeToken(
  canvasElement: HTMLElement,
  token = 'ghp_example',
): Promise<void> {
  const field = await within(canvasElement).findByLabelText('Token');
  await userEvent.type(field, token);
}

export async function saveTyped(
  canvasElement: HTMLElement,
  token?: string,
): Promise<void> {
  await typeToken(canvasElement, token);
  await userEvent.click(
    within(canvasElement).getByRole('button', { name: 'Save token' }),
  );
}
