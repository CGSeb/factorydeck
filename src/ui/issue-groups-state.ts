import { useState } from 'react';
import { LIST_GROUPS, type ListGroup } from './features-list.ts';

export const COLLAPSED_GROUPS_KEY = 'factorydeck.features.collapsed';

function isListGroup(value: unknown): value is ListGroup {
  return LIST_GROUPS.some((group) => group === value);
}

export function readCollapsedGroups(): ReadonlySet<ListGroup> {
  try {
    const stored = window.localStorage.getItem(COLLAPSED_GROUPS_KEY);
    const parsed: unknown = stored === null ? [] : JSON.parse(stored);
    return new Set(Array.isArray(parsed) ? parsed.filter(isListGroup) : []);
  } catch {
    return new Set();
  }
}

export function writeCollapsedGroups(groups: ReadonlySet<ListGroup>): void {
  try {
    if (groups.size === 0) {
      window.localStorage.removeItem(COLLAPSED_GROUPS_KEY);
    } else {
      const ordered = LIST_GROUPS.filter((group) => groups.has(group));
      window.localStorage.setItem(
        COLLAPSED_GROUPS_KEY,
        JSON.stringify(ordered),
      );
    }
  } catch {
    return;
  }
}

export function useCollapsedGroups(): [
  ReadonlySet<ListGroup>,
  (group: ListGroup) => void,
] {
  const [collapsed, setCollapsed] = useState(readCollapsedGroups);
  function toggle(group: ListGroup): void {
    const next = new Set(collapsed);
    if (next.has(group)) next.delete(group);
    else next.add(group);
    writeCollapsedGroups(next);
    setCollapsed(next);
  }
  return [collapsed, toggle];
}
