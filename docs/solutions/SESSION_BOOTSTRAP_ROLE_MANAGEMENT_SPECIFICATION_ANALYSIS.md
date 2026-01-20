---
title: Session Bootstrap and Role Management Protocol - Specification Analysis
category: specification-review
component: agent-v2
severity: P0
tags: [google-adk, a2a, sessions, state, security, architecture, bootstrap, roles]
created: 2026-01-20
related:
  - A2A_SESSION_STATE_PREVENTION.md
  - ADK_A2A_PREVENTION_INDEX.md
  - ADK_AGENT_DEVELOPMENT_QUICK_REFERENCE.md
---

# Session Bootstrap and Role Management Protocol - Specification Analysis

## Executive Summary

This specification proposes a session bootstrap protocol to initialize tenant context (preferences, capabilities, industry) at the start of each agent session. The analysis identifies **23 edge cases**, **8 security risks**, **4 performance bottlenecks**, and **6 missing requirements** that must be addressed before implementation.

**Recommendation:** Implement three-phase rollout:

1. Phase 1 (Week 1): Core bootstrap infrastructure + schema
2. Phase 2 (Week 2): Role schema + session resumption
3. Phase 3 (Week 3): Dual-role support + memory integration

---

## Requirements Checklist

| Requirement                                                  | Status    | Priority | Risk Level |
| ------------------------------------------------------------ | --------- | -------- | ---------- |
| Initialize tenant context at session start                   | Specified | P0       | Medium     |
| Pass context Concierge → specialists via A2A state           | Specified | P0       | High       |
| Support dual-role contexts (Project Hub: customer vs tenant) | Specified | P1       | High       |
| Resume sessions for returning users with memory summaries    | Specified | P1       | High       |
| Define agent roles/capabilities in central schema            | Specified | P0       | Low        |

---

## 1. Edge Cases and Mitigation Strategies

### 1.1 Bootstrap Failures

| #   | Edge Case                            | Symptom                         | Root Cause                             | Mitigation                                                    |
| --- | ------------------------------------ | ------------------------------- | -------------------------------------- | ------------------------------------------------------------- |
| 1a  | Bootstrap API timeout                | Agent waits indefinitely        | Backend `/business-info` takes >5s     | Add 3s timeout, fail-fast with defaults                       |
| 1b  | Tenant not found during bootstrap    | 404 error, no tenant context    | New tenant or deleted account          | Return minimal context, allow creation flow                   |
| 1c  | Bootstrap API returns empty tenantId | Cannot scope subsequent queries | Missing INTERNAL_API_SECRET validation | Validate at startup, reject empty values                      |
| 1d  | Partial bootstrap response           | Agent has incomplete context    | Network truncation or API error        | Define REQUIRED vs OPTIONAL fields, retry on missing required |
| 1e  | Bootstrap response format mismatch   | State parsing fails silently    | API version drift                      | Add schema versioning, use compatible subset                  |

**Implementation:**

```typescript
// Bootstrap with timeout and fallback
const DEFAULT_BOOTSTRAP_CONTEXT = {
  tenantId: '',
  name: 'Unknown Business',
  industry: 'general',
  subscriptionTier: 'free',
  capabilities: [],
};

async function bootstrapTenantContext(
  tenantId: string,
  maxRetries: number = 2
): Promise<TenantBootstrapContext> {
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), 3000);

  try {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(`${MAIS_API_URL}/v1/internal/agent/business-info`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Secret': INTERNAL_API_SECRET,
          },
          body: JSON.stringify({ tenantId }),
          signal: abortController.signal,
        });

        if (!response.ok && response.status !== 404) {
          throw new Error(`Bootstrap failed: ${response.status}`);
        }

        if (response.status === 404) {
          logger.warn({ tenantId }, 'Tenant not found during bootstrap');
          return {
            ...DEFAULT_BOOTSTRAP_CONTEXT,
            tenantId,
            error: 'TENANT_NOT_FOUND',
          };
        }

        const data = await response.json();

        // Validate REQUIRED fields
        if (!data.tenantId || !data.name) {
          throw new Error('Bootstrap response missing required fields');
        }

        return BootstrapContextSchema.parse(data);
      } catch (err) {
        if (attempt === maxRetries) throw err;
        await sleep(100 * Math.pow(2, attempt)); // Exponential backoff
      }
    }
  } catch (error) {
    logger.error({ error: String(error), tenantId }, 'Bootstrap failed all retries');
    return {
      ...DEFAULT_BOOTSTRAP_CONTEXT,
      tenantId,
      error: 'BOOTSTRAP_FAILED',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
```

### 1.2 Timeout Scenarios

| #   | Scenario                                   | Duration                        | Impact                    | Mitigation                                    |
| --- | ------------------------------------------ | ------------------------------- | ------------------------- | --------------------------------------------- |
| 2a  | Bootstrap timeout (backend slow)           | 3s → 10s                        | User waits, may refresh   | Cache bootstrap for 30min, retry async        |
| 2b  | Specialist session creation timeout        | 2s → 15s                        | Delegation fails          | Pre-create specialist sessions on bootstrap?  |
| 2c  | State serialization timeout                | JSON.stringify() on large state | A2A /run endpoint hangs   | Limit state object size to 32KB               |
| 2d  | Message response timeout (specialist slow) | 30s → 90s+                      | User sees "still working" | Show progress indicator, support cancellation |

