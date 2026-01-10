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

### 2. Comprehensive Prevention Guides (Parallel Resolution)

#### [Prevention Strategies: Comprehensive (Dec 26, 2025)](./PREVENTION-STRATEGIES-COMPREHENSIVE.md)

**Purpose:** Complete prevention strategies for 10 critical issues resolved in parallel code review
**Length:** ~12,000 words (extensive code examples)
**Audience:** All engineers, especially those implementing bookings, agents, and security features
**Date Created:** 2025-12-26
**Issues Prevented:** Race conditions, trust tier escalation, prompt injection, Unicode homoglyph attacks

**Covers 5 P1 Issues:**

- **Race Condition Prevention** - Advisory locks, 3-layer defense, transaction semantics
- **Trust Tier Escalation Framework** - Dynamic tier assignment (T1/T2/T3), risk factor detection
- **Availability Checks with Locking** - TOCTOU prevention, atomic operations
- **Booking Check Before Deletion** - Referential integrity, add-on booking checks
- **Comprehensive Prompt Injection Detection** - 50+ regex patterns, Unicode-aware

**Covers 3 P2 Issues:**

- **Generic Error Messages with Codes** - Structured error responses, error code enumeration
- **Field Mapping Consistency** - Canonical field names, consistent mapping
- **Injection Pattern Extensions** - Expanded regex coverage, false positive mitigation

**Covers 1 P3 Issue:**

- **Unicode Normalization (Homoglyph Prevention)** - NFKC normalization, lookalike character handling

**Key Statistics:**

- 3-layer race condition defense (database constraint + advisory lock + retry)
- 50+ injection detection patterns with false positive testing
- Dynamic trust tier escalation based on risk factors
- 100% atomic transactions with pessimistic locking
- Unicode NFKC normalization for security

**Quick Reference:** [Prevention Quick Reference Guide](./PREVENTION-QUICK-REFERENCE-GUIDE.md) (print and pin!)

**When to Read:**

- Implementing booking operations
- Adding agent write tools
- Processing user input in AI context
- Fixing security vulnerabilities
- Code reviewing P1 issues

---

### 2.5. Authentication Issues

#### [NextAuth v5 Production Authentication Prevention](./authentication-issues/NEXTAUTH-V5-PREVENTION-INDEX.md)

**Purpose:** Prevent production 401 errors from NextAuth v5 cookie prefix issues
**Audience:** Engineers working on authentication, API routes, Server Components
**Key Patterns:** Cookie name lookup order, request object passing, null token handling

**Quick Rules:**

```typescript
// ✅ Check cookies in correct order (HTTPS first)
const secureCookie = cookies().get('__Secure-authjs.session-token');
const httpCookie = cookies().get('authjs.session-token');
const token = secureCookie?.value ?? httpCookie?.value;

// ✅ Always pass real Request object to getToken()
const token = await getToken({ req: request }); // Not mock objects

// ✅ Handle null tokens gracefully
if (!token) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

**Related Documentation:**

- [Full Prevention Guide](./authentication-issues/nextauth-v5-getbackendtoken-cookie-prefix.md) - Detailed 45-min read
- [Quick Reference](./authentication-issues/NEXTAUTH-V5-QUICK-REFERENCE.md) - 5-min checklist
- [Code Review Checklist](./authentication-issues/NEXTAUTH-V5-CODE-REVIEW-CHECKLIST.md) - PR review checklist
- [Testing Strategy](./authentication-issues/NEXTAUTH-V5-TESTING-STRATEGY.md) - Test patterns

---

### 2.6. Specific Prevention Guides

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

#### [Multi-Agent Code Review Prevention Strategies](./patterns/MULTI_AGENT_CODE_REVIEW_PREVENTION_STRATEGIES.md)

**Purpose:** Best practices for multi-agent code review workflows using `/workflows:review`
**Audience:** All engineers, especially during PR reviews
**Date Created:** 2026-01-09
**Key Patterns:** Specialized reviewers, parallel execution, immediate todo creation, severity classification

**Key Learnings:**

1. **Specialized reviewers catch domain-specific issues** - Data Integrity Guardian found TOCTOU that others missed
2. **Parallel execution makes comprehensive review feasible** - 6+ agents run simultaneously
3. **Structured todo file creation ensures findings are actionable** - Create immediately, not after approval
4. **P1/P2/P3 severity classification helps prioritization** - P1 blocks merge

**When to Use:**

- Database migrations (data-integrity-guardian REQUIRED)
- Agent tool changes (agent-native-reviewer REQUIRED)
- Auth/security changes (security-sentinel REQUIRED)
- Large PRs (>300 lines)
- Pre-release quality gates

**Quick Reference:** [MULTI_AGENT_CODE_REVIEW_QUICK_REFERENCE.md](./patterns/MULTI_AGENT_CODE_REVIEW_QUICK_REFERENCE.md) (print and pin!)

---

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

#### [Code Review Resolution - P1/P2 Fixes with Working Patterns (2026-01-09)](./code-review-patterns/CODE_REVIEW_RESOLUTION_P1_P2_FIXES_MAIS_20260109.md)

**Purpose:** Extract working solutions and code patterns from completed code review fixes (#708-717)
**Audience:** All engineers, especially those implementing concurrent operations, type safety, and component patterns
**Length:** ~2,500 words with extensive code examples
**Key Patterns:** 6 working patterns with copy-paste templates, decision frameworks, verification checklist
**Status:** P1 complete (1 fix), P2 complete (5 fixes), P3 deferred (4 issues with new todos)

**6 Working Patterns Documented:**

1. **TOCTOU Prevention with Advisory Lock** - FNV-1a hash + `pg_advisory_xact_lock()` + transaction (P1 #708)
2. **Type Guard for Runtime Safety** - Discriminating function for malformed data validation (P2 #709)
3. **Variant-Based Component Styling** - Single component + variant prop + style map (P2 #711)
4. **DRY Component Extraction** - ProposalCard with compact/default variants (P2 #712)
5. **DRY Service Method Extraction** - Private utility for multi-path reuse (P2 #713)
6. **React Ref Type Compatibility** - useRef as React.RefObject for React 18/19 (Bonus)

**When to Use Each Pattern:**

- **Pattern 1:** Check-then-act operations that race (booking limits, balance updates, duplicate prevention)
- **Pattern 2:** Data from external sources (APIs, webhooks, tool results, user input)
- **Pattern 3:** Components that appear in multiple contexts with styling variations
- **Pattern 4:** Duplicated component logic across 2+ files
- **Pattern 5:** Same business logic in 2+ public methods

**Quick Ref:** [CODE_REVIEW_RESOLUTION_QUICK_REFERENCE_MAIS_20260109.md](./code-review-patterns/CODE_REVIEW_RESOLUTION_QUICK_REFERENCE_MAIS_20260109.md) (print and pin! - 2 min read with templates)

**Files Changed:** 24 files, ~1,900 insertions, commit `02cde7e8`

#### [Code Review Findings Resolution - P1/P2/P3 Fixes (2026-01-09)](./code-review-patterns/CODE_REVIEW_FINDINGS_RESOLUTION_P1P2P3_20260109.md)

**Purpose:** Document resolution of 6 code review findings from parallel multi-agent review
**Audience:** All engineers, especially those reviewing code for TOCTOU, type safety, and duplication
**Key Patterns:** Advisory locks for TOCTOU prevention, type guards for safety, component variants, DRY service extraction
**Findings:** 1 P1 (maxPerDay TOCTOU), 5 P2 (type safety + duplication), 4 P3 deferred

**P1 Fixed:** maxPerDay race condition with advisory lock on `hashServiceDate()`
**P2 Fixed:**

- Type guard safety with `hasUIAction()`
- MessageBubble/ProposalCard component deduplication
- Tenant provisioning service DRY extraction

**Related Quick Ref:** [CODE_REVIEW_FINDINGS_QUICK_REFERENCE.md](./code-review-patterns/CODE_REVIEW_FINDINGS_QUICK_REFERENCE.md) (print and pin!)

#### [Multi-Agent Code Review for Multi-Tenant Security (2026-01-05)](./code-review-patterns/multi-agent-code-review-booking-links-phase0-MAIS-20260105.md)

**Purpose:** Multi-agent code review workflow for catching tenant isolation, TOCTOU, and registration issues
**Audience:** Engineers doing code reviews, especially for multi-tenant agent features
**Key Patterns:** 5 parallel review agents, triage voting with enterprise quality standards, 4 P1 escalations
**Findings:** 4 P1 (tenant isolation, TOCTOU, executor registration, DRY), 4 P3 (deferred)

**Key Prevention Patterns:**

- Tenant isolation: Always include `tenantId` in delete/update where clauses
- REQUIRED_EXECUTOR_TOOLS: Every T2 tool must be registered
- TOCTOU: Wrap check-then-act in transactions with row locks
- DRY: Extract shared utilities to `agent/shared/`

#### [Parallel TODO Resolution Review (2025-12-29)](./code-review-patterns/parallel-todo-resolution-review-MAIS-20251229.md)

**Purpose:** Comprehensive review of 20-TODO parallel resolution commit (df56db1)
**Audience:** Engineers doing multi-agent code reviews, agent/chatbot developers
**Key Patterns:** 6 parallel review agents, finding synthesis, 18 actionable todos created
**Findings:** 1 P1 (sequential execution), 9 P2 (security/architecture), 8 P3 (code quality)

**Validated Patterns:**

- Executor registry for breaking circular dependencies
- AgentError class hierarchy for user-friendly messages
- Zod schema validation for payload defense-in-depth
- Trust tier system (T1/T2/T3) for proposal gates

---

#### [Multi-Agent Parallel Code Review Workflow](./code-review-patterns/multi-agent-parallel-code-review-workflow-MAIS-20251225.md)

**Purpose:** Workflow for 6 parallel review agents + 8 parallel fix agents with interactive triage
**Audience:** Engineers using multi-agent code review workflows
**Date Created:** 2025-12-25
**Key Patterns:** Parallel agent coordination, priority classification, interactive triage

**Covers:**

- 6 parallel code review agents for comprehensive analysis
- 8 parallel fix agents for efficient resolution
- Interactive triage with P1/P2/P3 priority classification
- Agent coordination and result aggregation
- Fix verification and validation workflow

**Quick Reference:**

```bash
# Phase 1: Launch 6 parallel review agents
Task('Review API contracts', { run_in_background: true })
Task('Review tenant isolation', { run_in_background: true })
Task('Review error handling', { run_in_background: true })
# ... 3 more agents

