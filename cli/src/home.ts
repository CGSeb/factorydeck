import path from 'node:path';

export interface HomeSource {
  env: Record<string, string | undefined>;
  platform: NodeJS.Platform;
  homedir: string;
  cwd: string;
}

export const HOME_VARIABLE = 'FACTORYDECK_CLI_HOME';

function pathsOf(platform: NodeJS.Platform): path.PlatformPath {
  return platform === 'win32' ? path.win32 : path.posix;
}

function defaultHome({ env, platform, homedir }: HomeSource): string {
  if (platform !== 'win32') {
    return path.posix.join(homedir, '.config', 'factorydeck');
  }
  const appData = env['APPDATA'] ?? '';
  return appData.trim() === ''
    ? path.win32.join(homedir, 'AppData', 'Roaming', 'factorydeck')
    : path.win32.join(appData, 'factorydeck');
}

function underHomedir(value: string, platform: NodeJS.Platform): boolean {
  return (
    value.startsWith('~/') || (platform === 'win32' && value.startsWith('~\\'))
  );
}

export function cliHome(source: HomeSource): string {
  const value = source.env[HOME_VARIABLE] ?? '';
  if (value.trim() === '') return defaultHome(source);
  const paths = pathsOf(source.platform);
  if (value === '~') return source.homedir;
  if (underHomedir(value, source.platform)) {
    return paths.join(source.homedir, value.slice(2));
  }
  return paths.resolve(source.cwd, value);
}

export function credentialsPath(source: HomeSource): string {
  return pathsOf(source.platform).join(cliHome(source), 'credentials.json');
}
