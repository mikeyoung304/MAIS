---
status: resolved
priority: p1
issue_id: '629'
tags: [code-review, agent-tools, data-integrity, packages, segments]
dependencies: []
resolved_in: 4607f2f3
---

# upsert_package Agent Tool Creates Orphaned Packages

## Problem Statement

The `upsert_package` agent tool does NOT include `segmentId` in its input schema or executor, causing all packages created via the admin AI agent to have `segmentId = null`. This creates orphaned packages that violate the intended data model structure.

**Why it matters:**

- Packages created by AI agent are disconnected from segments
- Creates ongoing technical debt (the exact issue we just fixed today)
- Inconsistent with `upsert_services` onboarding tool which correctly links packages to segments
- Frontend falls back to flat list display instead of segment grouping

## Findings

### Evidence from Agent Tools Review (CRITICAL)

> "The `upsert_package` tool does NOT enforce or even support segment assignment, creating orphaned packages that violate the segment requirement."

**Location:** `server/src/agent/tools/write-tools.ts` (lines 92-202)

**Tool Input Schema - Missing segmentId:**

```typescript
// No segmentId in inputSchema properties
inputSchema: {
  type: 'object',
  properties: {
    packageName: { type: 'string', description: 'Display name' },
    packagePrice: { type: 'number', description: 'Price in cents' },
    description: { type: 'string', description: 'Description' },
    // ❌ NO segmentId parameter
  },
  required: ['packageName', 'packagePrice'],
},
```

**Executor - Missing segmentId:**

```typescript
// server/src/agent/executors/index.ts (line 123-132)
const created = await prisma.package.create({
  data: {
    tenantId,
    slug: generatedSlug,
    name: packageName,
    description: description || null,
    basePrice: packagePrice,
    // ❌ segmentId NOT SET - package is orphaned
  },
});
```

### Contrast with Correct Pattern

`upsert_services` (onboarding tool) does it correctly:

```typescript
// server/src/agent/tools/onboarding-tools.ts
const segment = await tx.segment.create({ ... });
for (const pkg of packages) {
  await tx.package.create({
    data: {
      tenantId,
      segmentId: segment.id, // ✅ Properly linked
      ...
    },
  });
}
```

## Proposed Solutions

### Option A: Add segmentId Parameter (Recommended)

**Pros:** Direct fix, maintains flexibility, aligns with other tools
**Cons:** Requires updating tool schema and executor
**Effort:** Small
**Risk:** Low

1. Add `segmentId` to input schema (optional parameter)
2. Update executor to use `segmentId` if provided
3. Auto-assign to "General" segment if not provided

```typescript
// Tool schema addition
segmentId: {
  type: 'string',
  description: 'ID of segment to assign package to. If not provided, assigns to default "General" segment.',
},

// Executor update
let resolvedSegmentId = segmentId;
if (!resolvedSegmentId) {
  const general = await prisma.segment.findFirst({
    where: { tenantId, slug: 'general' },
  });
  resolvedSegmentId = general?.id;
}
```

### Option B: Always Auto-Assign to General

**Pros:** No AI prompt changes needed
**Cons:** Less flexible, may not be desired behavior
**Effort:** Small
**Risk:** Low

Executor automatically finds and assigns to "General" segment without parameter.

### Option C: Require segmentId (Strict)

**Pros:** Forces explicit segment assignment
**Cons:** May break existing AI prompts, requires AI to know segment IDs
**Effort:** Small
**Risk:** Medium (breaking change for AI)

## Recommended Action

**Option A** - Add optional `segmentId` with auto-fallback to "General" segment

### Triage Notes (2026-01-05)

**Reviewer Consensus:** All 3 reviewers (DHH, TypeScript, Simplicity) agree on Option A.

**Implementation Guidance:**

- Add `segmentId` as optional parameter to tool input schema
- In executor, resolve segment: `input.segmentId ?? await getDefaultSegmentId(tenantId)`
- Log when auto-fallback is used (visibility over hiding)
- Rely on #631 service-layer validation as safety net

**Key Quote (DHH):** "Make the right thing easy, make the wrong thing visible."

## Technical Details

**Affected Files:**

- `server/src/agent/tools/write-tools.ts` - Add segmentId to inputSchema
- `server/src/agent/executors/index.ts` - Use segmentId in package.create()

**Related Files:**

- `server/src/agent/tools/onboarding-tools.ts` - Reference implementation
- `server/src/services/tenant-onboarding.service.ts` - Default segment setup

## Acceptance Criteria

- [ ] `upsert_package` tool accepts optional `segmentId` parameter
- [ ] If `segmentId` not provided, auto-assigns to "General" segment
- [ ] If "General" segment doesn't exist, creates one
- [ ] Existing tests pass
- [ ] New test validates segment assignment
- [ ] Tool added to `REQUIRED_EXECUTOR_TOOLS` if not already

## Work Log

| Date       | Action                     | Learnings                                     |
| ---------- | -------------------------- | --------------------------------------------- |
| 2026-01-05 | Created from system review | Agent tools inconsistent with onboarding flow |
| 2026-01-05 | Triaged by 3 reviewers     | Unanimous agreement on Option A               |

## Resources

- System Review: Tenant Packages & Segments Architecture
- Pattern: `upsert_services` in onboarding-tools.ts
- Prevention: `docs/solutions/patterns/AGENT_TOOLS_PREVENTION_INDEX.md`
