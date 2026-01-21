---
status: ready
priority: p2
issue_id: '5199'
tags: [code-review, agent-v2, dead-code]
dependencies: []
---

# PublishPreviewParams Schema Defined But Never Used

## Problem Statement

`PublishPreviewParams` Zod schema is defined but never used anywhere in the codebase.

**Why it matters:** Dead code adds confusion and maintenance burden. If it was intended for validation, that validation isn't happening.

## Findings

**Location:** `server/src/agent-v2/deploy/concierge/src/agent.ts` (lines 197-201)

```typescript
const PublishPreviewParams = z.object({
  pageName: z.string().optional(),
  sectionId: z.string().optional(),
  content: z.any().optional(),
});
```

No usages found in any file. Likely a leftover from development.

## Proposed Solutions

### Option A: Delete It (Recommended)

**Pros:** Cleaner code, no confusion
**Cons:** None
**Effort:** Small (5 min)

Simply delete lines 197-201.

### Option B: Wire It Up

**Pros:** Validates publish_changes input
**Cons:** May not be needed if tool schema already validates
**Effort:** Small (15 min)

## Technical Details

**Affected Files:**

- `server/src/agent-v2/deploy/concierge/src/agent.ts`

## Acceptance Criteria

- [ ] No unused schemas in agent files
- [ ] Code review confirms no other dead code

## Work Log

| Date       | Action  | Notes                    |
| ---------- | ------- | ------------------------ |
| 2026-01-19 | Created | From code quality review |
