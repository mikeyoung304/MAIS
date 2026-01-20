---
title: A2A Session and State Handling Prevention Strategies
category: patterns
component: agent-v2
severity: P0
tags: [google-adk, a2a, sessions, state, prevention, code-review, testing, orchestrator]
created: 2026-01-19
related:
  - ADK_A2A_PREVENTION_INDEX.md
  - ADK_A2A_ORCHESTRATOR_COMPOUND.md
  - adk-a2a-orchestrator-pattern.md
---

# A2A Session and State Handling Prevention Strategies

Prevention strategies for session management and state handling issues discovered during Concierge orchestrator debugging. These issues caused "Session not found" 404 errors and state access failures.

## Issues Addressed

| #   | Issue                             | Symptom                                  | Root Cause                                                                      |
| --- | --------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------- |
| 1   | Session ID reuse across agents    | 404 "Session not found"                  | Each agent requires its own session; orchestrator session != specialist session |
| 2   | State format assumptions          | `state.get()` returns undefined          | ADK state is Map-like API, not plain object; must use `.get()` method           |
| 3   | Missing defaults for new entities | NullPointerException-like errors         | State keys may not exist; always provide defaults                               |
| 4   | Wrong Zod schema types            | "Unsupported Zod type" errors            | `z.string()` where `z.enum()` needed (or vice versa), unsupported types         |
| 5   | Missing Cloud Run env vars        | Connection failures, hardcoded URL drift | Specialist URLs hardcoded instead of from environment                           |

---

## Issue 1: Session ID Reuse Across Agents

### Problem

The orchestrator (Concierge) has its own session with ADK. When delegating to a specialist agent (Marketing, Storefront, Research), you CANNOT reuse the orchestrator's session ID. Each agent maintains its own session store.

```
WRONG Flow:
Backend → Concierge (session: abc123)
         → Marketing (session: abc123)  ← 404! Marketing doesn't have this session

CORRECT Flow:
Backend → Concierge (session: abc123)
         → Marketing (session: xyz789)  ← Marketing's OWN session
```

### The Fix

Each specialist agent must have its own session, created via the specialist's `/apps/{appName}/users/{userId}/sessions` endpoint.

```typescript
// WRONG - Reusing parent session
const result = await callSpecialistAgent(
  SPECIALIST_URLS.marketing,
  'marketing_specialist',
  message,
  tenantId,
  orchestratorSessionId // This won't work!
);

// CORRECT - Create session per specialist
async function getOrCreateSpecialistSession(
  agentUrl: string,
  agentName: string,
  tenantId: string
): Promise<string | null> {
  const cacheKey = `${agentUrl}:${tenantId}`;

  // Check cache first
  const cached = specialistSessions.get(cacheKey);
  if (cached) return cached;

  // Create NEW session on the specialist
  const response = await fetch(
    `${agentUrl}/apps/${agentName}/users/${encodeURIComponent(tenantId)}/sessions`,
    {
      method: 'POST',
      headers: await getAuthHeaders(agentUrl),
      body: JSON.stringify({ state: { tenantId } }),
    }
  );

  const { id } = await response.json();
  specialistSessions.set(cacheKey, id);
  return id;
}
```

### Prevention Checklist

- [ ] Orchestrator creates its own session for backend communication
- [ ] Each specialist agent has separate session creation logic
- [ ] Session cache uses `${agentUrl}:${tenantId}` as key (not just tenantId)
- [ ] Session retry logic clears cache on 404 and creates fresh session
- [ ] Never pass orchestrator sessionId to `callSpecialistAgent`

### Test Case

```typescript
// server/src/agent-v2/__tests__/session-isolation.test.ts
describe('Session Isolation', () => {
  it('should create separate sessions per specialist', async () => {
    const tenantId = 'test-tenant';

    // Call multiple specialists
    const marketingSession = await getOrCreateSpecialistSession(
      SPECIALIST_URLS.marketing,
      'marketing_specialist',
      tenantId
    );
    const storefrontSession = await getOrCreateSpecialistSession(
      SPECIALIST_URLS.storefront,
      'storefront_specialist',
      tenantId
    );

    // Sessions must be different
    expect(marketingSession).not.toBe(storefrontSession);

    // Both should be valid UUIDs
    expect(marketingSession).toMatch(/^[a-f0-9-]{36}$/i);
    expect(storefrontSession).toMatch(/^[a-f0-9-]{36}$/i);
  });

  it('should retry with new session on 404', async () => {
    const tenantId = 'test-tenant';

    // Pre-populate cache with invalid session
    specialistSessions.set(`${MARKETING_URL}:${tenantId}`, 'expired-session');

    // Call should detect 404, clear cache, create new session, and succeed
    const result = await callSpecialistAgent(
      MARKETING_URL,
      'marketing_specialist',
      'Hello',
      tenantId,
      'unused'
    );

    // Should have created a new session
    const newSession = specialistSessions.get(`${MARKETING_URL}:${tenantId}`);
    expect(newSession).not.toBe('expired-session');
    expect(result.ok).toBe(true);
  });
});
```

