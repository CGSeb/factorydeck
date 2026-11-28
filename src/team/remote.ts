export const MAX_REMOTE_LENGTH = 500;
export const MAX_SLUG_LENGTH = 40;
export const FALLBACK_SLUG = 'project';

export interface ParsedRemote {
  remote: string;
  repository: string;
}

const SCP_FORM = /^git@([^\s/:@]+):([^\s]+)$/;
const URL_FORM =
  /^(?:ssh|https?):\/\/(?:[^\s/@]*@)?([^\s/:@]+)(?::\d*)?(\/\S*)$/i;
const HOST = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/;

function hostAndPath(remote: string): [string, string] | undefined {
  const scp = SCP_FORM.exec(remote);
  if (scp?.[1] !== undefined && scp[2] !== undefined) return [scp[1], scp[2]];
  if (/^ssh:/i.test(remote) || /^https?:/i.test(remote)) {
    const url = URL_FORM.exec(remote);
    if (url?.[1] !== undefined && url[2] !== undefined) return [url[1], url[2]];
  }
  return undefined;
}

function segmentsOf(path: string): string[] | undefined {
  if (/[?#\\]/.test(path)) return undefined;
  const trimmed = path
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .replace(/\.git$/i, '')
    .replace(/\/+$/, '');
  const segments = trimmed.split('/');
  if (segments.length < 2) return undefined;
  if (segments.some((segment) => ['', '.', '..'].includes(segment))) {
    return undefined;
  }
  return segments;
}

export function parseRemote(value: string): ParsedRemote | undefined {
  const remote = value.trim();
  if (remote.length > MAX_REMOTE_LENGTH) return undefined;
  const parts = hostAndPath(remote);
  if (parts === undefined) return undefined;
  const host = parts[0].toLowerCase();
  if (!HOST.test(host)) return undefined;
  const segments = segmentsOf(parts[1]);
  const repository = segments?.at(-1);
  if (segments === undefined || repository === undefined) return undefined;
  return {
    remote: `${host}/${segments.join('/').toLowerCase()}`,
    repository,
  };
}

export function slugBase(repository: string): string {
  const slug = repository
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/, '');
  return slug === '' ? FALLBACK_SLUG : slug;
}

function numbered(base: string, number: number): string {
  const suffix = `-${String(number)}`;
  const cut = base.slice(0, MAX_SLUG_LENGTH - suffix.length).replace(/-+$/, '');
  return `${cut}${suffix}`;
}

export function freeSlug(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  let number = 2;
  while (taken.has(numbered(base, number))) number += 1;
  return numbered(base, number);
}
