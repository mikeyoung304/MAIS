# ADK Agent Development Quick Reference Card

**Date:** 2026-01-19
**Scope:** Google ADK agents deployed to Cloud Run
**Audience:** Engineers building new agents or modifying existing ones

---

## Pre-Flight Checklist

Before writing ANY agent code:

- [ ] Read `plans/VERTEX-AI-EXECUTION-PLAN.md` for current phase
- [ ] Read `docs/solutions/VERTEX-AI-PLAN-RETROSPECTIVE.md` for lessons learned
- [ ] Check `server/src/agent-v2/deploy/SERVICE_REGISTRY.md` for existing agents
- [ ] Review `server/src/agent-v2/deploy/ZOD_LIMITATIONS.md` for ADK constraints

---

## The 10 Commandments of ADK Agents

### 1. Use the 4-Tier getTenantId Pattern

```typescript
// CORRECT - Handles all context types (direct calls AND A2A protocol)
function getTenantId(context: ToolContext | undefined): string | null {
  if (!context) return null;

  // Try 1: Map-like state.get() (direct agent calls)
  try {
    const fromState = context.state?.get<string>('tenantId');
    if (fromState) return fromState;
  } catch {}

  // Try 2: Plain object state (A2A protocol)
  try {
    const stateObj = context.state as unknown as Record<string, unknown>;
    if (stateObj && 'tenantId' in stateObj && typeof stateObj.tenantId === 'string') {
      return stateObj.tenantId;
    }
  } catch {}

  // Try 3: Extract from userId (format: "tenantId:userId")
  const userId = context.invocationContext?.session?.userId;
  if (userId) {
    return userId.includes(':') ? userId.split(':')[0] : userId;
  }

  return null;
}

// WRONG - Only works for direct calls, breaks A2A
function getTenantId(context: ToolContext | undefined): string | null {
  return context?.state?.get<string>('tenantId') ?? null;
}
```

### 2. Fail Fast on Missing Environment Variables

```typescript
// CORRECT - Fails at startup with clear error
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const MAIS_API_URL = requireEnv('MAIS_API_URL');
const INTERNAL_API_SECRET = requireEnv('INTERNAL_API_SECRET');

// WRONG - Silently uses empty string, causes confusing auth failures
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || '';
```

### 3. Always Use Timeouts on Network Calls

```typescript
// CORRECT - Timeout prevents infinite hangs
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

// Recommended timeouts:
const TIMEOUTS = {
  backendApi: 15_000, // 15s for MAIS backend
  specialistAgent: 30_000, // 30s for Marketing/Storefront
  researchAgent: 90_000, // 90s for web scraping
  metadataService: 5_000, // 5s for GCP metadata
};

// WRONG - Will hang indefinitely if service is down
const response = await fetch(url, options);
```

### 4. T3 Actions MUST Have Confirmation Parameters

```typescript
// CORRECT - Programmatic enforcement of confirmation
const publishDraftTool = new FunctionTool({
  name: 'publish_draft',
  description: 'Publish draft to live. T3 ACTION - requires confirmation.',
  parameters: z.object({
    confirmationReceived: z.boolean().describe('Set to true ONLY after user explicitly confirmed'),
  }),
  execute: async (params, context) => {
    if (!params.confirmationReceived) {
      return {
        status: 'pending_confirmation',
        message: 'Please confirm you want to publish to live.',
      };
    }
    // ... proceed with publish
  },
});

// WRONG - Relies on LLM to follow prompt instructions
const publishDraftTool = new FunctionTool({
  name: 'publish_draft',
  description: 'Publish draft. Only call after user confirms!', // LLM might ignore this
  parameters: z.object({}), // No enforcement!
});
```

### 5. Tools Must Return Results, Not Instructions

```typescript
// CORRECT - Tool does the work and returns result
execute: async (params, context) => {
  const result = await callMaisApi('/marketing/generate-headline', tenantId, params);
  return result.data; // { primary: "Your Story", variants: [...], rationale: "..." }
};

// WRONG - Tool returns instructions for LLM to interpret
execute: async (params, context) => {
  return {
    instruction: 'Generate 3 headlines for...', // LLM has to do the work!
    params,
  };
};
```

### 6. Call Security Functions, Don't Just Define Them

```typescript
// CORRECT - Security function is actually called
const filtered = filterPromptInjection(rawContent);
const sanitized = sanitizeScrapedContent(filtered);
return { content: sanitized };

// WRONG - Function defined but never called (dead code)
function sanitizeScrapedContent(content: string): string {
  // Great security code that never runs!
}
// ... nowhere calls sanitizeScrapedContent()
```

### 7. No Hardcoded URLs (Especially Cloud Run URLs)

```typescript
// CORRECT - URL from environment variable
const MARKETING_AGENT_URL = requireEnv('MARKETING_AGENT_URL');

// WRONG - Hardcoded URL with project number that will change
const MARKETING_AGENT_URL =
  process.env.MARKETING_AGENT_URL || 'https://marketing-agent-506923455711.us-central1.run.app'; // BAD!
```

### 8. Use Structured Logger, Not console.log

