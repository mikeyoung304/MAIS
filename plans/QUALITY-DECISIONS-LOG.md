# Quality Remediation Decision Log

> **Purpose**: Document key decisions and rationale for the quality remediation plan
> **Created**: 2025-12-26
> **Context**: Enterprise quality mandate - decisions based on quality, not time/cost

---

## Decision 1: BookingService → 8 Services (Not 3)

### Context
Original audit recommended splitting 1,394-line BookingService into 3 services (~400 lines each).

### Decision
Split into **8 focused services** (<200 lines each) using Orchestrator pattern.

### Alternatives Considered
| Option | Lines/Service | Rejected Because |
|--------|---------------|------------------|
| Keep monolith | 1,394 | Cognitive overload, merge conflicts |
| Split to 3 services | ~400 | Still too large for enterprise |
| Split to 8 services | <200 | **Selected** |

### Rationale (Enterprise Architect Review)
1. **Cognitive Load**: Human working memory ~7 items; 16 methods + 10 dependencies exceeds this
2. **Team Scalability**: 3 engineers can work in parallel without conflicts
3. **Blast Radius**: Bug in appointment logic can't break wedding deposits
4. **Testing Precision**: Each service gets focused unit tests
5. **Onboarding**: New dev reads 200 lines, not 1,394

### New Services
```
checkout-session.factory.ts      (~80 lines)
payment-intent.factory.ts        (~100 lines)
wedding-booking.orchestrator.ts  (~200 lines)
wedding-deposit.service.ts       (~150 lines)
appointment-booking.service.ts   (~200 lines)
booking-lifecycle.service.ts     (~180 lines)
booking-query.service.ts         (~150 lines)
refund-processing.service.ts     (~120 lines)
```

### Risk Mitigation
- Strangler Fig Pattern: Run old + new in parallel
- Feature flags for gradual rollout
- Shadow traffic comparison before cutover
- Keep facade for backward compatibility

---

## Decision 2: Coverage Target 80% (Not 50%)

### Context
Original plan targeted 50% → 75% coverage incrementally.

### Decision
Target **80% coverage** as enterprise standard.

### Alternatives Considered
| Target | Rejected Because |
|--------|------------------|
| 50% | Too low for $10K+ transactions |
| 65% | Below industry standard for SaaS |
| 75% | Close but not enterprise-grade |
| 80% | **Selected** - industry standard |

### Rationale
1. **Financial Risk**: Wedding bookings are $5K-$20K each; bugs = lost revenue
2. **Regulatory**: SOC 2 compliance expects 80%+ for critical paths
3. **Multi-tenant**: Cross-tenant data leakage would be catastrophic
4. **Investment Protection**: 771 tests already exist; thresholds protect this investment

### Implementation Path
```
Phase 0: 43% → 50% (raise thresholds)
Phase 2: 50% → 65% (add tests)
Phase 3: 65% → 80% (comprehensive coverage)
```

---

## Decision 3: Turborepo NOW (Not "Evaluate")

### Context
Original plan had "Evaluate Turborepo vs Nx" as P2 task.

### Decision
Implement **Turborepo immediately** (P0).

### Alternatives Considered
| Tool | Rejected Because |
|------|------------------|
| npm workspaces (current) | No caching, 4m+ builds |
| Nx | Steeper learning curve, overkill for 5 packages |
| Turborepo | **Selected** - simple, Vercel-native, Next.js integration |

### Rationale
1. **Immediate ROI**: 70% build time reduction on cache hits
2. **CI Cost Savings**: ~$500/month in GitHub Actions minutes
3. **Developer Velocity**: 5s builds instead of 4m = 50x faster iteration
4. **Zero Risk**: Non-invasive, can remove if needed
5. **Next.js Alignment**: Same vendor (Vercel), native integration

### Expected Results
| Scenario | Before | After |
|----------|--------|-------|
| Cold build | 4m 30s | 4m 30s |
| Warm build | 4m 30s | 12s |
| Remote cache | N/A | 5s |

---

## Decision 4: Add OpenTelemetry Tracing (New)

### Context
Not in original audit. Added based on enterprise review.

### Decision
Add **distributed tracing** with OpenTelemetry.

### Alternatives Considered
| Tool | Rejected Because |
|------|------------------|
| Pino logging only | No trace visibility, slow debugging |
| Datadog APM | Expensive ($1,500/mo), vendor lock-in |
| OpenTelemetry + Honeycomb | **Selected** - open standard, $200/mo |

