---
status: pending
priority: p2
issue_id: '250'
tags: [code-review, landing-page, performance, database]
dependencies: ['247']
source: 'plan-review-2025-12-04'
---

# TODO-250: Full Config Save on Every Auto-Save May Exceed 500ms Target

## Priority: P2 (Important - Performance)

## Status: Pending

## Source: Plan Review - Performance Oracle

## Problem Statement

The plan saves the **entire LandingPageConfig** on every auto-save, not just changed fields. With 7 sections enabled and maximum content, payload could be 50-100KB JSON, potentially exceeding the claimed 500ms auto-save target.

**Why It Matters:**

- Gallery: 20 images × 200 chars URL = 4KB
- FAQ: 20 items × 2000 chars answers = 40KB
- About: 5000 chars content field
- Combined with network latency (50-100ms) + serialization (10-20ms) + database write (20-50ms)
- Total save time: 200-300ms optimal, 500-800ms on slow connections

## Findings

### Current Save Pattern

```typescript
// Saves entire config on every debounced edit
await api.tenantAdminSaveDraft({ body: fullConfig }); // 50-100KB payload
```

### Database Transaction Overhead

```typescript
// tenant.repository.ts:544-582 - Read-Modify-Write pattern
async saveLandingPageDraft(tenantId: string, config: LandingPageConfig) {
  return await this.prisma.$transaction(async (tx) => {
    // 1. SELECT landingPageConfig (lock acquired) - 10-20ms
    const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });

    // 2. Parse JSON - 10-20ms for 100KB
    const currentWrapper = this.getLandingPageWrapper(tenant.landingPageConfig);

    // 3. Merge draft
    const newWrapper = { ...currentWrapper, draft: config };

    // 4. Serialize + UPDATE - 20-30ms
    await tx.tenant.update({ data: { landingPageConfig: newWrapper } });
  }); // Total: 60-100ms per save
}
```

## Proposed Solutions

### Option A: Accept Current Performance (MVP)
- **Effort:** 0 hours
- **Risk:** Medium (may exceed target on slow connections)
- Current approach is functional
- Monitor actual performance post-launch
- **Pros:** No additional work
- **Cons:** May need to optimize later

### Option B: Implement Partial Updates with PATCH
- **Effort:** 4-6 hours
- **Risk:** Low
- Add `PATCH /draft/:section` endpoint for single-section updates
- Only send changed section data
- **Pros:** 100x smaller payloads for single-field edits
- **Cons:** More complex API

### Option C: PostgreSQL JSONB Atomic Updates
- **Effort:** 2-3 hours
- **Risk:** Medium
- Use `jsonb_set()` to update specific paths
- Avoid full read-modify-write cycle
- **Pros:** Faster database operations
- **Cons:** Raw SQL, less type-safe

## Recommended Action

**For MVP:** Accept Option A, but document performance concern and monitor.

**Post-MVP:** Consider Option B if monitoring shows latency issues:

```typescript
// Future optimization - PATCH endpoint
router.patch('/draft/:section', async (req, res) => {
  const { section } = req.params;
  const partialConfig = req.body; // Only changed fields

  await prisma.$executeRaw`
    UPDATE "Tenant"
    SET "landingPageConfig" = jsonb_set(
      "landingPageConfig",
      '{draft,${section}}',
      ${JSON.stringify(partialConfig)}::jsonb
    )
    WHERE id = ${tenantId}
  `;
});
```

## Acceptance Criteria

- [ ] Document performance expectation in plan (500ms target with caveats)
- [ ] Add monitoring for auto-save latency (if monitoring exists)
- [ ] Create follow-up TODO for post-MVP optimization if needed

## Work Log

| Date       | Action  | Notes                                           |
|------------|---------|------------------------------------------------|
| 2025-12-04 | Created | Performance review identified payload size risk |

## Tags

code-review, landing-page, performance, database
