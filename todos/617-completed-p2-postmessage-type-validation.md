---
status: completed
priority: p2
issue_id: '617'
tags: [code-review, security, build-mode]
dependencies: []
completed_date: '2026-01-05'
---

# PostMessage Type Casting Without Zod Validation

## Problem Statement

The BuildModePreview component casts `event.data` directly to `BuildModeChildMessage` without Zod validation, despite having validation helpers available in protocol.ts.

**What's broken:** Raw type assertion bypasses validation
**Why it matters:** Malformed messages could cause runtime errors or unexpected behavior

## Findings

### Source: Security Review Agent + Architecture Review Agent

**File:** `apps/web/src/components/build-mode/BuildModePreview.tsx` (line 53)

**Current Code:**

```typescript
const message = event.data as BuildModeChildMessage;

switch (message.type) {
  case 'BUILD_MODE_READY':
  // ...
```

**Risk:** While origin is validated, a compromised or buggy iframe could send malformed data that matches the discriminated union but contains unexpected properties.

**Evidence:** The `parseChildMessage()` function exists in protocol.ts but is not used in BuildModePreview.tsx.

## Proposed Solutions

### Option A: Use existing parseChildMessage helper (Recommended)

**Description:** Import and use the existing Zod validation helper

```typescript
import { parseChildMessage } from '@/lib/build-mode/protocol';

const message = parseChildMessage(event.data);
if (!message) return;

switch (message.type) {
  case 'BUILD_MODE_READY':
  // ...
```

- **Pros:** Uses existing code, adds validation
- **Cons:** Minor performance overhead from Zod parse
- **Effort:** Small (10 minutes)
- **Risk:** Low

### Option B: Validate only in development

**Description:** Wrap validation in `process.env.NODE_ENV === 'development'` check

- **Pros:** No production overhead
- **Cons:** Production still vulnerable, inconsistent behavior
- **Effort:** Small
- **Risk:** Medium (dev/prod divergence)

## Recommended Action

Option A - Use existing parseChildMessage helper

## Technical Details

**Affected Files:**

- `apps/web/src/components/build-mode/BuildModePreview.tsx`

**Related Files:**

- `apps/web/src/lib/build-mode/protocol.ts` (has the helper)

## Acceptance Criteria

- [x] `parseChildMessage()` is imported from protocol.ts
- [x] Event data is validated before processing
- [x] Invalid messages are silently ignored (logged in dev)
- [x] Existing tests still pass

## Work Log

| Date       | Action                        | Learnings                                                                           |
| ---------- | ----------------------------- | ----------------------------------------------------------------------------------- |
| 2026-01-05 | Created from code review      | Prevention strategy: Always use Zod validation for PostMessage                      |
| 2026-01-05 | RESOLVED - Parallel agent fix | Replaced `event.data as BuildModeChildMessage` with `parseChildMessage(event.data)` |

## Resources

- PR: N/A (current branch)
- Related: `docs/solutions/patterns/build-mode-storefront-editor-patterns-MAIS-20260105.md`
