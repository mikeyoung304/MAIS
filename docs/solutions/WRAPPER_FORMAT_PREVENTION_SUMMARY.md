# Wrapper Format Prevention - Complete Implementation Summary

**Bug:** `/storefront/publish` endpoint used `{ published: draftConfig }` instead of `createPublishedWrapper()`, causing headline updates to not persist due to missing `publishedAt` timestamp.

**Pattern:** When saving `landingPageConfig`, must use the helper function that creates the full wrapper with all required fields.

**Severity:** P1 (Data Loss)

**Issue Reference:** #697

---

## Deliverables

This prevention strategy includes 4 key documents and 2 code files:

### 1. Primary Documentation Files

| File                                         | Purpose                                            | Audience              |
| -------------------------------------------- | -------------------------------------------------- | --------------------- |
| `WRAPPER_FORMAT_PREVENTION.md`               | Comprehensive guide with all prevention strategies | Engineers, Tech Leads |
| `patterns/WRAPPER_FORMAT_QUICK_REFERENCE.md` | 1-page cheat sheet for code reviews                | Code Reviewers        |
| `TEST_EXAMPLES_WRAPPER_FORMAT.md`            | Copy-paste test suites                             | Test Authors          |
| `ESLINT_RULE_SETUP.md`                       | How to configure and use ESLint rule               | DevOps, Setup         |

### 2. Code Files

| File                                                 | Purpose                                           |
| ---------------------------------------------------- | ------------------------------------------------- |
| `server/eslint-rules/landing-page-config-wrapper.js` | ESLint rule to catch violations                   |
| `server/src/lib/landing-page-utils.ts`               | (Update existing) Add branded type + enhancements |

---

## Implementation Roadmap

### Phase 1: Type Safety (Day 1)

**Goal:** Make incorrect usage impossible at compile time

**Steps:**

1. Add `ValidatedPublishedWrapper` branded type to `landing-page-utils.ts`
2. Update `TenantRepository` to accept branded type on `publishLandingPageDraft()`
3. Verify TypeScript compilation

**Files:**

- `server/src/lib/landing-page-utils.ts` - Add branded type
- `server/src/adapters/prisma/tenant.repository.ts` - Update type signature

**Time:** ~30 min

```bash
npm run typecheck  # Verify no TypeScript errors
```

### Phase 2: Linting (Day 1)

**Goal:** Catch violations in development and CI

**Steps:**

1. Copy ESLint rule file to `server/eslint-rules/`
2. Register rule in `.eslintrc.json`
3. Run against existing codebase
4. Fix any violations found

**Files:**

- `server/.eslintrc.json` - Add rule registration
- `server/eslint-rules/landing-page-config-wrapper.js` - Copy file

**Time:** ~30 min

```bash
npx eslint server/src --rule 'landing-page-config-wrapper: error'
```

### Phase 3: Testing (Day 1-2)

**Goal:** Comprehensive test coverage for wrapper format

**Steps:**

1. Add unit tests for `createPublishedWrapper()`
2. Add integration tests for `/storefront/publish` endpoint
3. Add schema validation tests
4. Add negative test cases (anti-patterns)

**Files:**

- `server/test/lib/landing-page-utils.test.ts` - Unit tests
- `server/test/routes/internal-agent-storefront.test.ts` - Integration tests
- `server/test/schemas/landing-page-wrapper.test.ts` - Schema tests
- `server/test/anti-patterns/landing-page-wrapper-anti-patterns.test.ts` - Anti-patterns

**Time:** ~1-2 hours

```bash
npm test -- landing-page-wrapper
npm test -- --coverage landing-page-wrapper
```

### Phase 4: Documentation (Day 2)

**Goal:** Ensure all patterns are documented

**Steps:**

1. Update CLAUDE.md with wrapper format rules
2. Create architecture document explaining dual draft system
3. Update code comments in `landing-page-utils.ts`
4. Add entry to `PREVENTION-QUICK-REFERENCE.md`

**Files:**

- `CLAUDE.md` - Add security rules section
- `docs/architecture/LANDING_PAGE_WRAPPER_FORMAT.md` - New architecture doc
- `docs/solutions/PREVENTION-QUICK-REFERENCE.md` - Update with entry

