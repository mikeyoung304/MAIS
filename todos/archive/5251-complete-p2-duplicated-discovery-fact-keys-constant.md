---
status: pending
priority: p2
issue_id: 5251
tags: [code-review, duplication, pr-44]
dependencies: []
---

# Duplicated DISCOVERY_FACT_KEYS Constant

## Problem Statement

`DISCOVERY_FACT_KEYS` is defined in both `discovery.routes.ts:40` and `tenant-agent tool:26`. When new fact types are added (e.g., "target_audience"), both locations must be updated or schema drift occurs.

**Why this matters:** The backend validates fact keys, but the agent also uses the list to guide conversation. If they drift, agents will store facts that backend rejects (or vice versa), causing silent failures.

**Impact:** P2 IMPORTANT - Schema drift risk, maintenance burden.

## Findings

### Code Simplicity Review

**Duplication locations:**

1. `server/src/routes/internal-agent-discovery.routes.ts:40`

   ```typescript
   const DISCOVERY_FACT_KEYS = [
     'business_name',
     'business_type',
     'target_market',
     'services',
     'tone',
     'unique_value',
   ] as const;
   ```

2. `server/src/agent-v2/deploy/tenant/src/tools/store-discovery-fact.ts:26`
   ```typescript
   const DISCOVERY_FACT_KEYS = [
     'business_name',
     'business_type',
     'target_market',
     'services',
     'tone',
     'unique_value',
   ] as const;
   ```

**Schema drift scenario:**

1. Developer adds `'pricing_model'` to backend routes
2. Forgets to update agent tool
3. Agent stores `pricing_model` facts
4. Backend rejects with 400 error
5. Agent sees failure but doesn't understand why

### TypeScript Review

**Both locations use identical pattern:**

```typescript
const DISCOVERY_FACT_KEYS = [...] as const;
type DiscoveryFactKey = typeof DISCOVERY_FACT_KEYS[number];
```

This suggests the constant should be in a shared module imported by both.

## Proposed Solutions

### Solution 1: Extract to Shared Constants File (RECOMMENDED)

**Pros:**

- Single source of truth
- Type safety across backend and agent
- Eliminates schema drift risk
  **Cons:** Requires shared package or import path coordination
  **Effort:** Small (20 minutes)
  **Risk:** Very Low

**Implementation:**

```typescript
// server/src/shared/constants/discovery-facts.ts
export const DISCOVERY_FACT_KEYS = [
  'business_name',
  'business_type',
  'target_market',
  'services',
  'tone',
  'unique_value',
] as const;

export type DiscoveryFactKey = (typeof DISCOVERY_FACT_KEYS)[number];

// server/src/routes/internal-agent-discovery.routes.ts
import { DISCOVERY_FACT_KEYS, DiscoveryFactKey } from '../../shared/constants/discovery-facts';

// server/src/agent-v2/deploy/tenant/src/tools/store-discovery-fact.ts
import {
  DISCOVERY_FACT_KEYS,
  DiscoveryFactKey,
} from '../../../../../shared/constants/discovery-facts';
```

### Solution 2: Backend as Source of Truth (Agent Fetches Schema)

**Pros:**

- No duplication
- Schema enforced by backend API
  **Cons:**
- Agent startup requires API call to fetch schema
- Offline agent development becomes harder
  **Effort:** Medium (1 hour)
  **Risk:** Low

**Implementation:**

```typescript
// Add GET /internal/discovery-fact-schema endpoint
router.get('/discovery-fact-schema', (req, res) => {
  res.json({ keys: DISCOVERY_FACT_KEYS });
});

// Agent tool fetches on first use:
let schemaCache: string[] | null = null;
async function getFactKeys() {
  if (!schemaCache) {
    const response = await fetch(`${API_BASE}/internal/discovery-fact-schema`);
    schemaCache = await response.json().then((data) => data.keys);
  }
  return schemaCache;
}
```

### Solution 3: Keep Duplicated (Current State)

**Pros:**

- No changes needed
- Agent and backend stay decoupled
  **Cons:**
- Must update 2 files when adding fact types
- Schema drift risk on partial updates
  **Effort:** Zero
  **Risk:** High - silent failures when schemas diverge

## Recommended Action

**Use Solution 1** - Extract to shared constants file. The effort is minimal and eliminates a real schema drift risk. Use relative imports to avoid complex build configuration.

## Technical Details

**Affected Files:**

- Create: `server/src/shared/constants/discovery-facts.ts` (canonical definition)
- Update: `server/src/routes/internal-agent-discovery.routes.ts:40` (import instead of define)
- Update: `server/src/agent-v2/deploy/tenant/src/tools/store-discovery-fact.ts:26` (import instead of define)

**Line count impact:** -12 lines (remove 2 duplicated arrays, add 1 canonical definition)

**Import path:** Agent is 5 directories deep, so relative import is `../../../../../shared/constants/discovery-facts`

**Related Pattern:** DRY (Don't Repeat Yourself), Single Source of Truth

## Acceptance Criteria

- [ ] `discovery-facts.ts` created in `server/src/shared/constants/`
- [ ] `DISCOVERY_FACT_KEYS` and `DiscoveryFactKey` exported
- [ ] Backend routes import from shared constants
- [ ] Agent tool imports from shared constants
- [ ] Add 1 new fact key (e.g., `'pricing_model'`) to verify single-update workflow
- [ ] Backend validation accepts new fact key
- [ ] Agent tool uses new fact key
- [ ] `npm run --workspace=server typecheck` passes
- [ ] Agent build succeeds

## Work Log

**2026-02-09 - Initial Assessment (Code Review PR #44)**

- Code Simplicity Review identified 2 occurrences
- TypeScript Review confirmed identical patterns in both
- Assessed schema drift risk: agent stores fact, backend rejects
- Verified relative import path for agent (5 directories deep)

## Resources

- **PR:** https://github.com/mikeyoung304/MAIS/pull/44
- **Related Files:**
  - `internal-agent-discovery.routes.ts:40` (backend duplication)
  - `agent-v2/deploy/tenant/src/tools/store-discovery-fact.ts:26` (agent duplication)
- **DRY Principle:** https://en.wikipedia.org/wiki/Don%27t_repeat_yourself
