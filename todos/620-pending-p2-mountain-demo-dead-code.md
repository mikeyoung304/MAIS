---
status: pending
priority: p2
issue_id: '620'
tags: [code-review, dead-code, cleanup]
dependencies: ['617']
---

# Mountain Demo: Dead Code Cleanup

## Problem Statement

The component contains ~50 lines of dead code that was clearly intended to be used but never integrated. This adds to bundle size and confusion.

## Findings

### 1. MOUNTAIN_LABELS Array (lines 59-67)

```typescript
const MOUNTAIN_LABELS = [
  'SEO',
  'Website setup',
  'Payments',
  'Scheduling',
  'Tool connections',
  'Domains',
  'Automations',
];
```

**Status:** Defined, never used. Was meant for platform labels.

### 2. shuffle() Function (lines 70-77)

```typescript
function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
```

**Status:** Defined, never called. Was meant to randomize labels per run.

### 3. Duplicate Functions (lines 511-534)

`startGame()` and `restartDIY()` are **100% identical**:

```typescript
const startGame = useCallback(() => {
  if (animationRef.current) cancelAnimationFrame(animationRef.current);
  gameRef.current = createInitialState();
  gameRef.current.phase = 'diy';
  gameRef.current.startTime = performance.now();
  setOverlay('none');
  animationRef.current = requestAnimationFrame(gameLoop);
}, [gameLoop]);

const restartDIY = useCallback(() => {
  // EXACTLY THE SAME CODE
}, [gameLoop]);
```

### 4. Platform Label Rendering (lines 280-291)

Code exists to render labels on platforms, but platforms are created with `label: ''`:

```typescript
if (platform.label) {
  // Always false
  ctx.fillStyle = '#A1A1AA';
  ctx.font = '10px Inter, system-ui, sans-serif';
  // ...
}
```

## Proposed Solutions

### Option A: Use the Code (Recommended if fixing todo-617)

**Effort:** Part of todo-617
**Risk:** N/A

When implementing actual gameplay, use the existing `MOUNTAIN_LABELS` and `shuffle()`.

### Option B: Remove Dead Code (If not implementing full game)

**Effort:** Small (15 min)
**Risk:** Low

1. Remove `MOUNTAIN_LABELS` (lines 59-67)
2. Remove `shuffle()` (lines 70-77)
3. Merge `restartDIY` into `startGame`

**Bundle impact:** ~50 lines × ~30 bytes = ~1.5KB savings (helps toward 5KB target)

## Technical Details

**Affected file:** `apps/web/src/components/home/MountainDemo.tsx`
**Lines:** 59-77, 511-534

## Acceptance Criteria

- [ ] No unused functions or constants remain
- [ ] OR unused code is integrated into working gameplay
- [ ] Only one start/restart function exists

## Work Log

| Date       | Action                   | Learnings                            |
| ---------- | ------------------------ | ------------------------------------ |
| 2026-01-04 | Created from code review | Clear evidence of abandoned features |
