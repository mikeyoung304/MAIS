---
title: 'Prisma 7 JSON Type Errors: Complete Working Solution'
date: 2025-01-02
category: database-issues
severity: high
component: prisma-client/json-fields
tags:
  - prisma
  - typescript
  - json
  - type-casting
  - database
  - migration
status: solved
related_files:
  - server/src/types/prisma-json.ts
  - server/src/db.ts
  - server/src/agent/tracing/encryption-middleware.ts
  - server/src/agent/tracing/tracer.ts
  - server/src/agent/evals/pipeline.ts
  - server/src/adapters/prisma/catalog.repository.ts
symptoms:
  - "Type 'JsonValue' is not assignable to type 'InputJsonValue | JsonNull'"
  - "Cannot access property on type 'unknown' when reading JSON fields"
  - 'JSON field types no longer directly cast to structured types'
  - 'Prisma.JsonNull usage requires value import (not type-only)'
  - 'Null vs undefined distinction in JSON field assignments'
root_cause: |
  Prisma 7 introduced stricter JSON field type handling:
  1. JsonValue type is now `string | number | boolean | JsonObject | JsonArray | null`
  2. Direct casting to custom types no longer works (type safety)
  3. Output types (JsonValue) and input types (InputJsonValue) are distinct
  4. Prisma.JsonNull requires value import for runtime usage
  5. undefined in JSON fields must be explicitly handled as null or omitted
solution_commits:
  - 'commit-hash-agent-eval: Implement remediation plan phases 1-4'
---

# Prisma 7 JSON Type Errors: Complete Working Solution

## Problem Overview

Migrating from Prisma 6 to Prisma 7 introduces stricter JSON field type handling. The `JsonValue` type is no longer assignable to custom types directly, and input/output types are now distinct. This document provides all working patterns from the MAIS codebase.

## Root Cause Analysis

Prisma 7 changed the JSON type system:

**Before (Prisma 6):**

```typescript
// JSON fields could be cast directly
const errors = trace.errors as TracedError[]; // ✅ Worked
```

**After (Prisma 7):**

```typescript
// JsonValue is a union of primitives, not compatible with custom types
type JsonValue = string | number | boolean | JsonObject | JsonArray | null;

// Direct cast fails TypeScript checking
const errors = trace.errors as TracedError[]; // ❌ Type error
```

The changes serve to:

1. Strengthen type safety at compile time
2. Clearly distinguish output types (reading) from input types (writing)
3. Prevent accidental data corruption from type confusion
4. Require explicit handling of null vs undefined

## Complete Solution: Four Patterns

### Pattern 1: Centralized JSON Type Definitions

Create a dedicated types file for all JSON field structures:

**File: `/server/src/types/prisma-json.ts`**

````typescript
/**
 * Type definitions for Prisma JSON fields
 *
 * Prisma stores JSON columns as JsonValue type which requires casting to structured types.
 * This file provides proper TypeScript types for all JSON fields in the schema.
 *
 * Usage:
 * ```typescript
 * import type { BrandingConfig, PackagePhoto } from '../types/prisma-json';
 *
 * // Instead of: const branding = tenant.branding as any;
 * const branding = tenant.branding as BrandingConfig | null;
 * ```
 */

/**
 * Branding configuration stored in Tenant.branding JSON field
 *
 * Used by:
 * - Tenant model (branding column)
 * - Branding API endpoints
 * - Widget customization
 */
export interface BrandingConfig {
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  logo?: string;
}

/**
 * Package photo metadata stored in Package.photos JSON array
 *
 * Used by:
 * - Package model (photos column)
 * - Photo upload endpoints
 * - Package display in catalog
 *
 * @property url - Public URL to the uploaded photo
 * @property filename - Original filename
 * @property size - File size in bytes
 * @property order - Display order (0-indexed)
 */
export interface PackagePhoto {
  url: string;
  filename: string;
  size: number;
  order: number;
}

/**
 * Audit log metadata stored in ConfigChangeLog.metadata JSON field
 *
 * Used by:
 * - ConfigChangeLog model (metadata column)
 * - Audit logging service
 * - Compliance reporting
 *
 * Contains contextual information about the change event
 */
export interface AuditMetadata {
  /** Client IP address (for manual changes) */
  ip?: string;

