---
title: Dual-System Migration Drift - Quick Reference
date: 2026-02-04
format: quick-reference
---

# Dual-System Migration Drift - Quick Reference

**Print and pin next to monitor**

---

## The Pattern

```
OLD System ← Users here (broken)     NEW System ← Features here (unused)
    │                                      │
    └── "During migration" for months ─────┘

Result: P0 bug when users need NEW features
```

---

## 5 Detection Signals

| Signal                | How to Detect                           | Action                                 |
| --------------------- | --------------------------------------- | -------------------------------------- |
| 1. Stale comments     | `grep "during migration"` > 30 days old | Complete or document                   |
| 2. Fake session IDs   | `tenant-${id}-${Date.now()}` pattern    | Must call ADK createSession()          |
| 3. Missing context    | Session created with only `{tenantId}`  | Add forbiddenSlots from ContextBuilder |
| 4. OLD at 100% usage  | Metrics show NEW system never called    | Wire up frontend to NEW system         |
| 5. Feature parity gap | NEW has features OLD lacks              | Prioritize migration completion        |

---

## Comment Format (REQUIRED)

```typescript
// WRONG
// during migration
// TODO: update later
// temporary

// CORRECT
// MIGRATION[session-context]: expires 2026-03-01: Legacy until frontend updated
```

---

## Session Testing Rule

```
CRITICAL: Fake sessions pass single-message tests!

Test with 1 message: PASSES (fake ID returned)
Test with 2 messages: FAILS ("Session not found")

ALWAYS send 2+ messages in E2E tests
```

---

## Migration Timeline

| Phase   | Duration  | Deliverable                          |
| ------- | --------- | ------------------------------------ |
| Plan    | 1-2 days  | Feature parity matrix, migration doc |
| Build   | 1-2 weeks | NEW system with tests                |
| Connect | 1-3 days  | Wire frontend to NEW system          |
| Verify  | 1 week    | 100% traffic on NEW, 0% on OLD       |
| Delete  | 1 day     | Remove OLD code, update docs         |

**Max total: 30 days** - Anything longer = tech debt compounding

---

## Code Review Blocks

| Pattern                             | Why Block                          |
| ----------------------------------- | ---------------------------------- |
| `sessionId = \`...-${Date.now()}\`` | Fake session, fails on 2nd message |
| `{ state: { tenantId } }` only      | Missing context injection          |
| `// during migration` no date       | Becomes permanent debt             |
| Two systems, no timeline            | Will drift, cause P0               |

---

## Completion Checklist

```
[ ] NEW system at 100% traffic
[ ] OLD system code DELETED
[ ] No migration comments remain
[ ] E2E test sends 2+ messages
[ ] Documentation updated
```

---

## Related Docs

- Full prevention: `DUAL_SYSTEM_MIGRATION_DRIFT_PREVENTION.md`
- Slot policy: `SLOT_POLICY_CONTEXT_INJECTION_PATTERN.md`
- Service wiring: `SERVICE_WIRING_AND_FAKE_SESSION_PREVENTION.md`
