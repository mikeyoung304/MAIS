# Code Review #708-717 Prevention Strategies

**Date:** 2026-01-09
**Status:** ACTIVE (reference for all new code)
**Related Issues:** #708-717
**Related Commits:** 02cde7e8

This document captures prevention strategies for patterns identified in code review batch #708-717. These are recurring issues that should be prevented proactively.

---

## Quick Reference by Pattern

| Pattern                          | Issue | Severity | Prevention                          |
| -------------------------------- | ----- | -------- | ----------------------------------- |
| TOCTOU on JSON fields            | #708  | P1       | Wrap in transaction + advisory lock |
| Unsafe type assertions           | #709  | P2       | Type guard function before cast     |
| Premature optimization           | #710  | P2       | Document before caching             |
| Message component duplication    | #711  | P2       | Variant prop pattern                |
| Card/Modal component duplication | #712  | P2       | Variant prop pattern                |
| Service logic duplication        | #713  | P2       | Extract to private method           |
| XSS sanitization gaps            | #714  | P3       | Defense-in-depth review             |
| Unused type exports              | #715  | P3       | ESLint no-unused-vars               |
| Missing callback memoization     | #716  | P3       | Profile before optimizing           |
| Quota race conditions            | #717  | P3       | Atomic check-and-increment          |

---

## Issue #708: TOCTOU Race Condition on maxPerDay

### Pattern: Check-Then-Act Without Atomicity

```typescript
// ❌ WRONG: Race condition between check and create
const count = await bookingRepo.countBookingsOnDate(tenantId, date);
if (count >= maxPerDay) {
  throw new Error('Over limit');
}
await bookingRepo.create(booking); // Someone else may have created between check and create!
```

### Root Cause

When count check and booking creation are separate database calls, concurrent requests can pass the check simultaneously before any increment occurs.

### Prevention Strategy

**Checklist: Check-Then-Act Pattern**

- [ ] Does this code check a value and then modify based on that check?
- [ ] Are the check and modification in separate database calls?
- [ ] Could concurrent requests both pass the check before either modification?

**If YES to all three: Use advisory locks with transaction**

### Solution Pattern

```typescript
// ✅ CORRECT: Atomic check-and-create with advisory lock
await prisma.$transaction(async (tx) => {
  // Step 1: Acquire advisory lock (unique per tenant+service+date)
  const lockId = hashServiceDate(tenantId, serviceId, dateStr);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;

  // Step 2: Check count within locked transaction
  const count = await tx.booking.count({
    where: { tenantId, serviceId, date: { ... } }
  });

  // Step 3: Create only if within limit
  if (count >= maxPerDay) {
    throw new MaxBookingsPerDayExceededError(dateStr, maxPerDay);
  }

  // Step 4: Create within same transaction (still locked)
  await tx.booking.create({ data: { ... } });

  // Lock automatically released when transaction commits
});
```

### Key Pattern Elements

1. **Advisory Lock Hash Function** - Same input always produces same lock ID

   ```typescript
   // From server/src/lib/advisory-locks.ts
   export function hashServiceDate(tenantId: string, serviceId: string, dateStr: string): number {
     const combined = `${tenantId}:${serviceId}:${dateStr}`;
     return hashCode(combined);
   }
   ```

2. **Transaction Scope** - Lock spans entire check-and-create operation

   ```typescript
   // Lock held from pg_advisory_xact_lock() until transaction commits
   await prisma.$transaction(async (tx) => {
     // Lock acquired here
     await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;
     // ... check and create ...
   }); // Lock released here
   ```

3. **Condition Check Before Mutation** - Validate before creating
   ```typescript
   if (existingCount >= maxPerDay) {
     throw new MaxBookingsPerDayExceededError(...); // Transaction aborts, lock released
   }
   await tx.booking.create(...); // Only reached if check passes
   ```

### Code Review Questions

- Are multiple database operations being performed with the assumption that the first operation's result is still valid?
- Could a concurrent process modify data between operations?
- Is the code in the critical path for bookings, payments, or quota enforcement?

### Test Case Pattern

