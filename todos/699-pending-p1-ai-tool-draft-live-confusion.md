---
status: pending
priority: p1
issue_id: '699'
tags: [code-review, ai-tools, user-trust, messaging]
dependencies: []
---

# AI Tools Misleading About Draft vs Live Status

## Problem Statement

AI tools read from draft config (`landingPageConfigDraft`) but their descriptions and response notes don't clearly communicate this to the AI. The AI confidently states content is "live" or "on your storefront" when it's actually draft content not visible to visitors.

**User Trust Impact:** Users believe AI statements about their "live" storefront, make business decisions, and are confused when the actual site shows different content.

## Findings

### Observed Bug

**User asked:** "Update my hero headline to 'A Voice for Those Who Served' and publish"

**AI responded:** "The current hero headline in your live configuration is exactly: 'A Voice for Those Who Served'. Since there's no draft and this is already your live headline, there's nothing to publish."

**Reality:** The live storefront showed "[Hero Headline]" placeholder.

### Tools Affected

| Tool                        | Issue                                                      |
| --------------------------- | ---------------------------------------------------------- |
| `get_section_by_id`         | Says "current content" without clarifying draft vs live    |
| `list_section_ids`          | Says "tenant's storefront" but reads from draft            |
| `get_landing_page_draft`    | Note says "Live config is being shown" when hasDraft=false |
| `get_unfilled_placeholders` | Same issue - reads draft, implies live                     |
| `get_current_view`          | UI tool has same ambiguity                                 |

### Root Cause

The `getDraftConfigWithSlug` function reads from `landingPageConfigDraft` first:

```typescript
if (tenant.landingPageConfigDraft) {
  return { pages: draft.pages, hasDraft: true }; // This is DRAFT
}
const live = tenant.landingPageConfig; // This might also be draft in wrapper!
return { pages: live?.pages, hasDraft: false };
```

Tools return `source: 'draft' | 'live'` but descriptions don't tell AI how to communicate this.

## Proposed Solutions

### Option A: Update Tool Descriptions with Communication Rules (Recommended)

**Pros:** Low effort, high impact, immediate fix
**Cons:** Relies on AI following instructions
**Effort:** Small (2-3 hours)
**Risk:** Low

Add explicit communication guidance to each tool description:

```typescript
description: `Get full content of a section by its ID.

Returns content from the DRAFT config if one exists, otherwise from LIVE.
Check 'source' field to know which version.

COMMUNICATION RULES:
- If source is 'draft': Say "In your draft (unpublished), the headline is..."
- If source is 'live': Say "On your live storefront, the headline is..."
- NEVER say "live" or "visitors see" when source is 'draft'`,
```

### Option B: Add System Prompt Section for Draft/Live Communication

**Pros:** Central guidance, applies to all tools
**Cons:** More system prompt complexity
**Effort:** Small (1-2 hours)
**Risk:** Low

Add to `onboarding-system-prompt.ts`:

```
### Draft vs Live Communication (CRITICAL)

When reading storefront content, ALWAYS check the source field:

**Draft Content (source: 'draft' or hasDraft: true):**
- "In your draft, the headline says..."
- NEVER say: "Your storefront shows...", "Visitors see..."

**Live Content (source: 'live' or hasDraft: false):**
- "On your live storefront, visitors see..."
```

### Option C: Tool Response Includes Pre-formatted Message

**Pros:** Consistent messaging, AI can't get it wrong
**Cons:** Less flexible AI responses
**Effort:** Medium (3-4 hours)
**Risk:** Low

Tools return a `userMessage` field with properly formatted text:

```typescript
return {
  content: section,
  source: 'draft',
  userMessage: 'In your unpublished draft, the hero headline is "A Voice for Those Who Served".',
};
```

## Recommended Action

Implement **both Option A and Option B**:

1. Update individual tool descriptions with specific guidance
2. Add central "Draft vs Live Communication" section to system prompts

## Technical Details

### Affected Files

- `server/src/agent/tools/storefront-tools.ts` (multiple tool descriptions)
- `server/src/agent/tools/ui-tools.ts` (get_current_view)
- `server/src/agent/prompts/onboarding-system-prompt.ts`
- `server/src/agent/prompts/admin-system-prompt.ts` (if exists)

### Tools to Update

1. `get_landing_page_draft` (line 866)
2. `list_section_ids` (line 1058)
3. `get_section_by_id` (line 1182)
4. `get_unfilled_placeholders` (line 1273)
5. `get_current_view` in ui-tools.ts (line 216)

### Response Note Updates

```typescript
// Before
note: hasDraft
  ? 'Draft has unpublished changes. Use publish_draft to make them live.'
  : 'No draft changes. Live config is being shown.',

// After
note: hasDraft
  ? 'DRAFT MODE: All content shown is UNPUBLISHED. Visitors see the live version until you publish.'
  : 'LIVE MODE: Content shown is what visitors currently see on your storefront.',
```

## Acceptance Criteria

- [ ] AI never says "live" or "on your storefront" when reading draft content
- [ ] AI clearly distinguishes "In your draft..." vs "On your live site..."
- [ ] Tool descriptions include explicit communication rules
- [ ] System prompt has draft/live communication section
- [ ] Integration test: AI response uses correct language based on source

## Work Log

| Date       | Action                                         | Learnings                             |
| ---------- | ---------------------------------------------- | ------------------------------------- |
| 2026-01-10 | Code review discovered misleading AI messaging | AI trusts tool descriptions literally |

## Resources

- AI accuracy review: agent ad01142
- User trust implications documented in findings
- Related: `getDraftConfigWithSlug` in tools/utils.ts
