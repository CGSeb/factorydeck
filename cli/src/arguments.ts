import { parseArgs } from 'node:util';
import { type CommandName, isCommand } from './help.ts';
import { invalidServerUrl, serverOrigin } from './origin.ts';

export type Parsed =
  | { kind: 'help'; command: CommandName | undefined }
  | { kind: 'version' }
  | { kind: 'run'; command: CommandName; origin: string | undefined }
  | { kind: 'usage'; command: CommandName | undefined; message: string };

const KNOWN_OPTIONS = new Set(['help', 'server', 'version']);

interface Raw {
  values: Record<string, string | boolean | undefined>;
  positionals: string[];
}

function read(argv: string[]): Raw {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      help: { type: 'boolean', short: 'h' },
      server: { type: 'string' },
      version: { type: 'boolean', short: 'v' },
    },
    allowPositionals: true,
    strict: false,
  });
  return { values: { ...values }, positionals };
}

function optionError({ values }: Raw): string | undefined {
  const unknown = Object.keys(values).find((name) => !KNOWN_OPTIONS.has(name));
  if (unknown !== undefined) {
    return `Unknown option: ${unknown.length === 1 ? '-' : '--'}${unknown}.`;
  }
  if (typeof values['help'] === 'string')
    return 'Option --help takes no value.';
  if (typeof values['version'] === 'string')
    return 'Option --version takes no value.';
  if (values['server'] === true) return 'Option --server needs a URL.';
  return undefined;
}

type Origin = { origin: string | undefined } | { message: string };

function originOf(url: string | undefined): Origin {
  if (url === undefined) return { origin: undefined };
  const origin = serverOrigin(url);
  return origin === undefined ? { message: invalidServerUrl(url) } : { origin };
}

function serverOf(command: CommandName, raw: Raw): Origin {
  const rest = raw.positionals.slice(1);
  const takesUrl = command !== 'status';
  const extra = rest[takesUrl ? 1 : 0];
  if (extra !== undefined) return { message: `Unexpected argument: ${extra}.` };
  const flag = raw.values['server'];
  const fromFlag = originOf(typeof flag === 'string' ? flag : undefined);
  const fromArgument = originOf(rest[0]);
  if ('message' in fromFlag) return fromFlag;
  if ('message' in fromArgument) return fromArgument;
  const { origin: flagged } = fromFlag;
  const { origin: given } = fromArgument;
  if (flagged !== undefined && given !== undefined && flagged !== given) {
    return {
      message: `--server ${flagged} and ${given} name different servers.`,
    };
  }
  return { origin: flagged ?? given };
}

function shownInstead(
  { values }: Raw,
  command: CommandName | undefined,
): Parsed | undefined {
  if (values['version'] === true) return { kind: 'version' };
  if (values['help'] === true) return { kind: 'help', command };
  return undefined;
}

export function parseArguments(argv: string[]): Parsed {
  const raw = read(argv);
  const name = raw.positionals[0];
  const command = name !== undefined && isCommand(name) ? name : undefined;
  const optionMessage = optionError(raw);
  if (optionMessage !== undefined) {
    return { kind: 'usage', command, message: optionMessage };
  }
  if (name !== undefined && command === undefined) {
    return { kind: 'usage', command, message: `Unknown command: ${name}.` };
  }
  if (command === undefined) {
    return (
      shownInstead(raw, command) ?? { kind: 'usage', command, message: '' }
    );
  }
  const server = serverOf(command, raw);
  if ('message' in server) return { kind: 'usage', command, ...server };
  const shown = shownInstead(raw, command);
  if (shown !== undefined) return shown;
  if (command !== 'status' && server.origin === undefined) {
    return { kind: 'usage', command, message: 'Missing server URL.' };
  }
  return { kind: 'run', command, origin: server.origin };
}
