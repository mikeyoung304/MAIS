# Agent Ecosystem Guardrails - Manifest

**Version:** 1.0
**Date:** 2026-01-01
**Based on:** Commit cb55639 - `feat(agent): add code-level guardrails for agent orchestrator`

---

## Executive Summary

This manifest documents 5 critical prevention patterns discovered while implementing enterprise guardrails for the agent orchestrator. These patterns prevent:

- **Session pollution:** One user's abuse affecting all users (Pattern 1)
- **Unsafe defaults:** Security fields silently defaulting to vulnerable values (Pattern 2)
- **Data corruption:** Injection filtering destroying legitimate business data (Pattern 3)
- **Token exhaustion:** Attackers overwhelming public endpoints (Pattern 4)
- **Performance degradation:** Slow queries on large tables (Pattern 5)

**Impact:** These patterns are foundational to building multi-tenant AI agent systems at scale.

---

## The 5 Patterns

### Pattern 1: Per-Session State Isolation
**Problem:** Circuit breaker shared across all sessions

**Impact:** One tenant's runaway agent consumes entire token budget, blocking all other tenants

**Fix:** Map<sessionId, CircuitBreaker> instead of singleton

**Files:**
- `server/src/agent/orchestrator/base-orchestrator.ts` (lines 200-230)
- `server/src/agent/orchestrator/circuit-breaker.ts` (complete implementation)

**Key Insight:** Any mutable state in long-running services must be scoped to individual users/sessions with cleanup routines

---

### Pattern 2: Required Security-Critical Fields
**Problem:** `trustTier` optional on AgentTool interface

**Impact:** Write tools (package creation, booking cancellation) default to T1 auto-confirm instead of safe T3, bypassing approval

**Fix:** `trustTier: 'T1' | 'T2' | 'T3'` (required, not optional)

**Files:**
- `server/src/agent/tools/types.ts` (lines 61-87)

**Key Insight:** Permission/approval/trust/role fields must be required with TypeScript enforcement + runtime validation

---

### Pattern 3: False Positive Testing for NLP Patterns
**Problem:** Broad injection patterns match legitimate business data

**Impact:** Business name "Disregard for Details Photography" becomes "[FILTERED] for Details Photography"

**Fix:** Multi-word anchors: `/forget\s+(all|your|previous)/i` instead of `/forget/i`

**Files:**
- `server/src/agent/tools/types.ts` (lines 121-169)

**Key Insight:** Prompt injection patterns must be context-specific (multi-word) with extensive testing against real business data

---

### Pattern 4: Public Endpoint Hardening
**Problem:** `/v1/public/chat/message` has no IP rate limiting

**Impact:** Attackers exhaust token budget, availability enumeration, DDoS

**Fix:** Three-layer defense: IP rate limiting + request validation + response sanitization

**Files:**
- `server/src/routes/public-customer-chat.routes.ts` (lines 25-57)
- `server/src/middleware/rateLimiter.ts` (lines 300-315)

**Key Insight:** Public endpoints require IP-based rate limiting separate from user-level limits

---

### Pattern 5: Composite Database Indexes
**Problem:** Queries like `WHERE tenantId AND status` use only one index

**Impact:** Full table scans as data grows, 100x performance degradation

**Fix:** Composite indexes: `@@index([tenantId, status])`

**Files:**
- `server/prisma/schema.prisma` (throughout)

**Key Insight:** Multi-column WHERE clauses require composite indexes optimized for query pattern

---

## Documentation Structure

```
docs/solutions/
├── patterns/
│   ├── AGENT_ECOSYSTEM_PREVENTION_STRATEGIES.md    ← Full guide (978 lines)
│   │   ├── Pattern 1: Per-Session Isolation
│   │   │   └── Prevention checklist, code examples, tests
│   │   ├── Pattern 2: Required Security Fields
│   │   │   └── Prevention checklist, code examples, tests
│   │   ├── Pattern 3: False Positive Testing
│   │   │   └── Prevention checklist, code examples, tests
│   │   ├── Pattern 4: Public Endpoint Hardening
│   │   │   └── Prevention checklist, code examples, tests
│   │   ├── Pattern 5: Composite Indexes
│   │   │   └── Prevention checklist, code examples, tests
│   │   └── Testing Checklist Template
│   │
│   ├── AGENT_ECOSYSTEM_PREVENTION_QUICK_REFERENCE.md ← 2-min reference (319 lines)
│   │   ├── One-screen summary per pattern
│   │   ├── Minimal implementations
│   │   ├── Decision tree: which pattern?
│   │   └── Red flags checklist
│   │
│   └── AGENT_ECOSYSTEM_PATTERNS_INDEX.md            ← Context & history (334 lines)
│       ├── The 5 patterns with examples
│       ├── Guard rails architecture diagram
│       ├── Attack scenarios & pattern responses
│       ├── How patterns interact
│       └── Testing each pattern
│
└── AGENT_ECOSYSTEM_GUARDRAILS_MANIFEST.md           ← This file
    ├── Executive summary
    ├── The 5 patterns (summary)
    ├── Documentation structure
    ├── Reading guide
    ├── Implementation checklist
    ├── Anti-patterns to avoid
    └── References
```

