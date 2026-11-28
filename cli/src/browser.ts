export interface BrowserSource {
  platform: NodeJS.Platform;
  env: Record<string, string | undefined>;
  procVersion: () => string;
}

export type Launch = (command: string, args: string[]) => Promise<boolean>;

type Command = [command: string, args: string[]];

const CMD_SPECIAL = /[&|<>^()%!]/g;

function isSet(value: string | undefined): boolean {
  return value !== undefined && value !== '';
}

function isWsl({ env, procVersion }: BrowserSource): boolean {
  if (isSet(env['WSL_DISTRO_NAME'])) return true;
  return /microsoft|wsl/i.test(procVersion());
}

export function browserCommands(url: string, source: BrowserSource): Command[] {
  if (source.platform === 'darwin') return [['open', [url]]];
  if (source.platform === 'win32') {
    return [['cmd', ['/c', 'start', url.replaceAll(CMD_SPECIAL, '^$&')]]];
  }
  if (isWsl(source)) {
    return [
      ['wslview', [url]],
      ['explorer.exe', [url]],
    ];
  }
  const { env } = source;
  if (!isSet(env['DISPLAY']) && !isSet(env['WAYLAND_DISPLAY'])) return [];
  return [['xdg-open', [url]]];
}

export async function openBrowser(
  url: string,
  source: BrowserSource,
  launch: Launch,
): Promise<void> {
  for (const [command, args] of browserCommands(url, source)) {
    if (await launch(command, args).catch(() => false)) return;
  }
}
