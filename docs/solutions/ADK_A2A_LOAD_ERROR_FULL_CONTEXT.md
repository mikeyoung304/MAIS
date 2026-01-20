# ADK A2A "load" Error - Complete Debug Context

**Created:** 2026-01-20
**Status:** BLOCKED - Internal ADK framework bug
**Time Spent:** Multiple sessions, many hours of debugging

---

## TL;DR

The agent chat feature is broken because Google's ADK (Agent Development Kit) has an internal bug. When the Concierge agent tries to delegate tasks to specialist agents (Storefront, Marketing, Research) via A2A protocol, the specialist agents crash with:

```
Cannot read properties of undefined (reading 'load')
```

This error happens **inside the ADK framework**, not in our code. We cannot fix it without Google fixing ADK.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         MAIS Backend (Render)                    │
│                    https://mais-5bwx.onrender.com                │
└──────────────────────────────┬──────────────────────────────────┘
                               │ JWT Auth ✅ (FIXED)
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Concierge Agent (Cloud Run)                   │
│         https://concierge-agent-506923455711.us-central1.run.app │
│                                                                  │
│  Routes requests to specialists based on intent:                 │
│  - Content updates with exact text → Storefront                  │
│  - Content generation requests → Marketing                       │
│  - Market research → Research                                    │
└──────────────────────────────┬──────────────────────────────────┘
                               │ A2A Protocol ❌ (BROKEN)
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Specialist Agents (Cloud Run)                 │
│                                                                  │
│  storefront-agent-506923455711.us-central1.run.app               │
│  marketing-agent-506923455711.us-central1.run.app                │
│  research-agent-506923455711.us-central1.run.app                 │
│                                                                  │
│  All three fail with the SAME error when called via A2A          │
└─────────────────────────────────────────────────────────────────┘
```

---

## What Works ✅

| Component                               | Status   | Evidence                                                 |
| --------------------------------------- | -------- | -------------------------------------------------------- |
| MAIS Backend → Concierge                | ✅ Works | Logs show successful communication                       |
| JWT authentication (Render → Cloud Run) | ✅ Works | `Got identity token via JWT (service account)`           |
| Concierge receives messages             | ✅ Works | Concierge logs show message received                     |
| Concierge routing logic                 | ✅ Works | UI shows "Storefront ✓" for content updates              |
| A2A session creation                    | ✅ Works | `Created session on storefront_specialist: 96bab4be-...` |
| Cloud Run → Cloud Run auth              | ✅ Works | Metadata service provides tokens                         |

## What Fails ❌

| Component                                | Status   | Error                                                            |
| ---------------------------------------- | -------- | ---------------------------------------------------------------- |
| A2A message processing (`/run` endpoint) | ❌ FAILS | HTTP 500: `Cannot read properties of undefined (reading 'load')` |
| ALL specialist agents                    | ❌ FAILS | Same error on Storefront, Marketing, Research                    |

---

## The Error

### Concierge Logs (Cloud Run)

```
[Concierge] Created session on storefront_specialist: 96bab4be-f881-4440-97d5-2af3d1420d60
[Concierge] Sending message to storefront_specialist, session: 96bab4be-f881-4440-97d5-2af3d1420d60
[Concierge] storefront_specialist error: 500 - {"error":"Cannot read properties of undefined (reading 'load')"}
```

### A2A Request Format (What Concierge Sends)

```json
{
  "appName": "storefront_specialist",
  "userId": "cmklof4rn00002vl0up3xnx9d",
  "sessionId": "96bab4be-f881-4440-97d5-2af3d1420d60",
  "newMessage": {
    "role": "user",
    "parts": [
      {
        "text": "Task: update_section\nPage: home\nContent: {\"headline\": \"Welcome to My Amazing Business\"}"
      }
    ]
  },
  "state": {
    "tenantId": "cmklof4rn00002vl0up3xnx9d"
  }
}
```

### User-Facing Symptom

- Agent chat shows "That didn't work. Try specifying a page or section more clearly?"
- The headline in the preview remains unchanged

---

## Root Cause Analysis

The `.load()` error is happening **inside the ADK framework** during A2A message processing. Likely locations:

1. **Session state loading** - When ADK tries to load session state for the `/run` endpoint
2. **Tool loading mechanism** - When ADK loads the agent's tools
3. **Model/agent loading** - When ADK instantiates the agent to process the message

**Key Evidence:**

- Error happens AFTER session creation succeeds
- Error happens BEFORE our agent code executes (no agent logs for the request)
- ALL specialist agents fail with the SAME error
- Error is in `/run` endpoint, not session creation

---

## Debugging Attempts (All Failed)

| Attempt                       | Result                         |
| ----------------------------- | ------------------------------ |
| Redeploy storefront-agent     | Same error                     |
| Redeploy all agents           | Same error                     |
| Different session IDs         | Same error                     |
| Clear session cache           | Same error                     |
| Simplify agent configuration  | Same error                     |
| Check ADK version consistency | All using `@google/adk@^0.2.4` |

---

## Files Involved

### Agent Deployments (Cloud Run)

```
server/src/agent-v2/deploy/
├── concierge/
│   ├── src/agent.ts        # Hub agent - routes to specialists
│   ├── package.json        # @google/adk@^0.2.4
│   └── .env                # SPECIALIST_URLS, INTERNAL_API_SECRET
├── storefront/
│   ├── src/agent.ts        # Specialist - page structure/content
│   ├── package.json        # @google/adk@^0.2.4
│   └── .env                # MAIS_API_URL, INTERNAL_API_SECRET
├── marketing/
│   └── ...                 # Specialist - copy generation
└── research/
    └── ...                 # Specialist - market research
