---
status: ready
priority: p3
issue_id: '5202'
tags: [code-review, agent-v2, security, environment-validation]
dependencies: []
---

# P3: MAIS_API_URL Env Var Not Validated for HTTPS

> **Code Review Finding:** The MAIS_API_URL environment variable lacks HTTPS validation, potentially allowing insecure HTTP in production.

## Problem Statement

The booking agent reads `MAIS_API_URL` without validating that it uses HTTPS. While HTTP is acceptable for local development (localhost), production deployments should enforce HTTPS.

**File:** `/Users/mikeyoung/CODING/MAIS/server/src/agent-v2/deploy/booking/src/agent.ts` (line 23)

**Evidence:**

```typescript
const MAIS_API_URL = process.env.MAIS_API_URL || 'http://localhost:3001';
```

## Risk Assessment

**Severity:** Low

- Production deployments via Cloud Run automatically use HTTPS URLs
- The default fallback is localhost (development)
- Misconfiguration would be caught during testing

**Impact:** If someone accidentally sets `MAIS_API_URL=http://...` in production, API calls would be unencrypted.

## Proposed Solution

Add validation that allows HTTP only for localhost:

```typescript
const MAIS_API_URL = process.env.MAIS_API_URL || 'http://localhost:3001';

// Validate: Allow HTTP only for localhost, require HTTPS for all other hosts
if (MAIS_API_URL.startsWith('http://') && !MAIS_API_URL.includes('localhost')) {
  throw new Error(`MAIS_API_URL must use HTTPS for non-localhost hosts. Got: ${MAIS_API_URL}`);
}
```

**Alternative:** Log a warning instead of throwing, for graceful degradation in staging environments.

## Acceptance Criteria

- [ ] Add URL protocol validation in booking agent
- [ ] Allow HTTP for localhost/127.0.0.1 (development)
- [ ] Require HTTPS for all other hosts (production)
- [ ] Apply same validation to other agents that use MAIS_API_URL
- [ ] Add test case for validation logic

## Work Log

| Date       | Action  | Notes                             |
| ---------- | ------- | --------------------------------- |
| 2026-01-19 | Created | Found during agent-v2 code review |
