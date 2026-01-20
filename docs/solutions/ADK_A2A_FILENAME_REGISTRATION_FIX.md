# ADK A2A Protocol "load" Error - Filename Registration Fix

## Metadata

```yaml
title: ADK A2A Protocol "load" Error - Agent Registration Name Mismatch
slug: adk-a2a-agent-filename-registration-fix
category: agent-issues
tags: [adk, a2a-protocol, agent-registration, cloud-run, orchestration, specialist-agents]
severity: critical
date_solved: 2026-01-19
date_identified: 2026-01-19
affected_components:
  - Concierge orchestrator
  - Storefront specialist
  - Marketing specialist
  - Research specialist
  - ADK AgentLoader
```

## Problem Statement

Specialist agents (Storefront, Marketing, Research) return HTTP 500 when called via A2A protocol from the Concierge orchestrator:

```
Cannot read properties of undefined (reading 'load')
```

### Symptoms

1. Agent chat shows "That didn't work" after delegation
2. Concierge logs show successful session creation, then 500 error
3. All specialist agents affected - not specific to one agent
4. Error happens during `/run` endpoint processing, not session creation

### Log Evidence

```
[Concierge] Created session on storefront: 96bab4be-...
[Concierge] Sending message to storefront, session: 96bab4be-...
[Concierge] storefront error: 500 - {"error":"Cannot read properties of undefined (reading 'load')"}
```

## Root Cause Analysis

**ADK's AgentLoader registers agents by FILENAME when a directory contains a single file, not by directory name or agent.name property.**

When `adk deploy cloud_run` creates the deployment package, the structure is:

```
/app/agents/concierge/agent.cjs    ← Single file
```

ADK's AgentLoader scans this and registers using the **filename**:

```javascript
// ADK AgentLoader internal code:
async loadAgentFromDirectory(t) {
  let n = (await Oe(t.path)).find(r => r.isFile && r.name === "agent" && je(r.ext));
  if (n) {
    let r = new $(n.path, this.options);
    await r.load();
    this.preloadedAgents[t.name] = r;  // t.name = filename = "agent"
  }
}
```

### What We Were Sending vs. What ADK Expected

| What Concierge Sent     | How ADK Registered  | Match? |
| ----------------------- | ------------------- | ------ |
| `appName: "storefront"` | Filename: `"agent"` | ❌ NO  |
| `appName: "marketing"`  | Filename: `"agent"` | ❌ NO  |
| `appName: "research"`   | Filename: `"agent"` | ❌ NO  |

**Why session creation succeeded:** The session endpoint just stores the appName without validation.

**Why /run failed:** The `/run` endpoint validates the session, THEN tries to load the agent. Since `agentLoader.getAgentFile("storefront")` returns `undefined`, calling `.load()` on undefined causes the error.

## Solution

### Step 1: Change All appName Values to 'agent'

**File:** `server/src/agent-v2/deploy/concierge/src/agent.ts`

```typescript
// Before (WRONG)
callSpecialistAgent(SPECIALIST_URLS.storefront, 'storefront', message, tenantId, sessionId);
callSpecialistAgent(SPECIALIST_URLS.marketing, 'marketing', message, tenantId, sessionId);
callSpecialistAgent(SPECIALIST_URLS.research, 'research', message, tenantId, sessionId);

// After (CORRECT)
callSpecialistAgent(SPECIALIST_URLS.storefront, 'agent', message, tenantId, sessionId);
callSpecialistAgent(SPECIALIST_URLS.marketing, 'agent', message, tenantId, sessionId);
callSpecialistAgent(SPECIALIST_URLS.research, 'agent', message, tenantId, sessionId);
```

### Step 2: Fix Timeout Logic to Use URL Instead of Agent Name

Since all agents now use `appName='agent'`, check the URL for specialist-specific behavior:

```typescript
// Before (BROKEN after step 1)
const timeout =
  agentName === 'research' ? TIMEOUTS.SPECIALIST_RESEARCH : TIMEOUTS.SPECIALIST_DEFAULT;

// After (CORRECT)
const timeout =
  agentUrl === SPECIALIST_URLS.research
    ? TIMEOUTS.SPECIALIST_RESEARCH
    : TIMEOUTS.SPECIALIST_DEFAULT;
```

### Step 3: Update Session Creation URLs

```typescript
// Session creation URL must also use 'agent'
const createSessionUrl = `${agentUrl}/apps/agent/users/${encodeURIComponent(tenantId)}/sessions`;
```

## Prevention Pattern

### CRITICAL RULE

When using ADK A2A protocol with `adk deploy cloud_run`, the `appName` must be `'agent'` (the filename) because each deployed service has a single `agent.cjs` file.

### Verification After Deployment

```bash
curl https://your-agent-url/list-apps
# Expected response:
# { "apps": ["agent"] }
```

### Code Review Checklist

- [ ] All `callSpecialistAgent()` calls use `'agent'` as appName
- [ ] No hardcoded specialist names in A2A calls
- [ ] Timeout/routing logic checks URL, not appName
- [ ] Session creation uses `/apps/agent/users/...` path

## Files Modified

1. `server/src/agent-v2/deploy/concierge/src/agent.ts` - All specialist delegation calls
2. `docs/solutions/ADK_A2A_LOAD_ERROR.md` - Updated with correct root cause
3. `CLAUDE.md` - Updated pitfall #33

## Related Documentation

- `docs/solutions/patterns/ADK_A2A_PREVENTION_INDEX.md` - Issue #2 (App Name Mismatch)
- `docs/solutions/patterns/A2A_SESSION_STATE_PREVENTION.md` - Session isolation patterns
- `docs/solutions/patterns/ADK_AGENT_DEVELOPMENT_QUICK_REFERENCE.md` - Development checklist
- `docs/solutions/JWT_ID_TOKEN_FOR_CLOUD_RUN_AUTH.md` - Auth prerequisite for A2A

## Key Learnings

1. **ADK filename registration** - When single file in directory, uses filename not directory name
2. **Session creation is permissive** - Sessions can be created for non-existent agents
3. **Error points to symptom** - "Cannot read properties of undefined" is misleading; root cause is configuration
4. **Always verify with /list-apps** - After deployment, confirm how agents are registered

## Environment

- ADK Version: `@google/adk@^0.2.4`
- Platform: Cloud Run (us-central1)
- Deployment: `adk deploy cloud_run`
- Model: `gemini-2.0-flash`
