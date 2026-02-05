# 927 - navigation.ts Stale Pitfall #30 References (Now #26)

**Priority:** P2 (Important)
**Status:** pending
**Source:** workflows:review commit 104ad180 (pattern-recognition)
**File:** `apps/web/src/lib/build-mode/navigation.ts` lines 31, 36, 54

## Problem

Three comments in active production code reference "Pitfall #30" (cache invalidation race condition). The CLAUDE.md pitfall renumbering in this commit shifted that pitfall from #30 to #26. The source code comments were not updated.

## Fix

Replace all 3 occurrences of "Pitfall #30" with "Pitfall #26" in `navigation.ts`.

## Prevention

Consider switching from numbered pitfall references to named anchors (e.g., `Pitfall:cache-invalidation-race`) to prevent this class of drift when pitfalls are renumbered.