```typescript
test('should reject booking when maxPerDay limit reached under concurrency', async () => {
  const { tenantId, serviceId } = await createTestSetup();

  // Create requests that will race
  const [result1, result2] = await Promise.all([
    appointmentService.onAppointmentPaymentCompleted(tenantId, {
      serviceId,
      startTime: today,
      sessionId: 'session1',
    }),
    appointmentService.onAppointmentPaymentCompleted(tenantId, {
      serviceId,
      startTime: today,
      sessionId: 'session2',
    }),
  ]);

  // Only one should succeed (the other throws MaxBookingsPerDayExceededError)
  expect((result1 && !result2) || (!result1 && result2)).toBe(true);
});
```

---

## Issue #709: Unsafe Type Assertions

### Pattern: Direct Cast Without Validation

```typescript
// ❌ WRONG: Assumes data structure without checking
const toolData = result.data as { uiAction?: AgentUIAction };
if (toolData.uiAction) {
  onUIAction(toolData.uiAction); // What if uiAction has wrong structure?
}
```

### Root Cause

TypeScript casts (`as SomeType`) are compile-time only and don't validate at runtime. Any object can be cast to any type.

### Prevention Strategy

**Checklist: Type Assertion Safety**

- [ ] Is this a runtime value (from API, user input, etc.)?
- [ ] Am I using `as SomeType` to bypass type checking?
- [ ] Have I validated the value's structure before using it?

**If runtime + using `as` + no validation: Create type guard**

### Solution Pattern

```typescript
// ✅ CORRECT: Type guard validates structure at runtime
interface UIAction {
  type: 'SHOW_PREVIEW' | 'SHOW_DASHBOARD' | 'HIGHLIGHT_SECTION' | 'NAVIGATE';
  data?: unknown;
}

function hasUIAction(data: unknown): data is { uiAction: UIAction } {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const obj = data as Record<string, unknown>;
  if (!('uiAction' in obj) || typeof obj.uiAction !== 'object' || obj.uiAction === null) {
    return false;
  }

  const action = obj.uiAction as Record<string, unknown>;
  const validTypes = ['SHOW_PREVIEW', 'SHOW_DASHBOARD', 'HIGHLIGHT_SECTION', 'NAVIGATE'];

  return typeof action.type === 'string' && validTypes.includes(action.type);
}

// Usage: Only access uiAction if type guard passes
if (result.success && hasUIAction(result.data)) {
  onUIAction(result.data.uiAction); // Type narrowing guarantees structure
}
```

### Key Pattern Elements

1. **Type Predicate Function** - Returns `data is SpecificType`

   ```typescript
   // This signature means: "if this returns true, TypeScript treats data as SpecificType"
   function hasUIAction(data: unknown): data is { uiAction: UIAction } { ... }
   ```

2. **Defensive Structure Checks** - Validate each level

   ```typescript
   // Check type first
   if (typeof data !== 'object' || data === null) return false;

   // Check required fields exist
   if (!('uiAction' in obj)) return false;

   // Check nested type
   if (typeof obj.uiAction !== 'object' || obj.uiAction === null) return false;

   // Check enum values
   const validTypes = ['SHOW_PREVIEW', 'SHOW_DASHBOARD', ...];
   return validTypes.includes(action.type);
   ```

3. **Narrowed Usage** - Only access properties after guard passes
   ```typescript
   if (hasUIAction(result.data)) {
     // Inside this block, TypeScript knows result.data is { uiAction: UIAction }
     onUIAction(result.data.uiAction); // ✅ Safe
   }
   ```

### Code Review Questions

- Is this value coming from an external source (API, user input, agent response)?
- Could the source structure change without updating this code?
- Are there any `as SomeType` casts without preceding validation?
- What happens if the cast is wrong at runtime?

### Common Guard Patterns

