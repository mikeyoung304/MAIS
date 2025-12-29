# PR #23 Customer Chatbot - Code Review Fixes (13+ Findings)

## Metadata

| Field            | Value                                                     |
| ---------------- | --------------------------------------------------------- |
| **Problem Type** | code-review-patterns                                      |
| **Component**    | server/src/agent/customer/, apps/web/src/components/chat/ |
| **Severity**     | P1, P2                                                    |
| **Date Solved**  | 2025-12-28                                                |
| **PR**           | #23 (feat/customer-chatbot)                               |
| **Commit**       | e2d6545                                                   |

## Summary

Fixed 13+ P1/P2 code review findings from PR #23 (customer chatbot feature) across security, performance, architecture, type safety, and code quality categories. This document captures 7 reusable patterns that compound future development.

## Problem Statement

Code review of PR #23 (customer-facing chatbot for tenant storefronts) identified multiple issues:

- **Security (3):** Missing session ownership verification, route-level validation, tenant filtering
- **Performance (2):** Redundant database queries, missing composite index
- **Architecture (1):** Circular dependency between executor and routes
- **Type Safety (2):** Array index React keys, Express type augmentation
- **Code Quality (4):** Unused functions, props, state variables, fields
- **Data Safety (1):** Missing migration rollback script

## Seven Patterns Documented

### Pattern 1: Circular Dependency Resolution via Module Extraction

**Problem:** `customer-booking-executor.ts` imported from routes to register itself, but routes needed to call executors.

```
routes.ts → executor.ts → routes.ts (CIRCULAR!)
```

**Solution:** Extract a registry module that both depend on:

```typescript
// server/src/agent/customer/executor-registry.ts
export type CustomerProposalExecutor = (
  tenantId: string,
  customerId: string,
  payload: Record<string, unknown>
) => Promise<Record<string, unknown>>;

const customerProposalExecutors = new Map<string, CustomerProposalExecutor>();

export function registerCustomerProposalExecutor(
  operation: string,
  executor: CustomerProposalExecutor
): void {
  customerProposalExecutors.set(operation, executor);
}

export function getCustomerProposalExecutor(
  operation: string
): CustomerProposalExecutor | undefined {
  return customerProposalExecutors.get(operation);
}
```

**Dependency diagram after fix:**

```
routes.ts ────────────────┐
                          ↓
               executor-registry.ts
                          ↑
customer-booking-executor.ts
```

**When to use:**

- Plugin/executor registration systems
- Webhook handler registries
- Multi-implementation patterns

---

### Pattern 2: Express Request Type Augmentation

**Problem:** `req.tenantId as any` bypasses TypeScript safety.

**Solution:** Augment Express types in `server/src/types/express.d.ts`:

```typescript
declare global {
  namespace Express {
    interface Request {
      tenantId?: string;
    }
  }
}

export {};
```

**Benefits:**

- Zero runtime cost
- Full IDE autocomplete
- Type errors if accessing undefined properties
- Discoverable by team members

**When to use:**

- Middleware-injected properties (tenantId, userId, session)
- Custom request extensions from authentication/authorization

---

### Pattern 3: React Stable Keys with crypto.randomUUID()

**Problem:** Using array indices as React keys causes rendering issues when items reorder.

```tsx
// ❌ BAD - Array index as key
{
  messages.map((msg, index) => <MessageBubble key={index} message={msg} />);
}
```

**Solution:** Add stable ID to data model, generate on creation:

```typescript
// Add id to interface
interface ChatMessage {
  id: string;  // Stable identifier
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// Generate on creation
const userMessage: ChatMessage = {
  id: crypto.randomUUID(),  // Browser-native, collision-free
  role: 'user',
  content: message,
  timestamp: new Date(),
};

// Use id as key
{messages.map((message) => (
  <MessageBubble key={message.id} message={message} />
))}
```

**Why crypto.randomUUID():**

- Browser-native (no library needed)
- Collision-free (122 bits of randomness)
- Doesn't need to persist to backend
- Generated once per message lifetime

---

### Pattern 4: Request-Scoped Context Caching

**Problem:** `buildBusinessContext()` called 2-3 times per request (expensive DB query).

**Solution:** Build once at entry point, pass as optional parameter:

```typescript
// In chat() method - build context once
const businessContext = await this.buildBusinessContext(tenantId);
const businessName = session.businessName;

// Pass to processResponse
const { finalMessage, toolResults, proposal } = await this.processResponse(
  response,
  tenantId,
  sessionId,
  session.customerId,
  messages,
  0, // depth
  { businessContext, businessName }  // Cached context
);

// In processResponse - use cached or fetch
private async processResponse(
  // ... other params
  cachedContext?: { businessContext: string; businessName: string }
): Promise<...> {
  // Use cached context if available
  const businessContext =
    cachedContext?.businessContext ?? (await this.buildBusinessContext(tenantId));
  const businessName = cachedContext?.businessName ?? 'Business';
  // ...
}
```

**Why not global cache:**

- Request-scoped prevents stale data
- No cache invalidation complexity
- Simple to test
- No cross-request leakage

---

### Pattern 5: Session Ownership Verification

**Problem:** Proposal confirmation only checked tenant ownership, not session ownership.

**Solution:** Two-level isolation - verify both tenant AND session:

```typescript
// Route handler - require sessionId in body
const { sessionId } = req.body;

if (!sessionId) {
  return { status: 400, body: { error: 'Session ID required' } };
}

// Verify proposal belongs to this session
const proposal = await prisma.agentProposal.findFirst({
  where: {
    id: proposalId,
    tenantId, // Level 1: Tenant isolation
    sessionId, // Level 2: Session ownership
    status: 'PENDING',
  },
});

if (!proposal) {
  return { status: 404, body: { error: 'Proposal not found' } };
}
```

**Security principle:** Multi-step operations need multi-level verification:

1. Tenant isolation (always)
2. Session ownership (for user-initiated actions)
3. Resource ownership (for mutations)

---

### Pattern 6: Composite Database Index for Session Lookup

**Problem:** Query on `tenantId, sessionType, updatedAt DESC` without index causes full-table scan.

```typescript
// This query pattern needs an index
const session = await prisma.agentSession.findFirst({
  where: {
    tenantId,
    sessionType: 'CUSTOMER',
    updatedAt: { gt: new Date(Date.now() - 60 * 60 * 1000) },
  },
  orderBy: { updatedAt: 'desc' },
});
```

**Solution:** Add composite index with proper column order:

```sql
-- server/prisma/migrations/17_add_session_type_index.sql
CREATE INDEX IF NOT EXISTS "AgentSession_tenantId_sessionType_updatedAt_idx"
ON "AgentSession"("tenantId", "sessionType", "updatedAt" DESC);
```

**Index column order rules:**

1. Equality filters first (`tenantId`, `sessionType`)
2. Range filters/sorting last (`updatedAt DESC`)

---

### Pattern 7: Unused Code Removal (SIMP Pattern)

**Problem:** Dead code creates confusion and maintenance burden.

**Fixes applied:**

- Deleted unused `addDays()` function from customer-tools.ts
- Removed unused `tenantSlug` prop from widget components
- Removed unused `greeting` state variable
- Removed unused `businessSlug` field from interfaces

**Decision framework:**

| Keep if...                   | Delete if...              |
| ---------------------------- | ------------------------- |
| Public API (breaking change) | Internal-only, no callers |
| Framework-required           | Vestigial from refactor   |
| Future-planned with TODO     | "Might need someday"      |

**Underscore prefix rule:**

- Only use `_` prefix if variable is TRULY unused
- Variables passed to logger, used in conditionals, or assigned are NOT unused

---

## Files Modified

| File                                                                 | Changes                                                       |
| -------------------------------------------------------------------- | ------------------------------------------------------------- |
| `server/src/routes/public-customer-chat.routes.ts`                   | Session ownership, sessionId validation, isChatEnabled helper |
| `server/src/agent/customer/executor-registry.ts`                     | NEW - Registry to break circular dependency                   |
| `server/src/agent/customer/customer-booking-executor.ts`             | Import from registry, tenant filter on customer lookup        |
| `server/src/agent/customer/customer-orchestrator.ts`                 | Remove businessSlug, cache buildBusinessContext               |
| `server/src/agent/customer/customer-tools.ts`                        | Delete unused addDays()                                       |
| `server/src/agent/customer/index.ts`                                 | Export registry functions                                     |
| `server/src/types/express.d.ts`                                      | Add tenantId to Request                                       |
| `apps/web/src/components/chat/CustomerChatWidget.tsx`                | Stable message IDs, remove unused state                       |
| `apps/web/src/components/chat/TenantChatWidget.tsx`                  | Remove unused tenantSlug prop                                 |
| `apps/web/src/app/t/[slug]/(site)/layout.tsx`                        | Remove tenantSlug from widget                                 |
| `server/prisma/migrations/17_add_session_type_index.sql`             | NEW - Composite index                                         |
| `server/prisma/migrations/16_add_customer_chat_support_rollback.sql` | NEW - Rollback script                                         |

## Prevention Strategies

### Pre-Commit Checklist

- [ ] No circular dependencies (`npx madge --circular src/`)
- [ ] Express middleware properties in types/express.d.ts
- [ ] No array indices as React keys (ESLint: `react/no-array-index-key`)
- [ ] Composite indexes for 2+ column WHERE clauses
- [ ] Two-level ownership verification for multi-step operations
- [ ] TypeScript strict mode catches unused code

### Code Review Checklist

- [ ] Security: Does proposal confirmation verify session ownership?
- [ ] Performance: Are expensive queries called multiple times per request?
- [ ] Architecture: Do new modules create circular imports?
- [ ] Types: Are middleware-injected properties properly typed?
- [ ] React: Are list keys stable identifiers (not indices)?
- [ ] Database: Do new query patterns need indexes?
- [ ] Cleanup: Is there dead code from refactoring?

## Related Documentation

- [Agent Architecture Decision](../agent-design/AGENT-TOOL-ARCHITECTURE-DECISION-MAIS-20251228.md) - Proposal/executor pattern
- [Next.js Migration Lessons](nextjs-migration-lessons-learned-MAIS-20251225.md) - Similar code review patterns
- [MAIS Critical Patterns](../patterns/mais-critical-patterns.md) - Multi-tenant isolation rules
- [ts-rest Type Limitations](../best-practices/ts-rest-any-type-library-limitations-MAIS-20251204.md) - When `any` is acceptable

## Compound Value

This documentation enables:

1. **Copy executor-registry pattern** for webhook handlers, async tasks
2. **Use type augmentation template** for any Express middleware
3. **Avoid React key bugs** by checking pattern before using array indices
4. **Implement multi-tenant features** with confidence using two-level isolation
5. **Add indexes** following column-order rules
6. **Reference patterns summary** when evaluating new feature designs

---

_Generated: 2025-12-28 | Commit: e2d6545 | PR: #23_
