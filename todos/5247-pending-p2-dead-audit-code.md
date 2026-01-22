---
status: pending
priority: p2
issue_id: '5247'
tags: [code-review, simplicity, dead-code]
dependencies: []
---

# P2: Audit Module is 95% Dead Code

## Problem Statement

The `session.audit.ts` file exports 7 audit functions, but only 1 is actually used (`auditSessionCreated`). The 196-line file provides no additional value over direct logger calls.

**Why it matters:**

- 196 lines of code with ~95% dead code
- YAGNI violation - built "just in case"
- No actual audit persistence (just wraps logger)

## Findings

**File:** `server/src/services/session/session.audit.ts` (196 lines)

**Usage analysis:**

```
auditSessionCreated  → Used once in vertex-agent.service.ts:189
auditMessageAppended → Used once but imports could use logger directly
auditSessionAccessed → Never used
auditSessionRestored → Never used
auditSessionDeleted  → Never used
auditConcurrentModification → Never used
auditAccessDenied    → Never used
```

**The audit functions are thin wrappers:**

```typescript
case SessionAuditAction.CREATED:
  logger.info(logData, `Session audit: ${entry.action}`);
  break;
// This is equivalent to calling logger.info() directly
```

## Proposed Solutions

### Option A: Delete audit module entirely (Recommended)

**Pros:** Removes 196 lines of dead code
**Cons:** Lose "infrastructure" if someone wants it later
**Effort:** Small
**Risk:** Low - code is not used

### Option B: Remove unused functions, keep used ones

**Pros:** Keeps audit pattern for future use
**Cons:** Still maintains unnecessary abstraction
**Effort:** Small
**Risk:** Low

### Option C: Keep as-is

**Pros:** No code changes
**Cons:** Dead code remains
**Effort:** None
**Risk:** Technical debt

## Recommended Action

Option A - Delete the audit module. Replace the one usage with direct logger call.

## Technical Details

**Affected files:**

- Delete: `server/src/services/session/session.audit.ts`
- Update: `server/src/services/vertex-agent.service.ts` (replace audit call with logger)
- Update: `server/src/services/session/index.ts` (remove export)

**Lines saved:** ~196

## Acceptance Criteria

- [ ] Audit module deleted
- [ ] Session creation still logged (via logger.info)
- [ ] No import errors
- [ ] Existing tests pass

## Work Log

| Date       | Action                   | Result  |
| ---------- | ------------------------ | ------- |
| 2026-01-22 | Created from code review | Pending |

## Resources

- [YAGNI Principle](https://martinfowler.com/bliki/Yagni.html)
