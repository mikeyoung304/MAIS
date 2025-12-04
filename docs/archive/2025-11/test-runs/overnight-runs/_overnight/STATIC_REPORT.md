# Static Analysis & Security Scan Report

**Date:** 2025-10-16
**Branch:** chore/p0-foundations-20251015

## Knip Analysis

### Unused Files (5)

- `src/domains/availability/errors.ts`
- `src/domains/booking/webhook-handler.service.ts` _(P0/P1 new file)_
- `src/domains/catalog/catalog-optimized.service.ts` _(P0/P1 new file)_
- `src/domains/catalog/errors.ts`
- `src/domains/identity/errors.ts`

### Unused Dependencies (3)

- `@elope/contracts` (package.json:25:6)
- `@elope/shared` (package.json:26:6)
- `body-parser` (package.json:30:6)

### Unused DevDependencies (3)

- `@types/bcryptjs` (package.json:43:6)
- `pino-pretty` (package.json:51:6)
- `ts-node` (package.json:53:6)

### Unused Exports (13)

Multiple mock repository classes, utility functions, and test helpers flagged as unused.

### Notable Findings

**P0/P1 Files Not Yet Integrated:**

- `webhook-handler.service.ts`: Atomic webhook handler (ready for integration)
- `catalog-optimized.service.ts`: N+1 fix implementation (ready for integration)

**Recommendation:**

- Wire P0/P1 services into controllers to eliminate "unused" flags
- Review and remove truly unused dependencies
- Consider exporting Mock\* classes from adapter modules for test use

## ESLint

ESLint scan encountered parser configuration issues. Recommend fixing eslintrc to include proper parserOptions.project configuration for TypeScript rules.

## Summary

Static analysis complete. P0/P1 implementations are present but flagged as unused (expected - not yet wired into request flow). Follow-up integration work recommended.
