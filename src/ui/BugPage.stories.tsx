import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactElement } from 'react';
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { APP, LIB } from './feature-fixtures.ts';
import { bugPageLoader } from './bug-detail-fixtures.ts';
import type { LoadFeature } from './features-api.ts';
import { FeaturePage } from './FeaturePage.tsx';
import { NO_FIX_TEXT } from './FixBlock.tsx';

function Location(): ReactElement {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output aria-label="Address">{`${pathname}${search}`}</output>
      <button
        type="button"
        onClick={() => {
          void navigate(-1);
        }}
      >
        Browser back
      </button>
    </>
  );
}

function IssuePages({
  entry,
  loadFeature,
}: {
  entry: string;
  loadFeature: LoadFeature;
}): ReactElement {
  return (
    <MemoryRouter initialEntries={['/', entry]} initialIndex={1}>
      <Routes>
        <Route
          path="/features/:number"
          element={
            <>
              <FeaturePage loadFeature={loadFeature} />
              <Location />
            </>
          }
        />
        <Route
          path="/bugs/:number"
          element={
            <>
              <FeaturePage loadFeature={loadFeature} kind="bug" />
              <Location />
            </>
          }
        />
        <Route path="*" element={<Location />} />
      </Routes>
    </MemoryRouter>
  );
}

function query(project: string): string {
  return `?project=${encodeURIComponent(project)}&period=all`;
}

const meta = {
  title: 'BugPage',
  component: FeaturePage,
  args: { loadFeature: bugPageLoader(), kind: 'bug' },
  parameters: { entry: `/bugs/70${query(APP)}` },
  render: (args, { parameters }) => {
    const entry: unknown = parameters['entry'];
    return (
      <IssuePages
        entry={typeof entry === 'string' ? entry : '/'}
        loadFeature={args.loadFeature}
      />
    );
  },
} satisfies Meta<typeof FeaturePage>;

export default meta;

type Story = StoryObj<typeof meta>;

function address(canvasElement: HTMLElement): HTMLElement {
  return within(canvasElement).getByRole('status', { name: 'Address' });
}

export const FixedBug: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('heading', {
      name: 'Empty state shows twice (#70)',
    });
    const block = canvasElement.querySelector<HTMLElement>('.fd-fix');
    if (block === null) throw new Error('No Fix block');
    await expect(block.parentElement?.firstElementChild).toBe(block);
    await expect(block.parentElement).toHaveTextContent(/^Fix.*Tokens/);
    const fix = within(block);
    await expect(
      fix.getByText('The empty state renders in the list and in the panel.'),
    ).toBeVisible();
    await expect(fix.getByText('Failed on main')).toHaveAttribute(
      'data-tone',
      'success',
    );
    await expect(fix.getByRole('link', { name: '#81' })).toHaveAttribute(
      'href',
      'https://github.com/example-org/example-app/pull/81',
    );
    await userEvent.click(
      canvas.getByRole('link', { name: '← Example App bugs' }),
    );
    await expect(address(canvasElement)).toHaveTextContent(
      /^\/bugs\?period=all&project=%2Fhome%2Fdev%2Fexample-app$/,
    );
  },
};

export const BugWithoutFix: Story = {
  parameters: { entry: `/bugs/75${query(APP)}` },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('heading', {
      name: 'Login loops on refresh (#75)',
    });
    const fix = canvasElement.querySelector('.fd-aside > .fd-fix');
    await expect(fix).toHaveTextContent(`Fix${NO_FIX_TEXT}`);
  },
};

export const BugOnTheFeaturesPage: Story = {
  parameters: { entry: `/features/70${query(APP)}&sort=cost` },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('heading', {
      name: 'Empty state shows twice (#70)',
    });
    await expect(address(canvasElement)).toHaveTextContent(
      /^\/bugs\/70\?project=%2Fhome%2Fdev%2Fexample-app&period=all&sort=cost$/,
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Browser back' }));
    await waitFor(() =>
      expect(address(canvasElement)).toHaveTextContent(/^\/$/),
    );
  },
};

export const FeatureOnTheBugsPage: Story = {
  parameters: { entry: `/bugs/52${query(APP)}` },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('heading', { name: 'Export button (#52)' });
    await expect(address(canvasElement)).toHaveTextContent(
      /^\/features\/52\?project=%2Fhome%2Fdev%2Fexample-app&period=all$/,
    );
    await expect(canvasElement.querySelector('.fd-fix')).toBeNull();
    await expect(
      canvas.getByRole('link', { name: '← Example App features' }),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Browser back' }));
    await waitFor(() =>
      expect(address(canvasElement)).toHaveTextContent(/^\/$/),
    );
  },
};

export const UnknownIssue: Story = {
  parameters: { entry: `/bugs/404${query(APP)}` },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('Issue not found.');
    await expect(address(canvasElement)).toHaveTextContent(/^\/bugs\/404\?/);
    await userEvent.click(canvas.getByRole('link', { name: '← Bugs' }));
    await expect(address(canvasElement)).toHaveTextContent(
      /^\/bugs\?project=%2Fhome%2Fdev%2Fexample-app$/,
    );
  },
};

export const IssueOfNoKind: Story = {
  parameters: { entry: `/bugs/28${query(LIB)}` },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('Issue not found.');
    await expect(address(canvasElement)).toHaveTextContent(
      /^\/bugs\/28\?project=%2Fhome%2Fdev%2Fexample-lib&period=all$/,
    );
    await expect(canvas.getByRole('link', { name: '← Bugs' })).toBeVisible();
  },
};
