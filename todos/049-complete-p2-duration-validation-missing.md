---
status: complete
priority: p2
issue_id: "049"
tags: [code-review, scheduling, validation, dos-prevention]
dependencies: []
---

# Missing Range Validation on Service Duration Fields

## Problem Statement

The `CreateServiceDtoSchema` validates that `durationMinutes` and `bufferMinutes` are numbers, but doesn't enforce reasonable range limits. A malicious admin could create a service with `durationMinutes: 999999`, causing slot generation to create thousands of slots or timeout.

**Why this matters:** Resource exhaustion attack vector through unreasonable service durations.

## Findings

### Code Evidence

**Location:** `packages/contracts/src/dto.ts` - CreateServiceDtoSchema

```typescript
durationMinutes: z.number().int(),  // No min/max!
bufferMinutes: z.number().int(),    // No min/max!
```

### Attack Scenario

1. Admin creates service: `{ durationMinutes: 999999, bufferMinutes: 0 }`
2. `getAvailableSlots()` generates slots for 8-hour day
3. Algorithm tries to fit 999999-minute slots into 480 minutes
4. Either: 0 slots (useless) or algorithm loops excessively

### Performance Impact

```typescript
// scheduling-availability.service.ts generateSlotsFromRules()
while (currentTime < endTime) {
  // Creates slot every durationMinutes
  // If duration = 999999, only 1 slot per 694 days
  // If duration = 1, creates 480 slots per day
}
```

## Proposed Solutions

### Option A: Add Zod Range Validation (Recommended)
**Effort:** Trivial | **Risk:** None

```typescript
// dto.ts
durationMinutes: z.number().int().min(5).max(480),  // 5 min to 8 hours
bufferMinutes: z.number().int().min(0).max(240),    // 0 to 4 hours
```

**Pros:** Simple, prevents abuse at contract level

## Technical Details

**Files to Update:**
- `packages/contracts/src/dto.ts` - CreateServiceDtoSchema, UpdateServiceDtoSchema

## Acceptance Criteria

- [ ] durationMinutes: min 5, max 480 (8 hours)
- [ ] bufferMinutes: min 0, max 240 (4 hours)
- [ ] Validation errors return 400 with clear message
- [ ] Existing services with out-of-range values flagged

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-11-27 | Created | Found during Security Sentinel review |
