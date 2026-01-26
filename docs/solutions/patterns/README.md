# Prevention Patterns & Solutions Index

This directory contains structured prevention strategies and operational patterns for the MAIS codebase.

---

## Agent Ecosystem Guardrails (Latest)

**Status:** Production-ready (Commit cb55639)

Comprehensive prevention strategies for building multi-tenant AI agent systems.

### New Files (Jan 1, 2026)

1. **[AGENT_ECOSYSTEM_PREVENTION_STRATEGIES.md](./AGENT_ECOSYSTEM_PREVENTION_STRATEGIES.md)** (978 lines, 32K)
   - Complete guide with patterns, checklists, code examples, tests
   - 5 critical patterns + testing templates
   - **Start here if:** You need to implement a pattern

2. **[AGENT_ECOSYSTEM_PREVENTION_QUICK_REFERENCE.md](./AGENT_ECOSYSTEM_PREVENTION_QUICK_REFERENCE.md)** (319 lines, 12K)
   - 2-minute quick lookup per pattern
   - Minimal implementations, decision tree, red flags
   - **Start here if:** You have 5 minutes

3. **[AGENT_ECOSYSTEM_PATTERNS_INDEX.md](./AGENT_ECOSYSTEM_PATTERNS_INDEX.md)** (334 lines, 12K)
   - Context, history, interaction examples
   - Attack scenarios & pattern responses
   - Testing guidance per pattern
   - **Start here if:** You need architecture understanding

4. **[../AGENT_ECOSYSTEM_GUARDRAILS_MANIFEST.md](../AGENT_ECOSYSTEM_GUARDRAILS_MANIFEST.md)** (16K)
   - Executive summary of all 5 patterns
   - Documentation structure & reading guide
   - Implementation checklist
   - Anti-patterns to avoid
   - **Start here if:** You're overseeing the implementation

---

## The 5 Patterns

| #   | Pattern                       | File                                | Key Problem                                   | Solution                                     |
| --- | ----------------------------- | ----------------------------------- | --------------------------------------------- | -------------------------------------------- |
| 1   | **Per-Session Isolation**     | `base-orchestrator.ts:200`          | Shared singleton state → one user affects all | `Map<sessionId, State>` with cleanup         |
| 2   | **Required Security Fields**  | `tools/types.ts:61`                 | Optional trustTier → defaults to unsafe T1    | Make field required, add validation          |
| 3   | **Specific NLP Patterns**     | `tools/types.ts:121`                | Broad patterns → false positives on real data | Multi-word anchors, test with business names |
| 4   | **Public Endpoint Hardening** | `public-customer-chat.routes.ts:31` | No rate limiting → DDoS, token exhaustion     | IP rate limit + validation + sanitization    |
| 5   | **Composite Indexes**         | `schema.prisma:*`                   | Single indexes → N+M scans, slow growth       | `@@index([col1, col2])` for query pattern    |

---

## Quick Navigation

### By Time Available

| Time       | Document                        | Why                           |
| ---------- | ------------------------------- | ----------------------------- |
| **2 min**  | QUICK_REFERENCE                 | Overview of all patterns      |
| **20 min** | PATTERNS_INDEX                  | Architecture & context        |
| **1 hour** | PREVENTION_STRATEGIES           | Full guide + examples + tests |
| **2 hour** | All three + GUARDRAILS_MANIFEST | Complete mastery              |

### By Role

| Role          | Start With                              | Then Read             | Finally           |
| ------------- | --------------------------------------- | --------------------- | ----------------- |
| **Developer** | QUICK_REFERENCE                         | PREVENTION_STRATEGIES | Test your pattern |
| **Architect** | PATTERNS_INDEX                          | GUARDRAILS_MANIFEST   | Review design     |
| **Security**  | PREVENTION_STRATEGIES (Pattern 2, 3, 4) | Test section          | Validation rules  |
| **DevOps**    | GUARDRAILS_MANIFEST                     | Monitoring section    | Index strategy    |

### By Task

| Task                         | Document              | Section                                 |
| ---------------------------- | --------------------- | --------------------------------------- |
| **Implementing a pattern**   | PREVENTION_STRATEGIES | Your pattern's "Prevention Checklist"   |
| **Debugging guardrails**     | PATTERNS_INDEX        | "Attack Scenarios & Pattern Responses"  |
| **Code review**              | QUICK_REFERENCE       | "Red Flags" section                     |
| **Monitoring**               | GUARDRAILS_MANIFEST   | "Monitoring & Alerting"                 |
| **Adding new agent feature** | PATTERNS_INDEX        | "Next Steps When Adding Agent Features" |

---

## Related Documentation

### Agent Ecosystem

- `../AGENT_ECOSYSTEM_ANALYSIS_INDEX.md` - Analysis of agent infrastructure
- `../AGENT_ECOSYSTEM_QUICK_REFERENCE.md` - Agent-specific quick ref
- `../AGENT_ECOSYSTEM_IMPLEMENTATION_ROADMAP.md` - Full roadmap