  /** User agent string (for manual changes) */
  userAgent?: string;

  /** Type of automation (e.g., 'scheduled', 'integration', 'batch') */
  automationType?: string;

  /** Schedule ID (for scheduled changes) */
  scheduleId?: string;

  /** Timestamp when automation was triggered */
  triggeredAt?: string;

  /** Batch operation ID (for bulk changes) */
  batchId?: string;

  /** Additional custom metadata */
  [key: string]: string | number | boolean | undefined;
}

/**
 * Encrypted data structure (from encryption service)
 */
export interface EncryptedData {
  ciphertext: string;
  iv: string;
  authTag: string;
}

/**
 * Encrypted secrets stored in Tenant.secrets JSON field
 *
 * Used by:
 * - Tenant model (secrets column)
 * - Stripe Connect integration
 * - Encrypted API keys and credentials
 *
 * @property stripe - Encrypted Stripe restricted key
 */
export interface TenantSecrets {
  stripe?: EncryptedData;
  [key: string]: EncryptedData | undefined;
}

/**
 * Type helper for Prisma JSON fields
 *
 * Prisma represents JSON columns as `JsonValue | null`, so we wrap our
 * structured types with this helper to indicate they can be null.
 *
 * Usage:
 * ```typescript
 * function getBranding(tenant: Tenant): BrandingConfig {
 *   const branding: PrismaJson<BrandingConfig> = tenant.branding;
 *   return branding ?? {}; // Provide default if null
 * }
 * ```
 */
export type PrismaJson<T> = T | null;
````

### Pattern 2: Double-Cast Through Unknown for JSON Reads

When reading JSON fields from the database, use `as unknown as Type` to properly handle Prisma's type system:

**File: `/server/src/agent/evals/pipeline.ts`**

```typescript
/**
 * Parse and redact messages/toolCalls
 *
 * Uses double-cast pattern (as unknown as Type) for Prisma 7 JSON type compatibility.
 * This pattern:
 * 1. Acknowledges that Prisma returns JsonValue type
 * 2. Asserts it's unknown (escape hatch)
 * 3. Then asserts the actual type (with fallback to [])
 */
const messages = redactMessages((trace.messages as unknown as TracedMessage[]) || []);
const toolCalls = redactToolCalls((trace.toolCalls as unknown as TracedToolCall[]) || []);
```

**Key points:**

- Use `as unknown as Type` for JSON field reads (not `as Type` directly)
- Include fallback (`|| []`) for null/undefined cases
- This pattern is type-safe because TypeScript validates the final assertion

### Pattern 3: Cast Function Returns for Record Types

When functions return modified objects, cast the result type:

**File: `/server/src/agent/evals/pipeline.ts`**

```typescript
/**
 * Redact PII from tool calls.
 *
 * Cast function return to Record<string, unknown> for objects read from JSON fields.
 */
function redactToolCalls(toolCalls: TracedToolCall[]): TracedToolCall[] {
  return toolCalls.map((tc) => ({
    ...tc,
    input: redactObjectPII(tc.input) as Record<string, unknown>,
    output: redactObjectPII(tc.output),
  }));
}

/**
 * Recursively redact PII from an object.
 *
 * Input comes from JSON fields, so return type needs casting for safety.
 */
function redactObjectPII(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return redactPII(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(redactObjectPII);
  }
  if (obj !== null && typeof obj === 'object') {
    const redacted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      // Redact sensitive keys entirely
      if (['email', 'phone', 'address', 'ssn', 'card', 'password'].includes(key.toLowerCase())) {
        redacted[key] = `[REDACTED_${key.toUpperCase()}]`;
      } else {
        redacted[key] = redactObjectPII(value);
      }
    }
    return redacted;
  }
  return obj;
}
```

### Pattern 4: Null vs Undefined in JSON Field Assignments

**Critical:** Prisma 7 distinguishes between null (stored) and undefined (omitted).

**File: `/server/src/agent/tracing/tracer.ts`**

