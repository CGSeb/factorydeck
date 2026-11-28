import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { surfaceFrame } from './components/story-frame.ts';
import {
  FULL_OUTPUT,
  HEAD_ERROR,
  TAIL_ERROR,
  errorOccurrences,
  goneOutput,
  hookOccurrences,
  outputLoaderOf,
  pendingOutput,
  remoteOutput,
  unreachableOutput,
} from './occurrence-fixtures.ts';
import {
  HIDE_FULL_OUTPUT,
  LOG_GONE,
  NO_OUTPUT,
  OccurrenceTexts,
  REMOTE_DETAILS,
  SHOW_FULL_OUTPUT,
  fullOutputLabel,
} from './OccurrenceTexts.tsx';
import { UNREACHABLE_MESSAGE } from './overview-api.ts';

const [shellError, emptyOutput, otherError] = errorOccurrences;
const [hookBlock] = hookOccurrences;

if (
  shellError === undefined ||
  emptyOutput === undefined ||
  otherError === undefined ||
  hookBlock === undefined
) {
  throw new Error('The occurrence fixtures are missing');
}

const meta = {
  title: 'Frictions/OccurrenceTexts',
  component: OccurrenceTexts,
  decorators: [
    (Story) => (
      <ol className="fd-occurrence-list">
        <li className="fd-occurrence">
          <Story />
        </li>
      </ol>
    ),
    surfaceFrame,
  ],
  args: { occurrence: shellError, loadOutput: outputLoaderOf() },
} satisfies Meta<typeof OccurrenceTexts>;

export default meta;

type Story = StoryObj<typeof meta>;

function width(size: number): NonNullable<Story['decorators']> {
  return [
    (Story) => (
      <div style={{ maxWidth: size }}>
        <Story />
      </div>
    ),
  ];
}

function showButton(canvasElement: HTMLElement): HTMLElement {
  return within(canvasElement).getByRole('button', {
    name: fullOutputLabel(false, shellError?.at ?? ''),
  });
}

async function openOutput(canvasElement: HTMLElement): Promise<HTMLElement> {
  const button = showButton(canvasElement);
  await userEvent.click(button);
  await expect(button).toHaveAttribute('aria-expanded', 'true');
  return within(canvasElement).getByRole('region', {
    name: /^Full output of the occurrence at/,
  });
}

export const ShellError: Story = {
  name: 'A shell error with its exit code and tail',
  decorators: width(1024),
  globals: { theme: 'light' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Exit code 2')).toBeVisible();
    const tail = canvas.getByText(/Found 2 errors in 2 files\./);
    await expect(tail).toHaveClass('fd-occurrence-error');
    await expect(tail.textContent).toBe(TAIL_ERROR);
    await expect(showButton(canvasElement)).toHaveTextContent(SHOW_FULL_OUTPUT);
  },
};

export const ShellErrorDark: Story = {
  ...ShellError,
  name: 'A shell error with its exit code and tail, dark',
  globals: { theme: 'dark' },
};

export const ShellErrorNarrow: Story = {
  ...ShellError,
  name: 'A shell error with its exit code and tail at 360 px',
  decorators: width(360),
};

export const ShellErrorNarrowDark: Story = {
  ...ShellErrorNarrow,
  name: 'A shell error with its exit code and tail at 360 px, dark',
  globals: { theme: 'dark' },
};

export const NoOutput: Story = {
  name: 'A shell error with no output',
  args: { occurrence: emptyOutput },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Exit code 1')).toBeVisible();
    await expect(canvas.getByText(NO_OUTPUT)).toBeVisible();
    await expect(canvas.queryByRole('button')).toBeNull();
  },
};

export const OtherTool: Story = {
  name: 'An error of another tool',
  args: { occurrence: otherError },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByText(/^Exit code/)).toBeNull();
    const head = canvas.getByText(/^File has not been read yet/);
    await expect(head.textContent).toBe(HEAD_ERROR);
    await expect(head).toHaveClass('fd-occurrence-error');
    await expect(canvas.getByRole('button')).toBeVisible();
  },
};