# Phase 2: Triage findings with user interaction
AskUserQuestion('Classify 15 findings by priority (P1/P2/P3)')

# Phase 3: Launch 8 parallel fix agents
independentFixes.forEach(fix =>
  Task(`Fix ${fix.id}`, { run_in_background: true })
)
```

#### [Next.js Migration Lessons Learned](./code-review-patterns/nextjs-migration-lessons-learned-MAIS-20251225.md)

**Purpose:** 10 key lessons from Next.js migration with prevention checklist
**Audience:** Engineers performing framework migrations
**Date Created:** 2025-12-25
**Key Patterns:** Framework migration patterns, ISR caching, error boundaries

**Covers:**

- 10 key lessons from Next.js 14 App Router migration
- Prevention checklist for framework migrations
- ISR cache strategies and pitfalls
- API contract consistency across SSR/client
- Error boundary requirements for dynamic routes

**Quick Rules:**

```typescript
// 1. Wrap shared SSR data fetching with cache()
import { cache } from 'react';
const getTenantData = cache(async (slug: string) => { ... });

// 2. Add error.tsx to all dynamic routes
export default function Error({ error, reset }: ErrorBoundaryProps) { ... }

// 3. Never expose backend tokens in NextAuth session
// Use getBackendToken() server-side only

// 4. Use logger utility, never console.log
import { logger } from '@/lib/logger';
```

#### [Next.js Route Deduplication Prevention](./NEXTJS-ROUTE-DEDUPLICATION-INDEX.md)

**Purpose:** Prevent code duplication in multi-route Next.js implementations ([slug] vs \_domain routes)
**Audience:** Frontend developers, code reviewers
**Date Created:** 2025-12-28
**Key Pattern:** TenantIdentifier union type + shared utilities
**Impact:** ~60% code reduction, 50% faster feature implementation

**Contains:**

- Master index with quick links by task
- Full prevention strategy with rationale & decision trees
- 10-minute implementation checklist with templates
- 7 critical code review checks with copy-paste comments
- Testing approach (unit, E2E, manual)
- Common mistakes & fixes

**Quick Rules:**

```typescript
// ✅ Use TenantIdentifier union type for route abstraction
type TenantIdentifier =
  | { type: 'slug'; slug: string }
  | { type: 'domain'; domain: string };

// ✅ Pass basePath + domainParam to components (not slug/domain)
<PageContent tenant={context.tenant} basePath={context.basePath} domainParam={context.domainParam} />

// ✅ Build links with both basePath and domainParam
const link = `${basePath}/services${domainParam || ''}`;

// ✅ Domain route requires guard in both places
if (!domain) notFound();  // In both generateMetadata and page function

// ✅ Use shared utilities - never duplicate resolution logic
const context = await checkPageAccessible(identifier, 'pageName');
```

**Issues Prevented:**

- Route logic duplicated between [slug] and \_domain implementations
- Bug fixes applied to one route but not other
- Components aware of route types (hardcoded routes)
- Domain query param missing from \_domain route links
- Error handling inconsistency between routes
- ISR revalidation skipped

**Real Examples:** All 6 tenant pages (about, services, contact, faq, gallery, testimonials) in MAIS use this pattern

**When to Read:**

- Adding pages to multi-route Next.js projects
- Implementing both slug-based and domain-based routes
- Code reviewing dual-route implementations
- Training new frontend developers
- Evaluating architecture for new projects

**Related Documents:**

- [Next.js Migration Lessons Learned](./code-review-patterns/nextjs-migration-lessons-learned-MAIS-20251225.md) - App Router patterns
- [Critical Patterns Guide](./patterns/mais-critical-patterns.md) - Multi-tenant isolation patterns

---

#### [Code Review Quick Reference (2025-12-25)](./code-review-patterns/CODE-REVIEW-QUICK-REFERENCE-20251225.md)

**Purpose:** Quick reference for 10 common P2/P3 code review patterns
**Audience:** Code reviewers, engineers submitting PRs
**Date Created:** 2025-12-25
**Length:** ~2,000 words (print-friendly)

**Contains:**

- 10 most common P2/P3 patterns with one-liner fixes
- Copy-paste ready code examples
- ESLint rules to enforce patterns
- Grep commands for self-review

**Quick Reference Table:**

| Pattern                | Issue                              | Fix                   |
| ---------------------- | ---------------------------------- | --------------------- |
| Missing useCallback    | Callback recreated on every render | Wrap in useCallback() |
| No error boundary      | Unhandled errors crash page        | Add error.tsx         |
| Console.log            | Debug code in production           | Use logger utility    |
| window.confirm         | Blocks UI thread                   | Use AlertDialog       |
| Missing ISR revalidate | Stale data in production           | Add revalidate: 60    |

#### [Batch P2/P3 Resolution for Tenant Multi-Page Sites](./code-review-patterns/batch-p2-p3-resolution-tenant-multipage-MAIS-20251225.md)

**Purpose:** Batch resolution guide for tenant multi-page site P2/P3 findings
**Audience:** Engineers resolving code review findings across tenant pages
**Date Created:** 2025-12-25
**Key Patterns:** Batch resolution, tenant page consistency, parallel fixes

**Covers:**

- Batch resolution workflow for multi-page tenant sites
- Consistency patterns across /t/[slug]/\* pages
- Parallel agent assignment by page/component
- Verification checklist for batch fixes
- Common multi-page patterns and fixes

**Quick Workflow:**

```bash
# 1. Group findings by page
/t/[slug]/page.tsx - 3 findings
/t/[slug]/book/page.tsx - 5 findings
/t/[slug]/services/page.tsx - 2 findings