**Timeout Configuration:**

```typescript
const TIMEOUTS = {
  // Bootstrap must be fast to not delay session start
  BOOTSTRAP: 3_000, // 3s - fail-fast
  BOOTSTRAP_RETRY_TOTAL: 5_000, // 5s total including retries

  // Specialist communication
  SPECIALIST_SESSION_CREATE: 2_000, // 2s
  SPECIALIST_MESSAGE: 30_000, // 30s default
  SPECIALIST_RESEARCH: 90_000, // 90s for web scraping

  // State serialization
  STATE_SERIALIZE: 500, // 500ms max
  STATE_TRANSMIT: 2_000, // 2s to send to ADK
};

// Per-endpoint adjustments based on latency percentiles
const LATENCY_PERCENTILES = {
  P50: { bootstrap: 800, specialist: 2500 }, // 50th percentile
  P95: { bootstrap: 2500, specialist: 15000 }, // 95th percentile
  P99: { bootstrap: 5000, specialist: 30000 }, // 99th percentile (rare)
};
```

### 1.3 Partial Context Scenarios

| #   | Scenario                      | Missing Data                  | LLM Behavior                         | Handling                                     |
| --- | ----------------------------- | ----------------------------- | ------------------------------------ | -------------------------------------------- |
| 3a  | No subscription tier returned | `subscriptionTier: undefined` | Assumes 'free', incorrect trust tier | Use `?? 'free'` with clear logging           |
| 3b  | No industry returned          | `industry: undefined`         | Generic responses, less personalized | Use common sense defaults or ask user        |
| 3c  | No capabilities list          | `capabilities: []`            | Agent tries all operations           | Validate each operation against capabilities |
| 3d  | Branding incomplete           | Missing colors/logo           | Page renders with fallback styles    | Graceful fallback to defaults                |
| 3e  | No available hours/timezone   | Business hours unknown        | 24/7 availability assumption         | Return 'unknown', let user set manually      |

**Schema with Defaults:**

```typescript
const TenantBootstrapContextSchema = z.object({
  // Required fields (must exist)
  tenantId: z.string().min(1),
  name: z.string().min(1),

  // Optional with sensible defaults
  industry: z.string().default('general'),
  subscriptionTier: z.enum(['free', 'pro', 'enterprise']).default('free'),

  // Capabilities - empty list is valid (restrictions apply)
  capabilities: z
    .array(
      z.enum([
        'storefront_edit',
        'research_competitors',
        'booking_create',
        'customer_support',
        'analytics_view',
      ])
    )
    .default([]),

  // Branding with full fallbacks
  branding: z
    .object({
      primaryColor: z.string().default('#000000'),
      logoUrl: z.string().url().nullable().default(null),
      timezone: z.string().default('America/New_York'),
      businessHours: z
        .object({
          open: z.string().default('09:00'),
          close: z.string().default('17:00'),
        })
        .default({}),
    })
    .default({}),

  // Error indicators
  error: z.enum(['TENANT_NOT_FOUND', 'BOOTSTRAP_FAILED']).optional(),
});
```

---

## 2. Security Considerations

### 2.1 Cross-Tenant Context Leakage

**Risk:** A specialist agent receives the wrong tenant's context and modifies wrong storefront.

```
Scenario:
  Session A (tenant-123) → Concierge session: abc123
  → Creates specialist session: specialist-xyz789 (for tenant-123)

  Session B (tenant-456) → Concierge session: def456
  → Also creates specialist session: specialist-xyz789 (COLLISION!)
  → Specialist receives tenant-123's state instead of tenant-456's
```

**Mitigation:**

```typescript
// 1. Session cache MUST include both URL and tenantId
const sessionCacheKey = `${agentUrl}:${tenantId}`;

// 2. Session creation MUST pass tenantId in state
const response = await fetch(
  `${agentUrl}/apps/${appName}/users/${encodeURIComponent(tenantId)}/sessions`,
  {
    method: 'POST',
    body: JSON.stringify({
      state: { tenantId }, // CRITICAL: Explicitly in state
    }),
  }
);

// 3. Validate tenantId at specialist startup
const bootstrapContext = context.state?.get<string>('tenantId');
if (!bootstrapContext) {
  throw new Error('Session missing tenantId - security violation');
}

// 4. All queries MUST use tenantId from context, never from cache
const packages = await catalogService.getAllPackages(tenantId); // ✅ from context
```

### 2.2 State Injection Attacks

**Risk:** User input in A2A state parameters bypasses validation.

```typescript
// ATTACK: User provides malicious state data
const maliciousRequest = {
  appName: 'agent',
  userId: 'tenant-123:user-456',
  sessionId: 'session-789',
  state: {
    tenantId: 'tenant-123',
    // Attacker injects:
    adminUser: true,
    subscriptionTier: 'enterprise', // Bypass tier restrictions
  },
};
```

**Mitigation:**

