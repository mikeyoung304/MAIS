---
status: complete
priority: p3
issue_id: "162"
tags: [code-review, quality, mvp-gaps, refactoring]
dependencies: []
---

# Extract Utility Functions from BookingDetailsCard

## Problem Statement

BookingDetailsCard.tsx has 4 inline utility functions that could be reusable.

**Why This Matters:**
- 55 lines in component file
- Not reusable in other booking components
- Code organization

## Findings

**Location:** `client/src/pages/booking-management/BookingDetailsCard.tsx:18-72`

**Inline utilities:**
- `formatMoney()` (lines 18-23)
- `formatDate()` (lines 28-36)
- `getStatusVariant()` (lines 41-52)
- `getRefundStatusText()` (lines 57-72)

## Proposed Solutions

Move to shared utilities: `lib/formatters.ts`

## Acceptance Criteria

- [ ] Utilities moved to shared location
- [ ] Imported by BookingDetailsCard
- [ ] Available for other components
