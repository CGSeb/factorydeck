import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { ProjectSelect } from './ProjectSelect.tsx';

const meta = {
  component: ProjectSelect,
  args: {
    value: undefined,
    projects: [
      { project: '/home/dev/example-app', name: 'Example App' },
      { project: '/home/dev/example-lib', name: 'example-lib' },
    ],
    onChange: fn(),
  },
} satisfies Meta<typeof ProjectSelect>;

export default meta;

type Story = StoryObj<typeof meta>;

function optionTexts(canvasElement: HTMLElement): string[] {
  return within(canvasElement)
    .getAllByRole('option')
    .map((option) => option.textContent);
}

export const AllProjects: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(optionTexts(canvasElement)).toEqual([
      'All projects',
      'Example App',
      'example-lib',
    ]);
    await userEvent.selectOptions(
      canvas.getByRole('combobox', { name: 'Project' }),
      'example-lib',
    );
    await expect(args.onChange).toHaveBeenCalledWith('/home/dev/example-lib');
  },
};

export const DuplicatedNames: Story = {
  args: {
    projects: [
      { project: '/home/dev/api', name: 'Shop (/home/dev/api)' },
      { project: '/home/dev/web', name: 'Shop (/home/dev/web)' },
      { project: '/home/dev/example-lib', name: 'example-lib' },
    ],
  },
  play: async ({ canvasElement, args }) => {
    await expect(optionTexts(canvasElement)).toEqual([
      'All projects',
      'Shop (/home/dev/api)',
      'Shop (/home/dev/web)',
      'example-lib',
    ]);
    await userEvent.selectOptions(
      within(canvasElement).getByRole('combobox', { name: 'Project' }),
      'Shop (/home/dev/web)',
    );
    await expect(args.onChange).toHaveBeenCalledWith('/home/dev/web');
  },
};

export const LongName: Story = {
  args: {
    projects: [{ project: '/home/dev/long', name: 'L'.repeat(70) }],
  },
  play: async ({ canvasElement }) => {
    await expect(optionTexts(canvasElement)).toEqual([
      'All projects',
      `${'L'.repeat(60)}…`,
    ]);
  },
};

export const LongNameSelected: Story = {
  args: {
    value: '/home/dev/long',
    projects: [{ project: '/home/dev/long', name: 'L'.repeat(70) }],
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('combobox', { name: 'Project' }),
    ).toHaveAttribute('title', `${'L'.repeat(70)}\n/home/dev/long`);
  },
};

export const OneProjectSelected: Story = {
  args: { value: '/home/dev/example-lib' },
  play: async ({ canvasElement }) => {
    const select = within(canvasElement).getByRole('combobox', {
      name: 'Project',
    });
    await expect(select).toHaveValue('/home/dev/example-lib');
    await expect(select).toHaveAttribute(
      'title',
      'example-lib\n/home/dev/example-lib',
    );
  },
};

export const UnknownProjectInUrl: Story = {
  args: { value: '/home/dev/gone' },
  play: async ({ canvasElement }) => {
    const select = within(canvasElement).getByRole('combobox', {
      name: 'Project',
    });
    await expect(select).toHaveValue('/home/dev/gone');
    await expect(optionTexts(canvasElement)).toContain('gone');
  },
};
