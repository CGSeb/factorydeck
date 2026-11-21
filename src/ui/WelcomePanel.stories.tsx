import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
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
    const steps = canvas.getAllByRole('listitem');
    await expect(steps.map((step) => step.textContent)).toEqual([
      'Install the plugin in Claude Code: /plugin marketplace add CGSeb/factorydeck-skills, then /plugin install factorydeck-skills@factorydeck.',
      'In your project, run /setup-factory. It writes docs/agents/factory.yml.',
      'Work in that project with Claude Code. FactoryDeck finds it at its next ingestion, earlier sessions included.',
    ]);
    await expect(
      [...canvasElement.querySelectorAll('code')].map(
        (code) => code.textContent,
      ),
    ).toEqual([
      '/plugin marketplace add CGSeb/factorydeck-skills',
      '/plugin install factorydeck-skills@factorydeck',
      '/setup-factory',
      'docs/agents/factory.yml',
    ]);
  },
};
