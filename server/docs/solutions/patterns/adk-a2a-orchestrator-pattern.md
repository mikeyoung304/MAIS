---
title: A2A Orchestrator Pattern
category: patterns
component: agent-v2
severity: reference
tags:
  [google-adk, a2a, orchestration, hub-spoke, multi-agent, cloud-run, identity-tokens, concierge]
created: 2026-01-18
related:
  - adk-agent-deployment-pattern.md
  - adk-agent-backend-integration-pattern.md
  - ADK_CLOUD_RUN_SERVICE_NAME_PREVENTION.md
---

# A2A Orchestrator Pattern

## Overview

Hub-and-spoke architecture where a **Concierge agent** (hub) delegates tasks to **specialist agents** (spokes) via Cloud Run HTTP calls. This pattern enables:

- Clear separation of concerns (routing vs. domain expertise)
- Independent scaling of specialists
- Graceful degradation via ReflectAndRetry
- Multi-tenant isolation across agent boundaries

## Architecture

```
                    ┌─────────────────┐
                    │   Dashboard     │
                    │   (Frontend)    │
                    └────────┬────────┘
                             │ POST /v1/tenant-admin/agent/chat
                             ▼
                    ┌─────────────────┐
                    │  MAIS Backend   │
                    │ (vertex-agent   │
                    │   .service.ts)  │
                    └────────┬────────┘
                             │ A2A Protocol (HTTP + Identity Token)
                             ▼
              ┌──────────────────────────────┐
              │      CONCIERGE AGENT         │
              │   (Hub - Routes Requests)    │
              │   temperature: 0.2           │
              └──────┬───────┬───────┬───────┘
                     │       │       │
        A2A Protocol │       │       │ A2A Protocol
                     ▼       ▼       ▼
              ┌──────┐ ┌──────┐ ┌──────┐
              │Market│ │Store │ │Resear│
              │ ing  │ │front │ │  ch  │
              └──────┘ └──────┘ └──────┘
                (Specialists - Domain Experts)
```

## Pattern 1: A2A Protocol

Agents communicate via HTTP POST to `/run` endpoint with standardized message format.

### Request Format

```typescript
const response = await fetch(`${agentUrl}/run`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    ...(authHeader && { Authorization: `Bearer ${authHeader}` }),
  },
  // CRITICAL: ADK uses camelCase for all A2A protocol parameters
  // snake_case (app_name, user_id, etc.) causes silent "Session not found" errors
  body: JSON.stringify({
    appName: agentName, // e.g., 'marketing_specialist' (camelCase!)
    userId: tenantId, // Tenant ID as user identifier (camelCase!)
    sessionId: sessionId, // Unique session for conversation continuity (camelCase!)
    newMessage: {
      // (camelCase!)
      role: 'user',
      parts: [{ text: message }], // Gemini-style message format
    },
    state: {
      tenantId, // CRITICAL: Passed for tenant isolation
    },
  }),
});
```

### Response Extraction

```typescript
const data = (await response.json()) as {
  messages?: Array<{
    role: string;
    parts?: Array<{ text?: string }>;
  }>;
};

// Extract the agent's response from the A2A format
const agentResponse = data.messages
  ?.find((m) => m.role === 'model')
  ?.parts?.find((p) => p.text)?.text;
```

### Key Points

- Standard endpoint: `/run` (ADK convention)
- Message format mirrors Gemini's `Content` structure
- State object carries tenant context across agent boundaries
- Session ID enables multi-turn conversations with specialists

## Pattern 2: Identity Token Authentication

Two approaches depending on caller context:

### Agent-to-Agent (GCP Metadata Service)

Used when one Cloud Run agent calls another:

```typescript
// Get identity token from GCP metadata service
const metadataUrl =
  'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=' +
  agentUrl;

let authHeader = '';
try {
  const tokenResponse = await fetch(metadataUrl, {
    headers: { 'Metadata-Flavor': 'Google' },
  });
  if (tokenResponse.ok) {
    const token = await tokenResponse.text();
    authHeader = `Bearer ${token}`;
  }
} catch {
  // Running locally without metadata server - skip auth for dev
  console.log('[Concierge] No metadata server - running in dev mode');
}
```

### Backend-to-Agent (Google Auth Library)

Used when MAIS backend calls the Concierge:

```typescript
import { GoogleAuth } from 'google-auth-library';

private auth = new GoogleAuth();

private async getIdentityToken(): Promise<string | null> {
  try {
    const client = await this.auth.getIdTokenClient(CONCIERGE_AGENT_URL);
    const headers = await client.getRequestHeaders();
    const authHeader = (headers as unknown as Record<string, string>)['Authorization'] || '';
    return authHeader.replace('Bearer ', '');
  } catch {
    // Not running on GCP or no credentials - local dev mode
    return null;
  }
}
```

### Key Points

- Tokens are **audience-scoped** to target service URL
- Both patterns gracefully degrade for local development
- No shared secrets needed - GCP IAM handles authentication

## Pattern 3: ReflectAndRetry

Automatic retry with simplified requests when specialists fail.

### State Tracking

