# Agent Section Behavior Analysis Report

**Date:** 2026-02-03
**Author:** Claude (Deep Analysis Session)
**Status:** Comprehensive Analysis Complete

---

## Executive Summary

The MAIS/HANDLED tenant agent has a sophisticated section-based architecture for storefront editing, but several behavioral gaps prevent optimal user experience during onboarding. This report analyzes the current state, identifies issues, and provides a roadmap for optimization.

### Key Findings

| Aspect                           | Current State                    | Optimal State                | Gap           |
| -------------------------------- | -------------------------------- | ---------------------------- | ------------- |
| **Autonomous Draft Generation**  | Fixed today                      | ✅ Working                   | Closed        |
| **Section Scroll After Update**  | Instruction exists, not enforced | Auto-scroll every time       | **Open**      |
| **Section-by-Section Workflow**  | Not implemented                  | Guided sequential editing    | **Open**      |
| **Publish Before Next Section**  | Not implemented                  | Optional progressive publish | **Open**      |
| **Visual Feedback on Highlight** | Works in code                    | Needs verification           | Needs testing |

---

## Section 1: How the Agent Interacts with Sections

### 1.1 Reading Sections (T1 - Immediate)

The agent has two primary read tools:

```
get_page_structure → Returns all section IDs, types, headlines, placeholder flags
get_section_content(sectionId) → Returns full content of a specific section
```

**Current Prompt Instructions (system.ts:99-111):**

```
**Read first, then act:** Call get_page_structure before any update.
It gives you the exact IDs you need.

**After updates:** Call scroll_to_website_section to show the change.
```

**Issue:** The instruction "After updates: Call scroll_to_website_section" is **advisory, not enforced**. The agent may forget to scroll.

### 1.2 Writing Sections (T2 - Draft)

```
update_section(sectionId, content) → Updates section content (goes to draft)
add_section(pageName, type, content) → Adds new section
remove_section(sectionId) → Removes section
reorder_sections(sectionIds) → Reorders sections
```

**All writes go to draft first.** The `update_section` tool returns:

```typescript
{
  success: true,
  verified: true,
  hasDraft: true,
  visibility: 'draft',
  message: 'Section updated in draft. Publish when ready to go live.',
  updatedSection: {...},
  dashboardAction: {
    type: 'SCROLL_TO_SECTION',
    sectionId: updated.id,
  },
}
```

**Key Finding:** The `update_section` tool DOES return a `dashboardAction` to scroll, but the agent isn't instructed to chain this with an explicit `scroll_to_website_section` call.

### 1.3 Navigation & Scroll Tools (T1 - Immediate)

```
scroll_to_website_section(blockType, highlight) → Scrolls preview to section
navigate_to_section(section) → Navigates dashboard (website, bookings, etc.)
show_preview(fullScreen) → Shows/refreshes the preview panel
```

---

## Section 2: How the Agent Prompt Works with Sections

### 2.1 Onboarding Flow (Interview → First Draft)

**Fixed Today:** Added "First Draft Workflow (Autonomous)" section (lines 59-81):

```markdown
### First Draft Workflow (Autonomous)

**CRITICAL: Build the first draft without waiting for approval.**

After gathering at least 2-3 key facts (businessType, uniqueValue, OR dreamClient):

1. **Call get_page_structure** to get section IDs and see which have placeholders
2. **For each placeholder section**, generate personalized copy based on stored facts
3. **Call update_section for each** with your generated copy - NO approval needed
4. **After all updates:** "I put together a first draft in the preview. Check it out!"
```

**This closes the gap where the agent said "first draft ready" but never updated content.**

### 2.2 Post-First-Draft Refinement Flow

**Current Prompt (lines 83-88, 120):**

```
### Generate-Then-Refine (Post First Draft)

You generate copy. They give feedback. You refine. They approve. You apply.

Ask for approval: "How about: 'Love in Every Frame'?"
When approved: update via tools → scroll to show → "Done. Take a look."

**Workflow:** generate_copy → you create options → user approves →
update_section → scroll_to_website_section
```

**Issue:** The workflow mentions `scroll_to_website_section` at the end but doesn't enforce it.

