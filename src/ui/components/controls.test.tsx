// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { FilterPills } from './FilterPills.tsx';
import { PeriodPills } from './PeriodPills.tsx';
import { ProjectPill } from './ProjectPill.tsx';
import { RefreshControl } from './RefreshControl.tsx';
import { ShowMore } from './ShowMore.tsx';
import { SortSelect } from './SortSelect.tsx';

const css = readFileSync(join(import.meta.dirname, 'controls.css'), 'utf8');
const ignore = (): void => undefined;

function rule(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  expect(start).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf('}', start));
}

function controls(): HTMLElement[] {
  const { container } = render(
    <>
      <PeriodPills value="7d" onChange={ignore} />
      <FilterPills
        label="State"
        value="a"
        options={[
          { value: 'a', label: 'A', count: 1 },
          { value: 'b', label: 'B', count: 2, dot: 'var(--fd-stage-ready)' },
        ]}
        onChange={ignore}
      />
      <SortSelect
        value="a"
        options={[{ value: 'a', label: 'A' }]}
        onChange={ignore}
      />
      <ShowMore shown={1} total={2} onShowMore={ignore} />
      <RefreshControl
        collectedAt={null}
        now={new Date()}
        refreshing={false}
        onRefresh={ignore}
      />
      <ProjectPill value={undefined} projects={[]} onChange={ignore} />
    </>,
  );
  return [...container.querySelectorAll<HTMLElement>('button, select')];
}

describe('controls', () => {
  beforeAll(() => {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.append(style);
  });
  afterEach(cleanup);

  it('draws a 2 px accent focus ring 2 px away from every control', () => {
    const focus = rule('.fd-control:focus-visible');
    expect(focus).toContain('outline: 2px solid var(--fd-accent);');
    expect(focus).toContain('outline-offset: 2px;');
    for (const control of controls()) {
      expect(control.classList).toContain('fd-control');
    }
  });

  it('gives every control a hit area at least 36 px high', () => {
    const found = controls();
    expect(found).toHaveLength(10);
    for (const control of found) {
      const style = getComputedStyle(control);
      expect(parseFloat(style.minHeight)).toBeGreaterThanOrEqual(36);
      expect(parseFloat(style.height)).toBeGreaterThanOrEqual(36);
    }
  });
});