---

## Reading Guide

**If you have 5 minutes:**
→ Read: `AGENT_ECOSYSTEM_PREVENTION_QUICK_REFERENCE.md`

**If you have 20 minutes:**
→ Read: `AGENT_ECOSYSTEM_PATTERNS_INDEX.md`

**If you need to implement a pattern:**
→ Read: `AGENT_ECOSYSTEM_PREVENTION_STRATEGIES.md` (find your pattern)

**If you're building a new agent feature:**
→ Start with: "Next Steps When Adding Agent Features" in PATTERNS_INDEX.md

**If you're debugging a guardrail issue:**
→ Start with: "Attack Scenarios & Pattern Responses" in PATTERNS_INDEX.md

---

## Implementation Checklist

Use this checklist when adding new agent features:

- [ ] **Pattern 1: Per-Session Isolation**
  - [ ] Does this feature have mutable state?
  - [ ] Is it accessed by long-running services?
  - [ ] Implemented as `Map<sessionId, State>`?
  - [ ] Cleanup routine implemented?
  - [ ] Concurrent session tests written?

- [ ] **Pattern 2: Required Security Fields**
  - [ ] Does this feature change approval/trust behavior?
  - [ ] All permission fields are required (non-optional)?
  - [ ] JSDoc explains tiers/values?
  - [ ] Runtime validation at initialization?
  - [ ] Compilation fails without field?

- [ ] **Pattern 3: False Positive Testing**
  - [ ] Does this feature process user text?
  - [ ] Patterns are multi-word (not single-word)?
  - [ ] Tested against real business names?
  - [ ] Fuzzing test with legitimate data?
  - [ ] Edge cases documented?

- [ ] **Pattern 4: Public Endpoint Hardening**
  - [ ] Is the endpoint unauthenticated?
  - [ ] IP rate limiting applied?
  - [ ] Request validation with size limits?
  - [ ] Response sanitized (no sensitive fields)?
  - [ ] Error messages generic (no stack traces)?

- [ ] **Pattern 5: Composite Indexes**
  - [ ] Analyzed slow queries with EXPLAIN?
  - [ ] Identified `Seq Scan` (bad)?
  - [ ] Composite indexes match query pattern?
  - [ ] Index purpose documented?
  - [ ] Performance tested before/after?

---

## Anti-Patterns (What NOT to Do)

```typescript
// ❌ Anti-Pattern 1: Shared singleton with session state
class Service {
  private circuitBreaker = new CircuitBreaker(); // One breaker for all users!
}

// ✅ Correct
class Service {
  private breakers = new Map<string, CircuitBreaker>();
}

// ❌ Anti-Pattern 2: Optional security field
interface Tool {
  trustTier?: 'T1' | 'T2' | 'T3'; // Optional - easy to forget!
}

// ✅ Correct
interface Tool {
  /** REQUIRED: T1=auto, T2=soft, T3=hard */
  trustTier: 'T1' | 'T2' | 'T3'; // Required!
}

// ❌ Anti-Pattern 3: Single-word NLP pattern
/disregard/i // Matches "Disregard for Details Photography"

// ✅ Correct
/disregard\s+(all|previous)/i // Multi-word anchor

// ❌ Anti-Pattern 4: Public endpoint without rate limiting
app.post('/v1/public/chat', (req, res) => {
  // Attacker can spam infinitely!
});

// ✅ Correct
app.post('/v1/public/chat', publicLimiter, (req, res) => {
  // 50 requests per 15 minutes per IP
});

// ❌ Anti-Pattern 5: Multiple single-column indexes
@@index([tenantId])      // One index
@@index([status])        // Another index
// Query uses only one, filters the rest in-memory

// ✅ Correct
@@index([tenantId, status]) // Composite index for both
```

---

## Key Files Modified (Commit cb55639)

