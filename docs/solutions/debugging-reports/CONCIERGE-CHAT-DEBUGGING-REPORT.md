# Concierge Chat Debugging Report

**Date:** 2026-01-18
**Session:** Phase 4 Vertex AI Agent System - Gate 4 Testing
**Status:** ✅ RESOLVED - All issues fixed, chat working end-to-end
**Reported by:** Claude Opus 4.5

---

## Executive Summary

The ConciergeChat component renders correctly on the tenant dashboard, but when sending a message like "Write me better headlines", the response is always:

> "Sorry, I ran into an issue. Try again?"

All HTTP requests return 200 status, indicating the error is occurring inside the `VertexAgentService` when communicating with the Concierge agent deployed on Google Cloud Run.

---

## What's Working ✅

| Component                  | Status      | Evidence                                                     |
| -------------------------- | ----------- | ------------------------------------------------------------ |
| ConciergeChat component    | ✅ Renders  | Browser shows "Ask me anything..." input                     |
| Next.js API proxy          | ✅ Working  | Network shows 200 for `/api/tenant-admin/agent/*`            |
| Express routes             | ✅ Mounted  | Startup logs show `✅ Tenant admin Concierge routes mounted` |
| Tenant auth middleware     | ✅ Working  | Session creates successfully (200 OK)                        |
| gcloud CLI auth            | ✅ Working  | `gcloud auth print-identity-token` returns valid JWT         |
| Concierge agent deployment | ✅ Deployed | `https://concierge-agent-506923455711.us-central1.run.app`   |

---

## What's Not Working ❌

| Symptom                           | Location                          | Notes                                             |
| --------------------------------- | --------------------------------- | ------------------------------------------------- |
| Chat returns error message        | `vertex-agent.service.ts:234-238` | Catches error, returns graceful message           |
| No server logs for chat requests  | `tenant-admin-agent.routes.ts`    | `[AgentChat] Message received` never logs         |
| Session creation may use fallback | `vertex-agent.service.ts:121`     | Falls back to `local:` session if ADK unreachable |

---

## Request Flow Analysis

```
Browser (ConciergeChat)
    │
    ▼ POST /api/tenant-admin/agent/chat
Next.js API Route (apps/web/src/app/api/tenant-admin/agent/[...path]/route.ts)
    │  - Gets backend token from session ✅
    │  - Proxies to backend ✅
    ▼ POST /v1/tenant-admin/agent/chat
Express Route (server/src/routes/tenant-admin-agent.routes.ts)
    │  - Tenant auth middleware ✅
    │  - Rate limiter passes ✅
    │  - Route handler executes (NO LOGS SEEN ⚠️)
    ▼ agentService.sendMessage()
VertexAgentService (server/src/services/vertex-agent.service.ts)
    │  - Gets identity token (gcloud fallback) ⚠️ (no logs)
    │  - Sends to Concierge /run endpoint ❓
    │  - Catches error, returns fallback message
    ▼
Cloud Run: Concierge Agent
    │  - UNKNOWN - no visibility into response
    ▼
Response: "Sorry, I ran into an issue. Try again?"
```

---

## Key Files

### 1. Frontend Hook

**File:** `apps/web/src/hooks/useConciergeChat.ts`

- Calls `POST /api/tenant-admin/agent/chat` with `{ message, sessionId }`
- Expects response: `{ response, sessionId, toolCalls, error }`
- Status: ✅ Working correctly

### 2. Next.js Proxy

**File:** `apps/web/src/app/api/tenant-admin/agent/[...path]/route.ts`

- Proxies to `http://localhost:3001/v1/tenant-admin/agent/{path}`
- Adds `Authorization: Bearer {token}` header
- Status: ✅ Working (network shows 200)

### 3. Express Route Handler

**File:** `server/src/routes/tenant-admin-agent.routes.ts`

- POST `/chat` handler at lines 62-104
- Creates session via `agentService.getOrCreateSession()`
- Sends message via `agentService.sendMessage()`
- Status: ⚠️ Executes but no logs visible

### 4. VertexAgentService

**File:** `server/src/services/vertex-agent.service.ts`

- **createSession()** (lines 90-141): Creates session on ADK first, falls back to local
- **sendMessage()** (lines 177-282): Sends to Concierge `/run` endpoint
- **getIdentityToken()** (lines 330-362): GoogleAuth first, gcloud CLI fallback
- Status: ❌ Failing silently inside sendMessage()

