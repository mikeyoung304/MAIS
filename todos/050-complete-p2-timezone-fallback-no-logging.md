---
status: complete
priority: p2
issue_id: '050'
tags: [code-review, scheduling, logging, debugging]
dependencies: []
---

# Timezone Conversion Fallback Silently Drops to UTC

## Problem Statement

The `createDateInTimezone()` method catches timezone conversion errors and silently falls back to UTC without logging. If an admin enters an invalid timezone string, all availability calculations will be wrong without any warning.

**Why this matters:** Silent data corruption - customers see slots in wrong timezone, book appointments that don't align with actual availability.

## Findings

### Code Evidence

**Location:** `server/src/services/scheduling-availability.service.ts:372-375`

```typescript
} catch (error) {
  // Fallback: treat as UTC if timezone conversion fails
  return new Date(Date.UTC(year, month, day, hour, minute, 0));
}
```

### Impact Scenario

1. Admin sets service timezone to "America/New_Yrok" (typo)
2. `Intl.DateTimeFormat` throws error
3. Service silently uses UTC
4. Customer in New York sees 9:00 AM slot, actually 4:00 AM local time
5. Customer books, arrives at wrong time
6. No logs indicate the problem

## Proposed Solutions

### Option A: Add Error Logging (Recommended)

**Effort:** Trivial | **Risk:** None

```typescript
} catch (error) {
  logger.error({
    timezone,
    year, month, day, hour, minute,
    error: error instanceof Error ? error.message : String(error),
  }, 'Timezone conversion failed, falling back to UTC');
  return new Date(Date.UTC(year, month, day, hour, minute, 0));
}
```

### Option B: Fail Fast

**Effort:** Small | **Risk:** Low

Throw error instead of silent fallback:

```typescript
} catch (error) {
  throw new InvalidTimezoneError(`Invalid timezone: ${timezone}`);
}
```

## Recommended Action

Implement **Option A** immediately (logging), then consider **Option B** for service creation validation.

## Technical Details

**Files to Update:**

- `server/src/services/scheduling-availability.service.ts:372-375`

## Acceptance Criteria

- [ ] Timezone conversion errors logged with full context
- [ ] Log level: ERROR (not warning)
- [ ] Log includes: timezone string, target date/time, error message
- [ ] Consider: Validate timezone on service creation (prevent invalid entry)

## Work Log

| Date       | Action  | Notes                                 |
| ---------- | ------- | ------------------------------------- |
| 2025-11-27 | Created | Found during Security Sentinel review |