```typescript
// Discriminated union validation
function isSuccess(result: Result): result is SuccessResult {
  return result.status === 'success';
}

// Array element validation
function isValidTool(item: unknown): item is ToolDefinition {
  return (
    typeof item === 'object' &&
    item !== null &&
    'name' in item &&
    'execute' in item &&
    typeof (item as Record<string, unknown>).name === 'string' &&
    typeof (item as Record<string, unknown>).execute === 'function'
  );
}

// Property presence validation
function hasAllRequired(obj: unknown): obj is { id: string; name: string } {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'name' in obj &&
    typeof (obj as Record<string, unknown>).id === 'string' &&
    typeof (obj as Record<string, unknown>).name === 'string'
  );
}
```

---

## Issue #710: Premature Optimization (Zod Validation Caching)

### Pattern: Adding Caching Complexity Before Measuring

```typescript
// ❌ Premature: Adds complexity without understanding bottleneck
const cache = new Map<string, DraftConfig>();

function getDraftConfig(tenantId: string): DraftConfig {
  if (cache.has(tenantId)) {
    return cache.get(tenantId)!;
  }
  const config = parseDraftConfigWithZod(tenant.landingPageConfig);
  cache.set(tenantId, config);
  return config;
}
```

### Root Cause

Without profiling, you don't know if Zod validation is actually the bottleneck. Database latency often dominates, making caching unnecessary complexity.

### Prevention Strategy

**Checklist: Optimization Decisions**

- [ ] Have I measured the current performance?
- [ ] Is this specifically the slowest part?
- [ ] Would caching actually help (or is latency elsewhere)?
- [ ] What's the complexity cost (invalidation, memory, stale data)?

**Always profile before optimizing**

### Solution Pattern

```typescript
// ✅ CORRECT: Document decision based on measurement
/**
 * Parse and validate draft configuration.
 *
 * NOTE: Zod validation is NOT the bottleneck (profiled 2026-01-09).
 * Latency breakdown:
 * - Database fetch: 45ms (75%)
 * - Zod validation: 12ms (20%)
 * - Total: 60ms
 *
 * Caching would add:
 * - Memory overhead: ~2KB per tenant
 * - Invalidation complexity: When config is updated
 * - Stale data risk: Config updated by storefront editor
 *
 * Decision: Accept latency, keep code simple. Revisit if DB queries
 * become significantly slower (e.g., >100ms).
 */
function getDraftConfig(tenantId: string): DraftConfig {
  const config = parseDraftConfigWithZod(tenant.landingPageConfig);
  return config;
}
```

### When Caching IS Justified

```typescript
// ✅ Example where caching is worth the complexity:
// - Validation happens 100+ times per request
// - Validation is computationally expensive (regex, complex logic)
// - Configuration rarely changes
// - Cache invalidation is simple (event-based)

const configCache = new Map<string, DraftConfig>();
let lastInvalidated = Date.now();

function getDraftConfigCached(
  tenantId: string,
  invalidateAfter = 5 * 60 * 1000 // 5 minutes
): DraftConfig {
  // Invalidate stale cache
  if (Date.now() - lastInvalidated > invalidateAfter) {
    configCache.clear();
    lastInvalidated = Date.now();
  }

  if (configCache.has(tenantId)) {
    return configCache.get(tenantId)!;
  }

  const config = parseDraftConfigWithZod(tenant.landingPageConfig);
  configCache.set(tenantId, config);
  return config;
}

// Invalidate when config changes
function updateDraftConfig(...) {
  configCache.delete(tenantId);
  // ... update in database ...
}
```

### Code Review Questions

- Has this been measured as the actual bottleneck?
- What's the cache hit rate in production?
- How is stale data handled when config updates?
- What's the memory impact per cached item × number of tenants?

---

## Issue #711: MessageBubble Component Duplication

### Pattern: Duplicate Components with Minor Styling Differences

```typescript
// ❌ WRONG: Two nearly-identical components
// apps/web/src/components/agent/MessageBubble.tsx
// apps/web/src/components/agent/PanelMessageBubble.tsx
// 90% same code, 10% styling differences
```

### Root Cause

When two components differ only in styling, copy-paste creates maintenance burden. Both need updates when logic changes.

### Prevention Strategy

**Checklist: Component Duplication Detection**

- [ ] Does this component look similar to an existing one?
- [ ] Are the differences only styling/layout?
- [ ] Would a `variant` or `size` prop eliminate the duplication?

