---
status: complete
priority: p3
issue_id: '5233'
tags: [code-review, dry, frontend]
dependencies: []
---

# P3: Skip button markup duplicated in AgentPanel desktop/mobile

## Problem Statement

The ~10-line skip button block is copy-pasted between the desktop aside (`AgentPanel.tsx:550-561`) and the mobile Drawer (`:694-705`). The removed `OnboardingSection` component previously DRYed this up. Future changes (e.g., adding a confirmation dialog) would need to be applied in two places.

## Proposed Solutions

### Option A: Extract `<SkipSetupLink>` component

Small component wrapping the shared markup.

- **Effort:** Small
- **Risk:** Low

## Technical Details

- **Affected files:** `apps/web/src/components/agent/AgentPanel.tsx`

## Acceptance Criteria

- [x] Skip button rendered from single component used in both locations

## Work Log

| Date       | Action                                                                                                                             | Learnings                                                                                |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 2026-02-07 | Created from code review of commit 8c091544                                                                                        | Removing a DRY component introduced new duplication                                      |
| 2026-02-08 | Extracted SkipSetupLink component within AgentPanel.tsx (lines 59-72), replaced both desktop and mobile instances (lines 569, 703) | Single component eliminates duplication; future changes only need to happen in one place |
