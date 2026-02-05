---
title: 'Concierge to Tenant Agent Migration - Dual System Resolution'
category: agent-issues
severity: P0
date_resolved: 2026-02-04
symptoms:
  - "Agent repeatedly asks 'What do you do?' despite knowing tenant info"
  - 'Onboarding flow broken - agent lacks context'
  - 'Two parallel agent endpoints causing confusion'
  - 'Frontend using old endpoint without bootstrap context injection'
  - 'New tenant agent endpoints unused/unreachable'
root_cause: 'Dual agent system running in parallel - frontend used OLD endpoint which lacked bootstrap context injection at session creation'
components:
  - tenant-admin-tenant-agent.routes.ts
  - useConciergeChat.ts
  - useOnboardingState.ts
  - ContextBuilder
related_pitfalls: [85, 91, 99]
tags:
  - agent-migration
  - bootstrap-context
  - forbidden-slots
  - ADK
  - onboarding
  - dual-system
  - context-injection
---

# Concierge to Tenant Agent Migration

## Problem Summary

**Severity:** P0 - Onboarding completely broken

Two agent systems were running in parallel as "during migration" state that was never completed:

| System  | Path                            | Status                                                        |
| ------- | ------------------------------- | ------------------------------------------------------------- |
| **OLD** | `/v1/tenant-admin/agent`        | Frontend used this - hardcoded greeting, no context injection |
| **NEW** | `/v1/tenant-admin/agent/tenant` | Missing 5 endpoints, never wired to frontend                  |

### Symptoms

1. Agent repeatedly asked "What do you do?" even after tenant provided business info
2. Session state not persisting across page refreshes
3. Second message in session would fail with fake session IDs
4. Onboarding stuck in infinite discovery loop

### Root Cause

The OLD system had two critical issues:

