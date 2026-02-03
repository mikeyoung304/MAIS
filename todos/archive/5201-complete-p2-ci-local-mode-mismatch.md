---
status: ready
priority: p2
issue_id: '5201'
tags: [code-review, testing, ci, configuration]
dependencies: []
---

# CI/Local ADAPTERS_PRESET Mismatch

## Problem Statement

CI runs E2E tests with `ADAPTERS_PRESET=mock` while local development uses different defaults. This can cause tests to pass locally but fail in CI (or vice versa).

## Findings

**CI config:** `.github/workflows/main-pipeline.yml` line 470

```yaml
env:
  ADAPTERS_PRESET: mock
```

**Playwright config:** `e2e/playwright.config.ts` lines 79-81

```typescript
command: process.env.CI
  ? 'npm run dev:web' // CI: mock mode
  : 'ADAPTERS_PRESET=real E2E_TEST=1 npm run dev:e2e'; // Local: real mode
```

**Issue:** Comments say local uses `real` but `dev:e2e` doesn't actually set `ADAPTERS_PRESET`.

## Proposed Solutions

### Option A: Align Environments (Recommended)

1. Document expected mode for each environment
2. Ensure `dev:e2e` explicitly sets `ADAPTERS_PRESET=mock`
3. Add validation at startup

**Effort:** Small (1 hour) | **Risk:** Low

## Acceptance Criteria

- [ ] CI and local use same adapter mode
- [ ] Mode explicitly documented
- [ ] Startup validates mode is set
