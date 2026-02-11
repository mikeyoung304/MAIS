# Agent System Debt Cleanup Sprint

**Date:** 2026-02-11
**Branch:** `refactor/agent-debt-cleanup`
**Scope:** Tenant agent tools, internal agent routes, system prompt, slot machine
**Approach:** 10 parallelizable todos, P1s first then P2s

## Problem Statement

Three independent audits identified 44 debt items across the onboarding agent system:

- 9 P1 (breaks things or silent failures)
- 20 P2 (degrades quality, increases maintenance burden)
- 15 P3 (cosmetic, deferred)

The architecture is sound (slot machine, draft/published, T1/T2/T3 tiers) but execution
accumulated iteration residue: contradictory prompt instructions, untyped API contracts,
28x repeated boilerplate, dead code, and business logic in route handlers.

## Todos (10 total)

### P1 — Fix What's Broken

| ID   | Todo                                         | Files                                  | Est. Lines Changed |
| ---- | -------------------------------------------- | -------------------------------------- | ------------------ |
| 6001 | Fix prompt contradictions + trim bloat       | `prompts/system.ts`, tool descriptions | -150 lines         |
| 6002 | Fix refinement.ts wrong API cast             | `tools/refinement.ts`                  | ~10 lines          |
| 6003 | Add slot machine unit tests                  | New: `slot-machine.test.ts`            | +200 lines         |
| 6004 | Fix discovery tool instruction contradiction | `tools/discovery.ts`                   | ~5 lines           |

### P2 — Reduce Maintenance Burden

| ID   | Todo                                                 | Files                                        | Est. Lines Changed |
| ---- | ---------------------------------------------------- | -------------------------------------------- | ------------------ |
| 6005 | Extract shared constants                             | New: `constants/`, update tool refs          | ~15 files          |
| 6006 | Tool boilerplate reduction (wrappers + error shapes) | `utils.ts` + all 13 tools                    | -200 lines net     |
| 6007 | Delete dead code                                     | Routes, exports, phantom capabilities        | -250 lines         |
| 6008 | Extract DiscoveryService + ResearchService           | Routes → services                            | ~3 files           |
| 6009 | Fix project-management.ts patterns                   | `tools/project-management.ts`                | ~50 lines          |
| 6010 | Add typed API response schemas                       | New: `types/api-responses.ts` + tool updates | +100, -80          |

## Parallelization Strategy

### Fully Independent (run in parallel)

- 6001 (prompt) — only touches `system.ts`
- 6002 (refinement) — only touches `refinement.ts`
- 6003 (slot machine tests) — new file only
- 6004 (discovery tool) — only touches `discovery.ts` description

### Depends on 6005 (shared constants must land first)

- 6006 (tool boilerplate) — imports from new constants
- 6010 (API types) — may reference shared types

### Depends on 6007 (dead code removal)

- 6008 (service extraction) — easier after dead routes removed

### Independent

- 6009 (project-management) — isolated file

## Verification

After all todos complete:

```bash
rm -rf server/dist && npm run --workspace=server typecheck && npm run --workspace=apps/web typecheck
npm run --workspace=server test
```

## Expected Outcome

- ~500 lines removed (dead code + boilerplate collapse)
- ~300 lines added (tests + shared infrastructure)
- Net: -200 lines
- Prompt: ~30% smaller (~1,700 fewer tokens per LLM call)
- Every tool follows identical pattern (5 lines of setup, not 15)
- Every API response validated with Zod (no more `as` casts)
- Slot machine fully tested
- Zero contradictory instructions
