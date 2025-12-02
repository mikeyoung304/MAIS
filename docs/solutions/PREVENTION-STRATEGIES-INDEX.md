---
title: Prevention Strategies Documentation Index
category: prevention
tags: [index, navigation, overview]
priority: P0
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
photos: data.photos as Prisma.InputJsonValue

// ✅ Clearing JSON fields
draftPhotos: Prisma.JsonNull
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

### "I'm adding a new API endpoint"

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

| Script | Purpose | Usage |
|--------|---------|-------|
| `validate-patterns.sh` | Check code for anti-patterns | `.github/scripts/validate-patterns.sh` |
| `check-indexes.js` | Verify database indexes | `node scripts/check-indexes.js` |
| `npm run lint` | ESLint validation | `npm run lint` |
| `npm test` | Run all tests | `npm test` |

### Grep Commands

```bash
# Find queries without tenantId
rg 'prisma\.\w+\.findMany' --type ts | rg -v 'tenantId'

# Find new PrismaClient()
rg 'new PrismaClient\(\)' server/src/routes --type ts

# Find console.log
rg 'console\.log' server/src --type ts

# Find prompt/alert/confirm
rg 'prompt\(|alert\(|confirm\(' client/src --type ts
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

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| P1 issues/sprint | 0 | 7 | 🔴 |
| Test coverage | 90% | 85% | 🟡 |
| Security vulns | 0 | 3 | 🔴 |
| Feature completeness | 100% | 60% | 🔴 |
| PrismaClient instances | 1 | 5+ | 🔴 |
| Console.log usage | 0 | 12+ | 🔴 |

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
