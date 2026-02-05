---
status: complete
priority: p2
issue_id: 904
tags: [docs-audit, claude-md, multi-agent-review]
dependencies: []
---

# CLAUDE.md Contains Multiple Stale References

## Problem Statement

CLAUDE.md is the most-read file in the codebase — every AI agent session starts by reading it. Multiple entries reference deleted systems, wrong counts, and patterns that no longer exist.

**Why it matters:**

- Every AI agent inherits these false assumptions at the start of every session
- Wrong tool counts cause agents to look for tools that don't exist
- References to deleted archive directory waste agent time

## Findings

**From Architecture Strategist and Conflicting Docs agents:**

### Stale Items in CLAUDE.md

1. **Agent tool count**: Says tenant-agent has 24 tools, actually has 34
2. ~~**Archive directory**: References `server/src/agent-v2/archive/` — doesn't exist~~ (RESOLVED in todo #902)
3. **7 retired pitfalls** (#12, #20, #25, #26, #56, #57, #92): Marked with `_Retired_` but still take up space and cognitive load
4. **Line 78**: References `normalizeToPages()` in `apps/web/src/lib/tenant.ts` — may be stale
5. **Pitfalls 56-57**: Retired but still listed (wrapper format and data format pitfalls)
6. **ARCHITECTURE.md reference in subsystem table**: Links to stale agent content
7. **Test count inconsistency**: Different docs say 44 / 771 / 1196 / 1798 / 2051 tests

### Stale Items in TESTING.md

- Lines 12-13: "44 unit tests passing" — reality is ~2051

### Stale Items in SECURITY.md

- Session expiry: Says 24h but code uses 7d
- Missing INTERNAL_API_SECRET and AUTH_SECRET from secrets list

## Recommended Fix

1. Update tenant-agent tool count: 24 → 34
2. Remove archive directory references
3. Remove or collapse retired pitfall entries (#12, #20, #25, #26, #56, #57, #92)
4. Audit normalizeToPages reference — update or remove
5. Establish a single source of truth for test count
6. Update TESTING.md test count
7. Update SECURITY.md session expiry and secrets list

## Sources

- Architecture Strategist: 12 outdated/wrong items
- Conflicting Docs Agent: Conflicts 11, 13, 14
- Security Sentinel: Session expiry and secrets findings
