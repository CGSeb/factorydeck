import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { featuresLoaderOf } from './feature-fixtures.ts';
import { OverviewPage } from './OverviewPage.tsx';
import { bugBoardFeatures, fullBoardFeatures } from './overview-fixtures.ts';
import {
  address,
  column,
  overviewArgs,
  overviewRouter,
  section,
  title,
} from './overview-story.ts';

const meta = {
  title: 'OverviewPage/Kinds',
  component: OverviewPage,
  args: {
    ...overviewArgs,
    loadFeatures: featuresLoaderOf(bugBoardFeatures, true),
  },
  decorators: [overviewRouter],
} satisfies Meta<typeof OverviewPage>;

export default meta;

type Story = StoryObj<typeof meta>;

function board(canvasElement: HTMLElement): Promise<HTMLElement> {
  return within(canvasElement).findByRole('region', { name: 'Board' });
}

async function kindGroup(canvasElement: HTMLElement): Promise<HTMLElement> {
  return within(await board(canvasElement)).findByRole('group', {
    name: 'Kind',
  });
}

function card(canvasElement: HTMLElement, name: string): HTMLElement {
  const link = within(canvasElement).getByRole('link', { name });
  const found = link.closest('article');
  if (found === null) throw new Error(`No card ${name}`);
  return found;
}

export const BugsAndFeatures: Story = {
  play: async ({ canvasElement }) => {
    const kinds = within(await kindGroup(canvasElement));
    await expect(kinds.getByRole('button', { name: 'All' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(
      kinds.getByRole('button', { name: 'Features 6' }),
    ).toBeVisible();
    const audit = card(canvasElement, '#63 Audit log');
    const badges = within(audit).getByText('Bug').parentElement;
    await expect(badges).toHaveTextContent(/^BugNeeds spec$/);
    await expect(within(audit).getByText('Bug')).toHaveAttribute(
      'data-tone',
      'danger',
    );
    await expect(
      within(card(canvasElement, '#61 Bulk import')).queryByText('Bug'),
    ).toBeNull();
    await userEvent.click(kinds.getByRole('button', { name: 'Bugs 8' }));
    await expect(address(canvasElement)).toHaveTextContent(
      '/?period=7d&kind=bug',
    );
    await waitFor(async () =>
      expect(
        within(column(canvasElement, 'In review')).getByText('No issue'),
      ).toBeVisible(),
    );
  },
};

export const BugsSelected: Story = {
  parameters: { entry: '/?period=7d&kind=bug' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const kinds = within(await kindGroup(canvasElement));
    await expect(kinds.getByRole('button', { name: 'Bugs 8' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await canvas.findByRole('link', { name: '#57 Dark mode' });
    await waitFor(async () =>
      expect(await title(canvasElement)).toHaveTextContent(
        /^24 issues merged for /,
      ),
    );
    const merged = column(canvasElement, 'Merged');
    await expect(merged).toHaveTextContent(/^Merged6/);
    await expect(within(merged).getAllByRole('article')).toHaveLength(5);
    await expect(
      within(merged).getByRole('link', { name: '+ 1 more' }),
    ).toHaveAttribute('href', '/features?period=7d&stage=merged&kind=bug');
    await expect(
      within(column(canvasElement, 'In review')).getByText('No issue'),
    ).toBeVisible();
    await expect(
      canvas.getByRole('heading', { name: 'Needs a person' }),
    ).toBeVisible();
    await expect(
      within(section(canvasElement, /^Health$/)).getByRole('link', {
        name: 'Stats',
      }),
    ).toHaveAttribute('href', '/stats?period=7d');
    await userEvent.click(canvas.getByRole('button', { name: 'Last 30 days' }));
    await expect(address(canvasElement)).toHaveTextContent(
      '/?period=30d&kind=bug',
    );
  },
};

export const NoBugInPeriod: Story = {
  args: { loadFeatures: featuresLoaderOf(fullBoardFeatures, true) },
  parameters: { entry: '/?period=7d&kind=bug' },
  play: async ({ canvasElement }) => {
    const area = within(await board(canvasElement));
    await area.findByText('No bug in this period.');
    await expect(area.getByRole('button', { name: 'Bugs 0' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(area.queryByRole('heading', { name: /^Ready / })).toBeNull();
  },
};

export const WithoutBugTickets: Story = {
  args: { loadFeatures: featuresLoaderOf(fullBoardFeatures) },
  parameters: { entry: '/?period=7d&kind=bug' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('link', { name: '#61 Bulk import' });
    await expect(canvas.queryByRole('group', { name: 'Kind' })).toBeNull();
    await expect(
      within(column(canvasElement, 'Merged')).getAllByRole('article'),
    ).toHaveLength(5);
  },
};
