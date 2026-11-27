import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import {
  DATABASE_UNREACHABLE,
  SERVER_UNREACHABLE,
  type SetupOutcome,
} from './auth-api.ts';
import {
  CREATE,
  CREATING,
  PASSWORD_HINT,
  SETUP_TEXT,
  SETUP_TITLE,
  SetupPage,
} from './SetupPage.tsx';

function answering(outcome: SetupOutcome): () => Promise<SetupOutcome> {
  return () => Promise.resolve(outcome);
}

const meta = {
  component: SetupPage,
  args: {
    setupManager: fn(answering({ status: 'created' })),
    onCreated: fn(),
  },
} satisfies Meta<typeof SetupPage>;

export default meta;

type Story = StoryObj<typeof meta>;

async function fillForm(canvasElement: HTMLElement): Promise<void> {
  const canvas = within(canvasElement);
  await userEvent.type(canvas.getByLabelText('Setup code'), 'k7mq2xrd');
  await userEvent.type(canvas.getByLabelText('Name'), 'Ada');
  await userEvent.type(canvas.getByLabelText('Email'), 'ada@example.test');
  await userEvent.type(canvas.getByLabelText('Password'), 'a long passphrase');
}

async function submitWithEnter(canvasElement: HTMLElement): Promise<void> {
  await fillForm(canvasElement);
  await userEvent.keyboard('{Enter}');
}

function formError(canvasElement: HTMLElement): HTMLElement | null {
  return canvasElement.querySelector('.fd-setup-form-error');
}

export const Empty: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('heading', { level: 1, name: SETUP_TITLE }),
    ).toBeVisible();
    await expect(canvas.getByText(SETUP_TEXT)).toBeVisible();
    await waitFor(() =>
      expect(canvas.getByLabelText('Setup code')).toHaveFocus(),
    );
    await expect(canvas.getByLabelText('Password')).toHaveAccessibleDescription(
      PASSWORD_HINT,
    );
    await expect(canvas.getByLabelText('Password')).toHaveAttribute(
      'type',
      'password',
    );
    const button = canvas.getByRole('button', { name: CREATE });
    await expect(button).toBeEnabled();
    await submitWithEnter(canvasElement);
    await waitFor(() => expect(args.onCreated).toHaveBeenCalledOnce());
    await expect(args.setupManager).toHaveBeenCalledWith({
      code: 'k7mq2xrd',
      email: 'ada@example.test',
      name: 'Ada',
      password: 'a long passphrase',
    });
  },
};

export const Sending: Story = {
  args: {
    setupManager: fn(() => new Promise<SetupOutcome>(() => undefined)),
    onCreated: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const card = canvasElement.querySelector('.fd-setup-card');
    const before = card?.getBoundingClientRect().height;
    await submitWithEnter(canvasElement);
    const button = await canvas.findByRole('button', { name: CREATING });
    await expect(button).toBeDisabled();
    await userEvent.keyboard('{Enter}');
    await expect(args.setupManager).toHaveBeenCalledOnce();
    await expect(args.onCreated).not.toHaveBeenCalled();
    await expect(card?.getBoundingClientRect().height).toBe(before);
  },
};

export const WrongCode: Story = {
  args: {
    setupManager: fn(
      answering({ status: 'failed', message: 'Wrong setup code' }),
    ),
    onCreated: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await submitWithEnter(canvasElement);
    await waitFor(() =>
      expect(formError(canvasElement)).toHaveTextContent('Wrong setup code'),
    );
    await expect(formError(canvasElement)).toHaveAttribute('role', 'alert');
    await expect(canvas.getByRole('button', { name: CREATE })).toBeEnabled();
    await expect(args.onCreated).not.toHaveBeenCalled();
  },
};

export const AlreadySetUp: Story = {
  args: {
    setupManager: fn(
      answering({ status: 'failed', message: 'Already set up' }),
    ),
  },
  play: async ({ canvasElement }) => {
    await submitWithEnter(canvasElement);
    await waitFor(() =>
      expect(formError(canvasElement)).toHaveTextContent('Already set up'),
    );
  },
};

export const InvalidField: Story = {
  args: {
    setupManager: fn(
      answering({
        status: 'invalid',
        field: 'email',
        message: 'Email must have one @ with text on both sides',
      }),
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await submitWithEnter(canvasElement);
    const email = canvas.getByLabelText('Email');
    await waitFor(() => expect(email).toHaveAttribute('aria-invalid', 'true'));
    await expect(email).toHaveAccessibleDescription(
      'Email must have one @ with text on both sides',
    );
    await expect(email).toHaveFocus();
    await expect(formError(canvasElement)).toBeEmptyDOMElement();
    await expect(canvas.getByLabelText('Name')).toHaveAttribute(
      'aria-invalid',
      'false',
    );
  },
};

export const ServerUnreachable: Story = {
  args: {
    setupManager: fn(
      answering({ status: 'failed', message: SERVER_UNREACHABLE }),
    ),
  },
  play: async ({ canvasElement }) => {
    await submitWithEnter(canvasElement);
    await waitFor(() =>
      expect(formError(canvasElement)).toHaveTextContent(SERVER_UNREACHABLE),
    );
  },
};

export const DatabaseUnreachable: Story = {
  args: {
    setupManager: fn(
      answering({ status: 'failed', message: DATABASE_UNREACHABLE }),
    ),
  },
  play: async ({ canvasElement }) => {
    await submitWithEnter(canvasElement);
    await waitFor(() =>
      expect(formError(canvasElement)).toHaveTextContent(DATABASE_UNREACHABLE),
    );
  },
};
