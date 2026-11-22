import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Select } from './Select.tsx';
import { surfaceFrame } from './story-frame.ts';

const meta = {
  title: 'Components/Select',
  component: Select<string>,
  decorators: [surfaceFrame],
  args: {
    ariaLabel: 'Sort by',
    value: 'stage',
    options: [
      { value: 'stage', label: 'Stage' },
      { value: 'tokens', label: 'Tokens' },
      { value: 'activity', label: 'Last activity' },
    ],
    onChange: fn(),
  },
} satisfies Meta<typeof Select<string>>;

export default meta;

type Story = StoryObj<typeof meta>;

function combobox(canvasElement: HTMLElement): HTMLElement {
  return within(canvasElement).getByRole('combobox', { name: 'Sort by' });
}

export const Closed: Story = {
  play: async ({ canvasElement }) => {
    const trigger = combobox(canvasElement);
    await expect(trigger).toHaveTextContent('Stage');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(within(canvasElement).queryByRole('listbox')).toBeNull();
  },
};

export const Open: Story = {
  play: async ({ canvasElement }) => {
    const trigger = combobox(canvasElement);
    await userEvent.click(trigger);
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const list = within(canvasElement).getByRole('listbox', {
      name: 'Sort by',
    });
    await expect(
      within(list).getByRole('option', { selected: true }),
    ).toHaveTextContent('Stage');
    await expect(within(list).getAllByRole('option')).toHaveLength(3);
  },
};

export const ChosenWithThePointer: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(combobox(canvasElement));
    await userEvent.click(
      within(canvasElement).getByRole('option', { name: 'Tokens' }),
    );
    await expect(args.onChange).toHaveBeenCalledWith('tokens');
    await expect(within(canvasElement).queryByRole('listbox')).toBeNull();
  },
};

export const ChosenWithTheKeyboard: Story = {
  play: async ({ canvasElement, args }) => {
    const trigger = combobox(canvasElement);
    trigger.focus();
    await userEvent.keyboard('{ArrowDown}');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    const active = trigger.getAttribute('aria-activedescendant');
    await expect(active).not.toBeNull();
    await expect(document.getElementById(active ?? '')).toHaveTextContent(
      'Last activity',
    );
    await userEvent.keyboard('{Enter}');
    await expect(args.onChange).toHaveBeenCalledWith('activity');
    await expect(trigger).toHaveFocus();
  },
};

export const ClosedWithEscape: Story = {
  args: { onChange: fn() },
  play: async ({ canvasElement, args }) => {
    const trigger = combobox(canvasElement);
    await userEvent.click(trigger);
    await userEvent.keyboard('{ArrowDown}{Escape}');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(args.onChange).not.toHaveBeenCalled();
  },
};

export const ClosedByAClickOutside: Story = {
  play: async ({ canvasElement }) => {
    const trigger = combobox(canvasElement);
    await userEvent.click(trigger);
    await userEvent.click(document.body);
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  },
};
