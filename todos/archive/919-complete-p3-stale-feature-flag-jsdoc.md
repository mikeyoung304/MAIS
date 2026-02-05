# 919 - Stale Feature Flag JSDoc in Legacy Agent Types

**Priority:** P3 (Nice-to-have)
**Status:** pending
**Source:** workflows:review commit 104ad180 (pattern-recognition)
**File:** `server/src/agent/tools/types.ts:50`

## Problem

Line 50 references "Gated by ENABLE_CONTEXT_CACHE feature flag" but `feature-flags.ts` was deleted in this commit. The entire `server/src/agent/tools/types.ts` file is itself legacy dead code (only file remaining in `server/src/agent/`).

## Fix

Either:

1. Remove the stale JSDoc comment, OR
2. Delete the entire `server/src/agent/` directory if no code imports from it (verify with grep first)
