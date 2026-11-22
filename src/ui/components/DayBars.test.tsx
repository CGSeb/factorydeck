// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DayBars } from './DayBars.tsx';

describe('DayBars', () => {
  afterEach(cleanup);

  it('draws an empty chart and no table without buckets', () => {
    render(
      <DayBars
        label="Tokens per day"
        buckets={[]}
        color="var(--fd-ink)"
        height={56}
      />,
    );
    const chart = screen.getByRole('img', { name: 'Tokens per day' });
    expect(chart.querySelectorAll('[data-column]')).toHaveLength(0);
    expect(chart.querySelector('[data-labels]')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });
});