### Rationale
1. **MTTR Improvement**: Debug production issues in minutes, not hours
2. **Multi-tenant Visibility**: "Why is Tenant X experiencing 2s latency?"
3. **Proactive Monitoring**: Detect N+1 queries before customers complain
4. **Scale Preparation**: Identify bottlenecks at 100 tenants vs 1000

### Implementation
- Auto-instrumentation for Express, Prisma, HTTP
- Custom spans for service methods
- Tenant context in all traces
- 1% sampling in production, 100% in staging

---

## Decision 5: Add Tenant Isolation Tests (New)

### Context
Not in original audit. Added based on Simplicity Advocate review.

### Decision
Add **explicit integration tests** for multi-tenant data isolation.

### Rationale
1. **Security Critical**: Cross-tenant data leakage = regulatory violation
2. **Don't Trust Assumptions**: TypeScript types don't prevent SQL mistakes
3. **Explicit > Implicit**: Test what matters most

### Test Coverage
```typescript
// Explicit tests for:
- BookingService.getAllBookings() never returns cross-tenant data
- CatalogService.getPackages() never returns cross-tenant data
- Cache keys include tenantId
- API endpoints respect tenant context
```

---

## Decision 6: Add Immutable Event Store (New)

### Context
Not in original audit. Added based on Enterprise Architect review.

### Decision
Add **immutable event store** for audit compliance.

### Rationale
1. **SOC 2 Compliance**: Auditors require immutable audit logs
2. **Forensics**: "Show me all changes to Booking #123 in last 6 months"
3. **Chain of Custody**: Hash-based tamper detection
4. **Regulatory**: GDPR/CCPA requires data lineage tracking

### Implementation
```typescript
interface DomainEvent {
  eventId: string;
  eventType: string;
  aggregateId: string;
  tenantId: string;
  timestamp: Date;
  payload: unknown;
  previousEventHash: string; // Tamper detection
}
```

---

## Decision 7: Add Mutation Testing (New)

### Context
Not in original audit. Added based on Enterprise Architect review.

### Decision
Add **Stryker mutation testing** to validate test quality.

### Rationale
1. **Coverage ≠ Quality**: 80% coverage doesn't mean tests catch bugs
2. **Mutation Score**: Measures test effectiveness, not just coverage
3. **Weak Test Detection**: Find tests that pass despite not testing logic

### Target
- Mutation score > 70% for booking services
- CI reports mutation score trends

---

## Decision 8: Timeline 6-8 Weeks (Not 2)

### Context
Original plan had aggressive 2-week timeline.

### Decision
Extend to **6-8 weeks** for enterprise quality.

### Rationale (Reviewer Consensus)
| Reviewer | Original | Revised |
|----------|----------|---------|
| DHH | 2 weeks | 4-6 weeks |
| Enterprise Architect | 5 weeks | 8 weeks |
| Simplicity Advocate | 1 week | 4-6 weeks |

### Why Longer Is Better
1. **Quality > Speed**: Enterprise mandate explicitly prioritizes quality
2. **Thorough Testing**: Each phase needs comprehensive test coverage
3. **Safe Migration**: Strangler Fig pattern requires parallel operation
4. **Documentation**: Each phase needs proper documentation
5. **Review Cycles**: Code reviews catch issues before production

---

## Decision 9: Keep Vite Client (Defer Removal)

### Context
Original plan included removing deprecated Vite client.

### Decision
**Defer removal** to future sprint.

### Rationale
1. **Working Admin Dashboard**: 50 tenants actively use it
2. **Risk vs Reward**: Breaking admin = support burden
3. **Next.js Complete**: Storefronts (revenue-critical) already migrated
4. **Not Enterprise Critical**: Admin is internal-only

### Revisit When
- Next.js admin features reach parity
- Team has 2+ frontend developers
- User complaints about admin performance

---

## Decision Summary

| Decision | Original | Enterprise Revised |
|----------|----------|-------------------|
| BookingService split | 3 services | **8 services** |
| Coverage target | 75% | **80%** |
| Turborepo | Evaluate (P2) | **Immediate (P0)** |
| OpenTelemetry | Not planned | **Added (P1)** |
| Tenant isolation tests | Not planned | **Added (P0)** |
| Event store | Not planned | **Added (P2)** |
| Mutation testing | Not planned | **Added (P2)** |
| Timeline | 2 weeks | **6-8 weeks** |
| Vite client removal | P2 | **Deferred** |

---

## Review Panel

These decisions were validated by:

1. **DHH (Rails Philosophy)**: Focus on simplicity, avoid over-engineering
2. **Enterprise Architect**: Scale, compliance, observability
3. **Simplicity Advocate**: 80/20 rule, pragmatic choices

**Consensus**: All reviewers agreed enterprise quality mandate justifies expanded scope.
