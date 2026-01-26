# Project Hub Redesign Brainstorm

**Date:** 2026-01-25
**Status:** Ready for planning
**Participants:** Mike + Claude

## What We're Building

A redesigned Project Hub that serves as the central command center for each booking - accessible to both tenants (vendors) and customers via a single URL with role-based views.

### Design Reference

The target UI comes from the gethandled.ai landing page:

- **Hero Carousel Slide 4** ("Session Space") - Customer-facing view
- **"One Booking. Everything" Section** - Tenant-facing view (wedding planner example)

Screenshots saved:

- `.playwright-mcp/carousel-slide-3.png` - Customer hub mockup
- `.playwright-mcp/landing-page-carousel.png` - Full carousel context

## Why This Approach

### Problem Statement

The current Project Hub (`/t/[slug]/project/[projectId]`) is:

- Visually bare bones compared to the polished booking flow
- Backward-looking (shows timeline of what happened) vs. forward-looking (what's next)
- Missing actionable components (things to do, decisions needed)
- Chat is broken ("Starting chat..." but never connects)
- No tenant view exists at all

### Solution: Smart URL Pattern

One canonical URL serves both audiences:

```
https://sarahwilliams.gethandled.ai/project/abc123
        └── Custom subdomain (future)     └── Project ID
```

| Viewer   | Auth Method          | Experience               |
| -------- | -------------------- | ------------------------ |
| Customer | Token (`?token=xxx`) | Customer Hub (simpler)   |
| Tenant   | Session (logged in)  | Tenant Hub (operational) |

### Benefits

1. **One URL forever** - Customers bookmark, tenants share
2. **Data compounds** - Single project record enriched over time
3. **Custom domains ready** - Same URL pattern works with `vendor.com`
4. **Customer-friendly** - No ugly `/dashboard/` in shared links

## Key Decisions

### 1. Build Tenant Hub First

The Tenant Hub (rich operational view) is priority because:

- Tenants are paying customers who need the most value
- Customer Hub is simpler and can come after
- Tenant Hub requires the backend data structures that Customer Hub will also use

### 2. Chat-First MVP Approach

Phase the build:

1. **Phase 1:** Fix broken chat + basic project info
2. **Phase 2:** Add Notes, Fee tracking, core components
3. **Phase 3:** Full visual match to mockup (dark theme, all components)

### 3. Single Route, Role-Based Rendering

- Keep existing route: `/t/[slug]/project/[projectId]`
- Detect viewer type (customer token vs tenant session)
- Render appropriate view based on role

## Component Inventory (Target State)

### Tenant Hub Components (from mockup)

| Component           | Priority | Description                                 |
| ------------------- | -------- | ------------------------------------------- |
| **Header**          | P1       | Client name + service + date + status badge |
| **Chat Panel**      | P1       | AI-powered communication (currently broken) |
| **Your Notes**      | P2       | Private vendor notes (customer never sees)  |
| **Your Fee**        | P2       | Paid vs due amounts                         |
| **Stats Bar**       | P2       | Guests, days countdown                      |
| **Details Card**    | P2       | Venue, Budget, Vendors                      |
| **Decision Needed** | P3       | Action items requiring attention            |
| **Resources**       | P3       | Files, links, guest lists                   |
| **Checklist**       | P3       | Progress tracker                            |
| **Sync Status**     | P3       | Integration indicators                      |

### Customer Hub Components (from mockup)

| Component            | Priority | Description                    |
| -------------------- | -------- | ------------------------------ |
| **Header**           | P1       | Project name + vendor + status |
| **What's Coming Up** | P1       | Next event with countdown      |
| **Things To Do**     | P1       | Customer action items          |
| **Chat Panel**       | P1       | "Ask anything..." assistant    |
| **From Last Time**   | P2       | Remembered preferences         |
| **AI Summary**       | P3       | Session context summary        |

## Open Questions (for Planning Phase)

### Chat Investigation Needed

- [ ] Why does chat show "Starting chat..." forever?
- [ ] Is the customer agent deployed to production?
- [ ] What API endpoint is the chat trying to reach?
- [ ] Is the agent backend (ADK) configured correctly?

### Data Model Questions

- [ ] Do we need new Prisma models for vendor notes, checklists, resources?
- [ ] Or can we use JSON fields on the existing Project model?
- [ ] How do we handle the "Decision Needed" items?

### Auth Questions

- [ ] How does tenant auth work on this public route?
- [ ] Can we detect tenant session alongside customer token?
- [ ] What happens if both are present?

## Related Files

```
# Current implementation
apps/web/src/app/t/[slug]/project/[projectId]/page.tsx
apps/web/src/components/chat/ProjectHubChatWidget.tsx

# Backend routes
server/src/routes/public-project.routes.ts

# Agent system
server/src/agent/customer/

# Auth
apps/web/src/lib/tenant.ts (getProjectById with token)
```

## Next Steps

1. **Run `/workflows:plan`** to create implementation plan for Phase 1
2. **Investigate chat** - trace why it's not connecting
3. **Design role detection** - how to know if viewer is tenant vs customer

---

## Session Notes

### Visual References Captured

The landing page mockups show:

- Dark theme with rich contrast
- Two-column layout (info + chat)
- Forward-looking content ("What's Coming Up", "Things To Do")
- Progress indicators and status badges
- "Always here" chat presence indicator

### Current vs Target Gap

| Aspect      | Current                | Target                   |
| ----------- | ---------------------- | ------------------------ |
| Theme       | Light                  | Dark                     |
| Layout      | 3-column               | 2-column                 |
| Content     | Timeline (past)        | Actions (future)         |
| Chat        | Sidebar widget, broken | Prominent panel, working |
| Tenant view | None                   | Full operational hub     |
