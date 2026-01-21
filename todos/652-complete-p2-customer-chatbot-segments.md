---
status: completed
priority: p2
issue_id: 652
tags: [code-review, agent-parity, chatbot, customer-experience]
dependencies: []
completed_at: 2026-01-21
---

# Customer Chatbot Cannot Browse Segments

## Problem Statement

The customer chatbot cannot list available segments or get segment details. When customers ask "What types of services do you offer?", the chatbot cannot provide segment-level information - it can only list packages.

**Why it matters:** The new segment-first UI shows segment cards prominently. Customers chatting with the bot should get the same browsing experience.

## Findings

**Location:** `/Users/mikeyoung/CODING/MAIS/server/src/agent/customer/customer-tools.ts`

**Current `get_services` tool:**

- Can filter by `category` (segment slug)
- Returns segment name with packages via join
- Cannot list all segments
- Cannot get segment details (heroTitle, heroSubtitle, description)

**Gap:** When a customer asks "Tell me about your wellness retreats", the chatbot cannot describe the segment - only list packages within it.

**Source:** agent-native-reviewer agent

## Proposed Solutions

### Option 1: Add browse_service_categories Tool (Recommended)

Add a new T1 read tool for listing segments:

```typescript
{
  name: 'browse_service_categories',
  trustTier: 'T1', // Read-only
  description: 'Browse available service categories. Returns list of service types with descriptions.',
  inputSchema: {
    type: 'object',
    properties: {},
  },
  async execute(context: ToolContext): Promise<AgentToolResult> {
    const { tenantId, prisma } = context;

    const segments = await prisma.segment.findMany({
      where: { tenantId, active: true },
      select: {
        id: true,
        slug: true,
        name: true,
        heroTitle: true,
        heroSubtitle: true,
        heroImage: true,
        description: true,
        _count: { select: { packages: { where: { active: true } } } },
      },
      orderBy: { sortOrder: 'asc' },
    });

    return {
      success: true,
      data: segments.map(s => ({
        id: s.id,
        slug: s.slug,
        name: s.name,
        title: s.heroTitle,
        subtitle: s.heroSubtitle,
        image: s.heroImage,
        description: s.description,
        packageCount: s._count.packages,
      })),
    };
  },
}
```

**Pros:**

- Clear purpose
- Matches segment-first UI
- T1 = no confirmation needed

**Cons:**

- New tool to maintain

**Effort:** Medium (30 min)
**Risk:** Low

### Option 2: Enhance get_services Tool

Modify existing tool to return segments when no category filter:

```typescript
// If no category specified, return segment overview first
if (!params.category) {
  const segments = await prisma.segment.findMany({...});
  return { segments, packages: [] };
}
```

**Pros:**

- No new tool
- Leverages existing code

**Cons:**

- Changes existing behavior
- Less explicit

**Effort:** Small (15 min)
**Risk:** Medium (might break existing flows)

## Recommended Action

Option 1 - Add dedicated browse_service_categories tool

## Technical Details

**Affected files:**

- `server/src/agent/customer/customer-tools.ts`

**System prompt update:**
Also update customer chatbot system prompt to mention the new tool for browsing categories.

## Acceptance Criteria

- [ ] Customer chatbot can list all service categories
- [ ] Categories include name, description, and package count
- [ ] Chatbot can describe a specific segment in detail
- [ ] Tool is T1 (no confirmation required)

## Work Log

| Date       | Action                   | Learnings                                    |
| ---------- | ------------------------ | -------------------------------------------- |
| 2026-01-08 | Created from code review | Chatbot should mirror UI browsing experience |

## Resources

- MAIS agent parity principle
- Code review: Segment-first browsing implementation
