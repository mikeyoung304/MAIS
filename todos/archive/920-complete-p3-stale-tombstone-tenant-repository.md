# 920 - Stale Tombstone Comment in Tenant Repository

**Priority:** P3 (Nice-to-have)
**Status:** pending
**Source:** workflows:review commit 104ad180 (pattern-recognition)
**File:** `server/src/adapters/prisma/tenant.repository.ts:43`

## Problem

A `// DELETED:` tombstone comment remains. The commit cleaned up tombstones from `di.ts` and `routes/index.ts` but missed this one.

## Fix

Remove the tombstone comment.
