import type { Meta, StoryObj } from '@storybook/react-vite';
import { MemoryRouter } from 'react-router';
import { expect, within } from 'storybook/test';
import { fixedBug, versionedBug } from './bug-detail-fixtures.ts';
import {
  exportFeature,
  uncollectedFeature,
} from './feature-detail-fixtures.ts';
import { issueColors, issueSteps } from './issue-page.ts';
import {
  IssueAside,
  IssueTitle,
  NO_ACTIVITY,
  TimelinePanel,
} from './IssueParts.tsx';

const NOW = new Date('2026-11-20T09:00:00.000Z');

const [firstVersion, middleVersion] = versionedBug;

const meta = {
  title: 'IssueParts',
  component: TimelinePanel,
  decorators: [
    (Story) => (
      <MemoryRouter>
        <div style={{ maxWidth: 720 }}>
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
  args: {
    feature: exportFeature,
    kind: 'feature',
    steps: issueSteps(exportFeature),
  },
} satisfies Meta<typeof TimelinePanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const FeatureTimeline: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('heading', { name: 'How it got merged' }),
    ).toBeVisible();
  },
};

export const FeatureWithoutActivity: Story = {
  args: { steps: [] },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(NO_ACTIVITY.feature),
    ).toBeVisible();
  },
};

export const ReopenedVersionWithoutThread: Story = {
  args:
    middleVersion === undefined
      ? {}
      : { feature: middleVersion, kind: 'bug', steps: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Reopened')).toBeVisible();
    await expect(canvas.queryByText(NO_ACTIVITY.bug)).toBeNull();
  },
};

export const BugVersionWithoutActivity: Story = {
  args:
    firstVersion === undefined
      ? {}
      : { feature: firstVersion, kind: 'bug', steps: [] },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(NO_ACTIVITY.bug),
    ).toBeVisible();
  },
};

export const FoundTitle: Story = {
  render: () => (
    <h1>
      <IssueTitle feature={exportFeature} />
    </h1>
  ),
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('heading', {
        name: 'Export button (#52)',
      }),
    ).toBeVisible();
  },
};

export const UncollectedTitle: Story = {
  render: () => (
    <h1>
      <IssueTitle feature={uncollectedFeature} />
    </h1>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('heading')).toHaveTextContent(
      '#28',
    );
  },
};

export const BugAsideWithVersions: Story = {
  render: () =>
    firstVersion === undefined ? (
      <></>
    ) : (
      <IssueAside
        feature={firstVersion}
        colors={issueColors(firstVersion)}
        period="all"
        bug={{ now: NOW }}
      />
    ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Fix')).toBeVisible();
    await expect(canvas.getByText('Version 1')).toBeVisible();
  },
};

export const BugAsideWithOneVersion: Story = {
  render: () => (
    <IssueAside
      feature={fixedBug}
      colors={issueColors(fixedBug)}
      period="all"
      bug={{ now: NOW }}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Fix')).toBeVisible();
    await expect(canvasElement.querySelector('.fd-version')).toBeNull();
  },
};

export const FeatureAside: Story = {
  render: () => (
    <IssueAside
      feature={exportFeature}
      colors={issueColors(exportFeature)}
      period="all"
      bug={null}
    />
  ),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('.fd-fix')).toBeNull();
  },
};