**Time:** ~1 hour

### Phase 5: Integration (Day 2)

**Goal:** Integrate into development workflow

**Steps:**

1. Add pre-commit hook for ESLint check
2. Add GitHub Actions workflow for CI
3. Document in development guidelines
4. Train team on pattern

**Files:**

- `.husky/pre-commit` - Add ESLint check
- `.github/workflows/lint.yml` - Add CI check
- `DEVELOPING.md` - Add workflow section

**Time:** ~1 hour

---

## Quick Implementation Checklist

### Type Safety

- [ ] Add `ValidatedPublishedWrapper` branded type
- [ ] Update repository type signatures
- [ ] Run `npm run typecheck` and verify success

### ESLint Rule

- [ ] Copy `landing-page-config-wrapper.js` to `server/eslint-rules/`
- [ ] Register in `.eslintrc.json` with `"landing-page-config-wrapper": "error"`
- [ ] Run `npx eslint server/src --rule 'landing-page-config-wrapper: error'`
- [ ] Fix any violations

### Tests

- [ ] Add unit tests for `createPublishedWrapper()` function
- [ ] Add integration test for `/storefront/publish` endpoint
- [ ] Add schema validation tests
- [ ] Verify all tests pass: `npm test`
- [ ] Check coverage: `npm test -- --coverage`

### Documentation

- [ ] Update `CLAUDE.md` with wrapper format section
- [ ] Create `LANDING_PAGE_WRAPPER_FORMAT.md` in architecture docs
- [ ] Update comments in `landing-page-utils.ts`
- [ ] Add entry to `PREVENTION-QUICK-REFERENCE.md`

### Workflow Integration

- [ ] Add pre-commit ESLint hook
- [ ] Add GitHub Actions CI check
- [ ] Document in `DEVELOPING.md`
- [ ] Run team training session

---

## Code Review Checklist Template

Use this in PR reviews for landing page changes:

```markdown
## Landing Page Wrapper Format Check

- [ ] All `landingPageConfig` updates use `createPublishedWrapper()`
- [ ] No manual object construction patterns detected
- [ ] `publishedAt` field is ISO string format (if reviewing directly)
- [ ] `draft` and `draftUpdatedAt` are null after publish
- [ ] Both `landingPageConfig` and `landingPageConfigDraft` update atomically
- [ ] Tests verify wrapper format with timestamps
- [ ] ESLint check passes: `npx eslint --rule 'landing-page-config-wrapper: error'`
```

---

## Test Coverage Goals

Target these coverage metrics for wrapper format code:

```
Landing Page Utils:
├── createPublishedWrapper()
│   ├── Structure (all 4 fields)          - 100%
│   ├── publishedAt timestamp              - 100%
│   ├── ISO format validation              - 100%
│   └── Edge cases (null, undefined, etc.) - 100%
├── countSectionsInConfig()
│   ├── Valid config                       - 100%
│   ├── Empty/null config                  - 100%
│   └── Malformed config                   - 100%
└── PublishedWrapper type                  - 100%

Landing Page Service:
├── publishBuildModeDraft()
│   ├── Creates wrapper                    - 100%
│   ├── Clears draft                       - 100%
│   ├── Atomic transaction                 - 100%
│   └── Audit logging                      - 100%
└── getPublished()
    ├── Reads from wrapper                 - 100%
    ├── Handles legacy format              - 100%
    └── Invalid config handling            - 100%

Routes:
├── POST /storefront/publish
│   ├── Creates wrapper with timestamp     - 100%
│   ├── Clears landingPageConfigDraft      - 100%
│   ├── Returns correct response           - 100%
│   └── Error cases                        - 100%
└── POST /storefront/discard
    ├── Clears draft without publishing    - 100%
    └── Preserves published config         - 100%

Overall Target: 95%+ coverage
```

---

## Metrics to Track

After implementation, monitor these metrics:

### Development Metrics

- **ESLint Violations:** Should be 0 after implementation
- **Pre-commit Block Rate:** Track violations caught before merge
- **Test Coverage:** Maintain 95%+ for wrapper format code
- **Type Errors:** Should catch all wrapper misuse at compile time

### Production Metrics

