---
title: Project Hub Chat ADK Session & Auth Integration
slug: project-hub-chat-adk-session-and-auth-integration
category: integration-issues
severity: P1-critical
component:
  - server/src/routes/public-project.routes.ts
  - server/src/services/project-hub-agent.service.ts
symptoms:
  - 403 Forbidden on chat message send
  - Cloud Run logs show "The request was not authenticated"
  - "Session expired. Please refresh." error in UI
  - session_not_found from ADK
  - Log prefix mismatch (expected vs actual)
root_cause: Two cascading service wiring bugs - routes used old fetch code instead of new authenticated service, and session endpoint created fake local IDs instead of real ADK sessions
solution_type: service-wiring
date_solved: 2026-01-25
time_to_solve: 90 minutes
recurrence_risk: medium
prevention_tags:
  - cloud-run-auth
  - adk-session-management
  - service-wiring
  - log-prefix-debugging
related_files:
  - server/src/routes/public-project.routes.ts
  - server/src/services/project-hub-agent.service.ts
  - server/src/middleware/rateLimiter.ts
commits:
  - c8b7b38c (Fix #1: Use ProjectHubAgentService)
  - 94a43ead (Fix #2: Create real ADK sessions)
related_docs:
  - docs/solutions/patterns/ADK_A2A_PREVENTION_INDEX.md
  - docs/solutions/patterns/A2A_SESSION_STATE_PREVENTION.md
  - docs/solutions/JWT_ID_TOKEN_FOR_CLOUD_RUN_AUTH.md
  - docs/solutions/authentication-issues/project-hub-token-validation-customerid-mismatch.md
---

# Project Hub Chat ADK Session & Auth Integration

Two cascading service wiring bugs that caused Project Hub Chat to fail with 403 errors and session_not_found errors.

## Problem Statement

After implementing Project Hub Chat, customers saw:

1. **First symptom**: 403 Forbidden when sending chat messages
2. **After partial fix**: "Session expired. Please refresh." error

## Investigation Steps

### Phase 1: 403 Forbidden Analysis

**Initial Clues:**

- Cloud Run IAM verified: service account had `roles/run.invoker` ✅
- Cloud Run logs: `"The request was not authenticated"` - no identity token sent

**Key Debugging Breakthrough #1 - Log Prefix Mismatch:**

```
# Expected log prefix (from new service):
'[ProjectHubAgent] Agent error'

# Actual log in Render:
"Project Hub agent error"
```

This mismatch proved **OLD CODE was running**, not the new `ProjectHubAgentService`.

**Root Cause Discovery:**

- Commit `c5a19668` added a NEW file `project-hub-agent.service.ts` with proper Cloud Run auth
- BUT the routes file at line 621 still used raw `fetch()`:

```typescript
// OLD CODE (no auth!) - public-project.routes.ts:621
const response = await fetch(`${agentUrl}/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message, sessionId }),
});
```

The new service was created but **never wired to the routes**.

### Phase 2: Session Not Found Analysis

After Fix #1 (using the authenticated service), a new error appeared:

```json
{ "error": "session_not_found", "msg": "[ProjectHubChat] Agent returned error" }
```

Note: Log prefix `[ProjectHubChat]` confirmed NEW code was now running.

**Key Debugging Breakthrough #2 - Fake Session IDs:**

The `/chat/session` endpoint was creating fake local IDs:

```typescript
// OLD CODE - public-project.routes.ts:521
const sessionId = `project-${projectId}-${Date.now()}`;
// Never actually called ADK to create a real session!
```

When `/chat/message` tried to use this fake ID with ADK, the ADK rightfully returned "session not found" because the session was never registered.

## Solution

### Fix #1: Use Authenticated Service (commit c8b7b38c)

Updated `/chat/message` endpoint to use `ProjectHubAgentService`:

```typescript
// NEW CODE
const agentService = createProjectHubAgentService();
const agentResult = await agentService.sendMessage(
  activeSessionId,
  tenantId,
  customerId,
  message,
  requestId
);
```

The service handles Cloud Run authentication with identity tokens:

```typescript
// project-hub-agent.service.ts
private async getIdentityToken(): Promise<string | null> {
  const jwtClient = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\\n/g, '\n'),
  });
  return jwtClient.fetchIdToken(this.agentUrl);
}
```

### Fix #2: Create Real ADK Sessions (commit 94a43ead)

Updated `/chat/session` to call the ADK:

```typescript
// NEW CODE
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
```

## Why These Bugs Were Hard to Find

1. **Service existed but was orphaned**: The new `ProjectHubAgentService` was created and worked correctly in isolation, but was never imported/used in routes
2. **Log prefix mismatch was subtle**: Required comparing expected prefix `[ProjectHubAgent]` with actual `"Project Hub agent error"` to realize old code was running
3. **Cascading bugs masked each other**: Fix #1 revealed Fix #2 - couldn't see the session bug until auth was working
4. **Fake sessions looked valid**: The session ID format `project-xxx-timestamp` looked plausible in the UI

## Prevention Strategies

### 1. Service Wiring Verification

When creating a new service file, immediately verify it's wired:

```bash
# After creating MyService.ts, verify it's imported AND called
grep -rn "import.*MyService\|createMyService" server/src/routes/

