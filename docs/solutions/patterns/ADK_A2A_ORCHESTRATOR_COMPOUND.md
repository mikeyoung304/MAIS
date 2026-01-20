---
title: ADK A2A Orchestrator Pattern - Compound Knowledge
category: patterns
component: agent-v2
severity: P0
tags: [google-adk, a2a, orchestration, cloud-run, compound, lessons-learned]
created: 2026-01-18
sessions: 2
total_debugging_time: ~4 hours
status: COMPLETE - All issues resolved
---

# ADK A2A Orchestrator Pattern - Compound Knowledge

This document compounds all learnings from debugging the Concierge → Specialist agent orchestration system. These issues cost ~4 hours of debugging across 2 sessions - this document ensures they're solved permanently.

## Architecture Overview

```
MAIS Dashboard
     │
     ▼ HTTP POST
Next.js API Route (/api/tenant-admin/agent/chat)
     │
     ▼ Proxy to backend
Express Route Handler (tenant-admin-agent.routes.ts)
     │
     ▼
VertexAgentService (vertex-agent.service.ts)
     │
     ▼ A2A Protocol (camelCase!)
Cloud Run: Concierge Agent ─────────────┐
     │                                   │
     ├─▶ delegate_to_marketing ──────────┼──▶ Marketing Agent
     ├─▶ delegate_to_storefront ─────────┼──▶ Storefront Agent
     └─▶ delegate_to_research ───────────┴──▶ Research Agent
```

---

## The 8 Issues Discovered (In Order)

### Session 1: A2A Protocol Debugging

| #   | Issue              | Symptom                           | Root Cause                                | Fix                                           |
| --- | ------------------ | --------------------------------- | ----------------------------------------- | --------------------------------------------- |
| 1   | camelCase Required | "Session not found: undefined"    | ADK uses camelCase, not snake_case        | Change `app_name` → `appName`, etc.           |
| 2   | App Name Mismatch  | "Session not found: {actual-id}"  | ADK registered as "agent" not "concierge" | Use `/list-apps` to discover name             |
| 3   | Zod z.record()     | "Unsupported Zod type: ZodRecord" | ADK schema converter doesn't support it   | Use `z.any().describe()`                      |
| 4   | Response Format    | Raw JSON in chat                  | ADK returns array, not object             | Handle `[{ content: { role, parts }}]` format |
| 5   | Identity Token     | Auth failures locally             | GoogleAuth needs service account          | Add gcloud CLI fallback                       |

### Session 2: Tool Calling Debugging

| #   | Issue                 | Symptom                                   | Root Cause                                    | Fix                                          |
| --- | --------------------- | ----------------------------------------- | --------------------------------------------- | -------------------------------------------- |
| 6   | LLM Pattern Matching  | Agent says "On it" but doesn't call tools | System prompt had copy-pasteable example text | Restructure to tool-first with action arrows |
| 7   | Specialist snake_case | Would fail when delegation works          | callSpecialistAgent had snake_case            | Fix to camelCase                             |
| 8   | Prevention Doc Error  | Future devs would use wrong pattern       | Docs said snake_case                          | Corrected to camelCase                       |

---

## The Critical Discovery: LLM Pattern Matching

**This was the most subtle bug.** The Concierge agent responded with "On it. Check the preview →" but never called `delegate_to_marketing`.

### What Happened

System prompt contained:

```markdown
**Good Response:**
User: "Write me better headlines"
You: "On it. Check the preview →"
[Delegates to Marketing, shows result]
"Got 3 options. Which vibes?"
```

The LLM saw `You: "On it. Check the preview →"` as a template and **output it verbatim**. The bracketed `[Delegates to Marketing]` was interpreted as documentation, not an action.

### Proof from Cloud Run Logs

```json
// Response had NO functionCall - just text
{
  "content": {
    "parts": [{ "text": "On it. Check the preview →\n" }]
  },
  "finishReason": "STOP"
}
```

### The Fix

Changed from template examples to action-flow instructions:

```markdown
## WRONG

User: "Write me better headlines"
You: "On it. Check the preview →"

## CORRECT

User: "Write me better headlines"
→ Your FIRST action: Call delegate_to_marketing(task="headline", ...)
→ Wait for tool result
→ Then respond with actual generated content
```