# 2. Launch parallel agents per page
Task('Fix /t/[slug]/page.tsx P2/P3s', { run_in_background: true })
Task('Fix /t/[slug]/book/page.tsx P2/P3s', { run_in_background: true })
Task('Fix /t/[slug]/services/page.tsx P2/P3s', { run_in_background: true })

# 3. Verify consistency
npm run typecheck
npm run test:e2e -- --grep "tenant"
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

#### Test Tenant Cleanup (Orphan Accumulation)

**Location:** `docs/solutions/test-failures/TEST-SUITE-HANG-ORPHANED-TENANTS-20251227.md`

**Problem:** Test suite hangs for 11+ minutes due to orphaned test tenants accumulating from interrupted test runs. The reminder scheduler processes ALL tenants (~250ms each), causing exponential slowdown.

**Solution:** Vitest global setup hook cleans orphaned test tenants BEFORE tests start.

**Quick Reference:** [QUICK-REFERENCE-TEST-CLEANUP.md](./QUICK-REFERENCE-TEST-CLEANUP.md) (3 min read)

**When to read:** When tests hang or slow down progressively, when investigating test infrastructure

#### Phase 5 Testing and Caching Patterns

**Location:** `docs/solutions/patterns/phase-5-testing-and-caching-prevention-MAIS-20251231.md`

**Problem:** Four critical issues discovered during Phase 5 code review:

1. **Retryable Keyword Conflicts** - Test error messages containing "timeout", "network", "503" trigger retry logic
2. **Singleton Cache Testability** - Singleton exports prevent dependency injection for tests
3. **Cache Invalidation After Writes** - Write tools don't invalidate cache, causing stale data
4. **Error Sanitization in Logs** - Full error objects logged with sensitive data

**Quick Rules:**

```typescript
// ❌ Test error triggers retries
throw new Error('Request timeout');

// ✅ Safe test error
throw new Error('Request failed');

// ❌ Singleton prevents test injection
export const contextCache = new ContextCache();

// ✅ Export class + factory for injection
export class ContextCache { ... }
export const defaultContextCache = new ContextCache();

// ❌ Full error logged (sensitive data)
logger.error({ error }, 'API failed');

// ✅ Sanitized error
logger.error({ error: sanitizeError(error) }, 'API failed');
```

**When to read:** Before implementing retry logic, caching, or error handling

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
3. [React Hooks Early Return Prevention](./patterns/REACT_HOOKS_EARLY_RETURN_PREVENTION.md) (adding early returns to existing components)
4. [React Unstable Array Dependency Prevention](./patterns/REACT_UNSTABLE_ARRAY_DEPENDENCY_PREVENTION.md) (useEffect with arrays)
5. [React UI Patterns & Audit Logging Review](./code-review-patterns/react-ui-patterns-audit-logging-review.md)
6. [React Hooks Performance & WCAG Review](./code-review-patterns/react-hooks-performance-wcag-review.md)

**Checklist:**

- [ ] **All hooks BEFORE any early returns** (Rules of Hooks)
- [ ] Callback props wrapped in `useCallback()`
- [ ] Derived values (filter, map, sort) wrapped in `useMemo()`
- [ ] **Arrays in useEffect deps stabilized with useMemo** (prevents effect re-runs)
- [ ] List items (10+ items) wrapped in `React.memo()`
- [ ] All memoized components have `displayName` for DevTools
- [ ] No window.confirm/alert/prompt (use AlertDialog)
- [ ] WCAG focus indicators (focus-visible:ring-2)
- [ ] Keyboard accessible (Escape, Tab navigation)
- [ ] ESLint `react-hooks/rules-of-hooks` passes
- [ ] ESLint `react-hooks/exhaustive-deps` passes

**Test:**

