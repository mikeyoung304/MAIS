---
status: resolved
priority: p2
issue_id: '5250'
tags: [code-review, security, audit]
dependencies: []
triage_batch: 1
triage_decision: RESOLVE - Add logger.warn in repository (1 line fix, no audit module needed)
---

# P2: Missing Audit on Session Lookup Failure (IDOR Detection Gap)

## Problem Statement

When a session lookup returns `null` (either due to wrong `tenantId` or non-existent session), no audit event is logged. This makes it impossible to detect IDOR attack attempts where an attacker enumerates session IDs.

**Why it matters:**

- No detection of enumeration attacks
- No forensic trail for incident response
- Compliance issues (GDPR, SOC2 require access logging)

## Findings

**File:** `server/src/services/session/session.repository.ts:86-88`

```typescript
if (!session) {
  return null; // No audit trail - we don't know if this was a legitimate miss or an attack
}
```

**Attack scenario:**
An attacker with a valid tenant account could systematically try session IDs (CUIDs are predictable in sequence) to detect whether sessions exist for other tenants. While they won't access the data (tenant scoping prevents that), the lack of logging means no detection.

**Note:** The audit module has `auditAccessDenied` function but it's never called.

## Proposed Solutions

### Option A: Add audit logging on session not found (Recommended)

**Pros:** Detects enumeration attacks, compliance
**Cons:** More log volume
**Effort:** Small
**Risk:** Low

```typescript
if (!session) {
  logger.warn({ sessionId, tenantId }, 'Session lookup failed - not found or access denied');
  return null;
}
```

### Option B: Rate limit session lookups by sessionId

**Pros:** Prevents enumeration at source
**Cons:** More complex
**Effort:** Medium
**Risk:** Low

## Recommended Action

Option A - Add warning-level logging when session lookups fail with a provided sessionId.

## Technical Details

**Affected files:**

- `server/src/services/session/session.repository.ts`

## Acceptance Criteria

- [ ] Failed session lookups are logged at warn level
- [ ] Log includes sessionId and tenantId
- [ ] No PII in logs

## Work Log

| Date       | Action                   | Result  |
| ---------- | ------------------------ | ------- |
| 2026-01-22 | Created from code review | Pending |

## Resources

- [OWASP IDOR](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/05-Authorization_Testing/04-Testing_for_Insecure_Direct_Object_References)