**If YES to all three: Use variant pattern**

### Solution Pattern

```typescript
// ✅ CORRECT: Single ChatMessage component with variant support
export type ChatMessageVariant = 'default' | 'compact';

interface ChatMessageProps {
  message: ChatMessage;
  variant?: ChatMessageVariant;
  onConfirmProposal?: (proposalId: string) => void;
  onRejectProposal?: (proposalId: string) => void;
}

const variantStyles = {
  default: {
    bubble: 'p-4 rounded-2xl shadow-lg',
    text: 'text-base',
    spacing: 'mb-4'
  },
  compact: {
    bubble: 'p-2 rounded-lg shadow-sm',
    text: 'text-sm',
    spacing: 'mb-2'
  }
};

export function ChatMessage({
  message,
  variant = 'default',
  onConfirmProposal,
  onRejectProposal
}: ChatMessageProps) {
  const styles = variantStyles[variant];

  return (
    <div className={cn(styles.bubble)}>
      <p className={styles.text}>{message.content}</p>
      {message.proposal && (
        <ProposalCard
          proposal={message.proposal}
          variant={variant}
          onConfirm={onConfirmProposal}
          onReject={onRejectProposal}
        />
      )}
    </div>
  );
}
```

### Variant Configuration Pattern

```typescript
// Style configuration by variant
const variantStyles = {
  default: {
    container: 'mt-3 p-4 rounded-2xl bg-white shadow-lg',
    title: 'font-semibold text-lg',
    button: 'px-4 py-2 rounded-full'
  },
  compact: {
    container: 'mt-1 p-2 rounded-lg bg-gray-50 shadow-sm',
    title: 'font-medium text-sm',
    button: 'px-3 py-1 rounded-lg'
  }
};

// Usage in component
const style = variantStyles[variant];
<div className={style.container}>
  <h3 className={style.title}>Title</h3>
</div>
```

### Code Review Questions

- Could this component be made more reusable with a prop?
- Are the differences only visual (styling, sizing)?
- Would a `variant` prop make the code clearer?

---

## Issue #712: ProposalCard Component Duplication

### Pattern: Card/Modal Variants (Same as #711)

Uses the same variant pattern as MessageBubble. Extract shared card styles to configuration.

### Solution

```typescript
// ✅ CORRECT: Single ProposalCard with variant support
export interface ProposalCardProps {
  proposal: Proposal;
  variant?: ChatMessageVariant; // Inherit parent variant
  onConfirm: () => void;
  onReject: () => void;
}

const variantStyles = {
  default: {
    container: 'mt-3 p-4 rounded-2xl bg-amber-50 border border-amber-200',
    title: 'font-medium text-amber-900',
    preview: 'text-sm text-amber-800',
    buttonContainer: 'flex gap-2'
  },
  compact: {
    container: 'mt-2 p-3 rounded-lg bg-amber-50/60 border border-amber-100',
    title: 'font-medium text-sm text-amber-900',
    preview: 'text-xs text-amber-700',
    buttonContainer: 'flex gap-1'
  }
};

export function ProposalCard({
  proposal,
  variant = 'default',
  onConfirm,
  onReject
}: ProposalCardProps) {
  const style = variantStyles[variant];

  return (
    <div className={style.container}>
      <h4 className={style.title}>{proposal.title}</h4>
      <div className={style.preview}>
        {/* proposal preview */}
      </div>
      <div className={style.buttonContainer}>
        <Button onClick={onConfirm}>Confirm</Button>
        <Button onClick={onReject} variant="outline">Reject</Button>
      </div>
    </div>
  );
}
```

---

## Issue #713: Service Logic Duplication

### Pattern: Same Database Operations in Multiple Methods