---

## Fixes Attempted

### Fix 1: Session Synchronization

**Problem:** MAIS created local session IDs, but ADK expects sessions via its API.

**Solution Applied:**

```typescript
// vertex-agent.service.ts:90-124
async createSession(tenantId: string, userId: string): Promise<string> {
  const adkUserId = `${tenantId}:${userId}`;

  // Create session on ADK first
  const response = await fetch(
    `${CONCIERGE_AGENT_URL}/apps/concierge/users/${encodeURIComponent(adkUserId)}/sessions`,
    { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ state: { tenantId } }) }
  );

  // Fall back to local if ADK unreachable
  adkSessionId = `local:${tenantId}:${userId}:${Date.now()}`;
}
```

**Result:** Unknown - no logs to confirm if ADK session creation succeeds.

### Fix 2: Local Dev Authentication

**Problem:** GoogleAuth library can't get ID tokens with user credentials (only service accounts).

**Solution Applied:**

```typescript
// vertex-agent.service.ts:330-362
private async getIdentityToken(): Promise<string | null> {
  // First try GoogleAuth (works on GCP)
  try {
    const client = await this.auth.getIdTokenClient(CONCIERGE_AGENT_URL);
    // ...
  } catch { /* fallback */ }

  // Second try: gcloud CLI (works locally)
  try {
    const { execSync } = await import('child_process');
    const token = execSync('gcloud auth print-identity-token', { encoding: 'utf-8', timeout: 5000 }).trim();
    return token;
  } catch { /* no token */ }
}
```

**Result:** gcloud CLI works manually, but no logs confirm it's being used.

---

## Hypotheses for Root Cause

### Hypothesis 1: tsx watch didn't reload

**Likelihood:** 50%

The server was running when fixes were applied. Even though we restarted, tsx watch might have cached the old module.

**Test:** Kill all processes, delete node_modules/.cache, restart.

### Hypothesis 2: ADK session creation failing silently

**Likelihood:** 30%

The session creation might fail and fall back to local session ID. When `sendMessage()` uses this local session ID, ADK rejects it.

**Test:** Add verbose logging to `createSession()` to see if ADK call succeeds.

### Hypothesis 3: ID token audience mismatch

**Likelihood:** 15%

gcloud CLI generates tokens with default audience. Cloud Run might require specific audience.

**Test:** `gcloud auth print-identity-token --audiences=https://concierge-agent-506923455711.us-central1.run.app`

### Hypothesis 4: Concierge agent returning unexpected format

**Likelihood:** 5%

The Concierge agent might return an error or unexpected response format that `extractAgentResponse()` can't parse.

**Test:** Add logging of raw ADK response before parsing.

---

## Missing Observability

### Critical Gap: No logs from VertexAgentService

The service has logging statements:

```typescript
logger.info({ tenantId, userId, adkSessionId }, '[VertexAgent] Session created');
logger.info({ tenantId, sessionId, messageLength }, '[VertexAgent] Sending message');
logger.error({ tenantId, sessionId, error }, '[VertexAgent] Failed to send message');
```

**But none appear in output.** Possible reasons:

1. Logger configuration issue
2. Code not being executed
3. Logs going to different destination
4. tsx watch not reloading the file

---

## ROOT CAUSE IDENTIFIED ✅

**The A2A protocol uses camelCase, not snake_case!**

| Wrong (snake_case) | Correct (camelCase) |
| ------------------ | ------------------- |
| `app_name`         | `appName`           |
| `user_id`          | `userId`            |
| `session_id`       | `sessionId`         |
| `new_message`      | `newMessage`        |

When we used snake_case, the `sessionId` field was not being parsed, resulting in "Session not found: **undefined**".

### Fix Applied

```typescript
// vertex-agent.service.ts - sendMessage()
body: JSON.stringify({
  appName: 'concierge',      // was: app_name
  userId: adkUserId,          // was: user_id
  sessionId: sessionId,       // was: session_id
  newMessage: {               // was: new_message
    role: 'user',
    parts: [{ text: message }],
  },
  state: { tenantId },
}),
```

### Additional Findings

**Finding 2: App name mismatch**

`/list-apps` returns `["agent"]` not `["concierge"]`. Sessions must be created with:

- `/apps/agent/users/{user}/sessions` (correct)
- NOT `/apps/concierge/users/{user}/sessions` (incorrect)

**Finding 3: ADK doesn't support z.record()**