### 2.3 Section-by-Section Workflow

**Current State:** NOT IMPLEMENTED

The prompt doesn't instruct the agent to:

1. Work on one section at a time
2. Get approval before moving to the next
3. Offer to publish after each section is finalized

**Optimal Behavior:**

```
Agent: "Let's start with your headline. How about: 'Love in Every Frame'?"
User: "I like it but can we make it shorter?"
Agent: "Got it - 'Every Frame, A Story.' What do you think?"
User: "Perfect"
Agent: [calls update_section → scroll_to_website_section]
       "Done - check it out in the preview. Ready to move to your About section,
        or want to publish this change first?"
```

---

## Section 3: Automatic Scroll Behavior Analysis

### 3.1 Does the Agent Auto-Scroll After Updates?

**Partial.** Here's the flow:

1. Agent calls `update_section`
2. Tool returns `dashboardAction: { type: 'SCROLL_TO_SECTION', sectionId: '...' }`
3. Frontend extracts `dashboardAction` from tool result (AgentPanel.tsx:210-222)
4. Frontend calls `agentUIActions.highlightSection(sectionId)`
5. Zustand store updates `highlightedSectionId`
6. PreviewPanel scrolls to that section

**The scroll SHOULD happen automatically** via the `dashboardAction` return, BUT:

- The agent prompt still says "After updates: Call scroll_to_website_section"
- This is redundant if `dashboardAction` works
- If `dashboardAction` extraction fails, nothing scrolls

### 3.2 Frontend Code for dashboardAction Extraction

**AgentPanel.tsx:189-230:**

```typescript
const handleDashboardActions = useCallback(
  async (
    toolCalls: Array<{
      name: string;
      args: Record<string, unknown>;
      result?: { dashboardAction?: DashboardAction };
    }>
  ) => {
    for (const call of toolCalls) {
      const action = call.result?.dashboardAction;
      if (!action) continue;

      switch (action.type) {
        case 'SCROLL_TO_SECTION':
          if (action.sectionId) {
            agentUIActions.highlightSection(action.sectionId);
          } else if (action.blockType) {
            const sectionId = `home-${action.blockType}-primary`;
            agentUIActions.highlightSection(sectionId);
          }
          break;
        // ... other cases
      }
    }
  },
  [agentUIActions, queryClient]
);
```

**This is wired up and should work.** But I noticed:

- Pitfall #90 mentions "dashboardAction not extracted from tool results" as a historical issue
- The fix was added but needs verification

---

## Section 4: Gaps and Recommendations

### Gap 1: No Section-by-Section Workflow ⚠️ HIGH PRIORITY

**Current:** Agent updates all placeholder sections in one batch during first draft
**Problem:** User has no control over individual sections
**Fix:** Add "Guided Refinement Mode" to the prompt

**Proposed Addition to system.ts:**

```markdown
### Guided Refinement Mode (Post First Draft)

After first draft, work section-by-section:

1. **Ask which section to refine:** "The first draft is ready. Where should we start -
   headline, about section, or something else?"
2. **Focus on one section at a time:**
   - Show current content
   - Generate 2-3 options
   - Get approval
   - Update and scroll to show
3. **Before moving on:** "Happy with that? Want to publish it now, or keep tweaking?"
4. **After approval:** Call scroll_to_website_section to highlight what changed

This builds confidence - they see each piece come together.
```

### Gap 2: Scroll Instruction is Redundant ⚠️ MEDIUM PRIORITY

**Current:** Prompt says "After updates: Call scroll_to_website_section"
**But:** `update_section` already returns `dashboardAction` that auto-scrolls
**Risk:** Double-scroll if both fire, or no scroll if agent skips the explicit call

**Fix:** Remove the manual scroll instruction OR verify dashboardAction always works

### Gap 3: No Progressive Publish Option ⚠️ LOW PRIORITY

**Current:** All changes stay in draft until user explicitly publishes everything
**Problem:** User might want to publish one section while still editing others
**Fix:** Add per-section publish capability (significant backend work)

