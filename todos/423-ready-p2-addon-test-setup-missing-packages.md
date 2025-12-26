---
status: done
priority: p2
issue_id: "423"
tags: [test, bug, catalog, addon]
dependencies: []
---

# AddOn Test Setup Missing Package Associations

## Problem Statement
The catalog-segment integration tests create "global" add-ons without linking them to packages, causing `toDomainAddOn()` to throw. The validation is correct - every add-on MUST have at least one package association. The tests are wrong.

## Findings
- Location: `server/test/integration/catalog-segment.integration.spec.ts`
- 3 tests failing with: `AddOn {id} has no associated package`
- `toDomainAddOn()` at `catalog.repository.ts:694` correctly enforces package association
- Tests create add-ons but skip the `AddOnPackage` join table entry

## Affected Tests
1. `should return both segment-specific and global add-ons`
2. `should not include inactive add-ons`
3. `should cache getAddOnsForSegment results`

## Proposed Solutions

### Option 1: Fix Test Setup (Recommended)
- Update test helpers to always associate add-ons with at least one package
- For "global" add-ons, link to all packages in the test tenant
- **Pros**: No production code changes, validation stays intact
- **Cons**: None
- **Effort**: Small
- **Risk**: Low

## Recommended Action
Fix the test setup in `catalog-segment.integration.spec.ts` to properly create `AddOnPackage` entries when creating test add-ons. "Global" means "linked to all packages", not "linked to no packages".

## Technical Details
- **Affected Files**: `server/test/integration/catalog-segment.integration.spec.ts`
- **Related Components**: CatalogRepository, AddOn domain entity
- **Database Changes**: No

## Acceptance Criteria
- [x] All 3 catalog-segment tests pass
- [x] Test add-ons properly linked via PackageAddOn join table
- [x] No changes to production validation logic

## Work Log

### 2025-12-26 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue identified from test failure analysis
- Root cause: test setup bug, not domain logic issue
- Status: ready

**Learnings:**
- "Global" add-ons = available with all packages, not packageless
- Current validation in `toDomainAddOn()` is correct and should stay

## Notes
Source: Triage session on 2025-12-26
Related test output: Background task b018b77

### 2025-12-26 - Completed
**By:** Claude Code
**Actions:**
- Fixed all 3 failing tests by adding package and PackageAddOn entries in test setup
- Test 1 (`should return both segment-specific and global add-ons`): Added wellness package, linked yoga and meals add-ons via PackageAddOn, added wedding package with photography add-on
- Test 2 (`should not include inactive add-ons`): Added wellness package, linked both active and inactive add-ons via PackageAddOn
- Test 3 (`should cache getAddOnsForSegment results`): Added wellness package, linked test add-on via PackageAddOn
- All 11 catalog-segment tests now pass

**Key insight:**
- "Global" add-ons (segmentId = null) still require at least one package association
- The `toDomainAddOn()` validation is correct - domain model requires packageId
- Tests were incorrectly assuming "global" meant "no package links"
