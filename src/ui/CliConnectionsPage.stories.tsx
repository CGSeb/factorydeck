import type { Meta, StoryObj } from '@storybook/react-vite';
import { MemoryRouter } from 'react-router';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { DATABASE_UNREACHABLE } from './auth-api.ts';
import {
  CONNECTIONS_NOW,
  DEMO_ORIGIN,
  connectionsLoaderOf,
  connectionsResponse,
  disconnectAnswer,
  pendingConnections,
  pendingDisconnect,
  someConnections,
} from './cli-connections-fixtures.ts';
import { CliConnectionsPage } from './CliConnectionsPage.tsx';
import { UNREACHABLE_MESSAGE } from './overview-api.ts';

const meta = {
  component: CliConnectionsPage,
  args: {
    loadCliConnections: connectionsLoaderOf(
      connectionsResponse(someConnections),
    ),
    disconnectCliConnection: fn(disconnectAnswer({ status: 'disconnected' })),
    origin: DEMO_ORIGIN,
    now: CONNECTIONS_NOW,
  },
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/account/cli']}>
        <Story />
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof CliConnectionsPage>;

export default meta;

type Story = StoryObj<typeof meta>;

const QUESTION = 'Disconnect ada-laptop?';
const TEXT = 'Its CLI stops sending until you log in again.';

function rowTexts(canvasElement: HTMLElement): string[][] {
  return [...canvasElement.querySelectorAll('tbody tr')].map((row) =>
    [...row.children].map((cell) => cell.textContent),
  );
}

async function askToDisconnect(
  canvasElement: HTMLElement,
): Promise<HTMLElement> {
  const canvas = within(canvasElement);
  await userEvent.click(
    await canvas.findByRole('button', { name: 'Disconnect ada-laptop' }),
  );
  return canvas.getByRole('dialog', { name: QUESTION });
}

export const Loading: Story = {
  args: { loadCliConnections: pendingConnections() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('heading', { level: 1, name: 'CLI connections' }),
    ).toBeVisible();
    await expect(canvas.getByText('Loading…')).toBeVisible();
    await expect(
      canvasElement.querySelector('.fd-page-summary[aria-hidden="true"]'),
    ).not.toBeNull();
  },
};

export const Empty: Story = {
  args: { loadCliConnections: connectionsLoaderOf(connectionsResponse([])) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const line = await canvas.findByText(/^No machine connected\./);
    await expect(line).toHaveTextContent(
      `No machine connected. Run factorydeck login ${DEMO_ORIGIN} in a terminal.`,
    );
    await expect(line.querySelector('code')).toHaveTextContent(
      `factorydeck login ${DEMO_ORIGIN}`,
    );
    await expect(canvas.getByText('0 machines')).toBeVisible();
    await expect(canvas.queryByRole('table')).toBeNull();
  },
};

export const OneMachine: Story = {
  args: {
    loadCliConnections: connectionsLoaderOf(
      connectionsResponse(someConnections.slice(0, 1)),
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('table', { name: 'CLI connections' });
    await expect(canvas.getByText('1 machine')).toBeVisible();
  },
};

export const List: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const table = await canvas.findByRole('table', { name: 'CLI connections' });
    await expect(canvas.getByText('3 machines')).toBeVisible();
    await expect(
      [...table.querySelectorAll('thead th')].map((cell) => cell.textContent),
    ).toEqual(['Machine', 'Connected', 'Last used', 'Actions']);
    await expect(rowTexts(canvasElement)).toEqual([
      ['ada-laptop', '2 Mar 2026', '2 min ago', 'Disconnect'],
      ['build-box.example.test', '11 Feb 2026', '3 h ago', 'Disconnect'],
      ['old-desktop', '20 Jan 2026', '11 d ago', 'Disconnect'],
    ]);
    const lastUsed = table.querySelector(
      'tbody tr time[datetime="2026-03-12T09:58:00Z"]',
    );
    await expect(lastUsed).not.toBeNull();
    await expect(lastUsed?.getAttribute('title')).not.toBe('');
  },
};

export const Confirm: Story = {
  play: async ({ canvasElement, args }) => {
    const dialog = await askToDisconnect(canvasElement);
    await expect(dialog).toHaveTextContent(QUESTION);
    await expect(dialog).toHaveTextContent(TEXT);
    const confirm = within(dialog).getByRole('button', { name: 'Disconnect' });
    await expect(confirm).toHaveAttribute('data-danger', 'true');
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Cancel' }),
    );
    await expect(within(canvasElement).queryByRole('dialog')).toBeNull();
    await expect(args.disconnectCliConnection).not.toHaveBeenCalled();
    await expect(rowTexts(canvasElement)).toHaveLength(3);
  },
};

export const Disconnecting: Story = {
  args: { disconnectCliConnection: fn(pendingDisconnect()) },
  play: async ({ canvasElement, args }) => {
    const dialog = await askToDisconnect(canvasElement);
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Disconnect' }),
    );
    await expect(
      within(dialog).getByRole('button', { name: 'Disconnecting…' }),
    ).toBeDisabled();
    await expect(args.disconnectCliConnection).toHaveBeenCalledWith(3);
    await userEvent.keyboard('{Escape}');
    await expect(within(canvasElement).getByRole('dialog')).toBeVisible();
  },
};

export const Disconnected: Story = {
  play: async ({ canvasElement, args }) => {
    const dialog = await askToDisconnect(canvasElement);
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Disconnect' }),
    );
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.queryByRole('dialog')).toBeNull());
    await expect(args.disconnectCliConnection).toHaveBeenCalledWith(3);
    await waitFor(() =>
      expect(rowTexts(canvasElement).map(([machine]) => machine)).toEqual([
        'build-box.example.test',
        'old-desktop',
      ]),
    );
    await expect(canvas.getByText('2 machines')).toBeVisible();
    await waitFor(() =>
      expect(
        canvas.getByRole('button', {
          name: 'Disconnect build-box.example.test',
        }),
      ).toHaveFocus(),
    );
  },
};

export const DisconnectedLast: Story = {
  args: {
    loadCliConnections: connectionsLoaderOf(
      connectionsResponse(someConnections.slice(0, 1)),
    ),
  },
  play: async ({ canvasElement }) => {
    const dialog = await askToDisconnect(canvasElement);
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Disconnect' }),
    );
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText(/^No machine connected\./),
    ).toBeVisible();
    await waitFor(() =>
      expect(
        canvasElement.querySelector('.fd-cli-connections-page'),
      ).toHaveFocus(),
    );
  },
};

export const DisconnectError: Story = {
  args: {
    disconnectCliConnection: fn(
      disconnectAnswer({ status: 'failed', message: DATABASE_UNREACHABLE }),
    ),
  },
  play: async ({ canvasElement }) => {
    const dialog = await askToDisconnect(canvasElement);
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Disconnect' }),
    );
    await expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      DATABASE_UNREACHABLE,
    );
    await expect(
      within(dialog).getByRole('button', { name: 'Disconnect' }),
    ).toBeEnabled();
    await expect(rowTexts(canvasElement)).toHaveLength(3);
  },
};

export const LoadError: Story = {
  args: {
    loadCliConnections: connectionsLoaderOf({
      status: 'unreachable',
      refreshSeconds: 3600,
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText(UNREACHABLE_MESSAGE)).toBeVisible();
    await expect(canvas.queryByRole('table')).toBeNull();
  },
};
