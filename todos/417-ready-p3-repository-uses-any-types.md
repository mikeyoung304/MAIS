---
status: complete
priority: p3
issue_id: "417"
tags:
  - code-review
  - typescript
  - type-safety
  - locked-template-system
dependencies: []
---

# Repository Uses `any` for Landing Page Config Types

## Problem Statement

The tenant repository uses `any` for landing page config parameters and returns, losing type safety at the data layer.

**Why This Matters:**
- Invalid configs could be stored without validation
- Type errors won't be caught at compile time
- Violates TypeScript strict mode principles

## Findings

**Location:** `server/src/adapters/prisma/tenant.repository.ts`

**Evidence:**
```typescript
// Line 495
async getLandingPageConfig(tenantId: string): Promise<any | null>

// Line 512
async updateLandingPageConfig(tenantId: string, config: any): Promise<any>

// Line 45-46
landingPageConfig?: any;
```

**Agent:** Data Integrity Guardian

## Proposed Solutions

### Solution 1: Add Zod Validation (Recommended)

Use `LandingPageConfigSchema.safeParse()` before storage.

```typescript
import { LandingPageConfigSchema, LandingPageConfig } from '@macon/contracts';

async updateLandingPageConfig(
  tenantId: string,
  config: LandingPageConfig
): Promise<LandingPageConfig> {
  const parsed = LandingPageConfigSchema.parse(config);
  // Store parsed config
}
```

**Pros:**
- Runtime validation
- Type safety restored

**Cons:**
- Additional runtime overhead

**Effort:** Small
**Risk:** Low

### Solution 2: Type Assertions Only

Keep `any` at Prisma level but add types at interface.

**Pros:**
- Less runtime overhead

**Cons:**
- No runtime validation

**Effort:** Small
**Risk:** Medium

## Technical Details

**Affected Files:**
- `server/src/adapters/prisma/tenant.repository.ts`

## Acceptance Criteria

- [ ] Repository methods typed with LandingPageConfig
- [ ] Zod validation added before storage
- [ ] TypeScript passes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-12-25 | Created from code review | Type safety gap at repository layer |