---

## Issue 2: State Format Assumptions (Map vs Object)

### Problem

ADK's `ToolContext.state` uses a Map-like API, not a plain JavaScript object. Accessing state with dot notation or bracket notation fails silently.

```typescript
// WRONG - Treating state as plain object
const tenantId = context.state.tenantId; // undefined!
const tenantId = context.state['tenantId']; // undefined!

// CORRECT - Using Map-like API
const tenantId = context.state?.get<string>('tenantId');
```

### The Fix

Always use the `.get()` method with type parameter for state access.

```typescript
function getTenantId(context: ToolContext | undefined): string | null {
  if (!context) return null;

  // Method 1: Get from session state (preferred)
  const fromState = context.state?.get<string>('tenantId');
  if (fromState) return fromState;

  // Method 2: Extract from userId (format: "tenantId:userId")
  const userId = context.invocationContext?.session?.userId;
  if (userId && userId.includes(':')) {
    const [tenantId] = userId.split(':');
    if (tenantId) {
      console.log(`[Agent] Extracted tenantId from userId: ${tenantId}`);
      return tenantId;
    }
  }

  return null;
}
```

### Prevention Checklist

- [ ] All `context.state` access uses `.get<T>('key')` pattern
- [ ] Type parameter provided for type safety: `.get<string>('tenantId')`
- [ ] Null check on context before accessing state: `context?.state?.get()`
- [ ] Fallback mechanism for when state is unavailable
- [ ] No direct property access: `context.state.key` (will fail)

### Test Case

```typescript
// server/src/agent-v2/__tests__/state-access.test.ts
describe('State Access Pattern', () => {
  it('should access state via get() method', () => {
    // Mock ADK state (Map-like)
    const mockState = new Map<string, unknown>();
    mockState.set('tenantId', 'tenant-123');
    mockState.set('userId', 'user-456');

    const context = {
      state: {
        get: <T>(key: string): T | undefined => mockState.get(key) as T,
      },
    } as ToolContext;

    // Correct access
    expect(context.state?.get<string>('tenantId')).toBe('tenant-123');
    expect(context.state?.get<string>('userId')).toBe('user-456');
    expect(context.state?.get<string>('missing')).toBeUndefined();
  });

  it('should handle missing state gracefully', () => {
    const context = { state: undefined } as ToolContext;

    // Should not throw
    const tenantId = getTenantId(context);
    expect(tenantId).toBeNull();
  });

  it('should extract tenantId from userId fallback', () => {
    const context = {
      state: { get: () => undefined },
      invocationContext: {
        session: { userId: 'tenant-123:user-456' },
      },
    } as unknown as ToolContext;

    const tenantId = getTenantId(context);
    expect(tenantId).toBe('tenant-123');
  });
});
```

### Static Analysis Rule

Add to ESLint config if possible:

```javascript
// Warn on direct state property access
{
  "rules": {
    "no-restricted-syntax": [
      "warn",
      {
        "selector": "MemberExpression[object.property.name='state'][property.name!='get']",
        "message": "Use context.state.get('key') instead of direct property access"
      }
    ]
  }
}
```

---

## Issue 3: Missing Defaults for New Entities

### Problem

When accessing state or API responses, new fields may not exist. Code assumes fields are always present and crashes.

```typescript
// WRONG - No defaults
const subscriptionTier = context.state.get('subscriptionTier');
if (subscriptionTier === 'pro') { ... }  // Fails if undefined

// CORRECT - With defaults
const subscriptionTier = context.state?.get<string>('subscriptionTier') ?? 'free';
```

### The Fix

