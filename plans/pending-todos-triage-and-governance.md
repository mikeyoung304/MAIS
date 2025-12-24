# Pending TODOs Triage and Governance Plan

## Overview

This plan addresses the 13 pending TODO items in the MAIS codebase, establishing a governance framework for backlog management and providing actionable decisions for each item.

## Problem Statement

The MAIS project has 343 TODO files with 13 in `status: pending`. These span technical debt, Phase 2 features, and Phase 3 features. Without a clear decision framework:
- Items accumulate without resolution
- Duplicates exist (TODO-155 and TODO-287)
- No formal review process exists
- "Deferred" items have no revisit triggers

## Current State Analysis

### TODO Status Distribution
| Status | Count | Percentage |
|--------|-------|------------|
| complete | 250 | 73% |
| resolved | 27 | 8% |
| pending | 13 | 4% |
| deferred | 4 | 1% |
| wontfix | 3 | 1% |
| superseded | 3 | 1% |
| other | 43 | 12% |

### The 13 Pending Items Categorized

#### Category A: Close Immediately (3 items)
| ID | Description | Action | Rationale |
|----|-------------|--------|-----------|
| 012 | Archive file naming | WONTFIX | Zero business value, purely organizational |
| 220 | Storybook stories | WONTFIX | No infrastructure, not blocking anything |
| 287 | BookingService split | WONTFIX | Duplicate of TODO-155 |

#### Category B: Quick Wins (2 items)
| ID | Description | Action | Effort |
|----|-------------|--------|--------|
| 197 | Audit logging for add-ons | DO IF COMPLIANCE | 30 minutes |
| 279 | Async webhook (Option B) | IMPLEMENT NOW | 1-2 hours |

#### Category C: Business Decision Required (4 items)
| ID | Description | Decision Needed | Default |
|----|-------------|-----------------|---------|
| 226 | Analytics tracking | Which provider? | DEFER |
| 281 | Recurring appointments | Launch requirement? | DEFER |
| 282 | Group classes | Target market? | DEFER |
| 285 | SMS reminders | Cost vs value? | DEFER |

#### Category D: Keep Deferred (4 items)
| ID | Description | Trigger to Activate |
|----|-------------|---------------------|
| 155 | BookingService refactor | Service exceeds 2000 LOC or recurring feature added |
| 280 | Slot optimization | P99 latency > 100ms in production |
| 283 | Prepaid packages | 3+ customer requests |
| 286 | Intake forms | 3+ customer requests |

---

## Proposed Solution

### Phase 1: Immediate Actions (Before Production Deploy)

#### 1.1 Close Duplicate and Irrelevant TODOs
```bash
# TODO-287: Close as duplicate
# TODO-012: Close as WONTFIX (zero business value)
# TODO-220: Close as WONTFIX (no infrastructure)
```

**Files to Update:**
- `todos/287-ready-p3-booking-service-too-large.md` - Mark as wontfix, duplicate of 155
- `todos/012-deferred-p3-fix-archive-naming.md` - Mark as wontfix
- `todos/220-deferred-p3-landing-page-storybook.md` - Mark as wontfix

#### 1.2 Implement Quick Win: Async Webhook (Option B)

**Why Now:**
- Stripe has 5-second webhook timeout
- Under load (100+ webhooks/sec), 10-15% timeout rate
- Production deployment is Day 5 goal

**Implementation:**
```typescript
// server/src/routes/webhooks.routes.ts
async handleStripeWebhook(...): Promise<void> {
  const event = await this.paymentProvider.verifyWebhook(rawBody, signature);
  await this.webhookRepo.recordWebhook({...});

  // Fire-and-forget processing (don't await)
  this.processWebhookAsync(event).catch(err =>
    logger.error({ err, eventId: event.id }, 'Webhook processing failed')
  );

  // Return immediately to Stripe
}
```

**Acceptance Criteria:**
- [ ] Webhook endpoint responds within 50ms
- [ ] Processing happens asynchronously
- [ ] Failed processing logged with event ID
- [ ] Existing tests pass

### Phase 2: Governance Framework

#### 2.1 Quarterly Backlog Review Process

**Schedule:** First Monday of each quarter (Jan 1, Apr 1, Jul 1, Oct 1)

**Checklist:**
1. Pull all `status: pending` TODOs older than 90 days
2. For each item, evaluate:
   - Has anyone requested this feature?
   - Is the problem still relevant?
   - Has the code changed to make this obsolete?
3. Update status to `wontfix` if no longer needed
4. Add work log entry with decision rationale
5. Update metrics dashboard

#### 2.2 Deferral Documentation Template

Add to each deferred TODO:

```markdown
## Deferral Documentation

### Decision Date
2025-12-23

### Deferral Reason
- [ ] YAGNI - No customer request
- [ ] DEPENDENCY - Blocked by TODO-XXX
- [ ] CAPACITY - Team focused on higher priority
- [ ] INFRASTRUCTURE - Requires external setup

### Revisit Triggers
- [ ] Customer request count > 3
- [ ] Blocking feature dependency activated
- [ ] Quarterly review determines priority increase

### Next Review Date
2026-03-23 (90 days from decision)

### Request Tracking
- Channel: [Zendesk tag / Email alias / Intercom tag]
- Current request count: 0
```

#### 2.3 Status Transition Rules

```
pending → in_progress → complete
pending → wontfix (requires resolution reason)
pending → pending (re-prioritized, add work log)

WONTFIX requires:
- resolved_at: Date
- resolved_by: Agent/person
- resolution: yagni | duplicate | obsolete | already-addressed
- duplicate_of: (if resolution = duplicate)
```

