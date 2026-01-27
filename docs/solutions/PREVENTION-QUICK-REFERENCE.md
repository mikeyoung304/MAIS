---
module: MAIS
date: 2025-12-04
problem_type: documentation_gap
component: docs/solutions
symptoms:
  - Developers commit code without checking tenant isolation
  - Missing audit logs in service methods
  - window.confirm/alert usage in React components
  - N+1 query patterns in database queries
  - console.log instead of structured logging
root_cause: Quick reference cheat sheet for daily development patterns
resolution_type: reference_doc
severity: P3
tags: [cheat-sheet, security, multi-tenant, quick-reference, daily-use]
---

# Prevention Strategies - Quick Reference

**Print this and pin it to your wall! 📌**

---

## 🚨 Before Committing ANY Code

### Multi-Tenant Security (CRITICAL)

```typescript
// ✅ ALWAYS filter by tenantId
const packages = await prisma.package.findMany({
  where: { tenantId }, // ← NEVER forget this!
});

// ❌ NEVER query without tenantId
const packages = await prisma.package.findMany();
```

```typescript
// ✅ ALWAYS validate ownership of foreign keys
if (data.segmentId) {
  await segmentService.getById(tenantId, data.segmentId);
  // Throws if segment doesn't belong to tenant
}

// ❌ NEVER trust user-provided IDs
await prisma.package.create({
  data: { segmentId: data.segmentId }, // ← No validation!
});
```

```typescript
// ✅ ALWAYS use tenant-scoped cache keys
const key = `catalog:${tenantId}:packages`;

// ❌ NEVER use global cache keys
const key = 'catalog:packages'; // ← Leaks data between tenants!
```

---

### Input Normalization (CRITICAL)

```typescript
// ✅ ALWAYS normalize email before storage/queries
const email = inputEmail.toLowerCase().trim();

// ❌ NEVER use raw email input
const tenant = await prisma.tenant.findUnique({
  where: { email: inputEmail }, // ← Case-sensitive!
});
```

```typescript
// ✅ Test with ALL case variations
const testCases = [
  'user@example.com',
  'USER@EXAMPLE.COM',
  'User@Example.Com',
  '  user@example.com  ',
];
```

---

### Database Patterns (CRITICAL)

```typescript
// ✅ NEVER create new PrismaClient
import { prisma } from '../lib/db'; // Use singleton

// ❌ Connection pool exhaustion!
const prisma = new PrismaClient(); // ← Creates 20 connections
```

```typescript
// ✅ Prevent N+1 queries
const packages = await prisma.package.findMany({
  where: { tenantId },
  include: { addOns: true }, // ← Single query
});

// ❌ N+1 query pattern
const packages = await prisma.package.findMany({ where: { tenantId } });
for (const pkg of packages) {
  pkg.addOns = await prisma.addOn.findMany({
    // ← N queries!
    where: { packageId: pkg.id },
  });
}
```

---

### Zod Parameter Validation (CRITICAL for Agent Tools)

```typescript
// ✅ ALWAYS validate params with Zod safeParse FIRST
const ParamsSchema = z.object({
  packageId: z.string().min(1, 'Package ID required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
});

async execute(context: ToolContext, params: Record<string, unknown>) {
  // FIRST LINE - validate before any logic
  const result = ParamsSchema.safeParse(params);
  if (!result.success) {
    return { success: false, error: result.error.errors[0]?.message };
  }
  const { packageId, date } = result.data; // ← Now safe to use
}

// ❌ NEVER use type assertion without validation
const { packageId } = params as { packageId: string }; // ← Runtime crash risk!

// ❌ NEVER use .parse() (throws on error)
const { packageId } = ParamsSchema.parse(params); // ← Crashes agent!

// ❌ NEVER use .uuid() on CUID fields
z.string().uuid() // ← MAIS uses CUIDs, not UUIDs
```

**Full reference:** [ZOD_PARAMETER_VALIDATION_PREVENTION.md](./patterns/ZOD_PARAMETER_VALIDATION_PREVENTION.md)

---

### Logging & Debugging

