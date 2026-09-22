import { randomBytes, scrypt as callbackScrypt, timingSafeEqual } from 'node:crypto';
import type { PasswordHasher } from '../application/password-hasher';
const KEY_LENGTH = 32;
const scrypt = (password: string, salt: Buffer, length: number) =>
  new Promise<Buffer>((resolve, reject) =>
    callbackScrypt(password, salt, length, OPTIONS, (error, derived) =>
      error ? reject(error) : resolve(derived),
    ),
  );
const OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 };
export class ScryptPasswordHasher implements PasswordHasher {
  async hash(password: string) {
    validate(password);
    const salt = randomBytes(16),
      derived = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
    return `scrypt$v1$${salt.toString('base64url')}$${derived.toString('base64url')}`;
  }
  async verify(password: string, encoded: string) {
    if (password.length > 256) return false;
    const parts = encoded.split('$');
    if (parts.length !== 4 || parts[0] !== 'scrypt' || parts[1] !== 'v1') return false;
    try {
      const salt = Buffer.from(parts[2]!, 'base64url'),
        expected = Buffer.from(parts[3]!, 'base64url');
      if (salt.length !== 16 || expected.length !== KEY_LENGTH) return false;
      const actual = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
      return timingSafeEqual(actual, expected);
    } catch {
      return false;
    }
  }
}
function validate(password: string) {
  if (password.length < 12 || password.length > 256)
    throw new Error('Passwords must be 12-256 characters');
}
