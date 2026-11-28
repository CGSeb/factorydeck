export const COMMAND_NAMES = ['login', 'logout', 'status'] as const;

export type CommandName = (typeof COMMAND_NAMES)[number];

export function isCommand(name: string): name is CommandName {
  return COMMAND_NAMES.some((command) => command === name);
}

export const MAIN_HELP = [
  'Usage: factorydeck <command> [options]',
  '',
  'Commands:',
  '  login <url>     Log in to a FactoryDeck server by approving it in your browser',
  '  logout <url>    Log out of a FactoryDeck server and forget its token',
  '  status          Show the servers you are logged in to and check each token',
  '',
  'Options:',
  '  --server <url>  Use this server instead, e.g. http://127.0.0.1:4317 in development',
  '  -h, --help      Show the help of a command',
  '  -v, --version   Show the version of the CLI and of its parser',
];

const SERVER_LINE =
  '  --server <url>  Use this server instead, e.g. http://127.0.0.1:4317 in development';

export const COMMAND_HELP: Record<CommandName, string[]> = {
  login: [
    'Usage: factorydeck login <url>',
    '',
    'Asks the FactoryDeck server at <url> for a login, shows its code and opens',
    'the page that approves it in your browser, waits until you approve it, then',
    'saves the token of this machine.',
    '',
    'Options:',
    SERVER_LINE,
  ],
  logout: [
    'Usage: factorydeck logout <url>',
    '',
    'Ends the connection of this machine to the FactoryDeck server at <url> and',
    'forgets its token.',
    '',
    'Options:',
    SERVER_LINE,
  ],
  status: [
    'Usage: factorydeck status',
    '',
    'Lists each server this machine is logged in to: its address, the account,',
    'the machine name, and ok or why the server refuses the token.',
    '',
    'Options:',
    '  --server <url>  Show only this server',
  ],
};
