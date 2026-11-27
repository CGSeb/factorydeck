import type { FieldError, NewAccount } from './types.ts';

const MAX_EMAIL = 254;
const MAX_NAME = 80;
const MIN_PASSWORD = 12;
const MAX_PASSWORD = 200;

function length(value: string): number {
  return Array.from(value).length;
}

export function emailError(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.trim() === '') {
    return 'Email is required';
  }
  const email = value.trim().toLowerCase();
  if (length(email) > MAX_EMAIL) {
    return `Email must be at most ${MAX_EMAIL} characters`;
  }
  const parts = email.split('@');
  if (parts.length !== 2 || parts[0] === '' || parts[1] === '') {
    return 'Email must have one @ with text on both sides';
  }
  return undefined;
}

function nameError(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.trim() === '') {
    return 'Name is required';
  }
  if (length(value.trim()) > MAX_NAME) {
    return `Name must be at most ${MAX_NAME} characters`;
  }
  return undefined;
}

function passwordError(value: unknown): string | undefined {
  if (typeof value !== 'string' || value === '') return 'Password is required';
  const size = length(value);
  if (size < MIN_PASSWORD) {
    return `Password must be at least ${MIN_PASSWORD} characters`;
  }
  if (size > MAX_PASSWORD) {
    return `Password must be at most ${MAX_PASSWORD} characters`;
  }
  return undefined;
}

export function accountFields(
  body: Record<string, unknown>,
): { ok: true; value: NewAccount } | ({ ok: false } & FieldError) {
  const { email, name, password } = body;
  const checks = [
    ['email', emailError(email)],
    ['name', nameError(name)],
    ['password', passwordError(password)],
  ] as const;
  for (const [field, error] of checks) {
    if (error !== undefined) return { ok: false, error, field };
  }
  return {
    ok: true,
    value: {
      email: String(email).trim().toLowerCase(),
      name: String(name).trim(),
      password: String(password),
    },
  };
}
