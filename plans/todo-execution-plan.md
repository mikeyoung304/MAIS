# Todo Execution Plan

## Prioritization Strategy

**Order by:**

1. **Security/Data Integrity** - Prevent potential issues first
2. **Quick Wins** - High impact, low effort
3. **Component Grouping** - Related changes together for efficiency
4. **Testing** - Important but doesn't block functionality

---

## Phase 1: Security & Data Integrity Quick Wins (Day 1)

_~2-3 hours total, can run in parallel_

| Order | ID   | Title                                   | Effort | Why First                                         |
| ----- | ---- | --------------------------------------- | ------ | ------------------------------------------------- |
| 1.1   | 5261 | T3 trust tier confirmation programmatic | 30 min | Security: Prevents accidental destructive actions |
| 1.2   | 5249 | Version tracking bypass                 | 30 min | Data integrity: Optimistic locking broken         |
| 1.3   | 5253 | Idempotency key allows NULL             | 30 min | Data integrity: Duplicate messages possible       |
| 1.4   | 5179 | Rate limiting agent read tools          | 30 min | Security: DoS prevention                          |
| 1.5   | 5254 | Type assertions on API responses        | 1 hr   | Type safety: Prevents runtime crashes             |

**Phase 1 Outcome:** Core security and data integrity gaps closed.

---

## Phase 2: Agent-v2 Hardening (Day 1-2)

_~3 hours total, related changes_

### 2A: Concierge Agent Improvements

| Order | ID   | Title                      | Effort | Dependency                |
| ----- | ---- | -------------------------- | ------ | ------------------------- |
| 2.1   | 5190 | Hardcoded fallback URLs    | 30 min | None                      |
| 2.2   | 5192 | Module-level mutable state | 1 hr   | None                      |
| 2.3   | 5200 | Retry without backoff      | 30 min | None                      |
| 2.4   | 5196 | Console.log not logger     | 1 hr   | None - affects all agents |

### 2B: Project Hub Agent Improvements

| Order | ID   | Title                        | Effort | Dependency         |
| ----- | ---- | ---------------------------- | ------ | ------------------ |
| 2.5   | 5224 | Project Hub HTTPS validation | 5 min  | Quick win          |
| 2.6   | 5223 | Tool-first protocol prompt   | 30 min | None               |
| 2.7   | 5222 | Tool state returns           | 2-3 hr | None               |
| 2.8   | 5226 | Client-calculated expiry     | 1 hr   | Backend change too |

**Phase 2 Outcome:** Agent-v2 fleet hardened and consistent.

---

## Phase 3: Backend & Session Service (Day 2)

_~2 hours total_

| Order | ID   | Title                       | Effort | Notes                  |
| ----- | ---- | --------------------------- | ------ | ---------------------- |
| 3.1   | 5251 | SessionService DI violation | 30 min | Enables better testing |
| 3.2   | 5260 | Tenant cache unbounded      | 15 min | Memory safety          |

**Phase 3 Outcome:** Backend services have proper DI and bounded caches.

---

## Phase 4: Performance Optimizations (Day 2-3)

_~1 hour total, lower priority_

| Order | ID   | Title                           | Effort | Impact       |
| ----- | ---- | ------------------------------- | ------ | ------------ |
| 4.1   | 5255 | Missing cleanup composite index | 15 min | DB migration |
| 4.2   | 5256 | Cache decrypts every hit        | 30 min | Performance  |
| 4.3   | 5202 | HTTPS URL validation            | 15 min | Consistency  |

**Phase 4 Outcome:** Performance optimizations applied.

---

## Phase 5: Test Quality Improvements (Week 2)

_~8-10 hours total, can be deferred_

| Order | ID   | Title                        | Effort | Notes              |
| ----- | ---- | ---------------------------- | ------ | ------------------ |
| 5.1   | 5181 | Storefront tests type safety | 2-3 hr | Remove `any` types |
| 5.2   | 5182 | Storefront tests DRY         | 2-3 hr | Reduce duplication |
| 5.3   | 5183 | Storefront tests security    | 4-6 hr | Add security tests |
| 5.4   | 5184 | Storefront tests coverage    | 4-5 hr | Edge cases         |

**Phase 5 Outcome:** Test suite is type-safe, DRY, and comprehensive.

---

## Phase 6: Agent Tool Unit Tests (Weeks 2-4)

_6 days phased, ongoing_

| Order | ID   | Title                      | Effort | Notes                        |
| ----- | ---- | -------------------------- | ------ | ---------------------------- |
| 6.1   | 5176 | Add unit tests agent tools | 6 days | Phased approach per todo doc |

**Week 2:** Write tools (high-risk, trust tier enforcement)
**Week 3:** Storefront tools (section ID, page switching)
**Week 4:** Read tools + UI tools

---

## Execution Options

### Option A: Sequential (Solo)

Follow phases 1→6 in order. ~2 weeks to complete everything.

### Option B: Parallel Blitz (Today)

Run `/resolve_todo_parallel` on Phases 1-3 (security + agents + backend).
Complete ~15 todos in one session, defer testing phases.

### Option C: Focused Sprint

- **Today:** Phase 1 (security) + Phase 2A (Concierge)
- **Tomorrow:** Phase 2B (Project Hub) + Phase 3 (Backend)
- **This Week:** Phase 4 (Performance)
- **Next Week:** Phases 5-6 (Testing)

---

## Recommended: Option B

Run parallel resolution on the high-impact items:

```bash
# Resolve security + agent hardening + backend in parallel
/resolve_todo_parallel
```

This addresses:

- ✅ All security gaps
- ✅ All data integrity issues
- ✅ Agent-v2 consistency
- ✅ Backend improvements

Defers testing improvements to next week when you have focused time.

---

## Dependencies Graph

```
5261 (T3 confirm) ←── 5176 Phase 1 (write-tools tests)
5249 (versioning) ←── Frontend changes needed
5253 (idempotency) ←── No deps
5179 (rate limit) ←── No deps
5254 (Zod validation) ←── No deps

5190 (URLs) ←── No deps
5192 (mutable state) ←── No deps
5200 (retry backoff) ←── No deps
5196 (logger) ←── No deps, affects all agents

5224 (HTTPS) ←── 5190 (same pattern)
5223 (tool-first) ←── No deps
5222 (state returns) ←── No deps
5226 (expiry) ←── Backend change

5251 (DI) ←── 5176 Phase 1 (enables testing)
5260 (cache cap) ←── No deps

5181-5184 (tests) ←── Independent, can run in parallel
5176 (agent tests) ←── 5261 (T3), 5251 (DI) should be done first
```

---

## Quick Start

```bash
# Option B - Parallel blitz on Phases 1-4
/resolve_todo_parallel

# Or start with just Phase 1 security items
# They're all 30-min quick wins
```
