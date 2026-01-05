---
status: pending
priority: p3
issue_id: 621
tags: [code-review, architecture, booking-links, schema]
dependencies: []
created: 2026-01-05
---

# Schema Fields Not in Database: minNoticeMinutes, maxAdvanceDays, maxPerDay

## Problem Statement

The Zod schemas and tool inputs accept `minNoticeMinutes`, `maxAdvanceDays`, and `maxPerDay` fields, but the Prisma `Service` model does not have these columns. These fields are silently dropped when creating/updating services, creating a facade of functionality that doesn't actually work.

## Findings

**Source:** architecture-strategist, code-simplicity-reviewer

**Evidence:**

Contracts package defines these fields:
```typescript
// booking-link.schema.ts:86-88
minNoticeMinutes: z.number().int().nonnegative().default(120), // 2 hours default
maxAdvanceDays: z.number().int().positive().max(365).default(60),
maxPerDay: z.number().int().positive().optional(), // Optional daily limit
```

Executor acknowledges the gap:
```typescript
// booking-link-executors.ts:155-156
// Note: minNoticeMinutes and maxAdvanceDays require schema migration (Phase 1)
```

The `listBookableServicesTool` returns hardcoded defaults:
```typescript
// booking-link-tools.ts:429-431
minNoticeMinutes: 120, // Default, should be stored in DB
maxAdvanceDays: 60, // Default, should be stored in DB
maxPerDay: null,
```

**Risk:** Users/agents can request specific values that are accepted but never persisted. The tool appears to work but the settings are always ignored.

## Proposed Solutions

### Option 1: Add fields in Phase 1 migration (Current Plan)

**Pros:** Already planned, no immediate code changes
**Cons:** Facade of functionality in Phase 0
**Effort:** Part of Phase 1 scope
**Risk:** Very low

### Option 2: Remove fields from Phase 0 schemas (YAGNI)

**Pros:** Honest API - only exposes what works
**Cons:** Breaking change if agents already reference these fields
**Effort:** Small
**Risk:** Low

```typescript
// Remove from ManageBookableServiceInputSchema until Phase 1
// Return only actual stored values in list response
```

### Option 3: Add validation warning when fields provided

**Pros:** Transparent about current limitations
**Cons:** Adds complexity
**Effort:** Small
**Risk:** Very low

## Recommended Action

**TRIAGE RESULT: FIX BEFORE PRODUCTION** (Unanimous 3/3 votes)

**Reviewers:** security-sentinel, architecture-strategist, data-integrity-guardian

**Decision:** Add schema migration in Phase 1, OR remove fields from tool input until then. Current behavior silently drops user data.

**Implementation:** Option 1 - Add fields in Phase 1 migration (already planned)

## Technical Details

**Affected Files:**
- `packages/contracts/src/schemas/booking-link.schema.ts`
- `server/src/agent/tools/booking-link-tools.ts`
- `server/src/agent/executors/booking-link-executors.ts`
- `server/prisma/schema.prisma` (Phase 1: add columns to Service model)

**Required Schema Migration (Phase 1):**
```prisma
model Service {
  // ... existing fields
  minNoticeMinutes Int @default(120)  // NEW
  maxAdvanceDays   Int @default(60)   // NEW
  maxPerDay        Int?               // NEW (nullable for unlimited)
}
```

## Acceptance Criteria

For Phase 0 (if Option 2):
- [ ] Remove unsupported fields from input schemas
- [ ] Don't return fake default values in list response

For Phase 1:
- [ ] Schema migration adds columns
- [ ] Executor saves these fields
- [ ] List tool returns actual stored values

## Work Log

| Date       | Action                           | Learnings                                    |
| ---------- | -------------------------------- | -------------------------------------------- |
| 2026-01-05 | Created during /workflows:review | Identified by architecture-strategist and code-simplicity-reviewer agents |

## Resources

- PR: Booking Links Phase 0 - commit 1bd733c9
- Phase 1 plan: `plans/calendly-style-booking-links.md`
