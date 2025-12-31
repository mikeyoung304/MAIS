---
module: MAIS
date: 2025-12-31
problem_type: testing_and_caching
component: agent/utils, agent/context
symptoms:
  - Test failure due to "timeout" being a retryable pattern in error messages
  - Singleton cache pattern prevents dependency injection for testing
  - Cache not invalidated after write tool execution
  - Full error objects logged (potential sensitive data)
root_cause: testing_patterns
resolution_type: prevention_strategy
severity: P2
tags: [testing, caching, logging, security, dependency-injection, phase-5]
---

# Phase 5 Prevention Strategies: Testing and Caching Patterns

**Purpose:** Prevent 4 critical issues discovered during Phase 5 code review related to testing, caching, and error logging.

**When to read:** Before implementing retry logic, caching, or error handling.

---

## Issue 1: Retryable Keyword Conflicts in Tests (P2)

### Problem

Test error messages that contain retryable keywords (like "timeout", "network", "503", "rate limit") trigger the retry logic, causing tests to fail or behave unexpectedly.

**Location:** `/Users/mikeyoung/CODING/MAIS/server/src/agent/utils/retry.ts`

**Evidence from retry.ts:**

```typescript
const RETRYABLE_ERROR_PATTERNS = [
  /rate.?limit/i,
  /too.?many.?requests/i,
  /overloaded/i,
  /503/,
  /502/,
  /timeout/i, // <-- This triggers on test errors containing "timeout"
  /ECONNRESET/,
  /ECONNREFUSED/,
  /ETIMEDOUT/,
  /network/i,
  /temporarily.?unavailable/i,
];
```

**Example Test Failure:**

```typescript
// This test FAILS because "timeout" in error message triggers retry
it('throws non-retryable error immediately', async () => {
  const mockFn = vi.fn(async () => {
    throw new Error('Request timeout exceeded limit'); // Contains "timeout"!
  });

  await expect(withRetry(mockFn, 'test')).rejects.toThrow();
  expect(mockFn).toHaveBeenCalledOnce(); // FAILS - called 4 times due to retries
});
```

### Prevention Strategy

**Rule:** Test error messages MUST NOT contain retryable keywords unless testing retry behavior.

#### Reserved Keywords (Do Not Use in Test Errors)

- timeout, ETIMEDOUT
- rate limit, rate-limit
- too many requests
- overloaded
- network
- temporarily unavailable
- 502, 503, 429, 500, 504
- ECONNRESET, ECONNREFUSED

#### Safe Test Error Messages

```typescript
// ❌ WRONG - Contains retryable keyword
throw new Error('Request timeout');
throw new Error('Network error');
throw new Error('Service unavailable (503)');

// ✅ CORRECT - Descriptive without retryable keywords
throw new Error('Request failed');
throw new Error('Connection failed');
throw new Error('Service error');
throw new Error('Operation failed: invalid input');
throw new Error('Test deliberate failure');
```

#### Alternative: Use Status Codes Directly

```typescript
// ❌ WRONG - Status in error message triggers retry
throw new Error('HTTP 503: Service Unavailable');

// ✅ CORRECT - Use status code property (checked before message)
throw { status: 400, message: 'Bad request' }; // 400 is not retryable
throw { status: 403, message: 'Forbidden' }; // 403 is not retryable
```

#### Testing Retry Behavior Correctly

When you DO want to test retry behavior, use "overloaded" pattern which is clearer:

```typescript
// Testing actual retry behavior
it('retries on overloaded errors', async () => {
  const mockFn = vi
    .fn()
    .mockRejectedValueOnce(new Error('Service overloaded')) // Retryable
    .mockResolvedValueOnce('success');

  const promise = withRetry(mockFn, 'test', { maxRetries: 1, jitter: false });
  await vi.advanceTimersByTimeAsync(1000);
  const result = await promise;

  expect(result).toBe('success');
  expect(mockFn).toHaveBeenCalledTimes(2);
});
```

### ESLint Rule (Recommended)

Add custom ESLint rule to detect retryable keywords in test error messages:

```javascript
// .eslintrc.json
{
  "rules": {
    "no-restricted-syntax": [
      "error",
      {
        "selector": "ThrowStatement > CallExpression[callee.name='Error'] > Literal[value=/timeout|network|503|502|rate.?limit/i]",
        "message": "Test error messages must not contain retryable keywords (timeout, network, 503, etc.). Use neutral error messages like 'Request failed' or 'Operation failed'."
      }
    ]
  }
}
```

---

## Issue 2: Singleton Cache Pattern Prevents Testability (P2)

### Problem

The context cache is exported as a singleton, making it impossible to inject a mock cache in tests or configure different TTLs for different environments.

**Location:** `/Users/mikeyoung/CODING/MAIS/server/src/agent/context/context-cache.ts`

