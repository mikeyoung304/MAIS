---
status: pending
priority: p1
issue_id: '11034'
tags: [code-review, google-calendar, agent-tools, tenant-agent, customer-agent]
---

# No AI Agent Tools Exist for Calendar Operations

## Problem Statement

The tenant-agent has 36 tools and the customer-agent has 13 tools, but zero tools exist for calendar operations. The AI cannot check availability, create/cancel events, or help tenants manage their calendar through conversation. The calendar service exists but is not exposed to the AI layer at all.

## Findings

- **Flagged by:** agent-native-reviewer
- `server/src/agent-v2/` — 0 calendar tools in either agent
- `server/src/services/google-calendar.service.ts` — service is complete but not wired to agents
- Example of what's missing: tenant-agent cannot say "your next available date is..." or "I've blocked out your vacation"
- Customer-agent cannot show available dates from real calendar data

## Proposed Solutions

### Option A: Add Calendar Tools to Both Agents (Medium)

**tenant-agent tools:**

- `check_calendar_availability(date_range)` — returns busy/free times
- `block_calendar_date(date, reason)` — blocks a date
- `get_upcoming_bookings_with_calendar()` — enriched with calendar status

**customer-agent tools:**

- `get_available_dates(service_id, month)` — real availability from calendar

- **Effort:** Medium
- **Risk:** Low

## Recommended Action

Add at minimum the `get_available_dates` tool to customer-agent so booking flow uses real calendar data. Add management tools to tenant-agent as a follow-up.

## Acceptance Criteria

- [ ] customer-agent can return real Google Calendar availability
- [ ] tenant-agent can check and manage calendar state through conversation
- [ ] Tools handle case where calendar is not configured (graceful fallback)

## Work Log

- 2026-02-20: Identified by agent-native-reviewer. 0 calendar tools found across all agents.