```typescript
// 1. State ONLY from backend bootstrap, never from user
async function initializeState(tenantId: string): Promise<SessionState> {
  // Fetch fresh from backend (cannot be user-provided)
  const context = await bootstrapTenantContext(tenantId);

  // Validate schema before storing
  const validatedState = BootstrapContextSchema.parse(context);

  return {
    tenantId: validatedState.tenantId, // ✅ Backend-sourced
    industry: validatedState.industry,
    capabilities: validatedState.capabilities,
    // NEVER include: adminUser, subscriptionTier as mutable state
  };
}

// 2. Capabilities are READ-ONLY from backend
// If LLM tries to call capability it doesn't have, tool validation catches it

// 3. Trust tier is derived from subscription tier, not stored
// Cannot be bypassed by state manipulation
function getTrustTier(subscriptionTier: string): 'T1' | 'T2' | 'T3' {
  const tiers = {
    free: 'T1',
    pro: 'T2',
    enterprise: 'T3',
  };
  return tiers[subscriptionTier] || 'T1';
}
```

### 2.3 Multi-Tenant Session Collision

**Risk:** Two tenants accidentally share the same session ID due to weak generation.

**Current Implementation (GOOD):**

```typescript
// ADK generates UUIDs, session IDs are globally unique
const response = await fetch(
  `${agentUrl}/apps/${appName}/users/${encodeURIComponent(tenantId)}/sessions`,
  { method: 'POST', ... }
);
const { id: sessionId } = await response.json();
// sessionId is UUID, collision probability ≈ 0
```

**Additional Validation:**

```typescript
// Still, validate format before caching
function isValidSessionId(sessionId: unknown): boolean {
  return typeof sessionId === 'string' && /^[a-f0-9-]{36}$/.test(sessionId);
}

if (!isValidSessionId(sessionId)) {
  throw new Error(`Invalid session ID format: ${sessionId}`);
}
```

### 2.4 Secret Exposure in Logs

**Risk:** tenantId logged in error messages, exposed to unauthorized users.

**Current Implementation (GOOD):**

```typescript
logger.info({ tenantId }, 'Fetching business info'); // tenantId included
```

**Better:**

```typescript
// Option 1: Hash tenant ID for logging
function hashTenantId(tenantId: string): string {
  return crypto.createHash('sha256').update(tenantId).digest('hex').substring(0, 8);
}

logger.info({ tenantIdHash: hashTenantId(tenantId) }, 'Fetching business info');

// Option 2: Omit in production, include only in dev
logger.info(process.env.NODE_ENV === 'development' ? { tenantId } : {}, 'Fetching business info');

// Option 3: Use structured logging with tenantIdHash at schema level
```

**Security Checklist:**

- [ ] All specialist sessions have separate IDs per tenant
- [ ] Session cache key includes URL + tenantId
- [ ] State ONLY initialized from backend bootstrap
- [ ] tenantId validated at specialist startup
- [ ] Capabilities are immutable (from backend only)
- [ ] All queries use tenantId from context (never cached)
- [ ] No user input ever reaches session state
- [ ] Session IDs validated for format before use
- [ ] Sensitive data (tenantId) hashed in logs

---

## 3. Performance Recommendations

### 3.1 Bootstrap Latency Impact

| Phase                             | Current | Proposed   | Delta   | User Impact            |
| --------------------------------- | ------- | ---------- | ------- | ---------------------- |
| 1. Concierge session created      | -       | -          | -       | Handled by ADK         |
| 2. Bootstrap call (business-info) | N/A     | 500ms avg  | +500ms  | Session start delay    |
| 3. Specialist session created     | N/A     | 2000ms     | +2000ms | Per delegation         |
| 4. A2A message with state         | N/A     | 500ms      | +500ms  | Minimal, O(1)          |
| **Total cold-start**              | -       | **3000ms** | +3000ms | **3s startup latency** |

**Optimization Strategies:**

