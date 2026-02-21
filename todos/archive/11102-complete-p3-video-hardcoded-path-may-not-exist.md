---
status: pending
priority: p3
issue_id: '11102'
tags: [code-review, frontend]
pr: 68
---

# F-038: OnboardingVideo references hardcoded video path that may not exist

## Problem Statement

The `OnboardingVideo` component references a hardcoded video file path (e.g., `/videos/onboarding-welcome.mp4`). If the video file doesn't exist in the public directory, the component will render a broken video player with no fallback UI. This creates a poor first impression during onboarding.

## Location

`apps/web/src/components/onboarding/OnboardingVideo.tsx:163`

## Proposed Solution

1. Add an `onError` handler to the `<video>` element that hides the player or shows a fallback (e.g., a static image or text-based welcome).
2. Move the video path to a config/env variable so it can be updated without code changes.
3. Add a build-time check or CI step that verifies referenced static assets exist.
4. Consider using a video hosting service (e.g., Mux, Cloudflare Stream) for better performance and reliability.

## Effort

Small — ~1 hour. Add error handler + fallback UI. Config extraction is optional follow-up.
