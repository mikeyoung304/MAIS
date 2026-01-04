---
status: pending
priority: p3
issue_id: '622'
tags: [code-review, game, polish, ux]
dependencies: ['617']
---

# Mountain Demo: Visual Polish Missing

## Problem Statement

Several visual feedback elements from the spec are not implemented. These are polish items that enhance the emotional experience.

## Findings

### 1. No Screen Shake on Fail

- **Spec:** "Subtle screen shake (2–3px) + soft fade"
- **Current:** Instant transition to fail overlay

### 2. No Confetti on Success

- **Spec:** "Small confetti burst" + "Lightbulb brightens"
- **Current:** Static success screen

### 3. No Camera Pull-Back

- **Spec:** "Camera starts tight on player + idea 💡, Pulls back to reveal the full mountain"
- **Current:** Fixed camera throughout

### 4. Missing Play Again Button

- **Spec:** "Secondary: Play again (optional)"
- **Current:** Only "Get Started" on success screen

### 5. Wrong Fail Message

- **Spec:** "You don't have to climb this."
- **Current:** "You don't have to do this alone."

### 6. Missing Click-Outside Handler

- **Spec:** "Focus exits if: User clicks outside canvas"
- **Current:** Only Escape key exits

## Proposed Solutions

### Option A: Implement All Polish

**Effort:** Medium (2-3 hours)
**Risk:** Low

1. Add CSS shake animation on fail (simple keyframes)
2. Add confetti particles on success (canvas or CSS)
3. Add camera zoom animation (modify scale in game loop)
4. Add "Play Again" button to SuccessOverlay
5. Fix fail message text
6. Add click-outside useEffect

### Option B: Essential Polish Only

**Effort:** Small (1 hour)
**Risk:** Low

1. Fix fail message text
2. Add click-outside handler
3. Skip shake/confetti/camera (nice-to-have)

## Technical Details

**Affected file:** `apps/web/src/components/home/MountainDemo.tsx`

**Screen shake example:**

```typescript
// Add to container div when failing
className={`${isFailing ? 'animate-shake' : ''}`}

// In tailwind.config.js
animation: {
  shake: 'shake 0.3s ease-in-out',
},
keyframes: {
  shake: {
    '0%, 100%': { transform: 'translateX(0)' },
    '25%': { transform: 'translateX(-3px)' },
    '75%': { transform: 'translateX(3px)' },
  },
},
```

**Click-outside handler:**

```typescript
useEffect(() => {
  if (overlay !== 'none') return;

  const handleClickOutside = (e: MouseEvent) => {
    if (!containerRef.current?.contains(e.target as Node)) {
      gameRef.current.phase = 'idle';
      setOverlay('idle');
    }
  };

  document.addEventListener('mousedown', handleClickOutside);
  return () => document.removeEventListener('mousedown', handleClickOutside);
}, [overlay]);
```

## Acceptance Criteria

- [ ] Fail message matches spec: "You don't have to climb this."
- [ ] Click outside game area returns to idle
- [ ] (Optional) Screen shake on fail
- [ ] (Optional) Confetti on success
- [ ] (Optional) Play Again button on success

## Work Log

| Date       | Action                   | Learnings                              |
| ---------- | ------------------------ | -------------------------------------- |
| 2026-01-04 | Created from code review | Polish items enhance emotional journey |
