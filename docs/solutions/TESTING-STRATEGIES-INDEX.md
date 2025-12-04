# Testing Prevention Strategies - Complete Index

Comprehensive prevention strategies for testing gaps across the MAIS codebase.

## Overview

**Problem Solved:** The codebase had 771 server tests but zero tests for critical seed functions. The new storefront refactoring also had no E2E coverage. This created significant risk of production breakage.

**Solutions Delivered:**

- 66 unit tests for seed functions (mode detection, security guards, idempotency)
- 6 E2E test files for storefront, booking, and signup flows
- Comprehensive prevention strategies to prevent future testing gaps
- Pre-commit hooks, CI pipeline enhancements, and team checklists

---

## Document Structure

### 1. Core Strategy Documents

#### TESTING-PREVENTION-STRATEGIES.md (30KB)

**The main reference for prevention strategies**

Covers:

- Pre-commit hooks (4 new hooks with detailed implementation)
- Code review checklist items (by change type: seeds, UI, services)
- CI pipeline enhancements (seed-tests job, E2E coverage analysis, mutation testing)
- Best practices (when to add tests, test expectations)
- Testing patterns (idempotency, environment guards, mock Prisma, responsive testing, error paths)
- Implementation timeline and quick reference

**When to read:**

- Understanding what prevention strategies are available
- Designing team testing policies
- Creating new testing guidelines

#### TESTING-IMPLEMENTATION-GUIDE.md (23KB)

**Step-by-step guide to implement prevention strategies**

Covers:

- Setting up pre-commit hooks (bash scripts, making executable)
- Updating CI pipeline (.github/workflows/main-pipeline.yml)
- Creating code review templates (.github/pull_request_template.md)
- Local testing workflows
- Creating tests for new seed functions (templates)
- Creating E2E tests for UI changes (templates)
- Verification checklist and troubleshooting

**When to read:**

- Ready to implement prevention strategies
- Setting up CI pipeline
- Training team members
- Troubleshooting test failures

#### TESTING-QUICK-REFERENCE.md (9KB)

**Print and pin to your desk!**

Quick lookup for:

- When to write tests (by module type)
- Test checklist by change type (seeds, UI, services)
- Pre-commit checklist
- Test patterns (condensed)
- Common commands (test, seed, database)
- Red flags in code review
- Troubleshooting quick fixes
- Coverage targets

**When to use:**

- During daily development
- Code review
- Quick decision making
- Looking up a command

---

## Implementation Phases

### Phase 1: Foundation (COMPLETED)

- [x] Seed function unit tests (66 tests)
- [x] Storefront E2E tests (6+ test files)
- [x] Strategy documentation (3 documents)

### Phase 2: Infrastructure (IN PROGRESS)

- [ ] Pre-commit hook setup (.husky scripts)
- [ ] CI pipeline enhancement (seed-tests job)
- [ ] Code review template (.github/pull_request_template.md)

### Phase 3: Team Adoption (UPCOMING)

- [ ] Review all documents as a team
- [ ] Set up pre-commit hooks locally
- [ ] Update CI/CD pipeline
- [ ] Train on new testing patterns

### Phase 4: Maintenance (ONGOING)

- [ ] Enforce testing standards on PRs
- [ ] Iterate based on team feedback
- [ ] Expand to other critical modules
- [ ] Monitor coverage metrics

---

## For Different Audiences

### For Development Teams

**Start here:**

1. Read: TESTING-QUICK-REFERENCE.md (5 min)
2. Read: TESTING-PREVENTION-STRATEGIES.md sections 4-5 (Best Practices & Patterns)
3. Practice: Run existing tests locally
4. Implement: Add tests when modifying code

**Key takeaways:**

- Always test critical paths (seeds, services, UI)
- Use provided patterns (idempotency, environment guards, E2E)
- Run pre-commit checks before committing
- Ask questions in code review

### For Tech Leads / Architects

**Start here:**

1. Read: TESTING-PREVENTION-STRATEGIES.md sections 1-3 (Hooks, Checklists, CI)
2. Read: TESTING-IMPLEMENTATION-GUIDE.md
3. Plan: Timeline for team rollout
4. Communicate: Share standards and expectations

**Key decisions:**

- Which pre-commit hooks to enable first
- CI pipeline investment (seed-tests, mutation testing)
- Code review process updates
- Coverage target increases

### For DevOps / CI Engineers

**Start here:**

1. Read: TESTING-PREVENTION-STRATEGIES.md section 3 (CI Pipeline)
2. Read: TESTING-IMPLEMENTATION-GUIDE.md Part 2 (CI Setup)
3. Implement: seed-tests job and coverage gates
4. Monitor: Pipeline health and timing

**Key responsibilities:**

- Add seed-tests job to main-pipeline.yml
- Configure coverage thresholds
- Set up test artifact collection
- Monitor pipeline execution times

### For Security / Code Reviewers

