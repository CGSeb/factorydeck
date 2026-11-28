import type { Context } from './context.ts';
import {
  readCredentials,
  updateCredentials,
  withServer,
} from './credentials.ts';
import { credentialsPath } from './home.ts';
import { request } from './http.ts';

function ended(status: number): boolean {
  return status === 401 || (status >= 200 && status < 300);
}

export async function logout(
  origin: string,
  context: Context,
): Promise<number> {
  const file = credentialsPath(context);
  const entry = (await readCredentials(file)).servers[origin];
  if (entry === undefined) {
    context.output.out(`Not logged in to ${origin}.`);
    return 0;
  }
  const answer = await request(context, `${origin}/api/cli/logout`, {
    method: 'POST',
    token: entry.token,
  });
  await updateCredentials(file, withServer(origin, undefined));
  if (answer.reached && ended(answer.status)) {
    context.output.out(`Logged out of ${origin}.`);
    return 0;
  }
  context.output.err(
    `Logged out of ${origin} on this machine; could not reach it to end the connection.`,
  );
  return 1;
}
