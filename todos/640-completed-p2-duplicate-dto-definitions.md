---
status: complete
priority: p2
issue_id: '640'
tags: [code-review, architecture, dry, contracts]
dependencies: []
---

# Duplicated DTO Definitions Instead of Importing from Contracts

## Problem Statement

The new scheduling pages define local `interface` types that duplicate Zod schemas already defined in `@macon/contracts`. This violates the DRY principle and creates type drift risk.

## Findings

**Source:** Architecture Strategist review of Legacy-to-Next.js Migration

**Locations with duplicate types:**

- `apps/web/src/app/(protected)/tenant/scheduling/appointment-types/page.tsx` (lines 20-47)
- `apps/web/src/app/(protected)/tenant/scheduling/availability/page.tsx` (lines 14-32)
- `apps/web/src/app/(protected)/tenant/scheduling/appointments/page.tsx` (lines 15-65)

**Types that should be imported from `@macon/contracts`:**

- `ServiceDto` / `ServiceDtoSchema`
- `AvailabilityRuleDto` / `AvailabilityRuleDtoSchema`
- `AppointmentDto` / `AppointmentDtoSchema`
- `CustomerDto` / `CustomerDtoSchema`

**Impact:**

- Type drift risk - if contract changes, UI types will be stale
- Violates ADR-016: "Use canonical names from contracts package"
- Inconsistent with patterns in `apps/web/src/components/build-mode/`

## Proposed Solutions

### Option A: Import types from contracts (Recommended)

**Pros:** Single source of truth, DRY, type-safe
**Cons:** May need to infer types from Zod schemas
**Effort:** Medium
**Risk:** Low

```typescript
import type { ServiceDto, AvailabilityRuleDto } from '@macon/contracts';
```

### Option B: Export inferred types from contracts

**Pros:** Better developer experience
**Cons:** Requires updating contracts package
**Effort:** Medium
**Risk:** Low

## Recommended Action

Option A - Import types directly from contracts.

## Technical Details

### Affected Files

- `apps/web/src/app/(protected)/tenant/scheduling/appointment-types/page.tsx`
- `apps/web/src/app/(protected)/tenant/scheduling/availability/page.tsx`
- `apps/web/src/app/(protected)/tenant/scheduling/appointments/page.tsx`
- `apps/web/src/components/scheduling/AvailabilityRulesList.tsx`
- `apps/web/src/components/scheduling/AvailabilityRuleForm.tsx`

### Contracts Location

`packages/contracts/src/dto.ts` (lines 735-916)

## Acceptance Criteria

- [x] All scheduling pages import types from `@macon/contracts`
- [x] No local interface definitions that duplicate contract types
- [x] TypeScript still compiles successfully

## Work Log

| Date       | Action                   | Learnings                                               |
| ---------- | ------------------------ | ------------------------------------------------------- |
| 2026-01-05 | Created from code review | Use contracts for all DTO types                         |
| 2026-01-05 | Completed implementation | Replaced local interfaces with @macon/contracts imports |

## Resources

- ADR-016: Field naming conventions
- `packages/contracts/src/dto.ts`