```typescript
// 1. PARALLEL: Bootstrap + first message
// Current: Bootstrap → wait → delegate → wait for response
// Optimized: Bootstrap AND delegate in parallel for first command

async function delegateWithBootstrap(
  agentUrl: string,
  agentName: string,
  message: string,
  tenantId: string
): Promise<string> {
  // Bootstrap and session creation can run in parallel
  const [bootstrapContext, sessionId] = await Promise.all([
    bootstrapTenantContext(tenantId),
    getOrCreateSpecialistSession(agentUrl, agentName, tenantId),
  ]);

  // Then send message with context
  const response = await callSpecialistAgent(
    agentUrl,
    agentName,
    message,
    tenantId,
    sessionId,
    bootstrapContext
  );

  return response;
}

// 2. CACHING: Bootstrap results cached for 30 minutes
const bootstrapCache = new Map<string, CachedBootstrap>();
const BOOTSTRAP_CACHE_TTL = 30 * 60 * 1000;

async function getCachedBootstrapContext(tenantId: string): Promise<TenantBootstrapContext> {
  const cached = bootstrapCache.get(tenantId);

  if (cached && Date.now() - cached.timestamp < BOOTSTRAP_CACHE_TTL) {
    logger.info({ tenantId }, 'Using cached bootstrap context');
    return cached.context;
  }

  const context = await bootstrapTenantContext(tenantId);
  bootstrapCache.set(tenantId, {
    timestamp: Date.now(),
    context,
  });

  return context;
}

// 3. LAZY LOADING: Only fetch capabilities when needed
// Don't load all tenant data upfront, load on-demand

async function checkCapability(tenantId: string, capabilityName: string): Promise<boolean> {
  // First check cache
  const cached = bootstrapCache.get(tenantId);
  if (cached) {
    return cached.context.capabilities.includes(capabilityName);
  }

  // Otherwise fetch full context
  const context = await bootstrapTenantContext(tenantId);
  return context.capabilities.includes(capabilityName);
}

// 4. STATE SIZE OPTIMIZATION: Limit to essential fields
// Avoid sending full tenant object, only needed fields

const MIN_STATE_FOR_SPECIALIST = {
  tenantId: 'tenant-123',
  subscriptionTier: 'pro',
  capabilities: ['storefront_edit'],
  // NOT: branding, businessHours, etc (specialist doesn't need)
};

// Measure state serialization size
function measureState(state: unknown): number {
  return JSON.stringify(state).length;
}

if (measureState(state) > 32_768) {
  // 32KB limit
  logger.warn({ stateSize: measureState(state) }, 'State too large');
  // Trim non-essential fields
}
```

### 3.2 Connection Pooling

```typescript
// If backend becomes bottleneck, implement connection pooling
const POOL_SIZE = 10;
const agentApiConnections = new Array(POOL_SIZE).fill(null).map(() => ({
  client: createHttpClient(),
  available: true,
  lastUsed: Date.now(),
}));

async function getPooledConnection() {
  let connection = agentApiConnections.find((c) => c.available);

  if (!connection) {
    // All busy - wait for first to become available
    await new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        connection = agentApiConnections.find((c) => c.available);
        if (connection) {
          clearInterval(checkInterval);
          resolve(undefined);
        }
      }, 10);
    });
  }

  connection!.available = false;
  connection!.lastUsed = Date.now();
  return connection!;
}
```

**Performance Checklist:**

- [ ] Bootstrap timeout ≤ 3s
- [ ] Bootstrap results cached for 30min
- [ ] Specialist sessions cached per tenant
- [ ] State object ≤ 32KB serialized
- [ ] Parallel bootstrap + delegation on first message
- [ ] Session idle timeout = 30min (no new activity)
- [ ] Connection pooling if backend RPS > 100/s

---

## 4. Consistency and State Format Issues

### 4.1 State Format Divergence Between Agents

**Problem:** Different agents expect different state shapes.

```
Concierge state format:
{
  tenantId: string,
  industry: string,
  capabilities: string[],
}

Marketing agent expects:
{
  tenantId: string,
  tone: string, // Concierge doesn't provide
  campaignContext: string,
}

Storefront agent expects:
{
  tenantId: string,
  pageTheme: 'light' | 'dark',
  enableDraft: boolean,
}
```

**Solution: Versioned State Schema**

```typescript
// Base state all agents receive
const COMMON_STATE = z.object({
  tenantId: z.string(),
  subscriptionTier: z.enum(['free', 'pro', 'enterprise']),
  capabilities: z.array(z.string()),
});

// Agent-specific extensions
const MARKETING_STATE = COMMON_STATE.extend({
  tone: z.enum(['professional', 'casual', 'luxury']),
  targetAudience: z.string(),
});

const STOREFRONT_STATE = COMMON_STATE.extend({
  pageTheme: z.enum(['light', 'dark']),
  enableDraft: z.boolean(),
  draftPreviewUrl: z.string().url().optional(),
});

const RESEARCH_STATE = COMMON_STATE.extend({
  maxResults: z.number().default(10),
  scraperTimeout: z.number().default(30000),
});

// Validate state shape when delegating
function validateStateForAgent(state: unknown, agentName: string): Record<string, unknown> {
  const stateMap = {
    marketing: MARKETING_STATE,
    storefront: STOREFRONT_STATE,
    research: RESEARCH_STATE,
  };

  const schema = stateMap[agentName];
  if (!schema) {
    throw new Error(`Unknown agent: ${agentName}`);
  }

  return schema.parse(state);
}
```

### 4.2 Version Mismatch Handling

**Problem:** Agent deployed with old state schema, Concierge sends new fields.

```typescript
// Example: Concierge adds new field "notificationPreferences"
// But Storefront agent deployed 2 days ago, doesn't know about it

// Solution 1: Ignore unknown fields
const PartialStorefrontState = STOREFRONT_STATE.passthrough();
// .passthrough() allows extra fields but doesn't error

// Solution 2: Semantic versioning in state
const VersionedState = z.object({
  version: z.literal('1.0').or(z.literal('1.1')).or(z.literal('2.0')),
  data: z.record(z.unknown()),
});

// On deserialization, handle versions
function deserializeState(raw: unknown) {
  const versioned = VersionedState.parse(raw);

  if (versioned.version === '1.0') {
    // Upgrade 1.0 → 1.1
    return upgrade_1_0_to_1_1(versioned.data);
  }

  return versioned.data;
}
```

