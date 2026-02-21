---
status: pending
priority: p2
issue_id: '11089'
tags: [code-review, frontend, accessibility]
pr: 68
---

# F-025: IntakeChat Framer-Motion Animations Ignore prefers-reduced-motion

## Problem Statement

The `IntakeChat` component uses framer-motion animations for message entry, typing indicators, and transitions, but does not respect the user's `prefers-reduced-motion` OS setting. Users who have requested reduced motion (e.g., for vestibular disorders) will still see all animations.

## Findings

- **Agents:** 1 agent flagged
- **Location:** `apps/web/src/components/onboarding/IntakeChat.tsx:224-280`
- **Impact:** Accessibility violation. Users with motion sensitivity or vestibular disorders may experience discomfort, nausea, or difficulty using the onboarding flow. This is a WCAG 2.1 Level AA requirement (2.3.3 Animation from Interactions).

## Proposed Solution

Wrap the IntakeChat's framer-motion animations in a `<MotionConfig reducedMotion="user">` provider. This tells framer-motion to automatically respect the OS-level `prefers-reduced-motion` setting, disabling or reducing animations for users who have requested it.

## Effort

Small

## Acceptance Criteria

- [ ] `IntakeChat` wrapped in `<MotionConfig reducedMotion="user">`
- [ ] Animations are suppressed when `prefers-reduced-motion: reduce` is set
- [ ] Animations work normally when the preference is not set
- [ ] Manual verification with OS reduced-motion setting toggled