- [ ] Accessibility test
- [ ] Performance test (React DevTools Profiler - no unexpected re-renders)
- [ ] List performance test (check memo works with 10+ items)
- [ ] useEffect trigger count test (effect shouldn't run on every render)
- [ ] Run `npm run build` before committing (catches hooks violations)

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

### "I'm building agent tools with draft/publish workflow"

**Read:**

1. [Build Mode Implementation Prevention Strategies](./patterns/build-mode-implementation-prevention-MAIS-20260105.md) (20 min)
2. [Agent Tool Architecture Prevention Strategies](./agent-design/AGENT-TOOL-ARCHITECTURE-PREVENTION-STRATEGIES-MAIS-20251228.md) (15 min)

**Pre-Planning Checklist:**

- [ ] Enumerated ALL UI actions user can perform
- [ ] Created tool for EACH action (including publish/discard)
- [ ] Defined trust tiers (T1 auto, T2 soft, T3 explicit)
- [ ] Documented what goes to draft vs live
- [ ] Created shared Zod schemas in `@macon/contracts`

**Implementation Checklist:**

- [ ] Tools use imported schemas from contracts (no duplication)
- [ ] Executors use same schemas (single source of truth)
- [ ] Helper functions in shared module (getDraftConfig, getTenantSlug)
- [ ] ALL visual changes go to draft (including branding)
- [ ] PostMessage uses Zod validation + origin check
- [ ] Draft preview requires authentication
- [ ] Version field for optimistic locking

**Testing Checklist:**

- [ ] 80% coverage on tools/executors
- [ ] Trust tier transition tests
- [ ] Concurrent edit tests
- [ ] PostMessage origin validation tests
- [ ] Schema parsing tests

**Quick Reference:**

```
TOOLS: publish_draft, discard_draft, get_draft must exist
SCHEMAS: @macon/contracts, import in tools AND executors
DRAFT: ALL visual = draft (pages, sections, branding, logo)
POSTMESSAGE: parseChildMessage() returns typed | null
AUTH: ?preview=draft requires session check
```

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

### "I'm deploying Next.js to Vercel (monorepo)"

**Read:**

1. [Vercel + Next.js Monorepo Deployment Prevention](./deployment-issues/vercel-nextjs-monorepo-deployment-prevention.md) (10 min)
2. [Vite Monorepo TypeScript Cache Issues](./deployment-issues/vercel-vite-monorepo-typescript-incremental-cache.md) (5 min)

**Pre-Deploy Checklist:**

- [ ] `vercel.json` has correct `buildCommand` and `installCommand`
- [ ] Root Directory setting is EMPTY in Vercel dashboard (not `apps/web`)
- [ ] `next.config.js` has `transpilePackages: ['@macon/contracts', '@macon/shared']`
- [ ] Workspace packages have `"build": "tsc -b --force"` script
- [ ] ESLint configured for unescaped entities (allow ' and ")
- [ ] Local verification passes: `npm run verify-nextjs`

**Common Errors & Fixes:**

| Error                                | Cause                | Fix                                   |
| ------------------------------------ | -------------------- | ------------------------------------- |
| `Module not found: @macon/contracts` | Root Directory set   | Clear Root Directory, use vercel.json |
| `ENOENT: dist/index.js`              | Missing --force flag | Add `--force` to tsc build            |
| ESLint unescaped entity              | Strict rule          | Configure react/no-unescaped-entities |
| Type errors in build                 | Stale types          | Rebuild workspace packages first      |

**Verification:**

```bash
# Simulate Vercel build locally
npm run verify-nextjs

# Check individual steps
npm run build -w @macon/contracts
npm run build -w @macon/shared
cd apps/web && npm run build
```

---

### "I'm running multi-agent code review or parallel TODO resolution"

**Read:**

1. [Multi-Agent Code Review Prevention Strategies](./methodology/MULTI-AGENT-CODE-REVIEW-PREVENTION-STRATEGIES.md) (20 min)
2. [Multi-Agent Quick Reference](./methodology/MULTI-AGENT-QUICK-REFERENCE.md) (5 min, print this!)

**Agent Coordination:**

- [ ] All parallel agents use `run_in_background: true`
- [ ] TaskOutput called for each agent to collect results
- [ ] Dependent tasks run sequentially, not parallel
- [ ] No file conflicts between parallel agents
- [ ] Appropriate model selected (haiku/sonnet/opus)

**Triage:**

- [ ] Used AskUserQuestion for unclear items
- [ ] Applied P1/P2/P3 priority matrix
- [ ] Verified code doesn't already exist (glob/grep/git log)
- [ ] Created TODO file with proper template
- [ ] Set revisit triggers for deferred items

**Verification:**

- [ ] Run `npm run typecheck` after all fixes
- [ ] Run `npm test` to verify no regressions
- [ ] Update TODO files from `pending` to `complete`
- [ ] Summarize changes for user
- [ ] Playwright verification for UI changes

**Performance Tips:**

```typescript
// Group related fixes into single agents
Task('P3 Performance Fixes - TODOs 352-354', {
  run_in_background: true,
});

// Launch 8+ agents for independent tasks
const agents = independentTodos.map((t) => Task(`Fix ${t.id}`, { run_in_background: true }));

// Use haiku for simple tasks
Task('Remove unused import', {
  subagent_type: 'haiku',
  run_in_background: true,
});
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
- [React Unstable Array Dependency Prevention](./patterns/REACT_UNSTABLE_ARRAY_DEPENDENCY_PREVENTION.md) (useEffect dependency arrays, useMemo for stability)
  - Quick Reference: [REACT_UNSTABLE_ARRAY_DEPENDENCY_QUICK_REFERENCE.md](./patterns/REACT_UNSTABLE_ARRAY_DEPENDENCY_QUICK_REFERENCE.md) - Print & pin (2 min read)
- [React UI Patterns & Audit Logging Review](./code-review-patterns/react-ui-patterns-audit-logging-review.md)
- [React Hooks Performance & WCAG Review](./code-review-patterns/react-hooks-performance-wcag-review.md)

**Key patterns:**

- `useCallback()` for callback props (prevents child re-renders)
- `useMemo()` for derived values (filter, map, sort, object literals)
- `useMemo()` to stabilize array references in useEffect dependencies (prevents effect re-runs)
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
- useEffect running more often than expected

---

### TypeScript & Build Issues

**Prevention docs:**

- [Prisma TypeScript Build Failure Prevention](./PRISMA-TYPESCRIPT-BUILD-PREVENTION.md)
- [TypeScript Build Errors Resolution (2025-12-27)](./TYPESCRIPT-BUILD-ERRORS-RESOLUTION-20251227.md) - Property name mismatches, type assertions, stub service patterns
- [TypeScript Unused Variable Underscore Prefix (TS6133)](./build-errors/typescript-unused-variable-underscore-prefix-MAIS-20251227.md) - When to prefix unused parameters with `_`
- [TypeScript Symlink Resolution Prevention](./patterns/TYPESCRIPT_SYMLINK_RESOLUTION_PREVENTION.md) - Comprehensive guide: symlinks in src cause double compilation
  - Quick Reference: [TYPESCRIPT_SYMLINK_QUICK_REFERENCE.md](./patterns/TYPESCRIPT_SYMLINK_QUICK_REFERENCE.md)
- [React Hooks Early Return Prevention](./patterns/REACT_HOOKS_EARLY_RETURN_PREVENTION.md) - Build passes locally but fails on Vercel when hooks called after early return
  - Quick Reference: [REACT_HOOKS_EARLY_RETURN_QUICK_REFERENCE.md](./patterns/REACT_HOOKS_EARLY_RETURN_QUICK_REFERENCE.md)

**Key patterns:**

- **Never put symlinks in src directories** - Use tsconfig paths or workspace packages instead
- **All hooks before any early returns** - Rules of Hooks requires same call order every render
- Correct Prisma imports (value, not type-only)
- JSON field casting with `Prisma.InputJsonValue`
- Null handling with `Prisma.JsonNull`
- Property names: Verify against source schema (e.g., `heroImage` vs `heroImageUrl`)
- Type assertions: Validate key exists before asserting with `in` operator
- Stub services: Use `as unknown as Type` for partial implementations
- Always run `npm run build` locally before pushing (catches what lint misses)

---

### Deployment Issues (Vercel + Monorepo)

**Prevention docs:**

- [Vercel + Next.js Monorepo Deployment Prevention](./deployment-issues/vercel-nextjs-monorepo-deployment-prevention.md) (NEW)
- [Vercel + Vite Monorepo TypeScript Incremental Cache](./deployment-issues/vercel-vite-monorepo-typescript-incremental-cache.md)

**Key patterns:**

- **Never use Root Directory setting** for npm workspaces
- Build workspace packages before Next.js: `contracts → shared → web`
- Use `transpilePackages` in next.config.js
- Use `--force` flag on TypeScript builds for CI
- Configure ESLint for unescaped entities (allow ' and ")
- Run `npm run verify-nextjs` before pushing

**Quick verification command:**

```bash
npm run verify-nextjs   # Simulates Vercel build locally
```

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
├── Workflow Optimization Guides
│   ├── Todo Staleness Prevention
│   ├── Parallel Agent Workflows
│   └── Quick References
│
└── Specific Prevention Guides
    ├── Email Case-Sensitivity Prevention
    ├── Missing Input Validation Prevention
    ├── Stale Todo Prevention
    ├── Parallel Agent Workflow Best Practices
    └── [Future guides...]
```

---

### 3. Workflow & Process Prevention Guides

#### [Todo Staleness Prevention](./TODO-STALENESS-PREVENTION.md)

**Purpose:** Prevent creating todos for work already completed
**Audience:** Code reviewers, plan reviewers, tech leads
**Length:** ~4,000 words
**When to read:** Before conducting plan reviews or code reviews

**Problem Solved:**

- Creating todos for already-implemented features
- 30+ second timing gaps between implementation and todo creation
- 3+ hours wasted verifying/closing stale todos
- Confusion about what work remains

**Key Learning (2025-12-05):**

```
22:59:24 → Implementation complete (commit 1647a40)
22:59:54 → Todos created describing same work (commit c4c8baf)
+17 hours → Todos closed as already implemented (commit 62f54ab)

Gap: Implementation predated todo creation by 30 seconds
Cost: 3+ hours of verification work in next session
```

**Prevention Strategies:**

1. Verify before creating (always search code first)
2. Distinguish implementation/verification/audit todos
3. Use parallel agent workflow with verification-first
4. Implement deferral criteria
5. Use time-aware todo status
6. Plan review checklist with Glob/Grep
7. Batch verification instead of batch creation
8. Todo type templates
9. Integration with parallel agent workflow

**Quick Rules:**

```markdown
Before creating TODO from plan:

- [ ] glob '\**/*ComponentName\*'
- [ ] grep -r 'functionName'
- [ ] git log -p -S 'ComponentName' (last 50)
- [ ] Check: Is code < 24h old? → SKIP
- [ ] Check: Is code tested? → SKIP
- [ ] Create only for: missing code OR verified gaps
```

**Expected Benefit:** 80% fewer stale todos, 3.5 hours faster plan reviews

#### [Parallel Agent Workflow Best Practices](./PARALLEL-AGENT-WORKFLOW-BEST-PRACTICES.md)

**Purpose:** Optimize multi-agent workflows to avoid stale todos and duplicate work
**Audience:** Tech leads, code reviewers using parallel agents
**Length:** ~5,000 words
**When to read:** Before running `/workflows:plan`, `/workflows:review`, `/workflows:work` in sequence

**Problem Solved:**

- Information asymmetry between review agent and implementation agent
- Agents creating todos based on assumptions, not code reality
- Duplicate verification work across multiple agents
- Timing gaps between plan/review/implementation creating stale artifacts

**10 Core Principles:**

1. **Verification Before Creation** - Always check code existence before creating todos
2. **Shared Context Between Agents** - Use intermediate artifacts (verification.json)
3. **Todo Creation Deferral Rules** - Skip todos for same-session work
4. **Agent Specialization** - Clear roles for Plan/Review/Work/Codify agents
5. **Parallel vs Sequential** - Use sequential for same-feature, parallel for different features
6. **Decision Consistency** - Establish decision records early
7. **Consensus Building** - Process for resolving agent disagreements
8. **Dependency Tracking** - Explicit dependencies between todos
9. **Verification Handoff Format** - Standardized JSON format for passing verification results
10. **Session Boundary Recognition** - Tag artifacts with session markers

**Key Workflow:**

```bash
# Standard sequence (sequential)
/workflows:plan feature-description
  ↓ outputs plan.md
/workflows:review plan.md --output=verification.json
  ↓ outputs verification.json with verified/missing/gaps
/workflows:work plan.md --use-verification=verification.json
  ↓ implements only from "missing" section
```

**Expected Benefit:** 50% faster plan reviews, 80% fewer stale todos

#### [Compound-Engineering Documentation Migration](./workflow/compound-engineering-documentation-migration-MAIS-20251227.md)

**Purpose:** Migrate legacy documentation systems to compound-engineering native format
**Audience:** Engineers maintaining documentation, tech leads
**Length:** ~1,500 words
**Date Created:** 2025-12-27

**Problem Solved:**

- Legacy "lessons" system existing alongside compound-engineering docs
- Documentation systems referencing non-existent commands
- Redundant content across multiple locations
- Stale CLAUDE.md content not archived

**Key Actions:**

1. Delete legacy `.claude/lessons/` folder (redundant with docs/solutions/)
2. Create `mais-critical-patterns.md` as "Required Reading" for all agents
3. Archive stale sprint goals from CLAUDE.md
4. Fix broken documentation links
5. Configure Context7 MCP for framework docs

**Prevention Checklist:**

- [ ] Check compound-engineering compatibility before adding new doc systems
- [ ] Verify location should be `docs/solutions/` (compound-native)
- [ ] Search existing docs before creating new content
- [ ] Use YAML frontmatter for searchability
- [ ] Index in PREVENTION-STRATEGIES-INDEX.md

#### [Multi-Agent Code Review Prevention Strategies](./methodology/MULTI-AGENT-CODE-REVIEW-PREVENTION-STRATEGIES.md)

**Purpose:** Comprehensive prevention strategies for multi-agent code review workflow
**Audience:** Engineers using `/workflows:review`, `/resolve_parallel`, `/triage`
**Length:** ~6,000 words
**Date Created:** 2025-12-25

**Covers:**

- Agent coordination (run_in_background, TaskOutput, dependencies)
- Triage best practices (AskUserQuestion, P1/P2/P3 classification)
- Fix verification (typecheck, TODO updates, summaries)
- Performance optimization (grouping, parallelism, model selection)
- Common pitfalls and solutions

**Key Prevention Areas:**

1. **Agent Coordination Issues**
   - Always use `run_in_background: true` for parallel agents
   - Use TaskOutput to collect results after completion
   - Never launch dependent tasks in parallel
   - Prevent file conflicts between agents

2. **Triage Best Practices**
   - Use AskUserQuestion for unclear items
   - Apply P1/P2/P3 decision matrix
   - Create file-based todos for tracking
   - Verify before creating (prevent stale TODOs)

3. **Fix Verification**
   - Run typecheck after parallel fixes
   - Update TODO files to mark complete
   - Summarize changes for user
   - Playwright verification for UI changes

4. **Performance Optimization**
   - Group related fixes into single agents
   - Launch 8+ agents in parallel
   - Use haiku model for simple tasks
   - Set appropriate timeouts

**Quick Reference:** [Multi-Agent Quick Reference](./methodology/MULTI-AGENT-QUICK-REFERENCE.md) (print and pin!)

#### [Parallel TODO Resolution with Playwright Verification](./methodology/parallel-todo-resolution-with-playwright-verification-MAIS-20251225.md)

**Purpose:** Parallel TODO resolution with Playwright MCP verification and ISR cache clearing
**Audience:** Engineers resolving TODOs with UI verification requirements
**Date Created:** 2025-12-25
**Key Patterns:** Parallel TODO resolution, Playwright verification, ISR cache management

**Covers:**

- Parallel TODO resolution workflow using multi-agent architecture
- Playwright MCP integration for UI verification
- ISR cache clearing after data changes
- Verification patterns for tenant storefront changes
- Coordination between fix agents and verification agents

**Key Workflow:**

```bash
# 1. Launch parallel fix agents for independent TODOs
Task('Fix TODO-001: Add error boundary', { run_in_background: true })
Task('Fix TODO-002: Add loading state', { run_in_background: true })
Task('Fix TODO-003: Fix API contract', { run_in_background: true })

# 2. After fixes complete, verify with Playwright
mcp__playwright__browser_navigate({ url: 'http://localhost:3000/t/demo' })
mcp__playwright__browser_snapshot({})

# 3. Clear ISR cache after data changes
# Trigger revalidation by visiting page or calling revalidate API
fetch('/api/revalidate?path=/t/demo', { method: 'POST' })
```

**When to Use:**

- Resolving multiple independent TODOs in parallel
- Changes affecting tenant storefront pages
- Fixes that require visual verification
- After modifying ISR-cached pages

#### [Stale Todos Quick Reference](./STALE-TODOS-QUICK-REFERENCE.md)

**Purpose:** Quick decision tree for todo creation (5-minute guide)
**Audience:** All engineers creating todos
**Length:** ~2,000 words (print-friendly)
**When to use:** Before creating any todo from a plan or review

**Contains:**

- 5-minute decision tree
- Quick checklist
- Git commands (copy-paste ready)
- 4 common scenarios with examples
- Red flag warnings
- Cheat sheet for printing

**Quick Decision Tree:**

```
Are you creating a todo based on a plan?
├─ Search: glob + grep + git log
├─ Code exists?
│  ├─ YES, < 24h old? → SKIP
│  ├─ YES, > 24h old? → VERIFY todo
│  └─ NO? → IMPL todo
└─ Complete deferral checklist
```

**Quick Status Codes:**

- `pending` = Code doesn't exist, needs implementation
- `verify` = Code exists, verify it matches plan
- `audit` = Code exists, compliance/pattern check

**Expected Use:** Improves todo quality by 80% on first use

---

### 4. Agent Design Prevention Guides

#### [Build Mode Implementation Prevention Strategies](./patterns/build-mode-implementation-prevention-MAIS-20260105.md)

**Purpose:** Prevent 10 critical issues discovered in Build Mode code review (agent parity, DRY, PostMessage, draft systems)
**Audience:** Engineers building agent-integrated features with draft/publish workflows
**Length:** ~5,000 words (comprehensive with code patterns and checklists)
**Date Created:** 2026-01-05
**Issues Prevented:** Agent parity gaps, Zod schema duplication, PostMessage type safety, inconsistent draft systems, test coverage gaps

**Covers 10 Prevention Strategies:**

1. **Agent Parity Gap (P1)** - Every UI action must have corresponding agent tool
2. **DRY Violations - Schemas (P1)** - Extract Zod schemas to `@macon/contracts`
3. **DRY Violations - Helpers (P1)** - Extract shared helpers to dedicated module
4. **Testing Gap (P1)** - Minimum 80% coverage on agent tools/executors
5. **Inconsistent Draft System (P1)** - ALL visual changes go to draft, not live
6. **PostMessage Type Safety (P2)** - Zod validation for all messages, never cast
7. **PostMessage Security (P2)** - Always validate origin before processing
8. **Draft Preview Auth (P2)** - Authenticate all `?preview=draft` URLs
9. **Concurrency (P2)** - Optimistic locking with version field
10. **Performance (P2)** - Single query with all needed fields, not N+1

**Key Patterns:**

```typescript
// Agent Parity: Map ALL UI actions to tools
| UI Action | Agent Tool | Trust Tier |
| Edit section | update_page_section | T2 |
| Publish draft | publish_draft | T2 |  // <-- MISSING!
| Discard draft | discard_draft | T2 |  // <-- MISSING!

// DRY: Single schema source in contracts
import { UpdatePageSectionPayloadSchema } from '@macon/contracts';
// Used in BOTH tools AND executors

// PostMessage: Always validate, never cast
const message = parseChildMessage(event.data);  // Returns typed | null
if (!message) return;  // Invalid message

// Draft consistency: ALL visual changes to draft
await saveDraftConfig(prisma, tenantId, { pages, branding });  // Not direct tenant update
```

**Quick Reference Card:**

```
BUILD MODE QUICK REFERENCE
==========================
TOOLS: List ALL UI actions, create tool for EACH
SCHEMAS: Put in @macon/contracts, import everywhere
POSTMESSAGE: Zod schema + origin check + parseX() function
DRAFT: ALL visual changes to draft (including branding!)
TESTS: 80% coverage on tools/executors
```

**When to Read:**

- Building agent tools for any feature
- Implementing draft/publish workflows
- Adding PostMessage iframe communication
- Code reviewing agent feature PRs

---

#### [Agent Tool Architecture Prevention Strategies](./agent-design/AGENT-TOOL-ARCHITECTURE-PREVENTION-STRATEGIES-MAIS-20251228.md)

**Purpose:** Prevent 7 critical agent tool architecture issues discovered during code review
**Audience:** Engineers implementing agent read/write tools
**Length:** ~8,000 words (comprehensive with code patterns and implementation timeline)
**Date Created:** 2025-12-28
**Issues Prevented:** 451, 452, 453, 454, 455, 456, 457

**Covers 7 Prevention Strategies:**

1. **Unbounded Query Prevention (P1)** - Add `take` limits to all read tools to prevent memory exhaustion and token bloat
2. **Duplicate Tool Prevention (P2)** - Consolidate overlapping tools to reduce LLM decision paralysis
3. **Type Safety Prevention (P2)** - Replace `as any` casts with type guards and Zod validation
4. **Soft-Confirm Timing Prevention (P2)** - Add expiration timers to prevent unintended approvals
5. **Error Handling DRY Prevention (P2)** - Extract repeated error handling to reusable helpers
6. **Database Index Prevention (P2)** - Add composite indexes for agent query patterns
7. **Query Parallelization Prevention (P3)** - Use `Promise.all()` for independent database queries

**Key Statistics:**

- 7 issues identified across 2 tool files
- 1-2 issues P1 (critical), 5 issues P2 (important), 1 P3 (nice-to-have)
- Implementation timeline: 1-2 weeks for all issues
- Expected impact: 40x faster queries, 80% better code maintainability

**Code Patterns Included:**

- Pagination helpers with `take: Math.min(limit, 100)`
- Type guard validators: `(s: string): s is BookingStatus`
- Error handler utility: `handleToolError(error, toolName, tenantId)`
- Formatter helpers: `formatPrice()`, `formatDate()`, `buildDateRange()`
- Parallel query execution: `Promise.all([query1, query2])`

**Test Coverage:**

- Pagination tests (1000+ item datasets)
- Type safety tests (enum validation)
- Ownership/tenant isolation tests
- Parallel query performance tests
- Index usage verification (EXPLAIN ANALYZE)

**Quick Reference:** [Agent Tool Quick Checklist](./agent-design/AGENT-TOOL-QUICK-CHECKLIST-MAIS-20251228.md) (print and pin!)

**When to Read:**

- Building new agent read/write tools
- Adding pagination to existing tools
- Type safety improvements needed
- Code reviewing agent tool PRs
- Performance optimization work
- Database index planning

**Companion Documents:**

- [Agent Tool Quick Checklist](./agent-design/AGENT-TOOL-QUICK-CHECKLIST-MAIS-20251228.md) - Print-friendly checklist
- [Agent-Native Coaching Prevention Strategies](./agent-design/AGENT-NATIVE-COACHING-PREVENTION-STRATEGIES-MAIS-20251228.md) - Coaching/advisory agent patterns
- [Agent Design Prevention Strategies](./AGENT-DESIGN-PREVENTION-STRATEGIES.md) - Full agent design guide (if exists)

---

#### [Agent-Native Coaching Prevention Strategies](./agent-design/AGENT-NATIVE-COACHING-PREVENTION-STRATEGIES-MAIS-20251228.md)

**Purpose:** Prevent common issues when building pricing coaches, advisory agents, and context-aware AI features
**Audience:** Engineers building coaching/advisory agent features
**Length:** ~3,500 words
**Date Created:** 2025-12-28
**Key Patterns:** Context sanitization, token budget optimization, agent-native design principles

**Covers 4 Prevention Strategies:**

1. **Context Injection Sanitization** - Prevent prompt injection from user-controlled data (package names, descriptions)
2. **Token Budget Awareness** - Consolidate redundant prompt sections, stay under 2000 tokens
3. **Deprecated Code Cleanup Policy** - 2-week removal window, proper @deprecated annotations
4. **Agent-Native Patterns Checklist** - Guide vs. micromanage, trust intelligence, tools as primitives

**Quick Rules:**

```typescript
// ✅ Sanitize user-controlled data before context injection
import { sanitizeForContext } from './sanitize';

const context = `
Your packages:
${packages.map((p) => `- ${sanitizeForContext(p.name, 100)}: $${p.basePrice}`).join('\n')}
`;

// ✅ Sort packages by price ascending for coaching (starter → premium)
const sorted = packages.sort((a, b) => a.basePrice - b.basePrice);

// ✅ Agent-native: Framework as judgment criteria, not rules
// BAD: "Entry tier MUST be under $500"
// GOOD: "Apply Good/Better/Best framework as appropriate"

// ✅ Token budget: Each concept ONCE only
// BAD: Marketing tips section + Onboarding section + Strategy section (all mention G/B/B)
// GOOD: Single mention in most relevant location
```

**Issues Prevented:**

- Prompt injection via package names (e.g., "Ignore previous instructions...")
- Token budget bloat from redundant prompt sections
- Deprecated functions lingering in codebase
- Rule-based micromanagement instead of agent-native design
- Hardcoded price thresholds making agent inflexible

**Test Cases Included:**

- Injection pattern detection tests (50+ patterns)
- Package ordering verification tests
- Token budget compliance tests
- Deprecated code detection tests

**Quick Reference:** [AGENT-NATIVE-COACHING-QUICK-CHECKLIST-MAIS-20251228.md](./agent-design/AGENT-NATIVE-COACHING-QUICK-CHECKLIST-MAIS-20251228.md) (print and pin!)

**When to Read:**

- Building pricing coaches or advisory agents
- Injecting user data into context prompts
- Optimizing system prompt token usage
- Reviewing agent feature implementations
- Adding coaching/onboarding behavior

**Related Documents:**

- [Agent Design Prevention Strategies](./AGENT-DESIGN-PREVENTION-STRATEGIES.md) - Full agent design guide
- [Agent Design Quick Checklist](./AGENT-DESIGN-QUICK-CHECKLIST.md) - Complete agent design checklist
- [Agent Tool Addition Prevention](./AGENT-TOOL-ADDITION-PREVENTION.md) - Adding tools to agents
- [Agent Design Index](./agent-design/INDEX.md) - All agent design documentation

---

#### [Agent Architecture Improvements - Seven Issues Fixed](./code-review-patterns/agent-architecture-improvements-seven-fixes-MAIS-20251228.md)

**Purpose:** Prevent performance, type safety, and code quality issues in agent tools
**Audience:** Engineers building or maintaining agent tools
**Length:** ~2,500 words
**Date Created:** 2025-12-28
**Key Patterns:** DRY utilities, pagination limits, type guards, temporal constraints

**Covers 7 Issues (TODOs 451-457):**

1. **P1: Unbounded Queries** - Add `take` limits (25-100) to all list operations
2. **P2: Duplicate Tools** - Consolidate overlapping tools to reduce LLM decision paralysis
3. **P2: Type Safety** - Use type guards instead of `as any` casts
4. **P2: T2 Soft-Confirm Timing** - 2-minute window prevents stale confirmations
5. **P2: DRY Violations** - Centralized `utils.ts` with `handleToolError()`, `formatPrice()`, etc.
6. **P2: Missing Index** - Database index for revenue queries
7. **P3: Sequential Queries** - `Promise.all()` for parallel execution

**Quick Rules:**

```typescript
// ✅ Always add pagination limits
const results = await prisma.model.findMany({
  where: { tenantId },
  take: 100, // REQUIRED
});

// ✅ Use type guards, not casts
function isValidBookingStatus(s: string): s is BookingStatus {
  return Object.values(BookingStatus).includes(s as BookingStatus);
}

// ✅ Use DRY helpers
import { handleToolError, formatPrice } from './utils';

// ✅ Parallelize independent queries
const [booking, blackout] = await Promise.all([
  prisma.booking.findFirst({ where: { tenantId, date } }),
  prisma.blackoutDate.findFirst({ where: { tenantId, date } }),
]);
```

**When to Read:**

- Adding new agent tools
- Reviewing agent tool PRs
- Debugging agent performance issues
- Fixing type safety warnings in agent code

---

#### [Chatbot Proposal Execution Prevention Strategies](./agent-design/CHATBOT-PROPOSAL-EXECUTION-PREVENTION-STRATEGIES-MAIS-20251229.md)

**Purpose:** Prevent 4 critical issues in proposal execution: circular dependencies, missing T2 execution, proposal passthrough, field mapping
**Audience:** Engineers building or maintaining agent proposal/executor systems
**Length:** ~4,000 words
**Date Created:** 2025-12-29
**Key Patterns:** Executor registry extraction, state machine completeness, DTO mapping consistency

**Covers 4 Issues:**

1. **Circular Dependencies (P1)** - Extract executor registry to dedicated module, use `npx madge --circular` detection
2. **T2 Soft-Confirm Without Execution (P1)** - Add executor invocation loop after status update to CONFIRMED
3. **Proposal Not Passed to Frontend (P2)** - Ensure proposal object included in API response for T3 tools
4. **Field Name Mapping Mismatch (P2)** - Use canonical names from contracts, accept both old/new in executor

**Quick Rules:**

```typescript
// ✅ Registry in dedicated module (not routes)
// server/src/agent/proposals/executor-registry.ts
export function registerProposalExecutor(toolName: string, executor: ProposalExecutor): void { ... }
export function getProposalExecutor(toolName: string): ProposalExecutor | undefined { ... }

// ✅ Execute after soft-confirm
if (softConfirmedIds.length > 0) {
  for (const proposalId of softConfirmedIds) {
    const executor = getProposalExecutor(proposal.toolName);
    const result = await executor(tenantId, payload);
    await proposalService.markExecuted(proposalId, result);
  }
}

// ✅ Accept both field names in executor
const packageName = name || title;
const packagePrice = basePrice ?? priceCents;
```

**Quick Reference:** [CHATBOT-PROPOSAL-QUICK-REFERENCE-MAIS-20251229.md](./agent-design/CHATBOT-PROPOSAL-QUICK-REFERENCE-MAIS-20251229.md) (print and pin!)

**When to Read:**

- Adding new proposal executors
- Debugging proposal confirmation issues
- Adding new trust tiers
- Reviewing agent architecture PRs

---

#### [Customer Chatbot Phase 0 Prevention Strategies](./CUSTOMER_CHATBOT_PREVENTION_STRATEGIES.md)

**Purpose:** Prevent 5 critical security and data integrity issues in customer-facing chatbot
**Audience:** Engineers building or maintaining customer chatbot features
**Length:** ~6,000 words
**Date Created:** 2025-12-29
**Key Patterns:** Input sanitization, payment timestamp tracking, ownership verification, database indexing, prompt injection detection

**Covers 5 Issues:**

**P1 Issues:**

1. **HTML Injection in Emails** - Always sanitize customer input before HTML interpolation
2. **Proposal Enumeration** - Verify ownership at route AND executor levels (multi-layer defense)

**P2 Issues:** 3. **Missing Payment Timestamps** - Set `paidAt` on payment confirmation (data integrity) 4. **Missing Database Indexes** - Composite indexes for multi-column WHERE clauses (performance) 5. **Prompt Injection** - Pattern-based detection + hardened system prompt (behavioral security)

**Status:** ✅ IMPLEMENTED (commit e2d6545, except Issue #2 pending webhook update)

**Quick Rules:**

```typescript
// ✅ Issue #1: Sanitize before HTML
import { sanitizePlainText } from '../../lib/sanitization';
const safeCustomerName = sanitizePlainText(customerName);
const html = `<p>Hi ${safeCustomerName},</p>`;

// ✅ Issue #2: Payment timestamp (PENDING in webhook-processor.ts)
await prisma.booking.update({
  where: { id: bookingId },
  data: { status: 'CONFIRMED', paidAt: new Date() },
});

// ✅ Issue #3: Verify sessionId in WHERE + executor
const proposal = await prisma.agentProposal.findFirst({
  where: { id: proposalId, tenantId, sessionId }, // Layer 1
});
// Layer 2 re-verify in executor

// ✅ Issue #4: Composite indexes in schema
@@index([tenantId, sessionType, updatedAt])

// ✅ Issue #5: Block injection patterns
if (PROMPT_INJECTION_PATTERNS.some(p => p.test(userMessage))) {
  return { error: 'Cannot process that request' };
}
```

**Quick Reference:** [Customer Chatbot Quick Reference](./CUSTOMER_CHATBOT_QUICK_REFERENCE.md) (1-page checklist - print and pin!)

**When to Read:**

- Building customer-facing features
- Implementing booking confirmations
- Adding new customer chatbot tools
- Reviewing customer chatbot PRs

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

**Last Updated:** 2026-01-09
**Recent Additions (2026-01-09):**

- **[Code Review #708-717 Prevention Strategies](./patterns/CODE_REVIEW_708_717_PREVENTION_STRATEGIES.md)** - Comprehensive prevention guide for 10 code review findings from parallel agent review (commit 02cde7e8). Covers: TOCTOU race conditions with advisory locks (#708), unsafe type assertions with type guards (#709), premature optimization decision trees (#710), component duplication with variant patterns (#711-712), service logic DRY extraction (#713), XSS sanitization gaps (#714), unused type exports (#715), callback memoization profiling (#716), quota increment races (#717), and React 19 ref type compatibility. **P1 fix** (TOCTOU) + **P2 fixes** (5 patterns) + **P3 deferred** (4 patterns).
  - Quick Reference: [CODE_REVIEW_708_717_QUICK_REFERENCE.md](./patterns/CODE_REVIEW_708_717_QUICK_REFERENCE.md) - Print & pin (2 min read)

- **[React Unstable Array Dependency Prevention](./patterns/REACT_UNSTABLE_ARRAY_DEPENDENCY_PREVENTION.md)** - Comprehensive guide for preventing useEffect re-runs caused by unstable array references. Arrays created during render (`[].filter()`, parser returns) are new references each time, triggering effects. Fix with `useMemo()` to stabilize.
  - Quick Reference: [REACT_UNSTABLE_ARRAY_DEPENDENCY_QUICK_REFERENCE.md](./patterns/REACT_UNSTABLE_ARRAY_DEPENDENCY_QUICK_REFERENCE.md) - Print & pin (2 min read)

**Recent Additions (2026-01-09):**

- **[Agent UI Phase 5 Code Review Patterns](./patterns/AGENT_UI_PHASE_5_CODE_REVIEW_PATTERNS.md)** - 5 critical solution patterns from Phase 5 code review fixes (#678, #680, #682, #683, #684, #686). Covers: FIFO buffer for unbounded arrays, debounce cancellation before critical ops, async dialog handling, capability registry hygiene, singleton pattern documentation. **P1 patterns** (memory leaks, race conditions) + **P2/P3** (feature alignment, code clarity).
  - Quick Reference: [AGENT_UI_PHASE_5_QUICK_REFERENCE.md](./patterns/AGENT_UI_PHASE_5_QUICK_REFERENCE.md) - Print & pin (1 min read)

**Recent Additions (2026-01-08):**

- **[React Hooks Early Return Prevention](./patterns/REACT_HOOKS_EARLY_RETURN_PREVENTION.md)** - Comprehensive guide for React Rules of Hooks violations when adding early returns to existing components. Includes 3 correct patterns, ESLint rules, code review checklist, and test strategies.
  - Quick Reference: [REACT_HOOKS_EARLY_RETURN_QUICK_REFERENCE.md](./patterns/REACT_HOOKS_EARLY_RETURN_QUICK_REFERENCE.md) - Print & pin (2 min read)
- **[TypeScript Symlink Resolution Prevention](./patterns/TYPESCRIPT_SYMLINK_RESOLUTION_PREVENTION.md)** - Comprehensive guide for preventing double compilation from symlinks in TypeScript source directories. Includes tsconfig paths solutions, CI detection, and migration steps.
  - Quick Reference: [TYPESCRIPT_SYMLINK_QUICK_REFERENCE.md](./patterns/TYPESCRIPT_SYMLINK_QUICK_REFERENCE.md) - Print & pin (2 min read)
- **[Segment-First Browsing URL Hash State](./patterns/segment-first-browsing-url-hash-state-MAIS-20260108.md)** - UX pattern for tenant storefronts: segment-first browsing, URL hash state for browser back/forward, stock photo fallback system. Prevents dead page on back button, missing segment images.

**Recent Additions (2026-01-05):**

- **[Build Mode Implementation Prevention](./patterns/build-mode-implementation-prevention-MAIS-20260105.md)** - Comprehensive prevention strategies for agent tools, draft systems, PostMessage protocols, and testing requirements based on Build Mode code review findings
- **[Multi-Agent Code Review for Multi-Tenant Security](./code-review-patterns/multi-agent-code-review-booking-links-phase0-MAIS-20260105.md)** - 5 parallel review agents, triage voting, 4 P1 issues (tenant isolation, TOCTOU, executor registration, DRY)

**Recent Additions (2025-12-31):**

- **[Phase 5 Testing and Caching Prevention](./patterns/phase-5-testing-and-caching-prevention-MAIS-20251231.md)** - 4 issues: retryable keyword conflicts in tests, singleton cache testability, cache invalidation after writes, error sanitization in logs
- **[NextAuth v5 Production Authentication Prevention](./authentication-issues/NEXTAUTH-V5-PREVENTION-INDEX.md)** - Complete prevention guide for NextAuth v5 cookie prefix issues causing 401 on production HTTPS
- **[NextAuth v5 Secure Cookie Prefix](./authentication-issues/nextauth-v5-secure-cookie-prefix-production-401-MAIS-20251231.md)** - Root cause analysis and fix for `__Secure-` cookie prefix handling

**Recent Additions (2026-01-01):**

- **[Per-Session State Isolation for Agent Guardrails](./patterns/per-session-state-isolation-agent-guardrails-MAIS-20260101.md)** - Fix shared singleton circuit breakers with Map<sessionId, State> pattern + cleanup
- **[Required Security Fields on Agent Tools](./security-issues/required-security-fields-agent-tools-MAIS-20260101.md)** - Make trustTier required to prevent silent T1 defaults
- **[Contextual Rejection Patterns for T2 Proposals](./logic-errors/contextual-rejection-patterns-t2-proposals-MAIS-20260101.md)** - Replace broad keyword matching with positional/contextual regex patterns

**Previous Additions (2025-12-29):**

- **[Chatbot Proposal Execution Flow](logic-errors/chatbot-proposal-execution-flow-MAIS-20251229.md)** - T2 execution fix, field normalization, P1 tenant validation security
- **[Circular Dependency Executor Registry Pattern](patterns/circular-dependency-executor-registry-MAIS-20251229.md)** - Registry module pattern for breaking circular imports between orchestrator and routes
- Chatbot Proposal Execution Prevention Strategies - 4 critical issues: circular dependencies, T2 execution missing, proposal passthrough, field mapping
- Chatbot Proposal Quick Reference - 1-page checklist for proposal lifecycle verification
- Customer Chatbot Phase 0 Prevention Strategies - 5 critical issues covering HTML injection, payment timestamps, proposal enumeration, indexes, and prompt injection
- Customer Chatbot Quick Reference - 1-page printable checklist for all 5 prevention strategies

**Previous Additions (2025-12-28):**

- Agent Tool Architecture Prevention Strategies - 7 critical issues (451-457) covering unbounded queries, duplicate tools, type safety, timing, DRY, indexes, parallelization
- Agent Tool Quick Checklist - Print-friendly checklist for all 7 prevention strategies

**Previous Additions (2025-12-27):**

- TypeScript Unused Variable Underscore Prefix (TS6133) - when to use `_` prefix for unused params (Render deployment fix)
- TypeScript Build Errors Resolution - property name mismatches, type assertions, stub service patterns (Render deployment fix)
- MAIS Tenant Zero seed email correction

**Previous Additions (2025-12-25):**

- Multi-agent parallel code review workflow (6 review agents + 8 fix agents with interactive triage)
- Next.js migration lessons learned (10 key lessons + prevention checklist)
- Parallel TODO resolution with Playwright verification (ISR cache clearing after data changes)
- Code review quick reference (10 common P2/P3 patterns)
- Batch P2/P3 resolution for tenant multi-page sites

**Maintainer:** Tech Lead
**Status:** Active
