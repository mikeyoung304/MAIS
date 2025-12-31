---
status: complete
priority: p3
issue_id: '403'
tags:
  - code-quality
  - cleanup
  - code-review
dependencies: []
---

# Various Code Quality Issues

## Problem Statement

Multiple minor code quality issues identified across the codebase that don't block functionality but should be addressed for maintainability.

## Findings

**Found by:** Code Quality Reviewer + other agents

### 1. Duplicated Tenant Auth Guard Pattern

**Location:** All tenant-admin route files (68 occurrences)

```typescript
// Repeated 68 times
const tenantAuth = res.locals.tenantAuth;
if (!tenantAuth) {
  res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
  return;
}
```

**Recommendation:** Extract to reusable helper function.

### 2. Unused Import in ContactForm

**Location:** `apps/web/src/app/t/[slug]/(site)/contact/ContactForm.tsx:3`

`useMemo` is imported but never used.

### 3. Active TODOs in Production Code

| Location                                              | TODO     | Description                            |
| ----------------------------------------------------- | -------- | -------------------------------------- |
| `server/src/app.ts:63`                                | CSP      | unsafe-inline needs nonce replacement  |
| `server/src/app.ts:157`                               | TODO-273 | Rate limiting before parsing for DoS   |
| `apps/web/src/lib/tenant.ts:144`                      | TODO     | Domain lookup endpoint not implemented |
| `server/src/routes/public-date-booking.routes.ts:112` | TODO-330 | Honeypot bot protection                |

### 4. Console.log Remnants

**Location:** `client/src/lib/sentry.ts:88`

```typescript
console.log('Sentry initialized for client');
```

### 5. Inconsistent getErrorMessage() Usage

Multiple catch blocks don't use the `getErrorMessage()` utility and access error properties unsafely.

### 6. Duplicate main-content ID

**Locations:**

- `apps/web/src/app/layout.tsx` - `<main id="main-content">`
- Tenant pages also use this ID on inner divs

Creates duplicate IDs (invalid HTML).

### 7. OpenGraph Images Missing

All tenant pages return `images: []` for OpenGraph, impacting social sharing.

## Proposed Solutions

### Option 1: Address incrementally (Recommended)

- Fix high-impact items first (auth guard, TODOs)
- Address style issues in regular code reviews

**Pros:** Manageable, prioritized
**Cons:** Takes time
**Effort:** Varies
**Risk:** Low

## Technical Details

**Files affected:**

- Multiple tenant-admin route files (auth guard)
- `apps/web/src/app/t/[slug]/(site)/contact/ContactForm.tsx` (unused import)
- Various files with TODOs
- `client/src/lib/sentry.ts` (console.log)

## Acceptance Criteria

- [ ] Auth guard helper function created and used
- [ ] Unused imports removed
- [ ] Console.log replaced with logger
- [ ] TODOs converted to tracked issues or addressed
- [ ] Duplicate IDs resolved

## Work Log

| Date       | Action                                | Learnings                                 |
| ---------- | ------------------------------------- | ----------------------------------------- |
| 2025-12-25 | Created from code quality review      | Multiple small issues add up to tech debt |
| 2025-12-25 | **Approved for work** - Status: ready | P3 - Incremental cleanup                  |

## Resources

- Code Quality Reviewer report
