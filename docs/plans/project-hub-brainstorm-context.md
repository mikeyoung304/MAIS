# Project Hub Brainstorm Context

**Date:** 2026-01-25
**Status:** Ready for brainstorm session

## What We Just Fixed

- ✅ Customers now redirect to Project Hub after Stripe payment (token validation fix)
- ✅ Auto-confirm feature added (bookings can skip PAID → CONFIRMED)

## Current State of Project Hub

### Location

- Route: `/t/[slug]/project/[projectId]`
- Component: `apps/web/src/app/t/[slug]/project/[projectId]/page.tsx`

### What Exists (Minimal)

- Project Overview card (event date, service name)
- Activity Timeline (just shows "Project created" timestamp)
- Chat interface shell ("Need Help?" section)
- Welcome message with customer name

### Known Issues

#### 1. Agent Chat Not Working

- Chat shows "Starting chat..." but doesn't connect
- No error handling visible to user
- Unclear what backend endpoint it's trying to reach

#### 2. UI/UX Almost Non-Existent

- Very bare bones layout
- No visual hierarchy or polish
- Missing expected features for a customer portal
- Doesn't match the quality bar of the booking flow

#### 3. Missing Features (Potential)

- No way to view booking details (package info, pricing, what's included)
- No document upload/sharing
- No contract/invoice viewing
- No way to message vendor outside of chat
- No timeline of upcoming milestones
- No payment history or balance due info
- No way to modify booking or request changes

## Questions to Explore

1. **What is the Project Hub supposed to be?**
   - Simple status page?
   - Full client portal with document management?
   - Communication hub with vendor?

2. **What do wedding/event customers actually need?**
   - View their booking details
   - See what they've paid vs what's owed
   - Upload required documents (shot lists, timelines)
   - Download contracts/invoices
   - Message their vendor
   - Track project milestones

3. **What's the MVP vs nice-to-have?**
   - Agent chat working
   - Booking details visible
   - Payment status clear
   - vs. full document management, milestones, etc.

4. **Technical questions:**
   - Is the agent backend deployed and working?
   - What API endpoints exist for project data?
   - How does auth work (token-based, currently)?

## Related Files to Explore

```
apps/web/src/app/t/[slug]/project/[projectId]/
server/src/routes/public-project.routes.ts
server/src/agent/customer/  (customer chatbot)
```

## Brand Voice Reminder

Per `docs/design/BRAND_VOICE_GUIDE.md`:

- Apple-level polish expected
- Generous whitespace (py-32)
- 80% neutral / 20% sage accent
- Serif headlines, rounded cards (rounded-3xl shadow-lg)
- Always include hover states

---

## Session Handoff

**Copy this to start your new session:**

```
I want to brainstorm and plan improvements to our Project Hub - the customer-facing portal at /t/[slug]/project/[projectId].

Current state:
- Customers land here after completing Stripe payment
- UI is very bare bones - almost non-existent
- Agent chat shows "Starting chat..." but doesn't work
- Missing expected client portal features

I want to explore:
1. What should this hub actually be?
2. What's the MVP to make it useful?
3. What's broken that needs fixing first?

Context doc: docs/plans/project-hub-brainstorm-context.md

Let's use /workflows:brainstorm to explore this properly.
```
