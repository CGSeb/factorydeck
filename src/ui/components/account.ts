import type { Account, Role } from '../../auth/types.ts';

export const ROLE_LABELS: Record<Role, string> = {
  manager: 'Manager',
  dev: 'Dev',
};

function firstGrapheme(word: string): string {
  const [first] = new Intl.Segmenter().segment(word);
  return first?.segment ?? '';
}

export function initialsOf(name: string): string {
  const words = name
    .trim()
    .split(/\s+/u)
    .filter((word) => word !== '');
  const first = words.at(0);
  const last = words.at(-1);
  if (first === undefined || last === undefined) return '';
  const letters =
    words.length === 1
      ? firstGrapheme(first)
      : `${firstGrapheme(first)}${firstGrapheme(last)}`;
  return letters.toUpperCase();
}

export function accountName(account: Account): string {
  return `Account: ${account.name}, ${ROLE_LABELS[account.role]}`;
}

export function accountTip(account: Account): string {
  return `${account.name} · ${ROLE_LABELS[account.role]}`;
}