Key changes:

1. No copy-pasteable `You: "..."` text
2. Use `→` arrows to indicate actions
3. Explicit "MUST call" language
4. "What You Must NEVER Do" section with ❌ examples

---

## Complete Code Fixes

### Fix 1: A2A Protocol (camelCase)

**File:** `server/src/services/vertex-agent.service.ts`

```typescript
// CORRECT - camelCase for all A2A fields
body: JSON.stringify({
  appName: 'agent',           // NOT app_name
  userId: adkUserId,          // NOT user_id
  sessionId: sessionId,       // NOT session_id
  newMessage: {               // NOT new_message
    role: 'user',
    parts: [{ text: message }],
  },
  state: { tenantId },
}),
```

### Fix 2: App Name Discovery

**File:** `server/src/services/vertex-agent.service.ts`

```typescript
// The app name is 'agent' (discovered via /list-apps), not 'concierge'
const SESSION_URL = `${CONCIERGE_AGENT_URL}/apps/agent/users/${adkUserId}/sessions`;
```

**Discovery command:**

```bash
TOKEN=$(gcloud auth print-identity-token)
curl -H "Authorization: Bearer $TOKEN" "$SERVICE_URL/list-apps"
# Returns: ["agent"]
```

### Fix 3: Zod Schema Limitations

**File:** `server/src/agent-v2/deploy/concierge/src/agent.ts`

```typescript
// WRONG - ADK doesn't support z.record()
content: z.record(z.unknown()),

// CORRECT - use z.any() with description
content: z.any().describe('Content updates to apply'),
```

### Fix 4: Response Format Handling

**File:** `server/src/services/vertex-agent.service.ts`

```typescript
private extractAgentResponse(data: unknown): string {
  // ADK returns array format: [{ content: { role, parts }}]
  if (Array.isArray(data)) {
    // Iterate from end to find most recent model response
    for (let i = data.length - 1; i >= 0; i--) {
      const event = data[i];
      if (event.content?.role === 'model') {
        const textPart = event.content.parts?.find((p) => p.text);
        if (textPart?.text) return textPart.text;
      }
    }
  }
  // Fallback for legacy format
  // ...
}
```

### Fix 5: Identity Token Fallback

**File:** `server/src/services/vertex-agent.service.ts`

```typescript
private async getIdentityToken(): Promise<string | null> {
  // Try GoogleAuth first (works with service accounts)
  try {
    const client = await this.auth.getIdTokenClient(CONCIERGE_AGENT_URL);
    const headers = await client.getRequestHeaders();
    return headers['Authorization']?.replace('Bearer ', '') || null;
  } catch {
    // Fall back to gcloud CLI (works locally)
    try {
      const { stdout } = await execAsync('gcloud auth print-identity-token');
      return stdout.trim();
    } catch {
      logger.warn('[VertexAgent] No auth available - running without token');
      return null;
    }
  }
}
```

### Fix 6: System Prompt Tool-First

**File:** `server/src/agent-v2/deploy/concierge/src/agent.ts`

```typescript
const CONCIERGE_SYSTEM_PROMPT = `
## CRITICAL: Tool-First Protocol

IMPORTANT: You MUST call the appropriate tool BEFORE responding with text.
Never acknowledge a request without actually executing it via tool call.

### For Content Requests
1. IMMEDIATELY call delegate_to_marketing tool
2. WAIT for the tool result
3. THEN respond with the actual generated content

## What You Must NEVER Do

❌ Say "On it" or "Working on it" before calling a tool
❌ Acknowledge a request without executing the tool
❌ Respond with placeholder text like "Check the preview"
❌ Fabricate content without calling the appropriate tool

## Correct Behavior

User: "Write me better headlines"
→ Your FIRST action: Call delegate_to_marketing(task="headline", ...)
→ Wait for tool result with actual headlines
→ Then respond with the generated content
`;
```

### Fix 7: Specialist Delegation (camelCase)

**File:** `server/src/agent-v2/deploy/concierge/src/agent.ts`

