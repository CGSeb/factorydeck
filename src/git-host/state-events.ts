import type { StateEvent } from './types.ts';

function byTime(left: StateEvent, right: StateEvent): number {
  return left.at < right.at ? -1 : left.at > right.at ? 1 : 0;
}

export function stateOf(events: readonly StateEvent[]): {
  reopened: boolean;
  stateEvents: StateEvent[];
} {
  const stateEvents = [...events].sort(byTime);
  return {
    reopened: stateEvents.some((event) => event.state === 'reopened'),
    stateEvents,
  };
}
