---
status: completed
priority: p1
issue_id: '418'
tags: [code-review, bug, mock-adapter, typescript]
dependencies: []
completed_at: '2025-12-26'
---

# Fix Undefined tenantId Reference in Mock Adapter getAddOnsForSegment

## Problem Statement

The `getAddOnsForSegment` method in the mock adapter references an undefined variable `tenantId` instead of the correctly prefixed parameter `_tenantId`. This is a runtime bug introduced during the mechanical `_tenantId` prefixing in commit 21a9b3a.

**Impact:** Runtime `ReferenceError` when `getAddOnsForSegment` is called in mock mode, breaking segment-based add-on queries.

## Findings

- **File:** `server/src/adapters/mock/index.ts`, line 366
- **Issue:** Parameter renamed from `tenantId` to `_tenantId` but function body still uses `tenantId`
- **Root cause:** Mechanical sed replacement missed internal variable usage
- **Why TypeScript didn't catch it:** The variable is passed to a method that ignores its first parameter, so there's no type error - just runtime `undefined`

```typescript
// Line 364-366 - BUG
async getAddOnsForSegment(_tenantId: string, segmentId: string): Promise<AddOn[]> {
  const segmentPackages = await this.getPackagesBySegment(tenantId, segmentId);  // BUG: tenantId undefined
```

**Similar patterns verified safe:**

- Line 222: `getPackageWithAddOns` uses `tenantId` correctly (not prefixed)
- Line 255: `getPackage` uses `tenantId` correctly (not prefixed)
- Line 357: `getPackagesBySegmentWithAddOns` uses `tenantId` correctly (has `tenantId` param)

## Proposed Solutions

### Option 1: Fix the Variable Reference (Recommended)

**Approach:** Change `tenantId` to `_tenantId` on line 366 to match the parameter name.

```typescript
async getAddOnsForSegment(_tenantId: string, segmentId: string): Promise<AddOn[]> {
  const segmentPackages = await this.getPackagesBySegment(_tenantId, segmentId);
```

**Pros:**

- Simple one-line fix
- Consistent with the underscore prefix pattern
- Maintains the "mock ignores tenantId" contract

**Cons:**

- None

**Effort:** 5 minutes

**Risk:** None - pure bug fix

---

### Option 2: Add TypeScript noUnusedLocals for Mock File

**Approach:** Add stricter TypeScript checking to catch undefined variable usage.

**Pros:**

- Prevents similar bugs in future
- Catches other potential issues

**Cons:**

- May produce false positives for intentional unused variables
- Additional complexity

**Effort:** 30 minutes

**Risk:** Low

## Recommended Action

**APPROVED: Option 1 - Fix the variable reference**

1. Edit `server/src/adapters/mock/index.ts` line 366
2. Change `tenantId` to `_tenantId` in the `getPackagesBySegment` call
3. Run `npm run typecheck` to verify
4. Run tests to confirm no breakage

**Effort:** 5 minutes | **Risk:** None

## Technical Details

**Affected files:**

- `server/src/adapters/mock/index.ts:366`

**Related components:**

- Segment-based add-on queries in catalog service
- Any code path that calls `catalogRepo.getAddOnsForSegment()` in mock mode

**Database changes:** None

## Acceptance Criteria

- [x] Line 366 changed from `tenantId` to `_tenantId`
- [x] `npm run typecheck` passes
- [x] Mock mode tests pass (if any call this method)
- [x] No other similar issues in mock adapter

## Work Log

### 2025-12-26 - Discovery via Code Review

**By:** Claude Code (multi-agent review)

**Actions:**

- Security Sentinel agent identified the bug during commit 21a9b3a review
- Code Simplicity agent confirmed via grep pattern matching
- Architecture Strategist verified no other instances exist

**Learnings:**

- Mechanical sed replacements need thorough testing
- Consider adding lint rule for undefined variable detection

## Resources

- **Commit:** 21a9b3a (fix: Phase 2-4 quality infrastructure and lint cleanup)
- **Review agents:** Security Sentinel, Code Simplicity Reviewer
