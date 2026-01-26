---
title: Project Hub Chat Cloud Run Integration - Dual Bug Resolution
slug: project-hub-chat-cloud-run-integration-failures
category: integration-issues
severity: P1-critical
component:
  - public-project.routes.ts
  - project-hub-agent.service.ts
symptoms:
  - 403 Forbidden on chat message send (Cloud Run "not authenticated")
  - "Session expired. Please refresh." error after authentication fix
  - Old log prefixes appearing despite new code deployed
  - session_not_found from ADK despite session ID existing in UI
root_cause: Two cascading bugs - 1) Routes used raw fetch without auth headers, 2) Session endpoint created fake IDs not real ADK sessions
solution_type: code-wiring
date_solved: 2026-01-25
time_to_solve: ~90 minutes
recurrence_risk: low
prevention_tags:
  - cloud-run-auth
  - adk-session-management
  - old-code-detection
  - wiring-verification
related_files:
  - server/src/routes/public-project.routes.ts
  - server/src/services/project-hub-agent.service.ts
commits:
  - c8b7b38c # fix: wire up ProjectHubAgentService for Cloud Run authentication
  - 94a43ead # fix: create real ADK session in /chat/session endpoint
---

# Project Hub Chat Cloud Run Integration - Dual Bug Resolution

## Problem Summary

After deploying the Project Hub chat feature, customers could not send messages. The chat widget showed either "403 Forbidden" or "Session expired. Please refresh." depending on the debugging stage. Two cascading bugs prevented chat from working.

## Bug #1: 403 Forbidden (Cloud Run Authentication Missing)

### Symptom

Chat message sending returned 403 Forbidden with Cloud Run logs showing:

```
"The request was not authenticated. Either allow unauthenticated invocations
or set the proper Authorization header."
```

### Investigation

1. **Checked Cloud Run IAM** - Service account had `roles/run.invoker` permission
2. **Noticed log prefix mismatch**:
   - Cloud Run logs showed: `"Project Hub agent error"`
   - New service code used: `'[ProjectHubAgent] Agent error'`
3. **Realized**: OLD code was running - the new service file wasn't wired up

### Root Cause

A NEW file `project-hub-agent.service.ts` was created with proper Cloud Run authentication (Identity Token via Google Auth), but `public-project.routes.ts` line 621 still used raw `fetch()`:

```typescript
// OLD CODE (broken) - no auth headers
const response = await fetch(`${agentUrl}/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message, sessionId }),
});
```

The service was created but never imported or used - a classic wiring gap.

### Fix (commit c8b7b38c)

Updated routes to use the authenticated service:

```typescript
// NEW CODE (fixed) - uses Identity Token auth
const agentService = createProjectHubAgentService();
const agentResult = await agentService.sendMessage(
  activeSessionId,
  tenantId,
  customerId,
  message,
  requestId
);
```

---

## Bug #2: Session Not Found (Fake Session IDs)

### Symptom

After fixing authentication, chat showed "Session expired. Please refresh." with `session_not_found` error in logs. Now logs showed `[ProjectHubChat]` prefix (new code running), but ADK rejected the session.

### Investigation

1. **Verified new code running** - Log prefix `[ProjectHubChat]` matched service code
2. **Checked session ID format** - `project-abc123-1706192400000` looked suspicious
3. **Found the problem in `/chat/session` endpoint**:

```typescript
// OLD CODE (broken) - creates fake local ID
const sessionId = `project-${projectId}-${Date.now()}`;
res.json({ sessionId, greeting: '...', ... });
```

This endpoint never called ADK to create a real session. When `/chat/message` tried to use this ID with ADK, ADK returned "session not found" because it never existed in ADK's session store.

### Root Cause

The session endpoint was a stub that generated a local ID instead of calling the ADK `/apps/{appName}/users/{userId}/sessions` endpoint to create a real session.

### Fix (commit 94a43ead)

Updated `/chat/session` to create real ADK sessions:

```typescript
// NEW CODE (fixed) - creates real ADK session
const agentService = createProjectHubAgentService();
let sessionId: string;

try {
  sessionId = await agentService.createSession(tenantId, customerId, projectId, contextType);
  logger.info({ projectId, sessionId, contextType }, '[ProjectHubChat] ADK session created');
} catch (sessionError) {
  logger.error({ projectId, error: sessionError }, '[ProjectHubChat] Failed to create ADK session');
  res.status(503).json({
    error: 'Chat service temporarily unavailable',
    errorType: 'agent_unavailable',
  });
  return;
}

