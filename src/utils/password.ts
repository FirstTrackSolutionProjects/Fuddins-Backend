import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

const KEY_LENGTH = 64;
const HASH_PREFIX = 'scrypt';

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, KEY_LENGTH).toString('hex');
  return `${HASH_PREFIX}$${salt}$${hash}`;
}

export function verifyPassword(password: string, storedPassword: string) {
  const [prefix, salt, hash] = storedPassword.split('$');

  if (prefix !== HASH_PREFIX || !salt || !hash) {
    return password === storedPassword;
  }

  const candidate = scryptSync(password, salt, KEY_LENGTH);
  const saved = Buffer.from(hash, 'hex');

  return saved.length === candidate.length && timingSafeEqual(saved, candidate);
}
