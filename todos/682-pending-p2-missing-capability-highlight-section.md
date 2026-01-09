---
status: pending
priority: p2
issue_id: '682'
tags: [code-review, agent-first-architecture, agent-parity, capability-registry]
dependencies: []
---

# P2: Missing Capability for `highlight_section`

## Problem Statement

The `highlight_section` UI tool exists in the backend but is NOT registered in `AGENT_CAPABILITIES`. Users cannot discover this capability via search or command palette.

**Why This Matters:**

- Breaks discoverability principle
- Users can't learn about section highlighting feature
- Command palette (when implemented) won't show this action

## Findings

**Agent:** Agent-Native Reviewer

**Locations:**

- Backend tool exists: `server/src/agent/tools/ui-tools.ts` (lines 229-274)
- Missing from: `apps/web/src/lib/agent-capabilities.ts`

## Proposed Solutions

### Option A: Add capability to registry (Recommended)

```typescript
{
  id: 'highlight_section',
  name: 'Highlight Section',
  description: 'Highlight a specific section in the preview to show what you\'re referring to',
  category: 'navigation',
  keywords: ['highlight', 'show', 'point', 'section', 'indicate', 'focus'],
  trustTier: 'T1',
  example: 'Highlight the hero section',
}
```

- **Pros:** Complete capability registry
- **Cons:** None
- **Effort:** Small
- **Risk:** None

## Recommended Action

**Option A** - Add capability entry for highlight_section.

## Technical Details

**Affected Files:**

- `apps/web/src/lib/agent-capabilities.ts`

## Acceptance Criteria

- [ ] `highlight_section` capability exists in registry
- [ ] Searchable via keywords
- [ ] Trust tier is T1 (read-only navigation action)

## Work Log

| Date       | Action                     | Outcome        |
| ---------- | -------------------------- | -------------- |
| 2026-01-09 | Created during code review | Initial filing |

## Resources

- PR: Agent-First Dashboard Architecture (Phases 1-5)
