import { readFileSync } from 'node:fs';

const WINDOWS_PATH = /^([A-Za-z]):[\\/](.*)$/;

export function isWslKernel(procVersion: string): boolean {
  return /microsoft|wsl/i.test(procVersion);
}

export function runsUnderWsl(): boolean {
  try {
    return isWslKernel(readFileSync('/proc/version', 'utf8'));
  } catch {
    return false;
  }
}

export function wslPath(path: string): string {
  const match = WINDOWS_PATH.exec(path);
  const drive = match?.[1];
  if (drive === undefined) return path;
  const rest = (match?.[2] ?? '').replaceAll('\\', '/').replace(/\/+$/, '');
  const root = `/mnt/${drive.toLowerCase()}`;
  return rest === '' ? root : `${root}/${rest}`;
}
