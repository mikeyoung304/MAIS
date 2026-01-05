---
status: resolved
priority: p3
issue_id: 626
tags: [code-review, booking-links, phase-1, validation]
dependencies: []
created: 2026-01-05
---

# Timezone Field Lacks IANA Format Validation

## Problem Statement

The timezone field on both Tenant and Service models accepts any string value without validation against IANA timezone database. While the scheduling service handles invalid timezones gracefully (falls back to UTC), validation should happen at input time to catch errors early.

## Findings

**Source:** security-sentinel, data-integrity-guardian

**Evidence:**
- `packages/contracts/src/schemas/booking-link.schema.ts:223` - `timezone: z.string().optional()`
- `packages/contracts/src/dto.ts:747` - `timezone: z.string().default('America/New_York')`
- Only validated as a string with no format validation
- `scheduling-availability.service.ts` falls back to UTC with warning log on invalid timezone

**Risk:**
- Invalid timezones stored (e.g., "NotATimezone")
- Errors surface at runtime during slot generation rather than at input time
- Poor developer experience

## Proposed Solutions

### Option 1: Add Zod refinement for IANA validation

**Pros:** Catches errors at input validation, no runtime surprises
**Cons:** Adds validation overhead, may need to enumerate common timezones
**Effort:** Small
**Risk:** Very low

```typescript
const IANATimezone = z.string().refine(
  (tz) => {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  },
  { message: 'Invalid IANA timezone identifier' }
);
```

### Option 2: Keep current behavior (runtime fallback)

**Pros:** Already works, graceful degradation
**Cons:** Errors not caught early, potential confusion
**Effort:** None
**Risk:** Low

## Recommended Action

**Option 1** - Add validation. It's a small change with immediate benefit.

## Technical Details

**Affected Files:**
- `packages/contracts/src/schemas/booking-link.schema.ts`
- `packages/contracts/src/dto.ts`

## Acceptance Criteria

- [ ] Timezone validated against IANA format in Zod schema
- [ ] Clear error message when invalid timezone provided
- [ ] Unit test for timezone validation

## Work Log

| Date       | Action                           | Learnings                                    |
| ---------- | -------------------------------- | -------------------------------------------- |
| 2026-01-05 | Created during Phase 1 code review | Multiple reviewers noted validation gap |

## Resources

- IANA Timezone Database: https://www.iana.org/time-zones
- Intl.DateTimeFormat validation approach
