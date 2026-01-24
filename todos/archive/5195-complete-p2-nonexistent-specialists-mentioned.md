---
status: complete
priority: p2
issue_id: '5195'
tags: [code-review, agent-v2, documentation]
dependencies: []
---

# Concierge Mentions Non-Existent IMAGE_SPECIALIST and VIDEO_SPECIALIST

## Problem Statement

Concierge's system prompt decision tree references IMAGE_SPECIALIST and VIDEO_SPECIALIST agents that don't exist and have no corresponding tools.

**Why it matters:** The LLM might attempt to delegate to non-existent specialists, causing confusion or hallucinated responses about media capabilities.

## Findings

**Location:** `server/src/agent-v2/deploy/concierge/src/agent.ts` (lines 76-81)

Decision tree includes:

```
├─ Media/Visuals → IMAGE_SPECIALIST or VIDEO_SPECIALIST
│  └─ "I'll have our media specialist create that. Cost estimate: ~$X"
```

But no `delegate_to_image` or `delegate_to_video` tools exist. Only:

- `delegate_to_marketing`
- `delegate_to_storefront`
- `delegate_to_research`

## Proposed Solutions

### Option A: Remove References (Recommended)

**Pros:** Accurate documentation, no hallucination risk
**Cons:** Loses vision of future capability
**Effort:** Small (15 min)

Simply remove the IMAGE_SPECIALIST and VIDEO_SPECIALIST lines from the decision tree.

### Option B: Mark as "Coming Soon"

**Pros:** Preserves roadmap intent
**Cons:** LLM might still try to use them
**Effort:** Small (15 min)

```
├─ Media/Visuals → [Coming Soon - suggest manual upload for now]
```

### Option C: Implement the Specialists

**Pros:** Full functionality
**Cons:** Major new work
**Effort:** Large (weeks)

## Technical Details

**Affected Files:**

- `server/src/agent-v2/deploy/concierge/src/agent.ts`

## Acceptance Criteria

- [ ] Decision tree only references existing specialists
- [ ] LLM doesn't try to delegate to non-existent agents
- [ ] Clear guidance for media requests

## Work Log

| Date       | Action  | Notes                    |
| ---------- | ------- | ------------------------ |
| 2026-01-19 | Created | From agent-native review |
