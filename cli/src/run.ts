import { type Parsed, parseArguments } from './arguments.ts';
import type { Context } from './context.ts';
import { CredentialsError } from './credentials.ts';
import { COMMAND_HELP, MAIN_HELP } from './help.ts';
import { login } from './login.ts';
import { logout } from './logout.ts';
import { status } from './status.ts';

export const EXIT_OK = 0;
export const EXIT_FAILURE = 1;
export const EXIT_USAGE = 2;

function helpOf(command: Parsed['command']): string[] {
  return command === undefined ? MAIN_HELP : COMMAND_HELP[command];
}

function dispatch(
  parsed: Extract<Parsed, { kind: 'run' }>,
  context: Context,
): Promise<number> {
  const { command, origin } = parsed;
  if (command === 'status') return status(origin, context);
  if (origin === undefined) return Promise.resolve(EXIT_USAGE);
  return command === 'login' ? login(origin, context) : logout(origin, context);
}

export async function run(argv: string[], context: Context): Promise<number> {
  const parsed = parseArguments(argv);
  const { output } = context;
  if (parsed.kind === 'help') {
    for (const line of helpOf(parsed.command)) output.out(line);
    return EXIT_OK;
  }
  if (parsed.kind === 'usage') {
    if (parsed.message !== '') output.err(parsed.message);
    for (const line of helpOf(parsed.command)) output.err(line);
    return EXIT_USAGE;
  }
  try {
    return await dispatch(parsed, context);
  } catch (error) {
    if (!(error instanceof CredentialsError)) throw error;
    output.err(error.message);
    return EXIT_FAILURE;
  }
}
