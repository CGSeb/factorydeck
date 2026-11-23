import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { Aside } from './components/Aside.tsx';
import { SessionAside } from './SessionAside.tsx';
import {
  sessionWithSubAgents,
  sessionWithoutSubAgents,
} from './session-fixtures.ts';

const meta = {
  component: SessionAside,
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 360 }}>
        <Aside>
          <Story />
        </Aside>
      </div>
    ),
  ],
} satisfies Meta<typeof SessionAside>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithAnOutcome: Story = {
  args: { session: sessionWithSubAgents },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('4.2M')).toBeVisible();
    await expect(canvas.getByText('serenity 86')).toBeVisible();
    await expect(canvas.getByText('Working directory')).toBeVisible();
  },
};

export const MergedAfterAPerson: Story = {
  name: 'Merged after a person',
  args: {
    session: {
      ...sessionWithSubAgents,
      issueDetail:
        sessionWithSubAgents.issueDetail === null
          ? null
          : {
              ...sessionWithSubAgents.issueDetail,
              outcome: {
                stage: 'merged-after-person',
                report: { score: 88, threshold: 80, rounds: 2 },
                reworked: true,
              },
            },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Merged after a person')).toHaveAttribute(
      'data-tone',
      'success',
    );
    await expect(canvas.getByText('serenity 88')).toBeVisible();
  },
};

export const WithAScorePath: Story = {
  name: 'With a score path',
  args: {
    session: {
      ...sessionWithSubAgents,
      issueDetail:
        sessionWithSubAgents.issueDetail === null
          ? null
          : {
              ...sessionWithSubAgents.issueDetail,
              outcome: {
                stage: 'merged-after-person',
                report: { score: 88, threshold: 80, rounds: 2, firstScore: 64 },
                reworked: true,
              },
            },
    },
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('serenity 64 → 88'),
    ).toHaveAttribute('data-tone', 'success');
  },
};

export const WithoutWorkItem: Story = {
  args: { session: sessionWithoutSubAgents },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByText('Outcome')).toBeNull();
    await expect(canvas.getByText('—', { selector: 'dd' })).toBeVisible();
  },
};

export const WithFrictions: Story = {
  name: 'With frictions',
  args: { session: sessionWithSubAgents, project: '/work/app' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const link = canvas.getByRole('link', { name: '12' });
    await expect(link).toHaveAttribute(
      'href',
      `/frictions?period=all&project=%2Fwork%2Fapp&session=${sessionWithSubAgents.id}`,
    );
    await expect(link.closest('div')).toHaveTextContent('Frictions12');
  },
};

export const WithoutFriction: Story = {
  name: 'Without friction',
  args: { session: sessionWithoutSubAgents },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const term = canvas.getByText('Frictions');
    await expect(term.closest('div')).toHaveTextContent('FrictionsNone');
    await expect(term.closest('div')?.querySelector('a')).toBeNull();
  },
};