### Gap 4: Visual Highlight Feedback Needs Testing ⚠️ NEEDS VERIFICATION

**Current:** `highlightSection` sets `highlightedSectionId` in Zustand store
**Assumption:** PreviewPanel reads this and applies visual highlight
**Action:** Manually verify the highlight CSS animation is visible

---

## Section 5: Current Agent Tool Inventory

### Storefront Tools (27 total)

| Category       | Tools                                                         | Purpose                      |
| -------------- | ------------------------------------------------------------- | ---------------------------- |
| **Navigation** | navigate_to_section, scroll_to_website_section, show_preview  | UI control                   |
| **Read**       | get_page_structure, get_section_content                       | Read current state           |
| **Write**      | update_section, add_section, remove_section, reorder_sections | Modify sections              |
| **Branding**   | update_branding                                               | Colors, fonts, logo          |
| **Draft**      | preview_draft, publish_draft (T3), discard_draft (T3)         | Publish flow                 |
| **Page**       | toggle_page                                                   | Enable/disable pages         |
| **Vocabulary** | resolve_vocabulary                                            | Map natural phrases to types |
| **Marketing**  | generate_copy, improve_section_copy                           | Copy generation              |
| **Discovery**  | store_discovery_fact, get_known_facts                         | Onboarding facts             |
| **Packages**   | manage_packages                                               | Bookable services            |
| **Project**    | 7 tools for project management                                | Customer projects            |

---

## Section 6: Architecture Summary

```
┌─────────────────────────────────────────────────────────────────────┐
│                        TENANT DASHBOARD                              │
├─────────────────────────┬───────────────────────────────────────────┤
│                         │                                            │
│   AgentPanel            │         ContentArea                        │
│   ┌─────────────────┐   │         ┌──────────────────────────────┐  │
│   │ ConciergeChat   │   │         │ PreviewPanel                 │  │
│   │                 │   │         │ ┌────────────────────────┐   │  │
│   │ User: "update   │   │         │ │ iframe: /t/[slug]      │   │  │
│   │ my headline"    │──────────▶  │ │                        │   │  │
│   │                 │   │         │ │ ┌──────────────────┐   │   │  │
│   │ Agent: calls    │   │         │ │ │ Hero Section     │◀──│───│──┐
│   │ update_section  │   │         │ │ │ (highlighted)    │   │   │  │
│   │                 │   │         │ │ └──────────────────┘   │   │  │
│   │ Tool returns:   │   │         │ │ ┌──────────────────┐   │   │  │
│   │ dashboardAction:│──────────▶  │ │ │ About Section    │   │   │  │
│   │ SCROLL_TO_HERO  │   │         │ │ └──────────────────┘   │   │  │
│   └─────────────────┘   │         │ └────────────────────────┘   │  │
│                         │         │ [Publish] [Discard]          │  │
│                         │         └──────────────────────────────┘  │
│                         │                                            │
└─────────────────────────┴───────────────────────────────────────────┘
                                        │
                                        │ dashboardAction extracted
                                        ▼
                              ┌─────────────────────┐
                              │ Zustand Store       │
                              │ (agent-ui-store.ts) │
                              │                     │
                              │ highlightSection()  │
                              │ → updates state     │
                              │ → triggers scroll   │
                              └─────────────────────┘
```

---

## Section 7: Next Steps for Optimization

### Immediate (Today/Tomorrow)

1. **Test dashboardAction scroll** - Verify the auto-scroll actually works in browser
2. **Deploy updated agent** - Push system prompt changes to Cloud Run
3. **Manual E2E test** - Walk through onboarding with a test tenant

### Short Term (This Week)

1. **Add Guided Refinement Mode** - Section-by-section workflow in prompt
2. **Remove redundant scroll instruction** - Trust dashboardAction
3. **Add E2E test** - Verify scroll_to_website_section works

### Medium Term (This Sprint)

1. **Progressive publish** - Per-section publish capability
2. **Undo/Redo** - Scaffold exists in Zustand, implement UI
3. **Section templates** - Pre-built section content for common industries

---

## Handoff Context for Fresh Session

See below for a comprehensive prompt to take to a new context window.
