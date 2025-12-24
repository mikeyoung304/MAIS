# ADR Audit Report

**Date:** December 24, 2025
**Auditor:** Claude Code
**Scope:** All 14 ADRs + DECISIONS.md + ARCHITECTURE.md + CLAUDE.md

---

## Executive Summary

The MAIS documentation has **moderate structural inconsistencies** that create confusion and risk outdated information being followed. The primary issues are:

1. **Incorrect supersession reference** (ADR-008 says superseded by ADR-012, should be ADR-013)
2. **Misplaced ADR** (ADR-014 is in docs/solutions/ instead of docs/adrs/)
3. **Stale cross-references** in multiple ADRs pointing to wrong ADR numbers
4. **Implementation status gaps** for accepted ADRs (ADR-005, ADR-010)

**Positive Finding:** DECISIONS.md has been properly consolidated as an index linking to ADR files (fixed in 2025-12-02 migration).

**Risk Level:** MEDIUM - Could lead to developers following superseded patterns or referencing wrong documentation.

---

## ADR Inventory

### docs/adrs/ Directory (13 files)

| ADR | Title | Status | Date | Notes |
|-----|-------|--------|------|-------|
| 001 | Adopt Diátaxis Framework | Accepted | 2025-11 | Documentation ADR |
| 002 | Documentation Naming Standards | Accepted | 2025-11 | Documentation ADR |
| 003 | Sprint Documentation Lifecycle | Accepted | 2025-11 | Documentation ADR |
| 004 | Time-Based Archive Strategy | Accepted | 2025-11 | Documentation ADR |
| 005 | Documentation Security Review | Accepted | 2025-11 | **Implementation incomplete** |
| 006 | Modular Monolith Architecture | Accepted | 2025-10 | Architecture ADR |
| 007 | Mock-First Development | Accepted | 2025-10 | Architecture ADR |
| 008 | Pessimistic Locking | **Superseded** | 2025-10 | **Wrong supersession ref** |
| 009 | Database Webhook DLQ | Accepted | 2025-10 | Architecture ADR |
| 010 | Git History Rewrite | Accepted (Pending) | 2025-10 | **Implementation status unclear** |
| 011 | PaymentProvider Interface | Accepted | 2025-10 | Architecture ADR |
| 012 | Full Test Coverage Webhook | Accepted | 2025-10 | Architecture ADR |
| 013 | PostgreSQL Advisory Locks | Accepted | 2025-01 | Supersedes ADR-008 |

### Misplaced ADR

| ADR | Current Location | Should Be |
|-----|-----------------|-----------|
| 014 | docs/solutions/ADR-014-addon-entity-optional-description.md | docs/adrs/ADR-014-addon-entity-optional-description.md |

---

## Issue #1: Incorrect Supersession Reference (HIGH)

### Problem

ADR-008 header says:
```
**Superseded By:** ADR-012 (PostgreSQL Advisory Locks)
```

But ADR-012 is "Full Test Coverage for Webhook Handler" - nothing about locking.

ADR-013 is "PostgreSQL Advisory Locks" and correctly says:
```
**Supersedes:** ADR-008
```

### Impact

Developers reading ADR-008 get wrong pointer to superseding decision.

### Fix Required

In `docs/adrs/ADR-008-pessimistic-locking-booking-race-conditions.md` line 8:

```diff
- **Superseded By:** ADR-012 (PostgreSQL Advisory Locks)
+ **Superseded By:** ADR-013 (PostgreSQL Advisory Locks)
```

---

## Issue #2: Misplaced ADR-014 (MEDIUM)

### Problem

ADR-014 is located at:
- `docs/solutions/ADR-014-addon-entity-optional-description.md`

Should be in:
- `docs/adrs/ADR-014-addon-entity-optional-description.md`

### Impact

- docs/adrs/README.md says "Total ADRs: 13" but 14 exist
- ADR-014 not listed in README
- Inconsistent discovery of ADRs

### Fix Required

```bash
mv docs/solutions/ADR-014-addon-entity-optional-description.md \
   docs/adrs/ADR-014-addon-entity-optional-description.md
```

Update docs/adrs/README.md to include ADR-014.

---

## Issue #3: Stale Cross-References (MEDIUM)

### ADR-006 (Modular Monolith) - Line 220

```markdown
- ADR-005: PaymentProvider Interface (example of ports pattern)
```

**Problem:** ADR-005 is "Documentation Security Review", not PaymentProvider.
**Fix:** Change to ADR-011.

### ADR-007 (Mock-First Development) - Line 418

```markdown
- ADR-005: PaymentProvider Interface (example of mockable port)
```

**Problem:** Same issue.
**Fix:** Change to ADR-011.

### ARCHITECTURE.md - Line 184

```markdown
See **DECISIONS.md ADR-001** for rationale.
```

**Problem:** References superseded locking approach.
**Fix:** Reference ADR-013 (advisory locks) as current approach.

### ARCHITECTURE.md - Line 214

```markdown
**See Also:** DECISIONS.md ADR-001 (Pessimistic Locking)
```

**Problem:** References superseded approach.
**Fix:** Add note that ADR-013 is current, or update reference.

---

## Issue #4: docs/adrs/README.md Outdated (LOW)

### Problems

1. **Count wrong:** Says "Total ADRs: 13" but 14 exist
2. **Status wrong:** ADR-008 listed as "Accepted" but is "Superseded"
3. **Missing ADR-014:** Not in table

### Current State

```markdown
| [ADR-008](./ADR-008-pessimistic-locking-booking-race-conditions.md) | Pessimistic Locking for Booking Race Conditions | Accepted | 2025-10 |
```

### Fix Required