```typescript
const retryState = new Map<string, number>();
const MAX_RETRIES = 2;

function shouldRetry(taskKey: string): boolean {
  const count = retryState.get(taskKey) || 0;
  if (count >= MAX_RETRIES) {
    retryState.delete(taskKey);
    return false;
  }
  retryState.set(taskKey, count + 1);
  return true;
}

function clearRetry(taskKey: string): void {
  retryState.delete(taskKey);
}
```

### Usage in Tool Execution

```typescript
execute: async (params, context) => {
  const tenantId = getTenantId(context);
  const taskKey = `marketing:${tenantId}:${params.task}`;

  const result = await callSpecialistAgent(/*...*/);

  if (!result.ok) {
    if (shouldRetry(taskKey)) {
      console.log(`[Concierge] Retrying: ${params.task}`);
      // SIMPLIFY the request for retry
      const simpleMessage = `Generate a ${params.task}. Keep it simple.`;
      const retryResult = await callSpecialistAgent(/*simplified*/);

      if (retryResult.ok) {
        clearRetry(taskKey);
        return {
          success: true,
          result: retryResult.response,
          note: 'Recovered with simplified request', // Transparency
        };
      }
    }
    clearRetry(taskKey);
    return {
      success: false,
      error: result.error,
      suggestion: 'Try a simpler request or different approach',
    };
  }

  clearRetry(taskKey);
  return { success: true, result: result.response };
};
```

### Key Points

- Task key includes tenant ID to prevent cross-tenant retry conflicts
- Maximum 2 retries before giving up
- Retry uses **simplified parameters** (reduces complexity that may have caused failure)
- Response indicates when recovery used simplified request
- Always clear retry state on success OR final failure

## Pattern 4: Tenant-Scoped Sessions

Sessions encode tenant ID and enforce isolation.

### Session ID Format

```typescript
const sessionId = `session:${tenantId}:${userId}:${Date.now()}`;
// Example: session:tenant_abc123:mike:1737234567890
```

### Session Structure

```typescript
interface AgentSession {
  sessionId: string;
  tenantId: string;
  userId: string;
  createdAt: Date;
  lastMessageAt: Date;
  messageCount: number;
}
```

### Session Lookup with Tenant Validation

```typescript
async getOrCreateSession(tenantId: string, userId: string): Promise<AgentSession> {
  // Look for active session for this tenant/user
  for (const [sessionId, session] of sessions) {
    if (session.tenantId === tenantId && session.userId === userId) {
      // Check freshness (30-minute timeout)
      const thirtyMinutes = 30 * 60 * 1000;
      if (Date.now() - session.lastMessageAt.getTime() < thirtyMinutes) {
        return session;
      }
    }
  }
  // Create new session
  const sessionId = await this.createSession(tenantId, userId);
  return sessions.get(sessionId)!;
}
```

### Tenant Context in A2A Calls

```typescript
state: {
  tenantId,  // CRITICAL: Always propagate tenant context
}
```

Agent tools extract tenant via:

```typescript
const tenantId = context.state?.get<string>('tenantId');
```

### Key Points

- Tenant ID is encoded in session ID itself
- Session lookup always validates tenant ID matches
- 30-minute session timeout for security
- Tenant context propagates via A2A `state` object

## File Locations

| Component            | Location                                            |
| -------------------- | --------------------------------------------------- |
| Concierge Agent      | `server/src/agent-v2/deploy/concierge/src/agent.ts` |
| Vertex Agent Service | `server/src/services/vertex-agent.service.ts`       |
| Dashboard API Routes | `server/src/routes/tenant-admin-agent.routes.ts`    |
| Service Registry     | `server/src/agent-v2/deploy/SERVICE_REGISTRY.md`    |

## Deployed Services

| Agent      | Cloud Run URL                                               |
| ---------- | ----------------------------------------------------------- |
| Concierge  | `https://concierge-agent-506923455711.us-central1.run.app`  |
| Marketing  | `https://marketing-agent-506923455711.us-central1.run.app`  |
| Storefront | `https://storefront-agent-506923455711.us-central1.run.app` |
| Research   | `https://research-agent-506923455711.us-central1.run.app`   |

## Checklist: Adding a New Specialist

1. [ ] Create agent at `server/src/agent-v2/deploy/{name}/`
2. [ ] Follow [adk-agent-deployment-pattern.md](./adk-agent-deployment-pattern.md)
3. [ ] Add `--service_name={name}-agent` to deploy script
4. [ ] Update SERVICE_REGISTRY.md with new URL
5. [ ] Add delegation tool to Concierge (`delegate_to_{name}`)
6. [ ] Add specialist URL to Concierge environment config
7. [ ] Update Concierge system prompt routing logic
8. [ ] Test A2A call with identity token authentication

## Related Documentation

- [ADK Agent Deployment Pattern](./adk-agent-deployment-pattern.md) - Standalone package structure
- [ADK Agent Backend Integration](./adk-agent-backend-integration-pattern.md) - Internal API design
- [Service Name Prevention](./ADK_CLOUD_RUN_SERVICE_NAME_PREVENTION.md) - Avoid deployment conflicts
