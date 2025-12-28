# ChatbotUnavailable "Who dis?" Error Too Casual

## Metadata

- **ID:** 443
- **Status:** pending
- **Priority:** P3
- **Tags:** copy, ux, brand
- **Source:** Brand Review - Agent-Native Reviewer

## Problem Statement

In `ChatbotUnavailable.tsx`, the `not_authenticated` error displays "Who dis?" which may be too casual for a user frustrated by an authentication error. While cheeky is on-brand, this crosses into flippant.

## Findings

Location: `apps/web/src/components/agent/ChatbotUnavailable.tsx`

Current error messages:

- `missing_api_key`: "Brain not plugged in yet" — Good, cheeky
- `context_unavailable`: "Something went sideways" — Good, honest
- `rate_limited`: "Whoa, slow down" — Good, self-aware
- `not_authenticated`: **"Who dis?"** — Too casual for frustrated user

## Proposed Solutions

### Option A: "I don't recognize you"

More professional while still conversational

### Option B: "We haven't met yet"

Warm but clear

### Option C: "Please log in first"

Direct, no personality

## Recommended Action

Option A or B — maintain personality without being flippant

## Technical Details

**Affected Files:**

- `apps/web/src/components/agent/ChatbotUnavailable.tsx`

## Acceptance Criteria

- [ ] Error message is helpful, not dismissive
- [ ] Maintains brand voice (cheeky but professional)
- [ ] Provides clear next action (log in)

## Work Log

| Date       | Action  | Notes                                     |
| ---------- | ------- | ----------------------------------------- |
| 2025-12-27 | Created | From brand review - Agent-Native Reviewer |