Always provide defaults for optional state values and validate presence of required values.

```typescript
// Pattern 1: Nullish coalescing for optional values
const subscriptionTier = context.state?.get<string>('subscriptionTier') ?? 'free';
const messageCount = context.state?.get<number>('messageCount') ?? 0;

// Pattern 2: Type guard for required values
function requireTenantId(context: ToolContext): string {
  const tenantId = getTenantId(context);
  if (!tenantId) {
    throw new Error('tenantId is required but not found in context');
  }
  return tenantId;
}

// Pattern 3: Default object structure
interface AgentState {
  tenantId: string;
  userId?: string;
  subscriptionTier: 'free' | 'pro' | 'enterprise';
  messageCount: number;
  lastMessageAt?: string;
}

const DEFAULT_STATE: Partial<AgentState> = {
  subscriptionTier: 'free',
  messageCount: 0,
};

function getAgentState(context: ToolContext): Partial<AgentState> {
  return {
    ...DEFAULT_STATE,
    tenantId: context.state?.get<string>('tenantId') || '',
    userId: context.state?.get<string>('userId'),
    subscriptionTier:
      context.state?.get<AgentState['subscriptionTier']>('subscriptionTier') ?? 'free',
    messageCount: context.state?.get<number>('messageCount') ?? 0,
    lastMessageAt: context.state?.get<string>('lastMessageAt'),
  };
}
```

### Prevention Checklist

- [ ] All state access has `?? defaultValue` or null check
- [ ] Required values use explicit validation with clear error messages
- [ ] New features add defaults for backward compatibility
- [ ] TypeScript types mark optional fields with `?`
- [ ] Tests cover missing/undefined state scenarios

### Test Case

```typescript
// server/src/agent-v2/__tests__/state-defaults.test.ts
describe('State Defaults', () => {
  it('should provide defaults for missing optional values', () => {
    const emptyState = new Map<string, unknown>();
    const context = {
      state: { get: <T>(key: string): T | undefined => emptyState.get(key) as T },
    } as ToolContext;

    const agentState = getAgentState(context);

    expect(agentState.subscriptionTier).toBe('free');
    expect(agentState.messageCount).toBe(0);
    expect(agentState.lastMessageAt).toBeUndefined();
  });

  it('should override defaults with actual values', () => {
    const state = new Map<string, unknown>([
      ['tenantId', 'tenant-123'],
      ['subscriptionTier', 'pro'],
      ['messageCount', 42],
    ]);
    const context = {
      state: { get: <T>(key: string): T | undefined => state.get(key) as T },
    } as ToolContext;

    const agentState = getAgentState(context);

    expect(agentState.tenantId).toBe('tenant-123');
    expect(agentState.subscriptionTier).toBe('pro');
    expect(agentState.messageCount).toBe(42);
  });

  it('should throw on missing required values', () => {
    const context = {
      state: { get: () => undefined },
      invocationContext: { session: {} },
    } as unknown as ToolContext;

    expect(() => requireTenantId(context)).toThrow('tenantId is required');
  });
});
```

---

## Issue 4: Wrong Zod Schema Types

### Problem

Using the wrong Zod type causes either:

1. Deploy failures ("Unsupported Zod type: ZodRecord")
2. Runtime validation failures (string where enum expected)
3. LLM confusion (no constraints when enum would help)

### Common Mistakes

```typescript
// MISTAKE 1: z.string() when enum needed - LLM sends invalid values
task: z.string().describe('Task type'),  // LLM might send "generate headline"
// FIX: Use enum for constrained choices
task: z.enum(['headline', 'tagline', 'description', 'refine']),

// MISTAKE 2: z.enum() when string needed - Validation fails on valid input
customPrompt: z.enum(['prompt1', 'prompt2']),  // Rejects "write better copy"
// FIX: Use string for free-form input
customPrompt: z.string().describe('Custom prompt from user'),

// MISTAKE 3: Unsupported types
metadata: z.record(z.string()),  // ADK doesn't support z.record()
coords: z.tuple([z.number(), z.number()]),  // ADK doesn't support z.tuple()
// FIX: Use z.any() with description
metadata: z.any().describe('Key-value metadata object { key: value }'),
coords: z.array(z.number()).length(2).describe('Coordinates as [x, y]'),
```

### The Fix

Decision tree for Zod type selection:

```
Is the value one of a FIXED set of choices?
├─ YES → z.enum(['option1', 'option2', ...])
└─ NO → Continue...

Is it free-form text?
├─ YES → z.string().describe('What this should contain')
└─ NO → Continue...

Is it a complex object/map?
├─ YES, with known structure → z.object({ key: z.type() })
└─ YES, with dynamic keys → z.any().describe('Structure: { key: value }')

Is it a number?
├─ YES, with constraints → z.number().min(0).max(100)
└─ YES, without → z.number()
```

### Prevention Checklist

- [ ] Constrained choices use `z.enum([...])` not `z.string()`
- [ ] Free-form text uses `z.string()` not `z.enum()`
- [ ] No `z.record()`, `z.tuple()`, `z.intersection()`, `z.lazy()` in tool schemas
- [ ] Dynamic objects use `z.any().describe('Expected structure')`
- [ ] All parameters have `.describe()` for LLM guidance
- [ ] Test schema validation with expected inputs before deploy

### Test Case

```typescript
// server/src/agent-v2/__tests__/zod-schema-validation.test.ts
import { DelegateToMarketingParams, DelegateToStorefrontParams } from '../concierge/src/agent';

describe('Zod Schema Validation', () => {
  describe('DelegateToMarketingParams', () => {
    it('should accept valid enum values for tone', () => {
      const valid = {
        task: 'headline',
        context: 'homepage hero',
        tone: 'professional',
      };

      expect(() => DelegateToMarketingParams.parse(valid)).not.toThrow();
    });

    it('should reject invalid enum values', () => {
      const invalid = {
        task: 'headline',
        context: 'homepage hero',
        tone: 'exciting', // Not in enum
      };

      expect(() => DelegateToMarketingParams.parse(invalid)).toThrow();
    });

    it('should accept free-form task string', () => {
      const valid = {
        task: 'write 3 alternative headlines for the hero section',
        context: 'homepage',
        tone: 'warm',
      };

      expect(() => DelegateToMarketingParams.parse(valid)).not.toThrow();
    });
  });

  describe('No unsupported Zod types', () => {
    it('should not use z.record() in any schema', async () => {
      const fs = await import('fs/promises');
      const agentFiles = [
        'concierge/src/agent.ts',
        'marketing/src/agent.ts',
        'storefront/src/agent.ts',
      ];

      for (const file of agentFiles) {
        const content = await fs.readFile(`server/src/agent-v2/deploy/${file}`, 'utf-8');
        expect(content).not.toMatch(/z\.record\(/);
        expect(content).not.toMatch(/z\.tuple\(/);
        expect(content).not.toMatch(/z\.intersection\(/);
        expect(content).not.toMatch(/z\.lazy\(/);
      }
    });
  });
});
```

### Schema Selection Reference

| Use Case        | Correct Type       | Example                                                |
| --------------- | ------------------ | ------------------------------------------------------ |
| Task types      | `z.enum()`         | `z.enum(['headline', 'tagline'])`                      |
| Page names      | `z.enum()`         | `z.enum(['home', 'about', 'contact'])`                 |
| Tone/style      | `z.enum()`         | `z.enum(['professional', 'casual'])`                   |
| Custom text     | `z.string()`       | `z.string().describe('User feedback')`                 |
| URLs            | `z.string().url()` | `z.string().url().describe('Competitor URL')`          |
| Counts          | `z.number().int()` | `z.number().int().min(1).max(10)`                      |
| Dynamic objects | `z.any()`          | `z.any().describe('Content updates { field: value }')` |
| Flags           | `z.boolean()`      | `z.boolean().default(false)`                           |

---

## Issue 5: Missing Cloud Run Env Vars

### Problem

Cloud Run service URLs contain project numbers and region identifiers that:

1. Change between environments (dev vs prod)
2. Break when hardcoded across deployments
3. Cause connection failures if undefined

### The Fix

Always use environment variables with documented fallbacks.

