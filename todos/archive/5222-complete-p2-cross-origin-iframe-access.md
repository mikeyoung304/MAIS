---
status: ready
priority: p2
issue_id: 5222
tags: [code-review, security, cross-origin, dashboard-rebuild]
dependencies: []
---

# Cross-Origin iframe.contentDocument Access in RevealTransition

## Problem Statement

`RevealTransition.tsx` (lines 112-113) accesses `iframe.contentDocument` and `iframe.contentWindow.document.documentElement.scrollHeight` during the reveal auto-scroll animation. If the iframe and parent are on different origins (tenant subdomain, CDN split, or future domain changes), this throws a `SecurityError` and the scroll silently fails.

## Findings

- Lines 112-113: Direct `contentDocument` access without try-catch
- Code guards against `scrollHeight <= 0` but not cross-origin exception
- Currently same-origin (works), but fragile to deployment changes

## Proposed Solutions

### Option A: Wrap in try-catch (Recommended)

- Catch SecurityError, skip scroll gracefully (animation still works without it)
- **Effort:** Small | **Risk:** None

## Acceptance Criteria

- [ ] Cross-origin iframe access wrapped in try-catch
- [ ] Reveal animation degrades gracefully without scroll

## Work Log

| Date       | Action  | Notes                                                    |
| ---------- | ------- | -------------------------------------------------------- |
| 2026-02-06 | Created | Found during /workflows:review (architecture-strategist) |
