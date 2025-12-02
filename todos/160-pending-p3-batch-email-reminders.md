---
status: pending
priority: p3
issue_id: "160"
tags: [code-review, performance, mvp-gaps, reminders]
dependencies: []
---

# Batch Email Sending for Reminders

## Problem Statement

Reminders are sent individually via Postmark API. Postmark supports batch sending up to 500 emails per call.

**Why This Matters:**
- 10 reminders = 10 API calls = ~5 seconds
- Batch would reduce to ~0.5 seconds
- Better scalability

## Proposed Solutions

Use Postmark batch API for reminder emails.

## Acceptance Criteria

- [ ] Batch email method added to PostmarkMailAdapter
- [ ] Reminder service uses batch sending
- [ ] 10x performance improvement for reminder processing
