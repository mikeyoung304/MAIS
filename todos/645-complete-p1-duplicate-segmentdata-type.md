---
status: completed
priority: p1
issue_id: 645
tags: [code-review, architecture, typescript, dry-violation]
dependencies: []
---

# Duplicate SegmentData Type Definition

## Problem Statement

`SegmentData` interface is defined in `apps/web/src/lib/tenant.ts` but `SegmentDto` already exists in `@macon/contracts` with identical structure. This violates the DRY principle and the project's contracts-first architecture.

**Why it matters:** Per CLAUDE.md: "Never define response types in routes or client. Always import from contracts." Type drift will cause runtime bugs when the contract evolves.

## Findings

**Location:** `/Users/mikeyoung/CODING/MAIS/apps/web/src/lib/tenant.ts` (lines 397-412)

**Duplicated code:**

```typescript
// In tenant.ts - DUPLICATED
export interface SegmentData {
  id: string;
  tenantId: string;
  slug: string;
  name: string;
  heroTitle: string;
  heroSubtitle: string | null;
  // ... same fields as SegmentDto
}

// In @macon/contracts - CANONICAL
export const SegmentDtoSchema = z.object({
  id: z.string(),
  tenantId: string(),
  slug: z.string(),
  // ...
});
```

**Source:** architecture-strategist agent

## Proposed Solutions

### Option 1: Import from Contracts (Recommended)

Import `SegmentDto` from `@macon/contracts` and create a type alias:

```typescript
import type { SegmentDto } from '@macon/contracts';
export type SegmentData = SegmentDto;
```

**Pros:**

- Single source of truth
- Contract changes propagate automatically
- Follows project conventions

**Cons:**

- Minor import addition

**Effort:** Small (5 min)
**Risk:** Low

### Option 2: Use Zod Inference

If the Zod schema is the canonical source:

```typescript
import { SegmentDtoSchema } from '@macon/contracts';
export type SegmentData = z.infer<typeof SegmentDtoSchema>;
```

**Pros:**

- Type derived from validation schema
- Ensures runtime/compile-time parity

**Cons:**

- Slightly more verbose

**Effort:** Small (5 min)
**Risk:** Low

## Recommended Action

Option 1 - Import from contracts

## Technical Details

**Affected files:**

- `apps/web/src/lib/tenant.ts`

**Components affected:**

- `TenantStorefrontData` interface
- `SegmentPackagesSection` component

## Acceptance Criteria

- [ ] `SegmentData` is imported from or aliased to `@macon/contracts`
- [ ] No duplicate interface definition in `tenant.ts`
- [ ] TypeScript compiles without errors
- [ ] Segment-first browsing still works correctly

## Work Log

| Date       | Action                   | Learnings                                      |
| ---------- | ------------------------ | ---------------------------------------------- |
| 2026-01-08 | Created from code review | DRY violations in type definitions cause drift |

## Resources

- Code review: Segment-first browsing implementation
- CLAUDE.md contracts-first guidance
