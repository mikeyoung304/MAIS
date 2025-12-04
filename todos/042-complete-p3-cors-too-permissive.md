---
status: complete
priority: p3
issue_id: '042'
tags: [code-review, security, cors]
dependencies: []
---

# CORS Configuration Too Permissive in Production

## Problem Statement

Production allows ANY HTTPS origin for widget embedding, which is overly permissive.

**Why this matters:** Any website can make requests to your API, potential for abuse.

## Findings

**Location:** `server/src/app.ts:104-110`

```typescript
if (process.env.NODE_ENV === 'production' && origin.startsWith('https://')) {
  callback(null, true); // Allows ANY HTTPS origin
}
```

## Proposed Solutions

Change to whitelist-only:

```typescript
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || '').split(',');
if (ALLOWED_ORIGINS.includes(origin)) {
  callback(null, true);
}
```

## Acceptance Criteria

- [x] CORS_ORIGINS environment variable (implemented as `ALLOWED_ORIGINS`)
- [x] Only whitelisted origins allowed
- [x] Widget embedding still works for registered domains

## Resolution

**Status:** Already implemented (discovered during verification)

The CORS configuration has been fully implemented with a whitelist-based approach:

### Implementation Details

**Location:** `server/src/app.ts:87-114`

```typescript
cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, curl)
    if (!origin) return callback(null, true);

    // In development, allow all origins
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }

    // In production, use explicit allowlist from environment variable
    const allowedOrigins = config.ALLOWED_ORIGINS || [];

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn({ origin, allowedOrigins }, 'CORS request blocked - origin not in allowlist');
      callback(new Error('Not allowed by CORS'));
    }
  },
  // ... other CORS options
});
```

**Configuration:** `server/src/lib/core/config.ts:16-23`

```typescript
ALLOWED_ORIGINS: z
  .string()
  .optional()
  .transform((val) => {
    if (!val) return [];
    return val.split(',').map((origin) => origin.trim());
  }),
```

**Documentation:** `.env.example:54-57`

```bash
# CORS allowed origins for production (comma-separated list)
# In development, all origins are allowed. In production, only these origins will be permitted.
# Example: ALLOWED_ORIGINS=https://app.maconaisolutions.com,https://admin.maconaisolutions.com,https://widget.maconaisolutions.com
ALLOWED_ORIGINS=https://app.maconaisolutions.com,https://admin.maconaisolutions.com
```

### Improvements Over Original TODO

The current implementation is actually **more secure** than the TODO proposal:

1. **Strict production enforcement** - Blocks ALL non-whitelisted origins (no fallback to "any HTTPS")
2. **Security logging** - Warns when origins are blocked with details for debugging
3. **Type-safe configuration** - Zod schema validates and parses comma-separated origins
4. **Development flexibility** - Allows all origins in development mode for DX
5. **No-origin support** - Allows requests with no origin header (mobile apps, Postman)

## Work Log

| Date       | Action   | Notes                                  |
| ---------- | -------- | -------------------------------------- |
| 2025-11-27 | Created  | Found during DevOps review             |
| 2025-12-02 | Verified | Already implemented - marking complete |
