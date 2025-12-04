---
status: complete
priority: p2
issue_id: '051'
tags: [code-review, scheduling, security, information-disclosure]
dependencies: []
---

# Public Endpoints Expose tenantId in Response

## Problem Statement

Public scheduling endpoints (`GET /v1/public/services`) include `tenantId` in the response body. While not a critical secret, this is unnecessary information disclosure that violates the principle of least privilege.

**Why this matters:** Attackers could enumerate tenantIds from public responses, potentially useful for targeted attacks.

## Findings

### Code Evidence

**Location:** `server/src/routes/public-scheduling.routes.ts:70-85`

```typescript
const serviceDtos: ServiceDto[] = services.map((service) => ({
  id: service.id,
  tenantId: service.tenantId, // <-- EXPOSED
  slug: service.slug,
  name: service.name,
  // ...
}));
```

### Analysis

- Client already knows tenant context from X-Tenant-Key header
- tenantId in response is redundant
- Principle of least privilege: Don't expose more than necessary

## Proposed Solutions

### Option A: Remove from Public DTOs (Recommended)

**Effort:** Small | **Risk:** Low

Create separate public-facing DTOs without tenantId:

```typescript
const publicServiceDto = {
  id: service.id,
  // tenantId removed
  slug: service.slug,
  name: service.name,
  // ...
};
```

## Technical Details

**Files to Update:**

- `server/src/routes/public-scheduling.routes.ts:70-85, 130-145`

## Acceptance Criteria

- [ ] tenantId removed from public service responses
- [ ] tenantId removed from public availability responses
- [ ] Frontend doesn't break (verify no tenantId usage from response)

## Work Log

| Date       | Action  | Notes                                 |
| ---------- | ------- | ------------------------------------- |
| 2025-11-27 | Created | Found during Security Sentinel review |
