---
status: pending
priority: p1
issue_id: '11038'
tags: [code-review, security, encryption, config, startup]
---

# Encryption Key Validation Gap — Schema Allows 32 Chars, Runtime Requires 64

## Problem Statement

The config schema validates `TENANT_SECRETS_ENCRYPTION_KEY` as 32 characters minimum, but the encryption service requires 64 hexadecimal characters (32 bytes) at runtime. A deployment with a 33-63 character key passes config validation but fails at first encryption attempt — not at startup. This makes the failure mode opaque and hard to debug.

## Findings

- **Flagged by:** security-sentinel
- Config schema: `z.string().min(32)`
- Encryption service: expects 64-char hex string (32 bytes for AES-256)
- Fix: validate at startup, not lazily

## Proposed Solutions

### Option A: Fix Validation to Require 64 Hex Characters (15 min)

```typescript
z.string()
  .length(64)
  .regex(/^[0-9a-f]+$/i, 'Must be 64 hex characters');
```

- **Effort:** Small
- **Risk:** Low

## Acceptance Criteria

- [ ] Config validation rejects keys that are not exactly 64 hex characters
- [ ] Error message explains required format
- [ ] `npm run doctor` reports the correct requirement

## Work Log

- 2026-02-20: Flagged by security-sentinel. Startup validation gap.