| File | Lines | Pattern | Change |
|------|-------|---------|--------|
| `server/src/agent/orchestrator/circuit-breaker.ts` | 140 | 1 | New: Per-session circuit breaker |
| `server/src/agent/orchestrator/base-orchestrator.ts` | +70, -21 | 1 | Per-session breaker map + cleanup |
| `server/src/agent/tools/types.ts` | +20 | 2, 3 | Required trustTier + specific patterns |
| `server/src/routes/public-customer-chat.routes.ts` | +15 | 4 | IP rate limiter middleware |
| `server/prisma/schema.prisma` | +2 | 5 | Composite indexes (scattered) |

---

## Testing Coverage

Each pattern has a complete testing guide with:
- Unit tests (isolation, defaults, patterns)
- Integration tests (concurrent access, query performance)
- Fuzzing tests (random data, edge cases)
- Regression tests (existing functionality preserved)

See: `AGENT_ECOSYSTEM_PREVENTION_STRATEGIES.md` → "Testing Checklist Template"

---

## Monitoring & Alerting

### Pattern 1: Circuit Breaker Trips
```
Alert: circuitBreakerTripped event
→ Check: session token usage, turn count
→ Action: Investigate agent behavior, adjust limits if needed
```

### Pattern 2: Tool Registration Failures
```
Alert: validateTool() rejects tool
→ Check: trustTier field present and valid
→ Action: Fix tool definition before deployment
```

### Pattern 3: Injection Pattern Matches
```
Alert: [FILTERED] appears in logs (production)
→ Check: False positive rate on real business data
→ Action: Refine patterns if high false positive rate
```

### Pattern 4: Rate Limit Hits
```
Alert: 429 response codes spike
→ Check: IP addresses, request patterns
→ Action: Investigate potential attack or legitimate usage spike
```

### Pattern 5: Query Performance
```
Alert: EXPLAIN shows Seq Scan on large table
→ Check: Query pattern, index design
→ Action: Add composite index, test performance
```

---

## Related Documentation

- **Multi-Tenant Patterns:** `docs/multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md`
- **Critical Patterns:** `docs/solutions/patterns/mais-critical-patterns.md`
- **Circular Dependencies:** `docs/solutions/patterns/circular-dependency-executor-registry-MAIS-20251229.md`
- **Agent Design:** `docs/solutions/AGENT-DESIGN-INDEX.md`
- **Phase 5 Testing:** `docs/solutions/patterns/phase-5-testing-and-caching-prevention-MAIS-20251231.md`

---

## FAQ

**Q: Do I need to implement all 5 patterns?**
A: Only the ones relevant to your feature:
- Building shared state? → Pattern 1
- Adding approval logic? → Pattern 2
- Processing user input? → Pattern 3
- Creating public endpoint? → Pattern 4
- Slow database query? → Pattern 5

**Q: Can I use singletons for state?**
A: Only for stateless services (logger, config). Any user/session-specific state must use Map<key, value>.

**Q: What if the pattern seems overly restrictive?**
A: It likely isn't - these patterns emerged from production issues. Feel free to request a review if you have a specific use case.

**Q: How do I test my implementation?**
A: Copy the "Testing Checklist Template" from PREVENTION_STRATEGIES.md for your pattern.

**Q: What's the performance impact of these patterns?**
A: Negligible (ms per operation) compared to API calls. Pattern 5 actually improves performance.

**Q: Are these patterns specific to agents?**
A: No, they apply to any multi-tenant system. The agent context is just where we discovered them.

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-01 | Initial manifest with 5 patterns from commit cb55639 |

---

## How to Update This Manifest

When you discover a new prevention pattern:

1. Document it in a new file: `PATTERN_NAME_PREVENTION_STRATEGIES.md`
2. Create a quick reference: `PATTERN_NAME_QUICK_REFERENCE.md`
3. Add index entry to the solutions folder index
4. Update this manifest with the new pattern
5. Link related patterns in cross-references

---

## Questions or Feedback?

- **Implementation Help:** See PREVENTION_STRATEGIES.md for your pattern
- **Architecture Question:** Check PATTERNS_INDEX.md for design rationale
- **Quick Lookup:** Use QUICK_REFERENCE.md
- **Debugging:** See "Attack Scenarios" in PATTERNS_INDEX.md

---

## Key Takeaways

1. **Multi-tenant isolation requires per-user state scoping** (not shared singletons)
2. **Security fields must be required with validation** (not optional)
3. **NLP patterns must be context-specific** (multi-word, not single-word)
4. **Public endpoints need three-layer defense** (rate limit, validate, sanitize)
5. **Multi-column queries need composite indexes** (not separate single-column indexes)

---

**Last Updated:** 2026-01-01
**Status:** Production-ready
**Commit:** cb55639