```typescript
// ❌ WRONG: Duplicated logic in onboardingFlow and signupFlow
class TenantProvisioningService {
  async onboardingFlow(input) {
    // Create segment
    const segment = await tx.segment.create({ ... });

    // Create 3 default packages
    const packages = await Promise.all([
      tx.package.create({ ...tier1... }),
      tx.package.create({ ...tier2... }),
      tx.package.create({ ...tier3... })
    ]);
  }

  async signupFlow(input) {
    // DUPLICATED: Create segment
    const segment = await tx.segment.create({ ... });

    // DUPLICATED: Create 3 default packages
    const packages = await Promise.all([
      tx.package.create({ ...tier1... }),
      tx.package.create({ ...tier2... }),
      tx.package.create({ ...tier3... })
    ]);
  }
}
```

### Root Cause

Copy-paste of database operations leads to divergence. When business logic changes, both places need updates.

### Prevention Strategy

**Checklist: Service Logic Duplication**

- [ ] Is this code performing the same database operations as elsewhere?
- [ ] Are the operations in multiple public methods?
- [ ] Could this be extracted to a private helper method?

**If YES to all three: Extract to private method**

### Solution Pattern

```typescript
// ✅ CORRECT: Single private method, called from multiple public methods
class TenantProvisioningService {
  /**
   * Creates default segment and 3 tier packages (PRIVATE)
   *
   * This is the single source of truth for default structure.
   * Called from all flows that need to initialize a tenant.
   */
  private async createDefaultSegmentAndPackages(
    tx: PrismaTransactionClient,
    tenantId: string
  ): Promise<{ segment: Segment; packages: Package[] }> {
    // Create default segment
    const segment = await tx.segment.create({
      data: {
        tenantId,
        slug: DEFAULT_SEGMENT.slug,
        name: DEFAULT_SEGMENT.name,
        description: DEFAULT_SEGMENT.description,
        sortOrder: 0,
        active: true,
      },
    });

    // Create default packages
    const packagePromises = Object.values(DEFAULT_PACKAGE_TIERS).map((tier) =>
      tx.package.create({
        data: {
          tenantId,
          segmentId: segment.id,
          slug: tier.slug,
          name: tier.name,
          description: tier.description,
          basePrice: tier.basePrice,
          groupingOrder: tier.groupingOrder,
          active: true,
        },
      })
    );

    const packages = await Promise.all(packagePromises);

    return { segment, packages };
  }

  // Public method 1: Signup flow
  async signupFlow(input: SignupInput) {
    return await prisma.$transaction(async (tx) => {
      // ... other setup ...
      const { segment, packages } = await this.createDefaultSegmentAndPackages(tx, tenantId);
      // ... more setup ...
    });
  }

  // Public method 2: Onboarding flow
  async onboardingFlow(input: OnboardingInput) {
    return await prisma.$transaction(async (tx) => {
      // ... other setup ...
      const { segment, packages } = await this.createDefaultSegmentAndPackages(tx, tenantId);
      // ... more setup ...
    });
  }
}
```

### Constants for Default Values

```typescript
// apps/shared/src/constants/tenant-defaults.ts
export const DEFAULT_SEGMENT = {
  slug: 'general',
  name: 'General',
  heroTitle: 'Services',
  description: 'Default service category',
} as const;

export const DEFAULT_PACKAGE_TIERS = {
  tier1: {
    slug: 'basic-package',
    name: 'Basic Package',
    description: 'Entry-level offering',
    basePrice: 0,
    groupingOrder: 1,
  },
  tier2: {
    slug: 'standard-package',
    name: 'Standard Package',
    description: 'Most popular option',
    basePrice: 0,
    groupingOrder: 2,
  },
  tier3: {
    slug: 'premium-package',
    name: 'Premium Package',
    description: 'Full experience',
    basePrice: 0,
    groupingOrder: 3,
  },
} as const;
```

### Code Review Questions

- Is this logic needed in multiple places?
- Could changes to one instance break another?
- Would a shared helper method prevent divergence?

---

## Issue #714: XSS Sanitization Gaps (P3)

See `/Users/mikeyoung/CODING/MAIS/todos/714-pending-p3-xss-bypass-patterns-review.md` for details on bypass patterns and current mitigations.

**Short Summary:**

- Current defenses (React JSX escaping, no dangerouslySetInnerHTML, CSP) are defense-in-depth
- Low priority: No known exploits through these patterns
- Recommended future enhancement: Normalize input before pattern matching

