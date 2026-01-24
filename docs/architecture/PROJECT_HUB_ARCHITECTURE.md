# Project Hub Agent Architecture

**Last Updated:** 2026-01-24
**Status:** Production (Phase 1 Complete, Phase 2 In Progress)
**Service URL:** `https://project-hub-agent-yi5kkn2wqq-uc.a.run.app`

---

## Overview

The Project Hub Agent is a **dual-context single-agent** that mediates communication between customers and service providers (tenants) after a booking is confirmed. It provides different views and capabilities based on who is talking to it.

### Key Design Principle

> **One agent, two contexts, complete isolation.**

Rather than deploying separate agents for customers and tenants, we use a single agent with programmatic tool gating. This provides the security benefits of separation with the operational simplicity of a single deployment.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PROJECT HUB AGENT                                    │
│                    (Cloud Run: us-central1)                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                    SESSION STATE                                     │   │
│   │   {                                                                  │   │
│   │     contextType: "customer" | "tenant",                              │   │
│   │     tenantId: string,                                                │   │
│   │     customerId?: string,                                             │   │
│   │     projectId?: string                                               │   │
│   │   }                                                                  │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│                    ┌───────────────┴───────────────┐                        │
│                    ▼                               ▼                        │
│   ┌────────────────────────────┐   ┌────────────────────────────┐          │
│   │     CUSTOMER CONTEXT       │   │      TENANT CONTEXT        │          │
│   │                            │   │                            │          │
│   │ ┌────────────────────────┐ │   │ ┌────────────────────────┐ │          │
│   │ │ requireContext(        │ │   │ │ requireContext(        │ │          │
│   │ │   ctx, 'customer'      │ │   │ │   ctx, 'tenant'        │ │          │
│   │ │ )                      │ │   │ │ )                      │ │          │
│   │ └────────────────────────┘ │   │ └────────────────────────┘ │          │
│   │                            │   │                            │          │
│   │ Tools:                     │   │ Tools:                     │          │
│   │ • get_project_status       │   │ • get_pending_requests     │          │
│   │ • get_prep_checklist       │   │ • get_customer_activity    │          │
│   │ • answer_prep_question     │   │ • approve_request          │          │
│   │ • submit_request (T3)      │   │ • deny_request             │          │
│   │ • get_timeline             │   │ • send_message_to_customer │          │
│   │                            │   │ • update_project_status    │          │
│   └────────────────────────────┘   └────────────────────────────┘          │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                    SHARED TOOLS                                      │   │
│   │   • bootstrap_project_hub_session (called FIRST in every session)   │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTPS (15s timeout)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MAIS BACKEND API                                     │
│                    (Render: api.gethandled.ai)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                 /v1/internal/agent/*                                 │   │
│   │   • Authenticated via X-Internal-Secret header                       │   │
│   │   • All operations verify tenant ownership                           │   │
│   │   • Tenant-scoped database queries                                   │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   Endpoints:                                                                 │
│   • POST /project-hub/bootstrap-customer                                     │
│   • POST /project-hub/bootstrap-tenant                                       │
│   • POST /project-hub/project-details                                        │
│   • POST /project-hub/pending-requests                                       │
│   • POST /project-hub/create-request                                         │
│   • POST /project-hub/approve-request                                        │
│   • POST /project-hub/deny-request                                           │
│   • POST /project-hub/timeline                                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Security Model

### Defense in Depth (3 Layers)

```
┌─────────────────────────────────────────────────────────────────┐
│ Layer 1: CONTEXT ENFORCEMENT                                    │
│ ─────────────────────────────────────────────────────────────── │
│ • requireContext() guard on EVERY tool                          │
│ • Customers cannot call tenant tools                            │
│ • Tenants cannot call customer tools                            │
│ • Context set by backend, NOT user input                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Layer 2: TRUST TIER ENFORCEMENT                                 │
│ ─────────────────────────────────────────────────────────────── │
│ • T1 (Auto): Read operations, prep info, timeline               │
│ • T2 (Soft Confirm): Minor adjustments, add-ons                 │
│ • T3 (Hard Confirm): Cancellations, refunds                     │
│   └─> Requires confirmationReceived: true parameter             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Layer 3: OWNERSHIP VERIFICATION                                 │
│ ─────────────────────────────────────────────────────────────── │
│ • Backend verifies tenant owns project/request                  │
│ • Customer tools verify session.projectId matches               │
│ • Prevents IDOR (Insecure Direct Object Reference)              │
└─────────────────────────────────────────────────────────────────┘
```

### Context Enforcement Implementation

Every tool has a guard as its **FIRST LINE**:

```typescript
const getProjectStatus = new FunctionTool({
  name: 'get_project_status',
  // ...
  execute: async (params, ctx) => {
    // P1 Security: Context guard - customer tools only
    const contextError = requireContext(ctx, 'customer');
    if (contextError) return contextError;

    // P1 Security: Ownership verification
    const session = getContextFromSession(ctx!);
    if (session.projectId && projectId !== session.projectId) {
      return { error: 'Unauthorized: Project does not match your session' };
    }

    // ... tool logic
  },
});
```

### Four-Tier Tenant ID Extraction

The `getTenantId()` function extracts tenant context with multiple fallbacks:

```typescript
function getTenantId(context: ToolContext | undefined): string | null {
  // Tier 1: Map-like API (direct ADK)
  const fromState = context.state?.get<string>('tenantId');
  if (fromState) return fromState;

  // Tier 2: Plain object access (A2A protocol)
  const stateObj = context.state as unknown as Record<string, unknown>;
  if (stateObj?.tenantId) return stateObj.tenantId as string;

  // Tier 3 & 4: Extract from userId (format: "tenantId:userId" or just tenantId)
  const userId = context.invocationContext?.session?.userId;
  if (userId?.includes(':')) return userId.split(':')[0];
  return userId || null;
}
```

### T3 Confirmation for High-Risk Actions

Cancellations and refunds require explicit customer confirmation:

```typescript
const T3_REQUEST_TYPES = ['CANCELLATION', 'REFUND'] as const;

// In submit_request tool:
if (T3_REQUEST_TYPES.includes(requestType) && !confirmationReceived) {
  return {
    requiresConfirmation: true,
    confirmationType: 'T3_HIGH_RISK',
    message: `Please confirm with the customer: "Are you sure you want to ${action}?"`,
    nextStep: `Call this tool again with confirmationReceived: true`,
  };
}
```

---

## Context Switching Flow

### Customer Session Initialization

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Customer   │     │   Frontend   │     │   Backend    │     │   Agent      │
│   Browser    │     │  (Next.js)   │     │  (Express)   │     │ (Cloud Run)  │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
       │                    │                    │                    │
       │ Open Project Hub   │                    │                    │
       │───────────────────>│                    │                    │
       │                    │                    │                    │
       │                    │ POST /projects/:id/chat/session        │
       │                    │───────────────────>│                    │
       │                    │                    │                    │
       │                    │                    │ Create A2A session │
       │                    │                    │ state = {          │
       │                    │                    │   contextType:     │
       │                    │                    │     'customer',    │
       │                    │                    │   tenantId,        │
       │                    │                    │   customerId,      │
       │                    │                    │   projectId        │
       │                    │                    │ }                  │
       │                    │                    │───────────────────>│
       │                    │                    │                    │
       │                    │                    │     bootstrap_     │
       │                    │                    │     project_hub_   │
       │                    │                    │     session()      │
       │                    │                    │<───────────────────│
       │                    │                    │                    │
       │                    │ { sessionId,       │                    │
       │                    │   greeting }       │                    │
       │                    │<───────────────────│                    │
       │                    │                    │                    │
       │ Display greeting   │                    │                    │
       │<───────────────────│                    │                    │
```

### Tenant Session Initialization

Same flow, but backend sets `contextType: 'tenant'` and does NOT include `projectId` or `customerId` in the session state.

---

## Tool Inventory

### Customer-Only Tools (5)

| Tool                   | Purpose                           | Trust Tier |
| ---------------------- | --------------------------------- | ---------- |
| `get_project_status`   | View booking status and details   | T1 (Auto)  |
| `get_prep_checklist`   | Get preparation checklist         | T1 (Auto)  |
| `answer_prep_question` | Answer preparation questions      | T1 (Auto)  |
| `submit_request`       | Submit requests (reschedule, etc) | T2/T3      |
| `get_timeline`         | View project event timeline       | T1 (Auto)  |

### Tenant-Only Tools (6)

| Tool                       | Purpose                         | Trust Tier |
| -------------------------- | ------------------------------- | ---------- |
| `get_pending_requests`     | View requests needing attention | T1 (Auto)  |
| `get_customer_activity`    | View customer activity summary  | T1 (Auto)  |
| `approve_request`          | Approve a customer request      | T2 (Soft)  |
| `deny_request`             | Deny a customer request         | T2 (Soft)  |
| `send_message_to_customer` | Send message to customer        | T2 (Soft)  |
| `update_project_status`    | Update project status           | T2 (Soft)  |

### Shared Tools (1)

| Tool                            | Purpose                    | Trust Tier |
| ------------------------------- | -------------------------- | ---------- |
| `bootstrap_project_hub_session` | Initialize session context | T1 (Auto)  |

---

## Mediation Logic

The agent automatically classifies customer requests:

```
Customer Message
      │
      ▼
┌─────────────────────────────────────────────────────┐
│ Check for escalation keywords                       │
│ (refund, complaint, lawyer, legal, cancel, sue)     │
└─────────────────────────────────────────────────────┘
      │
      │ Contains keyword?
      │
      ├─────Yes──────> ESCALATE TO TENANT (High urgency)
      │
      │ No
      ▼
┌─────────────────────────────────────────────────────┐
│ Analyze confidence score from answer_prep_question  │
└─────────────────────────────────────────────────────┘
      │
      │ confidence >= 80%?
      │
      ├─────Yes──────> AUTO-HANDLE (T1)
      │
      │ confidence >= 50%?
      │
      ├─────Yes──────> HANDLE + FLAG FOR TENANT (T2)
      │
      │ confidence < 50%
      ▼
      ESCALATE TO TENANT (Low confidence)
```

---

## Deployment Configuration

### Cloud Run Settings

```yaml
service: project-hub-agent
region: us-central1
project: handled-484216
revision: project-hub-agent-00003-2tj

resources:
  cpu: 1
  memory: 512Mi

scaling:
  minInstances: 0
  maxInstances: 10
  targetConcurrency: 80

environment:
  MAIS_API_URL: https://api.gethandled.ai
  INTERNAL_API_SECRET: (from Secret Manager)
  AGENT_API_PATH: /v1/internal/agent
```

### LLM Configuration

```typescript
const LLM_CONFIG = {
  TEMPERATURE: 0.4, // Consistent, professional responses
  MAX_OUTPUT_TOKENS: 2048, // Sufficient for detailed responses
};

const agent = new LlmAgent({
  model: 'gemini-2.0-flash',
  generateContentConfig: {
    temperature: LLM_CONFIG.TEMPERATURE,
    maxOutputTokens: LLM_CONFIG.MAX_OUTPUT_TOKENS,
  },
});
```

### Timeout Configuration

```typescript
const TIMEOUTS = {
  BACKEND_API: 15_000, // 15s for backend calls
};
```

---

## Operational Considerations

### Why Single Agent (Not Split)

| Concern               | Single Agent Solution          | Split Agent Problem        |
| --------------------- | ------------------------------ | -------------------------- |
| Security              | `requireContext()` guards      | Same verification needed   |
| Shared context        | Tenant sees customer questions | Requires A2A state sync    |
| Deployment complexity | 1 service to deploy/monitor    | 2 services, 2x maintenance |
| Latency               | Direct tool calls              | A2A network overhead       |
| Debugging             | Single log stream              | Distributed tracing needed |
| Cost                  | 1 Cloud Run instance           | 2 instances at minimum     |

**Decision:** See [ADR-019: Single Agent Dual-Context Pattern](../adrs/ADR-019-single-agent-dual-context-pattern.md)

### Monitoring

Key metrics to track:

- **Context violations** (should be 0)
- **T3 bypasses** (should be 0)
- **Tool latency** (p50, p95)
- **Backend API errors**
- **Session creation rate**

### Rate Limiting

Applied at multiple levels:

1. **Per-tenant:** 30 messages/minute via `agentChatLimiter`
2. **Per-session:** 10 messages/minute via `agentSessionLimiter`
3. **Backend API:** Tenant-scoped rate limits on all internal endpoints

---

## Related Documentation

- [ADR-019: Single Agent Dual-Context Pattern](../adrs/ADR-019-single-agent-dual-context-pattern.md)
- [ADR-018: Hub-and-Spoke Agent Architecture](../adrs/ADR-018-hub-and-spoke-agent-architecture.md)
- [Phase 1 Deployment Report](../deployment/PROJECT_HUB_PHASE_1_DEPLOYMENT_REPORT.md)
- [Dual Context Tool Isolation Prevention](../solutions/patterns/DUAL_CONTEXT_AGENT_TOOL_ISOLATION_PREVENTION.md)
- [A2A Session State Prevention](../solutions/patterns/A2A_SESSION_STATE_PREVENTION.md)

---

## Code References

| Component              | Location                                                |
| ---------------------- | ------------------------------------------------------- |
| Agent definition       | `server/src/agent-v2/deploy/project-hub/src/agent.ts`   |
| Backend routes         | `server/src/routes/internal-agent.routes.ts`            |
| Project Hub service    | `server/src/services/project-hub.service.ts`            |
| Chat widget (customer) | `apps/web/src/components/chat/ProjectHubChatWidget.tsx` |
| Rate limiters          | `server/src/middleware/rateLimiter.ts`                  |
| Deploy script          | `server/src/agent-v2/deploy/project-hub/package.json`   |

---

## Version History

| Date       | Author          | Changes                                    |
| ---------- | --------------- | ------------------------------------------ |
| 2026-01-24 | Claude Opus 4.5 | Initial Phase 2 architecture documentation |