```typescript
// WRONG - Hardcoded URL
const MARKETING_URL = 'https://marketing-agent-506923455711.us-central1.run.app';

// CORRECT - Environment variable with fallback
const SPECIALIST_URLS = {
  marketing:
    process.env.MARKETING_AGENT_URL || 'https://marketing-agent-506923455711.us-central1.run.app',
  storefront:
    process.env.STOREFRONT_AGENT_URL || 'https://storefront-agent-506923455711.us-central1.run.app',
  research:
    process.env.RESEARCH_AGENT_URL || 'https://research-agent-506923455711.us-central1.run.app',
};

// Validate at startup
function validateEnvironment(): void {
  const required = ['MAIS_API_URL', 'INTERNAL_API_SECRET'];
  const optional = ['MARKETING_AGENT_URL', 'STOREFRONT_AGENT_URL', 'RESEARCH_AGENT_URL'];

  const missing = required.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }

  const usingFallbacks = optional.filter((v) => !process.env[v]);
  if (usingFallbacks.length > 0) {
    console.warn(`[Startup] Using fallback URLs for: ${usingFallbacks.join(', ')}`);
  }
}
```

### Cloud Run Deployment Checklist

Add to `cloudbuild.yaml` or deployment script:

```yaml
# cloudbuild.yaml - Concierge agent
steps:
  - name: 'gcr.io/cloud-builders/gcloud'
    entrypoint: 'bash'
    args:
      - '-c'
      - |
        gcloud run deploy concierge-agent \
          --source . \
          --region us-central1 \
          --set-env-vars "MAIS_API_URL=$$MAIS_API_URL" \
          --set-env-vars "INTERNAL_API_SECRET=$$INTERNAL_API_SECRET" \
          --set-env-vars "MARKETING_AGENT_URL=$$(gcloud run services describe marketing-agent --region us-central1 --format 'value(status.url)')" \
          --set-env-vars "STOREFRONT_AGENT_URL=$$(gcloud run services describe storefront-agent --region us-central1 --format 'value(status.url)')" \
          --set-env-vars "RESEARCH_AGENT_URL=$$(gcloud run services describe research-agent --region us-central1 --format 'value(status.url)')"
```

### Prevention Checklist

- [ ] All agent URLs come from `process.env.*_AGENT_URL`
- [ ] Fallback URLs are documented with comments (for reference, not production use)
- [ ] Startup validates required environment variables
- [ ] Deployment scripts dynamically discover service URLs
- [ ] `SERVICE_REGISTRY.md` documents all agent URLs and their env var names

### Test Case

```typescript
// server/src/agent-v2/__tests__/env-config.test.ts
describe('Environment Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should use env vars when available', () => {
    process.env.MARKETING_AGENT_URL = 'https://custom-marketing.example.com';

    // Re-import to pick up new env
    jest.resetModules();
    const { SPECIALIST_URLS } = require('../concierge/src/agent');

    expect(SPECIALIST_URLS.marketing).toBe('https://custom-marketing.example.com');
  });

  it('should use fallback when env var missing', () => {
    delete process.env.MARKETING_AGENT_URL;

    jest.resetModules();
    const { SPECIALIST_URLS } = require('../concierge/src/agent');

    expect(SPECIALIST_URLS.marketing).toContain('us-central1.run.app');
  });

  it('should fail fast on missing required vars', () => {
    delete process.env.MAIS_API_URL;
    delete process.env.INTERNAL_API_SECRET;

    expect(() => validateEnvironment()).toThrow('Missing required env vars');
  });
});
```

### URL Discovery Script

```bash
#!/bin/bash
# server/src/agent-v2/scripts/discover-urls.sh

echo "Discovering Cloud Run service URLs..."
echo ""

SERVICES=("concierge-agent" "marketing-agent" "storefront-agent" "research-agent" "booking-agent")
REGION="us-central1"

for SERVICE in "${SERVICES[@]}"; do
  URL=$(gcloud run services describe "$SERVICE" --region="$REGION" --format='value(status.url)' 2>/dev/null)
  if [ -n "$URL" ]; then
    # Convert service name to env var format
    ENV_VAR=$(echo "$SERVICE" | tr '[:lower:]' '[:upper:]' | tr '-' '_')_URL
    echo "export ${ENV_VAR}=${URL}"
  else
    echo "# ${SERVICE} not found"
  fi
done

echo ""
echo "Add these to your .env file or Cloud Run deployment config."
```

---

## A2A Integration Checklist (Pre-Deploy)

Use this checklist before deploying any orchestrator agent:

### Session Management

- [ ] Each specialist agent has its own session creation logic
- [ ] Session cache key includes both agent URL and tenant ID
- [ ] 404 "Session not found" triggers cache clear and retry
- [ ] Session IDs are never reused across different agents
- [ ] Orchestrator's own session is separate from specialist sessions