**Evidence:**

```typescript
// Line 181 - Singleton export
export const contextCache = new ContextCache();

// orchestrator.ts - Direct import, not injected
const cached = contextCache.get(tenantId);
```

### Prevention Strategy

**Rule:** Prefer dependency injection over singletons for testable code.

#### Pattern A: Full Dependency Injection (Recommended)

```typescript
// context-cache.ts
export class ContextCache {
  private cache = new Map<string, CacheEntry>();
  private config: ContextCacheConfig;

  constructor(config: Partial<ContextCacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  get(tenantId: string): AgentSessionContext | null { ... }
  set(tenantId: string, context: AgentSessionContext): void { ... }
  invalidate(tenantId: string): void { ... }
  clear(): void { ... }
}

// Factory for creating cache instances
export function createContextCache(config?: Partial<ContextCacheConfig>): ContextCache {
  return new ContextCache(config);
}

// Default singleton for backward compatibility
export const defaultContextCache = new ContextCache();
```

```typescript
// orchestrator.ts
export class CustomerOrchestrator {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly config: Partial<OrchestratorConfig> = {},
    private readonly cache: ContextCache = defaultContextCache  // Inject with default
  ) {}

  async processMessage(...) {
    const cached = this.cache.get(tenantId);  // Uses injected cache
    // ...
  }
}
```

```typescript
// Test - inject mock cache
describe('CustomerOrchestrator', () => {
  it('uses cached context when available', async () => {
    const mockCache = createContextCache({ ttlMs: 1000 });
    mockCache.set('tenant-1', mockContext);

    const orchestrator = new CustomerOrchestrator(
      mockPrisma,
      {},
      mockCache  // Injected mock
    );

    await orchestrator.processMessage({ tenantId: 'tenant-1', ... });
    // Assert cache was used
  });

  it('handles cache miss gracefully', async () => {
    const emptyCache = createContextCache();
    const orchestrator = new CustomerOrchestrator(mockPrisma, {}, emptyCache);

    // Cache miss triggers context rebuild
    await orchestrator.processMessage({ tenantId: 'tenant-1', ... });
  });
});
```

#### Pattern B: Module-Level Reset (Simpler)

If full DI is too invasive, add a reset function for tests:

```typescript
// context-cache.ts
let contextCache = new ContextCache();

export function getContextCache(): ContextCache {
  return contextCache;
}

// For tests only - resets to fresh instance
export function __resetCacheForTesting(config?: Partial<ContextCacheConfig>): void {
  contextCache = new ContextCache(config);
}
```

```typescript
// Test setup
beforeEach(() => {
  __resetCacheForTesting({ ttlMs: 100 }); // Fast TTL for tests
});

afterEach(() => {
  __resetCacheForTesting(); // Clean slate
});
```

#### Checklist for Injectable Dependencies

When creating shared services/utilities:

- [ ] Export the class, not just an instance
- [ ] Provide a factory function for custom configurations
- [ ] Accept dependencies via constructor parameters
- [ ] Provide sensible defaults that maintain backward compatibility
- [ ] Document test injection patterns

---

## Issue 3: Cache Invalidation After Write Operations (P2)

### Problem

Write tools modify tenant data but don't trigger cache invalidation. Users see stale stats until the 5-minute TTL expires.

**Location:** `/Users/mikeyoung/CODING/MAIS/server/src/agent/orchestrator/orchestrator.ts`

**Evidence:** The invalidation method exists but is never called after tool execution:

```typescript
// Line 870-872 - Method exists
invalidateContextCache(tenantId: string): void {
  contextCache.invalidate(tenantId);
}

// But never called after tool execution!
```

### Prevention Strategy

**Rule:** Always invalidate cache after successful write operations.

#### Pattern A: Automatic Invalidation by Tool Type (Recommended)

```typescript
// tools/types.ts - Add write tool flag
export interface AgentTool {
  name: string;
  description: string;
  handler: ToolHandler;
  isWriteTool?: boolean; // New flag
}

// Define tools with write flag
export const tools: AgentTool[] = [
  // Read tools - no flag needed
  { name: 'get_services', description: '...', handler: getServicesHandler },
  { name: 'check_availability', description: '...', handler: checkAvailabilityHandler },

  // Write tools - flag required
  {
    name: 'upsert_services',
    description: '...',
    handler: upsertServicesHandler,
    isWriteTool: true,
  },
  {
    name: 'update_storefront',
    description: '...',
    handler: updateStorefrontHandler,
    isWriteTool: true,
  },
  { name: 'create_booking', description: '...', handler: createBookingHandler, isWriteTool: true },
];
```

