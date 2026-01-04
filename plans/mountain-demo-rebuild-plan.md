# Mountain Demo Rebuild Plan

> **Status:** Ready for implementation
> **Branch:** `game`
> **Estimated effort:** 4-6 hours
> **Priority:** P1 — Core landing page conversion feature

---

## Executive Summary

The Mountain Demo game has infrastructure (canvas, game loop, overlays) but no gameplay. This plan rebuilds the core mechanics to deliver the spec's intended emotional journey: **struggle → relief → conversion**.

---

## Pre-Implementation Checklist

- [x] Review complete (6 agents, todos 617-622 created)
- [x] Spec understood (`plans/mountain-demo-game-spec-v4.md`)
- [ ] Implementation plan approved
- [ ] Branch ready (`game` branch exists)

---

## Phase 1: Mountain Terrain (45 min)

### Goal

Replace flat ground with an actual mountain made of labeled platforms.

### Tasks

1. **Rewrite `createMountain()` function** (lines 79-93)
   - Generate 5-7 platforms forming upward slope
   - Use existing `MOUNTAIN_LABELS` array (finally!)
   - Use existing `shuffle()` function for randomization
   - Each platform: varying width (80-140px), staggered heights

2. **Platform layout algorithm**

   ```typescript
   // Rough structure:
   // - Start at ground level
   // - Each platform 60-100px higher than previous
   // - Horizontal offset varies (some overlap, some gaps)
   // - Success platform at the peak
   ```

3. **Update `Platform` interface if needed**
   - Ensure `label` field is populated
   - Consider adding `crumbling` state for Phase 4

### Files Modified

- `apps/web/src/components/home/MountainDemo.tsx`

### Acceptance Criteria

- [ ] 5-7 platforms visible forming mountain shape
- [ ] Each platform has a label from `MOUNTAIN_LABELS`
- [ ] Labels render correctly (existing code at lines 280-291)
- [ ] Success platform at peak with "SUCCESS" label
- [ ] Player can jump between platforms

---

## Phase 2: Rolling Boulders (1 hour)

### Goal

Add labeled boulder hazards that roll toward the player and knock them back.

### Tasks

1. **Add Boulder entity type**

   ```typescript
   interface Boulder {
     worldX: number;
     y: number;
     radius: number;
     vx: number; // rolling speed (negative = toward player)
     label: string;
   }
   ```

2. **Add boulder labels constant**

   ```typescript
   const BOULDER_LABELS = [
     'Missed texts',
     '"Quick question"',
     'Chasing invoices',
     'Miscommunication',
     '"Did you see my email?"',
     'Last-minute changes',
     'Calendar conflict',
   ];
   ```

3. **Add to GameState**

   ```typescript
   interface GameState {
     // ... existing
     boulders: Boulder[];
     hitCount: number;
   }
   ```

4. **Boulder spawning in `updateDIY()`**
   - Spawn from right side of screen
   - Random Y position (on or above platforms)
   - Spawn rate: ~1 every 3-4 seconds
   - Rolling speed: 2-4 px/frame

5. **Boulder collision detection**
   - Circle-rectangle collision with player
   - On hit: knockback (push player left ~50-80px)
   - Increment `hitCount`
   - Brief invincibility (0.5s) to prevent multi-hit

6. **Boulder rendering in `render()`**
   - Gray circle with white label text
   - Subtle rotation animation (optional)

### Files Modified

- `apps/web/src/components/home/MountainDemo.tsx`

### Acceptance Criteria

- [ ] Boulders spawn periodically from right
- [ ] Boulders have readable labels
- [ ] Player knocked back on collision
- [ ] Hit counter increments
- [ ] Boulders despawn when off-screen left

---

## Phase 3: Fail Conditions (30 min)

### Goal

Implement proper fail triggers per spec.

### Tasks

1. **Fix timeout value**

   ```typescript
   const FAIL_TIMEOUT = 16000; // Was 25000, spec says 15-18s
   ```

2. **Add hit-based fail**

   ```typescript
   // In updateDIY():
   if (state.hitCount >= 3) {
     state.phase = 'fail';
     setOverlay('fail');
     return;
   }
   ```

3. **Add progress collapse (optional but impactful)**
   - Track progress: `worldOffset / successPlatformX`
   - At 75%, trigger "collapse" event
   - Visual: shake screen, platforms fall
   - Instant fail

4. **Update fail overlay text**
   - Change "You don't have to do this alone."
   - To: "You don't have to climb this."

### Files Modified

- `apps/web/src/components/home/MountainDemo.tsx`

### Acceptance Criteria

- [ ] Fail triggers at 3 boulder hits
- [ ] Fail triggers at 16 seconds
- [ ] (Optional) Fail triggers at 75% progress collapse
- [ ] Fail message matches spec

---

## Phase 4: Handled Mode Polish (30 min)

### Goal

Ensure Handled mode provides proper contrast/relief.

### Tasks

1. **Verify jetpack physics feel good**
   - Hold = smooth rise
   - Release = gentle glide
   - Should feel effortless, not like a power-up

2. **Boulders continue but pass below**
   - Don't despawn boulders in Handled mode
   - Player flies above them
   - Visual reminder: chaos continues, just not your problem

3. **Auto-guide if player does nothing**
   - If no input for 2+ seconds, gently rise
   - Ensures player reaches success even if confused