After fixing app name, we get:

```json
{ "error": "Unsupported Zod type: ZodRecord" }
```

This is caused by `DelegateToStorefrontParams` at line 161 in `agent.ts`:

```typescript
content: z.record(z.unknown()).optional(); // ADK doesn't support z.record()!
```

**Fix required in deployed agent:** Replace `z.record()` with `z.any()` or `z.object({}).passthrough()`.

---

## Summary: Three Issues Found

| #   | Issue                               | Location                  | Status                          |
| --- | ----------------------------------- | ------------------------- | ------------------------------- |
| 1   | A2A uses camelCase not snake_case   | `vertex-agent.service.ts` | ✅ Fixed                        |
| 2   | App name is "agent" not "concierge" | `vertex-agent.service.ts` | ✅ Fixed                        |
| 3   | ADK doesn't support z.record()      | `concierge/src/agent.ts`  | ✅ Fixed + Redeployed           |
| 4   | ADK returns array, not object       | `vertex-agent.service.ts` | ✅ Fixed (extractAgentResponse) |

---

## Final Resolution

All four issues were resolved:

1. **Parameter naming**: Changed `app_name`, `user_id`, `session_id`, `new_message` to camelCase
2. **App name**: Changed `/apps/concierge/` to `/apps/agent/` and `appName: 'concierge'` to `appName: 'agent'`
3. **Zod schema**: Changed `z.record(z.unknown())` to `z.any()` and redeployed agent
4. **Response format**: Updated `extractAgentResponse()` to handle ADK's array format `[{ content: { role, parts } }]`

**Verification:** Screenshot captured showing successful "Write me better headlines" → "On it. Check the preview →" exchange.

---

## Recommended Next Steps

### Immediate Actions

1. **Force server restart with cache clear:**

   ```bash
   pkill -f "tsx" && pkill -f "next"
   rm -rf node_modules/.cache
   npm run dev:api
   ```

2. **Add debug logging at route entry:**

   ```typescript
   // tenant-admin-agent.routes.ts:62
   router.post('/chat', async (req, res) => {
     console.log('🔴 CHAT ROUTE HIT:', req.body); // Force stdout
     // ...
   });
   ```

3. **Test Concierge directly with curl:**
   ```bash
   TOKEN=$(gcloud auth print-identity-token)
   curl -X POST "https://concierge-agent-506923455711.us-central1.run.app/run" \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "app_name": "concierge",
       "user_id": "test:user",
       "session_id": "test-session",
       "new_message": { "role": "user", "parts": [{ "text": "Write me better headlines" }] },
       "state": { "tenantId": "test" }
     }'
   ```

### Debugging Agent Requests

1. **Explore Agent:** Search for similar auth issues in `docs/solutions/`
2. **Plan Agent:** Design a systematic debug strategy
3. **Manual test:** Verify Concierge agent responds to direct HTTP calls

---

## Environment Details

| Variable      | Value                                                      |
| ------------- | ---------------------------------------------------------- |
| Node.js       | v22.x                                                      |
| OS            | Darwin 24.6.0                                              |
| Platform      | darwin                                                     |
| API Port      | 3001                                                       |
| Web Port      | 3000                                                       |
| Concierge URL | `https://concierge-agent-506923455711.us-central1.run.app` |
| GCP Project   | handled-484216                                             |
| GCP Region    | us-central1                                                |

---

## Files Modified in This Session

1. `server/src/services/vertex-agent.service.ts` - Session sync + gcloud auth fallback
2. `apps/web/src/components/agent/AgentPanel.tsx` - Hardcoded USE_CONCIERGE_AGENT=true
3. `apps/web/src/components/agent/ConciergeChat.tsx` - TypeScript fixes

---

## Appendix: Network Request Evidence

```
[POST] http://localhost:3000/api/tenant-admin/agent/session => [200] OK
[POST] http://localhost:3000/api/tenant-admin/agent/chat => [200] OK
```

Both return 200, but chat response contains error message.

---

## Audit Request

**For reviewing agents:** Please investigate:

1. Why are `[VertexAgent]` logs not appearing in server output?
2. Is the tsx watch properly reloading `vertex-agent.service.ts`?
3. Can you confirm the Concierge agent responds to direct HTTP calls?
4. Is there an auth or session issue blocking the A2A communication?

**Priority:** This is blocking Gate 4 completion for the Vertex AI Agent System.
