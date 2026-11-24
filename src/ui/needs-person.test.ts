import { describe, expect, it } from 'vitest';
import { APP, LIB } from './feature-fixtures.ts';
import { needsPersonRows, waitText } from './needs-person.ts';
import { WAITING_NOW, someWaiting } from './waiting-fixtures.ts';

describe('needsPersonRows', () => {
  it('labels each reason, links the issue with the period and keeps the order', () => {
    const rows = needsPersonRows(someWaiting, { period: '30d' }, WAITING_NOW);
    expect(rows.map((row) => row.number)).toEqual([58, 63, 66, 71, 69]);
    expect(rows[1]).toMatchObject({
      label: '#63 Audit log filters',
      href: `/features/63?project=${encodeURIComponent(LIB)}&period=30d`,
      reasons: ['Blocked', 'Spec question'],
      wait: '3 h 05 min',
    });
    expect(rows[0]?.wait).toBe('1 d 4 h');
    expect(rows[0]?.reasons).toEqual(['Below threshold']);
    expect(rows[2]?.reasons).toEqual(['Gates failed']);
    expect(rows[3]?.wait).toBe('—');
  });

  it('colours the projects in the order of every project', () => {
    const rows = needsPersonRows(someWaiting, { period: '7d' }, WAITING_NOW);
    const app = rows.find((row) => row.project === APP);
    const lib = rows.find((row) => row.project === LIB);
    expect(app?.projectColor).not.toBe(lib?.projectColor);
  });

  it('shows only the number of an issue with no title', () => {
    const [first] = someWaiting.issues;
    if (first === undefined) throw new Error('No waiting issue');
    const rows = needsPersonRows(
      { ...someWaiting, issues: [{ ...first, title: ' ' }] },
      { period: '7d' },
      WAITING_NOW,
    );
    expect(rows[0]?.label).toBe('#58');
  });
});

describe('waitText', () => {
  it('shows the elapsed time, or — when the start is unknown', () => {
    const now = new Date('2026-11-24T15:00:00Z');
    expect(waitText('2026-11-24T11:55:00Z', now)).toBe('3 h 05 min');
    expect(waitText('2026-11-23T11:00:00Z', now)).toBe('1 d 4 h');
    expect(waitText(null, now)).toBe('—');
  });
});