### State Handling

- [ ] All state access uses `.get<T>('key')` pattern
- [ ] Required state values have explicit validation
- [ ] Optional state values have nullish coalescing defaults
- [ ] New fields don't break existing code (backward compatible defaults)

### Schema Validation

- [ ] Constrained choices use `z.enum()`, not `z.string()`
- [ ] Free-form input uses `z.string()`, not `z.enum()`
- [ ] No unsupported Zod types: `z.record()`, `z.tuple()`, `z.intersection()`, `z.lazy()`
- [ ] All parameters have `.describe()` for LLM guidance

### Environment Configuration

- [ ] All URLs come from environment variables
- [ ] Required env vars validated at startup
- [ ] Deployment scripts dynamically discover service URLs
- [ ] Fallback URLs are documented but not relied upon

### Error Handling

- [ ] 404 errors trigger session recreation, not immediate failure
- [ ] Retry logic exists with clear max retry count
- [ ] Failures return user-friendly messages, not stack traces
- [ ] All errors are logged with context (tenantId, sessionId, agentName)

---

## Code Review Checklist

Add to PR review template for agent changes:

```markdown
## A2A Session/State Code Review

### Sessions

- [ ] No session ID reuse: orchestrator → specialist uses separate sessions
- [ ] Session cache cleared on 404, new session created
- [ ] Session key format: `${agentUrl}:${tenantId}`

### State Access

- [ ] Uses `context.state?.get<T>('key')` pattern
- [ ] No direct property access (`context.state.key`)
- [ ] Defaults provided for optional values (`?? 'default'`)

### Schemas

- [ ] Enum types for constrained choices
- [ ] String types for free-form input
- [ ] No z.record(), z.tuple(), z.intersection(), z.lazy()
- [ ] All params have .describe()

### Environment

- [ ] URLs from `process.env.*_AGENT_URL`
- [ ] Required vars validated at startup
```

---

## Test Cases Summary

| Test File                       | What It Covers                    | Priority |
| ------------------------------- | --------------------------------- | -------- |
| `session-isolation.test.ts`     | Session per agent, 404 retry      | P0       |
| `state-access.test.ts`          | Map-like API, fallbacks           | P0       |
| `state-defaults.test.ts`        | Missing values, backward compat   | P1       |
| `zod-schema-validation.test.ts` | Enum vs string, unsupported types | P1       |
| `env-config.test.ts`            | Env vars, fallbacks, validation   | P1       |

### Running Tests

```bash
# Run all A2A tests
npm test -- --grep "A2A|Session|State"

# Run specific test file
npm test server/src/agent-v2/__tests__/session-isolation.test.ts
```

---

## Quick Reference Card

### Session Rules

```
1. Each agent = Own session store
2. Orchestrator session != Specialist session
3. Create session via: POST /apps/{appName}/users/{userId}/sessions
4. Cache key: ${agentUrl}:${tenantId}
5. On 404: Clear cache → Create new session → Retry
```

### State Access Rules

```
1. Always: context.state?.get<T>('key')
2. Never:  context.state.key or context.state['key']
3. Default: value ?? 'default'
4. Required: if (!value) throw new Error(...)
```

### Schema Rules

```
Fixed choices   → z.enum(['a', 'b', 'c'])
Free-form text  → z.string().describe('...')
Dynamic objects → z.any().describe('Structure: {...}')
FORBIDDEN       → z.record(), z.tuple(), z.intersection(), z.lazy()
```

### Environment Rules

```
1. URL = process.env.AGENT_URL || 'fallback'
2. Validate required vars at startup
3. Log warnings for missing optional vars
4. Discover URLs: gcloud run services describe --format 'value(status.url)'
```

---

## Related Documentation

- [ADK A2A Prevention Index](./ADK_A2A_PREVENTION_INDEX.md) - Full prevention strategies
- [ADK A2A Orchestrator Compound](./ADK_A2A_ORCHESTRATOR_COMPOUND.md) - Debugging history
- [A2A Orchestrator Pattern](../../server/docs/solutions/patterns/adk-a2a-orchestrator-pattern.md) - Architecture
- [Service Registry](../../server/src/agent-v2/deploy/SERVICE_REGISTRY.md) - Agent URLs and names
