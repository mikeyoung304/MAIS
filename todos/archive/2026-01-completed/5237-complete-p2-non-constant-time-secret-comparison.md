---
status: complete
priority: p2
issue_id: '5237'
tags: [code-review, security, project-hub, cryptography]
dependencies: []
created_at: 2026-01-21
pr: 31
---

# P2: Non-Constant-Time Secret Comparison in Internal Agent Routes

> **Security Review:** String comparison vulnerable to timing attacks.

## Problem Statement

The internal secret comparison uses JavaScript's standard string equality (`!==`), which is vulnerable to timing attacks. An attacker could theoretically measure response times to progressively determine the secret character by character.

**File:** `server/src/routes/internal-agent.routes.ts`
**Line:** 246

**Evidence:**

```typescript
if (!secret || secret !== expectedSecret) {
  // Standard string comparison - timing varies based on character position
```

## Proposed Solution

Use `crypto.timingSafeEqual` for constant-time comparison:

```typescript
import crypto from 'crypto';

const secretBuffer = Buffer.from(secret || '');
const expectedBuffer = Buffer.from(expectedSecret);

if (
  secretBuffer.length !== expectedBuffer.length ||
  !crypto.timingSafeEqual(secretBuffer, expectedBuffer)
) {
  res.status(401).json({ error: 'Unauthorized' });
  return;
}
```

**Effort:** Small (15 minutes)
**Risk:** Low

## Resources

- PR: https://github.com/mikeyoung304/MAIS/pull/31
- Node.js crypto.timingSafeEqual: https://nodejs.org/api/crypto.html#cryptotimingsafeequala-b
