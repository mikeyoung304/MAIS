---
status: complete
priority: p3
issue_id: '690'
tags: [code-review, agent-first-architecture, yagni, simplicity]
dependencies: []
---

# P3: Capability Registry Functions Mostly Unused

## Problem Statement

The following exports in `agent-capabilities.ts` are only used in tests, not production code:

- `searchCapabilities()` - Built for Cmd+K command palette that doesn't exist yet
- `getCapabilitiesByCategory()` - Never used in components
- `getCapabilitiesByTier()` - Never used in components
- `getCapability()` - Never used in components
- `getCategories()` - Never used in components
- `getCapabilitiesGrouped()` - Never used in components
- `CATEGORY_ICONS` - Never used in components
- `CATEGORY_DISPLAY_NAMES` - Never used in components
- `TRUST_TIER_DESCRIPTIONS` - Never used in components
- `TRUST_TIER_COLORS` - Never used in components

The entire 425-line file exists primarily for a command palette feature that isn't implemented.

## Findings

**Agent:** Code Simplicity Reviewer (DHH-style)

**Location:** `apps/web/src/lib/agent-capabilities.ts`

## Proposed Solutions

### Option A: Mark as Phase X scaffolding (Recommended)

- Add file-level comment explaining this is for command palette
- Link to feature plan/ticket
- **Pros:** Clear intent
- **Cons:** Still carrying unused code
- **Effort:** Small
- **Risk:** None

### Option B: Strip to minimal

- Keep only `AGENT_CAPABILITIES` array
- Remove unused helper functions
- **Pros:** Simpler
- **Cons:** Re-implementation when needed
- **Effort:** Medium
- **Risk:** Low

## Recommended Action

**Option A** - Document as scaffolding. Command palette is mentioned in the architecture plan's "Future Considerations".

## Technical Details

**Affected Files:**

- `apps/web/src/lib/agent-capabilities.ts`

## Acceptance Criteria

- [ ] File purpose is clearly documented
- [ ] Unused code is either documented or removed

## Work Log

| Date       | Action                     | Outcome        |
| ---------- | -------------------------- | -------------- |
| 2026-01-09 | Created during code review | Initial filing |

## Resources

- PR: Agent-First Dashboard Architecture (Phases 1-5)
