import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { WelcomePanel } from './WelcomePanel.tsx';

const meta = {
  component: WelcomePanel,
} satisfies Meta<typeof WelcomePanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('heading', { name: 'Install the factory in a project' }),
    ).toBeVisible();
    await expect(canvas.getByText('No factory project yet')).toBeVisible();
    await expect(
      canvas.getByText(
        'FactoryDeck shows the projects that use the factorydeck-skills workflow. None of yours does yet.',
      ),
    ).toBeVisible();
    await expect(
      canvas.getByText(
        'The project select appears once a project has sessions.',
      ),
    ).toBeVisible();
    const steps = canvas.getAllByRole('listitem');
    await expect(steps.map((step) => step.textContent)).toEqual([
      'Install factorydeck-skills in your coding agent: see the install steps.',
      'In your project, run /setup-factory. It writes docs/agents/factory.yml.',
      'Work in that project with your coding agent. FactoryDeck finds it at its next ingestion, earlier sessions included.',
    ]);
    const link = canvas.getByRole('link', { name: 'install steps' });
    await expect(link).toHaveAttribute(
      'href',
      'https://github.com/CGSeb/factorydeck-skills#install',
    );
    await userEvent.tab();
    await expect(link).toHaveFocus();
    await expect(
      [...canvasElement.querySelectorAll('code')].map(
        (code) => code.textContent,
      ),
    ).toEqual(['/setup-factory', 'docs/agents/factory.yml']);
  },
};
