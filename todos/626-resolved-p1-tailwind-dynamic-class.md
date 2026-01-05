---
status: resolved
priority: p1
issue_id: '626'
tags: [code-review, bug, build-mode, css, tailwind]
dependencies: []
---

# Tailwind Dynamic Class Not Working for Mobile Viewport

## Problem Statement

The mobile viewport width uses a template literal inside a Tailwind class name, which won't be processed by Tailwind's JIT compiler. The mobile preview mode is effectively broken.

**What's broken:** Mobile preview shows desktop width
**Why it matters:** Users cannot preview how their site looks on mobile

## Findings

### Source: TypeScript Reviewer + Code Simplicity Reviewer + Performance Oracle

**File:** `/apps/web/src/components/build-mode/BuildModePreview.tsx` (line 209)

**Current Code (WON'T WORK):**

```typescript
className={cn(
  'h-full mx-auto bg-white rounded-lg shadow-lg overflow-hidden transition-all duration-300',
  viewportMode === 'mobile'
    ? `max-w-[${BUILD_MODE_CONFIG.viewport.mobileWidth}px]`  // Dynamic - NOT purged!
    : 'w-full'
)}
```

**Why It Fails:**

- Tailwind scans for complete class names at build time
- Template literals like `max-w-[${variable}px]` are not detected
- The class is never generated in the CSS bundle
- Result: mobile mode has no max-width constraint

## Proposed Solutions

### Option A: Use inline style (Recommended)

**Description:** Apply max-width via style prop instead of Tailwind class

```typescript
<div
  className={cn(
    'h-full mx-auto bg-white rounded-lg shadow-lg overflow-hidden transition-all duration-300',
    viewportMode === 'desktop' && 'w-full'
  )}
  style={viewportMode === 'mobile' ? { maxWidth: BUILD_MODE_CONFIG.viewport.mobileWidth } : undefined}
>
```

- **Pros:** Dynamic values work, config-driven
- **Cons:** Mixes Tailwind with inline styles
- **Effort:** Small (5 minutes)
- **Risk:** None

### Option B: Use static Tailwind class

**Description:** Since mobileWidth is a constant (375), use the static class

```typescript
viewportMode === 'mobile' ? 'max-w-[375px]' : 'w-full';
```

- **Pros:** Pure Tailwind, no style mixing
- **Cons:** Duplicates constant value (needs sync if changed)
- **Effort:** Small (2 minutes)
- **Risk:** Low (value rarely changes)

## Technical Details

**Affected Files:**

- `apps/web/src/components/build-mode/BuildModePreview.tsx`

**Config value:**

- `BUILD_MODE_CONFIG.viewport.mobileWidth = 375`

## Acceptance Criteria

- [ ] Mobile viewport shows narrower preview (375px)
- [ ] Desktop viewport shows full width
- [ ] Toggle between modes works smoothly

## Work Log

| Date       | Action                               | Learnings                                                |
| ---------- | ------------------------------------ | -------------------------------------------------------- |
| 2026-01-05 | Created from multi-agent code review | Tailwind JIT requires complete class names at build time |

## Resources

- BuildModePreview: `apps/web/src/components/build-mode/BuildModePreview.tsx`
- Config: `apps/web/src/lib/build-mode/config.ts`
- Tailwind docs: https://tailwindcss.com/docs/content-configuration#dynamic-class-names
