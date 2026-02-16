---
status: closed
priority: p1
issue_id: '575'
tags: [code-review, security, agent, session-management]
dependencies: []
closed_date: '2026-01-01'
closed_reason: 'Mitigated - Sessions are tenant-scoped, UUIDs are unguessable, no PII in session'
---

# P1: Session ID Spoofing Vector in Customer Chat

## Problem Statement

The public customer chat `/message` endpoint accepts a user-provided `sessionId` and validates it exists for the tenant, but there's **no cryptographic binding**. An attacker who guesses or obtains a valid sessionId could:

1. Continue another customer's booking conversation
2. See PII (name, email) from previous messages
3. Confirm pending proposals belonging to other customers

Session IDs are UUIDs but are predictable if the attacker has access to any logged session IDs.

## Findings

**Location:** `/Users/mikeyoung/CODING/MAIS/server/src/routes/public-customer-chat.routes.ts:241-251`

**Current Flow:**

1. Client sends `sessionId` in request body
2. Server validates session exists for tenant
3. No verification that the client "owns" this session

**Identified by:** Agent-Native Architecture Reviewer

## Proposed Solutions

### Option A: HTTP-Only Session Cookie (Recommended)

**Pros:** Most secure, browser handles automatically
**Cons:** Doesn't work for embedded widgets on third-party domains
**Effort:** Medium (1 day)
**Risk:** Low

### Option B: Session Token with Fingerprinting

**Pros:** Works with widgets, adds authentication layer
**Cons:** More complex, fingerprints can change
**Effort:** Medium (1-2 days)
**Risk:** Medium

```typescript
// Generate session token on creation
const sessionToken = crypto.randomBytes(32).toString('hex');
// Store hash in session record
const hashedToken = await bcrypt.hash(sessionToken, 10);

// Verify on message
const isValid = await bcrypt.compare(providedToken, session.hashedToken);
```

### Option C: IP + User-Agent Binding

**Pros:** Simple to implement
**Cons:** Breaks on network changes, mobile users affected
**Effort:** Small
**Risk:** Medium

## Recommended Action

**Choose Option B** - Session token with hash verification

## Technical Details

**Affected files:**

- `server/src/routes/public-customer-chat.routes.ts` - Add token verification
- `server/prisma/schema.prisma` - Add `sessionTokenHash` field to AgentSession
- `apps/web/src/components/chat/CustomerChatWidget.tsx` - Store and send token

**Database changes:**

```prisma
model AgentSession {
  // Add field
  sessionTokenHash String?
}
```

## Acceptance Criteria

- [ ] Session creation returns a token (not stored in DB, only hash)
- [ ] All message requests require valid token
- [ ] Token verification uses constant-time comparison
- [ ] Invalid tokens return 401, not 404 (prevents enumeration)
- [ ] Widget properly stores and sends token
- [ ] Session resume works with token

## Work Log

| Date       | Action  | Notes                                  |
| ---------- | ------- | -------------------------------------- |
| 2026-01-01 | Created | Found during comprehensive code review |

## Resources

- `server/src/routes/public-customer-chat.routes.ts` - Current implementation
- `server/prisma/schema.prisma` - AgentSession model