```markdown
| [ADR-008](./ADR-008-pessimistic-locking-booking-race-conditions.md) | Pessimistic Locking for Booking Race Conditions | Superseded | 2025-10 |
...
| [ADR-014](./ADR-014-addon-entity-optional-description.md) | AddOn Entity Optional Description | Decided | 2025-12 |
...
**Total ADRs:** 14
```

---

## Issue #5: Implementation Status Gaps (MEDIUM)

### ADR-005: Documentation Security Review

**Status:** Accepted (2025-11-12)

**Uncompleted Implementation Items:**
- [ ] gitleaks installed and configured
- [ ] Pre-commit hook tested and working
- [ ] GitHub Actions workflow created
- [ ] PR template with security checklist
- [ ] Training materials created
- [ ] Team training completed
- [ ] Quarterly audit scheduled

**Impact:** Security review process documented but not implemented.

**Recommendation:** Either implement or change status to "Accepted (Implementation Pending)" like ADR-010.

### ADR-010: Git History Rewrite

**Status:** Accepted (Implementation Pending)

**Date:** 2025-10-29 (2 months ago)

**Question:** Has this been implemented? If yes, update status. If no, is it still needed?

---

## Issue #6: Naming Convention Inconsistency (LOW)

### ADR-002 Specifies

> Use SCREAMING_SNAKE_CASE for documentation files

### Reality

- ADR files use kebab-case: `ADR-001-adopt-diataxis-framework.md`
- Many docs use mixed conventions

### Assessment

This is technically a violation of ADR-002, but kebab-case for ADR filenames is industry standard. Consider updating ADR-002 to explicitly allow kebab-case for ADR files.

---

## Cross-Document Consistency Analysis

### CLAUDE.md vs ADRs

| Topic | CLAUDE.md Says | ADR Says | Consistent? |
|-------|---------------|----------|-------------|
| Double-booking prevention | 3-layer defense with SELECT FOR UPDATE | ADR-008 superseded by ADR-013 (advisory locks) | **INCONSISTENT** |
| Webhook idempotency | Database-based deduplication | ADR-009 (same) | ✅ Consistent |
| Architecture | Modular monolith | ADR-006 (same) | ✅ Consistent |
| Mock-first development | ADAPTERS_PRESET env | ADR-007 (same) | ✅ Consistent |
| Documentation archive | docs/archive/YYYY-MM/ | ADR-004 (same) | ✅ Consistent |

### ARCHITECTURE.md vs ADRs

| Topic | ARCHITECTURE.md Says | ADR Says | Consistent? |
|-------|---------------------|----------|-------------|
| Locking mechanism | SELECT FOR UPDATE (Layer 2) | ADR-013: pg_advisory_xact_lock | **INCONSISTENT** |
| Webhook DLQ | WebhookEvent table | ADR-009 (same) | ✅ Consistent |
| Architecture | Modular monolith | ADR-006 (same) | ✅ Consistent |
| Test coverage | 752/752 passing | ADR-012 requires 100% webhook | ✅ Consistent |

---

## Recommendations

### Immediate Fixes (P0)

1. **Fix ADR-008 supersession reference** (5 min)
   - Change "ADR-012" to "ADR-013" in ADR-008

2. **Move ADR-014 to correct location** (5 min)
   - Move from docs/solutions/ to docs/adrs/

3. **Update docs/adrs/README.md** (10 min)
   - Fix ADR-008 status
   - Add ADR-014
   - Update count

### Short-term Fixes (P1)

4. **Update ARCHITECTURE.md locking section** (30 min)
   - Reference advisory locks (ADR-013) as current approach
   - Keep SELECT FOR UPDATE as historical context or remove

5. **Fix cross-references in ADR-006 and ADR-007** (10 min)
   - Change ADR-005 → ADR-011 for PaymentProvider

### Medium-term Fixes (P2)

6. **ADR-005 implementation** (4-6 hours)
   - Install gitleaks, configure hooks, create workflows
   - OR mark as "Deferred" if not priority

7. **ADR-010 status update** (15 min)
   - Confirm if git history rewrite was done
   - Update status accordingly

8. **CLAUDE.md locking section** (15 min)
   - Update to reference advisory locks, not SELECT FOR UPDATE

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| Total ADRs | 14 |
| Accepted | 11 |
| Superseded | 1 (ADR-008) |
| Pending Implementation | 2 (ADR-005, ADR-010) |
| Misplaced | 1 (ADR-014) |
| Wrong cross-references | 4 |
| Documents needing updates | 4 (ARCHITECTURE.md, CLAUDE.md, ADR-006, ADR-007) |

**Total Issues Found:** 6
**Estimated Fix Time:** ~5-6 hours

---

## Appendix: ADR Cross-Reference Map

### Which ADRs Reference Each Other

```
ADR-001 (Diátaxis) ← None
ADR-002 (Naming) ← None
ADR-003 (Sprint Lifecycle) ← None
ADR-004 (Archive) ← ADR-005
ADR-005 (Security Review) → ADR-004
ADR-006 (Modular Monolith) → ADR-007, ADR-005 [WRONG: should be ADR-011]
ADR-007 (Mock-First) → ADR-006, ADR-005 [WRONG: should be ADR-011]
ADR-008 (Pessimistic Lock) → ADR-012 [WRONG: should be ADR-013], ADR-009
ADR-009 (Webhook DLQ) → ADR-008, ADR-011
ADR-010 (Git Rewrite) ← None
ADR-011 (PaymentProvider) → ADR-006, ADR-007, ADR-009
ADR-012 (Test Coverage) → ADR-009, ADR-011
ADR-013 (Advisory Locks) → ADR-008, ADR-009
ADR-014 (AddOn Entity) ← None
```

---

**Report Generated:** 2025-12-24
**Action Required:** Yes - 8 recommendations across 6 issues
**Estimated Total Fix Time:** ~5-6 hours