---

## Issue #715: Unused Type Exports (P3)

### Pattern: Types Exported But Never Imported

```typescript
// ❌ WRONG: Export if only used locally
export type SessionContext = {
  sessionId: string;
  // ...
};

// Only imported in same file where it's defined
const context: SessionContext = { ... };
```

### Prevention Strategy

**Checklist: Export Necessity**

- [ ] Is this type exported?
- [ ] Is it imported anywhere outside this file?
- [ ] Could this be a local type instead?

**ESLint Configuration:**

```json
{
  "rules": {
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_"
      }
    ],
    "unused-imports/no-unused-imports": "error"
  }
}
```

### Solution

```typescript
// ✅ CORRECT: Remove export if only used locally
type SessionContext = {
  sessionId: string;
  // ...
};

const context: SessionContext = { ... };

// ✅ Or export only if truly needed externally
export type PublicSessionContext = {
  userId: string;
  // ...
};
```

---

## Issue #716: Missing Callback Memoization (P3)

### Pattern: Unstable Callback References Passed to Lists

```typescript
// ⚠️ OKAY for small lists, but not ideal for 100+ items
<MessageBubble onAction={(action) => handleAction(action)} />
<ProposalCard onConfirm={() => confirmProposal(id)} />
```

### Prevention Strategy

**Only optimize if:**

- [ ] List has 100+ items AND
- [ ] Callbacks are passed to each item AND
- [ ] Child components use React.memo

**Otherwise: Keep code simple**

### Solution When Needed

```typescript
// ✅ CORRECT: Memoized callback for large lists
const handleConfirm = useCallback(
  (proposalId: string) => {
    confirmProposal(proposalId);
  },
  [confirmProposal]
);

const handleReject = useCallback(
  (proposalId: string) => {
    rejectProposal(proposalId);
  },
  [rejectProposal]
);

return (
  <div>
    {proposals.map((proposal) => (
      <ProposalCard
        key={proposal.id}
        proposal={proposal}
        onConfirm={() => handleConfirm(proposal.id)}
        onReject={() => handleReject(proposal.id)}
      />
    ))}
  </div>
);
```

---

## Issue #717: Quota Increment Race Condition (P3)

### Pattern: Quota Check-Then-Increment Without Atomicity

```typescript
// ⚠️ VERY LOW RISK: Quota enforcement is advisory, not hard limit
async chat(message: string): Promise<ChatResponse> {
  // Check quota (can race)
  const { tier, aiMessagesUsed } = await this.prisma.tenant.findUnique(...);
  if (isOverQuota(tier, aiMessagesUsed)) {
    return { message: "quota exceeded" };
  }

  // Process (takes time, other requests can race)
  const response = await super.chat(message);

  // Increment (after processing)
  await this.prisma.tenant.update({
    data: { aiMessagesUsed: { increment: 1 } }
  });
}
```

### Risk Assessment

- **Likelihood:** Very low (requires exact timing across concurrent requests)
- **Impact:** Very low (FREE tier = 50 msgs/month, overage by 1 is minor)
- **Enforcement:** Stripe handles actual payment limits, not this counter

**Decision:** ACCEPT as-is for now. Document the behavior.

### If Strict Enforcement Needed Later

```typescript
// ✅ CORRECT: Atomic check-and-increment
async chat(message: string): Promise<ChatResponse> {
  // Use atomic transaction with advisory lock if needed
  const canProceed = await this.prisma.$transaction(async (tx) => {
    const lockId = hashTenantQuota(tenantId);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;

    const tenant = await tx.tenant.findUnique({
      where: { id: tenantId }
    });

    if (isOverQuota(tenant.tier, tenant.aiMessagesUsed)) {
      return false; // Transaction aborts naturally
    }

    // Increment within same transaction (atomic)
    await tx.tenant.update({
      where: { id: tenantId },
      data: { aiMessagesUsed: { increment: 1 } }
    });

    return true;
  });

  if (!canProceed) {
    throw new QuotaExceededError();
  }

  // Now process (quota already incremented atomically)
  const response = await super.chat(message);
  return response;
}
```

