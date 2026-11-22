import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import { ProjectPill } from './ProjectPill.tsx';
import { RefreshControl } from './RefreshControl.tsx';
import { TopBar, type TopBarLink } from './TopBar.tsx';

const SECTIONS = ['Overview', 'Features', 'Roles', 'Skills', 'Sessions'];

function links(current: string): TopBarLink[] {
  return SECTIONS.map((label) => ({
    label,
    href: `/${label.toLowerCase()}`,
    current: label === current,
  }));
}

const actions = (
  <>
    <ProjectPill
      value={undefined}
      projects={[
        { project: '/home/dev/example-app', name: 'Example App' },
        { project: '/home/dev/example-lib', name: 'example-lib' },
      ]}
      onChange={fn()}
    />
    <RefreshControl
      collectedAt="2026-01-10T11:55:00Z"
      now={new Date('2026-01-10T12:00:00Z')}
      refreshing={false}
      onRefresh={fn()}
    />
  </>
);

const pageFrame: Decorator = (Story) => (
  <div style={{ background: 'var(--fd-page)', minHeight: 160 }}>
    <Story />
  </div>
);

const meta = {
  component: TopBar,
  args: { links: links('Overview'), actions },
  decorators: [pageFrame],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof TopBar>;

export default meta;

type Story = StoryObj<typeof meta>;

function current(canvasElement: HTMLElement): string[] {
  const nav = within(canvasElement).getByRole('navigation', {
    name: 'Sections',
  });
  return within(nav)
    .getAllByRole('link')
    .filter((link) => link.getAttribute('aria-current') === 'page')
    .map((link) => link.textContent);
}

export const FirstLinkCurrent: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('banner')).toHaveTextContent('FactoryDeck');
    await expect(
      canvas.getAllByRole('link').map((link) => link.getAttribute('href')),
    ).toEqual(['/overview', '/features', '/roles', '/skills', '/sessions']);
    await expect(current(canvasElement)).toEqual(['Overview']);
    await expect(
      canvas.getByRole('combobox', { name: 'Project' }),
    ).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: /Refresh/ })).toBeEnabled();
  },
};

export const LastLinkCurrent: Story = {
  args: { links: links('Sessions') },
  play: async ({ canvasElement }) => {
    await expect(current(canvasElement)).toEqual(['Sessions']);
  },
};

export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 360 }}>
        <Story />
      </div>
    ),
  ],
};

export const Medium: Story = {
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 1024 }}>
        <Story />
      </div>
    ),
  ],
};
