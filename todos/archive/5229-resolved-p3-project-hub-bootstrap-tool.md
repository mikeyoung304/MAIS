---
status: complete
priority: p3
issue_id: '5229'
tags: [agent-native, agent-v2, project-hub, code-review, ux]
dependencies: []
resolved_at: '2026-01-21'
resolution: 'Already fixed - bootstrapProjectHubSession tool fully implemented with personalized greetings'
---

# Project Hub: Missing Bootstrap Session Tool

## Problem Statement

Project Hub lacks a `bootstrap_session` equivalent tool that Concierge uses to initialize context at the start of every conversation. The agent relies entirely on session state being passed correctly, with no fallback or initialization logic.

**Impact:** If session state is incomplete, agent has no way to recover context. Also misses opportunity for personalized greetings.

## Findings

### Agent-Native Reviewer

- Concierge has `bootstrapSessionTool` (lines 1224-1275)
- Project Hub has no equivalent

Concierge's bootstrap:

1. Gets tenant context from backend API
2. Checks onboarding status
3. Provides resume greeting for returning users
4. Returns comprehensive context

## Proposed Solutions

### Option A: Add Bootstrap Tool (Recommended)

```typescript
const bootstrapProjectHubSession = new FunctionTool({
  name: 'bootstrap_project_hub_session',
  description: 'Initialize session context. Call FIRST in any new conversation.',
  parameters: z.object({}),
  execute: async (_params, ctx) => {
    const { tenantId, customerId, projectId, contextType } = getContextFromSession(ctx!);

    if (!tenantId) {
      return { error: 'No tenant context - check session configuration' };
    }

    if (contextType === 'customer') {
      // Get customer-specific context
      const project = await callBackendAPI(`/project-hub/projects/${projectId}`);
      return {
        contextType: 'customer',
        projectStatus: project.status,
        upcomingBooking: project.bookingDate,
        hasPendingRequests: project.pendingRequestCount > 0,
        greeting: `Welcome back! Your ${project.serviceName} is coming up on ${project.bookingDate}.`,
      };
    } else {
      // Get tenant-specific context
      const activity = await callBackendAPI(`/project-hub/tenants/${tenantId}/activity`);
      return {
        contextType: 'tenant',
        activeProjects: activity.activeProjects,
        pendingRequests: activity.pendingRequestCount,
        greeting:
          activity.pendingRequestCount > 0
            ? `You have ${activity.pendingRequestCount} pending requests to review.`
            : `All caught up! ${activity.activeProjects} active projects.`,
      };
    }
  },
});
```

**Pros:** Better UX, context recovery, personalized experience
**Cons:** Extra tool, extra API calls
**Effort:** Medium (2-3 hours)
**Risk:** Low

## Recommended Action

**Option A** - Add bootstrap tool for improved UX.

## Technical Details

**Affected Files:**

- `server/src/agent-v2/deploy/project-hub/src/agent.ts`
- Backend: May need new endpoint for bootstrap data

**System Prompt Update:**
Add instruction to call `bootstrap_project_hub_session` first.

## Acceptance Criteria

- [ ] Bootstrap tool returns context-appropriate data
- [ ] Provides personalized greeting
- [ ] System prompt instructs to call first
- [ ] Handles missing session data gracefully

## Work Log

| Date       | Action                               | Result                              |
| ---------- | ------------------------------------ | ----------------------------------- |
| 2026-01-20 | Created from multi-agent code review | Identified by Agent-Native reviewer |

## Resources

- [Concierge Bootstrap Tool](server/src/agent-v2/deploy/concierge/src/agent.ts:1224-1275)