```typescript
// CORRECT - Structured JSON logging
const logger = {
  info: (data: object, msg: string) =>
    console.log(
      JSON.stringify({
        level: 'info',
        msg,
        ...data,
        timestamp: new Date().toISOString(),
      })
    ),
  error: (data: object, msg: string) =>
    console.error(
      JSON.stringify({
        level: 'error',
        msg,
        ...data,
        timestamp: new Date().toISOString(),
      })
    ),
};

logger.info({ tenantId, tool: 'publish_draft' }, 'Publishing draft');

// WRONG - Unstructured logging
console.log(`[Agent] Publishing draft for ${tenantId}`);
```

### 9. Add TTL to Module-Level Caches

```typescript
// CORRECT - Cache with TTL and max size
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_SESSIONS = 1000;

interface CacheEntry {
  sessionId: string;
  createdAt: number;
}
const sessionCache = new Map<string, CacheEntry>();

function getSession(key: string): string | undefined {
  const entry = sessionCache.get(key);
  if (!entry) return undefined;

  if (Date.now() - entry.createdAt > SESSION_TTL_MS) {
    sessionCache.delete(key);
    return undefined;
  }
  return entry.sessionId;
}

// WRONG - Unbounded cache, memory leak risk
const sessionCache = new Map<string, string>(); // Grows forever!
```

### 10. System Prompts Only Reference Existing Capabilities

```typescript
// CORRECT - Only mention what exists
const DECISION_TREE = `
├─ Marketing Copy → MARKETING_SPECIALIST
├─ Website Changes → STOREFRONT_SPECIALIST
├─ Research → RESEARCH_SPECIALIST
`;

// WRONG - References agents that don't exist yet
const DECISION_TREE = `
├─ Media/Visuals → IMAGE_SPECIALIST  // Doesn't exist!
├─ Videos → VIDEO_SPECIALIST         // Doesn't exist!
`;
```

---

## A2A Protocol Checklist

When building agent-to-agent communication:

- [ ] State is passed as **plain object**, not Map (use 4-tier getTenantId)
- [ ] Use **camelCase** for A2A fields: `appName`, `userId`, `sessionId`, `newMessage`
- [ ] Each specialist needs its **own session** (don't reuse orchestrator session)
- [ ] Handle both response formats: `messages[]` and `content.parts[]`
- [ ] Add identity token auth for Cloud Run (metadata service)

---

## Zod Limitations in ADK

ADK doesn't support these Zod types (see `ZOD_LIMITATIONS.md`):

| Unsupported        | Workaround                         |
| ------------------ | ---------------------------------- |
| `z.record()`       | Use `z.any()` with `.describe()`   |
| `z.tuple()`        | Use `z.array()` with `.describe()` |
| `z.intersection()` | Flatten to single object           |
| `z.lazy()`         | Avoid recursive types              |

When using `z.any()`, add runtime validation in the tool handler.

---

## Code Review Checklist

Before submitting agent code for review:

- [ ] `getTenantId` uses 4-tier pattern
- [ ] All env vars use `requireEnv()` (fail-fast)
- [ ] All fetch calls use `fetchWithTimeout()`
- [ ] All T3 actions have `confirmationReceived` parameter
- [ ] Tools return results, not instructions
- [ ] Security functions are called, not just defined
- [ ] No hardcoded URLs
- [ ] Using structured logger, not console.log
- [ ] Module-level caches have TTL
- [ ] System prompt only references existing agents
- [ ] Tests cover happy path AND failure modes

---

## File Locations

| Purpose           | Location                                          |
| ----------------- | ------------------------------------------------- |
| Agent source code | `server/src/agent-v2/deploy/{agent}/src/agent.ts` |
| Service registry  | `server/src/agent-v2/deploy/SERVICE_REGISTRY.md`  |
| Zod limitations   | `server/src/agent-v2/deploy/ZOD_LIMITATIONS.md`   |
| Execution plan    | `plans/VERTEX-AI-EXECUTION-PLAN.md`               |
| Lessons learned   | `docs/solutions/VERTEX-AI-PLAN-RETROSPECTIVE.md`  |
| Backend routes    | `server/src/routes/internal-agent.routes.ts`      |

---

## Quick Debugging

| Symptom                       | Likely Cause                    | Fix                   |
| ----------------------------- | ------------------------------- | --------------------- |
| "No tenant context available" | getTenantId only uses Map.get() | Use 4-tier pattern    |
| Agent hangs indefinitely      | No timeout on fetch             | Add fetchWithTimeout  |
| "Unauthorized" errors         | Empty INTERNAL_API_SECRET       | Use requireEnv()      |
| Tool returns instructions     | Anti-pattern in execute()       | Return actual results |
| Memory growing over time      | Unbounded Map cache             | Add TTL and max size  |

---

**Related Documentation:**

- [VERTEX-AI-PLAN-RETROSPECTIVE.md](./VERTEX-AI-PLAN-RETROSPECTIVE.md) - Full lessons learned
- [ADK_A2A_PREVENTION_INDEX.md](./patterns/ADK_A2A_PREVENTION_INDEX.md) - A2A patterns
- [CLAUDE.md](../../CLAUDE.md) - Pitfalls 32-44 cover ADK/A2A issues
