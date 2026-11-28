import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import {
  ADD,
  ADDING,
  ADD_PROJECT_TITLE,
  AddProjectDialog,
  CANCEL,
  REMOTE_PLACEHOLDER,
} from './AddProjectDialog.tsx';
import { DATABASE_UNREACHABLE } from './auth-api.ts';
import type { AddProject, AddProjectOutcome } from './projects-api.ts';
import { addedProject, addingAnswer } from './projects-list-fixtures.ts';

const meta = {
  component: AddProjectDialog,
  args: {
    addProject: fn(addingAnswer({ status: 'added', project: addedProject })),
    onAdded: fn(),
    onClose: fn(),
  },
} satisfies Meta<typeof AddProjectDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

async function submit(
  canvasElement: HTMLElement,
  remote: string,
  name = '',
): Promise<void> {
  const canvas = within(canvasElement);
  await userEvent.type(canvas.getByLabelText('Git remote'), remote);
  if (name !== '') await userEvent.type(canvas.getByLabelText('Name'), name);
  await userEvent.click(canvas.getByRole('button', { name: ADD }));
}

export const AddForm: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('dialog', { name: ADD_PROJECT_TITLE }),
    ).toBeVisible();
    const remote = canvas.getByLabelText('Git remote');
    await waitFor(() => expect(remote).toHaveFocus());
    await expect(remote).toHaveAttribute('placeholder', REMOTE_PLACEHOLDER);
    await submit(
      canvasElement,
      'https://github.com/example-org/factorydeck.git',
      'Deck',
    );
    await waitFor(() =>
      expect(args.onAdded).toHaveBeenCalledWith(addedProject),
    );
    await expect(args.addProject).toHaveBeenCalledWith({
      remote: 'https://github.com/example-org/factorydeck.git',
      name: 'Deck',
    });
    await userEvent.click(canvas.getByRole('button', { name: CANCEL }));
    await expect(args.onClose).toHaveBeenCalled();
  },
};

export const Adding: Story = {
  args: {
    addProject: fn<AddProject>(
      () => new Promise<AddProjectOutcome>(() => undefined),
    ),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await submit(canvasElement, 'git@github.com:example-org/factorydeck.git');
    await expect(
      await canvas.findByRole('button', { name: ADDING }),
    ).toBeDisabled();
    await userEvent.type(canvas.getByLabelText('Git remote'), '{Enter}');
    await expect(args.addProject).toHaveBeenCalledTimes(1);
  },
};

export const NotAGitRemote: Story = {
  args: {
    onAdded: fn(),
    addProject: fn(
      addingAnswer({
        status: 'invalid',
        field: 'remote',
        message: 'Not a git remote',
      }),
    ),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await submit(canvasElement, 'foo');
    const remote = canvas.getByLabelText('Git remote');
    await waitFor(() =>
      expect(remote).toHaveAccessibleDescription('Not a git remote'),
    );
    await expect(remote).toHaveAttribute('aria-invalid', 'true');
    await expect(remote).toHaveFocus();
    await expect(args.onAdded).not.toHaveBeenCalled();
  },
};

export const RemoteAlreadyAdded: Story = {
  args: {
    addProject: fn(
      addingAnswer({
        status: 'invalid',
        field: 'remote',
        message: 'This remote is already the project Billing',
      }),
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await submit(
      canvasElement,
      'https://GitHub.com/Example-Org/Billing-Service.git',
    );
    await waitFor(() =>
      expect(canvas.getByLabelText('Git remote')).toHaveAccessibleDescription(
        'This remote is already the project Billing',
      ),
    );
  },
};

export const NameTooLong: Story = {
  args: {
    addProject: fn(
      addingAnswer({
        status: 'invalid',
        field: 'name',
        message: 'Name must be at most 80 characters',
      }),
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await submit(
      canvasElement,
      'git@github.com:example-org/website.git',
      'x'.repeat(81),
    );
    const name = canvas.getByLabelText('Name');
    await waitFor(() =>
      expect(name).toHaveAccessibleDescription(
        'Name must be at most 80 characters',
      ),
    );
    await expect(name).toHaveFocus();
  },
};

export const ServerError: Story = {
  args: {
    addProject: fn(
      addingAnswer({ status: 'failed', message: DATABASE_UNREACHABLE }),
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await submit(canvasElement, 'git@github.com:example-org/website.git');
    await expect(await canvas.findByText(DATABASE_UNREACHABLE)).toBeVisible();
  },
};
