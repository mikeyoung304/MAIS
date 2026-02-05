# 925 - ENVIRONMENT.md Missing AUTH_SECRET Documentation

**Priority:** P3 (Nice-to-have)
**Status:** pending
**Source:** workflows:review commit 104ad180 (data-integrity-guardian)
**File:** `docs/setup/ENVIRONMENT.md`

## Problem

`AUTH_SECRET` / `NEXTAUTH_SECRET` was added to SECURITY.md in this commit but is not documented in ENVIRONMENT.md. The code at `apps/web/src/lib/auth.ts:84` accepts either name (`process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET`), but a new developer reading ENVIRONMENT.md wouldn't know about it.

Additionally, there's a naming discrepancy: SECURITY.md uses `AUTH_SECRET` while `apps/web/.env.example` uses `NEXTAUTH_SECRET`.

## Fix

Add `AUTH_SECRET` (with `NEXTAUTH_SECRET` alias note) to ENVIRONMENT.md under the web app section.