1. **Fake Session IDs (Pitfall #85):** Generated local IDs like `tenant-${tenantId}-${Date.now()}` instead of calling ADK `createSession()`
2. **No Context Injection (Pitfall #91):** Session created without `forbiddenSlots` - agent didn't know what it already knew

## Solution

### Step 1: Add Missing Endpoints to Tenant Agent Routes

**File:** `server/src/routes/tenant-admin-tenant-agent.routes.ts`

Added 5 endpoints with proper ADK integration:

```typescript
// POST /session - Create ADK session with bootstrap context (P91 fix)
router.post('/session', async (_req: Request, res: Response) => {
  // Fetch bootstrap data with forbidden slots
  const bootstrap = await contextBuilder.getBootstrapData(tenantId);

  const sessionState = {
    tenantId,
    knownFacts: bootstrap?.discoveryFacts ?? {},
    forbiddenSlots: bootstrap?.forbiddenSlots ?? [], // ← P91 fix
    storefrontState: bootstrap?.storefrontState ?? null,
    onboardingComplete: bootstrap?.onboardingComplete ?? false,
  };

  // Create session on ADK with full context
  const response = await fetch(`${agentUrl}/apps/agent/users/${userId}/sessions`, {
    body: JSON.stringify({ state: sessionState }),
  });
});

// GET /session/:id - Fetch session history from ADK
// DELETE /session/:id - Close session
// GET /onboarding-state - Get onboarding phase
// POST /skip-onboarding - Skip onboarding flow
```

### Step 2: Fix POST /chat to Create Proper ADK Sessions

**Before (Broken - Pitfall #85):**

```typescript
sessionId = `tenant-${tenantId}-${Date.now()}`; // Fake ID - fails on 2nd message
```

**After (Fixed):**

```typescript
if (!sessionId) {
  const bootstrap = await contextBuilder.getBootstrapData(tenantId);
  const createResponse = await fetch(`${agentUrl}/apps/agent/users/${userId}/sessions`, {
    body: JSON.stringify({
      state: {
        knownFacts: bootstrap?.discoveryFacts ?? {},
        forbiddenSlots: bootstrap?.forbiddenSlots ?? [],
      },
    }),
  });
  sessionId = parseResult.data.id; // Real ADK session ID

  // Fallback with LOCAL: prefix for debugging
  if (!sessionId) {
    sessionId = `LOCAL:tenant-${tenantId}-${Date.now()}`;
  }
}
```

### Step 3: Update Route Factory with ContextBuilder

**File:** `server/src/routes/index.ts`

```typescript
const tenantAgentContextBuilder = createContextBuilderService(
  prismaClient,
  services.sectionContent // Required for storefrontState
);

const tenantAdminTenantAgentRoutes = createTenantAdminTenantAgentRoutes({
  prisma: prismaClient,
  contextBuilder: tenantAgentContextBuilder,
});
```

### Step 4: Switch Frontend Hooks to New Path

**File:** `apps/web/src/hooks/useConciergeChat.ts`

```typescript
const API_URL = '/api/tenant-admin/agent/tenant'; // Was: /api/tenant-admin/agent
```

**File:** `apps/web/src/hooks/useOnboardingState.ts`

```typescript
const API_PROXY = '/api/tenant-admin/agent/tenant'; // Was: /api/tenant-admin/agent
```

### Step 5: Create Next.js Proxy Route

**File:** `apps/web/src/app/api/tenant-admin/agent/tenant/[...path]/route.ts`

Created new proxy route that forwards to `/v1/tenant-admin/agent/tenant/*`

## Key Pattern: Enterprise Slot-Policy

**Wrong (fragile):**

```typescript
forbiddenQuestions: ['What do you do?', 'What type of business...'];
```

**Right (robust):**

```typescript
// Compute from actual stored data
const forbiddenSlots = Object.keys(discoveryFacts).filter(
  (key) => discoveryFacts[key] !== undefined
);
// Result: ['businessType', 'location', 'businessDescription']
```

Agent checks slot KEYS, not question phrases. New fact types automatically add to forbidden slots.

## Verification

- **TypeScript:** `npm run typecheck` passed
- **Tests:** 2109 tests passed
- **E2E:** Session persists across page refresh, agent doesn't re-ask known facts

## Prevention

### Detection Script

```bash
# Find stale "during migration" comments
grep -r "during migration\|MIGRATION\[" --include="*.ts" | \
  xargs -I{} git blame -L /migration/,+1 {} 2>/dev/null | \
  awk '{if ($4 < "2026-01-01") print}'
```

### Code Review Checklist

- [ ] No fake session IDs (`sessionId = \`...-${Date.now()}\``)
- [ ] Context injection at session creation (not just `{ tenantId }`)
- [ ] Migration comments have expiration dates
- [ ] E2E test sends 2+ messages (catches fake session bugs)

### Testing Pattern

**Critical:** Single-message tests PASS with fake sessions!

```typescript
// Message 1: Works with fake session
await sendMessage(sessionId, 'Hello');

// Message 2: FAILS with fake session ("session not found")
await sendMessage(sessionId, 'Follow-up'); // ← Must test this
```

## Related Documentation

- [SLOT_POLICY_CONTEXT_INJECTION_PATTERN.md](../patterns/SLOT_POLICY_CONTEXT_INJECTION_PATTERN.md) - Pitfall #91 fix
- [SERVICE_WIRING_AND_FAKE_SESSION_PREVENTION.md](../patterns/SERVICE_WIRING_AND_FAKE_SESSION_PREVENTION.md) - Pitfall #85
- [DUAL_SYSTEM_MIGRATION_DRIFT_PREVENTION.md](../patterns/DUAL_SYSTEM_MIGRATION_DRIFT_PREVENTION.md) - Pitfall #99
- [ADK_A2A_PREVENTION_INDEX.md](../patterns/ADK_A2A_PREVENTION_INDEX.md) - ADK protocol patterns

## Files Changed

| File                                                                | Change                                          |
| ------------------------------------------------------------------- | ----------------------------------------------- |
| `server/src/routes/tenant-admin-tenant-agent.routes.ts`             | Added 5 endpoints, fixed /chat session creation |
| `server/src/routes/index.ts`                                        | Pass contextBuilder to route factory            |
| `apps/web/src/hooks/useConciergeChat.ts`                            | Switch to `/tenant` path                        |
| `apps/web/src/hooks/useOnboardingState.ts`                          | Switch to `/tenant` path                        |
| `apps/web/src/app/api/tenant-admin/agent/tenant/[...path]/route.ts` | **New** proxy route                             |

## Rollback

If issues in production, revert frontend API_URL changes:

```typescript
const API_URL = '/api/tenant-admin/agent'; // Revert to old path
```
