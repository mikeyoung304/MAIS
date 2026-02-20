---
status: pending
priority: p2
issue_id: '11025'
tags: [code-review, customer-agent, chatbot, adk, cloud-run, ops]
dependencies: ['11022', '11023']
---

# 11025: ADK Uses In-Memory Session Storage — Sessions Lost on Cloud Run Cold Starts

## Problem Statement

The deployed customer agent uses ADK's default in-memory session storage. Cloud Run
scales to 0 after the idle timeout (15 minutes on starter plan). When it restarts:

- All ADK sessions vanish from memory
- The Render API server still has the session UUIDs in its database
- Every returning user hits 404 on their first message until the retry creates new sessions

Even with P1-01 and P1-02 fixed, cold starts will cause a one-message 404 + retry
cycle for every active user. Conversation history accumulated before the cold start
is lost.

## Findings

**File:** `server/src/agent-v2/deploy/customer/src/agent.ts`

The `LlmAgent` is constructed without a custom `sessionService`. ADK's default is
in-memory (`InMemorySessionService`). Cloud Run instances are ephemeral.

## Proposed Solutions

### Option A — Configure Cloud Firestore Session Storage (Recommended)

ADK supports `VertexAiSessionService` or a custom `BaseSessionService` backed by
Cloud Firestore.

```typescript
import { VertexAiSessionService } from '@google/adk';
// or custom FirestoreSessionService

export const customerAgent = new LlmAgent({
  name: 'customer',
  sessionService: new VertexAiSessionService({
    project: process.env.GOOGLE_CLOUD_PROJECT,
    location: process.env.GOOGLE_CLOUD_LOCATION ?? 'us-central1',
  }),
  // ...
});
```

**Pros:** Sessions persist across cold starts. Fully managed by Google.
**Cons:** Requires Firestore/Vertex AI setup + permissions.
**Effort:** Medium
**Risk:** Low — well-supported ADK pattern

### Option B — Set Cloud Run min-instances to 1

Prevent cold starts by keeping at least one Cloud Run instance warm.

**Pros:** No code change. Immediate fix.
**Cons:** Costs money (~$5-10/month for a warm instance). Doesn't solve the fundamental issue.
**Effort:** Trivial
**Risk:** Low

### Option C — Accept the limitation, improve UX

Display a "reconnecting..." message when the session is recycled after a cold start.

**Pros:** Honest UX.
**Cons:** Doesn't fix the lost history problem.

## Recommended Action

Option B short-term (unblock users immediately). Option A medium-term (permanent fix).

## Technical Details

- **ADK docs:** Session management: `@google/adk` `BaseSessionService`
- **File to change:** `server/src/agent-v2/deploy/customer/src/agent.ts`
- **Firestore costs:** Minimal for a low-traffic booking chatbot

## Acceptance Criteria

- [ ] ADK sessions survive Cloud Run restarts (either via persistent store or min-instances=1)
- [ ] Conversation history preserved across user sessions of typical length (15+ min gap)

## Work Log

- 2026-02-20: Found during review. Confirmed by ADK architecture (no custom sessionService configured).
