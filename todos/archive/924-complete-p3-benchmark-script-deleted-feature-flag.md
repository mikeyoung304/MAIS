# 924 - Benchmark Script References Deleted Feature Flag

**Priority:** P3 (Nice-to-have)
**Status:** pending
**Source:** workflows:review commit 104ad180 (pattern-recognition)
**File:** `server/scripts/benchmark-build-mode.ts`

## Problem

The script references the `ENABLE_CONTEXT_CACHE` environment variable from the deleted `feature-flags.ts` module. May need updating or removal if the benchmark is no longer relevant.

## Fix

Check if the benchmark script is still used. If so, update the env var reference. If not, delete the script.