```typescript
// orchestrator.ts - Auto-invalidate after write tools
async processToolCall(tenantId: string, toolCall: ToolCall): Promise<ToolResult> {
  const tool = this.tools.find(t => t.name === toolCall.name);
  if (!tool) throw new Error(`Unknown tool: ${toolCall.name}`);

  const result = await tool.handler(tenantId, toolCall.params);

  // Auto-invalidate cache after successful write
  if (result.success && tool.isWriteTool) {
    this.invalidateContextCache(tenantId);
    logger.debug({ tenantId, toolName: tool.name }, 'Cache invalidated after write tool');
  }

  return result;
}
```

#### Pattern B: Return-Based Invalidation

Tools explicitly request cache invalidation via return value:

```typescript
// Tool result includes invalidation flag
interface AgentToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  invalidateCache?: boolean; // Tool decides
}

// In tool handler
async function upsertServicesHandler(tenantId: string, params: unknown): Promise<AgentToolResult> {
  // ... perform update
  return {
    success: true,
    data: updatedServices,
    invalidateCache: true, // Request invalidation
  };
}

// In orchestrator
if (result.success && result.invalidateCache) {
  this.invalidateContextCache(tenantId);
}
```

#### Pattern C: Event-Based Invalidation

For more complex systems, use events:

```typescript
// events.ts
export const TENANT_DATA_CHANGED = 'tenant:data:changed';

// Tool emits event after write
eventEmitter.emit(TENANT_DATA_CHANGED, { tenantId });

// Cache listens for event
eventEmitter.on(TENANT_DATA_CHANGED, ({ tenantId }) => {
  contextCache.invalidate(tenantId);
  logger.debug({ tenantId }, 'Cache invalidated via event');
});
```

#### Write Tools Checklist

Maintain a list of tools that modify tenant data:

| Tool Name            | Data Modified       | Invalidates |
| -------------------- | ------------------- | ----------- |
| `upsert_services`    | Packages, Segments  | Yes         |
| `update_storefront`  | Landing page config | Yes         |
| `update_package`     | Package details     | Yes         |
| `create_booking`     | Bookings            | Yes         |
| `book_service` (T3)  | Bookings            | Yes         |
| `get_services`       | None                | No          |
| `check_availability` | None                | No          |
| `get_business_info`  | None                | No          |

---

## Issue 4: Error Sanitization in Logging (P3)

### Problem

Full error objects are logged, potentially containing sensitive information from API responses (API keys, internal details, stack traces with file paths).

**Location:**

- `/Users/mikeyoung/CODING/MAIS/server/src/agent/utils/retry.ts` (lines 144-165)
- `/Users/mikeyoung/CODING/MAIS/server/src/agent/orchestrator/orchestrator.ts` (lines 740-741)

**Evidence:**

```typescript
// retry.ts:144 - Full error object logged
logger.warn(
  { error, operationName, attempt }, // Full error object!
  'Non-retryable error encountered'
);

// orchestrator.ts:740 - Same issue
logger.error({ error, tenantId, sessionId }, 'Claude API call failed');
```

### Prevention Strategy

**Rule:** Extract only safe fields from errors before logging.

#### Pattern A: Safe Error Extraction Helper (Recommended)

```typescript
// lib/core/error-sanitizer.ts
export interface SanitizedError {
  message: string;
  name?: string;
  code?: string | number;
  status?: number;
  type?: string;
  // Explicitly omit: stack, config, request, response, headers
}

/**
 * Extracts safe fields from an error for logging.
 * Removes potentially sensitive data like headers, request bodies, and stack traces.
 */
export function sanitizeError(error: unknown): SanitizedError {
  if (!error) {
    return { message: 'Unknown error' };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      // Only include stack in development
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    };
  }

  if (typeof error === 'object') {
    const err = error as Record<string, unknown>;
    return {
      message: typeof err.message === 'string' ? err.message : String(error),
      status: typeof err.status === 'number' ? err.status : undefined,
      code: typeof err.code === 'string' || typeof err.code === 'number' ? err.code : undefined,
      type: typeof err.type === 'string' ? err.type : undefined,
    };
  }

  return { message: String(error) };
}
```

```typescript
// Usage in retry.ts
import { sanitizeError } from '../../lib/core/error-sanitizer';

logger.warn(
  { error: sanitizeError(error), operationName, attempt },
  'Non-retryable error encountered'
);

// Usage in orchestrator.ts
logger.error({ error: sanitizeError(error), tenantId, sessionId }, 'Claude API call failed');
```

#### Pattern B: Pino Error Serializer (Global)

Configure pino to sanitize all errors globally:

```typescript
// lib/core/logger.ts
import pino from 'pino';

const logger = pino({
  serializers: {
    error: (err: unknown) => {
      if (!err) return undefined;

      const base = {
        message: err instanceof Error ? err.message : String(err),
        name: err instanceof Error ? err.name : 'Error',
      };

      // Type-safe property access
      if (typeof err === 'object' && err !== null) {
        const obj = err as Record<string, unknown>;
        if (typeof obj.code === 'string') base.code = obj.code;
        if (typeof obj.status === 'number') base.status = obj.status;
        if (typeof obj.type === 'string') base.type = obj.type;
      }

      // Stack traces only in development
      if (process.env.NODE_ENV === 'development' && err instanceof Error) {
        base.stack = err.stack;
      }

      return base;
    },
  },
});

export { logger };
```

