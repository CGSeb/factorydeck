import { type IssueKind, kindOf } from '../git-host/kind.ts';
import type { IssueRow, RequestRow } from '../git-host/query.ts';
import type { ProjectState } from './autonomy.ts';

export interface Kinded<T> {
  kind: IssueKind;
  value: T;
}

export function kinded<T>(
  build: (issue: IssueRow, requests: RequestRow[], state: ProjectState) => T,
): (issue: IssueRow, requests: RequestRow[], state: ProjectState) => Kinded<T> {
  return (issue, requests, state) => ({
    kind: kindOf(issue, state.bugLabel),
    value: build(issue, requests, state),
  });
}

export function valuesOf<T>(items: readonly Kinded<T>[]): T[] {
  return items.map((item) => item.value);
}

export function ofKind<T>(
  items: readonly Kinded<T>[],
  kind: IssueKind | undefined,
): T[] {
  return items.flatMap((item) =>
    kind === undefined || item.kind === kind ? [item.value] : [],
  );
}