```typescript
// ✅ Use logger from lib/core/logger
import { logger } from '../lib/core/logger';
logger.info({ userId }, 'User logged in');

// ❌ NEVER use console.log in production code
console.log('User logged in', userId); // ← ESLint will block this
```

---

### UI Patterns

```typescript
// ✅ Use AlertDialog for confirmations
import { AlertDialog, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog";

<AlertDialog open={isOpen} onOpenChange={setIsOpen}>
  <AlertDialogContent>
    <AlertDialogTitle>Confirm Action?</AlertDialogTitle>
    <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={handleConfirm}>Confirm</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>

// ❌ NEVER use browser prompt/alert/confirm
const email = prompt('Enter email'); // ← ESLint will block this
if (!window.confirm('Delete?')) return; // ← ESLint will block this
```

```typescript
// ✅ Memoize derived values
const effectiveValues = useMemo(
  () => ({
    title: draft.title ?? live.title,
    price: draft.price ?? live.price,
  }),
  [draft.title, live.title, draft.price, live.price]
);

// ❌ Recalculated on every render
const effectiveTitle = draft.title ?? live.title;
const effectivePrice = draft.price ?? live.price;
```

```typescript
// ✅ IFRAME REFRESH: Reload iframe when server-rendered data changes
// Server returns indicator in tool result
return { packages: [...], packageCount: 3, hasDraft: true };

// Frontend detects and refreshes with 150ms delay
if (resultWithPackages) {
  setTimeout(() => agentUIActions.refreshPreview(), 150);
}

// Iframe component watches key, skips initial 0 value
useEffect(() => {
  if (previewRefreshKey > 0 && previewRefreshKey !== prev.current) {
    prev.current = previewRefreshKey;
    iframeRef.current.src = iframeUrl;  // Full reload
  }
}, [previewRefreshKey, iframeUrl]);

// ❌ NEVER try PostMessage for server-rendered data
// PostMessage only updates dynamic draftConfig, not HTML
iframeRef.current.contentWindow.postMessage({ packages: newData }, origin);
// ^ Prices won't update - need full iframe reload instead

// See: docs/solutions/patterns/IFRAME_REFRESH_PREVENTION_INDEX.md
```

---

### Backend Logging Pattern

```typescript
// ✅ Use structured logger with audit trail
import { logger } from '../lib/core/logger';

async saveDraft(tenantId: string, id: string, draft: DraftInput) {
  const result = await this.repo.updateDraft(tenantId, id, draft);

  logger.info({
    action: 'package_draft_saved',
    tenantId,
    packageId: id,
    changedFields: Object.keys(draft),
  }, 'Package draft saved');

  return result;
}

// ❌ NEVER use console.log in production code
console.log('Draft saved', id); // ← ESLint will block this
```

---

## 📋 Code Review Checklist

Copy-paste this into your PR description:

```markdown
## Multi-Tenant Security

- [ ] All queries filter by tenantId
- [ ] Foreign keys validate ownership
- [ ] Cache keys include tenantId
- [ ] Error messages don't leak tenant info

## Input Handling

- [ ] Emails normalized to lowercase
- [ ] Test cases cover case variations
- [ ] Whitespace trimmed from input

## Database Performance

- [ ] No N+1 query patterns
- [ ] Indexes exist for WHERE clauses
- [ ] No new PrismaClient() instantiated
- [ ] Pagination for unbounded queries

## React UI & Performance

- [ ] No window.confirm/alert/prompt (use AlertDialog)
- [ ] Derived values wrapped in useMemo()
- [ ] Event handlers wrapped in useCallback()
- [ ] WCAG focus indicators (focus-visible:ring-2)
- [ ] No module-level QueryClient/Router refs (use hooks or global instance)

## Backend Logging

- [ ] All mutations have logger.info() calls
- [ ] Logs include action, tenantId, resourceId, changedFields
- [ ] No console.log usage
- [ ] Appropriate log level (info/warn/error)

## Feature Completeness

- [ ] Backend routes implemented
- [ ] Frontend UI implemented
- [ ] Tests cover happy + error paths
- [ ] Documentation updated

## Testing - Correctness

- [ ] Tenant isolation tested
- [ ] Input normalization tested
- [ ] Idempotency tested (webhooks)
- [ ] Performance tested (N+1 check)

## Testing - Reliability (CRITICAL)

- [ ] Tests use sequential await (not Promise.all for correctness)
- [ ] Bulk operations have explicit timeouts (>10 records = 15-30s)
- [ ] Cleanup code has guards (if (container.prisma))
- [ ] Mock adapters export all dependencies
- [ ] No parallel execution unless stress test
```