4. **Fix win condition**
   - Current check is broken (y < GROUND_Y - 100 impossible)
   - Change to: reached success platform X position
   ```typescript
   const successScreenX = game.successPlatformX - game.worldOffset;
   if (successScreenX < PLAYER_SCREEN_X + 50) {
     game.phase = 'success';
   }
   ```

### Files Modified

- `apps/web/src/components/home/MountainDemo.tsx`

### Acceptance Criteria

- [ ] Handled mode feels like relief, not power fantasy
- [ ] Boulders visible below player
- [ ] Auto-guide prevents getting stuck
- [ ] Win condition triggers correctly

---

## Phase 5: Code Cleanup (20 min)

### Goal

Remove dead code, fix duplicates, reduce bundle size.

### Tasks

1. **Merge duplicate functions**
   - `startGame()` and `restartDIY()` are identical
   - Keep one, rename to `startDIYMode()`

2. **Verify all code is used**
   - `MOUNTAIN_LABELS` ✅ now used
   - `shuffle()` ✅ now used
   - Platform label rendering ✅ now triggered

3. **Clean up any commented code or TODOs**

### Files Modified

- `apps/web/src/components/home/MountainDemo.tsx`

### Acceptance Criteria

- [ ] No duplicate functions
- [ ] No unused constants/functions
- [ ] Bundle size closer to 5KB target

---

## Phase 6: Visual Polish (45 min) — OPTIONAL

### Goal

Add spec's visual feedback elements.

### Tasks

1. **Screen shake on fail**
   - 2-3px shake for 300ms
   - CSS animation or canvas transform

2. **Confetti on success**
   - Simple particle burst
   - Sage green + white particles
   - 1-2 second duration

3. **Idle preview animation**
   - Player takes a few steps
   - Boulder rolls by
   - Loops until Play clicked

4. **Click-outside handler**
   - Clicking outside game area returns to idle
   - Prevents focus trap

5. **Add "Play Again" to success overlay**

### Files Modified

- `apps/web/src/components/home/MountainDemo.tsx`

### Acceptance Criteria

- [ ] Screen shakes on fail
- [ ] Confetti appears on success
- [ ] Idle state has subtle animation
- [ ] Click outside exits game

---

## Phase 7: Analytics (20 min) — OPTIONAL

### Goal

Add tracking events for conversion measurement.

### Tasks

1. **Add tracking calls**
   ```typescript
   // Use existing analytics pattern in codebase
   track('mountain_demo_play_clicked');
   track('mountain_demo_fail', { reason: 'hits' | 'timeout' | 'collapse', attempts });
   track('mountain_demo_get_handled_clicked');
   track('mountain_demo_success');
   track('mountain_demo_cta_clicked');
   track('mountain_demo_skipped');
   ```

### Files Modified

- `apps/web/src/components/home/MountainDemo.tsx`

### Acceptance Criteria

- [ ] Key conversion events tracked
- [ ] Events include relevant metadata

---

## Testing Checklist

### Manual Testing

- [ ] DIY mode: Can jump between platforms
- [ ] DIY mode: Boulders spawn and roll
- [ ] DIY mode: Getting hit knocks player back
- [ ] DIY mode: 3 hits triggers fail
- [ ] DIY mode: 16s timeout triggers fail
- [ ] Fail overlay: Shows correct message
- [ ] Fail overlay: "Get Handled" works
- [ ] Fail overlay: "Keep trying" restarts DIY
- [ ] Handled mode: Jetpack appears with sage glow
- [ ] Handled mode: Can fly over obstacles
- [ ] Handled mode: Reaches success
- [ ] Success overlay: Shows correct copy
- [ ] Success overlay: CTA links to /signup
- [ ] Escape key: Returns to idle from any state
- [ ] Mobile: Touch controls work
- [ ] Reduced motion: Shows static fallback

### Browser Testing

- [ ] Chrome
- [ ] Safari
- [ ] Firefox
- [ ] Mobile Safari
- [ ] Mobile Chrome

---

## Rollback Plan

If issues arise:

1. `git checkout main -- apps/web/src/components/home/MountainDemo.tsx`
2. Or revert to the simple flat-ground version

---

## Success Metrics

After deployment, measure:

- Interaction rate (Play clicked / Section viewed)
- Completion rate (Success reached / Play clicked)
- Conversion uplift (Signup from game CTA vs control)
- Bounce rate on landing page (should decrease)

---

## File Summary

| File                   | Changes                         |
| ---------------------- | ------------------------------- |
| `MountainDemo.tsx`     | Major rewrite of game mechanics |
| `LazyMountainDemo.tsx` | No changes needed               |
| `page.tsx`             | No changes needed               |

---

## Dependencies

- None — all changes contained within MountainDemo.tsx
- No new packages required
- No backend changes

---

## Notes for Implementer

1. **Keep the existing infrastructure** — canvas setup, game loop, overlays all work
2. **Focus on `createMountain()` and `updateDIY()`** — that's where gameplay lives
3. **Test frequently** — run `npm run dev:web` and play the game after each phase
4. **The spec is your guide** — `plans/mountain-demo-game-spec-v4.md` has all the details
5. **Tone matters** — should feel calm/knowing/relieving, not punishing/gimmicky
