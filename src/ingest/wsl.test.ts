import { describe, expect, it } from 'vitest';
import { isWslKernel, wslPath } from './wsl.ts';

describe('wslPath', () => {
  it('reads a Windows drive path as its WSL mount', () => {
    expect(wslPath('D:\\Dev\\x')).toBe('/mnt/d/Dev/x');
    expect(wslPath('c:\\')).toBe('/mnt/c');
    expect(wslPath('E:/Work/app/')).toBe('/mnt/e/Work/app');
  });

  it('keeps a POSIX path and a UNC path', () => {
    expect(wslPath('/home/dev/app')).toBe('/home/dev/app');
    expect(wslPath('\\\\server\\share\\app')).toBe('\\\\server\\share\\app');
  });
});

describe('isWslKernel', () => {
  it('names Microsoft or WSL kernels', () => {
    expect(isWslKernel('Linux version 6.6.87.2-microsoft-standard-WSL2')).toBe(
      true,
    );
    expect(isWslKernel('Linux version 6.8.0-generic (buildd@ubuntu)')).toBe(
      false,
    );
  });
});