### Other Prevention Patterns

- `mais-critical-patterns.md` - 10 critical patterns for MAIS
- `SERVICE_WIRING_AND_FAKE_SESSION_PREVENTION.md` - Orphan service + fake session patterns (Pitfalls 84-85)
- `SERVICE_WIRING_QUICK_REFERENCE.md` - Quick reference card for service wiring issues
- `circular-dependency-executor-registry-MAIS-20251229.md` - Module isolation
- `phase-5-testing-and-caching-prevention-MAIS-20251231.md` - Testing patterns

### Architecture & Design

- `../AGENT-DESIGN-INDEX.md` - Agent design documentation
- `../../multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md` - Multi-tenant patterns
- `../../reference/ARCHITECTURE.md` - System architecture

---

## Implementation Checklist

Use this when building a new feature:

```
┌─ Have mutable state in long-running service?
│  └─ YES → Pattern 1: Per-Session Isolation
│  └─ NO → Continue
│
├─ Have optional security field (permission, role, approval)?
│  └─ YES → Pattern 2: Required Field
│  └─ NO → Continue
│
├─ Filtering user text for keywords/injections?
│  └─ YES → Pattern 3: Specific NLP Patterns
│  └─ NO → Continue
│
├─ Unauthenticated public API endpoint?
│  └─ YES → Pattern 4: Public Endpoint Hardening
│  └─ NO → Continue
│
└─ Query filtering on multiple columns?
   └─ YES → Pattern 5: Composite Index
   └─ NO → Not a prevention pattern
```

---

## Key Files Modified

| File                                                 | Pattern | Change                                 |
| ---------------------------------------------------- | ------- | -------------------------------------- |
| `server/src/agent/orchestrator/circuit-breaker.ts`   | 1       | New: Per-session circuit breaker       |
| `server/src/agent/orchestrator/base-orchestrator.ts` | 1       | Per-session breaker map + cleanup      |
| `server/src/agent/tools/types.ts`                    | 2, 3    | Required trustTier + specific patterns |
| `server/src/routes/public-customer-chat.routes.ts`   | 4       | IP rate limiter middleware             |
| `server/prisma/schema.prisma`                        | 5       | Composite indexes                      |

**Commit:** cb55639 - `feat(agent): add code-level guardrails for agent orchestrator`

---

## Common Questions

**Q: Do I need to read all three documents?**
A: Start with QUICK_REFERENCE (5 min). Only read full PREVENTION_STRATEGIES if implementing that specific pattern.

**Q: Where do I find the actual code?**
A: Files are listed in "Key Files Modified" above. Each pattern doc also links to relevant code lines.

**Q: What if a pattern doesn't apply to my feature?**
A: Use the decision tree above to skip irrelevant patterns.

**Q: How do I test my implementation?**
A: Each pattern has a "Testing Checklist" in PREVENTION_STRATEGIES.md

**Q: Can I use these patterns in other projects?**
A: Yes! They're generic patterns - apply Pattern 1 to any long-running service, Pattern 5 to any multi-tenant database schema, etc.

---

## Testing & Validation

Each pattern includes:

- Unit test template
- Integration test guide
- Fuzzing/property-based tests
- Regression test checklist

See: PREVENTION_STRATEGIES.md → "Testing Checklist Template"

---

## Monitoring & Alerting

Each pattern has monitoring guidance:

- **Pattern 1:** Circuit breaker trip alerts
- **Pattern 2:** Tool registration failures
- **Pattern 3:** Injection pattern match rate
- **Pattern 4:** Rate limit hit spikes
- **Pattern 5:** Query performance (EXPLAIN Seq Scan)

See: GUARDRAILS_MANIFEST.md → "Monitoring & Alerting"

---

## Version History

| Version | Date       | Source         | Patterns                                                                                           |
| ------- | ---------- | -------------- | -------------------------------------------------------------------------------------------------- |
| 1.0     | 2026-01-01 | Commit cb55639 | 5 patterns (Session Isolation, Required Fields, NLP Patterns, Public Hardening, Composite Indexes) |

---

## Contributing

When you discover a new prevention pattern:

1. Implement and test the pattern
2. Document in PREVENTION_STRATEGIES format:
   - When to apply
   - Problem statement + impact
   - Solution with code examples
   - Prevention checklist (copy-paste friendly)
   - Red flags
   - Testing guide
3. Add summary to QUICK_REFERENCE
4. Add section to this README
5. Update GUARDRAILS_MANIFEST if cross-cutting

---

## Contacts & Support

- **Implementation Help:** See the relevant pattern's "Prevention Checklist"
- **Architecture Questions:** Check PATTERNS_INDEX.md
- **Bug in Pattern?** Document it, add test case, submit for review
- **New Pattern?** Follow "Contributing" section above

---

**Last Updated:** 2026-01-01
**Status:** Production-Ready
**Maintenance:** Quarterly pattern review
