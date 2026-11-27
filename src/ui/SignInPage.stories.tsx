import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import {
  DATABASE_UNREACHABLE,
  SERVER_UNREACHABLE,
  type SignInOutcome,
} from './auth-api.ts';
import {
  SIGN_IN,
  SIGN_IN_TITLE,
  SIGNING_IN,
  SignInPage,
} from './SignInPage.tsx';

const ACCOUNT = {
  id: 1,
  email: 'ada@example.test',
  name: 'Ada',
  role: 'manager',
} as const;

function answering(outcome: SignInOutcome): () => Promise<SignInOutcome> {
  return () => Promise.resolve(outcome);
}

const meta = {
  component: SignInPage,
  args: {
    signIn: fn(answering({ status: 'signed-in', account: ACCOUNT })),
    onSignedIn: fn(),
  },
} satisfies Meta<typeof SignInPage>;

export default meta;

type Story = StoryObj<typeof meta>;

async function submitWithEnter(canvasElement: HTMLElement): Promise<void> {
  const canvas = within(canvasElement);
  await userEvent.type(canvas.getByLabelText('Email'), 'ada@example.test');
  await userEvent.type(
    canvas.getByLabelText('Password'),
    'a long passphrase{Enter}',
  );
}

function formError(canvasElement: HTMLElement): HTMLElement | null {
  return canvasElement.querySelector('.fd-setup-form-error');
}

export const Empty: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('heading', { level: 1, name: SIGN_IN_TITLE }),
    ).toBeVisible();
    await expect(canvas.queryByRole('navigation')).toBeNull();
    await waitFor(() => expect(canvas.getByLabelText('Email')).toHaveFocus());
    await expect(canvas.getByLabelText('Email')).toHaveAttribute(
      'type',
      'email',
    );
    await expect(canvas.getByLabelText('Email')).toHaveAttribute(
      'autocomplete',
      'username',
    );
    await expect(canvas.getByLabelText('Password')).toHaveAttribute(
      'autocomplete',
      'current-password',
    );
    await expect(canvas.getByRole('button', { name: SIGN_IN })).toBeEnabled();
    await expect(formError(canvasElement)).toHaveAttribute('role', 'alert');
    await submitWithEnter(canvasElement);
    await waitFor(() => expect(args.onSignedIn).toHaveBeenCalledWith(ACCOUNT));
    await expect(args.signIn).toHaveBeenCalledWith({
      email: 'ada@example.test',
      password: 'a long passphrase',
    });
  },
};

export const EmptyFieldsSent: Story = {
  name: 'Empty fields are sent as typed',
  args: {
    signIn: fn(
      answering({ status: 'refused', message: 'Wrong email or password' }),
    ),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: SIGN_IN }));
    await expect(args.signIn).toHaveBeenCalledWith({ email: '', password: '' });
  },
};

export const Sending: Story = {
  args: {
    signIn: fn(() => new Promise<SignInOutcome>(() => undefined)),
    onSignedIn: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const card = canvasElement.querySelector('.fd-setup-card');
    const before = card?.getBoundingClientRect().height;
    await submitWithEnter(canvasElement);
    const button = await canvas.findByRole('button', { name: SIGNING_IN });
    await expect(button).toBeDisabled();
    await userEvent.keyboard('{Enter}');
    await expect(args.signIn).toHaveBeenCalledOnce();
    await expect(args.onSignedIn).not.toHaveBeenCalled();
    await expect(card?.getBoundingClientRect().height).toBe(before);
  },
};

export const WrongEmailOrPassword: Story = {
  args: {
    signIn: fn(
      answering({ status: 'refused', message: 'Wrong email or password' }),
    ),
    onSignedIn: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await submitWithEnter(canvasElement);
    await waitFor(() =>
      expect(formError(canvasElement)).toHaveTextContent(
        'Wrong email or password',
      ),
    );
    await expect(canvas.getByLabelText('Email')).toHaveValue(
      'ada@example.test',
    );
    await expect(canvas.getByLabelText('Password')).toHaveValue('');
    await waitFor(() =>
      expect(canvas.getByLabelText('Password')).toHaveFocus(),
    );
    await expect(canvas.getByRole('button', { name: SIGN_IN })).toBeEnabled();
    await expect(args.onSignedIn).not.toHaveBeenCalled();
  },
};

async function keepsBothFields(
  canvasElement: HTMLElement,
  message: string,
): Promise<void> {
  const canvas = within(canvasElement);
  await submitWithEnter(canvasElement);
  await waitFor(() =>
    expect(formError(canvasElement)).toHaveTextContent(message),
  );
  await expect(canvas.getByLabelText('Email')).toHaveValue('ada@example.test');
  await expect(canvas.getByLabelText('Password')).toHaveValue(
    'a long passphrase',
  );
  await waitFor(() =>
    expect(canvas.getByRole('button', { name: SIGN_IN })).toHaveFocus(),
  );
}

export const DatabaseUnreachable: Story = {
  args: {
    signIn: fn(answering({ status: 'failed', message: DATABASE_UNREACHABLE })),
  },
  play: async ({ canvasElement }) => {
    await keepsBothFields(canvasElement, DATABASE_UNREACHABLE);
  },
};

export const ServerUnreachable: Story = {
  args: {
    signIn: fn(answering({ status: 'failed', message: SERVER_UNREACHABLE })),
  },
  play: async ({ canvasElement }) => {
    await keepsBothFields(canvasElement, SERVER_UNREACHABLE);
  },
};

export const TooManyAttempts: Story = {
  args: {
    signIn: fn(
      answering({
        status: 'refused',
        message: 'Too many attempts, try again in 15 minutes',
      }),
    ),
    onSignedIn: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const card = canvasElement.querySelector('.fd-setup-card');
    const before = card?.getBoundingClientRect().height;
    await submitWithEnter(canvasElement);
    await waitFor(() =>
      expect(formError(canvasElement)).toHaveTextContent(
        'Too many attempts, try again in 15 minutes',
      ),
    );
    await expect(canvas.getByLabelText('Email')).toHaveValue(
      'ada@example.test',
    );
    await expect(canvas.getByLabelText('Password')).toHaveValue('');
    await waitFor(() =>
      expect(canvas.getByLabelText('Password')).toHaveFocus(),
    );
    await expect(card?.getBoundingClientRect().height).toBe(before);
    await expect(args.onSignedIn).not.toHaveBeenCalled();
  },
};