**Start here:**

1. Read: TESTING-PREVENTION-STRATEGIES.md section 2 (Code Review)
2. Read: TESTING-IMPLEMENTATION-GUIDE.md Part 3 (Review Template)
3. Use: Custom review guide for each change type
4. Enforce: Testing standards on PRs

**Key review areas:**

- Multi-tenant isolation in all queries
- Seed idempotency and security guards
- E2E coverage for critical UI
- Error handling and edge cases

---

## Testing Patterns Reference

### Seed Function Testing

Location: TESTING-PREVENTION-STRATEGIES.md section 5.1

Tests for:

- Environment variable validation and helpful errors
- Idempotency (upsert pattern, no duplicates)
- Correct data creation with proper associations
- Error handling (constraint violations, Prisma errors)
- Security (password hashing, random key generation)

Examples:

- `server/test/seeds/seed-orchestrator.test.ts` (mode detection)
- `server/test/seeds/platform-seed.test.ts` (env validation)
- `server/test/seeds/demo-seed.test.ts` (idempotency)
- `server/test/seeds/e2e-seed.test.ts` (E2E tenant setup)

### Service Layer Testing

Location: TESTING-PREVENTION-STRATEGIES.md section 5.3

Tests for:

- Happy path with mocked dependencies (unit tests)
- Real database interactions (integration tests)
- Multi-tenant scoping by tenantId
- Error paths with domain errors
- Async safety (no race conditions, pessimistic locks)

Examples:

- `server/src/services/audit.service.test.ts`
- `server/test/services/upload.service.test.ts`
- `server/test/integration/booking-repository.integration.spec.ts`

### E2E UI Testing

Location: TESTING-PREVENTION-STRATEGIES.md section 5.4

Tests for:

- Happy path navigation and data display
- Loading, error, and empty states
- User interactions (forms, buttons, modals)
- Responsive layout (mobile, tablet, desktop)
- Navigation flows and deep linking

Examples:

- `e2e/tests/storefront.spec.ts` (navigation, tier display)
- `e2e/tests/tenant-signup.spec.ts` (form submission)
- `e2e/tests/password-reset.spec.ts` (email flow)
- `e2e/tests/booking-flow.spec.ts` (booking creation)

---

## Prevention Infrastructure

### Pre-Commit Hooks (Phase 2)

- `.husky/seed-validation` - Verify seed tests exist
- `.husky/e2e-coverage-check` - Flag critical UI changes without E2E
- `.husky/pre-commit` - Orchestrate all checks

### CI Pipeline (Phase 2)

- `seed-tests` job - Run seed unit tests and verify idempotency
- `unit-tests` job - Existing unit test coverage
- `integration-tests` job - Existing database tests
- `e2e-tests` job - Existing Playwright tests

### Code Review (Phase 2)

- `.github/pull_request_template.md` - Testing checklist
- `docs/CODE_REVIEW_GUIDE.md` - Detailed review guidance
- Module-specific checklists (seeds, UI, services)

---

## Key Metrics

### Test Coverage (Current)

| Category          | Count          | Coverage                |
| ----------------- | -------------- | ----------------------- |
| Unit tests        | 771            | 42% (target: 80%)       |
| Integration tests | Included above | 77% branches            |
| E2E tests         | 21+            | Critical paths covered  |
| **Seed tests**    | **66**         | **New - 100% coverage** |

### Test Execution Time (Local)

```bash
npm run test:unit              # ~10 seconds
npm run test:integration       # ~15 seconds (requires DB)
npm run test:coverage          # ~30 seconds
npm run test:e2e               # ~45 seconds (slow)
```

### CI Pipeline Timing (GitHub Actions)

```
Documentation validation       ~1 min
Pattern validation            ~1 min
Lint & format check           ~2 min
TypeScript check              ~2 min
Unit tests                    ~5 min
Integration tests             ~8 min
Seed tests (NEW)              ~3 min
E2E tests                      ~10 min
Build validation              ~3 min
---
Total                          ~35 min (parallel)
```

---

## Maintenance & Updates

### When to Update Testing Strategies

**Add new seed test patterns:**

- When creating a new seed function (e.g., `seedStripeConnect`)
- When modifying seed environment requirements
- When adding new security guards

**Add new E2E test patterns:**

- When creating new critical UI flows (payment, admin, etc.)
- When adding complex user interactions
- When changing critical routing logic

**Expand prevention hooks:**

- When discovering common testing mistakes
- When CI pipeline uncovers gaps
- When team requests additional checks

### Monitoring & Iteration

Track:

- Test coverage improvements (target: 80% by Q2 2025)
- Pre-commit hook adoption and false-positive rates
- CI job timing (optimize if >45 min)
- Team adoption metrics (% of PRs with test updates)

Review quarterly:

- Coverage trends
- Testing pattern effectiveness
- CI pipeline improvements
- Team feedback and suggestions

---

## Quick Links