---

## 🧪 Required Test Patterns

### Tenant Isolation

```typescript
it('should not return data from other tenants', async () => {
  const tenantA = await createTestTenant();
  const tenantB = await createTestTenant();

  await repo.create(tenantA.id, { name: 'A' });
  await repo.create(tenantB.id, { name: 'B' });

  const resultsA = await repo.findAll(tenantA.id);
  expect(resultsA).toHaveLength(1);
  expect(resultsA[0].name).toBe('A');
});
```

### Input Normalization

```typescript
const cases = ['user@example.com', 'USER@EXAMPLE.COM', '  User@Example.Com  '];
cases.forEach((email) => {
  it(`should normalize "${email}"`, async () => {
    const result = await service.login(email, 'password');
    expect(result).toBeDefined();
  });
});
```

### Idempotency

```typescript
it('should handle duplicate events', async () => {
  await processWebhook(payload);
  await processWebhook(payload); // Same payload

  const bookings = await repo.findAll(tenantId);
  expect(bookings).toHaveLength(1); // Only created once
});
```

### Sequential Execution (Prevent Flaky Tests)

```typescript
// ✅ CORRECT - Sequential for correctness tests
it('should create multiple records', async () => {
  await service.create(tenantId, { name: 'A' });
  await service.create(tenantId, { name: 'B' });
  await service.create(tenantId, { name: 'C' });

  const records = await repo.findAll(tenantId);
  expect(records).toHaveLength(3);
});

// ❌ WRONG - Parallel execution causes timeouts
it('should create multiple records', async () => {
  await Promise.all([
    service.create(tenantId, { name: 'A' }),
    service.create(tenantId, { name: 'B' }),
    service.create(tenantId, { name: 'C' }),
  ]); // Transaction contention!
});
```

### Bulk Operations with Timeouts

```typescript
// ✅ CORRECT - Explicit timeout for bulk operations
it('should create 50 packages', async () => {
  for (let i = 0; i < 50; i++) {
    await service.create(tenantId, { slug: `pkg-${i}`, ... });
  }

  const packages = await repo.findAll(tenantId);
  expect(packages).toHaveLength(50);
}, 30000); // 30 second timeout

// ❌ WRONG - Default 5s timeout will fail
it('should create 50 packages', async () => {
  for (let i = 0; i < 50; i++) {
    await service.create(tenantId, { slug: `pkg-${i}`, ... });
  }
}); // Likely to timeout!
```

### Safe Cleanup

```typescript
// ✅ CORRECT - Guards in cleanup
afterAll(async () => {
  if (container.prisma) {
    await container.prisma.$disconnect();
  }

  if (container.cacheAdapter?.disconnect) {
    await container.cacheAdapter.disconnect();
  }
});

// ❌ WRONG - Assumes dependencies exist
afterAll(async () => {
  await container.prisma.$disconnect(); // Fails in mock mode!
});
```

---

## ⚡ ESLint Quick Fixes

### If you see: `no-console` error

```typescript
// ❌ WRONG
console.log('Debug info');

// ✅ RIGHT
import { logger } from '../lib/core/logger';
logger.info('Debug info');
```

### If you see: `no-restricted-syntax` (PrismaClient)

```typescript
// ❌ WRONG
const prisma = new PrismaClient();

// ✅ RIGHT
import { container } from '../di';
const prisma = container.prisma;
```

### If you see: `no-restricted-globals` (prompt)

