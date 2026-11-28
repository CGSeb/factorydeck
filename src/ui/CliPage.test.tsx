// @vitest-environment happy-dom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { CliLoginRead } from './cli-api.ts';
import { CliPage } from './CliPage.tsx';

afterEach(cleanup);

describe('CliPage', () => {
  it('shows nothing while the code of the URL is read, then the whole card', async () => {
    let answer: (read: CliLoginRead) => void = () => undefined;
    const { container } = render(
      <CliPage
        code="WDJB-MJHT"
        readCliLogin={() =>
          new Promise<CliLoginRead>((resolve) => {
            answer = resolve;
          })
        }
        decideCliLogin={() => Promise.resolve({ status: 'done' })}
      />,
    );
    expect(container.textContent).toBe('');
    await act(async () => {
      answer({
        status: 'ok',
        login: {
          machine: 'laptop',
          userCode: 'WDJB-MJHT',
          account: { name: 'Ada', email: 'ada@example.test' },
        },
      });
      await Promise.resolve();
    });
    expect(container.textContent).toContain('Connect the FactoryDeck CLI');
    expect(container.textContent).toContain(
      'laptop asks to send sessions as Ada (ada@example.test).',
    );
  });
});
