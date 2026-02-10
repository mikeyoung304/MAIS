---
status: pending
priority: p2
issue_id: 5254
tags: [code-review, typescript, pr-44, error-handling]
dependencies: []
---

# Inconsistent Optional Service Patterns

## Problem Statement

Three different patterns for handling missing services exist across domain files: graceful degradation (`contextBuilder`), fail-fast 503 (`sectionContentService`), and silent skip (`schedulingAvailabilityService`). Inconsistent error handling confuses developers and creates unpredictable failure modes.

**Why this matters:** When a service is missing at startup, the behavior should be predictable. Core services should fail at startup (fail-fast), feature services should return 503 (loud failure), optional features should degrade gracefully (silent fallback).

**Impact:** P2 IMPORTANT - Inconsistent error handling, unclear service criticality.

## Findings

### Code Simplicity Review

**Pattern 1: Graceful Degradation**

```typescript
// internal-agent-discovery.routes.ts
const contextBuilder = services.contextBuilder;
if (!contextBuilder) {
  logger.warn('[Bootstrap] ContextBuilder not configured, returning minimal data');
  return res.json({ tenant: { id: tenantId } }); // Degraded response
}
```

**Pattern 2: Fail-Fast 503**

```typescript
// internal-agent-storefront.routes.ts
const sectionContentService = services.sectionContentService;
if (!sectionContentService) {
  return res.status(503).json({ error: 'Service not configured' });
}
```

**Pattern 3: Silent Skip**

```typescript
// internal-agent-session.routes.ts
const schedulingAvailabilityService = services.schedulingAvailabilityService;
if (!schedulingAvailabilityService) {
  // Silently returns 200 with empty data
  return res.json({ availability: [] });
}
```

### Architecture Review

**Service criticality tiers:**

1. **Core Services** (app won't function without):
   - Database, auth, config
   - Should fail at startup (crash app if missing)

2. **Feature Services** (functionality breaks without):
   - Section content, booking, payments
   - Should return 503 (loud failure, retry later)

3. **Optional Features** (app works without):
   - Analytics, recommendations, A/B testing
   - Should degrade gracefully (silent fallback)

**Current inconsistency:**

- `contextBuilder` degrades gracefully—but bootstrap context is CORE to agents
- `sectionContentService` returns 503—correct for feature service
- `schedulingAvailabilityService` silently skips—correct for optional feature

## Proposed Solutions

### Solution 1: Standardize by Service Tier (RECOMMENDED)

**Pros:**

- Predictable failure modes
- Self-documenting service criticality
- Easier to debug missing services
  **Cons:**
- Requires classifying all services
  **Effort:** Medium (1 hour)
  **Risk:** Low

**Implementation:**

```typescript
// Define service tiers in di.ts or services interface
export interface Services {
  // Core Services (fail at startup)
  prisma: PrismaClient; // REQUIRED
  config: Config; // REQUIRED

  // Feature Services (503 on missing)
  sectionContentService?: SectionContentService;
  bookingService?: BookingService;
  paymentService?: PaymentService;

  // Optional Services (degrade gracefully)
  analyticsService?: AnalyticsService;
  recommendationService?: RecommendationService;
}

// Route handlers use consistent patterns:
// Feature service:
if (!services.sectionContentService) {
  return res.status(503).json({ error: 'Service temporarily unavailable' });
}

// Optional service:
const recommendations = services.recommendationService
  ? await services.recommendationService.getRecommendations(tenantId)
  : []; // Graceful fallback
```

### Solution 2: Fail at Startup for All Services

**Pros:**

- Simplest pattern
- All services required
  **Cons:**
- Can't deploy with partial features
- Over-constrains architecture
  **Effort:** Small (30 minutes)
  **Risk:** Medium - reduces flexibility

**Implementation:**

```typescript
// di.ts - validate all services at startup
export function validateServices(services: Services) {
  const required = [
    'contextBuilder',
    'sectionContentService',
    'schedulingAvailabilityService',
    // ... all services
  ];

  for (const serviceName of required) {
    if (!services[serviceName]) {
      throw new Error(`Required service not configured: ${serviceName}`);
    }
  }
}

// app.ts
const services = buildServices(config);
validateServices(services); // Crash if any missing
```

### Solution 3: Document Current Patterns (Current State)

**Pros:**

- No code changes
- Makes inconsistency visible
  **Cons:**
- Doesn't fix root cause
- Still unpredictable
  **Effort:** Trivial (15 minutes)
  **Risk:** Medium - continues confusion

**Implementation:**

```typescript
// Add comments explaining each pattern:
// PATTERN: Graceful degradation (optional feature)
if (!contextBuilder) {
  return res.json({ minimal: true });
}

// PATTERN: Fail-fast 503 (core feature)
if (!sectionContentService) {
  return res.status(503).json({ error: 'Service not configured' });
}
```

## Recommended Action

**Use Solution 1** - Standardize by service tier. This makes criticality explicit and error handling predictable.

**Classification guidance:**

- **Core:** Database, auth, config → fail at startup
- **Feature:** Section content, booking, payments → 503
- **Optional:** Analytics, recommendations → degrade gracefully

## Technical Details

**Affected Files:**

- `server/src/di.ts` (add service tier comments/types)
- `server/src/routes/internal-agent-discovery.routes.ts` (contextBuilder → 503)
- `server/src/routes/internal-agent-storefront.routes.ts` (already correct)
- `server/src/routes/internal-agent-session.routes.ts` (already correct if optional)

**Line count impact:** +30 lines (service tier documentation, consistent checks)

**Related Patterns:**

- Fail-Fast Principle
- Graceful Degradation
- Circuit Breaker Pattern (for 503 retries)

## Acceptance Criteria

- [ ] All services classified as Core, Feature, or Optional
- [ ] Core services validated at startup (crash if missing)
- [ ] Feature services return 503 if missing
- [ ] Optional services degrade gracefully if missing
- [ ] Documentation explains each tier's failure mode
- [ ] E2E test: start app with missing feature service, verify 503
- [ ] E2E test: start app with missing optional service, verify 200 with degraded response
- [ ] `npm run --workspace=server typecheck` passes

## Work Log

**2026-02-09 - Initial Assessment (Code Review PR #44)**

- Code Simplicity Review identified 3 inconsistent patterns
- Architecture Review proposed service tier classification
- Confirmed contextBuilder is CORE (agents can't work without bootstrap)
- Recommended standardization by tier for predictability

## Resources

- **PR:** https://github.com/mikeyoung304/MAIS/pull/44
- **Related Files:**
  - `internal-agent-discovery.routes.ts` (graceful degradation)
  - `internal-agent-storefront.routes.ts` (fail-fast 503)
  - `internal-agent-session.routes.ts` (silent skip)
- **Fail-Fast:** https://en.wikipedia.org/wiki/Fail-fast
- **Graceful Degradation:** https://en.wikipedia.org/wiki/Graceful_degradation