```typescript
// ❌ WRONG
const email = prompt('Enter email');

// ✅ RIGHT
const [email, setEmail] = useState('');
<Input value={email} onChange={e => setEmail(e.target.value)} />
```

---

## 🔍 Grep Commands for Self-Review

Before submitting PR, run these:

```bash
# Check for missing tenantId filters
rg 'prisma\.\w+\.findMany' --type ts | rg -v 'tenantId'

# Check for new PrismaClient()
rg 'new PrismaClient\(\)' server/src/routes --type ts

# Check for console.log
rg 'console\.log' server/src --type ts

# Check for prompt/alert/confirm (window.confirm anti-pattern)
rg 'prompt\(|alert\(|confirm\(' client/src --type ts
grep -r "window\.confirm\|window\.alert\|window\.prompt" client/src/

# Check for missing audit logs in mutations
grep -E "async (create|update|delete|save|publish|discard)" server/src/services/*.ts -A 20 | grep -L "logger\."

# Check for magic tenantId strings
rg 'tenantId.*=.*(unknown|default|test)' --type ts
```

If any return results, fix before committing!

---

## 📚 Documentation Requirements

### When adding a feature, update:

1. **CLAUDE.md** - Add patterns/gotchas
2. **API Contracts** - Define in `packages/contracts`
3. **Repository Interface** - Update `lib/ports.ts`
4. **This Document** - If new prevention strategy

### Required code comments:

```typescript
/**
 * [Method name]
 *
 * CRITICAL: [Why this pattern matters]
 * - Security concern
 * - Performance concern
 * - Business logic
 *
 * See: docs/solutions/[relevant-doc].md
 */
```

---

## 🎯 Quick Decision Trees

### Should I create a new PrismaClient?

```
Are you in di.ts? → YES → OK
                  → NO  → Use dependency injection
```

### Should I filter by tenantId?

```
Does query touch tenant-scoped data? → YES → ALWAYS filter
                                     → NO  → Only platform admin tables
```

### Should I normalize this email?

```
Is it user input? → YES → ALWAYS normalize
                  → NO  → Already normalized in DB
```

### Should I implement frontend UI?

```
Did I add backend route? → YES → MUST add frontend
                         → NO  → Backend first
```

---

## 🚀 Common Fixes

### Fix: Queries without tenantId

```typescript
// Before
const packages = await prisma.package.findMany();

// After
const packages = await prisma.package.findMany({
  where: { tenantId },
});
```

### Fix: Multiple PrismaClient instances

```typescript
// Before
const prisma = new PrismaClient();

// After (create lib/db.ts)
import { PrismaClient } from '@prisma/client';
export const prisma = new PrismaClient();

// Import everywhere
import { prisma } from '../lib/db';
```

### Fix: N+1 Query Pattern

```typescript
// Before
const packages = await prisma.package.findMany({ where: { tenantId } });
for (const pkg of packages) {
  pkg.addOns = await prisma.addOn.findMany({ where: { packageId: pkg.id } });
}

// After
const packages = await prisma.package.findMany({
  where: { tenantId },
  include: { addOns: true },
});
```

### Fix: Missing email normalization

```typescript
// Before
const tenant = await repo.findByEmail(email);

// After
const tenant = await repo.findByEmail(email.toLowerCase().trim());
```

---

## TypeScript Unused Variables (CRITICAL)

```typescript
// Only prefix with _ if TRULY unused in function body

// ✅ CORRECT - error IS used (passed to logger)
catch (error) {
  logger.error({ error }, 'Failed');  // error is USED here!
  throw new Error('Failed');
}

// ❌ WRONG - don't prefix used variables
catch (_error) {  // WRONG! _error implies unused
  logger.error({ _error }, 'Failed');
}

// ✅ CORRECT - truly unused callback parameter
array.map((_item, index) => index);

// ✅ CORRECT - remove unused instead of prefixing
const { id, name } = entity;  // Only destructure what you use
```

### Underscore Prefix Decision Tree

```
Is variable used ANYWHERE in function body?
├── YES → DO NOT prefix with _
└── NO (truly never referenced)
    ├── Required callback parameter? → Prefix with _
    └── Otherwise → REMOVE IT entirely
```

