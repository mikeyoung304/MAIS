---
status: ready
priority: p1
issue_id: '396'
tags:
  - data-integrity
  - booking
  - code-review
dependencies: []
---

# Package Slug Mismatch - Booking Links Lead to "Package Not Found"

## Problem Statement

Tenant landing pages display packages with slugs (e.g., `basic-elopement`, `micro-ceremony`) that don't exist in the database. Clicking "Book" leads to a "Package Not Found" error page.

## Findings

**Found by:** Visual Playwright inspection

**Test URL:** `http://localhost:3000/t/little-bit-farm`

**Expected behavior:** Click "Book Basic Elopement" → Opens booking wizard for that package
**Actual behavior:** Click "Book Basic Elopement" → Shows "Package Not Found" error

**Root cause:** The landing page content comes from tenant's `landingPageContent` JSON field which contains package display data with slugs like:

- `basic-elopement`
- `micro-ceremony`
- `garden-romance`
- `luxury-escape`

But the actual packages in the database (from `demo.ts` seed) have different slugs:

- `starter`
- `growth`
- `enterprise`

**Source of mismatch:**

- Mock data in `server/src/adapters/mock/index.ts` has wedding packages
- Demo seed in `server/prisma/seeds/demo.ts` has business packages
- Landing page content was created with mock package slugs

## Proposed Solutions

### Option 1: Update landing page content to match real packages (Recommended)

- Query actual packages from database when generating landing page
- Or update landingPageContent to reference real package slugs

**Pros:** Data consistency, proper separation
**Cons:** May need to update existing tenants
**Effort:** Medium
**Risk:** Low

### Option 2: Add migration script

- Create script to update all tenant landingPageContent to match their actual packages
- Run as one-time data migration

**Pros:** Fixes existing data
**Cons:** One-time fix, root cause remains
**Effort:** Medium
**Risk:** Medium

### Option 3: Validate package slugs on landing page render

- Check if package slugs in landingPageContent exist
- Filter out or mark invalid packages

**Pros:** Graceful degradation
**Cons:** Masks data inconsistency
**Effort:** Small
**Risk:** Low

## Recommended Action

Option 1 + Option 2 - Fix root cause and migrate existing data.

## Technical Details

**Files to investigate:**

- `server/prisma/seeds/demo.ts` - Actual package slugs seeded
- `server/src/adapters/mock/index.ts` - Mock package slugs
- `apps/web/src/app/t/[slug]/(site)/TenantLandingPage.tsx` - Renders packages
- Tenant `landingPageContent` JSON field

**Package slug comparison:**

| Landing Page Shows | Database Has |
| ------------------ | ------------ |
| basic-elopement    | starter      |
| micro-ceremony     | growth       |
| garden-romance     | enterprise   |
| luxury-escape      | (none)       |

## Acceptance Criteria

- [ ] Clicking package "Book" button opens booking wizard
- [ ] Package slugs in landing page match database packages
- [ ] No "Package Not Found" errors for displayed packages
- [ ] E2E test confirms booking flow works

## Work Log

| Date       | Action                                | Learnings                                    |
| ---------- | ------------------------------------- | -------------------------------------------- |
| 2025-12-25 | Created from Playwright testing       | Data mismatch between mock and real adapters |
| 2025-12-25 | **Approved for work** - Status: ready | P1 - Core booking broken                     |

## Resources

- Playwright screenshot: `.playwright-mcp/tenant-landing-page.png`
- Mock data: `server/src/adapters/mock/index.ts`
- Demo seed: `server/prisma/seeds/demo.ts`
