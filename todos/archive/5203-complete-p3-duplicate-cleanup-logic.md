---
status: complete
priority: p3
issue_id: '5203'
tags: [code-review, testing, duplication]
dependencies: []
completed_at: 2026-02-02
resolution: wont-fix-by-design
---

# Duplicate Tenant Cleanup Logic

## Problem Statement

Test tenant cleanup is duplicated between Vitest and Playwright with slightly different patterns.

## Analysis

### Vitest (`server/test/helpers/vitest-global-setup.ts`)

- **Timing**: Runs at SETUP (before tests)
- **Patterns**: Slug-based integration test patterns
  - `hash-test-business-*`, `test-business-*`, `first-business-*`
  - `no-match-test-*`, `*-tenant-a`, `*-tenant-b`
  - `test-tenant-*`, `auth-prevention-*`
- **Extra safety**: Safelist of never-delete slugs
- **FK handling**: Explicit BookingAddOn deletion before Tenant

### Playwright (`e2e/global-teardown.ts`)

- **Timing**: Runs at TEARDOWN (after tests)
- **Patterns**: E2E test patterns
  - Email: `*@example.com`, `*@test.com`
  - Slug: `e2e-*`, `test-*`, `*-test-*`
  - Name: `E2E Test*`, `Test *`
- **FK handling**: Relies on ON DELETE CASCADE

## Resolution: Won't Fix (By Design)

The different patterns are **intentional**, not accidental duplication:

1. **Different test creation patterns**
   - Integration tests create `test-business-*` style slugs
   - E2E tests create `e2e-*` style slugs via auth fixture
   - Each cleanup matches its respective test creation pattern

2. **Different timing requirements**
   - Vitest: Setup (clean before tests to ensure isolation)
   - Playwright: Teardown (clean after tests to reduce accumulation)

3. **Different module systems**
   - Vitest: Native ESM with static imports
   - Playwright: Dynamic import for ESM/CJS compatibility

4. **Risk vs. Benefit**
   - Unifying would require complex conditional logic
   - Both systems work reliably in isolation
   - Changes risk breaking both test suites

## Recommendation

Keep the patterns separate. Add comments in each file documenting the intentional separation:

```typescript
// NOTE: Cleanup patterns intentionally differ from e2e/global-teardown.ts
// Vitest cleans integration test patterns, Playwright cleans E2E patterns
```

This is NOT technical debt - it's appropriate separation of concerns.
