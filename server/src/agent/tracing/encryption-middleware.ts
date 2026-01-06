/**
 * Encryption Middleware for Conversation Traces
 *
 * Provides transparent encryption/decryption of PII-containing fields
 * in the ConversationTrace model (messages, toolCalls).
 *
 * Security (P0 fix):
 * - Messages contain user input which may include PII (emails, phone numbers, addresses)
 * - Tool calls may contain booking details, customer info
 * - Encryption ensures data-at-rest protection
 *
 * Implementation:
 * - Uses existing EncryptionService (AES-256-GCM)
 * - Middleware intercepts create/update/findMany operations
 * - Transparent to application code - just use Prisma normally
 *
 * @see plans/agent-evaluation-system.md Phase 1.4
 */

import { Prisma, type PrismaClient } from '../../generated/prisma/client';
import { encryptionService, type EncryptedData } from '../../lib/encryption.service';
import { logger } from '../../lib/core/logger';
import { sanitizeError } from '../../lib/core/error-sanitizer';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Marker to indicate encrypted data (prevents double encryption) */
const ENCRYPTION_MARKER = '__encrypted__';

/** Fields to encrypt in ConversationTrace model */
const FIELDS_TO_ENCRYPT = ['messages', 'toolCalls'] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface EncryptedWrapper {
  [ENCRYPTION_MARKER]: true;
  data: EncryptedData;
}

type _FieldName = (typeof FIELDS_TO_ENCRYPT)[number];

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if a value is already encrypted
 */
function isEncrypted(value: unknown): value is EncryptedWrapper {
  return (
    typeof value === 'object' &&
    value !== null &&
    ENCRYPTION_MARKER in value &&
    (value as EncryptedWrapper)[ENCRYPTION_MARKER] === true
  );
}

/**
 * Encrypt a JSON value
 */
function encryptField(value: unknown): EncryptedWrapper {
  if (value === null || value === undefined) {
    // Don't encrypt null/undefined - store as-is
    return {
      [ENCRYPTION_MARKER]: true,
      data: encryptionService.encrypt(JSON.stringify(null)),
    };
  }

  if (isEncrypted(value)) {
    // Already encrypted, return as-is
    return value;
  }

  const encrypted = encryptionService.encryptObject(value);
  return {
    [ENCRYPTION_MARKER]: true,
    data: encrypted,
  };
}

/**
 * Decrypt an encrypted value
 */
function decryptField(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (!isEncrypted(value)) {
    // Not encrypted, return as-is (for backwards compatibility)
    return value;
  }

  try {
    return encryptionService.decryptObject(value.data);
  } catch (error) {
    logger.error({ error: sanitizeError(error) }, 'Failed to decrypt trace field');
    // Return null on decryption failure to prevent data leaks
    return null;
  }
}

/**
 * Encrypt fields in data object before write
 */
function encryptDataFields(data: Record<string, unknown>): Record<string, unknown> {
  const encrypted = { ...data };

  for (const field of FIELDS_TO_ENCRYPT) {
    if (field in encrypted && encrypted[field] !== undefined) {
      encrypted[field] = encryptField(encrypted[field]);
    }
  }

  return encrypted;
}

/**
 * Decrypt fields in result object after read
 */
function decryptResultFields(result: unknown): unknown {
  if (result === null || result === undefined) {
    return result;
  }

  if (Array.isArray(result)) {
    return result.map(decryptResultFields);
  }

  if (typeof result === 'object') {
    const decrypted = { ...result } as Record<string, unknown>;

    for (const field of FIELDS_TO_ENCRYPT) {
      if (field in decrypted) {
        decrypted[field] = decryptField(decrypted[field]);
      }
    }

    return decrypted;
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Middleware Extension
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create Prisma extension for trace encryption.
 *
 * Usage:
 * ```typescript
 * const prisma = new PrismaClient().$extends(traceEncryptionExtension);
 * // Now all ConversationTrace operations automatically encrypt/decrypt
 * ```
 *
 * Note: This uses Prisma's client extension feature which is the modern
 * replacement for middleware. Extensions compose better and have better typing.
 */
export const traceEncryptionExtension = Prisma.defineExtension({
  name: 'trace-encryption',
  query: {
    conversationTrace: {
      // Encrypt on create
      async create({ args, query }) {
        if (args.data) {
          args.data = encryptDataFields(args.data as Record<string, unknown>) as typeof args.data;
        }
        const result = await query(args);
        return decryptResultFields(result);
      },

      // Encrypt on createMany
      async createMany({ args, query }) {
        if (Array.isArray(args.data)) {
          args.data = args.data.map(
            (d) => encryptDataFields(d as Record<string, unknown>) as typeof d
          );
        } else if (args.data) {
          args.data = encryptDataFields(args.data as Record<string, unknown>) as typeof args.data;
        }
        return query(args);
      },

      // Encrypt on update
      async update({ args, query }) {
        if (args.data) {
          args.data = encryptDataFields(args.data as Record<string, unknown>) as typeof args.data;
        }
        const result = await query(args);
        return decryptResultFields(result);
      },

      // Encrypt on updateMany
      async updateMany({ args, query }) {
        if (args.data) {
          args.data = encryptDataFields(args.data as Record<string, unknown>) as typeof args.data;
        }
        return query(args);
      },

      // Encrypt on upsert
      async upsert({ args, query }) {
        if (args.create) {
          args.create = encryptDataFields(
            args.create as Record<string, unknown>
          ) as typeof args.create;
        }
        if (args.update) {
          args.update = encryptDataFields(
            args.update as Record<string, unknown>
          ) as typeof args.update;
        }
        const result = await query(args);
        return decryptResultFields(result);
      },

      // Decrypt on findUnique
      async findUnique({ args, query }) {
        const result = await query(args);
        return decryptResultFields(result);
      },

      // Decrypt on findFirst
      async findFirst({ args, query }) {
        const result = await query(args);
        return decryptResultFields(result);
      },

      // Decrypt on findMany
      async findMany({ args, query }) {
        const result = await query(args);
        return decryptResultFields(result);
      },
    },
  },
});

/**
 * Type for PrismaClient with trace encryption extension.
 * In Prisma 7, extensions maintain the base PrismaClient interface
 * while adding transparent encryption behavior.
 */
export type PrismaWithTraceEncryption = PrismaClient;
