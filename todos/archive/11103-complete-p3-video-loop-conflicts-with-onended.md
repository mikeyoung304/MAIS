---
status: pending
priority: p3
issue_id: '11103'
tags: [code-review, frontend]
pr: 68
---

# F-039: OnboardingVideo loop attribute conflicts with onEnded handler (dead code)

## Problem Statement

The `<video>` element has both `loop` attribute and an `onEnded` event handler. When `loop` is true, the browser automatically restarts playback and never fires the `ended` event, making the `onEnded` handler dead code. This suggests either the loop should be removed (video plays once, then triggers next step) or the `onEnded` handler is vestigial.

## Location

`apps/web/src/components/onboarding/OnboardingVideo.tsx:164-169`

## Proposed Solution

1. **If the video should play once:** Remove `loop` attribute. The `onEnded` handler will fire and can trigger the next onboarding step or show a CTA.
2. **If the video should loop:** Remove the `onEnded` handler since it will never fire. Add a separate "Continue" button for the user to proceed.
3. Clarify the intended UX with the design and update accordingly.

## Effort

Small — ~15 minutes. Remove one of the conflicting attributes based on intended behavior.
