---
status: pending
priority: p2
issue_id: '621'
tags: [code-review, analytics, landing-page]
dependencies: []
---

# Mountain Demo: Missing Analytics Events

## Problem Statement

The spec defines 8 analytics events to measure the game's conversion impact. The implementation has **zero** analytics calls.

## Findings

### Required Events (from spec lines 224-235):

| Event                               | Purpose                  | Implemented |
| ----------------------------------- | ------------------------ | ----------- |
| `mountain_demo_viewed`              | Section ≥50% in viewport | ❌          |
| `mountain_demo_play_clicked`        | User started game        | ❌          |
| `mountain_demo_diy_attempts`        | Count of DIY attempts    | ❌          |
| `mountain_demo_fail_reason`         | hits/collapse/timeout    | ❌          |
| `mountain_demo_get_handled_clicked` | CTA conversion           | ❌          |
| `mountain_demo_success_reached`     | Game completion          | ❌          |
| `mountain_demo_cta_clicked`         | Final signup click       | ❌          |
| `mountain_demo_skipped`             | User skipped game        | ❌          |

### Why This Matters:

- **Primary KPI:** CTA click-through uplift
- **Secondary KPIs:** Interaction rate, completion rate, downstream signup conversion
- Without analytics, we can't measure if the game is helping or hurting conversion

## Proposed Solutions

### Option A: Full Analytics Integration

**Effort:** Medium (1 hour)
**Risk:** Low

Add tracking calls at each state transition:

```typescript
// Example using existing analytics pattern
import { track } from '@/lib/analytics'; // or whatever your analytics util is

// In startGame:
track('mountain_demo_play_clicked');

// In fail handler:
track('mountain_demo_fail_reason', { reason: 'timeout', attempts: attemptCount });

// In startHandled:
track('mountain_demo_get_handled_clicked');
```

### Option B: Minimal Tracking

**Effort:** Small (30 min)
**Risk:** Low

Track only the key conversion events:

- `mountain_demo_play_clicked`
- `mountain_demo_get_handled_clicked`
- `mountain_demo_cta_clicked`

## Technical Details

**Affected file:** `apps/web/src/components/home/MountainDemo.tsx`

**Integration points:**

- `startGame()` — play clicked
- Fail transition — fail reason
- `startHandled()` — get handled clicked
- Success overlay CTA — final conversion

## Acceptance Criteria

- [ ] At minimum: play, get_handled, and cta_clicked events tracked
- [ ] Ideally: all 8 spec events implemented
- [ ] Events include relevant metadata (attempts, fail reason, etc.)

## Work Log

| Date       | Action                   | Learnings                                       |
| ---------- | ------------------------ | ----------------------------------------------- |
| 2026-01-04 | Created from code review | Zero analytics in conversion-critical component |
