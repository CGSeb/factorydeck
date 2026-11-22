import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { TokenAmount } from './TokenAmount.tsx';

const COUNTS = {
  input: 1_200,
  output: 950,
  cacheRead: 41_800_000,
  cacheWrite: 320_000,
};

const meta = {
  component: TokenAmount,
  args: { counts: COUNTS, costUsd: 27.4 },
  decorators: [
    (Story) => (
      <div
        style={{
          fontFamily: 'var(--fd-font-body)',
          fontSize: 'var(--fd-text-md)',
          color: 'var(--fd-ink)',
          padding: 'calc(var(--fd-space-8) * 5) 0',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TokenAmount>;

export default meta;

type Story = StoryObj<typeof meta>;

function amount(canvasElement: HTMLElement): HTMLElement {
  return within(canvasElement).getByText('42.1M');
}

function tooltip(canvasElement: HTMLElement): HTMLElement {
  return within(canvasElement).getByRole('tooltip', { hidden: true });
}

async function openByFocus(canvasElement: HTMLElement): Promise<void> {
  await userEvent.tab();
  await expect(amount(canvasElement)).toHaveFocus();
  await waitFor(() => expect(tooltip(canvasElement)).toBeVisible());
}

export const Inline: Story = {
  render: (args) => (
    <p>
      This feature used <TokenAmount {...args} /> tokens so far.
    </p>
  ),
  play: async ({ canvasElement }) => {
    const number = amount(canvasElement);
    await expect(tooltip(canvasElement)).not.toBeVisible();
    await userEvent.hover(number);
    await waitFor(() => expect(tooltip(canvasElement)).toBeVisible());
    await userEvent.hover(tooltip(canvasElement));
    await expect(tooltip(canvasElement)).toBeVisible();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(tooltip(canvasElement)).not.toBeVisible());
    await userEvent.unhover(number.parentElement ?? number);
    await userEvent.hover(number);
    await waitFor(() => expect(tooltip(canvasElement)).toBeVisible());
    await userEvent.unhover(number.parentElement ?? number);
    await waitFor(() => expect(tooltip(canvasElement)).not.toBeVisible());
  },
};

export const Strong: Story = {
  args: { size: 'strong' },
  play: async ({ canvasElement }) => {
    await openByFocus(canvasElement);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(tooltip(canvasElement)).not.toBeVisible());
    await expect(amount(canvasElement)).toHaveFocus();
    await userEvent.tab();
    await userEvent.tab({ shift: true });
    await expect(amount(canvasElement)).toHaveFocus();
    await waitFor(() => expect(tooltip(canvasElement)).toBeVisible());
    amount(canvasElement).blur();
    await waitFor(() => expect(tooltip(canvasElement)).not.toBeVisible());
  },
};

export const Figure: Story = {
  args: { size: 'figure' },
  play: async ({ canvasElement }) => {
    await expect(amount(canvasElement)).toHaveStyle({ fontWeight: '600' });
  },
};

export const TooltipOpen: Story = {
  name: 'Tooltip open',
  play: async ({ canvasElement }) => {
    await openByFocus(canvasElement);
    await expect(tooltip(canvasElement)).toHaveTextContent(
      'Cost ~$27.40 Input 1.2K Output 950 Cache read 41.8M Cache write 320.0K',
    );
    await expect(amount(canvasElement)).toHaveAccessibleDescription(
      'Cost ~$27.40 Input 1.2K Output 950 Cache read 41.8M Cache write 320.0K',
    );
  },
};

export const Below: Story = {
  args: { placement: 'below' },
  play: async ({ canvasElement }) => {
    await userEvent.hover(amount(canvasElement));
    await waitFor(() => expect(tooltip(canvasElement)).toBeVisible());
    await expect(tooltip(canvasElement)).toHaveStyle({ top: '100%' });
  },
};

export const UnknownPrice: Story = {
  name: 'Unknown price',
  args: { costUsd: null, unknownPriceCalls: 4 },
  play: async ({ canvasElement }) => {
    await openByFocus(canvasElement);
    await expect(tooltip(canvasElement)).toHaveTextContent(
      'Cost — Price unknown for every call Input 1.2K',
    );
  },
};

export const SomeUnknownPrices: Story = {
  name: 'Some unknown prices',
  args: { unknownPriceCalls: 2 },
  play: async ({ canvasElement }) => {
    await openByFocus(canvasElement);
    await expect(tooltip(canvasElement)).toHaveTextContent(
      'Cost ~$27.40 Excludes 2 calls with unknown price Input 1.2K',
    );
  },
};

export const Zero: Story = {
  args: {
    counts: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    costUsd: 0,
  },
  play: async ({ canvasElement }) => {
    await userEvent.tab();
    await expect(document.activeElement).toHaveTextContent(/^0$/);
    await waitFor(() => expect(tooltip(canvasElement)).toBeVisible());
    await expect(tooltip(canvasElement)).toHaveTextContent(
      'Cost ~$0.00 Input 0 Output 0 Cache read 0 Cache write 0',
    );
  },
};

export const NearTheEdge: Story = {
  name: 'Near the edge',
  args: { placement: 'below', unknownPriceCalls: 2 },
  decorators: [
    (Story) => (
      <div
        style={{
          width: '360px',
          maxWidth: '100%',
          display: 'flex',
          justifyContent: 'flex-end',
          outline: '1px dashed var(--fd-border)',
        }}
      >
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    await openByFocus(canvasElement);
  },
};
