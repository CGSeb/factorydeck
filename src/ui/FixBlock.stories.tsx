import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { fixRequest } from './bug-fixtures.ts';
import { FixBlock, NO_FIX_TEXT, NO_ROOT_CAUSE_TEXT } from './FixBlock.tsx';

const meta = {
  component: FixBlock,
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 360, fontSize: 'var(--fd-text-md)' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    fix: {
      rootCause: 'The empty state renders in the list and in the panel.',
      reproduced: 'failed-on-main',
      request: fixRequest(81),
    },
  },
} satisfies Meta<typeof FixBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

function valueOf(canvasElement: HTMLElement, term: string): HTMLElement {
  const dt = within(canvasElement).getByText(term, { selector: 'dt' });
  const dd = dt.nextElementSibling;
  if (!(dd instanceof HTMLElement)) throw new Error(`No value for ${term}`);
  return dd;
}

export const FailedOnMain: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Fix')).toBeVisible();
    await expect(valueOf(canvasElement, 'Root cause')).toHaveTextContent(
      'The empty state renders in the list and in the panel.',
    );
    const reproduced = within(valueOf(canvasElement, 'Reproduced')).getByText(
      'Failed on main',
    );
    await expect(reproduced).toHaveAttribute('data-tone', 'success');
    const link = within(valueOf(canvasElement, 'Pull request')).getByRole(
      'link',
      { name: '#81' },
    );
    await expect(link).toHaveAttribute(
      'href',
      'https://github.com/example-org/example-app/pull/81',
    );
    const terms = [...canvasElement.querySelectorAll('dt')].map(
      (dt) => dt.textContent,
    );
    await expect(terms).toEqual(['Root cause', 'Reproduced', 'Pull request']);
  },
};

function warning(
  reproduced: 'passed-on-main' | 'did-not-run-on-main' | 'no-test',
  text: string,
): Story {
  return {
    args: {
      fix: { rootCause: 'A race', reproduced, request: fixRequest(82) },
    },
    play: async ({ canvasElement }) => {
      const value = within(valueOf(canvasElement, 'Reproduced')).getByText(
        text,
      );
      await expect(value).toHaveAttribute('data-tone', 'warning');
    },
  };
}

export const PassedOnMain = warning('passed-on-main', 'Passed on main');

export const DidNotRunOnMain = warning(
  'did-not-run-on-main',
  'Did not run on main',
);

export const NoTest = warning('no-test', 'No test');

export const NoReproducedValue: Story = {
  args: {
    fix: { rootCause: 'A race', reproduced: null, request: fixRequest(83) },
  },
  play: async ({ canvasElement }) => {
    const value = valueOf(canvasElement, 'Reproduced');
    await expect(value).toHaveTextContent(/^—$/);
    await expect(value.querySelector('[data-tone]')).toBeNull();
  },
};

export const RootCauseNotGiven: Story = {
  args: {
    fix: {
      rootCause: null,
      reproduced: 'failed-on-main',
      request: fixRequest(84),
    },
  },
  play: async ({ canvasElement }) => {
    await expect(valueOf(canvasElement, 'Root cause')).toHaveTextContent(
      new RegExp(`^${NO_ROOT_CAUSE_TEXT}$`),
    );
  },
};

export const NoFix: Story = {
  args: { fix: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(NO_FIX_TEXT)).toBeVisible();
    await expect(canvasElement.querySelector('dl')).toBeNull();
    await expect(canvas.queryByRole('link')).toBeNull();
  },
};