```typescript
/**
 * When persisting to database, use:
 * - null or undefined: Remove the JSON field entirely
 * - Values: Store as JSON
 */
async persistState(state: TraceState): Promise<void> {
  // ...rest of persist logic...

  if (state.traceId) {
    // Update existing trace
    await this.prisma.conversationTrace.update({
      where: { id: state.traceId },
      data: {
        endedAt: new Date(),
        turnCount: state.metrics.turnCount,
        totalTokens: state.metrics.totalTokens,
        // ✅ Use undefined (omit field) when no data
        errors: state.errors.length > 0 ? (state.errors as unknown as object) : undefined,
        // ✅ Use undefined (omit field) for optional flags
        flagReason: state.flagReason,
        reviewStatus: state.flagged ? 'pending' : null,
      },
    });
  } else {
    // Create new trace
    const created = await this.prisma.conversationTrace.create({
      data: {
        tenantId: state.tenantId,
        sessionId: state.sessionId,
        agentType: state.agentType,
        startedAt: state.startedAt,
        endedAt: new Date(),
        // ✅ Cast arrays through unknown
        messages: truncatedMessages as unknown as object,
        toolCalls: truncatedToolCalls as unknown as object,
        // ✅ Use undefined when no errors
        errors: state.errors.length > 0 ? (state.errors as unknown as object) : undefined,
        expiresAt,
        promptVersion: state.promptVersion,
        cacheHit: state.cacheHit,
        taskCompleted: state.taskCompleted,
        flagged: state.flagged,
        flagReason: state.flagReason,
        reviewStatus: state.flagged ? 'pending' : null,
      },
    });

    // Update in-memory state with traceId
    if (this.state && this.state.sessionId === state.sessionId) {
      this.state.traceId = created.id;
    }
  }
}
```

### Pattern 5: Encryption Middleware with JSON Fields

For complex JSON field handling (like encryption), use Prisma's `$extends` API:

**File: `/server/src/agent/tracing/encryption-middleware.ts`**

```typescript
/**
 * Encryption Middleware for Conversation Traces
 *
 * Uses Prisma extensions for transparent encryption/decryption of JSON fields.
 * Extensions are cleaner than old middleware for JSON field handling.
 */

import { Prisma, type PrismaClient } from '../../generated/prisma';
import { encryptionService, type EncryptedData } from '../../lib/encryption.service';

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

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
 *
 * This pattern handles:
 * 1. Null/undefined (no decryption needed)
 * 2. Already encrypted values (return as-is)
 * 3. Unencrypted values (backwards compatibility)
 * 4. Decryption errors (fail gracefully)
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

// ─────────────────────────────────────────────────────────────────────────────
// Prisma Extension
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create Prisma extension for trace encryption.
 *
 * This extension intercepts all conversationTrace operations to transparently
 * encrypt/decrypt JSON fields.
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

      // Encrypt on update
      async update({ args, query }) {
        if (args.data) {
          args.data = encryptDataFields(args.data as Record<string, unknown>) as typeof args.data;
        }
        const result = await query(args);
        return decryptResultFields(result);
      },

      // Decrypt on findUnique
      async findUnique({ args, query }) {
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
 *
 * In Prisma 7, extensions maintain the base PrismaClient interface
 * while adding transparent encryption behavior.
 */
export type PrismaWithTraceEncryption = PrismaClient;
```

## Implementation Checklist

### When Reading JSON Fields

- [ ] Use `as unknown as Type` pattern (double-cast)
- [ ] Provide fallback for null/undefined: `|| []` or `?? {}`
- [ ] Create interface definitions in `types/prisma-json.ts`
- [ ] Import types in the file using them

### When Writing JSON Fields

- [ ] Use `undefined` to omit field, not `null`
- [ ] Cast arrays: `as unknown as object`
- [ ] Use conditional assignment: `condition ? value : undefined`
- [ ] Never use `Prisma.JsonNull` without value import

### When Using Prisma Value Types

- [ ] Import Prisma as value: `import { Prisma }` (not type-only)
- [ ] Use `Prisma.InputJsonValue` for input type assertions
- [ ] Use `Prisma.JsonNull` for clearing JSON fields in transactions

### Type Safety Rules

- [ ] JSON fields read as `JsonValue` type (never directly assignable)
- [ ] Functions accept typed params: `(value: TracedMessage[]) => void`
- [ ] Casts occur at database boundary, not in business logic
- [ ] Test with `npm run typecheck` and `npm run build`

## Quick Reference: Pattern Selector