---

## React 19 Ref Type Compatibility

### Pattern: RefObject Type Mismatch

```typescript
// ⚠️ React 18 JSX compatibility issue
const messagesEndRef = useRef<HTMLDivElement | null>(null);
// Type: React.RefObject<HTMLDivElement | null>
// Used in: <div ref={messagesEndRef} />
// Error: Type mismatch (JSX expects RefObject without | null)
```

### Root Cause

React 18 and 19 have different ref type expectations. `RefObject<T | null>` doesn't match JSX's `LegacyRef<T>`.

### Solution

```typescript
// ✅ CORRECT: Cast to remove | null for JSX compatibility
const messagesEndRef = useRef<HTMLDivElement>(
  null
) as React.RefObject<HTMLDivElement>;

const inputRef = useRef<HTMLTextAreaElement>(
  null
) as React.RefObject<HTMLTextAreaElement>;

// Usage in JSX (now type-safe)
<div ref={messagesEndRef} />
<textarea ref={inputRef} />
```

### Why This Works

- `useRef<T>(null)` returns `RefObject<T | null>` internally
- Cast to `RefObject<T>` tells TypeScript "I handle the null case"
- JSX now accepts the ref without complaints
- Runtime behavior unchanged (ref still holds `null` initially)

---

## Code Review Checklist

Use this checklist when reviewing code for these patterns:

### Security & Data Integrity

- [ ] Check-then-act patterns wrapped in transactions with advisory locks?
- [ ] Type assertions have type guards before them?
- [ ] No unsafe casts of external data (API responses, user input)?
- [ ] All multi-tenant queries filtered by tenantId?

### Code Quality

- [ ] Similar components use variant pattern instead of duplication?
- [ ] Duplicate logic extracted to shared methods?
- [ ] Unused exports removed or documented?
- [ ] Only necessary components wrapped with memo/useCallback?

### Performance

- [ ] Optimizations based on actual measurements, not assumptions?
- [ ] Cache invalidation strategy documented?
- [ ] Memory impact of caching considered?

### Type Safety

- [ ] No `any` without justification?
- [ ] Type predicates used for runtime validation?
- [ ] React ref types compatible with JSX?

---

## Integration with CLAUDE.md

Add to CLAUDE.md Common Pitfalls section:

```markdown
- **TOCTOU on JSON fields:** Wrap check-then-act in `$transaction` with advisory lock (`hashServiceDate`)
- **Unsafe type assertions:** Create type predicate with structure validation, don't just use `as SomeType`
- **Component duplication:** Use `variant` prop pattern for styling variations, not separate components
- **Service logic duplication:** Extract to private helper, called from all public paths
- **Premature optimization:** Always profile before adding caching complexity
- **React ref types:** Cast `useRef<T>(null) as React.RefObject<T>` for JSX compatibility
```

---

## Related Documentation

- **[MULTI_AGENT_CODE_REVIEW_PREVENTION_STRATEGIES.md](MULTI_AGENT_CODE_REVIEW_PREVENTION_STRATEGIES.md)** - Code review workflow and reviewer selection
- **[CHATBOT_PROPOSAL_EXECUTION_FLOW.md](../logic-errors/chatbot-proposal-execution-flow-MAIS-20251229.md)** - Related tool/executor patterns
- **[CIRCULAR_DEPENDENCY_EXECUTOR_REGISTRY.md](CIRCULAR_DEPENDENCY_EXECUTOR_REGISTRY_MAIS-20251229.md)** - Related DI pattern
- **[ATOMIC_TENANT_PROVISIONING_DEFENSE_IN_DEPTH.md](atomic-tenant-provisioning-defense-in-depth-MAIS-20260105.md)** - Related multi-entity creation patterns

---

## Version History

| Date       | Changes                                          |
| ---------- | ------------------------------------------------ |
| 2026-01-09 | Initial creation from code review batch #708-717 |

**Next Review:** 2026-02-09 (monthly review of prevention strategies)
**Owner:** Engineering Team