```

### Backend (Render)

```
server/src/services/vertex-agent.service.ts  # Calls Concierge via Cloud Run
```

### Key Code Sections

**Concierge A2A Call (agent.ts:529-548)**

```typescript
const response = await fetchWithTimeout(
  `${agentUrl}/run`,
  {
    method: 'POST',
    headers,
    body: JSON.stringify({
      appName: agentName,
      userId: tenantId,
      sessionId: specialistSessionId,
      newMessage: {
        role: 'user',
        parts: [{ text: message }],
      },
      state: {
        tenantId,
      },
    }),
  },
  timeout
);
```

---

## Environment Details

| Component   | Value                          |
| ----------- | ------------------------------ |
| ADK Version | `@google/adk@^0.2.4`           |
| Platform    | Google Cloud Run (us-central1) |
| Model       | `gemini-2.0-flash`             |
| Agent Type  | `LlmAgent` with `FunctionTool` |

---

## Potential Next Steps

### 1. Check ADK GitHub Issues

Search for "load" errors, A2A protocol issues, or `/run` endpoint problems:

- https://github.com/google/adk-node/issues
- https://github.com/google/generative-ai-js/issues

### 2. Test Locally with ADK Dev Server

```bash
cd server/src/agent-v2/deploy/storefront
npm run dev  # Start local ADK server
# Then manually call /run endpoint to reproduce
```

### 3. Simplify Agent to Isolate

Create a minimal agent with NO tools to see if the error persists:

```typescript
export const minimalAgent = new LlmAgent({
  name: 'minimal_test',
  description: 'Test agent',
  model: 'gemini-2.0-flash',
  instruction: 'You are a test agent.',
  tools: [], // No tools
});
```

### 4. Check ADK Source Code

The error is likely in:

- Session state deserialization
- Tool registry loading
- Agent instantiation during `/run`

### 5. Contact Google Cloud Support

This appears to be an ADK framework bug. May need to escalate.

### 6. Workaround: Bypass A2A

Have Concierge call MAIS backend API directly for content updates, bypassing specialist agents entirely. This loses the multi-agent architecture benefits but would unblock the feature.

**Concierge already has:**

- `callMaisApi()` function that calls backend
- Direct tools for READ operations (`get_storefront_structure`)

**Would need to add:**

- Direct `update_storefront_section` tool that calls `/v1/internal/agent/storefront/update-section`

---

## Workaround Implementation (If Needed)

Add this tool to `concierge/src/agent.ts`:

```typescript
const updateStorefrontSectionDirectTool = new FunctionTool({
  name: 'update_storefront_section',
  description:
    'Update a section directly (bypasses broken A2A). Use for content updates when user provides exact text.',
  parameters: z.object({
    sectionId: z.string().describe('Section ID from get_storefront_structure'),
    headline: z.string().optional(),
    subheadline: z.string().optional(),
    content: z.string().optional(),
    ctaText: z.string().optional(),
  }),
  execute: async (params, context) => {
    const tenantId = getTenantId(context);
    if (!tenantId) return { error: 'No tenant context' };

    const result = await callMaisApi('/storefront/update-section', tenantId, params);
    if (!result.ok) return { error: result.error };

    return {
      success: true,
      message: 'Section updated in draft. Check the preview.',
      ...result.data,
    };
  },
});
```

Then add to tools array and update system prompt to use it instead of delegating.

---

## Key Learnings

1. **ADK A2A is fragile** - Session creation works but message processing fails
2. **Error is internal to ADK** - Not in our agent code
3. **All specialists affected** - Not specific to one agent's configuration
4. **Routing is correct** - The Concierge correctly identifies which specialist to call
5. **Auth is working** - Both JWT (Render→Cloud Run) and metadata service (Cloud Run→Cloud Run)

---

## Related Documentation

- `docs/solutions/ADK_A2A_LOAD_ERROR.md` - Original error doc (shorter version)
- `docs/solutions/JWT_ID_TOKEN_FOR_CLOUD_RUN_AUTH.md` - JWT auth fix (already applied)
- `docs/solutions/patterns/ADK_A2A_PREVENTION_INDEX.md` - ADK patterns reference

---

## For the Next Debugger

1. **Don't redeploy agents** - We've tried that multiple times, same error
2. **Don't change the A2A request format** - It matches ADK spec
3. **Focus on ADK internals** - The bug is in the framework
4. **Consider the workaround** - Direct backend calls may be the fastest path forward
5. **Check if ADK has updates** - A newer version might fix this

Good luck! 🍀