- **Published Config Visibility:** Monitor that 100% of publishes have `publishedAt`
- **Public API Success Rate:** Should be 100% (previously had issues)
- **Data Loss Incidents:** Should drop to 0
- **Audit Log Completeness:** All publishes should have timestamp for audit trail

### Code Quality Metrics

- **Code Review Time:** Should decrease (automated checks reduce discussion)
- **Regressions:** Should not see similar wrapper format bugs
- **Developer Confidence:** Should increase (known good pattern)

---

## Related Patterns in Codebase

Similar multi-field wrapper concerns found in these areas:

1. **Booking Data** (`booking.service.ts`)
   - Uses `$transaction` with advisory locks
   - Ensures atomic updates for double-booking prevention
   - Pattern: `await prisma.$transaction(async (tx) => {...})`

2. **Event Sourcing** (Build Mode)
   - Uses dual-source system (events + JSON field)
   - Pattern: Merge sources with priority rules
   - See: Pitfall #53 in CLAUDE.md

3. **Cache Keys** (Agent tools)
   - Must include tenantId to prevent cross-tenant collisions
   - Pattern: `const key = \`tenant:${tenantId}:resource:${id}\``

All require:

- Atomic transaction patterns
- Audit logging
- Data validation
- Type safety

---

## Learning Resources

**For understanding the bug:**

1. Read `WRAPPER_FORMAT_PREVENTION.md` - Full context
2. Read `patterns/WRAPPER_FORMAT_QUICK_REFERENCE.md` - 1-page summary
3. Check related issue #697 for discussion

**For implementation:**

1. Read `TEST_EXAMPLES_WRAPPER_FORMAT.md` - Copy test patterns
2. Read `ESLINT_RULE_SETUP.md` - Configure linting
3. Review existing code in `landing-page-utils.ts`

**For prevention:**

1. Add to code review checklist
2. Include in onboarding for new team members
3. Run monthly team training on pattern

---

## Prevention in Context

This bug illustrates a broader class of issues: **Incomplete Data Format Problems**

**Similar Issues to Watch For:**

1. Missing required fields in composite objects
2. Timestamp fields that should be generated but aren't
3. Nullable fields that should always be set
4. Transaction boundaries for multi-field updates

**General Prevention:**

1. **Branded types** - Use TypeScript to make invalid states unrepresentable
2. **Factory functions** - Single source of truth for object creation
3. **Validation layers** - Schema validation at persistence boundaries
4. **Test coverage** - Verify complete field presence
5. **ESLint rules** - Catch patterns at development time

---

## Files Created/Updated

### New Documentation

- `docs/solutions/WRAPPER_FORMAT_PREVENTION.md` (10 KB)
- `docs/solutions/patterns/WRAPPER_FORMAT_QUICK_REFERENCE.md` (3 KB)
- `docs/solutions/TEST_EXAMPLES_WRAPPER_FORMAT.md` (20 KB)
- `docs/solutions/ESLINT_RULE_SETUP.md` (8 KB)
- `docs/solutions/WRAPPER_FORMAT_PREVENTION_SUMMARY.md` (This file)

### New Code

- `server/eslint-rules/landing-page-config-wrapper.js` (5 KB)

### Files to Update

- `server/src/lib/landing-page-utils.ts` - Add branded type
- `server/src/adapters/prisma/tenant.repository.ts` - Update types
- `CLAUDE.md` - Add wrapper format section
- `docs/solutions/PREVENTION-QUICK-REFERENCE.md` - Add entry

---

## Next Steps

1. **Review** this document with team
2. **Implement Phase 1** (Type Safety) - Day 1 morning
3. **Implement Phase 2** (ESLint) - Day 1 afternoon
4. **Implement Phase 3** (Tests) - Day 1-2
5. **Implement Phase 4** (Documentation) - Day 2
6. **Implement Phase 5** (Integration) - Day 2 afternoon
7. **Deploy** and monitor metrics
8. **Train team** on new pattern
9. **Review** effectiveness after 1 week

---

## Questions?

Refer to the comprehensive `WRAPPER_FORMAT_PREVENTION.md` document for detailed answers on:

- Why the bug occurred
- How to fix it
- How to prevent it
- Testing strategies
- Code review processes