---

## 🤖 ADK/A2A Agent Development

### A2A Protocol: camelCase Required

```typescript
// ✅ CORRECT - ADK uses camelCase
{
  appName: 'agent',
  userId: 'tenant:user',
  sessionId: 'session-123',
  newMessage: { role: 'user', parts: [{ text: msg }] }
}

// ❌ WRONG - ADK silently rejects snake_case
{
  app_name: 'agent',  // Returns "Session not found"
}
```

### Verify App Name After Deploy

```bash
curl -H "Authorization: Bearer $TOKEN" "$URL/list-apps"
# Returns: ["agent"] ← Use THIS, not directory name
```

### Tool-First Prompts (CRITICAL)

```markdown
❌ WRONG - LLM copies this verbatim
User: "Write headlines"
You: "On it. Check the preview →"

✅ CORRECT - Forces tool execution
User: "Write headlines"
→ FIRST: Call delegate_to_marketing(...)
→ WAIT for result
→ THEN respond with content
```

### Zod Schema Limitations

| ❌ Don't Use | ✅ Use Instead       |
| ------------ | -------------------- |
| `z.record()` | `z.any().describe()` |
| `z.tuple()`  | `z.array()`          |

### Session Isolation (Orchestrator Agents)

```typescript
// Each agent = OWN session!
// Concierge session != Marketing session

// ❌ WRONG - Reusing orchestrator session
callSpecialist(url, msg, tenantId, orchestratorSession);

// ✅ CORRECT - Create per-specialist session
const specialistSession = await createSpecialistSession(url, agentName, tenantId);
callSpecialist(url, msg, tenantId, specialistSession);
```

### State Access

```typescript
// ✅ CORRECT - Map-like API
const tenantId = context.state?.get<string>('tenantId');

// ❌ WRONG - Returns undefined!
const tenantId = context.state.tenantId;
```

**Full ADK reference:** [ADK_QUICK_REFERENCE_CARD.md](./patterns/ADK_QUICK_REFERENCE_CARD.md)
**Session/State reference:** [A2A_SESSION_STATE_QUICK_REFERENCE.md](./patterns/A2A_SESSION_STATE_QUICK_REFERENCE.md)

---

## 🔐 P1 Security Patterns

### Auth: Use Signed Tokens, Not Email Lookup

```typescript
// ❌ WRONG - Email enumeration vulnerability
const user = await userRepo.findByEmail(email);
if (!user) return res.status(404).json({ error: 'User not found' });

// ✅ CORRECT - Signed token with timing-safe comparison
const hashedInput = crypto.createHash('sha256').update(token).digest('hex');
const user = await userRepo.findByResetToken(hashedInput);
if (!user) return res.status(400).json({ error: 'Invalid or expired token' });
```

### Rate Limiting: Tenant-Scoped for Auth Routes

```typescript
// ✅ ALL routes need rate limiting
const myRouteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 500 : 100,
  keyGenerator: (_req, res) => res.locals.tenantAuth?.tenantId || normalizeIp(_req.ip),
  skip: (_req, res) => !res.locals.tenantAuth,
});

router.post('/resource', tenantAuth, myRouteLimiter, handler);
```

### Pagination: Enforce Maximum Limits

```typescript
// ❌ WRONG - Unbounded query
const items = await prisma.booking.findMany({ where: { tenantId } });

// ✅ CORRECT - Paginated with enforced max
const MAX_PAGE_SIZE = 100;
const limit = Math.min(options.limit ?? 50, MAX_PAGE_SIZE);
const items = await prisma.booking.findMany({
  where: { tenantId },
  take: limit + 1, // Fetch extra to detect hasMore
  skip: offset,
});
const hasMore = items.length > limit;
if (hasMore) items.pop();
return { items, hasMore };
```

### Parallelization: Promise.all for Independent Queries

