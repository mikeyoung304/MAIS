---
status: deferred
priority: p3
issue_id: '573'
tags: [code-review, security, database, multi-tenant, rls]
dependencies: []
deferred_date: '2026-01-01'
deferred_reason: 'Defense-in-depth improvement, not blocking. Application layer enforces tenant isolation.'
---

# P1: Row-Level Security (RLS) Missing on Newer Tables

## Problem Statement

RLS policies were added in migration 06 for core tables, but **newer tables added subsequently do NOT have RLS enabled**. This creates a defense-in-depth gap - if application code has a bug that bypasses tenant filtering, these tables could leak data across tenants.

**Affected tables without RLS:**

- `Service` (migration 07)
- `AvailabilityRule` (migration 07)
- `TenantDomain`
- `AgentProposal`
- `AgentAuditLog`
- `AgentSession`
- `OnboardingEvent` (migration 20)
- `WebhookSubscription` (migration 11)
- `WebhookDelivery` (migration 11)

## Findings

**Location:** `/Users/mikeyoung/CODING/MAIS/server/prisma/migrations/06_add_rls_policies.sql`

**Evidence:**

- Migration 06 added RLS to: Package, AddOn, Booking, BlackoutDate, WebhookEvent, Customer, Venue, Segment, Payment, ConfigChangeLog
- All tables added after migration 06 are missing RLS

**Identified by:** Data Integrity Guardian agent

## Proposed Solutions

### Option A: Create New Migration with RLS for All Missing Tables (Recommended)

**Pros:** Complete coverage, defense in depth
**Cons:** Requires careful testing
**Effort:** Medium (1-2 days)
**Risk:** Low

### Option B: Add RLS Incrementally Per Table

**Pros:** Lower risk per deployment
**Cons:** Multiple deployments, inconsistent state during rollout
**Effort:** Small per table, Medium total
**Risk:** Low

## Recommended Action

**Choose Option A** - Create comprehensive RLS migration

## Technical Details

**New migration file:** `server/prisma/migrations/XX_add_rls_to_new_tables.sql`

```sql
-- Enable RLS on all tenant-scoped tables added after migration 06

-- Service table
ALTER TABLE "Service" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_tenant_isolation" ON "Service"
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::text);

-- AvailabilityRule table
ALTER TABLE "AvailabilityRule" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "availability_tenant_isolation" ON "AvailabilityRule"
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::text);

-- TenantDomain table
ALTER TABLE "TenantDomain" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "domain_tenant_isolation" ON "TenantDomain"
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::text);

-- AgentProposal table
ALTER TABLE "AgentProposal" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "proposal_tenant_isolation" ON "AgentProposal"
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::text);

-- AgentAuditLog table
ALTER TABLE "AgentAuditLog" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_tenant_isolation" ON "AgentAuditLog"
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::text);

-- AgentSession table
ALTER TABLE "AgentSession" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "session_tenant_isolation" ON "AgentSession"
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::text);

-- OnboardingEvent table
ALTER TABLE "OnboardingEvent" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "onboarding_tenant_isolation" ON "OnboardingEvent"
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::text);

-- WebhookSubscription table
ALTER TABLE "WebhookSubscription" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subscription_tenant_isolation" ON "WebhookSubscription"
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::text);

-- WebhookDelivery table
ALTER TABLE "WebhookDelivery" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "delivery_tenant_isolation" ON "WebhookDelivery"
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::text);
```

**Database changes:** Yes - adds RLS policies

## Acceptance Criteria

- [ ] RLS enabled on all 9 tables listed above
- [ ] RLS policies follow same pattern as migration 06
- [ ] All tests pass with RLS enabled
- [ ] No cross-tenant data leakage possible
- [ ] Migration is idempotent (can be re-run safely)

## Work Log

| Date       | Action  | Notes                                  |
| ---------- | ------- | -------------------------------------- |
| 2026-01-01 | Created | Found during comprehensive code review |

## Resources

- `server/prisma/migrations/06_add_rls_policies.sql` - Reference implementation
- `server/prisma/schema.prisma` - Table definitions
