import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import {
  ALL_PROJECTS_TIP,
  COPIED,
  COPYING,
  COPY_AND_MARK,
  COPY_FAILED,
  COPY_REPORT,
  FrictionReportButton,
} from './FrictionReportButton.tsx';

const meta = {
  component: FrictionReportButton,
  args: { blocked: null, onCopy: fn(() => Promise.resolve()) },
} satisfies Meta<typeof FrictionReportButton>;

export default meta;

type Story = StoryObj<typeof meta>;

function button(canvasElement: HTMLElement): HTMLElement {
  return within(canvasElement).getByRole('button');
}

export const Idle: Story = {
  play: async ({ canvasElement }) => {
    const copy = button(canvasElement);
    await expect(copy).toHaveAccessibleName(COPY_REPORT);
    await expect(copy).toHaveAttribute('aria-disabled', 'false');
  },
};

export const Disabled: Story = {
  name: 'Disabled, no friction',
  args: { blocked: 'empty' },
  play: async ({ canvasElement, args }) => {
    const copy = button(canvasElement);
    await expect(copy).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(copy);
    await expect(args.onCopy).not.toHaveBeenCalled();
    await expect(copy).toHaveAccessibleName(COPY_REPORT);
    await userEvent.hover(copy);
    await expect(within(canvasElement).queryByRole('tooltip')).toBeNull();
  },
};

export const Loading: Story = {
  name: 'Disabled while the page loads',
  args: { blocked: 'loading' },
  play: async ({ canvasElement }) => {
    await expect(button(canvasElement)).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  },
};

export const AllProjects: Story = {
  name: 'Disabled under All projects',
  args: { blocked: 'all-projects' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const copy = button(canvasElement);
    await expect(copy).toHaveAttribute('aria-disabled', 'true');
    await expect(copy).toHaveAccessibleDescription(ALL_PROJECTS_TIP);
    await expect(
      canvas.getByRole('tooltip', { hidden: true }),
    ).not.toBeVisible();
    await userEvent.hover(copy);
    await expect(canvas.getByRole('tooltip')).toHaveTextContent(
      ALL_PROJECTS_TIP,
    );
    await userEvent.unhover(copy);
    await expect(canvas.queryByRole('tooltip')).toBeNull();
    await userEvent.tab();
    await expect(copy).toHaveFocus();
    await expect(canvas.getByRole('tooltip')).toBeVisible();
    await userEvent.keyboard('{Escape}');
    await expect(canvas.queryByRole('tooltip')).toBeNull();
    await userEvent.click(copy);
    await expect(args.onCopy).not.toHaveBeenCalled();
  },
};

export const Copying: Story = {
  args: { onCopy: fn(() => new Promise<void>(() => undefined)) },
  play: async ({ canvasElement, args }) => {
    const copy = button(canvasElement);
    await userEvent.click(copy);
    await expect(copy).toHaveAccessibleName(COPYING);
    await expect(copy).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(copy);
    await expect(args.onCopy).toHaveBeenCalledOnce();
  },
};

export const Copied: Story = {
  play: async ({ canvasElement, args }) => {
    const copy = button(canvasElement);
    const width = copy.getBoundingClientRect().width;
    await userEvent.click(copy);
    await waitFor(() => expect(copy).toHaveAccessibleName(COPIED));
    await expect(args.onCopy).toHaveBeenCalledOnce();
    await expect(within(canvasElement).getByRole('status')).toHaveTextContent(
      COPIED,
    );
    await expect(copy.getBoundingClientRect().width).toBe(width);
  },
};

export const CouldNotCopy: Story = {
  name: 'Could not copy',
  args: { onCopy: fn(() => Promise.reject(new Error('Denied'))) },
  play: async ({ canvasElement }) => {
    const copy = button(canvasElement);
    await userEvent.click(copy);
    await waitFor(() => expect(copy).toHaveAccessibleName(COPY_FAILED));
    await expect(copy).toHaveAttribute('aria-disabled', 'false');
  },
};

export const MarkIdle: Story = {
  name: 'Copy and mark as reported',
  args: { label: COPY_AND_MARK },
  play: async ({ canvasElement }) => {
    const mark = button(canvasElement);
    await expect(mark).toHaveAccessibleName(COPY_AND_MARK);
    await expect(mark).toHaveAttribute('aria-disabled', 'false');
  },
};

export const MarkCopying: Story = {
  name: 'Copy and mark as reported, copying',
  args: {
    label: COPY_AND_MARK,
    onCopy: fn(() => new Promise<void>(() => undefined)),
  },
  play: async ({ canvasElement }) => {
    const mark = button(canvasElement);
    await userEvent.click(mark);
    await expect(mark).toHaveAccessibleName(COPYING);
    await expect(mark).toHaveAttribute('aria-disabled', 'true');
  },
};

export const MarkCopied: Story = {
  name: 'Copy and mark as reported, copied',
  args: { label: COPY_AND_MARK, onCopy: fn(() => Promise.resolve()) },
  play: async ({ canvasElement, args }) => {
    const mark = button(canvasElement);
    const width = mark.getBoundingClientRect().width;
    await userEvent.click(mark);
    await waitFor(() => expect(mark).toHaveAccessibleName(COPIED));
    await expect(args.onCopy).toHaveBeenCalledOnce();
    await expect(mark.getBoundingClientRect().width).toBe(width);
  },
};

export const MarkCouldNotCopy: Story = {
  name: 'Copy and mark as reported, could not copy',
  args: {
    label: COPY_AND_MARK,
    onCopy: fn(() => Promise.reject(new Error('Denied'))),
  },
  play: async ({ canvasElement }) => {
    const mark = button(canvasElement);
    await userEvent.click(mark);
    await waitFor(() => expect(mark).toHaveAccessibleName(COPY_FAILED));
    await expect(mark).toHaveAttribute('aria-disabled', 'false');
  },
};

export const MarkDisabled: Story = {
  name: 'Copy and mark as reported, disabled under All projects',
  args: {
    label: COPY_AND_MARK,
    blocked: 'all-projects',
    onCopy: fn(() => Promise.resolve()),
  },
  play: async ({ canvasElement, args }) => {
    const mark = button(canvasElement);
    await expect(mark).toHaveAttribute('aria-disabled', 'true');
    await expect(mark).toHaveAccessibleDescription(ALL_PROJECTS_TIP);
    await userEvent.click(mark);
    await expect(args.onCopy).not.toHaveBeenCalled();
  },
};