```typescript
// ❌ WRONG - Sequential (150ms with 3 queries)
const packages = await getPackages(tenantId);
const segments = await getSegments(tenantId);
const settings = await getSettings(tenantId);

// ✅ CORRECT - Parallel (50ms total)
const [packages, segments, settings] = await Promise.all([
  getPackages(tenantId),
  getSegments(tenantId),
  getSettings(tenantId),
]);
```

### Optimistic Locking: Version from State, Never Hardcoded

```typescript
// ❌ WRONG - Hardcoded version fails on modified records
await approveRequest({ requestId, expectedVersion: 1 });

// ✅ CORRECT - Version from client state
await approveRequest({ requestId, expectedVersion: request.version });

// Server: Always increment
data: {
  version: {
    increment: 1;
  }
}
```

**Full P1 Security Reference:** [P1-SECURITY-PREVENTION-STRATEGIES.md](./security-issues/P1-SECURITY-PREVENTION-STRATEGIES.md)

---

## Over-Engineering Prevention

### Before Writing "Enterprise" Code

```
1. Does npm package exist? → Use it (check: npm ls | grep keyword)
2. Is it in requirements? → Skip if not (link to issue)
3. What breaks without it? → Nothing = don't build
4. Current scale need this? → <1000 users = probably not
```

### Red Flags (with Detection Commands)

| Phrase                     | Translation             | Detection               |
| -------------------------- | ----------------------- | ----------------------- |
| "Might need later"         | YAGNI violation         | Audit function usage    |
| "Enterprise-grade"         | Over-engineering        | Count lines vs features |
| "Future-proof"             | Predicting requirements | Check if actually used  |
| Custom impl of npm package | Not Invented Here       | `npm ls lru-cache`      |
| >100 lines for cache/audit | Probably too much       | `wc -l module.ts`       |

```bash
# Detect custom implementations of existing deps
npm ls lru-cache && grep -r "class.*Cache" server/src/

# Detect dead code modules (exports > usages)
grep -c "export function" module.ts  # Count exports
grep -rn "functionName" . --include="*.ts" | grep -v "module.ts" | wc -l  # Count usages
```

### Simplicity Rules

```typescript
// DON'T: Custom LRU cache (248 lines in session.cache.ts)
class LRUCache<K, V> { ... }

// DO: Use installed package (10 lines)
import { LRUCache } from 'lru-cache';
const cache = new LRUCache({ max: 2000, ttl: 5 * 60 * 1000 });
```

```typescript
// DON'T: Triple protection mechanisms
await prisma.$transaction(
  async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(...)`; // Lock #1
    if (version !== expected) throw 'MISMATCH'; // Lock #2
  },
  { isolationLevel: 'Serializable' }
); // Lock #3

