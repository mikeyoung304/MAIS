# Constants Duplication Trap: Section Types Drift

**Date:** 2026-02-13
**Severity:** P1 — caused silent section filtering + build failures during onboarding
**Pattern:** Constants duplication → drift → silent runtime failures

## Problem

7 independent definitions of "what section types exist" drifted apart over time. When the agent-driven onboarding introduced `about`, `services`, and `custom` as canonical section types, only 4 of 7 locations were updated. The other 3 (contracts, server routes, frontend) still used the original 9-type list, causing:

- Agent creates sections with type `"about"` or `"services"`
- Server route validation rejects `add_section` calls with those types
- Frontend `useSectionsDraft` silently skips sections it doesn't recognize
- `build_first_draft` succeeds but the site never renders

## The 7 Locations

| Location           | File                                                        | Status                                      |
| ------------------ | ----------------------------------------------------------- | ------------------------------------------- |
| Prisma schema (DB) | `server/prisma/schema.prisma` `BlockType` enum              | Source of truth (11 types)                  |
| Prisma generated   | `server/src/generated/prisma/enums.ts`                      | Auto-generated from schema                  |
| Block type mapper  | `server/src/lib/block-type-mapper.ts`                       | Correct (12 types, includes `text` alias)   |
| Agent constants    | `server/src/agent-v2/deploy/tenant/src/constants/shared.ts` | Correct (12 types)                          |
| **Contracts**      | `packages/contracts/src/landing-page.ts`                    | **Stale** — missing about, services, custom |
| **Server routes**  | `server/src/routes/internal-agent-shared.ts`                | **Stale** — missing about, services, custom |
| **Frontend**       | `apps/web/src/lib/tenant.client.ts` `KNOWN_SECTION_TYPES`   | **Stale** — missing about, services, custom |

## The `text` vs `about` Split

Additional confusion: `text` is a legacy alias for `about`.

- Backend mapper: `ABOUT` block → `"about"` section (canonical)
- Frontend mapper: `ABOUT` block → `"text"` section (legacy)
- Frontend filter: knows `"text"`, skips `"about"`

Same DB row, different type string depending on who reads it.

## Root Cause

Each time a new section type was added (during different development phases), not all 7 locations were updated. No compile-time check catches this because the lists are independent `as const` arrays, not imports from a single source.

## Prevention Pattern

1. **Single canonical list** — Define `SECTION_TYPES` once in contracts. All consumers import.
2. **Constants sync test** — The codebase already has a sync test for agent constants. Extend it to cover all 7 locations.
3. **Kill aliases** — Remove `"text"` → use `"about"` everywhere. Legacy compatibility adds confusion, not value.

## Related

- Brain dump context injection bug (same session — `docs/solutions/patterns/TWO_PHASE_INIT_ANTIPATTERN.md`)
- Pitfall #14: Orphan imports after deletions (similar "N files out of sync" pattern)
