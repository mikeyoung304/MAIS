# MAIS Quality-First Remediation Plan

**Created:** 2025-12-26
**Revised After:** Multi-agent review + Industry standards research + User feedback
**Philosophy:** Simplicity IS quality. Less code, better tested, properly measured.

---

## Executive Summary

This plan prioritizes **codebase quality over feature velocity**. Based on:

- Three independent code reviewers (DHH philosophy, Pragmatic engineering, Code simplicity)
- Industry standards research ([Baeldung](https://www.baeldung.com/cs/repository-vs-service), [Ardalis](https://ardalis.com/should-controllers-reference-repositories-services/), [Ron Jeffries](https://ronjeffries.com/articles/019-01ff/iter-yagni-skimp/), [CodeAnt](https://www.codeant.ai/blogs/code-quality-metrics-to-track))
- User requirement: "Near perfect codebase ready to scale. Time is irrelevant, only quality matters."

**Key Principle:** Over-engineering IS technical debt. A lean, well-tested codebase scales better than one with unnecessary abstractions.

---

## Current Quality Baselines

| Metric                | Current                | Target   | Industry Standard                                                                       |
| --------------------- | ---------------------- | -------- | --------------------------------------------------------------------------------------- |
| Test Pass Rate        | 95% (59 failed / 1184) | 100%     | 100% for CI gates                                                                       |
| Test Coverage         | Unknown                | 80%+     | 80%+ ([BrowserStack](https://www.browserstack.com/guide/software-code-quality-metrics)) |
| TypeScript Errors     | 8 errors               | 0        | 0 for strict mode                                                                       |
| ESLint                | Broken config          | 0 errors | 0 for CI gates                                                                          |
| Next.js Version       | 14.2.22 (CVE)          | 14.2.32+ | Latest patch                                                                            |
| Cyclomatic Complexity | Unknown                | Measured | Lower = better                                                                          |

---

## Items REMOVED from Original Plan

Based on reviewer consensus and industry standards on [pass-through services](https://www.baeldung.com/cs/repository-vs-service) and [YAGNI](https://www.geeksforgeeks.org/software-engineering/what-is-yagni-principle-you-arent-gonna-need-it/):

| Removed Item                          | Reason                                                                                           | Industry Reference                                                                                                                                                           |
| ------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **TenantService extraction**          | Pass-through service anti-pattern. Repository IS the abstraction.                                | "Pass-through services add unnecessary complexity without providing any real benefits." - [Baeldung](https://www.baeldung.com/cs/repository-vs-service)                      |
| **BookingWithCancellation interface** | Types already exist on Booking interface. Fix is removing `as any` casts, not adding interfaces. | YAGNI - "Unnecessary code accumulates technical debt" - [GeeksforGeeks](https://www.geeksforgeeks.org/software-engineering/what-is-yagni-principle-you-arent-gonna-need-it/) |
| **React.memo on sections**            | Premature optimization. SSR renders once. Measure before optimizing.                             | "Focus on actual problems, not theoretical" - [CodeAnt](https://www.codeant.ai/blogs/code-quality-metrics-to-track)                                                          |
| **UploadService DI migration**        | Singleton works fine. No testability issues demonstrated.                                        | "If it ain't broke, don't fix it" - Pragmatic engineering                                                                                                                    |
| **Request-level idempotency**         | Already have DB advisory locks + webhook idempotency. Redundant layer.                           | YAGNI                                                                                                                                                                        |
| **BookingService split**              | 1395 lines is reasonable for core domain. Cohesion > arbitrary size limits.                      | "Be careful when adding additional layers" - [Ardalis](https://ardalis.com/should-controllers-reference-repositories-services/)                                              |
| **JWT refresh tokens**                | 7-day expiry is reasonable for this use case. No demonstrated security issue.                    | YAGNI                                                                                                                                                                        |
| **Database RLS**                      | Application layer has 309 tenantId filtering instances. Defense in depth is good but not urgent. | Defer to future security review                                                                                                                                              |

---

## Phase 0: Quality Foundation (Prerequisite)

**Goal:** Establish a green baseline before any changes.

### 0.1 Fix TypeScript Errors

**Current:** 8 errors in `apps/web`
**Target:** 0 errors

```
src/app/(protected)/tenant/branding/page.tsx(46,11): error TS2339: Property 'backendToken' does not exist
src/app/(protected)/tenant/dashboard/page.tsx(41,11): error TS2339: Property 'backendToken' does not exist
src/app/(protected)/tenant/domains/page.tsx(61,11): error TS2339: Property 'backendToken' does not exist
src/app/(protected)/tenant/packages/page.tsx(37,11): error TS2339: Property 'backendToken' does not exist
src/app/(protected)/tenant/payments/page.tsx(58,11): error TS2339: Property 'backendToken' does not exist
src/app/(protected)/tenant/scheduling/page.tsx(40,11): error TS2339: Property 'backendToken' does not exist
src/app/(protected)/tenant/pages/[pageType]/page.tsx(47,18): error TS2552: Cannot find name 'useRouter'
src/app/(protected)/tenant/dashboard/page.tsx(108,53): error TS2345: Argument of type 'unknown'
```

**Root Cause Analysis Required:**

- `backendToken` property missing from auth context type
- `useRouter` import missing or wrong import
- `unknown` type needs proper error handling

**Acceptance Criteria:**

- [ ] `npm run typecheck` passes with 0 errors
- [ ] All TypeScript strict mode checks pass

### 0.2 Fix ESLint Configuration

**Current:** Broken - incompatible options for ESLint 9.x flat config
**Target:** Working ESLint with 0 errors

**Error:**

```
Invalid Options: useEslintrc, extensions, resolvePluginsRelativeTo, rulePaths, ignorePath
```

**Fix Required:**

- Migrate from `.eslintrc` to `eslint.config.js` (flat config)
- Remove deprecated options
- Or pin ESLint to 8.x compatible version

**Acceptance Criteria:**

- [ ] `npm run lint` passes with 0 errors
- [ ] ESLint configuration is valid

### 0.3 Fix Failing Tests

**Current:** 59 failed / 1184 total tests (95% pass rate)
**Target:** 0 failed / 100% pass rate

**Observed Failure Pattern:**

```
PrismaClientKnownRequestError:
  Invalid `this.prisma.webhookEvent.findFirst()` invocation
```

**Root Cause Analysis Required:**

- Database connection pool exhaustion in integration tests
- Possible missing test isolation/cleanup
- Prisma client configuration issues

**Acceptance Criteria:**

- [ ] `npm test --workspace=server -- --run` passes with 0 failures
- [ ] All 1184 tests pass
- [ ] Skipped tests reviewed (59 skipped - are they valid skips?)

### 0.4 Commit Staged Wave 1 Fixes

**Current:** N+1 query fix and unbounded findAll fix are staged but not committed.

**Files to commit:**

- `server/src/services/catalog.service.ts` - N+1 fix
- `server/src/adapters/prisma/booking.repository.ts` - Pagination
- `server/src/adapters/mock/index.ts` - Mock pagination
- `server/src/lib/ports.ts` - Interface update
- Deleted backup files (7 files)
- Deleted `.github/workflows/e2e.yml`

**Acceptance Criteria:**

- [ ] All staged changes committed
- [ ] Commit message documents the fixes
- [ ] Tests still pass after commit

---

## Phase 1: Security & Immediate Fixes

**Goal:** Address security vulnerability and documentation accuracy.

### 1.1 Update Next.js to 14.2.32+ (CRITICAL)

**Current:** 14.2.22 (CVE - authorization bypass in middleware)
**Target:** 14.2.32+

**Command:**

```bash
cd apps/web && npm install next@14.2.32
```

**Acceptance Criteria:**

- [ ] `package.json` shows next@14.2.32 or higher
- [ ] `npm run build --workspace=apps/web` succeeds
- [ ] Middleware auth flows verified working
- [ ] E2E tests pass

### 1.2 Fix Broken Documentation Links

**Files with broken links:**

- `README.md` - 5 references to `/docs/sprints/` and `/docs/phases/`
- `ARCHITECTURE.md`
- `docs/INDEX.md`
- `docs/README.md`

**Fix:** Update paths to archived locations:

- `/docs/sprints/` → `/docs/archive/2025-12/sprints/`
- `/docs/phases/` → `/docs/archive/2025-12/phases/`

**Acceptance Criteria:**

- [ ] No broken internal documentation links
- [ ] `grep -r "docs/sprints/" . --include="*.md"` returns only archive references

### 1.3 Fix pnpm/npm Inconsistency

**File:** `README.md` line 283
**Current:** `- **Monorepo**: pnpm workspaces`
**Fix:** `- **Monorepo**: npm workspaces`

**Acceptance Criteria:**

- [ ] README.md accurately describes npm workspaces

### 1.4 Update Stale Documentation

**Updates Required:**

| File          | Issue                      | Fix                     |
| ------------- | -------------------------- | ----------------------- |
| CLAUDE.md     | Test count "752"           | Update to actual count  |
| CLAUDE.md     | "MVP Sprint Day 4" section | Archive or update       |
| README.md     | Sprint dates say Nov 2025  | Update to Dec 2025      |
| docs/INDEX.md | Sprint 6 as current        | Update to current state |

**Acceptance Criteria:**

- [ ] All test counts match actual
- [ ] All sprint/date references are current
- [ ] Documentation accurately reflects codebase state

### 1.5 Remove Unnecessary Type Casts

**File:** `server/src/routes/public-booking-management.routes.ts`
**Lines:** 75-79, 109, 141

**Current (incorrect):**

```typescript
cancelledBy: (booking as any).cancelledBy,
cancellationReason: (booking as any).cancellationReason,
```

**Fix (correct):**

```typescript
cancelledBy: booking.cancelledBy,
cancellationReason: booking.cancellationReason,
```

**Rationale:** The `Booking` interface in `entities.ts:80-87` already includes these fields. The `as any` casts are unnecessary and hide type safety.

**Acceptance Criteria:**

- [ ] No `as any` casts for booking cancellation fields
- [ ] TypeScript compiles without errors
- [ ] Existing tests pass

---

## Phase 2: Quality Infrastructure

**Goal:** Establish measurement and enforcement of quality standards.

### 2.1 Establish Test Coverage Baseline

**Industry Standard:** 80%+ coverage ([BrowserStack](https://www.browserstack.com/guide/software-code-quality-metrics))

**Actions:**

1. Run coverage report: `npm test --workspace=server -- --coverage`
2. Document current coverage by module
3. Identify critical paths with low coverage
4. Set coverage targets by priority

**Coverage Targets:**

| Module                             | Target | Rationale              |
| ---------------------------------- | ------ | ---------------------- |
| `services/booking.service.ts`      | 90%+   | Core revenue path      |
| `services/availability.service.ts` | 90%+   | Booking accuracy       |
| `middleware/auth.ts`               | 95%+   | Security critical      |
| `middleware/tenant.ts`             | 95%+   | Multi-tenant isolation |
| `adapters/stripe.adapter.ts`       | 85%+   | Payment processing     |
| Overall                            | 80%+   | Industry standard      |

**Acceptance Criteria:**

- [ ] Coverage report generated and documented
- [ ] Coverage targets established per module
- [ ] Baseline documented for tracking

### 2.2 Establish Complexity Metrics

**Industry Standard:** Lower cyclomatic complexity = easier to test, maintain, scale

**Tools:**

- `npx madge --circular server/src` - Detect circular dependencies
- `npx ts-complexity server/src` - Measure function complexity

**Actions:**

1. Run complexity analysis
2. Identify high-complexity functions (>10 cyclomatic complexity)
3. Document complexity hotspots
4. Set complexity limits for new code

**Acceptance Criteria:**

- [ ] Complexity baseline documented
- [ ] High-complexity functions identified
- [ ] Refactoring candidates prioritized

### 2.3 Fix ESLint and Establish Style Baseline

**Actions:**

1. Fix ESLint configuration (migrate to flat config or pin version)
2. Run `npm run lint -- --fix` to auto-fix simple issues
3. Address remaining errors systematically
4. Document any intentional rule disables

**Acceptance Criteria:**

- [ ] ESLint runs without configuration errors
- [ ] All lint errors fixed (0 remaining)
- [ ] ESLint rules documented in CLAUDE.md

### 2.4 Review and Resolve Skipped Tests

**Current:** 59 skipped tests

**Actions:**

1. List all skipped tests with reasons
2. For each: fix, remove, or document why skip is intentional
3. Remove stale `.skip()` markers

**Acceptance Criteria:**

- [ ] All skipped tests reviewed
- [ ] Intentional skips documented with issue links
- [ ] Stale skips removed

---

## Phase 3: Quality Gates in CI/CD

**Goal:** Prevent quality regressions automatically.

### 3.1 Add Coverage Gate

**Implementation:**

```yaml
# .github/workflows/main-pipeline.yml
- name: Run tests with coverage
  run: npm test --workspace=server -- --coverage --coverageReporters=json-summary

- name: Check coverage threshold
  run: |
    COVERAGE=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
    if (( $(echo "$COVERAGE < 80" | bc -l) )); then
      echo "Coverage $COVERAGE% is below 80% threshold"
      exit 1
    fi
```

**Acceptance Criteria:**

- [ ] CI fails if coverage drops below 80%
- [ ] Coverage badge in README

### 3.2 Add Lint Gate

**Implementation:**

```yaml
- name: Lint
  run: npm run lint
  # Remove continue-on-error: true
```

**Acceptance Criteria:**

- [ ] CI fails on any lint errors
- [ ] No `continue-on-error` for lint step

### 3.3 Add TypeScript Gate

**Implementation:**

```yaml
- name: Type check
  run: npm run typecheck
```

**Acceptance Criteria:**

- [ ] CI fails on any TypeScript errors
- [ ] Strict mode enforced

### 3.4 Add Complexity Gate (Optional)

**Implementation:**

```yaml
- name: Check complexity
  run: |
    npx ts-complexity server/src --max-complexity 15 || exit 1
```

**Acceptance Criteria:**

- [ ] New functions with complexity >15 fail CI
- [ ] Documented exception process for complex functions

---

## Phase 4: Targeted Improvements (Reviewer-Approved)

**Goal:** Only changes that provide measurable value.

### 4.1 Parallelize AvailabilityService Queries

**File:** `server/src/services/availability.service.ts:43-63`
**Impact:** 50-70% latency reduction for available date checks

**Current (sequential):**

```typescript
const isBlackout = await this.blackoutRepo.isBlackoutDate(tenantId, date);
if (isBlackout) return { date, available: false, reason: 'blackout' };

const isBooked = await this.bookingRepo.isDateBooked(tenantId, date);
if (isBooked) return { date, available: false, reason: 'booked' };

const isCalendarAvailable = await this.calendarProvider.isDateAvailable(date);
```

**Optimized (hybrid - per pragmatic reviewer):**

```typescript
// Check blackout first (fast local DB, most common block)
const isBlackout = await this.blackoutRepo.isBlackoutDate(tenantId, date);
if (isBlackout) return { date, available: false, reason: 'blackout' };

// Parallelize the expensive checks
const [isBooked, isCalendarAvailable] = await Promise.all([
  this.bookingRepo.isDateBooked(tenantId, date),
  this.calendarProvider.isDateAvailable(date),
]);

if (isBooked) return { date, available: false, reason: 'booked' };
if (!isCalendarAvailable) return { date, available: false, reason: 'calendar' };
return { date, available: true };
```

**Acceptance Criteria:**

- [ ] Existing tests pass
- [ ] Latency measured before/after (document improvement)
- [ ] No increase in external API calls

### 4.2 Configure Missing Rate Limiters

**File:** `server/src/middleware/rateLimiter.ts`

**TODO Items:**

- TODO-057: Public scheduling endpoints
- TODO-193: Add-on read/write operations
- TODO-273: Stripe webhook endpoint

**Acceptance Criteria:**

- [ ] All rate limiters configured
- [ ] Rate limit tests added
- [ ] TODO comments removed

### 4.3 Add Next.js Deployment Workflow

**New File:** `.github/workflows/deploy-nextjs.yml`

**Requirements:**

- Build: `npm run build --workspace=apps/web`
- Deploy to Vercel (or preferred host)
- Environment variables configured
- Preview deployments for PRs

**Acceptance Criteria:**

- [ ] apps/web deploys automatically on merge to main
- [ ] Preview URLs for pull requests
- [ ] Environment variables documented

---

## Phase 5: Ongoing Quality Practices

**Goal:** Maintain quality as codebase evolves.

### 5.1 Pre-Commit Hooks

**Implementation:** Add husky + lint-staged

```json
// package.json
{
  "lint-staged": {
    "*.ts": ["eslint --fix", "prettier --write"],
    "*.tsx": ["eslint --fix", "prettier --write"]
  }
}
```

**Acceptance Criteria:**

- [ ] Commits blocked if lint fails
- [ ] Auto-formatting on commit

### 5.2 PR Quality Checklist

**Add to PR template:**

```markdown
## Quality Checklist

- [ ] Tests pass locally (`npm test`)
- [ ] TypeScript compiles (`npm run typecheck`)
- [ ] Lint passes (`npm run lint`)
- [ ] Coverage maintained or improved
- [ ] No new `as any` type casts
- [ ] No console.log statements
```

### 5.3 Monthly Quality Review

**Metrics to Track:**

- Test coverage trend
- Cyclomatic complexity trend
- Defect density
- Code churn in high-risk files

---

## Success Metrics

| Metric            | Phase 0    | Phase 1  | Phase 2  | Phase 3 | Phase 4    |
| ----------------- | ---------- | -------- | -------- | ------- | ---------- |
| Test Pass Rate    | 95% → 100% | 100%     | 100%     | 100%    | 100%       |
| TypeScript Errors | 8 → 0      | 0        | 0        | 0       | 0          |
| ESLint Errors     | Broken → 0 | 0        | 0        | 0       | 0          |
| Coverage          | Unknown    | Baseline | 80%+     | Gated   | Maintained |
| Next.js CVE       | Vulnerable | Fixed    | Fixed    | Fixed   | Fixed      |
| Complexity        | Unknown    | Baseline | Measured | Gated   | Maintained |

---

## Appendix: Industry Standards References

### On Service Layers

> "One common misconception is the idea of a 'pass-through' service, where the service layer does nothing but pass queries to the repository. This approach adds unnecessary complexity without providing any real benefits."
> — [Baeldung: Repository vs Service](https://www.baeldung.com/cs/repository-vs-service)

### On YAGNI

> "Always implement things when you actually need them, never when you just foresee that you need them."
> — Ron Jeffries, XP Co-founder ([source](https://ronjeffries.com/articles/019-01ff/iter-yagni-skimp/))

> "Unnecessary code adds complexity... Code that exists must be maintained. Even if a feature is never used, it can introduce bugs, requires updates when you refactor other parts, and accumulates technical debt over time."
> — [GeeksforGeeks: YAGNI Principle](https://www.geeksforgeeks.org/software-engineering/what-is-yagni-principle-you-arent-gonna-need-it/)

### On Code Quality Metrics

> "Aim for near-complete test coverage (think 80% and above)... The lower the cyclomatic complexity, the easier your code is to test, maintain, and scale."
> — [CodeAnt: Top 15 Code Quality Metrics](https://www.codeant.ai/blogs/code-quality-metrics-to-track)

### On Complexity Limits

> "Functions with a high cyclomatic complexity are more difficult to test and more likely to have defects."
> — [BrowserStack: Code Quality Metrics](https://www.browserstack.com/guide/software-code-quality-metrics)

---

## Changelog

| Version | Date       | Changes                                                                                                                                                                                           |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.0     | 2025-12-26 | Original 4-wave plan                                                                                                                                                                              |
| 2.0     | 2025-12-26 | Revised after multi-agent review. Removed TenantService, BookingWithCancellation interface, React.memo, UploadService DI, idempotency, BookingService split. Added quality infrastructure phases. |

---

_This plan prioritizes simplicity and measurable quality over architectural purity._
_Industry standards and reviewer consensus: Less code, better tested, properly measured._