| Scenario                       | Pattern             | Example                                           |
| ------------------------------ | ------------------- | ------------------------------------------------- |
| **Read JSON from DB**          | Double-cast         | `trace.messages as unknown as TracedMessage[]`    |
| **Write JSON to DB**           | Ternary + undefined | `field: value ? value : undefined`                |
| **Function receives JSON**     | Typed param         | `function process(msgs: TracedMessage[])`         |
| **Function returns from JSON** | Cast return         | `return result as Record<string, unknown>`        |
| **Encrypt/decrypt JSON**       | Prisma extension    | Use `Prisma.defineExtension`                      |
| **Store null explicitly**      | undefined keyword   | `field: null` → omits, `field: undefined` → omits |

## Prevention Strategy

### Pre-commit Verification

```bash
# Check for unsafe JSON casts
grep -n "as.*\[\]" server/src/**/*.ts | grep -v "as unknown as"

# Check for type-only Prisma imports using runtime values
grep -n "import type.*Prisma" server/src/**/*.ts

# Run full type check (catches issues typecheck may miss)
npm run build
```

### Code Review Checklist

1. **JSON Field Reads**: Look for `trace.field as Type` - should be `as unknown as Type`
2. **JSON Field Writes**: Verify `undefined` vs `null` distinction
3. **Prisma Imports**: Ensure non-type-only if using `Prisma.JsonNull`
4. **Fallback Handling**: JSON field reads have `|| []` or `?? null` fallbacks

## Testing Pattern

```typescript
/**
 * Test JSON field round-trip (write and read)
 */
test('should roundtrip JSON fields', async () => {
  const tracer = createTracer(prisma);
  tracer.initialize('tenant-1', 'session-1', 'customer');

  // Record messages (in-memory)
  tracer.recordUserMessage('Hello', 10);
  tracer.recordAssistantResponse('Hi!', 50, 123);

  // Persist to DB
  await tracer.finalize();

  // Read back from DB
  const trace = await prisma.conversationTrace.findFirst({
    where: { sessionId: 'session-1' },
  });

  // Cast with pattern (double-cast through unknown)
  const messages = (trace?.messages as unknown as TracedMessage[]) || [];

  expect(messages).toHaveLength(2);
  expect(messages[0].role).toBe('user');
});
```

## Related Files in MAIS Codebase

- **Type definitions**: `/server/src/types/prisma-json.ts`
- **Tracer implementation**: `/server/src/agent/tracing/tracer.ts`
- **Encryption middleware**: `/server/src/agent/tracing/encryption-middleware.ts`
- **Evaluation pipeline**: `/server/src/agent/evals/pipeline.ts`
- **Catalog repository**: `/server/src/adapters/prisma/catalog.repository.ts`
- **DB client re-export**: `/server/src/db.ts`

## Key Differences from Prisma 6

| Aspect              | Prisma 6        | Prisma 7                                             |
| ------------------- | --------------- | ---------------------------------------------------- |
| **JSON cast**       | `field as Type` | `field as unknown as Type`                           |
| **Null handling**   | `null` stores   | `undefined` omits, `null` stores                     |
| **Type import**     | Type-only OK    | Value import required for runtime values             |
| **Extension API**   | Middleware      | `$extends` (cleaner)                                 |
| **Input vs Output** | Blurred         | Strict distinction (`JsonValue` vs `InputJsonValue`) |

## Troubleshooting

**"Type 'JsonValue' is not assignable to..."**
→ Use double-cast: `as unknown as YourType`

**"Cannot use 'Prisma' as value"**
→ Change import: `import { Prisma }` (remove `type`)

**"JSON field comes back as null"**
→ Check assign logic: use `undefined` to omit, not `null`

**"Type mismatch in conditional assignment"**
→ Add casts: `condition ? (value as unknown as object) : undefined`

## Related Documentation

- [Prisma 7 Migration Guide](https://www.prisma.io/docs/orm/more/upgrade-guides/upgrade-from-prisma-6-to-7)
- [JSON in Prisma](https://www.prisma.io/docs/orm/prisma-schema/data-model/json)
- [Prisma Extensions API](https://www.prisma.io/docs/orm/prisma-client/extending-prisma-client/overview)
- [Render TypeScript Build Errors](./render-typescript-prisma-type-errors.md)
