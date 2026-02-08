import { timingSafeEqual, createHash } from 'crypto';

/**
 * Constant-time string comparison using SHA-256 hashing.
 * Both inputs are hashed to fixed-length digests before comparison,
 * preventing length-based timing oracle attacks.
 *
 * Why hash-then-compare? crypto.timingSafeEqual throws RangeError if
 * buffers have different lengths. Hashing both to SHA-256 (32 bytes)
 * guarantees equal length regardless of input. OWASP-recommended pattern.
 */
export function timingSafeCompare(a: string, b: string): boolean {
  const hashA = createHash('sha256').update(a).digest();
  const hashB = createHash('sha256').update(b).digest();
  return timingSafeEqual(hashA, hashB);
}
