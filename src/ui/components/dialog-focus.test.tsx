// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { type ReactElement, useRef } from 'react';
import { userEvent } from 'storybook/test';
import { afterEach, describe, expect, it } from 'vitest';
import { useDialogFocus } from './dialog-focus.ts';

function Trap({ withLinks }: { withLinks: boolean }): ReactElement {
  const dialog = useRef<HTMLDivElement>(null);
  const cancel = useDialogFocus(() => undefined, dialog, withLinks);
  return (
    <div ref={dialog} role="dialog" aria-label="Trap">
      <button type="button" ref={cancel}>
        Cancel
      </button>
      <button type="button">Confirm</button>
      <a href="#more">More</a>
    </div>
  );
}

async function stopsAfterConfirm(withLinks: boolean): Promise<string[]> {
  render(<Trap withLinks={withLinks} />);
  screen.getByRole('button', { name: 'Confirm' }).focus();
  const stops: string[] = [];
  for (let step = 0; step < 3; step += 1) {
    await userEvent.tab();
    stops.push(document.activeElement?.textContent ?? '');
  }
  return stops;
}

describe('useDialogFocus', () => {
  afterEach(cleanup);

  it('cycles through buttons only by default', async () => {
    expect(await stopsAfterConfirm(false)).toEqual([
      'Cancel',
      'Confirm',
      'Cancel',
    ]);
  });

  it('also cycles through links when asked', async () => {
    expect(await stopsAfterConfirm(true)).toEqual([
      'More',
      'Cancel',
      'Confirm',
    ]);
  });
});
