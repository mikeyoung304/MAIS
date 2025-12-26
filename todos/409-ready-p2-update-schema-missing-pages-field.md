---
status: complete
priority: p2
issue_id: "409"
tags:
  - code-review
  - typescript
  - schema
  - locked-template-system
dependencies: []
---

# UpdateLandingPageConfigSchema Missing `pages` Field

## Problem Statement

The `UpdateLandingPageConfigSchema` in contracts is missing the new `pages` field. While the main `LandingPageConfigSchema` includes it, the update schema does not, creating potential type mismatches.

**Why This Matters:**
- Schema is exported and could be used for validation
- Type inconsistency between read and update operations
- May cause confusion for developers using the schema

## Findings

**Location:** `packages/contracts/src/landing-page.ts` (lines 444-456)

**Evidence:**
```typescript
export const UpdateLandingPageConfigSchema = z.object({
  sections: LandingPageSectionsSchema.partial().optional(),
  hero: HeroSectionConfigSchema.optional(),
  // ... other legacy fields
  // MISSING: pages: PagesConfigSchema.optional(),
});
```

**Note:** Backend route uses `LandingPageConfigSchema.parse()` directly, so this is currently dead code. But the exported type is inconsistent.

**Agent:** Architecture Strategist

## Proposed Solutions

### Solution 1: Add pages Field (Recommended)

```typescript
export const UpdateLandingPageConfigSchema = z.object({
  pages: PagesConfigSchema.optional(),
  // ... existing fields
});
```

**Pros:**
- Consistent types
- Future-proof for partial updates

**Cons:**
- None

**Effort:** Small
**Risk:** None

### Solution 2: Deprecate the Schema

Mark schema as deprecated if not used.

**Pros:**
- Clear intent
- No confusion

**Cons:**
- Breaking change if external consumers use it

**Effort:** Small
**Risk:** Low

## Technical Details

**Affected Files:**
- `packages/contracts/src/landing-page.ts`

## Acceptance Criteria

- [ ] `pages` field added to `UpdateLandingPageConfigSchema`
- [ ] Or schema marked as deprecated with JSDoc comment
- [ ] TypeScript passes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-12-25 | Created from code review | Schema inconsistency between read/update |
