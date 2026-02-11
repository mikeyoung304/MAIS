---
status: pending
priority: p2
issue_id: '7011'
tags: [code-review, testing, pr-45]
dependencies: ['7008', '7009']
---

# 7011: Unit Tests for DiscoveryService + ResearchService + Constants Sync Test

## Problem Statement

The slot machine has excellent test coverage (88 tests, 95.5% coverage), but the two extracted services (`DiscoveryService`, `ResearchService`) have zero unit tests. Business logic was moved from route handlers (tested via integration tests) to services (which should have unit tests with mocked dependencies).

Additionally, the manually-synced constants between the monorepo and Cloud Run agents have no automated sync verification.

## Tests Needed

### 1. DiscoveryService unit tests

With mocked `tenantRepo`, `contextBuilder`, `researchService`:

- `storeFact()` — stores fact, computes slot machine, triggers research at threshold, advances phase monotonically
- `getDiscoveryFacts()` — returns facts, filters `_`-prefixed metadata keys (after #7001 fix)
- `getBootstrap()` — returns cached data, cache miss fetches from DB, cache invalidation works
- `markSessionGreeted()` — sets cache key, deduplication works
- Phase advancement — never moves backward, monotonic

### 2. ResearchService unit tests

With mocked `tenantRepo`, `fetch`:

- `triggerAsync()` — fire-and-forget, doesn't throw on failure
- `storeResults()` — stores research data in branding
- `clearResearchTriggeredFlag()` — clears flag on failure
- Error handling — network errors, timeout, invalid response

### 3. Constants sync test

```typescript
import { MVP_SECTION_TYPES as canonical } from '../../shared/constants/...';
import { MVP_SECTION_TYPES as local } from '../agent-v2/deploy/tenant/src/constants/shared';
expect([...local].sort()).toEqual([...canonical].sort());
```

Same for `SEED_PACKAGE_NAMES` and `DISCOVERY_FACT_KEYS`.

## Technical Details

- **New files:** `server/src/services/discovery.service.test.ts`, `server/src/services/research.service.test.ts`, `server/src/lib/constants-sync.test.ts`
- **Framework:** Vitest (project standard)
- **Dependencies:** Runs after #7008 and #7009 so tests target final service shape

## Acceptance Criteria

- [ ] DiscoveryService unit tests cover storeFact, getDiscoveryFacts, getBootstrap, markSessionGreeted
- [ ] ResearchService unit tests cover triggerAsync, storeResults, clearResearchTriggeredFlag
- [ ] Constants sync test verifies MVP_SECTION_TYPES, SEED_PACKAGE_NAMES, DISCOVERY_FACT_KEYS match canonical
- [ ] All tests pass with `npm run --workspace=server test`
- [ ] No flaky tests (mocked dependencies, no real HTTP/DB calls)

## Work Log

| Date       | Action                     | Learnings                                                       |
| ---------- | -------------------------- | --------------------------------------------------------------- |
| 2026-02-11 | Created from PR #45 review | Found by Architecture Strategist + Agent-Native Reviewer agents |

## Resources

- PR #45: refactor/agent-debt-cleanup
- File: `server/src/services/discovery.service.ts`
- File: `server/src/services/research.service.ts`
- File: `server/src/agent-v2/deploy/tenant/src/constants/shared.ts`
- Existing test pattern: `server/src/lib/slot-machine.test.ts`
