---
status: pending
priority: p1
issue_id: "258"
tags: [code-review, architecture, contracts, tenant-dashboard]
dependencies: []
---

# Missing API Contracts for Calendar and Deposit Endpoints

## Problem Statement

Calendar and deposit tenant-admin endpoints lack ts-rest contract definitions in `@macon/contracts`, forcing developers to bypass the typed API client and use raw `fetch()` calls. This breaks the project's type-safety architecture.

**Why it matters:**
- Loss of type safety (Zod validation bypassed)
- Forces duplicate auth logic (see todo 257)
- Inconsistent with existing patterns (reminders endpoints have contracts)
- Makes API changes error-prone

## Findings

### Agent: architecture-strategist
- **Location:** `packages/contracts/src/api.v1.ts`
- **Evidence:** Missing contracts for 6 endpoints:
  1. `GET /v1/tenant-admin/calendar/status`
  2. `POST /v1/tenant-admin/calendar/config`
  3. `POST /v1/tenant-admin/calendar/test`
  4. `DELETE /v1/tenant-admin/calendar/config`
  5. `GET /v1/tenant-admin/settings/deposits`
  6. `PUT /v1/tenant-admin/settings/deposits`
- **Impact:** HIGH - Blocks proper refactoring of dashboard components

### Agent: code-quality-reviewer
- **Evidence:** Inconsistent API call patterns across components
- **Impact:** MEDIUM - Developer confusion, maintenance burden

## Proposed Solutions

### Option A: Add Full Contracts (Recommended)
**Description:** Add all 6 missing endpoint contracts with Zod schemas

**Pros:**
- Full type safety end-to-end
- Enables proper refactoring of CalendarConfigCard and DepositSettingsCard
- Consistent with existing patterns

**Cons:**
- Requires ~100-150 lines of contract code
- Need to verify backend response shapes

**Effort:** Medium (2-3 hours)
**Risk:** Low

### Option B: Add Minimal Contracts
**Description:** Add only GET endpoints, keep POST/PUT/DELETE as fetch

**Pros:**
- Faster to implement
- Covers most common use case (status checks)

**Cons:**
- Incomplete solution
- Still requires manual fetch for mutations

**Effort:** Small (1 hour)
**Risk:** Medium - partial solution

## Recommended Action

**Choose Option A** - Add full contracts for all 6 endpoints. This unblocks todo 257.

## Technical Details

### Affected Files
- `packages/contracts/src/api.v1.ts`
- `packages/contracts/src/dto.ts` (may need new schemas)

### New Schemas Needed
```typescript
// Calendar status response
CalendarStatusSchema = z.object({
  configured: z.boolean(),
  calendarId: z.string().nullable(),
});

// Calendar config request
CalendarConfigSchema = z.object({
  calendarId: z.string().min(1),
  serviceAccountJson: z.string().min(1),
});

// Deposit settings
DepositSettingsSchema = z.object({
  depositPercent: z.number().nullable(),
  balanceDueDays: z.number().int().min(1).max(90),
});
```

### Database Changes
None

## Acceptance Criteria

- [ ] `tenantAdminGetCalendarStatus` contract added
- [ ] `tenantAdminSaveCalendarConfig` contract added
- [ ] `tenantAdminTestCalendar` contract added
- [ ] `tenantAdminDeleteCalendarConfig` contract added
- [ ] `tenantAdminGetDepositSettings` contract added
- [ ] `tenantAdminUpdateDepositSettings` contract added
- [ ] All contracts have proper Zod schemas
- [ ] Backend routes implement contracts correctly
- [ ] `npm run typecheck` passes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-12-05 | Created from code review | Reference existing reminder contracts at api.v1.ts:1653-1673 |

## Resources

- **Reference:** `packages/contracts/src/api.v1.ts:1653-1673` (reminder contracts)
- **Backend Routes:** `server/src/routes/tenant-admin-calendar.routes.ts`, `server/src/routes/tenant-admin-deposits.routes.ts`
- **Blocks:** todo 257 (duplicate auth logic)
