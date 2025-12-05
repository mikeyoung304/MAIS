---
module: MAIS
date: 2025-12-04
problem_type: documentation_gap
component: docs/solutions
symptoms:
  - Developers unsure which prevention doc to consult
  - Duplicate prevention strategies across documents
  - Missing navigation between related prevention docs
  - Unclear which guide applies to specific use cases
root_cause: Index and navigation hub for prevention strategies documentation
resolution_type: reference_doc
severity: P3
tags: [index, navigation, overview, documentation-structure]
---

# Prevention Strategies Documentation Index

This index helps you find the right prevention strategy documentation based on your needs.

---

## 🚀 Quick Start

**New to the project?**

1. Read [Prevention Quick Reference](./PREVENTION-QUICK-REFERENCE.md) (5 min)
2. Complete multi-tenant security quiz (10 min)
3. Review [Implementation Roadmap](./PREVENTION-IMPLEMENTATION-ROADMAP.md) (10 min)

**Before submitting a PR?**
→ Use the checklist in [Prevention Quick Reference](./PREVENTION-QUICK-REFERENCE.md#-code-review-checklist)

**Investigating a production issue?**
→ Check [Comprehensive Prevention Strategies](./COMPREHENSIVE-PREVENTION-STRATEGIES.md#9-post-incident-reviews)

---

## 📚 Documentation Map

### 1. Overview Documents

#### [Comprehensive Prevention Strategies](./COMPREHENSIVE-PREVENTION-STRATEGIES.md)

**Purpose:** Complete guide to preventing critical issues
**Length:** ~8,000 words
**Audience:** All engineers
**When to read:** During onboarding, when implementing new features

**Contains:**

- Code review checklist enhancements
- ESLint rules to enforce
- Required test patterns
- Documentation requirements
- CI/CD gates
- Architectural guardrails
- Developer education plans
- Success metrics

#### [Prevention Quick Reference](./PREVENTION-QUICK-REFERENCE.md)

**Purpose:** Cheat sheet for daily development
**Length:** ~1,500 words
**Audience:** All engineers
**When to read:** Before every commit, keep printed on desk

**Contains:**

- Multi-tenant security patterns
- Input normalization patterns
- Database patterns
- Logging & debugging
- UI patterns
- Code review checklist
- Required test patterns
- ESLint quick fixes
- Grep commands for self-review

#### [Prevention Implementation Roadmap](./PREVENTION-IMPLEMENTATION-ROADMAP.md)

**Purpose:** Rollout plan for prevention strategies
**Length:** ~3,000 words
**Audience:** Tech leads, project managers
**When to read:** Planning sprints, tracking progress

**Contains:**

- 5-phase implementation plan
- Timeline (4 weeks)
- Resource requirements
- Success metrics
- Risk mitigation
- Action items by role
- Monthly review process

---

### 2. Specific Prevention Guides

#### [Email Case-Sensitivity Prevention](./security-issues/PREVENTION-STRATEGY-EMAIL-CASE-SENSITIVITY.md)

**Purpose:** Prevent duplicate accounts from case variations
**Audience:** Engineers working on authentication
**Key Pattern:** Always normalize email to lowercase

**Quick Rule:**

```typescript
const email = inputEmail.toLowerCase().trim();
```

#### [Missing Input Validation Prevention](./security-issues/missing-input-validation-cross-tenant-exposure.md)

**Purpose:** Prevent cross-tenant data access
**Audience:** Engineers working on multi-tenant features
**Key Pattern:** Validate foreign key ownership

**Quick Rule:**

```typescript
if (data.segmentId) {
  await segmentService.getById(tenantId, data.segmentId);
  // Throws if segment doesn't belong to tenant
}
```

#### [Webhook Error Logging PII Exposure](./security-issues/webhook-error-logging-pii-exposure.md)

**Purpose:** Prevent customer PII from being stored in error logs
**Audience:** Engineers working on webhook handlers or error logging
**Key Pattern:** Separate logging layers - detailed logs for server, sanitized for database

**Quick Rule:**

```typescript
// Log details to server (ephemeral)
logger.error({ errors: result.error.flatten() }, 'Validation failed');
// Store only type in DB (persistent)
await repo.markFailed(tenantId, id, 'Validation failed');
```

#### [Test Failure Prevention Strategies](./TEST-FAILURE-PREVENTION-STRATEGIES.md)

**Purpose:** Prevent flaky and non-deterministic test failures
**Audience:** All engineers writing integration tests
**Key Patterns:** Sequential execution, DI completeness, timeout configuration

**Quick Rules:**

```typescript
// Sequential for correctness
await create(); await create(); await create();

// Guards in cleanup
if (container.prisma) await container.prisma.$disconnect();

// Timeouts for bulk operations
it('bulk test', async () => { ... }, 30000);
```

#### [Prisma TypeScript Build Failure Prevention](./PRISMA-TYPESCRIPT-BUILD-PREVENTION.md)

**Purpose:** Prevent TypeScript compilation failures with Prisma JSON types
**Audience:** Engineers working with Prisma JSON fields
**Key Patterns:** Proper imports, `Prisma.InputJsonValue` casting, `Prisma.JsonNull` for nullification

**Quick Rules:**

```typescript
// ✅ Correct imports
import { Prisma, type PrismaClient } from '../../generated/prisma';

// ✅ JSON field updates
photos: data.photos as Prisma.InputJsonValue;

// ✅ Clearing JSON fields
draftPhotos: Prisma.JsonNull;
```

#### [Entity Type Error Prevention](./PREVENTION-ENTITY-TYPE-ERRORS.md)

**Purpose:** Prevent cascading entity type errors when modifying entity interfaces
**Audience:** All backend engineers, especially those adding/modifying entities
**Companion Docs:** [Quick Ref](./ENTITY-ERRORS-QUICK-REF.md) | [Code Review](./ENTITY-CHANGE-CODE-REVIEW.md)
**Length:** ~5,000 words
**Key Patterns:** 10 prevention strategies, 5-7 required update locations, entity invariant testing

**Issues Prevented:**

- Build failures from missing entity field mappings
- Runtime errors from undefined fields
- Incomplete object creation across 5+ code paths
- Type safety gaps in repository patterns
- Inconsistent optional field handling

**Quick Rules:**

```typescript
// 1. Entity Invariant Tests
describe('Entity Invariants', () => {
  it('all creation paths include required fields', () => {
    const entities = [mockRepo.get(), prismaRepo.get(), service.create()];
    entities.forEach(e => expect(e?.requiredField).toBeDefined());
  });
});

// 2. Strict Mapper Input Type
private toDomainPackage(pkg: {
  id: string;
  name: string;
  newField: string;  // Must list ALL Prisma fields
}): Package {
  return {
    id: pkg.id,
    title: pkg.name,
    newField: pkg.newField,  // Safe to map
  };
}

// 3. Entity Change Checklist
// When modifying entities.ts, update these 5-7 locations:
// □ entities.ts (definition)
// □ contracts/ (API DTOs)
// □ ports.ts (input types)
// □ adapters/mock/ (seed data)
// □ adapters/prisma/ (mappers)
// □ routes/ (responses)
// □ services/ (factories)
```

**When to Use:**

- Adding any field to an entity (Package, Booking, Service, AddOn)
- Modifying entity required/optional status
- Creating new entity types
- Code reviewing entity-related PRs

#### [Visual Editor E2E Testing Rate Limit Solution](./visual-editor-e2e-testing.md)

**Purpose:** Prevent E2E tests from hitting signup rate limits (429 errors)
**Audience:** Engineers running E2E tests, test infrastructure maintainers
**Key Patterns:** Environment-aware rate limiter, token caching, serial test execution

**Quick Rules:**

```typescript
// ✅ Rate limiter with test environment detection
const isTestEnvironment = process.env.NODE_ENV === 'test' || process.env.E2E_TEST === '1';
export const signupLimiter = rateLimit({
  max: isTestEnvironment ? 100 : 5,  // 100/hr in tests, 5/hr in production
});

// ✅ Playwright config with E2E_TEST
webServer: {
  command: 'ADAPTERS_PRESET=real E2E_TEST=1 ...',
}

// ✅ Token caching in E2E tests
let authToken: string | null = null;
async function ensureLoggedIn(page) {
  if (!isSetup) {
    // Signup once, cache token
    authToken = await page.evaluate(() => localStorage.getItem('tenantToken'));
  } else if (authToken) {
    // Restore cached token
    localStorage.setItem('tenantToken', authToken);
  }
}
```

#### [CRUD Routes Implementation Checklist](./PREVENTION-CRUD-ROUTE-CHECKLIST.md)

**Purpose:** Prevent common mistakes when adding/modifying CRUD endpoints
**Audience:** Engineers implementing Create/Read/Update/Delete routes
**Length:** ~5,000 words
**Key Patterns:** API contracts, rate limiting, auth checks, DTO mapping, error handling

**Issues Prevented:**

- Missing API contracts for endpoints
- No rate limiting on CRUD operations
- Duplicated auth checks (24x duplication)
- Inline DTO mapping repeated 4+ times
- Missing NotFoundError handling (returns 500 instead of 404)
- Missing price/numeric field validation

**Quick Reference:** [CRUD-QUICK-REFERENCE.md](./CRUD-QUICK-REFERENCE.md) (print and pin this!)

#### [React Memoization Prevention Strategy](./react-performance/REACT-MEMOIZATION-PREVENTION-STRATEGY.md)

**Purpose:** Prevent unnecessary component re-renders by properly memoizing callback props and derived values
**Audience:** React component developers
**Key Patterns:** useCallback, useMemo, React.memo, dependency arrays

**Issues Prevented:**

- Cascading re-renders through component trees (100+ re-renders from 1 change)
- Performance degradation in lists (slower than O(n))
- Broken animation/focus state in child components
- Unnecessary DOM diffing and layout thrashing

**Quick Rules:**

```typescript
// 1. Callback props → useCallback()
const handleChange = useCallback((e) => setState(e.target.value), []);

// 2. Derived values → useMemo()
const filtered = useMemo(() => items.filter(i => i.active), [items]);

// 3. List items → React.memo()
const Item = React.memo(function Item({ id, onSelect }) { ... });
Item.displayName = 'Item';

// 4. Complete dependency arrays
// ESLint: react-hooks/exhaustive-deps must pass
```

**When to Use:**
- Building list/grid components with 10+ items
- Components receiving callback props
- Computing filtered/sorted arrays or objects
- Custom hooks returning callbacks or values

**Quick Reference:** [REACT-MEMOIZATION-QUICK-REFERENCE.md](./react-performance/REACT-MEMOIZATION-QUICK-REFERENCE.md)

#### [React Custom Hook Extraction Prevention Strategy](./react-performance/REACT-HOOK-EXTRACTION-PREVENTION.md)

**Purpose:** Prevent component complexity by knowing when and how to extract custom hooks
**Audience:** React component developers, code reviewers
**Length:** ~7,000 words (comprehensive guide + patterns + checklist)
**Date Solved:** 2025-12-05

**Covers:**

- When to extract hooks (decision tree)
- Warning signs of over-complex components (6+ useState, 3+ useEffect, 200+ lines)
- Four hook patterns (Manager, Data Fetching, Form State, Computed Values)
- Testing requirements (80%+ coverage, test templates)
- Hook implementation patterns with examples
- Common mistakes and fixes
- Code review checklist for hook PRs
- ESLint rule suggestions

**Issues Prevented:**

- Component logic too tightly coupled to UI
- Difficult to test business logic without rendering
- Hooks reused in multiple components aren't extracted
- Over-extraction of simple state (premature abstraction)
- Missing tests for extracted hooks
- Incomplete dependency arrays in memoized callbacks

**Quick Rules:**

```typescript
// Extract when component has:
// - 6+ useState calls
// - 3+ useEffect calls
// - API calls mixed with UI
// - 200+ lines total
// - Complex state-dependent operations

// Pattern 1: Manager Hook
export function useRemindersManager() {
  const [status, setStatus] = useState(null);
  const fetchStatus = useCallback(async () => { ... }, []);
  useEffect(() => { fetchStatus(); }, []);
  return { status, loading, error, fetchStatus, handleProcess };
}

// Pattern 2: Data Fetching Hook
export function useDashboardData(activeTab) {
  const [data, setData] = useState([]);
  useEffect(() => { loadData(activeTab); }, [activeTab]);
  const grouped = useMemo(() => group(data), [data]);
  return { data, grouped, isLoading };
}

// Pattern 3: Form State Hook
export function useCalendarForm() {
  const [calendarId, setCalendarId] = useState('');
  const [errors, setErrors] = useState({});
  const handleSave = useCallback(async () => { ... }, [calendarId]);
  return { calendarId, setCalendarId, errors, handleSave };
}

// Pattern 4: Computed Value Hook
export function useBookingTotal(basePriceCents, selectedAddOnIds) {
  return useMemo(() => {
    let total = basePriceCents;
    for (const id of selectedAddOnIds) {
      total += addOns[id].price;
    }
    return total / 100;
  }, [basePriceCents, selectedAddOnIds]);
}
```

**When to Use:**

- Adding multi-state features to components
- Components with complex async operations
- Logic that should be tested independently
- State/logic reused across components
- Components becoming hard to understand

**Quick References:**
- [REACT-HOOK-EXTRACTION-QUICK-REFERENCE.md](./react-performance/REACT-HOOK-EXTRACTION-QUICK-REFERENCE.md) (print & pin!)
- [HOOK-EXTRACTION-CODE-REVIEW-CHECKLIST.md](./react-performance/HOOK-EXTRACTION-CODE-REVIEW-CHECKLIST.md) (for PR reviews)

**Related Hooks in Codebase:**
- `useRemindersManager` - Reminder status + processing operations
- `useCalendarConfigManager` - Calendar config form + file upload + dialogs
- `useDepositSettingsManager` - Deposit settings form + validation
- `useDashboardData` - Parallel data fetching for dashboard tabs

---

#### [Schema Drift Prevention: Multi-Layer Defense](./database-issues/SCHEMA_DRIFT_PREVENTION_COMPREHENSIVE.md)

**Purpose:** Prevent schema drift incidents (189 test failures from empty migrations, missing columns, undefined env vars)
**Audience:** All engineers, especially database/backend team
**Length:** ~8,000 words (actionable walkthroughs)
**Severity:** P0 - Production blocking
**Date:** 2025-12-04

**What It Prevents:**

- Empty migration directories created without migration.sql inside
- Database missing columns that schema.prisma expects
- Test configurations with undefined CONNECTION_LIMIT in URLs
- Schema changes committed without migrations
- Migrations failing on clean database deployments

**Four-Layer Prevention System:**

1. **Pre-Commit Checks** (`.claude/hooks/validate-schema.sh`)
   - Detects empty migrations
   - Verifies required models exist
   - Checks multi-tenant isolation patterns
   - Validates schema consistency

2. **CI/CD Pipeline** (GitHub Actions)
   - Schema syntax validation
   - Empty migration detection
   - Migration dry-run on clean database
   - Environment variable validation

3. **Development Workflow** (Process & Documentation)
   - Safe migration creation checklist
   - Pattern A (Prisma) vs Pattern B (Manual SQL) decision guide
   - Idempotent SQL template
   - Troubleshooting guide for common issues

4. **Test Configuration** (Environment Setup)
   - Environment variable validation before tests
   - DATABASE_CONNECTION_LIMIT required
   - Test configuration template (.env.test)
   - Initialization checks prevent "undefined" in URLs

**When to Read:**

- Before modifying schema.prisma
- When creating database migrations
- During onboarding (database team focus)
- After any migration-related incident

**Quick Reference:**

```bash
# Safe workflow
cd server
npm exec prisma migrate dev --name add_my_field
# Verify migration.sql was created (not empty)
npm run test:integration
git add server/prisma/
git commit -m "feat(schema): add my_field"

# For enums/indexes (Pattern B)
touch server/prisma/migrations/NN_name.sql
# Use IF EXISTS/IF NOT EXISTS for idempotency
npm run test:integration
git add server/prisma/migrations/NN_name.sql
git commit -m "chore(schema): add my_index"
```

**Implementation Status:** Ready for immediate adoption
**Files to Create:** Hook script, CI jobs, guide documents
**Estimated Effort:** 2-3 hours for full implementation

---

### 2.5. Code Review Pattern Guides

#### [React UI Patterns & Audit Logging Review](./code-review-patterns/react-ui-patterns-audit-logging-review.md)

**Purpose:** Prevent UI anti-patterns and missing audit trails
**Audience:** Engineers working on React components and backend services
**Key Patterns:** AlertDialog vs window.confirm, useMemo for performance, structured logging

**Quick Rules:**

```typescript
// ✅ Use AlertDialog (not window.confirm)
<AlertDialog open={isOpen} onOpenChange={setIsOpen}>
  <AlertDialogAction onClick={handleConfirm}>Confirm</AlertDialogAction>
</AlertDialog>

// ✅ Memoize derived values
const effectiveValues = useMemo(() => ({
  title: draft.title ?? live.title,
}), [draft.title, live.title]);

// ✅ Audit log important operations
logger.info({
  action: 'package_draft_saved',
  tenantId,
  packageId,
  changedFields: Object.keys(draft),
}, 'Package draft saved');
```

#### [React Hooks Performance & WCAG Review](./code-review-patterns/react-hooks-performance-wcag-review.md)

**Purpose:** Prevent performance issues and accessibility violations
**Audience:** Engineers working on React components
**Key Patterns:** useCallback for stability, WCAG focus indicators, event handler memoization

**Quick Rules:**

```typescript
// ✅ useCallback for event handlers
const handleEdit = useCallback(
  async (pkg: PackageDto) => {
    await manager.edit(pkg);
  },
  [manager.edit]
);

// ✅ WCAG 2.4.7 focus indicator
className = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-sage';
```

---

### 3. Testing Guides

#### Test Templates

**Location:** `server/test/templates/`

**Available templates:**

- Tenant isolation test template
- Input normalization test template
- Idempotency test template
- N+1 query test template

**Usage:**

```bash
cp server/test/templates/tenant-isolation.test.ts \
   server/test/integration/my-feature.test.ts
```

#### Test Helpers

**Location:** `server/test/helpers/`

**Available helpers:**

- `createTestTenant()` - Isolated tenant for testing
- `createIsolatedTestData()` - Test data with cleanup
- `queryCountTracker()` - Detect N+1 queries
- `mockStripeWebhook()` - Webhook testing
- `calculateTimeout()` - Dynamic timeout calculation for bulk operations

#### Test Failure Prevention

**Location:** `docs/solutions/TEST-FAILURE-PREVENTION-STRATEGIES.md`

**Covers three critical patterns:**

1. **Concurrent Transaction Contention** - Sequential vs parallel execution
2. **Undefined Dependencies in Mock Mode** - DI container completeness
3. **Insufficient Timeouts for Bulk Operations** - Timeout configuration

**When to read:** Before writing integration tests, when debugging flaky tests

**Quick Summary:** [TEST-FAILURE-PATTERNS-SUMMARY.md](./TEST-FAILURE-PATTERNS-SUMMARY.md) (5 min read)

---

### 4. Code Quality Automation

#### ESLint Configuration

**Location:** `.eslintrc.json`, `server/.eslintrc.json`

**Custom rules:**

- `no-console` - Block console.log in production
- `no-restricted-syntax` - Block new PrismaClient()
- `no-restricted-globals` - Block prompt/alert/confirm
- `custom/require-tenant-id` - Enforce tenant isolation

#### Pattern Validation Script

**Location:** `.github/scripts/validate-patterns.sh`

**Checks:**

- Queries without tenantId filtering
- Direct PrismaClient instantiation
- console.log usage
- Browser prompt/alert/confirm
- Magic strings in tenantId

**Usage:**

```bash
./.github/scripts/validate-patterns.sh
```

---

## 🎯 By Use Case

### "I'm modifying database schema or migrations"

**Read:**

1. [Schema Drift Prevention - Comprehensive Guide](./database-issues/SCHEMA_DRIFT_PREVENTION_COMPREHENSIVE.md) (15-20 min)
2. [CLAUDE.md - Database Schema Modifications](../../CLAUDE.md#when-modifying-database-schema) (5 min)

**Checklist:**

- [ ] Understand Pattern A (Prisma migrations) vs Pattern B (Manual SQL)
- [ ] Created migration using `npm exec prisma migrate dev --name descriptive_name`
- [ ] Verify migration.sql file exists and is NOT empty
- [ ] Run `npm exec prisma generate` to regenerate Prisma Client
- [ ] Tested on local database: `npm run test:integration`
- [ ] Committed both `schema.prisma` AND migration files together
- [ ] Pre-commit hook passed without warnings
- [ ] Migration uses idempotent SQL (IF EXISTS/IF NOT EXISTS)

**Common Mistakes to Avoid:**

- Don't edit migration files manually after creation
- Don't create empty migrations
- Don't skip running tests after schema changes
- Don't commit schema changes without migration files
- Don't use `prisma migrate reset` in production

---

### "I'm adding a new database query"

**Read:**

1. [Quick Reference - Database Patterns](./PREVENTION-QUICK-REFERENCE.md#database-patterns-critical)
2. [Comprehensive Guide - Repository Pattern](./COMPREHENSIVE-PREVENTION-STRATEGIES.md#62-repository-pattern-enforcement)

**Checklist:**

- [ ] Filters by tenantId
- [ ] Uses repository pattern (not direct Prisma)
- [ ] No N+1 query pattern
- [ ] Indexes exist for WHERE clauses

**Test:**

- [ ] Tenant isolation test
- [ ] N+1 query test

---

### "I'm adding a new API endpoint (CRUD)"

**Read:**

1. [CRUD Routes Quick Reference](./CRUD-QUICK-REFERENCE.md) (5 min)
2. [Full CRUD Implementation Checklist](./PREVENTION-CRUD-ROUTE-CHECKLIST.md) (20 min)

**Planning (Before Coding):**

- [ ] API contract defined in `packages/contracts/src/api.v1.ts`
- [ ] Response DTOs in `packages/contracts/src/dto.ts`
- [ ] Rate limiter chosen and imported
- [ ] Validation schema created
- [ ] Helper functions planned (getTenantId, mapXxxToDto)

**Implementation:**

- [ ] All queries filter by tenantId
- [ ] Foreign keys validate ownership
- [ ] Auth check uses getTenantId() helper (not duplicated)
- [ ] DTO mapper extracted to function
- [ ] Error handling: ZodError → 400, NotFoundError → 404, etc.
- [ ] Numeric fields have min/max bounds
- [ ] Logging added for mutations

**Testing:**

- [ ] Happy path: 200/201 response
- [ ] Validation: 400 on invalid input
- [ ] Not found: 404 for missing resource
- [ ] Unauthenticated: 401 when no auth
- [ ] Rate limit: 429 when limit exceeded
- [ ] Tenant isolation: 403 for cross-tenant access

---

### "I'm adding a new API endpoint (Non-CRUD)"

**Read:**

1. [Quick Reference - Multi-Tenant Security](./PREVENTION-QUICK-REFERENCE.md#-multi-tenant-security-critical)
2. [Comprehensive Guide - Code Review Checklist](./COMPREHENSIVE-PREVENTION-STRATEGIES.md#11-multi-tenant-security-checklist)

**Checklist:**

- [ ] All queries filter by tenantId
- [ ] Foreign keys validate ownership
- [ ] Error messages don't leak tenant info
- [ ] Tests cover tenant isolation

**Test:**

- [ ] Tenant isolation test
- [ ] Ownership validation test

---

### "I'm adding authentication/user input"

**Read:**

1. [Email Case-Sensitivity Prevention](./security-issues/PREVENTION-STRATEGY-EMAIL-CASE-SENSITIVITY.md)
2. [Quick Reference - Input Normalization](./PREVENTION-QUICK-REFERENCE.md#input-normalization-critical)

**Checklist:**

- [ ] Input normalized before storage
- [ ] Input normalized before queries
- [ ] Tests cover case variations
- [ ] Whitespace trimmed

**Test:**

- [ ] Input normalization test (all cases)
- [ ] Duplicate prevention test

---

### "I'm adding a webhook handler"

**Read:**

1. [Comprehensive Guide - Test Patterns](./COMPREHENSIVE-PREVENTION-STRATEGIES.md#33-idempotency-tests-required)
2. [Quick Reference - Required Test Patterns](./PREVENTION-QUICK-REFERENCE.md#-required-test-patterns)

**Checklist:**

- [ ] Idempotency check (tenant-scoped)
- [ ] Early tenant extraction
- [ ] Error handling and retries
- [ ] Tests cover duplicates

**Test:**

- [ ] Idempotency test
- [ ] Race condition test
- [ ] Tenant isolation test

---

### "I'm adding React UI components"

**Read:**

1. [React Memoization Prevention Strategy](./react-performance/REACT-MEMOIZATION-PREVENTION-STRATEGY.md) (memoization best practices)
2. [React Memoization Quick Reference](./react-performance/REACT-MEMOIZATION-QUICK-REFERENCE.md) (quick checklist)
3. [React UI Patterns & Audit Logging Review](./code-review-patterns/react-ui-patterns-audit-logging-review.md)
4. [React Hooks Performance & WCAG Review](./code-review-patterns/react-hooks-performance-wcag-review.md)

**Checklist:**

- [ ] Callback props wrapped in `useCallback()`
- [ ] Derived values (filter, map, sort) wrapped in `useMemo()`
- [ ] List items (10+ items) wrapped in `React.memo()`
- [ ] All memoized components have `displayName` for DevTools
- [ ] No window.confirm/alert/prompt (use AlertDialog)
- [ ] WCAG focus indicators (focus-visible:ring-2)
- [ ] Keyboard accessible (Escape, Tab navigation)
- [ ] ESLint `react-hooks/exhaustive-deps` passes

**Test:**

- [ ] Accessibility test
- [ ] Performance test (React DevTools Profiler - no unexpected re-renders)
- [ ] List performance test (check memo works with 10+ items)

---

### "I'm extracting a custom hook from a complex component"

**Read:**

1. [React Custom Hook Extraction Prevention Strategy](./react-performance/REACT-HOOK-EXTRACTION-PREVENTION.md) (comprehensive guide)
2. [REACT-HOOK-EXTRACTION-QUICK-REFERENCE.md](./react-performance/REACT-HOOK-EXTRACTION-QUICK-REFERENCE.md) (decision tree + patterns)
3. [HOOK-EXTRACTION-CODE-REVIEW-CHECKLIST.md](./react-performance/HOOK-EXTRACTION-CODE-REVIEW-CHECKLIST.md) (PR review guide)

**Planning (Before Coding):**

- [ ] Identify what to extract: state + business logic + effects
- [ ] Choose hook pattern: Manager, DataFetching, Form, or Computed
- [ ] Plan return type interface (UseXxxManagerResult)
- [ ] Plan test file location and coverage target (80%+)

**Implementation:**

- [ ] Hook file: `hooks/use{Feature}{Manager|State}.ts`
- [ ] Return type interface defined and exported
- [ ] All state related to feature grouped together
- [ ] All callbacks use useCallback with complete dependencies
- [ ] All derived values use useMemo
- [ ] Appropriate logging/error handling
- [ ] JSDoc comment on hook
- [ ] Component simplified by 50%+ lines
- [ ] Only UI rendering remains in component

**Testing:**

- [ ] Test file: `hooks/use{Feature}.test.ts`
- [ ] Tests for: initialization, mount effects, all methods, errors, edge cases
- [ ] Coverage >= 80%
- [ ] Tests are deterministic (no flakiness)
- [ ] Proper async patterns (renderHook, waitFor, act)

**Code Review:**

- [ ] Use [HOOK-EXTRACTION-CODE-REVIEW-CHECKLIST.md](./react-performance/HOOK-EXTRACTION-CODE-REVIEW-CHECKLIST.md) for review
- [ ] Verify component size reduction
- [ ] Check ESLint passes (exhaustive-deps)
- [ ] Validate test coverage

---

### "I'm adding backend service methods"

**Read:**

1. [React UI Patterns & Audit Logging Review - Pattern 3](./code-review-patterns/react-ui-patterns-audit-logging-review.md#pattern-3-audit-logging-for-important-operations)
2. [Quick Reference - Logging & Debugging](./PREVENTION-QUICK-REFERENCE.md#logging--debugging)

**Checklist:**

- [ ] All mutations have audit logs (logger.info)
- [ ] Logs include: action, tenantId, resourceId, changedFields
- [ ] No console.log usage
- [ ] Appropriate log level (info/warn/error)
- [ ] No PII in logs

**Test:**

- [ ] Verify logs are created (test suite)
- [ ] Verify structured format

---

### "I'm fixing a production issue"

**Read:**

1. [Comprehensive Guide - Post-Incident Reviews](./COMPREHENSIVE-PREVENTION-STRATEGIES.md#9-post-incident-reviews)
2. [Implementation Roadmap - Incident Response](./PREVENTION-IMPLEMENTATION-ROADMAP.md#52-incident-response-process-day-4-5-4-hours)

**Process:**

1. Create incident report: `docs/incidents/YYYY-MM-DD-issue.md`
2. Identify root cause category
3. Check if prevention strategy exists
4. If not, create new prevention strategy
5. Update quick reference guide
6. Add test to prevent regression

---

### "I'm running E2E tests that are failing with 429 rate limit errors"

**Read:**

1. [Visual Editor E2E Testing Rate Limit Solution](./visual-editor-e2e-testing.md)
2. [Quick Reference - E2E Testing Setup](./visual-editor-e2e-quick-reference.md)

**Checklist:**

- [ ] Verify E2E_TEST=1 is in playwright.config.ts webServer command
- [ ] Check rate limiter has environment detection (`NODE_ENV === 'test' || E2E_TEST === '1'`)
- [ ] Implement auth token caching in test helpers
- [ ] Use serial test execution for shared state tests
- [ ] Tests pass locally and in CI

**Implementation Pattern:**

```typescript
// playwright.config.ts
webServer: {
  command: 'E2E_TEST=1 npm run dev:api',
}

// Rate limiter
const isTestEnvironment = process.env.NODE_ENV === 'test' || process.env.E2E_TEST === '1';
export const signupLimiter = rateLimit({
  max: isTestEnvironment ? 100 : 5,
});

// Tests
test.describe.configure({ mode: 'serial' });
let authToken: string | null = null;
async function ensureLoggedIn(page) {
  if (!isSetup) {
    // Signup, cache token
    authToken = await page.evaluate(() => localStorage.getItem('token'));
  } else if (authToken) {
    localStorage.setItem('token', authToken);
  }
}
```

---

## 🔍 By Issue Category

### Multi-Tenant Security Issues

**Prevention docs:**

- [Comprehensive Guide - Multi-Tenant Security Checklist](./COMPREHENSIVE-PREVENTION-STRATEGIES.md#11-multi-tenant-security-checklist)
- [Missing Input Validation](./security-issues/missing-input-validation-cross-tenant-exposure.md)
- [Quick Reference - Multi-Tenant Security](./PREVENTION-QUICK-REFERENCE.md#-multi-tenant-security-critical)

**Key patterns:**

- Always filter by tenantId
- Validate foreign key ownership
- Use tenant-scoped cache keys

---

### Input Validation Issues

**Prevention docs:**

- [Email Case-Sensitivity Prevention](./security-issues/PREVENTION-STRATEGY-EMAIL-CASE-SENSITIVITY.md)
- [Quick Reference - Input Normalization](./PREVENTION-QUICK-REFERENCE.md#input-normalization-critical)

**Key patterns:**

- Normalize email to lowercase
- Trim whitespace
- Test all case variations

---

### Performance Issues

**Prevention docs:**

- [Comprehensive Guide - Database Performance Checklist](./COMPREHENSIVE-PREVENTION-STRATEGIES.md#13-database-performance-checklist)
- [Quick Reference - Database Patterns](./PREVENTION-QUICK-REFERENCE.md#database-patterns-critical)

**Key patterns:**

- No N+1 queries (use includes)
- Single PrismaClient instance
- Add indexes for WHERE clauses
- Pagination for unbounded queries

---

### Code Quality Issues

**Prevention docs:**

- [Comprehensive Guide - ESLint Rules](./COMPREHENSIVE-PREVENTION-STRATEGIES.md#2-eslint-rules-to-enforce)
- [Quick Reference - ESLint Quick Fixes](./PREVENTION-QUICK-REFERENCE.md#-eslint-quick-fixes)

**Key patterns:**

- Use logger (not console.log)
- Use React components (not prompt/alert)
- Follow TypeScript strict mode

---

### React UI & Performance Issues

**Prevention docs:**

- [React Memoization Prevention Strategy](./react-performance/REACT-MEMOIZATION-PREVENTION-STRATEGY.md) (callback memoization, list optimization)
- [React Memoization Quick Reference](./react-performance/REACT-MEMOIZATION-QUICK-REFERENCE.md) (quick checklist)
- [React UI Patterns & Audit Logging Review](./code-review-patterns/react-ui-patterns-audit-logging-review.md)
- [React Hooks Performance & WCAG Review](./code-review-patterns/react-hooks-performance-wcag-review.md)

**Key patterns:**

- `useCallback()` for callback props (prevents child re-renders)
- `useMemo()` for derived values (filter, map, sort, object literals)
- `React.memo()` for list items (10+ items to prevent cascading re-renders)
- Always add `displayName` to memoized components for React DevTools
- AlertDialog instead of window.confirm()
- WCAG focus indicators
- Audit logging for mutations
- Use React DevTools Profiler to measure effectiveness

**When to read:**
- Building list/grid components
- Performance testing before production
- Code reviewing React components
- Debugging unnecessary re-renders

---

### TypeScript & Build Issues

**Prevention docs:**

- [Prisma TypeScript Build Failure Prevention](./PRISMA-TYPESCRIPT-BUILD-PREVENTION.md)

**Key patterns:**

- Correct Prisma imports (value, not type-only)
- JSON field casting with `Prisma.InputJsonValue`
- Null handling with `Prisma.JsonNull`

---

## 📅 Regular Activities

### Daily (Before Committing)

1. Review [Quick Reference](./PREVENTION-QUICK-REFERENCE.md) checklist
2. Run grep commands for self-review
3. Ensure tests pass locally

### Weekly (Friday Review)

1. Review team's PRs for pattern compliance
2. Count new P1 issues
3. Update prevention strategies if needed

### Monthly (First Friday)

1. Review metrics dashboard
2. Discuss production incidents
3. Update documentation
4. Plan next month's focus

### Quarterly (Every 3 Months)

1. Full review of prevention strategies
2. Survey team on effectiveness
3. Adjust processes
4. Update roadmap

---

## 🛠️ Tools & Scripts

### Validation Scripts

| Script                 | Purpose                      | Usage                                  |
| ---------------------- | ---------------------------- | -------------------------------------- |
| `validate-patterns.sh` | Check code for anti-patterns | `.github/scripts/validate-patterns.sh` |
| `check-indexes.js`     | Verify database indexes      | `node scripts/check-indexes.js`        |
| `npm run lint`         | ESLint validation            | `npm run lint`                         |
| `npm test`             | Run all tests                | `npm test`                             |

### Grep Commands

```bash
# Find queries without tenantId
rg 'prisma\.\w+\.findMany' --type ts | rg -v 'tenantId'

# Find new PrismaClient()
rg 'new PrismaClient\(\)' server/src/routes --type ts

# Find console.log
rg 'console\.log' server/src --type ts

# Find prompt/alert/confirm (window.confirm anti-pattern)
rg 'prompt\(|alert\(|confirm\(' client/src --type ts
grep -r "window\.confirm" client/src/

# Find mutations without logger calls
grep -E "async (create|update|delete|save|publish|discard)" server/src/services/*.ts -A 20 | grep -L "logger\."

# Find missing useMemo for derived values
grep -A 20 "export.*function.*Component" client/src/**/*.tsx | grep -E "(const .* = .*\?\?|const .* = .*\.filter|const .* = .*\.map|const .* = .*\.sort)"
```

### CI/CD Checks

- Documentation validation
- Pattern validation
- ESLint
- TypeScript type checking
- Security audit
- Unit tests (70% coverage)
- Integration tests (90% coverage)
- E2E tests
- Build validation

---

## 📈 Success Tracking

### Key Metrics

| Metric                 | Target | Current | Status |
| ---------------------- | ------ | ------- | ------ |
| P1 issues/sprint       | 0      | 7       | 🔴     |
| Test coverage          | 90%    | 85%     | 🟡     |
| Security vulns         | 0      | 3       | 🔴     |
| Feature completeness   | 100%   | 60%     | 🔴     |
| PrismaClient instances | 1      | 5+      | 🔴     |
| Console.log usage      | 0      | 12+     | 🔴     |

**Updated:** 2025-11-27

---

## 🎓 Training Materials

### Required Reading (Onboarding)

1. [Prevention Quick Reference](./PREVENTION-QUICK-REFERENCE.md) - 15 min
2. [CLAUDE.md](../../CLAUDE.md) - 30 min
3. [Multi-Tenant Implementation Guide](../multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md) - 30 min
4. [Comprehensive Prevention Strategies](./COMPREHENSIVE-PREVENTION-STRATEGIES.md) - 60 min

**Total:** 2 hours

### Training Sessions (Optional)

- Multi-Tenant Security Patterns (1 hour)
- Database Performance Patterns (1 hour)
- Testing Patterns (1 hour)
- Case Studies (1 hour)

**Total:** 4 hours

---

## 🤝 Contributing

### Adding New Prevention Strategy

1. Identify root cause category
2. Document pattern to prevent
3. Add to comprehensive guide
4. Add to quick reference
5. Create test template if applicable
6. Update CI/CD validation
7. Schedule training session

### Updating Existing Strategy

1. Open PR with changes
2. Tag @tech-lead for review
3. Update "Last Updated" date
4. Announce changes in #engineering

---

## 📞 Getting Help

### Questions About Prevention Strategies

- **Slack:** #engineering channel
- **Email:** tech-lead@example.com
- **Docs:** This index

### Reporting Issues with Prevention Strategies

- **False positive ESLint rule:** Create issue, tag @senior-engineer
- **Unclear documentation:** Create PR with clarifications
- **Missing prevention strategy:** Create issue with details

### Escalation Path

1. Ask in #engineering (< 30 min response)
2. Tag Senior Engineer (< 2 hours response)
3. Page Tech Lead (critical only)

---

## 🗺️ Document Relationships

```
Prevention Strategies Index (you are here)
├── Comprehensive Prevention Strategies (full guide)
│   ├── Code Review Checklists
│   ├── ESLint Rules
│   ├── Test Patterns
│   ├── Documentation Requirements
│   ├── CI/CD Gates
│   └── Architectural Guardrails
│
├── Prevention Quick Reference (cheat sheet)
│   ├── Multi-Tenant Security
│   ├── Input Normalization
│   ├── Database Patterns
│   ├── Code Review Checklist
│   └── Required Test Patterns
│
├── Implementation Roadmap (rollout plan)
│   ├── Phase 1: Quick Wins
│   ├── Phase 2: Test Infrastructure
│   ├── Phase 3: Security Enforcement
│   ├── Phase 4: Documentation & Training
│   └── Phase 5: Monitoring & Metrics
│
└── Specific Prevention Guides
    ├── Email Case-Sensitivity Prevention
    ├── Missing Input Validation Prevention
    └── [Future guides...]
```

---

## ✅ Next Steps

**For engineers:**

1. Read [Prevention Quick Reference](./PREVENTION-QUICK-REFERENCE.md)
2. Complete multi-tenant security quiz
3. Apply checklist to next PR

**For tech leads:**

1. Read [Implementation Roadmap](./PREVENTION-IMPLEMENTATION-ROADMAP.md)
2. Assign engineers to Phase 1
3. Schedule weekly review meetings

**For the team:**

1. Schedule training sessions
2. Set up metrics dashboard
3. Begin Phase 1 implementation

---

**Last Updated:** 2025-11-27
**Maintainer:** Tech Lead
**Status:** Active
