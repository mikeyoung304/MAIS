---
status: complete
priority: p3
issue_id: "019"
tags: [code-review, simplification, yagni, storefront, deferred]
dependencies: ["016"]
---

# Consider Merging Duplicate Page Components (YAGNI)

## Problem Statement

PR #6 creates separate page components for segment-based and root tier selection that are 85-90% identical. Following DHH/Rails "convention over configuration" and YAGNI principles, these could potentially be merged.

**Why this matters:** More files = more maintenance burden. The duplication adds ~100 lines that could be eliminated.

## Findings

### SegmentTiers vs RootTiers
**Files:**
- `client/src/pages/SegmentTiers.tsx` (75 lines)
- `client/src/pages/RootTiers.tsx` (91 lines)

**Differences:**
- Data source: `useSegmentWithPackages(slug)` vs `usePackages()`
- Filter: segment packages vs `!p.segmentId`
- Back link: exists for segment, none for root

**Identical code:**
- Loading skeleton rendering
- Error state handling
- TierSelector props pattern

### SegmentTierDetail vs RootTierDetail
**Files:** Both in `client/src/pages/TierDetailPage.tsx` (146 lines total)

**Differences:**
- Data source hooks
- Package filtering (4 lines)

**Identical code:**
- Param validation
- Loading/error handling
- TierDetail rendering

### Simplification Potential
- **Before:** 7 files, 961 lines
- **After:** 5 files, ~620 lines (35% reduction)

## Proposed Solutions

### Option A: Keep Separate (Current State)
**Effort:** None | **Risk:** None

Keep current implementation for clarity.

**Pros:**
- Each route has dedicated component
- Easy to understand individual flows
- No risk of breaking changes

**Cons:**
- Duplicate code to maintain
- Larger bundle size

### Option B: Merge Pages with Route Params
**Effort:** Medium | **Risk:** Medium

Create unified components that handle both cases:

```typescript
// Unified Tiers.tsx
function Tiers() {
  const { slug } = useParams();
  const isSegment = Boolean(slug);

  const { data, isLoading, error } = isSegment
    ? useSegmentWithPackages(slug!)
    : usePackages();

  const packages = isSegment
    ? data?.packages
    : data?.filter(p => !p.segmentId);

  return <TierSelector packages={packages} segmentSlug={slug} />;
}
```

**Pros:**
- 35% code reduction
- Single source of truth
- Fewer files to maintain

**Cons:**
- Conditional hook calls need careful handling
- Slightly more complex component logic
- Risk of regressions in existing flows

### Option C: Create Shared Content Component
**Effort:** Small | **Risk:** Low

Extract shared loading/error states to TierSelector, keep thin page wrappers.

**Pros:**
- Reduces duplication without risky refactor
- Pages remain simple route handlers

**Cons:**
- Still have multiple files

## Recommended Action

**DECISION: Keep separate (Option A)** ✅ No change needed.

After detailed analysis, the cost of merging outweighs the benefits:

### Why Merging is Not Worth It:

1. **Conditional Hook Violation**: Merging requires conditional hook calls (`isSegment ? useSegmentWithPackages() : usePackages()`), which violates React best practices and adds cognitive overhead.

2. **Different Error Semantics**: RootTiers needs user-facing error recovery with retry button; SegmentTiers silently redirects. Merging conflates these two error philosophies.

3. **Route Semantic Clarity**: These routes represent fundamentally different concepts:
   - `/s/:slug` = "filter packages within a specific segment"
   - `/tiers` = "filter packages without a segment association"
   Separate components make this distinction explicit and self-documenting.

4. **Context Passing**: Segment routes pass segment metadata (`segmentSlug`, `segmentName`); root routes don't. Conditional prop passing adds complexity.

5. **Minimal Code Savings**: ~50 lines saved (mostly duplicated loading/error skeletons that should arguably be in a shared hook, not component).

6. **Low Maintenance Burden**: Both components are small, tested, and stable. Duplication is acceptable for 75-91 line files.

### What Could Be Done Instead (Lower-Risk):

If code duplication becomes a real issue in the future, consider:
- **Extract shared loading skeleton** to a utility hook or wrapper component
- **Extract error UI pattern** to reusable component
- **Extract tier validation logic** to a custom hook

These are lower-risk refactors that don't require conditional hooks or route consolidation.

## Technical Details

This is a **nice-to-have** refactoring opportunity, not a requirement. The current implementation is functional and maintainable.

**If pursuing Option B:**
- Update `client/src/router.tsx` to use unified components
- Ensure all tests still pass
- Verify both URL patterns work correctly

## Acceptance Criteria

If implementing:
- [ ] Unified component handles both segment and root cases
- [ ] `/tiers` route works correctly
- [ ] `/s/:slug` route works correctly
- [ ] `/tiers/:tier` route works correctly
- [ ] `/s/:slug/:tier` route works correctly
- [ ] No visual regressions

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-11-27 | Created | Identified during PR #6 simplicity review |
| 2025-12-03 | DEFERRED | Detailed analysis shows conditional hooks + route semantic differences justify keeping separate. Document as deferred decision. |

## Resources

- PR #6: https://github.com/mikeyoung304/MAIS/pull/6
- DHH Rails doctrine: https://rubyonrails.org/doctrine
