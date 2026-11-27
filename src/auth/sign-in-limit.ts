import { emailError } from './fields.ts';

export const SIGN_IN_ATTEMPTS = 10;
export const SIGN_IN_WINDOW_MS = 15 * 60 * 1000;
export const SIGN_IN_EMAILS = 10_000;

export type SignInAttempt =
  | { status: 'limited'; retryAfterMs: number }
  | { status: 'counted'; release: () => void; clear: () => void }
  | { status: 'uncounted' };

export interface SignInLimit {
  begin: (email: unknown) => SignInAttempt;
}

export interface SignInLimitOptions {
  now?: () => Date;
  attempts?: number;
  windowMs?: number;
  emails?: number;
}

export function signInLimit(options: SignInLimitOptions = {}): SignInLimit {
  const now = options.now ?? (() => new Date());
  const max = options.attempts ?? SIGN_IN_ATTEMPTS;
  const windowMs = options.windowMs ?? SIGN_IN_WINDOW_MS;
  const maxEmails = options.emails ?? SIGN_IN_EMAILS;
  const byEmail = new Map<string, number[]>();

  const live = (times: number[], at: number) =>
    times.filter((time) => at - time < windowMs);

  const current = (key: string, at: number): number[] => {
    const times = live(byEmail.get(key) ?? [], at);
    if (times.length === 0) byEmail.delete(key);
    else byEmail.set(key, times);
    return times;
  };

  const makeRoom = (at: number) => {
    for (const key of byEmail.keys()) current(key, at);
    while (byEmail.size >= maxEmails) {
      let oldest: [string, number] | undefined;
      for (const [key, times] of byEmail) {
        const last = Math.max(...times);
        if (oldest === undefined || last < oldest[1]) oldest = [key, last];
      }
      if (oldest === undefined) return;
      byEmail.delete(oldest[0]);
    }
  };

  const release = (key: string, time: number) => {
    const times = byEmail.get(key);
    if (times === undefined) return;
    const index = times.lastIndexOf(time);
    if (index >= 0) times.splice(index, 1);
    if (times.length === 0) byEmail.delete(key);
  };

  return {
    begin: (email) => {
      if (typeof email !== 'string' || emailError(email) !== undefined) {
        return { status: 'uncounted' };
      }
      const key = email.trim().toLowerCase();
      const at = now().getTime();
      const times = current(key, at);
      if (times.length >= max) {
        return {
          status: 'limited',
          retryAfterMs: Math.min(...times) + windowMs - at,
        };
      }
      if (times.length === 0 && byEmail.size >= maxEmails) makeRoom(at);
      byEmail.set(key, [...times, at]);
      return {
        status: 'counted',
        release: () => release(key, at),
        clear: () => byEmail.delete(key),
      };
    },
  };
}
