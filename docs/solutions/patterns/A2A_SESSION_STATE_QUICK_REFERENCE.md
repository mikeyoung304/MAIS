---
title: A2A Session & State Quick Reference Card
category: patterns
component: agent-v2
tags: [google-adk, a2a, sessions, state, quick-reference]
created: 2026-01-19
---

# A2A Session & State Quick Reference Card

**Print this page and pin it near your monitor.**

---

## Session Management

### The Rule: Each Agent = Own Session

```
Backend → Concierge (session: abc)
         ├─→ Marketing (session: xyz)    ← DIFFERENT session!
         ├─→ Storefront (session: 123)   ← DIFFERENT session!
         └─→ Research (session: 789)     ← DIFFERENT session!
```

### Create Specialist Session

```typescript
POST {agentUrl}/apps/{agentName}/users/{tenantId}/sessions
Content-Type: application/json

{ "state": { "tenantId": "..." } }

Response: { "id": "session-uuid" }
```

### Session Cache Key

```typescript
const cacheKey = `${agentUrl}:${tenantId}`; // BOTH parts required!
```

### Handle 404 "Session not found"

```typescript
if (response.status === 404 && errorText.includes('Session not found')) {
  specialistSessions.delete(cacheKey); // Clear cache
  const newSession = await createSession(); // Create fresh
  return retry(newSession); // Retry once
}
```

---

## State Access

### The Rule: Use .get(), Not Direct Access

```typescript
// CORRECT
const tenantId = context.state?.get<string>('tenantId');

// WRONG - Returns undefined!
const tenantId = context.state.tenantId;
const tenantId = context.state['tenantId'];
```

### With Defaults

```typescript
const tier = context.state?.get<string>('subscriptionTier') ?? 'free';
const count = context.state?.get<number>('messageCount') ?? 0;
```

### Fallback: Extract from userId

```typescript
// Backend sends userId as "tenantId:userId"
const userId = context.invocationContext?.session?.userId;
if (userId?.includes(':')) {
  const [tenantId] = userId.split(':');
}
```

---

## Zod Schema Types

### Decision Tree

```
Fixed choices?      → z.enum(['opt1', 'opt2'])
Free-form text?     → z.string().describe('...')
Dynamic object?     → z.any().describe('Structure: {...}')
Number?             → z.number().min(0).max(100)
Boolean?            → z.boolean().default(false)
```

### FORBIDDEN Types (ADK Unsupported)

```typescript
// These will break deployment:
z.record(); // Use z.any() instead
z.tuple(); // Use z.array().length(N) instead
z.intersection(); // Flatten to single z.object()
z.lazy(); // Not supported
```

### Always Add .describe()

```typescript
// LLM needs guidance!
task: z.enum(['headline', 'tagline']).describe('Type of content to generate'),
feedback: z.string().optional().describe('User feedback for refinement'),
```

---

## Environment Variables

### Pattern

```typescript
const URL = process.env.AGENT_URL || 'https://fallback.run.app';
```

### Required Vars (Concierge)

```bash
MAIS_API_URL          # Backend API URL
INTERNAL_API_SECRET   # Agent-to-backend auth
MARKETING_AGENT_URL   # Specialist URL
STOREFRONT_AGENT_URL  # Specialist URL
RESEARCH_AGENT_URL    # Specialist URL
```

### Discover URLs

```bash
gcloud run services describe marketing-agent \
  --region us-central1 \
  --format 'value(status.url)'
```

### Validate at Startup

```typescript
const required = ['MAIS_API_URL', 'INTERNAL_API_SECRET'];
const missing = required.filter((v) => !process.env[v]);
if (missing.length) throw new Error(`Missing: ${missing}`);
```

---

## Common Errors & Fixes

| Error                          | Cause                  | Fix                                             |
| ------------------------------ | ---------------------- | ----------------------------------------------- |
| "Session not found: undefined" | snake_case params      | Use camelCase: `appName`, `userId`, `sessionId` |
| "Session not found: {id}"      | Wrong session          | Create session per specialist, don't reuse      |
| "Unsupported Zod type"         | z.record() etc         | Use z.any().describe()                          |
| state.get() returns undefined  | Wrong key or never set | Check state was set in session creation         |
| Connection refused             | Missing URL            | Check env var, validate at startup              |

---

## Pre-Deploy Checklist

```
[ ] Each specialist has own session creation
[ ] Session cache key: ${agentUrl}:${tenantId}
[ ] 404 triggers cache clear + retry
[ ] All state access uses .get<T>('key')
[ ] Defaults for optional values (?? 'default')
[ ] No z.record/tuple/intersection/lazy
[ ] All params have .describe()
[ ] URLs from env vars, not hardcoded
[ ] Required vars validated at startup
```

---

## Code Review Quick Check

```
[ ] No context.state.key (use .get())
[ ] No orchestrator session passed to specialist
[ ] No z.record() in tool schemas
[ ] All env vars, no hardcoded URLs
[ ] Defaults for new state fields
```

---

**Full details:** See `A2A_SESSION_STATE_PREVENTION.md`
