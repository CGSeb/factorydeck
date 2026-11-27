export const SIGN_IN_PATH = '/sign-in';

const CLOSED_PATHS = new Set([SIGN_IN_PATH, '/setup']);

function rawPathOf(value: string): string {
  const end = value.search(/[?#]/);
  return (end === -1 ? value : value.slice(0, end)).toLowerCase();
}

function pathOf(value: string): string {
  const path = rawPathOf(value);
  return path.length > 1 ? path.replace(/\/+$/, '') : path;
}

export function safeNext(value: string | null | undefined): string {
  if (
    value === null ||
    value === undefined ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\')
  ) {
    return '/';
  }
  if (CLOSED_PATHS.has(pathOf(value)) || rawPathOf(value).startsWith('/api/')) {
    return '/';
  }
  return value;
}

export function nextOf(search: string): string {
  return safeNext(new URLSearchParams(search).get('next'));
}

export function signInPath(asked: string): string {
  const next = safeNext(asked);
  return next === '/'
    ? SIGN_IN_PATH
    : `${SIGN_IN_PATH}?next=${encodeURIComponent(next)}`;
}
