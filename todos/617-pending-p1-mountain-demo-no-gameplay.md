---
status: pending
priority: p1
issue_id: '617'
tags: [code-review, game, landing-page, ux]
dependencies: []
---

# Mountain Demo: Core Gameplay Missing

## Problem Statement

The Mountain Demo game has **no actual gameplay**. The spec describes a 20-45 second emotionally resonant experience where DIY mode feels "Sisyphean" and "Get Handled" provides relief. The current implementation is just auto-scrolling on flat ground until a 25-second timeout.

**Why it matters:** This is the centerpiece demo meant to convert visitors. Without the intended experience, it's a waste of screen real estate.

## Findings

### From Pattern Recognition Agent:

- `createMountain()` creates ONE platform (the success platform) — no mountain exists
- `MOUNTAIN_LABELS` array defined but **never used**
- `shuffle()` function defined but **never called**
- Zero boulders/hazards in the entire codebase
- No crumbling platforms
- No knockback mechanics

### From Game Feel Agent:

- DIY mode is trivially easy (walk on flat ground)
- No "Sisyphean" struggle — nothing to struggle against
- The business metaphor (labeled obstacles) is completely absent
- "Handled" mode has nothing to fly over — no contrast with DIY

### From Code Review:

```typescript
// MountainDemo.tsx lines 79-93 - THE PROBLEM
function createMountain(): { platforms: Platform[]; successX: number } {
  // Simple flat path - no climbing needed!  <-- THIS COMMENT SAYS IT ALL
  const successX = 800;
  const platforms: Platform[] = [
    { worldX: successX, y: GROUND_Y - 30, width: 120, height: 30, label: '' },
  ];
  return { platforms, successX };
}
```

### What the Spec Requires (mountain-demo-game-spec-v4.md):

| Feature                     | Spec                                   | Implementation       |
| --------------------------- | -------------------------------------- | -------------------- |
| Mountain blocks with labels | 5-7 labeled platforms forming slope    | 1 unlabeled platform |
| Rolling boulders            | "Missed texts", "Quick question", etc. | None                 |
| Crumbling platforms         | "Some blocks crumble after landing"    | None                 |
| Knockback on hit            | Boulder hits push player back          | None                 |
| Fail: 3 boulder hits        | Tunable hit counter                    | Not implemented      |
| Fail: 75% collapse          | Peak collapse event                    | Not implemented      |
| Fail: 15-18s timeout        | Failsafe timer                         | 25s (wrong value)    |

## Proposed Solutions

### Option A: Implement Full Spec (Recommended)

**Effort:** Large (4-6 hours)
**Risk:** Low — spec is well-defined

1. Rewrite `createMountain()` to generate 5-7 stacked platforms with labels
2. Add `Boulder` entity type with rolling physics
3. Implement collision detection with knockback
4. Add hit counter (3 hits = fail)
5. Add 75% progress collapse trigger
6. Fix timeout to 15-18 seconds
7. Use existing `MOUNTAIN_LABELS` and `shuffle()` functions

**Pros:** Delivers the intended emotional experience
**Cons:** Significant work

### Option B: Simplified But Meaningful

**Effort:** Medium (2-3 hours)
**Risk:** Medium — may not hit emotional targets

1. Add labeled platforms (mountain shape) but skip crumbling
2. Add rolling boulders with knockback
3. Skip collapse event, keep timeout fail
4. Implement hit counter

**Pros:** Faster delivery
**Cons:** Missing some spec polish

### Option C: Remove the Game

**Effort:** Small (30 min)
**Risk:** High — loses conversion opportunity

1. Replace game with static illustration or video
2. Remove MountainDemo component entirely

**Pros:** Ship immediately
**Cons:** Loses the "felt understanding" the spec was designed to create

## Recommended Action

[To be filled during triage]

## Technical Details

**Affected files:**

- `apps/web/src/components/home/MountainDemo.tsx` (lines 79-93, 113-171)

**Key functions to modify:**

- `createMountain()` — needs complete rewrite
- `updateDIY()` — needs boulder spawning, collision, knockback
- `render()` — needs boulder rendering

**New entities needed:**

```typescript
interface Boulder {
  worldX: number;
  y: number;
  vx: number; // rolling speed
  label: string;
}
```

## Acceptance Criteria

- [ ] Mountain has 5-7 labeled platforms forming upward slope
- [ ] Boulders spawn and roll toward player with labels
- [ ] Player knocked back on boulder collision
- [ ] Fail triggers after 3 boulder hits OR 15-18s timeout
- [ ] DIY mode feels frustrating but not punishing
- [ ] "Get Handled" mode provides relief by flying over obstacles
- [ ] `MOUNTAIN_LABELS` array is actually used
- [ ] `shuffle()` function is actually called

## Work Log

| Date       | Action                   | Learnings                                          |
| ---------- | ------------------------ | -------------------------------------------------- |
| 2026-01-04 | Created from code review | 6 agents agreed: game mechanics completely missing |

## Resources

- Spec: `plans/mountain-demo-game-spec-v4.md`
- Implementation spec: `plans/mountain-demo-implementation-spec.md`
- Current code: `apps/web/src/components/home/MountainDemo.tsx`
