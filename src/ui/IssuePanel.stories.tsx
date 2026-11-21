import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import {
  githubIssue,
  gitlabIssue,
  issueWithoutRequests,
} from './git-host-fixtures.ts';
import { IssuePanel } from './IssuePanel.tsx';

const meta = {
  component: IssuePanel,
  args: { issue: githubIssue },
} satisfies Meta<typeof IssuePanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const GitHubWithPullRequests: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const title = canvas.getByRole('link', { name: '#52 Export button' });
    await expect(title).toHaveAttribute('href', githubIssue.url);
    await expect(title).toHaveAttribute('target', '_blank');
    await expect(title.closest('div')).toHaveTextContent(
      '#52 Export buttonOpen',
    );
    const labels = within(canvas.getByRole('list', { name: 'Labels' }));
    await expect(
      labels.getAllByRole('listitem').map((label) => label.textContent),
    ).toEqual([
      'agent:review',
      'bug',
      'good first issue',
      'help wanted',
      'spec',
      'triage',
    ]);
    const requests = within(
      canvas.getByRole('list', { name: 'Pull requests' }),
    );
    await expect(
      requests.getAllByRole('listitem').map((row) => row.textContent),
    ).toEqual([
      '#58 feat: Export buttonDraftPending',
      '#55 feat: Export button, second tryOpenFailing',
      '#54 feat: Export button, first tryClosedNo checks',
      '#53 feat: Export data modelMergedPassing',
    ]);
  },
};

export const GitLabWithMergeRequests: Story = {
  args: { issue: gitlabIssue },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('link', { name: '#21 Add the refunds endpoint' })
        .parentElement?.nextElementSibling,
    ).toHaveTextContent('Closed');
    const requests = within(
      canvas.getByRole('list', { name: 'Merge requests' }),
    );
    await expect(
      requests.getByRole('link', { name: '!12 Add the refunds endpoint' }),
    ).toHaveAttribute('href', gitlabIssue.requests[0]?.url);
  },
};

export const NoPullRequestClosesIt: Story = {
  args: { issue: issueWithoutRequests },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText('No pull request closes this issue.'),
    ).toBeVisible();
    await expect(canvas.queryByRole('list', { name: 'Labels' })).toBeNull();
  },
};

export const NoMergeRequestClosesIt: Story = {
  args: { issue: { ...gitlabIssue, requests: [] } },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('No merge request closes this issue.'),
    ).toBeVisible();
  },
};
