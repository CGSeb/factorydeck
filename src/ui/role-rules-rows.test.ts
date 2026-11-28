import { describe, expect, it } from 'vitest';
import {
  deletedFocus,
  errorsOf,
  movedFocus,
  movedRows,
  rowsOf,
  rulesOfRows,
  sameRules,
} from './role-rules-rows.ts';

const rules = [
  { name: 'builder', description: '^Build ', agentType: null },
  { name: 'explorer', description: null, agentType: '^Explore$' },
];

const rows = rowsOf(rules, (index) => `k${String(index)}`);

describe('role rule rows', () => {
  it('shows an absent pattern as empty and sends an empty one as absent', () => {
    expect(rows[1]).toEqual({
      key: 'k1',
      name: 'explorer',
      description: '',
      agentType: '^Explore$',
    });
    expect(rulesOfRows(rows)).toEqual(rules);
  });

  it('keeps names and patterns exactly as typed', () => {
    const typed = [{ ...rows[0]!, name: ' maker ', description: '^Make  ' }];
    expect(rulesOfRows(typed)).toEqual([
      { name: ' maker ', description: '^Make  ', agentType: null },
    ]);
  });

  it('compares rows with the rules by order and every field', () => {
    expect(sameRules(rows, rules)).toBe(true);
    expect(sameRules(movedRows(rows, 0, 1), rules)).toBe(false);
    expect(sameRules(rows.slice(1), rules)).toBe(false);
    expect(sameRules([{ ...rows[0]!, name: 'Builder' }, rows[1]!], rules)).toBe(
      false,
    );
  });

  it('moves a row by one and leaves the list as it is at an edge', () => {
    expect(movedRows(rows, 1, -1).map((row) => row.key)).toEqual(['k1', 'k0']);
    expect(movedRows(rows, 0, -1).map((row) => row.key)).toEqual(['k0', 'k1']);
  });
});

describe('focus after a change', () => {
  it('stays on the moved row, on the other move button at an edge', () => {
    expect(movedFocus(2, -1, 4)).toEqual({ index: 1, control: 'up' });
    expect(movedFocus(1, -1, 4)).toEqual({ index: 0, control: 'down' });
    expect(movedFocus(1, 1, 4)).toEqual({ index: 2, control: 'down' });
    expect(movedFocus(2, 1, 4)).toEqual({ index: 3, control: 'up' });
  });

  it('goes to the next Delete, the previous one for the last row, or Add rule', () => {
    expect(deletedFocus(1, 3)).toEqual({ index: 1, control: 'delete' });
    expect(deletedFocus(2, 3)).toEqual({ index: 1, control: 'delete' });
    expect(deletedFocus(0, 1)).toEqual({ index: 0, control: 'add' });
  });
});

describe('errorsOf', () => {
  it('puts a refusal under the field of the rule sent at its index', () => {
    expect(
      errorsOf(
        { status: 'invalid', field: 'agentType', rule: 1, message: 'Bad' },
        rows,
        'atlas',
      ),
    ).toEqual({ rows: { k1: { agentType: 'Bad' } } });
  });

  it('puts a refusal of the list, an unknown rule and failures under the section', () => {
    expect(
      errorsOf(
        { status: 'invalid', field: 'rules', rule: undefined, message: 'Many' },
        rows,
        'atlas',
      ),
    ).toEqual({ rows: {}, section: 'Many' });
    expect(
      errorsOf(
        { status: 'invalid', field: 'name', rule: 9, message: 'Gone' },
        rows,
        'atlas',
      ),
    ).toEqual({ rows: {}, section: 'Gone' });
    expect(errorsOf({ status: 'missing' }, rows, 'atlas')).toEqual({
      rows: {},
      section: 'atlas is no longer in FactoryDeck.',
    });
    expect(
      errorsOf({ status: 'failed', message: 'Down' }, rows, 'atlas'),
    ).toEqual({ rows: {}, section: 'Down' });
  });
});