export const StopBlock: Story = {
  name: 'A stop hook message',
  args: { occurrence: hookBlock },
  play: async ({ canvasElement }) => {
    const message = within(canvasElement).getByText(/pnpm check failed/);
    await expect(message).toHaveClass('fd-occurrence-message');
    await expect(within(canvasElement).queryByRole('button')).toBeNull();
  },
};

export const OutputOpen: Story = {
  name: 'A full output open',
  decorators: width(1024),
  globals: { theme: 'light' },
  play: async ({ canvasElement }) => {
    const box = await openOutput(canvasElement);
    await expect(
      await within(box).findByText(/Found 2 errors in 2 files\./),
    ).toBeVisible();
    await expect(box.textContent).toBe(FULL_OUTPUT);
    await expect(
      within(canvasElement).getByRole('button', {
        name: fullOutputLabel(true, shellError.at),
      }),
    ).toHaveTextContent(HIDE_FULL_OUTPUT);
  },
};

export const OutputOpenDark: Story = {
  ...OutputOpen,
  name: 'A full output open, dark',
  globals: { theme: 'dark' },
};

export const OutputOpenNarrow: Story = {
  ...OutputOpen,
  name: 'A full output open at 360 px',
  decorators: width(360),
};

export const OutputOpenNarrowDark: Story = {
  ...OutputOpenNarrow,
  name: 'A full output open at 360 px, dark',
  globals: { theme: 'dark' },
};

export const OutputLoading: Story = {
  name: 'A full output loading',
  args: { loadOutput: pendingOutput },
  play: async ({ canvasElement }) => {
    const box = await openOutput(canvasElement);
    await expect(box).toHaveTextContent('Loading…');
  },
};

export const OutputUnreachable: Story = {
  name: 'A full output unreachable',
  args: { loadOutput: unreachableOutput },
  play: async ({ canvasElement }) => {
    const box = await openOutput(canvasElement);
    await expect(
      await within(box).findByText(UNREACHABLE_MESSAGE),
    ).toBeVisible();
  },
};

export const OutputGone: Story = {
  name: 'A full output whose log is gone',
  args: { loadOutput: goneOutput },
  play: async ({ canvasElement }) => {
    const box = await openOutput(canvasElement);
    await expect(await within(box).findByText(LOG_GONE)).toBeVisible();
  },
};

export const OutputRemote: Story = {
  name: 'A full output of an occurrence sent by a CLI',
  args: { loadOutput: remoteOutput },
  play: async ({ canvasElement }) => {
    const box = await openOutput(canvasElement);
    await expect(await within(box).findByText(REMOTE_DETAILS)).toBeVisible();
  },
};

export const SentByCli: Story = {
  name: 'An occurrence sent by a CLI',
  args: {
    occurrence: {
      ...shellError,
      details: 'remote',
      hasMore: false,
      texts: null,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(REMOTE_DETAILS)).toBeVisible();
    await expect(
      canvas.getByText(`Exit code ${String(shellError.exitCode)}`),
    ).toBeVisible();
    await expect(canvas.queryByRole('button')).toBeNull();
  },
};

export const SentByCliDark: Story = {
  ...SentByCli,
  name: 'An occurrence sent by a CLI, dark',
  globals: { theme: 'dark' },
};

export const Keyboard: Story = {
  name: 'Open and close a full output with the keyboard',
  play: async ({ canvasElement }) => {
    const button = showButton(canvasElement);
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    button.focus();
    await userEvent.keyboard('{Enter}');
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    const box = document.getElementById(
      button.getAttribute('aria-controls') ?? '',
    );
    await expect(box).not.toBeNull();
    await userEvent.keyboard(' ');
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(button).not.toHaveAttribute('aria-controls');
    await expect(within(canvasElement).queryByRole('region')).toBeNull();
  },
};
