---
status: complete
priority: p2
issue_id: "137"
tags: [code-review, visual-editor, logging, standards]
dependencies: []
---

# Console.error Used Instead of Logger in Visual Editor

## Problem Statement

The visual editor components use `console.error()` for error logging instead of the centralized logger. This violates the project's logging standards defined in CLAUDE.md.

**Why it matters**: Console logs aren't captured by production monitoring, make debugging harder, and create inconsistency with the rest of the codebase.

## Findings

### Discovery Source
Code Quality Review Agent - Code Review

### Evidence

**PhotoDropZone.tsx lines 82 and 173:**
```typescript
console.error("Failed to upload photo:", err);
console.error("Failed to delete photo:", err);
```

**useVisualEditor.ts line 187:**
```typescript
console.error("Failed to save draft:", err);
```

**CLAUDE.md rule:**
> **Logging**: Use `logger`, never `console.log`

## Proposed Solutions

### Option 1: Use Existing Logger (Recommended)
Import and use the centralized logger from lib/logger.

```typescript
import { logger } from '@/lib/logger';

// Instead of console.error
logger.error('Failed to upload photo', {
  packageId,
  error: err instanceof Error ? err.message : String(err)
});
```

**Pros**: Consistent with codebase, captured in monitoring
**Cons**: Need to verify logger is available in frontend
**Effort**: Small
**Risk**: Low

### Option 2: Create Client-Side Error Reporter
Create a dedicated error reporting utility for client-side errors.

```typescript
// In lib/errorReporter.ts
export function reportError(context: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  // Log to console in development
  if (import.meta.env.DEV) {
    console.error(`[${context}]`, message);
  }

  // Send to monitoring in production
  if (import.meta.env.PROD) {
    // Sentry or similar
    captureException(error, { extra: { context } });
  }
}
```

**Pros**: Proper dev/prod distinction, integrates with monitoring
**Cons**: New utility to create
**Effort**: Medium
**Risk**: Low

### Option 3: Leave with ESLint Disable Comments
Disable the linting rule for these specific locations.

```typescript
// eslint-disable-next-line no-console
console.error("Failed to upload photo:", err);
```

**Pros**: Quick fix
**Cons**: Doesn't actually fix the problem
**Effort**: Small
**Risk**: High (bad practice)

## Recommended Action
<!-- Filled during triage -->

## Technical Details

### Affected Files
- `client/src/features/tenant-admin/visual-editor/components/PhotoDropZone.tsx`
- `client/src/features/tenant-admin/visual-editor/hooks/useVisualEditor.ts`

### Affected Components
- Photo upload error handling
- Draft save error handling

### Database Changes Required
None

## Acceptance Criteria
- [ ] No `console.error` calls in visual editor code
- [ ] Errors logged through proper logging mechanism
- [ ] Error messages include relevant context (packageId, tenantId)
- [ ] Logs captured in production monitoring (if configured)
- [ ] ESLint no-console rule passes

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-12-01 | Created | Identified during visual editor code review |

## Resources
- PR: feat(visual-editor) commit 0327dee
- CLAUDE.md logging standards
