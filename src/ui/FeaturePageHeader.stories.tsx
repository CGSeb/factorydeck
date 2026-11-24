import type { Meta, StoryObj } from '@storybook/react-vite';
import { MemoryRouter, Route, Routes } from 'react-router';
import { expect, within } from 'storybook/test';
import { featureLoaderOf, idleFeature } from './feature-detail-fixtures.ts';
import { FeaturePage } from './FeaturePage.tsx';

const meta = {
  title: 'FeaturePage/Header',
  component: FeaturePage,
  args: { loadFeature: featureLoaderOf() },
  decorators: [
    (Story, { parameters }) => (
      <MemoryRouter initialEntries={[String(parameters['entry'])]}>
        <Routes>
          <Route path="/features/:number" element={<Story />} />
        </Routes>
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof FeaturePage>;

export default meta;

type Story = StoryObj<typeof meta>;

const LONG_TITLE =
  'Explain on the overview why a feature waited for a person before it could be merged';

export const LongTitle: Story = {
  args: {
    loadFeature: featureLoaderOf([
      {
        ...idleFeature,
        number: 75,
        issue: {
          status: 'found',
          title: LONG_TITLE,
          url: 'https://github.com/example-org/example-app/issues/75',
        },
      },
    ]),
  },
  parameters: {
    entry: '/features/75?project=%2Fhome%2Fdev%2Fexample-app&period=all',
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 360 }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const heading = await canvas.findByRole('heading', {
      name: `${LONG_TITLE} (#75)`,
    });
    await expect(heading.querySelector('.fd-issue-number')).toHaveTextContent(
      /^\(#75\)$/,
    );
    await expect(
      canvas.getByRole('link', { name: LONG_TITLE }),
    ).toHaveAttribute(
      'href',
      'https://github.com/example-org/example-app/issues/75',
    );
  },
};

export const IssueUnknownToHost: Story = {
  name: 'Issue unknown to the git host',
  args: {
    loadFeature: featureLoaderOf([
      { ...idleFeature, number: 74, issue: { status: 'not-found' } },
    ]),
  },
  parameters: {
    entry: '/features/74?project=%2Fhome%2Fdev%2Fexample-app&period=all',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const heading = await canvas.findByRole('heading', {
      name: '#74 (not found)',
    });
    await expect(heading.querySelector('.fd-issue-number')).toHaveTextContent(
      /^#74$/,
    );
    await expect(within(heading).queryByRole('link')).toBeNull();
  },
};
