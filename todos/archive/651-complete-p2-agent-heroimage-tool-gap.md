---
status: complete
priority: p2
issue_id: 651
tags: [code-review, agent-parity, tools, onboarding]
dependencies: []
completed_at: 2026-01-21
---

# Agent Cannot Set Segment Hero Images

## Problem Statement

The Business Advisor agent's `upsert_segment` tool does NOT include `heroImage` in its input schema, even though the database field exists. The agent cannot help tenants set segment hero images that appear on the storefront.

**Why it matters:** Per MAIS philosophy: "Whatever the user can do, the agent can do." The new segment-first UI prominently displays hero images, but agents cannot configure them.

## Findings

**Location:** `/Users/mikeyoung/CODING/MAIS/server/src/agent/tools/write-tools.ts`

- Lines 1165-1251 (upsert_segment tool)

**Current tool supports:**

- `slug`, `name`, `heroTitle`, `heroSubtitle`, `description`, `sortOrder`, `active`

**Missing:**

- `heroImage` - URL to segment-specific hero image

**Database schema supports it:**

```prisma
// server/prisma/schema.prisma line 227
model Segment {
  heroImage String?  // ← Field exists but not in tool
}
```

**Source:** agent-native-reviewer agent

## Proposed Solutions

### Option 1: Add heroImage to upsert_segment Tool (Recommended)

Update the tool's input schema and payload:

```typescript
// In inputSchema.properties (around line 1169):
heroImage: {
  type: 'string',
  description: 'URL to segment hero image displayed on storefront segment cards',
},

// In payload construction (around line 1223):
heroImage: params.heroImage,
```

**Pros:**

- Direct solution
- Maintains agent parity
- Simple change

**Cons:**

- None significant

**Effort:** Small (15 min)
**Risk:** Low

### Option 2: Use Existing File Upload Flow

The `request_file_upload` tool already supports `fileType: 'segment'`. Could integrate hero image upload through that flow.

**Pros:**

- Uses existing infrastructure
- Better for uploading new images

**Cons:**

- More complex flow for URL-based images
- Requires two-step process

**Effort:** Medium (30 min)
**Risk:** Low

## Recommended Action

Option 1 - Add heroImage to upsert_segment tool. Can use Option 2 flow separately for uploads.

## Technical Details

**Affected files:**

- `server/src/agent/tools/write-tools.ts`

**Schema validation:**
The Prisma schema already validates heroImage as String. Add URL validation in the tool if needed:

```typescript
heroImage: {
  type: 'string',
  format: 'uri',
  description: 'URL to segment hero image',
},
```

## Acceptance Criteria

- [ ] `upsert_segment` tool accepts `heroImage` parameter
- [ ] Agent can set segment hero image via conversation
- [ ] Hero image displays on storefront after agent sets it
- [ ] Tool documentation updated

## Work Log

| Date       | Action                   | Learnings                                      |
| ---------- | ------------------------ | ---------------------------------------------- |
| 2026-01-08 | Created from code review | New UI features need corresponding agent tools |

## Resources

- MAIS agent parity principle
- Code review: Segment-first browsing implementation
