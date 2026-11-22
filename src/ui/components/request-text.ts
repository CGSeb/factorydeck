import type { ChecksSummary, RequestState } from '../../git-host/types.ts';

export const CHECKS_TEXT: Record<ChecksSummary, string> = {
  passing: 'Passing',
  failing: 'Failing',
  pending: 'Pending',
  none: 'No checks',
};

export function requestStateText({
  state,
  draft,
}: {
  state: RequestState;
  draft: boolean;
}): { key: string; text: string } {
  if (state === 'merged') return { key: 'merged', text: 'Merged' };
  if (state === 'closed') return { key: 'closed', text: 'Closed' };
  return draft
    ? { key: 'draft', text: 'Draft' }
    : { key: 'open', text: 'Open' };
}
