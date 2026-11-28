import { z } from 'zod';
import { openBrowser } from './browser.ts';
import { type Context, machineName } from './context.ts';
import {
  type ServerEntry,
  readCredentials,
  updateCredentials,
  withServer,
} from './credentials.ts';
import { credentialsPath } from './home.ts';
import { type Answer, errorOf, request } from './http.ts';
import { serverOrigin } from './origin.ts';

const MIN_INTERVAL_SECONDS = 5;

const startedSchema = z.object({
  deviceCode: z.string().min(1),
  userCode: z.string().min(1),
  verificationUrl: z.string().min(1),
  expiresIn: z.number().positive(),
  interval: z.number().nonnegative(),
});

const approvedSchema = z.object({
  token: z.string().min(1),
  account: z.object({
    id: z.union([z.number(), z.string()]),
    email: z.string(),
    name: z.string(),
    role: z.string(),
  }),
});

type Started = z.infer<typeof startedSchema>;
type Approved = z.infer<typeof approvedSchema>;

export function unreachable(origin: string): string {
  return `Could not reach ${origin}.`;
}

export function unexpected(origin: string, status: number): string {
  return `Unexpected answer from ${origin} (HTTP ${status}).`;
}

function cancelled(origin: string): string {
  return `Login cancelled or expired. Run factorydeck login ${origin} again.`;
}

function startError(origin: string, answer: Answer): string {
  if (!answer.reached) return unreachable(origin);
  if (answer.status === 404) {
    return `${origin} is not a FactoryDeck server with CLI login.`;
  }
  const error = answer.status === 503 ? errorOf(answer.body) : undefined;
  return error ?? unexpected(origin, answer.status);
}

async function start(
  origin: string,
  context: Context,
): Promise<Started | string> {
  const answer = await request(context, `${origin}/api/cli/login`, {
    method: 'POST',
    body: { machine: machineName(context.hostname) },
  });
  if (!answer.reached || answer.status !== 200) {
    return startError(origin, answer);
  }
  const started = startedSchema.safeParse(answer.body);
  return started.success ? started.data : unexpected(origin, answer.status);
}

type PollOutcome = Approved | string | { intervals: number };

function pollOutcome(origin: string, answer: Answer): PollOutcome {
  if (!answer.reached || answer.status === 503 || answer.status === 202) {
    return { intervals: 1 };
  }
  if (answer.status === 429) return { intervals: 2 };
  if (answer.status === 410) return cancelled(origin);
  const approved =
    answer.status === 200 ? approvedSchema.safeParse(answer.body) : undefined;
  return approved?.success === true
    ? approved.data
    : unexpected(origin, answer.status);
}

async function poll(
  origin: string,
  started: Started,
  context: Context,
): Promise<Approved | string> {
  const interval = Math.max(MIN_INTERVAL_SECONDS, started.interval) * 1000;
  const deadline = context.now() + started.expiresIn * 1000;
  let wait = interval;
  for (;;) {
    await context.sleep(wait);
    if (context.now() >= deadline) return cancelled(origin);
    const answer = await request(context, `${origin}/api/cli/login/poll`, {
      method: 'POST',
      body: { deviceCode: started.deviceCode },
    });
    const outcome = pollOutcome(origin, answer);
    if (typeof outcome === 'string' || !('intervals' in outcome)) {
      return outcome;
    }
    wait = outcome.intervals * interval;
  }
}

async function replace(
  origin: string,
  entry: ServerEntry,
  context: Context,
): Promise<void> {
  const file = credentialsPath(context);
  const old = (await readCredentials(file)).servers[origin];
  if (old !== undefined) {
    await request(context, `${origin}/api/cli/logout`, {
      method: 'POST',
      token: old.token,
    });
  }
  await updateCredentials(file, withServer(origin, entry));
}

function showCode(started: Started, context: Context): Promise<void> {
  context.output.out(
    `Open ${started.verificationUrl} and check the code ${started.userCode}.`,
  );
  if (serverOrigin(started.verificationUrl) === undefined) {
    return Promise.resolve();
  }
  return openBrowser(started.verificationUrl, context, context.launch);
}

export async function login(origin: string, context: Context): Promise<number> {
  await readCredentials(credentialsPath(context));
  const started = await start(origin, context);
  if (typeof started === 'string') {
    context.output.err(started);
    return 1;
  }
  await showCode(started, context);
  const approved = await poll(origin, started, context);
  if (typeof approved === 'string') {
    context.output.err(approved);
    return 1;
  }
  const { token, account } = approved;
  const machine = machineName(context.hostname);
  const loggedInAt = new Date(context.now()).toISOString();
  await replace(origin, { token, account, machine, loggedInAt }, context);
  context.output.out(
    `Logged in to ${origin} as ${account.name} (${account.email}).`,
  );
  return 0;
}
