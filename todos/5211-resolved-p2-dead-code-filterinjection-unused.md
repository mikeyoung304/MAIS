---
status: resolved
priority: p2
issue_id: '5211'
tags: [code-review, session-bootstrap, dead-code, simplicity]
dependencies: []
---

# Dead Code - filterInjection Function Never Called

## Problem Statement

The `filterInjection()` function with ~30 regex patterns is defined but NEVER CALLED. The research endpoints return placeholder responses.

**Why it matters:** Dead code increases maintenance burden, confuses readers, and bloats the file.

## Findings

**Location:** `server/src/routes/internal-agent.routes.ts:1494-1614`

**Dead Code:**

- `INJECTION_PATTERNS` array (~30 regex patterns)
- `filterInjection()` function
- Research endpoint routes (return placeholders)

**Current State:**

```typescript
// Function defined but never called
function filterInjection(content: string): string {
  let filtered = content;
  for (const pattern of INJECTION_PATTERNS) {
    filtered = filtered.replace(pattern, '[REDACTED]');
  }
  return filtered;
}

// Endpoints return placeholders
router.post('/research/search-competitors', async (req, res) => {
  res.json({
    results: [],
    message: 'Integration pending...',
  });
});
```

**Reviewer:** Code Simplicity (P2 - YAGNI)

## Proposed Solutions

### Option A: Remove Dead Code (Recommended)

**Pros:** Cleaner codebase, reduced maintenance
**Cons:** Need to re-implement when research integration is real
**Effort:** Small
**Risk:** Low

Delete lines 1494-1614 entirely.

### Option B: Keep with TODO Comment

**Pros:** Ready for future integration
**Cons:** Dead code remains
**Effort:** Small
**Risk:** Low

Add clear TODO comment with issue link.

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected Files:**

- `server/src/routes/internal-agent.routes.ts`

**Lines to Remove:**

- INJECTION_PATTERNS (~30 lines)
- filterInjection() (~10 lines)
- /research/search-competitors endpoint (~20 lines)
- /research/scrape-competitor endpoint (~20 lines)

## Acceptance Criteria

- [ ] Dead filterInjection() function removed
- [ ] Research placeholder endpoints removed or properly documented
- [ ] ~80 lines of dead code eliminated

## Work Log

| Date       | Action                         | Learnings                                     |
| ---------- | ------------------------------ | --------------------------------------------- |
| 2026-01-20 | Created from /workflows:review | Code Simplicity reviewer identified dead code |

## Resources

- PR: feature/session-bootstrap-onboarding
- Review: Code Simplicity (DHH style)
