import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { type ReactElement, type ReactNode, useEffect, useState } from 'react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { ALL_PROJECTS, projectLabel } from '../ProjectSelect.tsx';
import type { IconName } from './Icon.tsx';
import { ProjectPill } from './ProjectPill.tsx';
import { RefreshControl, collectionText } from './RefreshControl.tsx';
import { chooseOption } from './select-test.ts';
import { Sidebar, type SidebarLink, type SidebarProps } from './Sidebar.tsx';
import { NARROW_QUERY } from './sidebar-state.ts';
import {
  expectDrawerClosed,
  currentLinks,
  expectFolded,
  foldAndUnfold,
  openDrawer,
  peek,
  storedFold,
  tapLabelWhilePeeked,
  tabStaysInDrawer,
  withStoredFold,
} from './sidebar-stories.ts';

const SECTIONS: readonly [string, IconName][] = [
  ['Overview', 'overview'],
  ['Features', 'features'],
  ['Sessions', 'sessions'],
  ['Skills', 'skills'],
  ['Roles', 'roles'],
];

function links(current: string): SidebarLink[] {
  return SECTIONS.map(([label, icon]) => ({
    label,
    icon,
    href: `#${label.toLowerCase()}`,
    current: label === current,
  }));
}

const PROJECTS = [
  { project: '/home/dev/example-app', name: 'Example App' },
  { project: '/home/dev/example-lib', name: 'example-lib' },
];
const COLLECTED = '2026-01-10T11:57:00Z';
const NOW = new Date('2026-01-10T12:00:00Z');

function Harness({
  current = 'Overview',
  withProject = true,
}: {
  current?: string;
  withProject?: boolean;
}): ReactElement {
  const [project, setProject] = useState<string>();
  const [followed, setFollowed] = useState('');
  const props: SidebarProps = {
    links: links(current),
    renderLink: ({ href, ...link }) => (
      <a
        href={href}
        {...link}
        onClick={(event) => {
          event.preventDefault();
          setFollowed(href);
        }}
      />
    ),
    project: withProject
      ? {
          label: projectLabel(project, PROJECTS),
          render: (control) => (
            <ProjectPill
              value={project}
              projects={PROJECTS}
              onChange={setProject}
              {...control}
            />
          ),
        }
      : undefined,
    refresh: {
      tip: collectionText(COLLECTED, NOW) ?? 'Refresh',
      render: (compact) => (
        <RefreshControl
          collectedAt={COLLECTED}
          now={NOW}
          refreshing={false}
          onRefresh={fn()}
          compact={compact}
        />
      ),
    },
  };
  return (
    <>
      <Sidebar {...props} />
      <output aria-label="Followed link">{followed}</output>
    </>
  );
}

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

function stored(fold: string | undefined): Decorator[] {
  return [
    (Story) => (
      <div
        style={{ display: 'flex', height: 560, background: 'var(--fd-page)' }}
      >
        <Story />
      </div>
    ),
    withStoredFold(fold),
  ];
}

const narrow: Decorator[] = [
  (Story) => (
    <NarrowWindow>
      <Story />
    </NarrowWindow>
  ),
  withStoredFold('collapsed'),
];

const meta = {
  component: Sidebar,
  args: { links: links('Overview') },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Sidebar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ExpandedFirstLinkCurrent: Story = {
  render: () => <Harness />,
  decorators: stored(undefined),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('complementary')).toHaveTextContent(
      'FactoryDeck',
    );
    await expect(currentLinks(canvasElement)).toEqual(['Overview']);
    await expect(
      canvas.getByRole('combobox', { name: 'Project' }),
    ).toBeInTheDocument();
    await expect(
      canvas.getByText('Issues updated 3 min ago'),
    ).toBeInTheDocument();
    await foldAndUnfold(canvasElement);
  },
};

export const ExpandedLastLinkCurrent: Story = {
  render: () => <Harness current="Roles" />,
  decorators: stored('something-else'),
  play: async ({ canvasElement }) => {
    await expectFolded(canvasElement, false);
    await expect(currentLinks(canvasElement)).toEqual(['Roles']);
  },
};

