# Autonomous First Draft Workflow

**Date:** 2026-02-03
**Issue:** Agent says "I put together a first draft" but content shows placeholders
**Root Cause:** System prompt lacked explicit instructions for autonomous content generation
**Solution:** Added "First Draft Workflow (Autonomous)" section to tenant agent system prompt

## Problem

When onboarding new tenants, the agent would:

1. Interview the user about their business
2. Store discovery facts via `store_discovery_fact` tool
3. Say "Take a look - I put together a first draft"
4. **BUT** never actually call `update_section` to update content

The preview showed placeholder content ("Welcome to My Business") instead of personalized content.

## Root Cause Analysis

The system prompt at line 59 said:

```
**After storing facts, build in the background. When enough is done:**
"Take a look - I put together a first draft."
```

But it never explained HOW to "build in the background." The only workflow described (line 98) was:

```
generate_copy → you create options → user approves → update_section
```

This workflow requires **explicit user approval** before updating content. The agent was waiting for approval that never came during the interview pattern.

## The Gap

| Expected Behavior                  | Actual Behavior                   |
| ---------------------------------- | --------------------------------- |
| Agent stores facts                 | ✅ Works                          |
| Agent generates personalized copy  | ❌ Skipped (waiting for approval) |
| Agent calls update_section         | ❌ Never called                   |
| Preview shows personalized content | ❌ Shows placeholders             |

## Solution

Added explicit "First Draft Workflow (Autonomous)" section to the system prompt that:

1. **Triggers autonomously** after gathering 2-3 key facts (businessType, uniqueValue, dreamClient)
2. **Instructs agent to call `get_page_structure`** to find placeholder sections
3. **Explicitly allows generating and applying copy WITHOUT approval** for first draft
4. **Clarifies messaging** to say "Check the preview" (draft-aware)

### New Prompt Section

```markdown
### First Draft Workflow (Autonomous)

**CRITICAL: Build the first draft without waiting for approval.**

After gathering at least 2-3 key facts (businessType, uniqueValue, OR dreamClient):

1. **Call get_page_structure** to get section IDs and see which have placeholders
2. **For each placeholder section**, generate personalized copy based on stored facts
3. **Call update_section for each** with your generated copy - NO approval needed
4. **After all updates:** "I put together a first draft in the preview. Check it out!"

**Why autonomous?** Users expect magic. They talk about their business,
then see a personalized site. Making them approve each headline kills the experience.
```

## Why This Matters

Users onboarding to HANDLED expect a "magic" experience:

- They describe their business in conversation
- The site builds itself in real-time
- They see personalized content without manual steps

Requiring approval for each piece of copy during initial onboarding:

- Breaks the flow
- Feels like work, not magic
- Defeats the purpose of "done-for-you" positioning

## Related Files

- `server/src/agent-v2/deploy/tenant/src/prompts/system.ts` - System prompt (MODIFIED)
- `server/src/agent-v2/deploy/tenant/src/tools/storefront-write.ts` - update_section tool
- `server/src/agent-v2/deploy/tenant/src/tools/discovery.ts` - store_discovery_fact tool
- `server/src/services/section-content.service.ts` - Backend service

## Verification

After this fix, the agent should:

1. Interview user → Store facts
2. After 2-3 facts: Call `get_page_structure`
3. Generate copy based on facts
4. Call `update_section` for hero, about sections
5. Say: "I put together a first draft in the preview. What do you want to tweak?"

## Related Pitfalls

- **Pitfall #88:** Fact-to-Storefront bridge missing - this was a symptom
- **Pitfall #90:** dashboardAction not extracted - related to preview refresh
- **Pitfall #91:** Agent asking known questions - related to context injection

## Future Considerations

1. **Deploy the updated agent** to Cloud Run after merging
2. **E2E test** the onboarding flow end-to-end
3. **Monitor** Cloud Run logs for `update_section` calls during onboarding
