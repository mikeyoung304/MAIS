---
status: pending
priority: p2
issue_id: '759'
tags: [agent-v2, context, ux, enterprise-ai]
dependencies: []
---

# Agent Has Zero Awareness of Build Mode Dashboard Context

## Problem Statement

The Concierge agent has no awareness that it's embedded in a Build Mode dashboard with a preview iframe. When asked "what do you think of my site overall? can you view it", the agent responded "I can't directly _view_ your site... What's the URL?"

This is incorrect - the agent IS in Build Mode with a live preview visible to the user.

**Evidence:** During E2E testing on production (gethandled.ai):

- User: "what do you think of my site overall? can you view it"
- Agent: "I can't directly _view_ your site... What's the URL?"
- Reality: Agent is in Build Mode panel, preview iframe is right next to the chat

## Findings

### Code Search Results

```
grep -r "Build Mode" server/src/agent-v2
# No matches found
```

**The term "Build Mode" appears ZERO times in the agent-v2 codebase.**

### What Agent Should Know

1. It's embedded in a dashboard with a preview panel
2. User can see changes in real-time via preview iframe
3. It can reference the preview: "Check your preview - I just updated the headline"
4. It understands the visual context of its environment

### What Agent Actually Knows

- Nothing about the dashboard
- Nothing about the preview
- Thinks it's a standalone chatbot

### Location

- System prompt: `server/src/agent-v2/deploy/concierge/src/agent.ts:65-257`
- Onboarding prompt: `server/src/agent-v2/deploy/concierge/src/prompts/onboarding.ts`

## Proposed Solutions

### Option 1: Add Build Mode Context to System Prompt (Recommended)

Add section to system prompt:

```
## Your Environment

You are embedded in the Build Mode dashboard:
- LEFT: This chat panel where we're talking
- RIGHT: A live preview of their storefront
- Changes you make appear in the preview instantly
- Say "Check your preview" when you update content

You can SEE their site through the preview. Reference it naturally:
- "Looking at your preview, the headline feels a bit generic..."
- "I just updated your About section - see it on the right?"
```

- **Pros**: Simple, immediate, natural behavior
- **Cons**: LLM may still hallucinate capabilities
- **Effort**: Small (1 hour)
- **Risk**: Low

### Option 2: Add Preview Snapshot Tool

Create tool that returns current preview state:

```typescript
const previewSnapshotTool = {
  name: 'get_preview_snapshot',
  description: 'Get a summary of what is currently showing in the preview',
  execute: async () => {
    // Return current page structure from draft config
  },
};
```

- **Pros**: Agent has actual data, not just context
- **Cons**: More complex, may be redundant with get_page_structure
- **Effort**: Medium (4 hours)
- **Risk**: Low

### Option 3: Pass Preview Context in Bootstrap

Include preview state in bootstrap session response:

```typescript
{
  previewContext: {
    isVisible: true,
    currentPage: 'home',
    hasDraft: true,
    lastUpdated: '2026-01-27T...'
  }
}
```

- **Pros**: Agent knows preview state at conversation start
- **Cons**: Doesn't update during conversation
- **Effort**: Medium (3 hours)
- **Risk**: Low

## Recommended Action

**Option 1** for immediate fix, plus **Option 3** for structured context.

## Technical Details

- **Affected Files**:
  - `server/src/agent-v2/deploy/concierge/src/agent.ts` (system prompt)
  - `server/src/agent-v2/deploy/concierge/src/prompts/onboarding.ts`
- **Related Components**: Bootstrap session, Build Mode UI
- **Database Changes**: No

## Acceptance Criteria

- [ ] Agent knows it's in Build Mode dashboard
- [ ] Agent references "preview" naturally in responses
- [ ] Agent doesn't ask for URL when preview is visible
- [ ] Agent says "Check your preview" after making changes

## Work Log

### 2026-01-27 - Issue Identified

**By:** Claude Code Review
**Actions:**

- Discovered during production E2E snap observation
- Agent asked for URL when already in Build Mode
- Grep confirmed "Build Mode" appears 0 times in agent code

**Learnings:**

- Agent prompts must include environmental context
- Users expect agent to understand its visual context

## Resources

- Build Mode vision: `docs/architecture/BUILD_MODE_VISION.md`
- System prompt: `server/src/agent-v2/deploy/concierge/src/agent.ts:65-257`

## Notes

Source: `/workflows:review` session on 2026-01-27
Priority: P2 because confusing UX but not data loss