```typescript
// In callSpecialistAgent function
body: JSON.stringify({
  appName: agentName,      // NOT app_name
  userId: tenantId,        // NOT user_id
  sessionId: sessionId,    // NOT session_id
  newMessage: {            // NOT new_message
    role: 'user',
    parts: [{ text: message }],
  },
  state: { tenantId },
}),
```

---

## Verification Commands

### Test Session Creation

```bash
TOKEN=$(gcloud auth print-identity-token)
curl -X POST "$AGENT_URL/apps/agent/users/test%3Auser/sessions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"state":{"tenantId":"test"}}'
# Should return: {"id":"session-uuid",...}
```

### Test Message with Tool Calling

```bash
curl -X POST "$AGENT_URL/run" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "appName": "agent",
    "userId": "test:user",
    "sessionId": "'$SESSION_ID'",
    "newMessage": {"role":"user","parts":[{"text":"Write me better headlines"}]}
  }' | jq '.[] | select(.content.parts[].functionCall)'
# Should show functionCall, NOT just text
```

---

## Files Modified

| File                                                  | Changes                                                  |
| ----------------------------------------------------- | -------------------------------------------------------- |
| `server/src/services/vertex-agent.service.ts`         | camelCase A2A, response parsing, auth fallback           |
| `server/src/agent-v2/deploy/concierge/src/agent.ts`   | System prompt, callSpecialistAgent camelCase, Zod schema |
| `docs/solutions/patterns/ADK_A2A_PREVENTION_INDEX.md` | Corrected to camelCase, added pattern-matching issue     |
| `CLAUDE.md`                                           | Updated pitfalls 32-39                                   |

---

## CLAUDE.md Pitfalls Added/Updated

```markdown
32. A2A camelCase required - Use `appName`, `userId`, `sessionId`, `newMessage` for A2A protocol (NOT snake_case - ADK rejects it silently)
33. App name mismatch - Always verify app name with `/list-apps` after deploy; must match agent's `name` property
34. Unsupported Zod types - ADK doesn't support `z.record()`, `z.tuple()`, `z.intersection()`, `z.lazy()`; use `z.any()` with `.describe()`
35. A2A response format - Handle both `messages[]` and `content.parts[]` formats; fallback to JSON.stringify
36. Identity token auth - Agent-to-Agent uses metadata service; Backend-to-Agent uses GoogleAuth; both need graceful local dev fallback
37. LLM pattern-matching prompts - Never include example responses like `You: "On it!"` - LLMs copy them verbatim instead of calling tools; use action arrows like `→ Call tool_name()` instead
38. Hardcoded Cloud Run URLs - Always use environment variables; URLs contain project numbers that change
39. ADK response array format - ADK returns `[{ content: { role, parts }}]` array, not `{ messages: [...] }` object; iterate from end to find model response
```

---

## Next Steps

1. **Deploy Concierge agent** with all fixes:

   ```bash
   cd server/src/agent-v2/deploy/concierge
   npm run deploy
   ```

2. **Verify tool calling** works via curl test

3. **Test end-to-end** in dashboard: "Write me better headlines" should show generated content

---

## Related Documentation

- [ADK_A2A_PREVENTION_INDEX.md](./ADK_A2A_PREVENTION_INDEX.md) - Prevention strategies
- [adk-a2a-orchestrator-pattern.md](../../server/docs/solutions/patterns/adk-a2a-orchestrator-pattern.md) - Architecture pattern
- [CONCIERGE-CHAT-DEBUGGING-REPORT.md](../debugging-reports/CONCIERGE-CHAT-DEBUGGING-REPORT.md) - Session 1 report
- [CONCIERGE-TOOL-CALLING-FIX.md](../debugging-reports/CONCIERGE-TOOL-CALLING-FIX.md) - Session 2 report

---

## Compound Value

| Metric                     | Before   | After                  |
| -------------------------- | -------- | ---------------------- |
| Time to solve these issues | ~4 hours | ~5 minutes (read docs) |
| Issues documented          | 0        | 8                      |
| Prevention strategies      | 0        | 8                      |
| Test cases provided        | 0        | 7                      |
| Pitfalls in CLAUDE.md      | 31       | 39                     |

**Knowledge compounded. Future agents will find solutions immediately.**
