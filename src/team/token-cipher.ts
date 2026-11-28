import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const VERSION = 'v1';
const ALGORITHM = 'aes-256-gcm';

export type SecretKey =
  { status: 'ok'; key: Buffer } | { status: 'missing' } | { status: 'invalid' };

const STANDARD_BASE64 =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export function secretKey(value: string | undefined): SecretKey {
  const trimmed = value?.trim() ?? '';
  if (trimmed === '') return { status: 'missing' };
  if (!STANDARD_BASE64.test(trimmed)) return { status: 'invalid' };
  const key = Buffer.from(trimmed, 'base64');
  return key.length === KEY_BYTES
    ? { status: 'ok', key }
    : { status: 'invalid' };
}

function additionalData(projectId: number): Buffer {
  return Buffer.from(`project:${String(projectId)}`, 'utf8');
}

export function encryptToken(
  key: Buffer,
  projectId: number,
  token: string,
): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(additionalData(projectId));
  const ciphertext = Buffer.concat([
    cipher.update(token, 'utf8'),
    cipher.final(),
  ]);
  return [
    VERSION,
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    ciphertext.toString('base64url'),
  ].join(':');
}

const BASE64URL = /^[A-Za-z0-9_-]*$/;

export function decryptToken(
  key: Buffer,
  projectId: number,
  stored: string,
): string | undefined {
  const parts = stored.split(':');
  if (parts.length !== 4 || parts[0] !== VERSION) return undefined;
  const [, ivText = '', tagText = '', ciphertextText = ''] = parts;
  if (
    ![ivText, tagText, ciphertextText].every((part) => BASE64URL.test(part))
  ) {
    return undefined;
  }
  const iv = Buffer.from(ivText, 'base64url');
  const tag = Buffer.from(tagText, 'base64url');
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) return undefined;
  try {
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAAD(additionalData(projectId));
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextText, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return undefined;
  }
}