export const Folded: Story = {
  render: () => <Harness />,
  decorators: stored('collapsed'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expectFolded(canvasElement, true);
    await expect(canvas.getByRole('link', { name: 'Features' })).toBeVisible();
    await expect(
      canvas.getByRole('button', {
        name: /^Refresh ?, issues updated 3 min ago$/,
      }),
    ).toBeEnabled();
    await expect(canvas.queryByText('Issues updated 3 min ago')).toBeNull();
    await userEvent.click(
      canvas.getByRole('button', { name: `Project: ${ALL_PROJECTS}` }),
    );
    await expectFolded(canvasElement, false);
    const select = canvas.getByRole('combobox', { name: 'Project' });
    await expect(select).toHaveAttribute('aria-expanded', 'true');
    await chooseOption(select, 'Example App');
    await waitFor(() => expectFolded(canvasElement, true));
    await expect(storedFold()).toBe('collapsed');
    await expect(
      canvas.getByRole('button', { name: 'Project: Example App' }),
    ).toHaveFocus();
  },
};

export const FoldedWithTooltip: Story = {
  render: () => <Harness />,
  decorators: stored('collapsed'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.hover(canvas.getByRole('link', { name: 'Features' }));
    await expect(
      await canvas.findByRole('tooltip', { hidden: true }),
    ).toHaveTextContent('Features');
  },
};

export const FoldedTooltipOnFocus: Story = {
  render: () => <Harness />,
  decorators: stored('collapsed'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.tab();
    await expect(
      canvas.getByRole('button', { name: `Project: ${ALL_PROJECTS}` }),
    ).toHaveFocus();
    await expect(
      canvas.getByRole('tooltip', { hidden: true }),
    ).toHaveTextContent(`Project: ${ALL_PROJECTS}`);
    await userEvent.keyboard('{Escape}');
    await expect(canvas.queryByRole('tooltip', { hidden: true })).toBeNull();
  },
};

export const WithoutProjectSelect: Story = {
  render: () => <Harness withProject={false} />,
  decorators: stored(undefined),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('combobox')).toBeNull();
    await userEvent.click(
      canvas.getByRole('button', { name: 'Collapse sidebar' }),
    );
    await expect(canvas.queryByRole('button', { name: /^Project/ })).toBeNull();
  },
};

export const DrawerOpenAt360: Story = {
  render: () => <Harness />,
  decorators: narrow,
  play: async ({ canvasElement }) => {
    await openDrawer(canvasElement);
    const drawer = within(canvasElement).getByRole('dialog');
    await expect(within(drawer).getByRole('complementary')).toHaveAttribute(
      'data-folded',
      'false',
    );
    await expect(within(drawer).getByRole('combobox')).toBeInTheDocument();
    await expect(document.body.style.overflow).toBe('hidden');
    await tabStaysInDrawer();
  },
};

export const DrawerCloses: Story = {
  render: () => <Harness />,
  decorators: narrow,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await openDrawer(canvasElement);
    await userEvent.keyboard('{Escape}');
    await expectDrawerClosed(canvasElement);
    await openDrawer(canvasElement);
    await userEvent.click(
      canvas.getByRole('button', { name: 'Close navigation' }),
    );
    await expectDrawerClosed(canvasElement);
    await openDrawer(canvasElement);
    await userEvent.click(canvas.getByRole('link', { name: 'Sessions' }));
    await expectDrawerClosed(canvasElement);
    await openDrawer(canvasElement);
    const backdrop = canvas.getByRole('dialog').parentElement;
    if (backdrop === null) throw new Error('No backdrop');
    await userEvent.click(backdrop);
    await expectDrawerClosed(canvasElement);
    await expect(document.body.style.overflow).toBe('');
  },
};

export const FoldedPeekThenCollapse: Story = {
  render: () => <Harness />,
  decorators: stored('collapsed'),
  play: async ({ canvasElement }) => {
    await peek(canvasElement);
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: 'Collapse sidebar' }),
    );
    await waitFor(() => expectFolded(canvasElement, true));
    await expect(storedFold()).toBe('collapsed');
  },
};

export const FoldedPeekThenFollowLink: Story = {
  render: () => <Harness />,
  decorators: stored('collapsed'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await peek(canvasElement);
    await tapLabelWhilePeeked(canvasElement, 'Sessions');
    await expect(
      canvas.getByRole('status', { name: 'Followed link' }),
    ).toHaveTextContent('#sessions');
    await waitFor(() => expectFolded(canvasElement, true));
    await expect(storedFold()).toBe('collapsed');
  },
};
