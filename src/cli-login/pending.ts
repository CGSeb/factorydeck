import { randomBytes, randomInt } from 'node:crypto';

export const LOGIN_LIFETIME_MS = 10 * 60 * 1000;
export const POLL_INTERVAL_MS = 5 * 1000;
export const MAX_PENDING_LOGINS = 1000;
export const USER_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const USER_CODE_LENGTH = 8;
const DEVICE_CODE_BYTES = 32;

type LoginState =
  | { name: 'pending' }
  | { name: 'approved'; accountId: number }
  | { name: 'claiming'; accountId: number }
  | { name: 'closed' };

interface Login {
  deviceCode: string;
  userCode: string;
  machine: string;
  createdAt: number;
  lastPollAt: number | undefined;
  state: LoginState;
}

export type StartOutcome =
  | { status: 'started'; deviceCode: string; userCode: string }
  | { status: 'full' };

export type PollOutcome =
  | { status: 'slow-down' }
  | { status: 'gone' }
  | { status: 'pending' }
  | {
      status: 'approved';
      accountId: number;
      machine: string;
      done: () => void;
      undo: () => void;
    };

export interface AskedLogin {
  machine: string;
  userCode: string;
}

export interface PendingLogins {
  start: (machine: string) => StartOutcome;
  poll: (deviceCode: string) => PollOutcome;
  find: (userCode: string) => AskedLogin | undefined;
  approve: (userCode: string, accountId: number) => boolean;
  cancel: (userCode: string) => boolean;
}

export interface PendingLoginOptions {
  now?: () => number;
  userCode?: () => string;
}

export function normalizeUserCode(value: string): string {
  return value.replaceAll(/[\s-]/g, '').toUpperCase();
}

export function formatUserCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

function randomUserCode(): string {
  let code = '';
  for (let i = 0; i < USER_CODE_LENGTH; i++) {
    code += USER_CODE_ALPHABET[randomInt(USER_CODE_ALPHABET.length)];
  }
  return code;
}

interface Table {
  byDevice: Map<string, Login>;
  byUser: Map<string, Login>;
}

function prune({ byDevice, byUser }: Table, at: number): void {
  for (const [deviceCode, login] of byDevice) {
    if (at - login.createdAt < LOGIN_LIFETIME_MS) continue;
    byDevice.delete(deviceCode);
    if (byUser.get(login.userCode) === login) byUser.delete(login.userCode);
  }
}

function close({ byUser }: Table, login: Login): void {
  login.state = { name: 'closed' };
  if (byUser.get(login.userCode) === login) byUser.delete(login.userCode);
}

function asked(table: Table, userCode: string, at: number) {
  prune(table, at);
  const login = table.byUser.get(normalizeUserCode(userCode));
  return login?.state.name === 'pending' ? login : undefined;
}

function claim(table: Table, login: Login): PollOutcome {
  const { state } = login;
  if (state.name !== 'approved') return { status: 'gone' };
  login.state = { name: 'claiming', accountId: state.accountId };
  return {
    status: 'approved',
    accountId: state.accountId,
    machine: login.machine,
    done: () => {
      close(table, login);
    },
    undo: () => {
      login.state = state;
    },
  };
}

function start(
  table: Table,
  machine: string,
  at: number,
  newUserCode: () => string,
): StartOutcome {
  prune(table, at);
  const open = [...table.byDevice.values()].filter(
    (login) => login.state.name !== 'closed',
  ).length;
  if (open >= MAX_PENDING_LOGINS) return { status: 'full' };
  let userCode = newUserCode();
  while (table.byUser.has(userCode)) userCode = newUserCode();
  const login: Login = {
    deviceCode: randomBytes(DEVICE_CODE_BYTES).toString('base64url'),
    userCode,
    machine,
    createdAt: at,
    lastPollAt: undefined,
    state: { name: 'pending' },
  };
  table.byDevice.set(login.deviceCode, login);
  table.byUser.set(userCode, login);
  return { status: 'started', deviceCode: login.deviceCode, userCode };
}

function poll(table: Table, deviceCode: string, at: number): PollOutcome {
  prune(table, at);
  const login = table.byDevice.get(deviceCode);
  if (login === undefined) return { status: 'gone' };
  if (
    login.lastPollAt !== undefined &&
    at - login.lastPollAt < POLL_INTERVAL_MS
  ) {
    return { status: 'slow-down' };
  }
  login.lastPollAt = at;
  if (login.state.name === 'pending') return { status: 'pending' };
  return claim(table, login);
}

export function pendingLogins(
  options: PendingLoginOptions = {},
): PendingLogins {
  const now = options.now ?? (() => Date.now());
  const newUserCode = options.userCode ?? randomUserCode;
  const table: Table = { byDevice: new Map(), byUser: new Map() };
  return {
    start: (machine) => start(table, machine, now(), newUserCode),
    poll: (deviceCode) => poll(table, deviceCode, now()),
    find: (userCode) => {
      const login = asked(table, userCode, now());
      return login === undefined
        ? undefined
        : { machine: login.machine, userCode: login.userCode };
    },
    approve: (userCode, accountId) => {
      const login = asked(table, userCode, now());
      if (login === undefined) return false;
      login.state = { name: 'approved', accountId };
      table.byUser.delete(login.userCode);
      return true;
    },
    cancel: (userCode) => {
      const login = asked(table, userCode, now());
      if (login === undefined) return false;
      close(table, login);
      return true;
    },
  };
}