// DO: Pick ONE - advisory lock OR optimistic locking
// Advisory lock prevents TOCTOU, use ReadCommitted isolation
await prisma.$transaction(
  async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(...)`;
    // ... mutations
  },
  { isolationLevel: 'ReadCommitted' }
);
```

```typescript
// DON'T: O(n) in hot path (Array.shift with 1000 elements)
this.latencies.push(ms);
if (this.latencies.length > 1000) this.latencies.shift(); // O(n)!

// DO: Ring buffer for O(1)
this.latencies[this.index] = ms;
this.index = (this.index + 1) % 1000;
```

### Lines of Code Budget

| Feature       | Reasonable            | Smell   | Over-Engineered |
| ------------- | --------------------- | ------- | --------------- |
| LRU Cache     | 10-30                 | 50-100  | >100            |
| Audit logging | 0 (use logger)        | 20-50   | >50             |
| Metrics       | 0 (use observability) | 30-60   | >100            |
| Service layer | 100-200               | 300-400 | >500            |

### Module Usage Health Check

```bash
# Quick audit for dead code in a module
grep -c "export function" server/src/services/session/session.audit.ts  # 7 exports
grep -rn "audit" server/src/ --include="*.ts" | grep -v "session.audit.ts" | wc -l  # 1 usage = 85% dead!
```

**Full Reference:** [OVER_ENGINEERING_DETECTION_QUICK_REFERENCE.md](./OVER_ENGINEERING_DETECTION_QUICK_REFERENCE.md)
**Multi-Agent Review Patterns:** [MULTI_AGENT_CODE_REVIEW_PATTERNS.md](./code-review-patterns/MULTI_AGENT_CODE_REVIEW_PATTERNS.md)

---

## Large Deletions / Refactoring (CRITICAL)

### Orphan Import Prevention

```bash
# BEFORE deleting any export:
# 1. Find ALL usages first
rg "import.*{.*FunctionName" --type ts
rg "from.*'./path/to/file'" --type ts

# 2. Update ALL importers FIRST
# 3. THEN delete the source

# 4. ALWAYS run clean typecheck before commit
rm -rf server/dist packages/*/dist apps/web/.next
npm run typecheck
```

### Why Incremental Builds Miss This

```
Local: Unchanged file B imports deleted file A
       → B not recompiled (incremental skips unchanged)
       → Build passes locally

CI:    Clean build recompiles ALL files
       → B now compiled
       → "Cannot find module A"
       → BUILD FAILS
```

### Deletion Workflow Checklist

```markdown
- [ ] Run `rg "import.*FunctionName" --type ts` BEFORE deletion
- [ ] Update ALL importing files FIRST
- [ ] Delete the source file/function
- [ ] Run `rm -rf server/dist && npm run typecheck`
- [ ] Only commit if clean typecheck passes
- [ ] (Optional) Create archive branch for rollback insurance
```

**Full Reference:** [ORPHAN_IMPORTS_LARGE_DELETION_PREVENTION.md](./build-errors/ORPHAN_IMPORTS_LARGE_DELETION_PREVENTION.md)

---

## Token-Based Authentication (CRITICAL)

### Generation/Validation Identifier Mismatch

```typescript
// WRONG - Different identifiers for generation vs validation
// Generation (booking.service.ts):
const project = await prisma.project.create({
  data: { customerId: customer.email }, // Stores EMAIL
});
const token = generateToken({ customerId: project.customerId }); // Email in token

// Validation (public-project.routes.ts):
if (token.customerId !== project.booking.customer?.id) {
  // Compares to CUID!
  return 403; // ALWAYS fails - email !== CUID
}

// CORRECT - Same identifier for both
// Generation:
const token = generateToken({ customerId: project.customerId }); // Email

// Validation:
// Note: project.customerId stores email, not CUID
if (token.customerId !== project.customerId) {
  // Both are email
  return 403;
}
```

### Token Auth Checklist

```markdown
Before implementing token-based auth:

- [ ] Document field type (email vs CUID vs UUID) in code comments
- [ ] Verify SAME field used for generation AND validation
- [ ] Add inline comments at validation points explaining comparison
- [ ] Write integration test exercising full flow (generate -> use -> validate)
```

### Quick Detection

```bash
# Find token generation points
rg "generateToken|generateProjectAccessToken|jwt.sign" --type ts

# Find token validation points
rg "validateToken|validateProjectAccessToken|jwt.verify" --type ts -A 10

# Cross-reference: Are they using the same field?
```

**Full Reference:** [project-hub-token-validation-customerid-mismatch.md](./authentication-issues/project-hub-token-validation-customerid-mismatch.md)

---

## Multi-Tenant Configuration URLs

### Static Config Anti-Pattern (CRITICAL)

```typescript
// WRONG - Static URL from env var (same for ALL tenants)
const session = await stripe.createSession({
  success_url: config.STRIPE_SUCCESS_URL, // Breaks multi-tenant!
});

// CORRECT - Build URL with tenant context at request time
const successUrl = `${config.CORS_ORIGIN}/t/${tenant.slug}/book/success`;
const session = await stripe.createSession({
  success_url: successUrl,
  metadata: { tenantSlug: tenant.slug }, // For webhook routing
});
```

### Quick Detection

```bash
# Find potential static URL patterns
rg "config\.\w+_URL|process\.env\.\w+_URL" server/src/services/ --type ts
rg "successUrl|cancelUrl|callbackUrl" server/src/ --type ts -A 3
```

### Decision Tree

```
Is URL customer-facing (redirects, callbacks)?
├── YES → MUST include tenant context (slug or ID)
│   └── Build at request time: `${baseUrl}/t/${tenant.slug}/...`
└── NO (internal API, admin) → Static config may be OK
```

**Full Reference:** [STATIC_CONFIG_MULTI_TENANT_PREVENTION.md](./patterns/STATIC_CONFIG_MULTI_TENANT_PREVENTION.md)

---

## React Query / TanStack Query

### Module-Level QueryClient Singleton (CRITICAL)

```typescript
// WRONG - Module-level ref set via useEffect
let queryClientRef: QueryClient | null = null;

export const setQueryClientRef = (client: QueryClient): void => {
  queryClientRef = client;  // Fragile! Effect order unpredictable
};

export const invalidateCache = (): void => {
  queryClientRef?.invalidateQueries({ queryKey: ['data'] });
  // Fails silently if called before setQueryClientRef
  // Stale after HMR replaces QueryClient
};

// CORRECT Option 1: Use hook (for React components)
const queryClient = useQueryClient();
queryClient.invalidateQueries({ queryKey: ['data'] });

// CORRECT Option 2: Global instance (for external code like agent handlers)
// lib/query-client.ts
export const queryClient = new QueryClient({...});

// app/providers.tsx
<QueryClientProvider client={queryClient}>

// Anywhere in app
import { queryClient } from '@/lib/query-client';
queryClient.invalidateQueries({ queryKey: ['data'] });
```

### When Module-Level IS vs IS NOT Acceptable

| Acceptable                    | Not Acceptable          |
| ----------------------------- | ----------------------- |
| Read-only config              | Set from React effect   |
| Pure utilities                | Needs React context     |
| SDK clients init at app start | HMR-sensitive state     |
| Idempotent initialization     | Server/client different |

### Quick Detection

```bash
# Find module-level QueryClient refs
rg "let.*QueryClient.*=.*null" apps/web/src/ --type ts

# Find setQueryClientRef patterns
rg "setQueryClientRef|queryClientRef\s*=" apps/web/src/ --type ts
```

**Full Reference:** [MODULE_LEVEL_QUERY_CLIENT_SINGLETON_PREVENTION.md](./react-performance/MODULE_LEVEL_QUERY_CLIENT_SINGLETON_PREVENTION.md)

---

## When in Doubt

1. Check similar code in codebase
2. Search docs: `rg "pattern name" docs/`
3. Read CLAUDE.md section
4. Ask in #engineering channel
5. Pair program with senior engineer

---

## 🎓 Training Resources

- [Agent-v2 Safety Tests Implementation Pattern](./testing-patterns/AGENT_V2_SAFETY_TESTS_IMPLEMENTATION_PATTERN.md)
- [P1 Security Prevention Strategies](./security-issues/P1-SECURITY-PREVENTION-STRATEGIES.md)
- [Over-Engineering Prevention](./patterns/OVER_ENGINEERING_PREVENTION.md)
- [Comprehensive Prevention Strategies](./COMPREHENSIVE-PREVENTION-STRATEGIES.md)
- [Multi-Tenant Implementation Guide](../multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md)
- [Static Config Multi-Tenant Prevention](./patterns/STATIC_CONFIG_MULTI_TENANT_PREVENTION.md)
- [Email Case-Sensitivity Prevention](./security-issues/PREVENTION-STRATEGY-EMAIL-CASE-SENSITIVITY.md)
- [TypeScript Unused Variables Prevention](./build-errors/typescript-unused-variables-build-failure-MAIS-20251227.md)
- [Module-Level QueryClient Singleton Prevention](./react-performance/MODULE_LEVEL_QUERY_CLIENT_SINGLETON_PREVENTION.md)
- [Orphan Imports After Large Deletions](./build-errors/ORPHAN_IMPORTS_LARGE_DELETION_PREVENTION.md)
- [CLAUDE.md](../../CLAUDE.md)

---

**Keep this handy! Print it out!**

**Last Updated:** 2026-01-27
