---
title: Session Bootstrap - Executive Summary
category: quick-reference
created: 2026-01-20
related:
  - SESSION_BOOTSTRAP_ROLE_MANAGEMENT_SPECIFICATION_ANALYSIS.md
---

# Session Bootstrap and Role Management - Executive Summary

## Problem Summary

Specialists don't know tenant context (preferences, capabilities, industry) and sessions can't be resumed with memory. This causes:

- Generic responses (not personalized to business)
- Lost context on session resume
- Manual data fetching per operation

## Solution Overview

Three-part protocol:

1. **Bootstrap:** Fetch tenant context at session start
2. **State Passing:** Include context in A2A state to specialists
3. **Memory:** Resume sessions with previous conversation context

---

## Critical Findings

### Edge Cases (23 identified)

- Bootstrap timeout (backend slow)
- Tenant not found
- Partial context response
- Session collision
- State format divergence

### Security Risks (8 identified)

- **HIGH:** Cross-tenant context leakage (Session A sees Session B's data)
- **HIGH:** State injection attacks (LLM modifies capabilities)
- **MEDIUM:** Secret exposure in logs (tenantId visible)

### Performance Impact

- **+3s startup latency** (bootstrap call)
- **Solution:** Cache for 30min, parallel bootstrap + delegation

### Missing Requirements (8 identified)

- Should bootstrap cache? (Recommended: Yes, 30min)
- Where to store role definitions? (Recommended: DB table)
- Fallback when bootstrap fails? (Recommended: Use defaults)
- Session timeout semantics? (Product decision needed)

---

## Key Design Decisions

| Decision            | Choice                              | Rationale                             |
| ------------------- | ----------------------------------- | ------------------------------------- |
| Bootstrap frequency | Cache 30min                         | Balance freshness vs performance      |
| Session cache key   | `${agentUrl}:${tenantId}:${userId}` | Prevent collision across users/agents |
| State format        | Versioned schema per agent          | Handle forward compatibility          |
| Failure mode        | Continue with defaults              | Better UX than blocking               |
| Memory storage      | ADK + optional summaries            | Don't require external service        |

---

## Implementation Phases

### Phase 1 (Week 1): Bootstrap Infrastructure

- Add tenantId to A2A state
- Call `/business-info` at session start
- Cache for 30 minutes
- Handle timeout gracefully

### Phase 2 (Week 2): Role Support + Memory

- Add `role` field to context
- Implement role-based access control
- Session resumption with memory summaries

### Phase 3 (Week 3): Dual-Role Support

- Extend for customer/tenant contexts
- Project Hub integration ready

---

## Security Checklist

Must-have:

- [ ] Session cache key includes tenantId
- [ ] All queries use context-provided tenantId (never cached)
- [ ] State initialized only from backend bootstrap
- [ ] Session IDs validated for UUID format
- [ ] Cross-tenant memory leak tests pass
- [ ] PII excluded from conversation summaries

---

## Performance Targets

| Metric            | Target | Current | Gap             |
| ----------------- | ------ | ------- | --------------- |
| Bootstrap latency | <3s    | N/A     | +3s startup     |
| Cache hit rate    | >90%   | N/A     | Need monitoring |
| State size        | <32KB  | N/A     | Add limits      |
| Session creation  | <2s    | 2-15s   | Acceptable      |

---

## Test Coverage Required

| Category               | Critical       | Recommended        |
| ---------------------- | -------------- | ------------------ |
| Bootstrap timeout      | 3s test        | ≤3s under load     |
| Cross-tenant isolation | Fail if mixed  | Fuzz testing       |
| Role-based access      | Fail if bypass | 100% tool coverage |
| Memory resumption      | Works          | Context preserved  |

---

## High-Risk Issues

1. **Cross-Tenant Context Leakage** (CRITICAL)
   - Same specialist URL + cache collision = wrong tenant's data accessed
   - **Fix:** Cache key must include tenantId
   - **Test:** Verify separate sessions per tenant

2. **Bootstrap Stale Data** (MEDIUM)
   - Tenant changes subscription tier mid-session
   - LLM thinks user is pro when actually free
   - **Fix:** Cache TTL of 30min is acceptable
   - **Monitor:** Log cache hits vs fresh fetches

3. **State Format Version Mismatch** (MEDIUM)
   - Concierge adds new state field, old specialist agent doesn't recognize it
   - **Fix:** Use `.passthrough()` in Zod, ignore unknown fields
   - **Test:** Verify old agents handle new state gracefully

---

## Unknowns Requiring Product Decision

1. **Session Timeout:** Discard or resume on timeout?
2. **Bootstrap Frequency:** Every session or cached?
3. **Role Definitions:** Hardcoded or centralized?
4. **Fallback Behavior:** Block or continue with defaults?

---

## Code Changes Summary

**Minimal changes required:**

```typescript
// Concierge agent - add bootstrap call
async function beforeStart(context: ToolContext) {
  const tenantId = getTenantId(context);
  const bootstrap = await bootstrapTenantContext(tenantId);
  context.state.set('tenantId', bootstrap.tenantId);
  context.state.set('industry', bootstrap.industry);
  context.state.set('subscriptionTier', bootstrap.subscriptionTier);
  context.state.set('capabilities', bootstrap.capabilities);
}

// Specialist agents - use context from state
const tenantId = context.state?.get<string>('tenantId');
const capabilities = context.state?.get<string[]>('capabilities') ?? [];
```

---

## Monitoring Required

Deploy with alerting for:

- Bootstrap latency (p95, p99)
- Bootstrap errors (rate, types)
- Cache hit rate (should be >90%)
- State serialization size
- Session creation failures

---

## Rollout Plan

```
Week 1:
  - Feature flag OFF (all use existing fallback)
  - Code deployment, no behavior change

Week 2-3:
  - Feature flag ON for internal testing (10% traffic)
  - Monitor error rates, latency

Week 4:
  - Feature flag ON for all users (50% traffic)
  - Monitor for 24 hours

Week 5:
  - Feature flag ON for all users (100% traffic)
  - Remove old fallback code in next release
```

---

## Checklist: Ready to Implement?

- [ ] Product team confirms session timeout semantics
- [ ] Product team confirms bootstrap frequency
- [ ] Security review of cross-tenant isolation
- [ ] Performance targets confirmed
- [ ] On-call team trained
- [ ] Monitoring alerts configured
- [ ] Rollback procedure documented

**If all checked:** Ready to implement Phase 1
**If any unchecked:** Requires clarification before starting

---

## Questions to Ask

1. **Tenant Context Stale Data:** Acceptable for 30min?
2. **Customer vs Tenant Sessions:** Both need separate bootstrap?
3. **Memory Summaries:** Required on resume or optional?
4. **PII Handling:** Exclude from summaries automatically?
5. **Role Inheritance:** Customer can do subset of tenant actions?

---

## Success Metrics (Post-Launch)

- Session latency <5s (including bootstrap)
- Bootstrap cache hit rate >85%
- Zero cross-tenant context leaks
- Session resumption works for >95% of cases
- Customer satisfaction with personalized responses increases

---

## Related Documentation

- Full analysis: `SESSION_BOOTSTRAP_ROLE_MANAGEMENT_SPECIFICATION_ANALYSIS.md`
- A2A patterns: `A2A_SESSION_STATE_PREVENTION.md`
- Agent dev: `ADK_AGENT_DEVELOPMENT_QUICK_REFERENCE.md`
