import {
  createHash,
  randomBytes,
  randomInt,
  scrypt,
  timingSafeEqual,
} from 'node:crypto';

const SETUP_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const SETUP_CODE_LENGTH = 8;
const SALT_BYTES = 16;
const KEY_BYTES = 64;
const SESSION_TOKEN_BYTES = 32;

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_BYTES, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await derive(password, salt);
  return `scrypt$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  const [scheme, salt, key] = hash.split('$');
  if (scheme !== 'scrypt' || salt === undefined || key === undefined) {
    return false;
  }
  const expected = Buffer.from(key, 'base64url');
  const actual = await derive(password, Buffer.from(salt, 'base64url'));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function newSetupCode(): string {
  let code = '';
  for (let i = 0; i < SETUP_CODE_LENGTH; i++) {
    code += SETUP_CODE_ALPHABET[randomInt(SETUP_CODE_ALPHABET.length)];
  }
  return code;
}

export function sameSetupCode(expected: string, given: unknown): boolean {
  if (typeof given !== 'string') return false;
  const a = Buffer.from(expected.toUpperCase());
  const b = Buffer.from(given.trim().toUpperCase());
  return a.length === b.length && timingSafeEqual(a, b);
}

export function newSessionToken(): string {
  return randomBytes(SESSION_TOKEN_BYTES).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
