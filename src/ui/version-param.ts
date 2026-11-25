import {
  type FeatureDetail,
  type FeatureResponse,
  issueNumber,
} from '../features/types.ts';
import type { IssueKind } from '../git-host/kind.ts';

export interface VersionStep {
  requested: number | undefined;
  onChange: (version: number, count: number) => void;
}

export const NO_STEP: VersionStep = {
  requested: undefined,
  onChange: () => undefined,
};

export function withoutVersion(pathname: string, search: string): string {
  const params = new URLSearchParams(search);
  params.delete('version');
  return `${pathname}?${params.toString()}`;
}

export function requestedVersion(
  kind: IssueKind,
  params: URLSearchParams,
): { requested: number | undefined; invalid: boolean } {
  const raw = kind === 'bug' ? params.get('version') : null;
  const requested = raw === null ? undefined : issueNumber(raw);
  return { requested, invalid: raw !== null && requested === undefined };
}

export function steppedParams(
  params: URLSearchParams,
  next: number,
  count: number,
): URLSearchParams {
  const found = new URLSearchParams(params);
  if (next >= count) found.delete('version');
  else found.set('version', String(next));
  return found;
}

function strayVersion(
  response: FeatureResponse,
  kind: IssueKind,
  search: string,
): boolean {
  return (
    kind === 'feature' &&
    response.status === 'ok' &&
    response.feature.kind !== 'bug' &&
    new URLSearchParams(search).has('version')
  );
}

export function dropsVersion(
  response: FeatureResponse,
  {
    step,
    kind,
    search,
  }: { step: VersionStep; kind: IssueKind; search: string },
): boolean {
  const { requested } = step;
  if (requested === undefined) return strayVersion(response, kind, search);
  if (response.status === 'invalid-version') return true;
  if (response.status !== 'ok') return false;
  const { version } = response.feature;
  return (
    version !== null &&
    requested === version.count &&
    version.number === version.count
  );
}

export interface VersionView {
  bar: { shown: number; count: number } | null;
  busy: boolean;
}

export function versionView(
  { version }: FeatureDetail,
  kind: IssueKind,
  { requested }: VersionStep,
): VersionView {
  if (kind !== 'bug' || version === null || version.count < 2) {
    return { bar: null, busy: false };
  }
  const shown = requested ?? version.count;
  return {
    bar: { shown, count: version.count },
    busy: version.number !== shown,
  };
}
