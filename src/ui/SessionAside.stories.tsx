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

export const WithoutWorkItem: Story = {
  args: { session: sessionWithoutSubAgents },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByText('Outcome')).toBeNull();
    await expect(canvas.getByText('—', { selector: 'dd' })).toBeVisible();
  },
};