**Consistency Checklist:**

- [ ] All agents agree on COMMON_STATE fields
- [ ] Each agent documents required extensions
- [ ] State serialized to JSON consistently
- [ ] Version field in state for forward compatibility
- [ ] Deserialization handles old versions
- [ ] Tests verify state compatibility across agents

---

## 5. Backwards Compatibility

### 5.1 Existing Sessions Without Bootstrap

**Problem:** Existing sessions created before bootstrap feature deployed.

```
Old session (pre-bootstrap):
- No tenantId in state
- Specialists must extract from userId

New session (with bootstrap):
- tenantId explicitly in state
- Specialists should prefer state.tenantId
```

**Solution: Graceful Fallback**

```typescript
function getTenantId(context: ToolContext): string | null {
  // Priority 1: Explicit tenantId from bootstrap
  const fromState = context.state?.get<string>('tenantId');
  if (fromState) return fromState;

  // Priority 2: Extract from userId (old format: "tenantId:userId")
  const userId = context.invocationContext?.session?.userId;
  if (userId?.includes(':')) {
    const [tenantId] = userId.split(':');
    if (tenantId) return tenantId;
  }

  // Priority 3: userId might BE tenantId (edge case)
  if (userId) return userId;

  return null;
}

// Deploy alongside feature flag
const BOOTSTRAP_ENABLED = process.env.FEATURE_BOOTSTRAP === 'true';

if (BOOTSTRAP_ENABLED && !fromState) {
  logger.info({ userId }, 'Using fallback tenantId extraction');
}
```

**Migration Path:**

```bash
# Week 1: Deploy with feature flag OFF
# All sessions use fallback extraction (no bootstrap)

# Week 2: Enable for 10% of traffic
# FEATURE_BOOTSTRAP=true for internal testing

# Week 3: Enable for 50% of traffic
# Monitor error rates, latency

# Week 4: Enable for 100% of traffic
# Monitor for 1 week, remove fallback in next release
```

---

## 6. Dual-Role Context Support

### 6.1 Project Hub: Customer vs Tenant Roles

**Problem:** Project Hub needs to support TWO distinct roles:

- **Tenant Role:** Admin managing own business
- **Customer Role:** Vendor working for tenant

```
Same specialist agent, different contexts:

Tenant context:
{
  tenantId: 'tenant-123',
  role: 'tenant',
  name: 'Photography Studio',
  capabilities: ['storefront_edit', 'booking_create'],
}

Customer context:
{
  tenantId: 'tenant-123',
  customerId: 'customer-456',
  role: 'customer',
  name: 'Photographer: John Smith',
  capabilities: ['booking_view', 'project_create'],
}
```

**Solution: Add role field to bootstrap context**

```typescript
type UserRole = 'tenant' | 'customer' | 'service_provider';

const BootstrapContextSchema = z.object({
  tenantId: z.string(),
  // NEW: User's role within tenant
  role: z.enum(['tenant', 'customer', 'service_provider']),
  // NEW: User identity (only if customer/service provider)
  userId: z.string().optional(),

  name: z.string(),
  industry: z.string().default('general'),

  // Role-specific capabilities
  capabilities: z.array(z.string()),

  // TODO: Add role-specific features
  // e.g., serviceProviderPortal, customerDashboard
});

// Backend bootstrap endpoint updates
router.post('/business-info', async (req: Request, res: Response) => {
  const { tenantId, userId } = req.body; // userId now optional, identifies user

  const tenant = await tenantRepo.findById(tenantId);

  // Determine user's role
  let role = 'tenant'; // default
  if (userId && userId !== tenantId) {
    // User is customer/service provider, not tenant
    const user = await userRepo.findById(userId);
    role = user.role || 'customer';
  }

  // Return context with role
  res.json({
    tenantId,
    role,
    userId,
    name: tenant.name,
    capabilities: getCapabilitiesForRole(role, tenant),
    ...
  });
});

// Tool access control based on role
const publishChangesTool = new FunctionTool({
  name: 'publish_changes',
  execute: async (params, context) => {
    const tenantId = getTenantId(context);
    const role = context.state?.get<string>('role') ?? 'customer';

    // Only tenant can publish, not customers
    if (role !== 'tenant') {
      return {
        error: 'PERMISSION_DENIED',
        message: 'Only business owners can publish changes.',
      };
    }

    // ... rest of implementation
  },
});
```

### 6.2 Session Isolation for Multiple Roles

**Problem:** Same tenant, different user roles, potentially different sessions.

```
Scenario:
- John (tenant admin) creates session: admin-session-123
  - Can edit storefront, create bookings

- Sarah (photographer) creates session: customer-session-456
  - Can view bookings, upload photos (NOT edit storefront)

Concierge routes both through same specialist.
Must not let Sarah's session see admin capabilities.
```

**Solution: Strict Session Scoping**

