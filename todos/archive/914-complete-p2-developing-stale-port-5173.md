# 914 - DEVELOPING.md Stale Port 5173 References

**Priority:** P2 (Important)
**Status:** pending
**Source:** workflows:review commit 104ad180 (architecture-strategist)
**File:** `DEVELOPING.md:351,368-369`

## Problem

Three Vite-era port 5173 references remain in the "Env presets" section:

- Line 351: `CORS_ORIGIN=http://localhost:5173`
- Line 368: `STRIPE_SUCCESS_URL=http://localhost:5173/success`
- Line 369: `STRIPE_CANCEL_URL=http://localhost:5173`

The commit message for #907 says "fix port 5173->3000" but these three were missed. The rest of the file correctly uses 3000.

## Fix

Replace all three instances of `localhost:5173` with `localhost:3000`.
