---
status: pending
priority: p2
issue_id: '619'
tags: [code-review, game, ux]
dependencies: ['617']
---

# Mountain Demo: Game Balance Issues

## Problem Statement

Several game parameters deviate from the spec, affecting the intended experience.

## Findings

### 1. Timeout Too Long

- **Current:** `FAIL_TIMEOUT = 25000` (25 seconds)
- **Spec:** 15-18 seconds
- **Impact:** Players wait too long on flat ground doing nothing

### 2. Missing Fail Conditions

Spec requires 3 fail triggers:
| Condition | Spec | Implementation |
|-----------|------|----------------|
| 3 boulder hits | ✓ Required | ❌ Missing |
| 75% progress collapse | ✓ Required | ❌ Missing |
| 15-18s timeout | ✓ Required | ⚠️ Wrong (25s) |

### 3. No Idle Preview Animation

- **Spec:** "Subtle loop: player takes a few steps, sees mountain, boulder rolls by"
- **Current:** Static canvas in idle state

### 4. Extra State in State Machine

- **Spec:** 4 states: `idle | diy | handled | success`
- **Current:** 5 states: adds `fail`
- **Impact:** Spec says "no Game Over" — fail should be a transition overlay, not terminal state

## Proposed Solutions

### Option A: Full Spec Compliance

**Effort:** Medium (1-2 hours)
**Risk:** Low

1. Change `FAIL_TIMEOUT` to 16000 (16 seconds, middle of spec range)
2. Add `hitCount` to game state, fail at 3
3. Add progress tracking, trigger collapse at 75%
4. Add idle preview animation loop
5. Merge `fail` into transition (show CTA overlay without separate phase)

### Option B: Simplified Balance

**Effort:** Small (30 min)
**Risk:** Low

1. Fix timeout to 16 seconds
2. Skip hit counter and collapse (depend on todo-617 for challenge)
3. Skip idle preview (static is acceptable)

## Technical Details

**Affected file:** `apps/web/src/components/home/MountainDemo.tsx`

**Constants to change:**

```typescript
const FAIL_TIMEOUT = 16000; // Was 25000
```

**State to add (if implementing hit counter):**

```typescript
interface GameState {
  // ... existing
  hitCount: number;
  progress: number; // 0-1 for collapse tracking
}
```

## Acceptance Criteria

- [ ] Timeout is 15-18 seconds
- [ ] (Optional) 3 boulder hits triggers fail
- [ ] (Optional) 75% progress triggers collapse
- [ ] (Optional) Idle state shows subtle preview animation

## Work Log

| Date       | Action                   | Learnings                       |
| ---------- | ------------------------ | ------------------------------- |
| 2026-01-04 | Created from code review | Balance parameters all off-spec |