#### Pattern C: Error Context Wrapper

Create a wrapper for adding context without full error:

```typescript
// lib/core/log-helpers.ts
export function errorContext(
  error: unknown,
  additionalContext: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    error: sanitizeError(error),
    ...additionalContext,
  };
}

// Usage
logger.error(
  errorContext(error, { tenantId, sessionId, operation: 'claude_api_call' }),
  'Claude API call failed'
);
```

#### Fields to NEVER Log

| Field                    | Risk                       | Alternative                    |
| ------------------------ | -------------------------- | ------------------------------ |
| `error.config`           | May contain API keys       | Log operation name only        |
| `error.request`          | Full request body, headers | Log HTTP method + URL path     |
| `error.response.headers` | Auth tokens                | Log status code only           |
| `error.response.data`    | Full response body         | Log error code/type            |
| `stack` in production    | File paths, versions       | Omit or send to error tracking |
| `headers.authorization`  | Bearer tokens              | Never log                      |
| `headers.x-api-key`      | API keys                   | Never log                      |

#### Test for Error Sanitization

```typescript
describe('sanitizeError', () => {
  it('removes sensitive fields', () => {
    const unsafeError = {
      message: 'API failed',
      status: 500,
      config: { headers: { Authorization: 'Bearer secret' } },
      request: { body: { password: 'secret' } },
    };

    const sanitized = sanitizeError(unsafeError);

    expect(sanitized).toEqual({
      message: 'API failed',
      status: 500,
    });
    expect(sanitized).not.toHaveProperty('config');
    expect(sanitized).not.toHaveProperty('request');
  });

  it('handles Error instances', () => {
    const error = new Error('Something failed');
    const sanitized = sanitizeError(error);

    expect(sanitized.message).toBe('Something failed');
    expect(sanitized.name).toBe('Error');
  });

  it('includes stack only in development', () => {
    const originalEnv = process.env.NODE_ENV;

    process.env.NODE_ENV = 'production';
    const prodSanitized = sanitizeError(new Error('test'));
    expect(prodSanitized).not.toHaveProperty('stack');

    process.env.NODE_ENV = 'development';
    const devSanitized = sanitizeError(new Error('test'));
    expect(devSanitized.stack).toBeDefined();

    process.env.NODE_ENV = originalEnv;
  });
});
```

---

## Quick Reference Checklist

### Before Writing Tests

- [ ] Error messages avoid retryable keywords (timeout, network, 503, etc.)
- [ ] Use status codes for specific HTTP scenarios: `{ status: 400 }`
- [ ] Test retry behavior with intentional retryable patterns only

### Before Creating Shared Utilities

- [ ] Export class AND factory function, not just singleton
- [ ] Accept dependencies via constructor parameters
- [ ] Provide default singleton for backward compatibility
- [ ] Document test injection patterns

### Before Implementing Write Operations

- [ ] Mark tool as `isWriteTool: true` if it modifies tenant data
- [ ] Verify cache invalidation happens after successful writes
- [ ] Update write tools checklist in documentation

### Before Logging Errors

- [ ] Use `sanitizeError()` helper for error fields
- [ ] Never log: config, request, response.data, headers
- [ ] Stack traces only in development mode
- [ ] Include context: tenantId, operation name, relevant IDs

---

## Related Documentation

- [Prevention Strategies Index](../PREVENTION-STRATEGIES-INDEX.md)
- [Test Failure Prevention Strategies](../TEST-FAILURE-PREVENTION-STRATEGIES.md)
- [MAIS Critical Patterns](../patterns/mais-critical-patterns.md)
- [Cache Invalidation Patterns](../../performance/CACHING_ARCHITECTURE.md)

---

## Implementation Status

| Issue                           | Priority | Status                                                    | TODO Reference |
| ------------------------------- | -------- | --------------------------------------------------------- | -------------- |
| Retryable keyword conflicts     | P2       | Prevention documented                                     | -              |
| Singleton cache testability     | P2       | `todos/517-pending-p2-singleton-cache-testability.md`     |                |
| Cache invalidation after writes | P2       | `todos/518-pending-p2-cache-invalidation-after-writes.md` |                |
| Error sanitization in logs      | P3       | `todos/519-pending-p3-error-sanitization-in-logs.md`      |                |

---

**Last Updated:** 2025-12-31
**Source:** Phase 5 Code Review Learnings
**Maintainer:** Auto-generated from compound-engineering workflow
