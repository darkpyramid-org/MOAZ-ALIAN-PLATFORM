import { createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * ASP.NET Core Identity PasswordHasher interop (V3 + V2 formats), so accounts
 * created by the .NET API keep validating here and every password this service
 * writes remains verifiable by .NET during the rollout window.
 *
 * V3 wire format (all multi-byte integers big-endian):
 *   [0]      = 0x01 format marker
 *   [1..5)   = prf (0 = HMAC-SHA1, 1 = HMAC-SHA256, 2 = HMAC-SHA512)
 *   [5..9)   = iteration count
 *   [9..13)  = salt size
 *   [13..)   = salt, then the 32-byte subkey
 * .NET 9's PasswordHasher<string> defaults: HMAC-SHA512, 100 000 iterations,
 * 16-byte salt, 32-byte subkey — the values written by hashPassword().
 *
 * V2 (legacy accounts) is a bare 0x00 header + 16-byte salt + 32-byte subkey,
 * PBKDF2-HMAC-SHA1 with 1 000 iterations; verification succeeds with
 * "rehash needed" so the hash upgrades on the next successful login.
 */

const enum Prf {
  HmacSha1 = 0,
  HmacSha256 = 1,
  HmacSha512 = 2,
}

const KEY_LENGTH = 32;
const DEFAULT_PRF = Prf.HmacSha512; // .NET 9 PasswordHasherOptions default
const DEFAULT_ITERATIONS = 100_000;
const SALT_SIZE = 16;

export const enum VerificationResult {
  Failed = 0,
  Success = 1,
  SuccessRehashNeeded = 2,
}

function prfDigest(prf: number): 'sha1' | 'sha256' | 'sha512' {
  switch (prf) {
    case Prf.HmacSha1:
      return 'sha1';
    case Prf.HmacSha256:
      return 'sha256';
    case Prf.HmacSha512:
      return 'sha512';
    default:
      throw new Error(`Unknown KeyDerivationPrf ${prf}.`);
  }
}

function readUInt32Be(buffer: Buffer, offset: number): number {
  return buffer.readUInt32BE(offset);
}

function pbkdf2(password: string, salt: Buffer, prf: number, iterations: number): Buffer {
  return pbkdf2Sync(password, salt, iterations, KEY_LENGTH, prfDigest(prf));
}

/** Produces a V3 hash with .NET 9's default parameters. */
export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_SIZE);
  const subkey = pbkdf2(password, salt, DEFAULT_PRF, DEFAULT_ITERATIONS);

  const output = Buffer.alloc(13 + SALT_SIZE + KEY_LENGTH);
  output.writeUInt8(0x01, 0);
  output.writeUInt32BE(DEFAULT_PRF, 1);
  output.writeUInt32BE(DEFAULT_ITERATIONS, 5);
  output.writeUInt32BE(SALT_SIZE, 9);
  salt.copy(output, 13);
  subkey.copy(output, 13 + SALT_SIZE);
  return output.toString('base64');
}

/**
 * Verifies against any V3 hash the stored parameters declare (a hash created
 * with different prf/iterations must still verify), and any V2 hash with the
 * fixed legacy parameters.
 */
export function verifyPassword(storedHash: string, password: string): VerificationResult {
  let hash: Buffer;
  try {
    hash = Buffer.from(storedHash, 'base64');
  } catch {
    return VerificationResult.Failed;
  }

  if (hash.length === 0) return VerificationResult.Failed;

  if (hash[0] === 0x00) {
    // V2: 0x00 marker, then salt (16) + subkey (32), HMAC-SHA1 × 1000.
    if (hash.length !== 1 + SALT_SIZE + KEY_LENGTH) return VerificationResult.Failed;
    const salt = hash.subarray(1, 1 + SALT_SIZE);
    const expected = hash.subarray(1 + SALT_SIZE);
    const actual = pbkdf2Sync(password, salt, 1_000, KEY_LENGTH, 'sha1');
    return timingSafeEqual(actual, expected)
      ? VerificationResult.SuccessRehashNeeded
      : VerificationResult.Failed;
  }

  if (hash[0] !== 0x01) return VerificationResult.Failed;
  // The V3 header declares salt size, but the subkey always runs to the end of
  // the buffer; 13 bytes of header + salt + 32 bytes of key must fit exactly.
  const saltSize = readUInt32Be(hash, 9);
  if (hash.length !== 13 + saltSize + KEY_LENGTH) return VerificationResult.Failed;

  const prf = readUInt32Be(hash, 1);
  const iterations = readUInt32Be(hash, 5);
  if (iterations <= 0) return VerificationResult.Failed;

  const salt = hash.subarray(13, 13 + saltSize);
  const expected = hash.subarray(13 + saltSize);
  const actual = pbkdf2(password, salt, prf, iterations);
  return timingSafeEqual(actual, expected)
    ? VerificationResult.Success
    : VerificationResult.Failed;
}

/** True when the stored hash is not the current-default format → rewrite it. */
export function rehashNeeded(storedHash: string): boolean {
  let hash: Buffer;
  try {
    hash = Buffer.from(storedHash, 'base64');
  } catch {
    return true;
  }
  if (hash.length === 0 || hash[0] === 0x00) return true;
  if (hash[0] !== 0x01) return true;
  return readUInt32Be(hash, 1) !== DEFAULT_PRF || readUInt32Be(hash, 5) !== DEFAULT_ITERATIONS;
}

/** HMAC-SHA256 base64 — the OAuth state signature (CryptographicOperations twin). */
export function hmacSha256Base64(data: string, secret: string): string {
  return createHmac('sha256', Buffer.from(secret, 'utf8')).update(Buffer.from(data, 'utf8')).digest('base64');
}

export function fixedTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}
