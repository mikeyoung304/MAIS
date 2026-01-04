---
status: pending
priority: p1
issue_id: '618'
tags: [code-review, game, bug]
dependencies: ['617']
---

# Mountain Demo: DIY Win Condition Bug

## Problem Statement

The DIY mode win condition can **never be triggered** due to a logic error. The condition requires the player to be above `GROUND_Y - 100` (y < 240), but the player walks on ground at `GROUND_Y - PLAYER_HEIGHT` (y = 295) and can only jump to ~250px. The player can never reach y < 240.

**Why it matters:** While the spec says DIY should be "effectively not winnable," it should be due to overwhelming obstacles, not a broken win check.

## Findings

### From Pattern Recognition Agent:

```typescript
// MountainDemo.tsx lines 476-480
const successScreenX = game.successPlatformX - game.worldOffset;
if (game.player.x > successScreenX && game.player.y < GROUND_Y - 100) {
  game.phase = 'success';
}
```

**Analysis:**

- `GROUND_Y = 340`
- Win requires `player.y < 240`
- Player ground position: `GROUND_Y - PLAYER_HEIGHT = 340 - 45 = 295`
- Jump apex: ~250px (with `JUMP_VELOCITY = -12` and `GRAVITY = 0.6`)
- **250 > 240, so win is impossible**

### From Architecture Agent:

> "The spec says DIY should be 'effectively not winnable' — but not because of a broken win condition. It should be not winnable because the obstacles are overwhelming."

## Proposed Solutions

### Option A: Fix Win Condition Logic (Recommended)

**Effort:** Small (15 min)
**Risk:** Low

Change win condition to check platform collision instead of arbitrary Y position:

```typescript
// Check if player reached success platform
const successScreenX = game.successPlatformX - game.worldOffset;
const onSuccessPlatform =
  game.player.isGrounded && game.player.x > successScreenX && game.player.x < successScreenX + 120; // platform width

if (onSuccessPlatform) {
  game.phase = 'success';
}
```

**Pros:** Logical win condition
**Cons:** Still winnable if no obstacles (see todo-617)

### Option B: Remove DIY Win Condition

**Effort:** Small (10 min)
**Risk:** Medium — changes game flow

Remove win check from DIY mode entirely. DIY always leads to fail → "Get Handled" CTA.

**Pros:** Matches "not winnable" spec intent
**Cons:** Players may feel cheated if they realize there's no way to win

## Recommended Action

[To be filled during triage]

## Technical Details

**Affected file:** `apps/web/src/components/home/MountainDemo.tsx`
**Lines:** 476-480

## Acceptance Criteria

- [ ] DIY win condition uses platform collision, not arbitrary Y check
- [ ] OR DIY mode has no win path (always leads to fail/handled)
- [ ] Win condition is consistent with game design intent

## Work Log

| Date       | Action                   | Learnings                         |
| ---------- | ------------------------ | --------------------------------- |
| 2026-01-04 | Created from code review | Win condition math doesn't add up |

## Resources

- Related: `todos/617-pending-p1-mountain-demo-no-gameplay.md`