### Phase 3: Feature Prioritization Framework

#### 3.1 Decision Matrix for Pending Features

| Question | If YES | If NO |
|----------|--------|-------|
| Is it blocking launch? | P1 - Do now | Continue evaluation |
| Has a customer requested it? | Schedule for next sprint | Defer with trigger |
| Will it cost 3x more later? | Do now | Defer |
| Does it require infrastructure we don't have? | Defer until infra ready | Continue evaluation |
| Is there a simpler workaround? | Document workaround, defer | Consider implementation |

#### 3.2 Request Tracking Implementation

**For features deferred due to "no customer request":**

1. Create Zendesk/Intercom tag for each feature:
   - `feature:recurring-appointments`
   - `feature:group-classes`
   - `feature:sms-reminders`
   - `feature:intake-forms`
   - `feature:prepaid-packages`

2. When customer mentions feature:
   - Apply tag to conversation
   - Add work log entry to corresponding TODO
   - Increment request count

3. Threshold for activation: **3 unique tenant requests**

---

## Technical Approach

### Files to Modify

#### Immediate Closures
| File | Change |
|------|--------|
| `todos/287-ready-p3-booking-service-too-large.md` | Set `status: wontfix`, add `duplicate_of: '155'` |
| `todos/012-deferred-p3-fix-archive-naming.md` | Set `status: wontfix`, add resolution |
| `todos/220-deferred-p3-landing-page-storybook.md` | Set `status: wontfix`, add resolution |

#### Async Webhook Implementation
| File | Change |
|------|--------|
| `server/src/routes/webhooks.routes.ts` | Fire-and-forget pattern for processing |
| `todos/279-ready-p2-async-webhook-processing.md` | Mark complete after implementation |

#### Governance Documents
| File | Change |
|------|--------|
| NEW: `docs/guides/TODO-BACKLOG-GOVERNANCE.md` | Quarterly review process, status rules |
| `docs/solutions/TODO-STALENESS-PREVENTION.md` | Add deferral template |

### Deferred Items - Add Triggers

| TODO | File | Revisit Trigger |
|------|------|-----------------|
| 155 | `todos/155-deferred-p2-booking-service-monolith.md` | Service > 2000 LOC |
| 226 | `todos/226-deferred-p3-analytics-section-tracking.md` | Analytics provider selected |
| 280 | `todos/280-ready-p2-slot-generation-algorithm-optimization.md` | P99 > 100ms |
| 281 | `todos/281-ready-p2-recurring-appointments-missing.md` | 3 customer requests |
| 282 | `todos/282-ready-p2-group-classes-missing.md` | 3 customer requests |
| 283 | `todos/283-ready-p2-packages-prepaid-bundles-missing.md` | 3 customer requests |
| 285 | `todos/285-ready-p3-sms-reminders-missing.md` | 3 customer requests |
| 286 | `todos/286-ready-p3-intake-forms-missing.md` | 3 customer requests |

---

## Acceptance Criteria

### Functional Requirements
- [ ] 3 TODOs closed as WONTFIX (012, 220, 287)
- [ ] TODO-279 async webhook implemented
- [ ] All deferred TODOs have revisit triggers documented
- [ ] Quarterly review process documented

### Non-Functional Requirements
- [ ] Webhook endpoint responds < 50ms
- [ ] No test failures after changes
- [ ] TypeScript compilation passes

### Quality Gates
- [ ] All TODO status changes have work log entries
- [ ] Governance document reviewed by team
- [ ] Metrics baseline established

---

## Success Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Pending TODO count | 13 | < 10 | After triage |
| TODOs with revisit triggers | 0 | 100% | After update |
| Webhook P99 latency | Unknown | < 50ms | After implementation |
| Quarterly review cadence | None | 4/year | After process setup |

---

## Dependencies & Risks

### Dependencies
- Stripe webhook testing environment for async implementation
- Team buy-in on governance process

### Risks
| Risk | Impact | Mitigation |
|------|--------|------------|
| Async webhook loses events | High | Log all events before async, add retry logic in Phase 2 |
| Governance process not followed | Medium | Add calendar reminders, automate metrics |
| Feature request tracking missed | Low | Regular review of support tickets |

---

## Implementation Phases

### Phase 1: Immediate Triage (Day 1)
- [ ] Close 3 WONTFIX TODOs
- [ ] Implement async webhook (Option B)
- [ ] Add monitoring for webhook latency

**Estimated Effort:** 2-3 hours

### Phase 2: Add Revisit Triggers (Day 2)
- [ ] Update 8 deferred TODOs with triggers
- [ ] Create deferral documentation template
- [ ] Document status transition rules

**Estimated Effort:** 1-2 hours

### Phase 3: Governance Setup (Week 1)
- [ ] Create quarterly review process document
- [ ] Set up calendar reminders for Q1 2026 review
- [ ] Establish feature request tracking tags

**Estimated Effort:** 2-3 hours

---

## References

### Internal References
- Prevention strategies: `docs/solutions/PREVENTION-STRATEGIES-INDEX.md`
- TODO conventions: `docs/solutions/TODO-STALENESS-PREVENTION.md`
- ADR index: `DECISIONS.md`

### External References
- [YAGNI Principle](https://martinfowler.com/bliki/Yagni.html)
- [Impact Effort Matrix](https://productschool.com/blog/product-fundamentals/impact-effort-matrix)
- [Stripe Webhook Best Practices](https://stripe.com/docs/webhooks/best-practices)

### Related TODOs
- TODO-155: BookingService monolith (keep)
- TODO-287: BookingService split (close as duplicate)
- TODO-279: Async webhooks (implement)