res.json({
  sessionId, // Now a real ADK session ID
  projectId,
  customerId,
  greeting: `Hi ${customerName}! I'm here to help...`,
  businessName,
});
```

---

## Detection Pattern: Old Code Still Running

A key debugging insight was recognizing that old code was running despite believing new code was deployed.

**Detection Method:**

1. Add unique log prefixes to new code: `[ProjectHubChat]` or `[ProjectHubAgent]`
2. Check production logs for the exact string
3. If you see OLD strings (e.g., `"Project Hub agent error"` without brackets), old code is running

**Common Causes:**

1. New file created but never imported/used
2. Import exists but function never called
3. Deployment didn't pick up changes (cache issue)
4. Wrong environment variable pointing to old endpoint

---

## Architecture Understanding

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│  public-project.     │────▶│   Cloud Run     │
│   Chat Widget   │     │  routes.ts           │     │   ADK Agent     │
└─────────────────┘     └──────────────────────┘     └─────────────────┘
                              │      ▲
                              ▼      │
                        ┌─────────────────────────┐
                        │ ProjectHubAgentService  │
                        │ - getIdentityToken()    │
                        │ - createSession()       │
                        │ - sendMessage()         │
                        └─────────────────────────┘
```

**Key Points:**

1. Routes MUST use `ProjectHubAgentService`, not raw `fetch()`
2. Service handles Identity Token auth for Cloud Run
3. Sessions MUST be created via ADK, not faked locally
4. Session state (contextType, tenantId) is set at creation time

---

## Prevention Strategies

### 1. New Service File Checklist

When creating a new service file (e.g., `*-agent.service.ts`):

- [ ] Create the service class
- [ ] Create factory function (`createXxxService()`)
- [ ] **Import and USE in the consuming routes file**
- [ ] Verify imports are at top of routes file
- [ ] Test that new log prefixes appear in production logs

### 2. ADK Session Verification

When creating ADK session endpoints:

- [ ] Call ADK `/apps/{appName}/users/{userId}/sessions` endpoint
- [ ] Parse and validate response with Zod schema
- [ ] Return real session ID from ADK, not a generated local ID
- [ ] Handle session creation failures gracefully

### 3. Log Prefix Detection

Add unique, searchable prefixes to all new code:

```typescript
// GOOD - easily searchable, version-identifiable
logger.info({ data }, '[ProjectHubChat] Session created');

// BAD - generic, hard to distinguish from old code
logger.info({ data }, 'Session created');
```

### 4. Cloud Run Auth Verification

When calling Cloud Run services:

- [ ] Use `google-auth-library` for Identity Tokens
- [ ] JWT fallback for service account credentials
- [ ] gcloud CLI fallback for local development
- [ ] Log auth method used (helps debug in production)

---

## Related Documentation

- `/docs/solutions/authentication-issues/project-hub-token-validation-customerid-mismatch.md` - Token auth fix (prerequisite)
- `/docs/solutions/integration-issues/agent-deployment-ci-cd-gap.md` - Agent deployment architecture
- `/docs/solutions/patterns/ADK_A2A_PREVENTION_INDEX.md` - ADK patterns
- `CLAUDE.md` Pitfall #54-55 - Dual deployment architecture

## Cross-References

- **Pitfall #54**: Backend deploys to Render, Agents to Cloud Run separately
- **Pitfall #37**: LLM prompt patterns - similar "old vs new code" detection issue
- **Pitfall #45**: Empty secret fallback - use `requireEnv()` for fail-fast

---

## Verification Steps

After applying fixes:

1. **Session creation test:**
   - Click chat icon in Project Hub
   - Check logs for `[ProjectHubChat] ADK session created`
   - Verify session ID format matches ADK format (not `project-xxx-timestamp`)

2. **Message sending test:**
   - Send a message in chat
   - Check logs for `[ProjectHubAgent] Response received`
   - Verify response appears in chat widget

3. **Auth verification:**
   - Check logs for `[ProjectHubAgent] Got identity token via JWT` (production)
   - Or `[ProjectHubAgent] Using gcloud CLI identity token (local dev)`

---

## Lessons Learned

1. **Creating a file is not enough** - Must wire it into consuming code
2. **Log prefixes reveal code version** - If prefix doesn't match, old code is running
3. **Stub endpoints must be replaced** - Fake local IDs break when real service is called
4. **Two-phase debugging** - Fixing one bug often reveals the next bug in the chain
5. **Check all three pieces**: service file exists, import exists, function is actually called

---

_Documented: 2026-01-25 | Resolution Time: ~90 minutes total | Recurrence Risk: Low_