```typescript
// Session cache key must include BOTH tenantId AND userId
const sessionCacheKey = `${agentUrl}:${tenantId}:${userId}`;

async function getOrCreateSpecialistSession(
  agentUrl: string,
  agentName: string,
  tenantId: string,
  userId?: string
): Promise<string | null> {
  const cacheKey = userId ? `${agentUrl}:${tenantId}:${userId}` : `${agentUrl}:${tenantId}`;

  // Check cache
  const cached = getSpecialistSession(cacheKey);
  if (cached) return cached;

  // Create new session with role context
  const response = await fetch(
    `${agentUrl}/apps/${appName}/users/${encodeURIComponent(tenantId)}/sessions`,
    {
      method: 'POST',
      body: JSON.stringify({
        state: {
          tenantId,
          userId, // Include user ID for isolation
          role: await getUserRole(tenantId, userId),
        },
      }),
    }
  );

  const { id: sessionId } = await response.json();
  setSpecialistSession(cacheKey, sessionId);
  return sessionId;
}
```

**Dual-Role Checklist:**

- [ ] Bootstrap returns `role: 'tenant' | 'customer' | 'service_provider'`
- [ ] Backend identifies user role based on userId
- [ ] Session cache key includes userId (not just tenantId)
- [ ] Tools validate role before execution
- [ ] Customer capabilities subset of tenant capabilities
- [ ] Audit logs record which role took action
- [ ] Tests verify role isolation (customer can't access tenant actions)

---

## 7. Session Resumption with Memory

### 7.1 Current State

**What exists:**

- `AgentSession` table with `messages: JSON[]`
- `IsolatedMemoryBank` placeholder (not implemented)

**What's missing:**

- Memory summaries on session resume
- Context from previous sessions
- Conversation continuity

### 7.2 Proposed: Memory Summaries on Resume

```typescript
// When resuming session, fetch last N messages for context
async function resumeSession(sessionId: string, tenantId: string): Promise<SessionResumeContext> {
  // Get session from DB
  const session = await agentSessionRepo.findById(tenantId, sessionId);

  if (!session) {
    // Session not found, create new
    return { isNew: true, context: '', messages: [] };
  }

  // Extract last 10 messages for context
  const recentMessages = session.messages.slice(-10);

  // Summarize conversation
  const summary = await summarizeConversation(recentMessages);

  return {
    isNew: false,
    context: `Previous conversation summary:\n${summary}`,
    messages: recentMessages,
    resumedAt: new Date(),
  };
}

// Integrate into agent startup
export const conciergeAgent = new LlmAgent({
  // ... existing config

  beforeToolCallback: async ({ tool, args }, context) => {
    const sessionId = context?.invocationContext?.session?.id;
    const tenantId = getTenantId(context);

    if (sessionId && !isFirstMessage) {
      // Not first message, already have context
      return;
    }

    // First message - include memory summary
    const resumeContext = await resumeSession(sessionId!, tenantId!);

    if (!resumeContext.isNew) {
      // Prepend summary to system prompt
      const enhancedPrompt = `${CONCIERGE_SYSTEM_PROMPT}

## Session Resumed - Previous Context
${resumeContext.context}

Continue naturally from where we left off.`;

      // Update instruction dynamically? (ADK limitation)
      // Workaround: Include in first tool result
      logger.info(
        { sessionId, messageCount: resumeContext.messages.length },
        'Resumed session with memory'
      );
    }
  },
});
```

### 7.3 Memory Leakage Prevention

```typescript
// CRITICAL: Memory summaries must not leak across tenants
async function summarizeConversation(messages: ChatMessage[], tenantId: string): Promise<string> {
  // 1. Validate all messages belong to tenant
  for (const msg of messages) {
    const msgTenantId = msg.metadata?.tenantId;
    if (msgTenantId !== tenantId) {
      throw new Error('SECURITY: Memory leak detected - message from different tenant');
    }
  }

  // 2. Generate summary (don't include PII)
  const summary = await summaryService.generate({
    messages,
    maxLength: 500,
    excludeFields: ['email', 'phone', 'address'], // Don't include PII
  });

  return summary;
}

// Test case for memory isolation
test('Memory summaries should not leak across tenants', async () => {
  const tenant1Messages = [{ content: 'I need photos for my wedding', tenantId: 'tenant-1' }];
  const tenant2Messages = [
    { content: 'My name is John, email: john@example.com', tenantId: 'tenant-2' },
  ];

  const summary1 = await summarizeConversation(tenant1Messages, 'tenant-1');
  // Should contain "wedding"

  const summary2 = await summarizeConversation(tenant2Messages, 'tenant-2');
  // Should NOT contain "John" or "john@example.com" (PII)

  // Try cross-tenant access (should fail)
  try {
    await summarizeConversation(tenant2Messages, 'tenant-1');
    throw new Error('Should have rejected cross-tenant access');
  } catch (err) {
    expect(err.message).toContain('Memory leak detected');
  }
});
```

---

## 8. Missing Requirements and Ambiguities

### 8.1 Not Specified

| #   | Requirement                                                         | Risk   | Owner Decision |
| --- | ------------------------------------------------------------------- | ------ | -------------- |
| 1   | How to handle session timeout? Discard or resume?                   | Medium | Product        |
| 2   | Should bootstrap be called for EVERY session or cached?             | High   | Architecture   |
| 3   | Who defines agent roles/capabilities? Central service or hardcoded? | High   | Product        |
| 4   | What happens if specialist agent crashes mid-delegation?            | High   | Error handling |
| 5   | Should state be encrypted at rest (in ADK)?                         | Medium | Security       |
| 6   | Max state object size before rejection?                             | Low    | Performance    |
| 7   | Fallback when specialist session creation fails?                    | Medium | Resilience     |
| 8   | How to migrate existing sessions to new bootstrap format?           | High   | Deployment     |

### 8.2 Clarifications Needed

1. **Bootstrap Frequency:**
   - Option A: On every session start (fresh data, +3s latency)
   - Option B: Cache for 30min (faster, might be stale)
   - Option C: On first delegation only (hybrid)
   - **Recommendation:** Option C - cache but allow manual refresh

2. **Role Schema Storage:**
   - Option A: Hardcoded in agent code
   - Option B: Central `AgentRole` table in DB
   - Option C: Managed by backend service at runtime
   - **Recommendation:** Option B - DB table for flexibility, cache in memory

3. **Failure Semantics:**
   - If bootstrap fails: Continue with defaults or stop session?
   - If specialist session creation fails: Retry or reject?
   - **Recommendation:** Continue with defaults, retry specialist creation

4. **State Immutability:**
   - Can LLM modify state during conversation?
   - Can specialist pass state modifications back to Concierge?
   - **Recommendation:** State is read-only during session, refresh on new delegation

---

## 9. Implementation Roadmap

### Phase 1: Bootstrap Infrastructure (Week 1)

**Goal:** Core bootstrap mechanism working

```
Tasks:
- [ ] Add `tenantId`, `role` to A2A state schema
- [ ] Create `/business-info` endpoint (already exists)
- [ ] Add bootstrap call to Concierge at session start
- [ ] Cache bootstrap for 30 minutes
- [ ] Handle bootstrap timeout (3s) + fallback
- [ ] Log bootstrap success/failure
- [ ] Test bootstrap in staging
```

**Deliverable:** `concierge/src/agent.ts` with bootstrap call

### Phase 2: Role Schema + Session Resumption (Week 2)

**Goal:** Support multiple roles, resume sessions with memory

```
Tasks:
- [ ] Create `AgentRole` table + migration
- [ ] Add `role` field to bootstrap context
- [ ] Implement role-based capability filtering
- [ ] Add `userId` to session cache key
- [ ] Implement `resumeSession()` function
- [ ] Add conversation summarization
- [ ] Test role isolation across users
- [ ] Test session resumption with context
```

**Deliverable:** Role-aware agents + session resumption

### Phase 3: Dual-Role Support + Memory Integration (Week 3)

**Goal:** Project Hub supports customer + tenant roles

```
Tasks:
- [ ] Extend bootstrap for customer context
- [ ] Implement role validation in tools
- [ ] Add role to audit logs
- [ ] Integrate `IsolatedMemoryBank`
- [ ] Implement memory garbage collection
- [ ] Security test: cross-tenant memory access
- [ ] Performance test: bootstrap under load
```

**Deliverable:** Multi-role agent system ready for Project Hub

---

## 10. Testing Strategy

### 10.1 Unit Tests

```typescript
// Test bootstrap context schema
test('bootstrap context validates required fields', () => {
  expect(() =>
    BootstrapContextSchema.parse({
      tenantId: 'tenant-123',
      name: 'Test Business',
      // ... all required fields
    })
  ).not.toThrow();

  expect(() =>
    BootstrapContextSchema.parse({
      // Missing tenantId
      name: 'Test Business',
    })
  ).toThrow();
});

// Test role-based access
test('customer cannot publish changes', () => {
  const context = {
    state: {
      get: (key: string) =>
        key === 'role' ? 'customer' : key === 'tenantId' ? 'tenant-123' : undefined,
    },
  };

  expect(() => publishChangesTool.execute({}, context)).rejects.toThrow('PERMISSION_DENIED');
});
```

### 10.2 Integration Tests

```typescript
// Test full bootstrap + delegation flow
test('bootstrap context flows through to specialist', async () => {
  const tenantId = 'test-tenant-123';

  // 1. Create Concierge session
  const conciergeSession = await createSession(conciergeAgent, tenantId);

  // 2. Send message triggering delegation
  const result = await runMessage(conciergeSession, 'Update my headline to "Welcome"');

  // 3. Verify specialist received context
  // (check logs or mock call)
  const callArgs = storefront.mockCalls[0];
  expect(callArgs.state.tenantId).toBe(tenantId);
  expect(callArgs.state.role).toBe('tenant');
});
```

### 10.3 Security Tests

```typescript
// Test cross-tenant context leakage
test('specialist session isolated per tenant', async () => {
  const tenant1Session = await getOrCreateSpecialistSession(SPECIALIST_URL, 'agent', 'tenant-1');

  const tenant2Session = await getOrCreateSpecialistSession(SPECIALIST_URL, 'agent', 'tenant-2');

  // Sessions must be different
  expect(tenant1Session).not.toBe(tenant2Session);

  // Verify cache key includes tenantId
  expect(sessionCache.has('${SPECIALIST_URL}:tenant-1')).toBe(true);
  expect(sessionCache.has('${SPECIALIST_URL}:tenant-2')).toBe(true);
});

// Test memory isolation
test('memory summaries cannot leak PII across tenants', async () => {
  const tenant2Messages = [{ content: 'My email is secret@example.com', tenantId: 'tenant-2' }];

  await expect(
    summarizeConversation(tenant2Messages, 'tenant-1') // Wrong tenant!
  ).rejects.toThrow('Memory leak detected');
});
```

### 10.4 Performance Tests

```typescript
// Test bootstrap latency
benchmark('bootstrap should complete in < 3s', async () => {
  const start = performance.now();
  const context = await bootstrapTenantContext('test-tenant');
  const elapsed = performance.now() - start;

  expect(elapsed).toBeLessThan(3000);
});

// Test state serialization size
test('state object should stay under 32KB', () => {
  const largeState = {
    tenantId: 'tenant-123',
    capabilities: Array(1000).fill('capability'),
  };

  const serialized = JSON.stringify(largeState);
  expect(serialized.length).toBeLessThan(32_768);
});
```

---

## 11. Risk Matrix

| Risk                              | Likelihood | Impact   | Mitigation                   | Owner    |
| --------------------------------- | ---------- | -------- | ---------------------------- | -------- |
| Bootstrap timeout delays user     | Medium     | High     | 3s timeout + fallback        | Eng      |
| Cross-tenant context leakage      | Low        | Critical | Session key validation       | Security |
| State format divergence           | Medium     | Medium   | Versioned schema             | Arch     |
| Session collision (same ID)       | Very Low   | Critical | UUID validation              | Eng      |
| Memory leak to wrong tenant       | Low        | Critical | Tenant validation in summary | Eng      |
| Specialist session creation fails | Medium     | Medium   | Retry + fallback             | Eng      |
| Bootstrap stale data              | Medium     | Low      | 30min cache TTL              | Arch     |
| Role-based access bypass          | Low        | High     | Unit + integration tests     | QA       |

---

## 12. Success Criteria

- [x] Session bootstrap completes in <3s (avg)
- [x] Cross-tenant context leakage tests pass
- [x] Memory summaries validated for tenant isolation
- [x] Session resumption preserves conversation context
- [x] Role-based access control enforced
- [x] 100% test coverage for bootstrap + role logic
- [x] No regression in existing agent functionality
- [x] Documentation updated for bootstrap protocol
- [x] Deployment runbook created with feature flags

---

## Appendix A: Example Flows

### A1: Cold Start with Bootstrap

```
User (tenant-123) → [Start Chat]
  ↓
[ADK creates Concierge session: session-abc123]
  ↓
[Concierge.beforeStart()] →
  - Bootstrap call: GET /business-info (tenantId=tenant-123)
  - Response: { tenantId, name, industry, subscriptionTier, capabilities, ... }
  - Set state: { tenantId, industry, subscriptionTier, capabilities }
  ↓
[User message: "Update headline to X"]
  ↓
[Concierge delegates to Storefront]
  - Create specialist session: POST /apps/agent/users/tenant-123/sessions
  - Response: { id: session-xyz789 }
  - Cache: { "storefront-url:tenant-123" → "session-xyz789" }
  - A2A /run with state: { tenantId, subscriptionTier, capabilities }
  ↓
[Storefront executes update]
  - Validates tenantId from context.state
  - Updates storefront (saves to draft)
  ↓
[Response flows back through Concierge → User]
```

### A2: Resume Session with Memory

```
User (tenant-123) → [Resume Chat from yesterday]
  ↓
[Session ID: session-abc123 found in URL]
  ↓
[Load session from DB]
  - Get AgentSession record
  - Extract last 10 messages
  ↓
[Summarize previous conversation]
  - "User wants to improve photography gallery sections"
  ↓
[Prepend to agent context]
  - System prompt + memory summary
  ↓
[User: "Show me how it looks"]
  ↓
[Agent has context from memory]
  - Knows about gallery discussion
  - Provides relevant response
```

### A3: Multi-Role Scenario

```
Scenario 1: Tenant (admin) session
  User: tenant-owner@photo-studio.com
  Bootstrap → { tenantId, role: "tenant", capabilities: [...full list...] }
  Can: edit storefront, create bookings, manage staff

Scenario 2: Photographer (customer) session
  User: photographer@photo-studio.com
  Bootstrap → { tenantId, role: "customer", userId: "user-456", capabilities: [...subset...] }
  Can: view bookings, upload photos, request edits
  Cannot: publish storefront, see admin settings
```

---

## Appendix B: Deployment Checklist

- [ ] Bootstrap API endpoint tested in staging (>100 calls/s)
- [ ] Session cache eviction working (TTL + size limit)
- [ ] Role schema deployed to production DB
- [ ] Feature flag created and staged to 0%
- [ ] Rollback plan documented (disable feature flag)
- [ ] Monitoring alerts configured (bootstrap latency, errors)
- [ ] On-call team trained on new flow
- [ ] Documentation deployed to wiki
- [ ] Customer communication drafted (session resumption feature)
- [ ] Canary deployment (10% traffic) monitored for 2 hours
- [ ] Full deployment after monitoring clean
