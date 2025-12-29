# Customer Chatbot PR #23 Code Review Fixes

## Summary

Resolved **13+ P1/P2 findings** from customer chatbot feature review (PR #23). These fixes establish 7 critical patterns for avoiding architecture sprawl, type safety issues, React rendering bugs, and race conditions.

**Key Achievement:** Transformed circular dependencies and type safety bypasses into clean, type-safe patterns that can be reused across the codebase.

---

## Fix 1: Circular Dependency Resolution via Module Extraction

### Problem

**Symptom:** `customer-booking-executor.ts` needed to register itself, but it was imported by routes, and routes imported the executor.

```
routes.ts → customer-booking-executor.ts → routes.ts (CIRCULAR!)
```

**Impact:** Build failures, unmaintainable dependency graph.

### Solution: Executor Registry Pattern

Create a **separate registry module** that both routes and executor depend on, breaking the cycle.

**File:** `/server/src/agent/customer/executor-registry.ts`

```typescript
/**
 * Executor for customer booking proposals
 */
export type CustomerProposalExecutor = (
  tenantId: string,
  customerId: string,
  payload: Record<string, unknown>
) => Promise<Record<string, unknown>>;

/**
 * Registry for customer proposal executors
 */
const customerProposalExecutors = new Map<string, CustomerProposalExecutor>();

/**
 * Register a customer proposal executor
 */
export function registerCustomerProposalExecutor(
  operation: string,
  executor: CustomerProposalExecutor
): void {
  customerProposalExecutors.set(operation, executor);
}

/**
 * Get a registered executor by operation name
 */
export function getCustomerProposalExecutor(
  operation: string
): CustomerProposalExecutor | undefined {
  return customerProposalExecutors.get(operation);
}
```

**Executor registers itself (no circular import):**

```typescript
// customer-booking-executor.ts
import { registerCustomerProposalExecutor } from './executor-registry';

export function registerCustomerBookingExecutor(prisma: PrismaClient): void {
  registerCustomerProposalExecutor(
    'create_customer_booking',
    async (tenantId, customerId, payload) => {
      // execution logic
    }
  );
}
```

**Routes look up executor (no circular import):**

```typescript
// routes.ts
import { getCustomerProposalExecutor } from '../agent/customer/executor-registry';

const executor = getCustomerProposalExecutor(proposal.operation);
if (executor) {
  const result = await executor(tenantId, customerId, proposal.payload);
}
```

### Dependency Graph (After Fix)

```
routes.ts ─┐
           ├─→ executor-registry.ts ←─┐
customer-booking-executor.ts ──────→┘
```

### When to Use This Pattern

- **Multi-registration:** When many executors/handlers need to self-register
- **Bidirectional dependencies:** When A imports B and B imports A
- **Plugin systems:** When executor location varies but routes are fixed
- **Type-safe dispatch:** When you need runtime lookup with type safety

### Antipatterns to Avoid

❌ Don't use a god container that knows about all executors
❌ Don't pass executors through props deep in the component tree
❌ Don't use reflection/dynamic imports to work around circular dependencies

---

## Fix 2: Express Request Type Augmentation for TenantId

### Problem

**Symptom:** Using `req.tenantId as any` in route handlers bypasses TypeScript safety.

```typescript
// ❌ WRONG - Type error, so developers add `as any`
const tenantId = (req as any).tenantId;
```

**Impact:**

- Loss of type safety
- IDE autocomplete doesn't work
- Future refactors miss usage sites
- Inconsistent patterns across codebase

### Solution: TypeScript Module Augmentation

Extend Express `Request` interface using TypeScript's global namespace.

**File:** `/server/src/types/express.d.ts`

```typescript
/**
 * Express type extensions for tenant authentication
 */

import type { TenantTokenPayload } from '../lib/ports';

declare global {
  namespace Express {
    interface Request {
      /** Tenant ID set by tenant middleware for public routes */
      tenantId?: string;
    }
    interface Locals {
      tenantAuth?: TenantTokenPayload;
      logger?: any;
    }
  }
}
```

**Usage in routes (now type-safe):**

```typescript
// ✅ CORRECT - No type errors, full autocomplete
const tenantId = req.tenantId;

// ✅ CORRECT - Optional chaining works
const tenantId = req.tenantId ?? null;
```

### How It Works

1. **Global namespace:** `declare global` extends TypeScript's global type definitions
2. **Express namespace:** `namespace Express` extends the Express library's types
3. **Interface merging:** TypeScript merges your extension with the library's Request interface
4. **No runtime cost:** This is pure TypeScript - it compiles to nothing

### Similar Patterns in MAIS

Same pattern used for `res.locals`:

```typescript
interface Locals {
  tenantAuth?: TenantTokenPayload;
  logger?: any;
}

// Usage:
res.locals.tenantAuth.tenantId // ✅ Type-safe
res.locals.logger.info(...) // ✅ Type-safe
```

### When to Use This Pattern

- **Library augmentation:** When you extend 3rd party types (Express, React, etc.)
- **Global middleware:** When middleware injects properties into request/response
- **Framework extensions:** When you add custom properties to framework objects
- **Plugin systems:** When different modules need to agree on object shape

### What NOT to Do

❌ Don't import the d.ts file anywhere - TypeScript finds it automatically
❌ Don't use `as any` after creating the extension - the whole point is type safety
❌ Don't put implementation in the d.ts file - only type declarations

---

## Fix 3: React Stable Keys Using crypto.randomUUID()

### Problem

**Symptom:** Using array indices as React keys causes re-render bugs when messages reorder.

```tsx
// ❌ WRONG - Index as key
{
  messages.map((message, index) => <MessageBubble key={index} message={message} />);
}
// Result: If messages reorder, React reuses the old DOM nodes
```

**Impact:**

- State tied to wrong messages (e.g., selected state persists)
- Animation glitches when messages insert/delete
- Input fields keep focus on wrong message
- Component lifecycle hooks fire at wrong times

### Solution: Add ID Field to Interface, Generate with crypto.randomUUID()

**Type definition:**

```typescript
interface ChatMessage {
  id: string; // ✅ ADD THIS
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  proposal?: BookingProposal;
}
```

**Create messages with unique IDs:**

```typescript
// When user sends message
const userMessage: ChatMessage = {
  id: crypto.randomUUID(), // ✅ Stable, unique per message
  role: 'user',
  content: message,
  timestamp: new Date(),
};
setMessages((prev) => [...prev, userMessage]);

// When assistant responds
const assistantMessage: ChatMessage = {
  id: crypto.randomUUID(), // ✅ Different ID even for similar content
  role: 'assistant',
  content: data.message,
  timestamp: new Date(),
  proposal: data.proposal,
};
setMessages((prev) => [...prev, assistantMessage]);
```

**Use ID as key:**

```tsx
// ✅ CORRECT - Unique, stable ID as key
{
  messages.map((message) => (
    <MessageBubble key={message.id} message={message} primaryColor={primaryColor} />
  ));
}
```

### Why crypto.randomUUID() is Best

| Approach              | Pros                                                   | Cons                                      |
| --------------------- | ------------------------------------------------------ | ----------------------------------------- |
| `crypto.randomUUID()` | Browser native, 36-char UUID, cryptographically unique | Slightly longer than short ID             |
| `Math.random()`       | Built-in                                               | Not guaranteed unique, no standard format |
| Server-generated ID   | Integrates with backend                                | Extra network roundtrip, stale UI         |
| Nanoid                | Tiny library, URL-safe                                 | Extra dependency                          |
| Date.now() + random   | Smaller                                                | Can collide in rapid clicks               |

**Use crypto.randomUUID() when:**

- You need client-side generation
- Collisions are unacceptable (React keys, unique identifiers)
- Browser support is modern (all modern browsers support it)

### When to Use This Pattern

- **Dynamic lists:** When items add/remove/reorder (messages, comments, todos)
- **Form state:** When input state must track specific form field
- **Animations:** When animation timing depends on DOM identity
- **Component lifecycle:** When you need stable element references

### What NOT to Do

❌ Don't use `index` as key for dynamic lists - ever
❌ Don't regenerate UUIDs on each render (defeats the purpose)
❌ Don't use UUID for sorting - use stable properties instead
❌ Don't rely on UUIDs persisting to backend unless explicitly saved

---

## Fix 4: Context Caching for Performance

### Problem

**Symptom:** `buildBusinessContext()` called multiple times per request (expensive DB query).

```typescript
// ❌ WRONG - Multiple expensive queries
async function chat(tenantId: string, sessionId: string, message: string) {
  // First call
  const context1 = await buildBusinessContext(tenantId);

  // Second call later
  const context2 = await buildBusinessContext(tenantId);

  // Now we have duplicate queries
}
```

**Impact:**

- 2-3x slower response times
- Unnecessary database load
- Inconsistent data (context changes mid-request)

### Solution: Cache Context in First Call, Pass as Parameter

**Service method signature (before):**

```typescript
async function processResponse(tenantId: string, message: string): Promise<Response> {
  // buildBusinessContext called internally
}
```

**Service method signature (after):**

```typescript
async function processResponse(
  tenantId: string,
  message: string,
  cachedContext?: BusinessContext // ✅ Accept optional cached context
): Promise<Response> {
  // Use cached context or fetch if not provided
  const context = cachedContext ?? (await buildBusinessContext(tenantId));
  // rest of logic
}
```

**Orchestrator method (caching logic):**

```typescript
async function chat(tenantId: string, sessionId: string, message: string): Promise<ChatResponse> {
  // Build context ONCE
  const businessContext = await buildBusinessContext(tenantId);

  // Pass to all downstream functions
  const llmResponse = await sendToLLM(tenantId, message, businessContext);

  // If we call processResponse, pass cached context
  const response = await processResponse(
    tenantId,
    message,
    businessContext // ✅ Reuse cached context
  );

  return response;
}
```

### Why Not Use Global Cache?

❌ **Global cache is dangerous:**

```typescript
// ❌ WRONG - Global cache can be stale
const contextCache = new Map<string, BusinessContext>();

async function processResponse(tenantId: string) {
  let context = contextCache.get(tenantId);
  if (!context) {
    context = await buildBusinessContext(tenantId);
    contextCache.set(tenantId, context);
  }
  return context;
  // Problem: What if context changed after we cached it?
}
```

**Request-scoped caching is better:**

- Data stays consistent within one request
- No stale cache issues
- No cache invalidation logic needed
- Easy to test (no cleanup)

### When to Use This Pattern

- **Expensive queries:** When query takes >50ms
- **Reused in multiple calls:** When 2+ functions need same data
- **Request-scoped:** When data shouldn't persist across requests
- **Not auth data:** Don't cache authentication data this way

### Alternative: React Query / TanStack Query

For frontend, use query libraries instead:

```typescript
// Next.js / React - Better approach
const { data: context } = useQuery({
  queryKey: ['businessContext', tenantId],
  queryFn: () => buildBusinessContext(tenantId),
  staleTime: 5 * 60 * 1000, // Cache for 5 minutes
});
```

---

## Fix 5: Session Ownership Verification Pattern

### Problem

**Symptom:** Proposal confirmation didn't verify session ownership.

```typescript
// ❌ WRONG - Anyone with proposal ID can confirm
const proposal = await prisma.agentProposal.findFirst({
  where: { id: proposalId, tenantId }, // Only checks tenant
});

// If I guess another user's proposalId, I can confirm THEIR booking!
```

**Impact:**

- Cross-session attacks (confirming proposals from other user sessions)
- Booking data confusion (Alice's session could trigger Bob's booking)
- Audit trail contamination

### Solution: Verify sessionId in Request Body + Database

**Route handler (with ownership verification):**

```typescript
// POST /confirm/:proposalId
router.post('/confirm/:proposalId', async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  const { proposalId } = req.params;

  // ✅ Get sessionId from request body for ownership verification
  const { sessionId } = req.body as { sessionId?: string };

  // Build where clause with tenant isolation + session ownership
  const whereClause: { id: string; tenantId: string; sessionId?: string } = {
    id: proposalId,
    tenantId, // ✅ Tenant isolation (CRITICAL)
  };

  // ✅ If sessionId provided, verify session ownership
  if (sessionId) {
    whereClause.sessionId = sessionId; // Only fetch if belongs to THIS session
  }

  // Fetch proposal with TWO-LEVEL isolation
  const proposal = await prisma.agentProposal.findFirst({
    where: whereClause,
  });

  if (!proposal) {
    res.status(404).json({ error: 'Booking not found' });
    return;
  }

  // ... rest of confirmation logic
});
```

**Client sends sessionId in confirmation request:**

```typescript
// CustomerChatWidget.tsx
const confirmProposal = async () => {
  const response = await fetch(
    `${API_URL}/v1/public/chat/confirm/${pendingProposal.proposalId}`,
    fetchOptions('POST', {
      sessionId, // ✅ Include session ID in request
    })
  );
};
```

### Two-Level Isolation Pattern

| Level       | Protection                                     | Example                     |
| ----------- | ---------------------------------------------- | --------------------------- |
| **Tenant**  | Prevents data leakage between customers        | `tenantId` in WHERE clause  |
| **Session** | Prevents cross-session attacks within a tenant | `sessionId` in WHERE clause |

**Both are CRITICAL:**

- Tenant alone = Customer A could accidentally see Customer B's proposals
- Session alone = User A in Session 1 could confirm proposals from User A in Session 2

### When to Use This Pattern

- **Multi-tenant + sessions:** Two-level isolation
- **Resource ownership:** Always verify at least two levels
- **Request bodies:** Accept ownership verification parameters
- **Sensitive operations:** Confirmations, deletions, payment authorization

### Database Index for Performance

Add index to speed up combined lookups:

```prisma
// schema.prisma
model AgentProposal {
  id          String
  tenantId    String
  sessionId   String
  // ... other fields

  @@index([tenantId, sessionId]) // For WHERE tenantId AND sessionId queries
}
```

---

## Fix 6: Database Index for Multi-Tenant Session Lookup

### Problem

**Symptom:** `getOrCreateSession()` queries by tenantId + sessionType + updatedAt DESC without index.

```typescript
// Without index, this full-table scan query:
const session = await prisma.agentSession.findFirst({
  where: {
    tenantId,
    sessionType: 'CUSTOMER',
    updatedAt: { gt: oneDayAgo },
  },
  orderBy: { updatedAt: 'desc' },
});
```

**Impact:**

- 100+ ms query for large tenants
- Full table scan on every chat message
- Database CPU spikes
- Cascading slowdowns in chat UI

### Solution: Create Composite Index

**Prisma schema:**

```prisma
model AgentSession {
  id          String      @id @default(cuid())
  tenantId    String      // Tenant isolation - CRITICAL
  customerId  String?     // NULL for admin sessions
  sessionType SessionType @default(ADMIN)
  messages    Json        @default("[]")
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  tenant      Tenant      @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  customer    Customer?   @relation(fields: [customerId], references: [id], onDelete: SetNull)

  @@index([tenantId, updatedAt])           // ✅ For recent session queries
  @@index([tenantId])                      // ✅ Basic tenant filtering
  @@index([customerId, updatedAt])         // ✅ Customer session queries
}
```

**Query that uses the index:**

```typescript
// This now uses @@index([tenantId, updatedAt])
const session = await prisma.agentSession.findFirst({
  where: {
    tenantId, // First index column
    sessionType: 'CUSTOMER',
    updatedAt: { gt: oneDayAgo }, // Second index column
  },
  orderBy: { updatedAt: 'desc' },
});
```

### Index Design Rules

**Composite Index Column Order:**

1. **Equality filters first:** `tenantId` (always filtered)
2. **Range filters second:** `updatedAt` (range query)
3. **Sorting columns last:** (OrderBy uses index)

❌ Wrong order: `@@index([updatedAt, tenantId])`
✅ Right order: `@@index([tenantId, updatedAt])`

### When to Add Indexes

| Query Pattern          | Index Needed                 | Column Order         |
| ---------------------- | ---------------------------- | -------------------- |
| WHERE a                | `@@index([a])`               | N/A                  |
| WHERE a AND b          | `@@index([a, b])`            | Equality first       |
| WHERE a AND b > x      | `@@index([a, b])`            | Equality, then range |
| WHERE a AND ORDER BY b | `@@index([a, b])`            | Filter, then sort    |
| WHERE a OR b           | `@@index([a]), @@index([b])` | Separate indexes     |

### Verify Index Usage

```bash
# Check if Prisma created index
npm exec prisma migrate dev

# Or in PostgreSQL:
psql $DATABASE_URL -c "\d agent_session"  # Shows indexes
```

---

## Fix 7: Unused Code Removal (SIMP Pattern)

### Problem

**Symptom:** Several unused functions and properties left over from development.

Examples:

- `addDays()` function never called
- `tenantSlug` prop passed but not used
- `greeting` state variable declared but unused
- `businessSlug` field in data structures

**Impact:**

- Code confusion (is this used? where?)
- Maintenance burden (update unused code?)
- TypeScript unused variable warnings
- Bloated bundle size

### Solution: Remove Unused Code (SIMP = Simplify)

**Before:**

```typescript
// ❌ Unused utility function
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

interface ComponentProps {
  tenantSlug?: string; // ❌ Passed but never used
  businessName: string;
  primaryColor?: string;
}

// ❌ State declared but never used
const [greeting, setGreeting] = useState<string>('');
```

**After:**

```typescript
// ✅ Removed addDays - use Date API directly if needed

interface ComponentProps {
  // ✅ Removed tenantSlug - wasn't used anywhere
  businessName: string;
  primaryColor?: string;
}

// ✅ Removed greeting state - use function return instead
```

### How to Find Unused Code

**TypeScript compiler:**

```bash
npm run typecheck
# Reports: "Unused variable 'greeting'"
```

**IDE detection:**

- VS Code grays out unused variables
- Click variable name, IDE shows "no usages"

**ESLint rule:**

```json
// .eslintrc.json
{
  "rules": {
    "@typescript-eslint/no-unused-vars": [
      "warn",
      {
        "argsIgnorePattern": "^_", // Allow underscore prefix
        "varsIgnorePattern": "^_"
      }
    ]
  }
}
```

### Underscore Prefix for Intentional Non-Use

Only use `_` prefix if you TRULY can't use the variable:

```typescript
// ✅ CORRECT - Used in conditional
const { greeting, sessionId } = response;
if (greeting) {
  setMessages([{ id, role: 'assistant', content: greeting, timestamp: new Date() }]);
}

// ✅ CORRECT - Passed to logger
const { greeting, sessionId } = response;
logger.info({ sessionId, greeting }, 'Chat started');

// ❌ WRONG - Could delete instead
const { greeting, _unused } = response; // Just delete unused!

// ✅ CORRECT - Required parameter, unused in body
function handler(_req: Request, res: Response) {
  res.json({ ok: true });
}
```

### When to Keep Unused Code

**Only keep if:**

1. Part of public API contract (might be used by external code)
2. Planned for future use (document with TODO comment)
3. Required by framework (e.g., React component props)

**Don't keep unused code "just in case":**

- It's in git history if you need it
- Dead code gets stale
- Future developers assume it's used

---

## Patterns Summary Table

| Pattern               | Problem                     | Solution                                  | Files                            |
| --------------------- | --------------------------- | ----------------------------------------- | -------------------------------- |
| Circular dependencies | A imports B, B imports A    | Registry module both depend on            | `executor-registry.ts`           |
| Type safety bypasses  | `req.tenantId as any`       | TypeScript augmentation                   | `types/express.d.ts`             |
| React list re-renders | Index as key                | Add `id` field, use `crypto.randomUUID()` | `CustomerChatWidget.tsx`         |
| Duplicate queries     | Same query called twice     | Cache in parameter, pass down             | `customer-orchestrator.ts`       |
| Cross-session attacks | Only check tenant isolation | Verify sessionId in WHERE + request body  | `public-customer-chat.routes.ts` |
| Slow lookups          | No index on filtered column | Add composite index by filter order       | `schema.prisma`                  |
| Unused code           | Dead code causes confusion  | Delete it                                 | All files                        |

---

## Compound Learning: Making Future Work Easier

### Document These Patterns Because...

1. **Circular dependency pattern** - Will appear again when adding more executors (webhooks, async tasks)
2. **Type augmentation** - Applicable to Express, Response, Next.js Request objects
3. **React keys** - Prevents future re-render bugs in all dynamic lists
4. **Context caching** - Shows how to pass expensive query results without global state
5. **Two-level isolation** - Critical for all multi-tenant + session features
6. **Index design** - Reference for future database performance work
7. **Unused code** - Sets standard for code cleanliness

### Implementation Checklist for Similar Features

When building new features, ask:

- [ ] **Will this need executors?** → Use executor-registry pattern
- [ ] **Does middleware add properties?** → Use TypeScript augmentation
- [ ] **Rendering dynamic lists?** → Use crypto.randomUUID() + id field
- [ ] **Expensive queries used multiple times?** → Cache in parameter
- [ ] **Multi-tenant + sessions?** → Two-level isolation verification
- [ ] **Database queries on repeated columns?** → Add composite index
- [ ] **Unused variables in code?** → Delete or add TODO comment

### Files Reference

- **Main implementation:** `/server/src/agent/customer/`
- **Type extensions:** `/server/src/types/express.d.ts`
- **Frontend chatbot:** `/apps/web/src/components/chat/CustomerChatWidget.tsx`
- **Routes:** `/server/src/routes/public-customer-chat.routes.ts`
- **Database schema:** `/server/prisma/schema.prisma`

---

## Related Patterns

See also:

- **MAIS-CRITICAL-PATTERNS** - 10 patterns for multi-tenant safety
- **AGENT-TOOL-ARCHITECTURE-DECISION** - Two-phase executor pattern design
- **TYPESCRIPT-UNUSED-VARIABLES-BUILD-FAILURE** - When underscore prefix is needed
- **CASCADING-ENTITY-TYPE-ERRORS** - Preventing type propagation errors
