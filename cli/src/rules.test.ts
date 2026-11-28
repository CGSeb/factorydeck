import { describe, expect, it } from 'vitest';
import { browserCommands, openBrowser } from './browser.ts';
import { machineName } from './context.ts';
import { cliHome, credentialsPath } from './home.ts';
import { serverOrigin } from './origin.ts';

describe('server origin', () => {
  it.each([
    ['https://deck.example.test', 'https://deck.example.test'],
    ['  https://deck.example.test/  ', 'https://deck.example.test'],
    ['https://Deck.EXAMPLE.test/team/path?x=1#y', 'https://deck.example.test'],
    ['HTTPS://deck.example.test', 'https://deck.example.test'],
    ['https://deck.example.test:443/', 'https://deck.example.test'],
    ['http://deck.example.test:80', 'http://deck.example.test'],
    ['http://127.0.0.1:4317/', 'http://127.0.0.1:4317'],
    ['https://bücher.example.test', 'https://xn--bcher-kva.example.test'],
  ])('reads %j as %s', (input, origin) => {
    expect(serverOrigin(input)).toBe(origin);
  });

  it.each([
    'deck.example.test',
    'http:deck.example.test',
    'ftp://deck.example.test',
    'https://',
    'https://user@deck.example.test',
    'https://user:secret@deck.example.test',
    'https://:secret@deck.example.test',
    '',
  ])('refuses %j', (input) => {
    expect(serverOrigin(input)).toBeUndefined();
  });
});

describe('CLI home', () => {
  const linux = {
    platform: 'linux' as const,
    homedir: '/home/ada',
    cwd: '/work/project',
  };

  it('defaults to ~/.config/factorydeck, ignoring XDG_CONFIG_HOME', () => {
    expect(cliHome({ ...linux, env: { XDG_CONFIG_HOME: '/xdg' } })).toBe(
      '/home/ada/.config/factorydeck',
    );
    expect(cliHome({ ...linux, env: { FACTORYDECK_CLI_HOME: '' } })).toBe(
      '/home/ada/.config/factorydeck',
    );
    expect(credentialsPath({ ...linux, env: {} })).toBe(
      '/home/ada/.config/factorydeck/credentials.json',
    );
  });

  it('expands ~, keeps an absolute path and resolves a relative one from the current folder', () => {
    const at = (value: string): string =>
      cliHome({ ...linux, env: { FACTORYDECK_CLI_HOME: value } });
    expect(at('~')).toBe('/home/ada');
    expect(at('~/fd')).toBe('/home/ada/fd');
    expect(at('/srv/fd')).toBe('/srv/fd');
    expect(at('fd')).toBe('/work/project/fd');
    expect(at('../fd/')).toBe('/work/fd');
  });

  it('defaults to %APPDATA%\\factorydeck on Windows', () => {
    const windows = {
      platform: 'win32' as const,
      homedir: 'C:\\Users\\ada',
      cwd: 'C:\\work',
    };
    expect(
      cliHome({
        ...windows,
        env: { APPDATA: 'C:\\Users\\ada\\AppData\\Roaming' },
      }),
    ).toBe('C:\\Users\\ada\\AppData\\Roaming\\factorydeck');
    expect(cliHome({ ...windows, env: {} })).toBe(
      'C:\\Users\\ada\\AppData\\Roaming\\factorydeck',
    );
    expect(
      cliHome({ ...windows, env: { FACTORYDECK_CLI_HOME: '~\\fd' } }),
    ).toBe('C:\\Users\\ada\\fd');
    expect(cliHome({ ...windows, env: { FACTORYDECK_CLI_HOME: 'fd' } })).toBe(
      'C:\\work\\fd',
    );
  });
});

describe('machine name', () => {
  it('is the trimmed host name, cut to 80 code points, or unknown', () => {
    expect(machineName('  laptop \n')).toBe('laptop');
    expect(machineName('')).toBe('unknown');
    expect(machineName('😀'.repeat(81))).toBe('😀'.repeat(80));
  });
});

describe('browser', () => {
  const url = 'https://deck.example.test/cli?code=WDJB-MJHT';
  const at = (
    platform: NodeJS.Platform,
    env: Record<string, string> = {},
    procVersion = 'Linux version 6.8.0-generic',
  ): string[] =>
    browserCommands(url, { platform, env, procVersion: () => procVersion }).map(
      ([command, args]) => [command, ...args].join(' '),
    );

  it('uses the opener of each system', () => {
    expect(at('darwin')).toEqual([`open ${url}`]);
    expect(at('win32')).toEqual([`cmd /c start ${url}`]);
    expect(at('linux', { DISPLAY: ':0' })).toEqual([`xdg-open ${url}`]);
    expect(at('linux', { WAYLAND_DISPLAY: 'wayland-0' })).toEqual([
      `xdg-open ${url}`,
    ]);
    expect(at('linux')).toEqual([]);
  });

  it('detects WSL from WSL_DISTRO_NAME or /proc/version', () => {
    const wsl = [`wslview ${url}`, `explorer.exe ${url}`];
    expect(at('linux', { WSL_DISTRO_NAME: 'Ubuntu' })).toEqual(wsl);
    expect(
      at('linux', {}, 'Linux version 6.6.87.2-microsoft-standard-WSL2'),
    ).toEqual(wsl);
  });

  it('escapes the characters cmd reads on Windows', () => {
    expect(
      browserCommands('https://a.test/?a=1&b=%41', {
        platform: 'win32',
        env: {},
        procVersion: () => '',
      }),
    ).toEqual([['cmd', ['/c', 'start', 'https://a.test/?a=1^&b=^%41']]]);
  });

  it('falls back to the next opener, and stays silent when none works', async () => {
    const tried: string[] = [];
    const source = {
      platform: 'linux' as const,
      env: { WSL_DISTRO_NAME: 'Ubuntu' },
      procVersion: () => '',
    };
    await openBrowser(url, source, (command) => {
      tried.push(command);
      return command === 'wslview'
        ? Promise.reject(new Error('ENOENT'))
        : Promise.resolve(false);
    });
    expect(tried).toEqual(['wslview', 'explorer.exe']);
  });
});
