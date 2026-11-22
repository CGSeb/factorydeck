import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { type ReactNode, useEffect, useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import { Sidebar } from './Sidebar.tsx';
import { NARROW_QUERY } from './sidebar-state.ts';
import {
  cycleThemes,
  openDrawer,
  withStoredFold,
  withoutStoredTheme,
} from './sidebar-stories.ts';

function NarrowWindow({ children }: { children: ReactNode }): ReactNode {
  const [original] = useState(() => {
    const matchMedia = window.matchMedia.bind(window);
    window.matchMedia = (query) =>
      matchMedia(query === NARROW_QUERY ? '(min-width: 0px)' : query);
    return matchMedia;
  });
  useEffect(
    () => () => {
      window.matchMedia = original;
    },
    [original],
  );
  return <div style={{ maxWidth: 360 }}>{children}</div>;
}

const frame: Decorator = (Story) => (
  <div style={{ display: 'flex', height: 560, background: 'var(--fd-page)' }}>
    <Story />
  </div>
);

const meta = {
  title: 'Components/Sidebar theme',
  component: Sidebar,
  args: {
    links: [
      { label: 'Overview', icon: 'overview', href: '#overview', current: true },
      { label: 'Roles', icon: 'roles', href: '#roles', current: false },
    ],
  },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Sidebar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ThemeCycles: Story = {
  decorators: [frame, withStoredFold(undefined), withoutStoredTheme],
  play: async ({ canvasElement }) => {
    await cycleThemes(canvasElement);
  },
};

export const FoldedThemeTooltip: Story = {
  decorators: [frame, withStoredFold('collapsed'), withoutStoredTheme],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: 'Theme: System' });
    await expect(button).not.toHaveTextContent('System');
    await userEvent.hover(button);
    await expect(
      await canvas.findByRole('tooltip', { hidden: true }),
    ).toHaveTextContent('Theme: System');
  },
};

export const DrawerThemeButton: Story = {
  decorators: [
    (Story) => (
      <NarrowWindow>
        <Story />
      </NarrowWindow>
    ),
    withoutStoredTheme,
  ],
  play: async ({ canvasElement }) => {
    await openDrawer(canvasElement);
    await cycleThemes(within(canvasElement).getByRole('dialog'));
  },
};
