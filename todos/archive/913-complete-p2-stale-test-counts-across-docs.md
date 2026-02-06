# 913 - Stale Test Counts Across Documentation

**Priority:** P2 (Important)
**Status:** pending
**Source:** workflows:review commit 104ad180 (code-philosopher)
**Files:** `ARCHITECTURE.md:20-23`, `README.md:108,792,804`

## Problem

Test counts are inconsistent across documentation:

- **ARCHITECTURE.md:20** says "771 server tests passing"
- **README.md:108,792,804** says "1196/1200 tests passing (99.7%)" (from Sprint 10, Nov 2025)
- **TESTING.md** says "~1700 tests" (updated in this commit)
- **CLAUDE.md** says "~1700" (correct)

Additionally, ARCHITECTURE.md:22 says "114 E2E tests (22 passing post-migration)" which is from Dec 2025 and clearly outdated.

## Fix

Run `npm test` and `npm run test:e2e` to get actual counts, then update all four files to match TESTING.md's ~1700 figure. Consider using "~1700+" as a single source that won't go stale immediately.
