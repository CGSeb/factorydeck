import { useSearchParams } from 'react-router';
import type { FeatureList, KindCounts } from '../features/types.ts';
import { type IssueKind, isIssueKind } from '../git-host/kind.ts';
import type { FilterOption } from './components/FilterPills.tsx';

export const KIND_PARAM = 'kind';

export type KindChoice = IssueKind | 'all';

export function kindOf(params: URLSearchParams): IssueKind | null {
  const value = params.get(KIND_PARAM);
  return isIssueKind(value) ? value : null;
}

export function withKind(
  params: URLSearchParams,
  kind: IssueKind | null,
): URLSearchParams {
  const next = new URLSearchParams(params);
  if (kind === null) next.delete(KIND_PARAM);
  else next.set(KIND_PARAM, kind);
  return next;
}

export function shownKind(
  list: Pick<FeatureList, 'bugTickets'>,
  kind: IssueKind | null,
): IssueKind | null {
  return list.bugTickets ? kind : null;
}

export function kindOptions(kinds: KindCounts): FilterOption<KindChoice>[] {
  return [
    { value: 'all', label: 'All' },
    { value: 'feature', label: 'Features', count: kinds.feature },
    { value: 'bug', label: 'Bugs', count: kinds.bug },
  ];
}

export function noKindText(kind: IssueKind): string {
  return kind === 'bug'
    ? 'No bug in this period.'
    : 'No feature in this period.';
}

export function useKindParam(): [
  IssueKind | null,
  (kind: IssueKind | null) => void,
] {
  const [params, setParams] = useSearchParams();
  return [
    kindOf(params),
    (kind) => {
      setParams((current) => withKind(current, kind));
    },
  ];
}