# Should show at least one route file importing AND calling it
```

### 2. Log Prefix Standardization

Always use consistent `[ServiceName]` prefixes and verify during debugging:

```typescript
// Service file
logger.info({ ... }, '[ProjectHubAgent] Processing request');

// When debugging, search for YOUR prefix
grep "ProjectHubAgent" logs.txt  # Should match your code
```

### 3. Session ID Format Validation

Real ADK sessions have a specific format. Add development-mode validation:

```typescript
// In dev mode, validate session IDs don't look fake
if (process.env.NODE_ENV === 'development') {
  if (sessionId.includes('Date.now') || /^\w+-\w+-\d{13}$/.test(sessionId)) {
    logger.warn('Session ID looks fake - was ADK actually called?');
  }
}
```

### 4. Integration Tests That Catch Both Issues

```typescript
it('chat flow works end-to-end', async () => {
  // 1. Create session - catches fake session issue
  const sessionRes = await request(app)
    .post('/api/public/project/xxx/chat/session')
    .set('Authorization', `Bearer ${token}`);

  expect(sessionRes.status).toBe(200);
  expect(sessionRes.body.sessionId).toBeDefined();

  // 2. Send message - catches auth issue
  const messageRes = await request(app)
    .post('/api/public/project/xxx/chat/message')
    .set('Authorization', `Bearer ${token}`)
    .send({ message: 'Hello', sessionId: sessionRes.body.sessionId });

  expect(messageRes.status).toBe(200);
  expect(messageRes.body.response).toBeDefined();

  // 3. Send SECOND message - catches fake session persistence
  const message2Res = await request(app)
    .post('/api/public/project/xxx/chat/message')
    .set('Authorization', `Bearer ${token}`)
    .send({ message: 'Follow up', sessionId: sessionRes.body.sessionId });

  expect(message2Res.status).toBe(200); // Fake sessions fail here!
});
```

### 5. Code Review Checklist

When reviewing PRs that add new services:

- [ ] Service is imported in at least one route file
- [ ] Service factory function is called (not just imported)
- [ ] Service methods are actually invoked (not just stubbed)
- [ ] No inline `fetch()` that duplicates service functionality
- [ ] Log prefixes match between service and routes

When reviewing PRs with session management:

- [ ] Session IDs come from `service.createSession()`, not string construction
- [ ] No `Date.now()` or `Math.random()` in session ID generation
- [ ] Session creation is awaited
- [ ] Error handling exists for session creation failure
- [ ] Test sends 2+ messages to verify session persistence

## Related Pitfalls

- **Pitfall #84**: New service file not wired to routes (orphan service pattern)
- **Pitfall #85**: Stub session endpoints with fake IDs (fake session pattern)
- **Pitfall #36**: Identity token auth patterns for Cloud Run
- **Pitfall #40**: Session ID reuse across agents

## Key Takeaways

1. **Creating a file is not enough** - must verify import, instantiation, AND invocation
2. **Log prefix mismatches reveal old code paths** - always compare expected vs actual
3. **Cascading bugs require iterative debugging** - fix one layer, then check the next
4. **Fake sessions pass single-message tests** - always test multi-message flows
5. **Service-to-service auth is invisible** - Cloud Run "not authenticated" means no token, not wrong token