### Documents

- **Main Strategy**: TESTING-PREVENTION-STRATEGIES.md (30KB)
- **Implementation**: TESTING-IMPLEMENTATION-GUIDE.md (23KB)
- **Quick Ref**: TESTING-QUICK-REFERENCE.md (9KB)

### Test Examples

- **Seed Tests**: server/test/seeds/\*.test.ts
- **Service Tests**: server/src/services/\*.test.ts
- **E2E Tests**: e2e/tests/\*.spec.ts

### Configuration

- **Pre-commit**: .husky/pre-commit
- **CI Pipeline**: .github/workflows/main-pipeline.yml
- **Test Config**: server/vitest.config.ts
- **E2E Config**: e2e/playwright.config.ts

### Related Documentation

- [Project CLAUDE.md](../../CLAUDE.md) - Architecture & standards
- [Existing Testing Guide](../TESTING.md)
- [Multi-Tenant Patterns](../multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md)
- [Prevention Strategies Index](./PREVENTION-STRATEGIES-INDEX.md)

---

## Getting Started

### For New Team Members

1. **Day 1**: Read TESTING-QUICK-REFERENCE.md (5 min)
2. **Day 1**: Clone repo and run `npm test` locally
3. **Day 2**: Read TESTING-PREVENTION-STRATEGIES.md (30 min)
4. **Day 2**: Write your first test following provided patterns
5. **Day 3**: Submit a PR with tests included

### For Adding a New Feature

```
1. Plan feature (design, routes, database)
2. Write unit tests (mocked dependencies)
3. Write integration tests (real database)
4. Write E2E tests (critical UI flows)
5. Implement feature to pass tests
6. Run pre-commit checks: npm run test:unit && npm run typecheck
7. Push to PR and wait for CI (all 9 jobs must pass)
8. Request code review (reviewer checks testing checklists)
9. Merge to main
```

### For Code Review

1. Check out PR branch
2. Run tests locally: `npm test`
3. Look for testing checklist items
4. Use CODE_REVIEW_GUIDE.md for detailed questions
5. Request changes if tests missing or insufficient
6. Approve when all tests pass and coverage meets targets

---

## FAQ

**Q: Which tests do I MUST write?**
A: Seed functions, critical services, critical UI. Use the checklists in TESTING-PREVENTION-STRATEGIES.md section 4.

**Q: How do I test idempotency?**
A: See section 5.1 of TESTING-PREVENTION-STRATEGIES.md. Use the pattern from `server/test/seeds/`.

**Q: Why test E2E when we have unit tests?**
A: Unit tests verify logic. E2E tests verify real user workflows. Both needed for critical features.

**Q: How much test coverage is enough?**
A: Target 80% for critical modules, 70% for others. Current: 42% (improving).

**Q: What if tests are too slow?**
A: Unit tests should be <1s each. Integration tests 5-10s. E2E 30-60s. Parallelize in CI.

**Q: How do I debug a failing seed test?**
A: See TESTING-IMPLEMENTATION-GUIDE.md troubleshooting section.

---

## Support

### For Questions About Strategies

- Review TESTING-PREVENTION-STRATEGIES.md sections 4-5
- Look at existing test examples in codebase
- Ask team lead or architect

### For Help Implementing

- Follow TESTING-IMPLEMENTATION-GUIDE.md step-by-step
- Check server/test/seeds/ for seed test examples
- Check e2e/tests/ for E2E test examples

### For Troubleshooting

- See TESTING-IMPLEMENTATION-GUIDE.md Part 5
- See TESTING-QUICK-REFERENCE.md Troubleshooting
- Check CI logs in GitHub Actions

---

**Created:** 2025-11-30
**Last Updated:** 2025-11-30
**Status:** Ready for team implementation
**Next Review:** Q1 2026

---

## Implementation Checklist

Use this to track adoption of prevention strategies:

### Prerequisites

- [ ] Team has reviewed TESTING-QUICK-REFERENCE.md
- [ ] Team has reviewed TESTING-PREVENTION-STRATEGIES.md
- [ ] Tech lead has approved implementation plan

### Phase 2 Implementation

- [ ] Set up pre-commit hooks (.husky scripts)
- [ ] Add seed-tests job to main-pipeline.yml
- [ ] Create .github/pull_request_template.md
- [ ] Document CODE_REVIEW_GUIDE.md
- [ ] Train team on new standards

### Phase 3 Team Adoption

- [ ] All team members configured pre-commit hooks
- [ ] 100% of PRs include test updates (for modified modules)
- [ ] All code reviews use new checklist
- [ ] CI pipeline seed-tests job running successfully

### Phase 4 Maintenance

- [ ] Coverage metric trending up (quarterly reviews)
- [ ] Pre-commit hooks catching issues (monthly audit)
- [ ] Team comfortable with testing patterns (feedback)
- [ ] Documentation updated with learnings (quarterly)
