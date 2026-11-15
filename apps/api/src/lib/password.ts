import { createHmac, pbkdf2, randomBytes, timingSafeEqual } from 'node:crypto';

/** ASP.NET Core Identity PasswordHasher V2/V3 wire-compatible implementation. */
const enum Prf { HmacSha1 = 0, HmacSha256 = 1, HmacSha512 = 2 }
const KEY_LENGTH = 32;
const DEFAULT_PRF = Prf.HmacSha512;
const DEFAULT_ITERATIONS = 100_000;
const SALT_SIZE = 16;
export const MAX_PASSWORD_BYTES = 1024;

export const enum VerificationResult { Failed = 0, Success = 1, SuccessRehashNeeded = 2 }

export const DUMMY_PASSWORD_HASH = 'AQAAAAIAAYagAAAAEE1PQVotQUxJQU4tRFVNTVnxFeOxGDkM4/NQEuhua7p6L85vLHPndG2TdEN7nyzomQ==';

export function isPasswordWithinLimit(password: string): boolean {
  return Buffer.byteLength(password, 'utf8') <= MAX_PASSWORD_BYTES;
}

function prfDigest(prf: number): 'sha1' | 'sha256' | 'sha512' {
  switch (prf) {
    case Prf.HmacSha1: return 'sha1';
    case Prf.HmacSha256: return 'sha256';
    case Prf.HmacSha512: return 'sha512';
    default: throw new Error(`Unknown KeyDerivationPrf ${prf}.`);
  }
}

function derive(password: string, salt: Buffer, iterations: number, digest: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    pbkdf2(password, salt, iterations, KEY_LENGTH, digest, (error, derived) => {
      if (error) reject(error);
      else resolve(derived);
    });
  });
}

function readUInt32Be(buffer: Buffer, offset: number): number {
  return buffer.readUInt32BE(offset);
}

/** Produces a .NET Identity V3 hash with the framework's default parameters. */
export async function hashPassword(password: string): Promise<string> {
  if (!isPasswordWithinLimit(password)) throw new RangeError(`Password must not exceed ${MAX_PASSWORD_BYTES} UTF-8 bytes.`);
  const salt = randomBytes(SALT_SIZE);
  const subkey = await derive(password, salt, DEFAULT_ITERATIONS, prfDigest(DEFAULT_PRF));
  const output = Buffer.alloc(13 + SALT_SIZE + KEY_LENGTH);
  output.writeUInt8(0x01, 0);
  output.writeUInt32BE(DEFAULT_PRF, 1);
  output.writeUInt32BE(DEFAULT_ITERATIONS, 5);
  output.writeUInt32BE(SALT_SIZE, 9);
  salt.copy(output, 13);
  subkey.copy(output, 13 + SALT_SIZE);
  return output.toString('base64');
}

/** Async verification; PBKDF2 executes in libuv's worker pool, not the event loop. */
export async function verifyPassword(storedHash: string, password: string): Promise<VerificationResult> {
  if (!isPasswordWithinLimit(password)) return VerificationResult.Failed;
  let hash: Buffer;
  try {
    hash = Buffer.from(storedHash, 'base64');
  } catch {
    return VerificationResult.Failed;
  }
  if (hash.length === 0) return VerificationResult.Failed;

  if (hash[0] === 0x00) {
    if (hash.length !== 1 + SALT_SIZE + KEY_LENGTH) return VerificationResult.Failed;
    const salt = hash.subarray(1, 1 + SALT_SIZE);
    const expected = hash.subarray(1 + SALT_SIZE);
    const actual = await derive(password, salt, 1_000, 'sha1');
    return timingSafeEqual(actual, expected) ? VerificationResult.SuccessRehashNeeded : VerificationResult.Failed;
  }

  if (hash[0] !== 0x01 || hash.length < 13 + KEY_LENGTH) return VerificationResult.Failed;
  const saltSize = readUInt32Be(hash, 9);
  if (saltSize < 1 || saltSize > 1024 || hash.length !== 13 + saltSize + KEY_LENGTH) return VerificationResult.Failed;
  const prf = readUInt32Be(hash, 1);
  const iterations = readUInt32Be(hash, 5);
  // Reject corrupted or attacker-controlled pathological work factors.
  if (iterations <= 0 || iterations > 1_000_000) return VerificationResult.Failed;

  let digest: string;
  try {
    digest = prfDigest(prf);
  } catch {
    return VerificationResult.Failed;
  }
  const salt = hash.subarray(13, 13 + saltSize);
  const expected = hash.subarray(13 + saltSize);
  const actual = await derive(password, salt, iterations, digest);
  return timingSafeEqual(actual, expected) ? VerificationResult.Success : VerificationResult.Failed;
}

/** True when the stored hash should be upgraded to current V3 defaults. */
export function rehashNeeded(storedHash: string): boolean {
  let hash: Buffer;
  try { hash = Buffer.from(storedHash, 'base64'); } catch { return true; }
  if (hash.length < 13 + KEY_LENGTH || hash[0] !== 0x01) return true;
  return readUInt32Be(hash, 1) !== DEFAULT_PRF || readUInt32Be(hash, 5) !== DEFAULT_ITERATIONS;
}

export function hmacSha256Base64(data: string, secret: string): string {
  return createHmac('sha256', Buffer.from(secret, 'utf8')).update(Buffer.from(data, 'utf8')).digest('base64');
}

export function fixedTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}
