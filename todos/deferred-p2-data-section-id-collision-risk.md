---
status: deferred
priority: p2
triage_date: '2026-01-12'
triage_by: master-architect-triage
verified: true
defer_reason: Theoretical risk - advisory locks in transactions already prevent this scenario. Low priority.
effort: 20min
---

# P2: Section ID Collision Risk in Client-Side Generator

**Source:** Code Review - Data Integrity
**PR:** #28 feat/agent-system-integrity-fixes
**Date:** 2026-01-12
**Reviewer:** data-integrity-guardian

## Issue

`generateSectionIdLocal()` uses a monotonically incrementing counter (`-main`, `-2`, `-3`) based only on `existingIds` passed into the function. If this function is called in different contexts with incomplete `existingIds` sets (e.g., during concurrent normalization), duplicate IDs could be generated.

## Location

- `apps/web/src/lib/tenant.client.ts:264-282`

## Current Code

```typescript
function generateSectionIdLocal(
  pageName: PageName,
  sectionType: string,
  existingIds: Set<string>
): string {
  const baseId = `${pageName}-${sectionType}-main`;
  if (!existingIds.has(baseId)) return baseId;
  // Counter-based fallback...
}
```

## Collision Scenario

1. Two server requests concurrently call `normalizeToPages()` for same tenant
2. Neither sees the other's generated IDs yet (pre-transaction commit)
3. Both generate `home-testimonials-2` for a new section
4. One request's section gets overwritten when the other commits

## Recommended Fix

Either:

**Option A: Deprecate client-side generation**
Use server-side `generateSectionId()` from contracts within advisory-locked transactions only.

**Option B: Add collision-proof qualifiers**

```typescript
import { nanoid } from 'nanoid';

function generateSectionIdLocal(
  pageName: PageName,
  sectionType: string,
  existingIds: Set<string>
): string {
  const baseId = `${pageName}-${sectionType}-main`;
  if (!existingIds.has(baseId)) return baseId;

  // Use nanoid for collision-proof IDs
  return `${pageName}-${sectionType}-${nanoid(6)}`;
}
```

## Severity Justification

P2 because section ID collisions could cause data loss, but the scenario requires specific timing conditions.
