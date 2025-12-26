---
status: ready
priority: p2
issue_id: "424"
tags: [test, infrastructure, database, connection-pool]
dependencies: []
---

# Test Connection Pool Exhaustion in Large Add-On Test

## Problem Statement
The integration test `should handle large number of add-ons efficiently` exhausts the database connection pool when creating 50+ add-ons sequentially. Current pool limits (3 connections, 5s timeout) are insufficient for this test pattern.

## Findings
- Location: `server/test/integration/catalog.repository.integration.spec.ts:452`
- Error: `P2024: Timed out fetching a new connection from the connection pool`
- Pool config: `connection_limit: 3, timeout: 5`
- Test creates add-ons in rapid sequential `create()` calls

## Proposed Solutions

### Option 1: Use createMany() or Transaction Batching (Recommended)
- Batch add-on creation into single transaction
- Reduces connection churn significantly
- **Pros**: Fixes root cause, more realistic test pattern
- **Cons**: Minor test refactor
- **Effort**: Small
- **Risk**: Low

### Option 2: Increase Test Pool Size
- Add `?connection_limit=10` to test DATABASE_URL
- **Pros**: Quick fix
- **Cons**: Masks inefficient test pattern, may slow CI
- **Effort**: Small
- **Risk**: Low

### Option 3: Reduce Test Data Volume
- Change from 50 → 10-15 add-ons
- Still validates "large" behavior adequately
- **Pros**: Simplest fix
- **Cons**: Less thorough test
- **Effort**: Small
- **Risk**: Low

## Recommended Action
Use Option 1: Refactor test to batch add-on creation in a transaction. This is more realistic and doesn't mask connection pool issues that could appear in production.

## Technical Details
- **Affected Files**: `server/test/integration/catalog.repository.integration.spec.ts`
- **Related Components**: PrismaCatalogRepository, test infrastructure
- **Database Changes**: No

## Resources
- Prisma connection pool docs: https://pris.ly/d/connection-pool
- Related solution: `docs/solutions/TEST_CONNECTION_POOL_EXHAUSTION_SOLUTION.md`

## Acceptance Criteria
- [ ] Test passes without pool exhaustion
- [ ] Test still validates large add-on handling
- [ ] No increase to global pool limits needed

## Work Log

### 2025-12-26 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue identified from test failure analysis
- Root cause: sequential creates exhausting small test pool
- Status: ready

**Learnings:**
- Integration tests should batch DB operations when possible
- Test pool limits intentionally small to catch inefficient patterns

## Notes
Source: Triage session on 2025-12-26
Related test output: Background task b018b77
