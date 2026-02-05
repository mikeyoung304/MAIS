# Phase 4 Agent Migration Debt - Comprehensive Analysis

**Date:** 2026-01-31
**Status:** Active Investigation
**Severity:** HIGH - Blocking core onboarding flow
**Related:** Pitfall #88, Pitfall #53, Todos #800, #807

---

## Executive Summary

The Phase 4 agent consolidation (January 2026) successfully migrated tools from 5 legacy agents into 2 unified agents (tenant-agent, customer-agent). However, several integration issues remain that cause:

1. **Agent repeats questions** ("What do you do?") despite user already answering
2. **Auto-scroll not working** after section updates
3. **FAQ/CTA section updates failing** in onboarding
4. **Stale frontend references** to retired multi-agent architecture

**Root Cause:** Discovery facts are stored but never pre-loaded into agent context. The agent starts each turn with blank memory.

---

## Table of Contents

1. [Architecture Context](#1-architecture-context)
2. [Issue #1: Agent Repetition Loop](#2-issue-1-agent-repetition-loop)
3. [Issue #2: Dashboard Actions Not Flowing](#3-issue-2-dashboard-actions-not-flowing)
4. [Issue #3: FAQ/CTA Section Updates Failing](#4-issue-3-faqcta-section-updates-failing)
5. [Issue #4: Stale Frontend References](#5-issue-4-stale-frontend-references)
6. [Issue #5: Placeholder Text Training Strategy](#6-issue-5-placeholder-text-training-strategy)
7. [Recommended Fix Order](#7-recommended-fix-order)
8. [Files Reference](#8-files-reference)

---

## 1. Architecture Context

### 1.1 Phase 4 Migration (January 2026)

| Legacy Agent      | Migrated To     | Date       | Archived Location               |
| ----------------- | --------------- | ---------- | ------------------------------- |
| storefront-agent  | tenant-agent    | 2026-01-30 | git history (directory deleted) |
| marketing-agent   | tenant-agent    | 2026-01-30 | git history (directory deleted) |
| concierge-agent   | tenant-agent    | 2026-01-30 | git history (directory deleted) |
| booking-agent     | customer-agent  | 2026-01-31 | git history (directory deleted) |
| project-hub-agent | customer+tenant | 2026-01-31 | git history (directory deleted) |

**Current Active Agents:**

- `tenant-agent` - 26 tools, handles all tenant-facing tasks
- `customer-agent` - 13 tools, handles booking and project hub (customer view)
- `research-agent` - Web research (unchanged)

### 1.2 Communication Flow

```
Frontend (Next.js)
    │
    ├─ useConciergeChat hook
    │      │
    │      └─ POST /api/tenant-admin/agent/chat (proxy)
    │
Backend (Express on Render)
    │
    ├─ tenant-admin-tenant-agent.routes.ts
    │      │
    │      └─ A2A Protocol (camelCase: appName, userId, sessionId, newMessage)
    │
Cloud Run (tenant-agent)
    │
    ├─ ADK LlmAgent with 26 tools
    │      │
    │      └─ Calls back to backend via callMaisApi() for data operations
    │
Backend Internal Routes
    │
    └─ /v1/internal/agent/* endpoints
```

### 1.3 Tool Registry (26 tools)

| Category           | Tools                                                         | Count |
| ------------------ | ------------------------------------------------------------- | ----- |
| Navigation         | navigate_to_section, scroll_to_website_section, show_preview  | 3     |
| Vocabulary         | resolve_vocabulary                                            | 1     |
| Storefront Read    | get_page_structure, get_section_content                       | 2     |
| Storefront Write   | update_section, add_section, remove_section, reorder_sections | 4     |
| Branding           | update_branding                                               | 1     |
| Draft Management   | preview_draft, publish_draft (T3), discard_draft (T3)         | 3     |
| Page Toggle        | toggle_page                                                   | 1     |
| Marketing          | generate_copy, improve_section_copy                           | 2     |
| Project Management | 7 tools for requests, messages, status                        | 7     |
| **Discovery**      | **store_discovery_fact, get_known_facts**                     | **2** |

---

## 2. Issue #1: Agent Repetition Loop

### 2.1 Symptoms

- Agent asks "What do you do? Give me the 30-second version."
- User answers: "I help execs"
- Agent responds, then asks again: "What do you do? Give me the 30-second version."
- Loop continues indefinitely

### 2.2 Root Cause Analysis

**The tools exist and are properly registered:**

- `store_discovery_fact` - Lines 60-150 in `discovery.ts`
- `get_known_facts` - Lines 156-220 in `discovery.ts`
- Both exported from `tools/index.ts` (lines 91-96)
- Both registered in `agent.ts` (lines 190-193)
- Backend endpoints exist and work: `/store-discovery-fact`, `/get-discovery-facts`

**The problem: Context builder doesn't fetch facts.**

```typescript
// context-builder.ts lines 161-166
const [tenantResult, segmentsResult, sectionsResult, projectsResult] = await Promise.all([
  callMaisApi('/tenant-context', tenantId),
  callMaisApi('/tenant-segments', tenantId),
  callMaisApi('/tenant-sections', tenantId),
  callMaisApi('/tenant-projects', tenantId, { activeOnly: true, limit: 10 }),
]);

// MISSING: callMaisApi('/get-discovery-facts', tenantId)
```

**The system prompt says to call `get_known_facts` first (lines 33-36):**

```
**EVERY TURN:**
1. Call get_known_facts FIRST to see what you already know
2. Skip questions for facts you already have
3. After user answers, call store_discovery_fact to save what you learned
```

**But LLMs don't reliably follow prompt instructions.** The agent sometimes skips this step, starts with blank memory, and asks redundant questions.

### 2.3 Git History of Failed Fixes

| Commit              | What It Tried                                              | Why It Failed                           |
| ------------------- | ---------------------------------------------------------- | --------------------------------------- |
| `dfefdf83`          | Added `get_known_facts` to system prompt                   | Tools weren't registered yet            |
| `b2f95c7d`          | Made tool usage "more explicit" with question→fact mapping | Still just prompt text                  |
| Current uncommitted | Added tools to agent registration                          | Tools exist but agent doesn't call them |

Commit `b2f95c7d` message even admits: _"Note: Agent still occasionally skips get_known_facts check, causing repeated questions. May need programmatic enforcement."_

### 2.4 Fix Required

**Option A: Programmatic Fix (RECOMMENDED)**

Add discovery facts to context builder so they're ALWAYS in the system prompt:

```typescript
// context-builder.ts - Add to parallel fetch
const [tenantResult, segmentsResult, sectionsResult, projectsResult, factsResult] =
  await Promise.all([
    callMaisApi('/tenant-context', tenantId),
    callMaisApi('/tenant-segments', tenantId),
    callMaisApi('/tenant-sections', tenantId),
    callMaisApi('/tenant-projects', tenantId, { activeOnly: true, limit: 10 }),
    callMaisApi('/get-discovery-facts', tenantId), // NEW
  ]);

// Add to TenantAgentContext interface
export interface TenantAgentContext {
  // ... existing fields
  discoveryFacts: Record<string, unknown>;
  knownFactKeys: string[];
}
```

Then include in the agent's context so the system prompt can reference them.

**Option B: Stronger Prompt Enforcement**

Add pseudo-code with capital letters. Less reliable since it depends on LLM compliance.

**Recommended: Option A** - The agent cannot "forget" facts if they're always present.

### 2.5 Estimated Effort

- Add to context builder: 30 minutes
- Update TenantAgentContext interface: 15 minutes
- Reference in system prompt: 15 minutes
- Test: 30 minutes
- **Total: ~1.5 hours**

---

## 3. Issue #2: Dashboard Actions Not Flowing

### 3.1 Symptoms

- Agent updates a section: "Done! Updated your hero headline."
- Agent says: "Take a look."
- Preview does NOT scroll to show the change
- User must manually scroll to verify

### 3.2 Architecture

```
Tool returns:
  { success: true, dashboardAction: { type: 'SCROLL_TO_SECTION', blockType: 'HERO' } }
      │
      ▼
Backend extracts dashboardAction from functionResponse.response
      │ (tenant-admin-tenant-agent.routes.ts lines 318-341)
      ▼
Frontend receives { response, toolCalls, dashboardActions }
      │ (useConciergeChat.ts line 344)
      ▼
AgentPanel.handleDashboardActions() processes actions
      │ (AgentPanel.tsx lines 198-225)
      ▼
agentUIActions.highlightSection() called
```

### 3.3 Where It Breaks

**Three possible failure points:**

1. **Tools not returning `dashboardAction`** in their result objects
2. **Backend not extracting correctly** (extraction code exists but may not match tool output format)
3. **Frontend not receiving** (dashboardActions array is empty)

**Most likely:** Tools don't consistently return `dashboardAction` objects. The `update_section` tool needs to return:

```typescript
return {
  success: true,
  sectionId: '...',
  dashboardAction: {
    type: 'SCROLL_TO_SECTION',
    blockType: params.blockType,
  },
};
```

### 3.4 Files to Check

1. `server/src/agent-v2/deploy/tenant/src/tools/storefront-write.ts` - Does `updateSectionTool` return `dashboardAction`?
2. `server/src/routes/tenant-admin-tenant-agent.routes.ts` - `extractDashboardActions()` function
3. `apps/web/src/hooks/useConciergeChat.ts` - Line 344, is `dashboardActions` populated?
4. `apps/web/src/components/agent/AgentPanel.tsx` - Lines 198-225, is `handleDashboardActions` called?

### 3.5 Fix Required

Ensure `updateSectionTool` (and other write tools) return `dashboardAction` objects:

```typescript
// storefront-write.ts - update_section tool
return {
  success: true,
  updated: true,
  sectionId: result.sectionId,
  // ADD THIS:
  dashboardAction: {
    type: 'SCROLL_TO_SECTION',
    blockType: params.blockType,
  },
};
```

### 3.6 Estimated Effort

- Audit all write tools: 30 minutes
- Add dashboardAction returns: 1 hour
- Test end-to-end flow: 30 minutes
- **Total: ~2 hours**

---

## 4. Issue #3: FAQ/CTA Section Updates Failing

### 4.1 Symptoms

From testing document (lines 421-463):

```
User provided 3 FAQ items with questions and answers:
- "How long is a typical session?" (2-3 hours for weddings, 1 hour for family)
- "What's your editing turnaround?" (2-3 weeks)
- "Do you travel?" (Yes, Austin + 50 miles included)

Agent response: "That didn't work. Want me to try a different approach?"
- Repeated failure on retry
- Agent entered error loop
```

CTA section also failing despite tool indicator showing success.

### 4.2 Hypothesis

FAQ and CTA sections may use different data structures (array of objects vs simple strings) that the `update_section` tool doesn't handle correctly.

**FAQ expected structure:**

```typescript
{
  blockType: 'FAQ',
  content: {
    title: 'Common Questions',
    items: [
      { question: 'How long...?', answer: '2-3 hours...' },
      { question: 'What\'s your...?', answer: '2-3 weeks...' },
    ]
  }
}
```

**CTA expected structure:**

```typescript
{
  blockType: 'CTA',
  content: {
    headline: 'Ready to Begin?',
    buttonText: 'Schedule a Call',
    buttonUrl: '#packages',
  }
}
```

### 4.3 Investigation Needed

1. Check Cloud Run logs for actual error messages during FAQ/CTA updates
2. Compare FAQ/CTA schema to working sections (Hero, About, Testimonials)
3. Verify `update_section` tool handles nested objects correctly

### 4.4 Files to Check

1. `server/src/agent-v2/deploy/tenant/src/tools/storefront-write.ts` - `updateSectionTool` validation
2. `server/src/routes/internal-agent.routes.ts` - Section update handler
3. `apps/web/src/lib/tenant.ts` - `landingPageConfig` schema for FAQ, CTA

### 4.5 Estimated Effort

- Get Cloud Run logs: 15 minutes
- Diagnose schema mismatch: 1 hour
- Fix tool validation: 1-2 hours
- Test all section types: 30 minutes
- **Total: ~3-4 hours**

---

## 5. Issue #4: Stale Frontend References

### 5.1 Files with Outdated References

| File                  | Issue                                                                  | Lines              |
| --------------------- | ---------------------------------------------------------------------- | ------------------ |
| `ConciergeChat.tsx`   | Comments reference "Marketing Agent, Storefront Agent, Research Agent" | 44-54              |
| `ConciergeChat.tsx`   | Agent detection checks for `marketing`, `storefront` in tool names     | 155-161, 288-298   |
| `useConciergeChat.ts` | Same outdated docstrings                                               | 1-24               |
| `AgentPanel.tsx`      | Has BOTH old (tool name matching) AND new (dashboardActions) patterns  | 229-271 vs 198-225 |

### 5.2 Current Tool Names (Phase 4)

Old patterns won't match current tool names:

| Old Pattern                        | Current Tool Names                      |
| ---------------------------------- | --------------------------------------- |
| `marketing`, `headline`, `copy`    | `generate_copy`, `improve_section_copy` |
| `storefront`, `section`, `layout`  | `update_section`, `get_page_structure`  |
| `research`, `competitor`, `market` | (research-agent tools, unchanged)       |

### 5.3 Impact

- `handleConciergeToolComplete()` checks for old names (lines 232-258)
- May not trigger cache invalidation or preview refresh correctly
- Dual detection patterns cause confusion

### 5.4 Fix Required

1. Update comments to reflect Phase 4 architecture (tenant-agent, customer-agent, research-agent)
2. Update tool name matching to use current names
3. Or better: rely solely on `dashboardActions` path (the new, correct pattern)

### 5.5 Estimated Effort

- Update comments: 30 minutes
- Remove old tool name matching: 30 minutes
- Verify dashboardActions path works: 30 minutes
- **Total: ~1.5 hours**

---

## 6. Issue #5: Placeholder Text Training Strategy

### 6.1 Design Decision

**Previous approach (rejected):** Remove all technical jargon, use purely human language.

**Current approach (approved):** Use section names in placeholder text to train users:

- "This is your **Hero Headline**"
- "This is your **About Copy**"
- "This is your **Services Description**"
- "This is your **FAQ Section**"
- "This is your **CTA Button Text**"

### 6.2 Rationale

Users who interact with the AI agent will learn the vocabulary through placeholder text. When they return, they can say:

- "Update my hero headline"
- "Change the about copy"
- "Add a FAQ item"

The agent's `resolve_vocabulary` tool then maps these phrases to `BlockType` values.

### 6.3 Implementation Status

- `resolve_vocabulary` tool exists and works
- Placeholder text needs audit to ensure consistent naming
- System prompt should NOT avoid jargon - it should use consistent section terminology

### 6.4 Files to Audit

1. `apps/web/src/lib/tenant.ts` - Default `landingPageConfig` placeholder text
2. `server/src/agent-v2/deploy/tenant/src/prompts/system.ts` - Agent language
3. `server/src/agent-v2/deploy/tenant/src/tools/vocabulary.ts` - Phrase→BlockType mapping

---

## 7. Recommended Fix Order

| Priority | Issue                                   | Effort    | Impact                 |
| -------- | --------------------------------------- | --------- | ---------------------- |
| **P0**   | Agent repetition loop (context builder) | 1.5 hours | Fixes core onboarding  |
| **P1**   | Dashboard actions not flowing           | 2 hours   | Fixes UX (auto-scroll) |
| **P2**   | FAQ/CTA section updates                 | 3-4 hours | Completes onboarding   |
| **P3**   | Stale frontend references               | 1.5 hours | Code cleanliness       |
| **P4**   | Placeholder text audit                  | 1 hour    | User training          |

**Total estimated effort:** ~9-10 hours

### 7.1 Suggested Sequence

1. **P0 first** - Without this, testing other fixes is frustrating (agent keeps asking same questions)
2. **P1 second** - Enables visual verification of subsequent fixes
3. **P2 third** - Requires Cloud Run logs investigation
4. **P3/P4** - Cleanup tasks, can be done in parallel

---

## 8. Files Reference

### 8.1 Agent Core

| File                                                       | Purpose                                  |
| ---------------------------------------------------------- | ---------------------------------------- |
| `server/src/agent-v2/deploy/tenant/src/agent.ts`           | Agent definition, 26 tools registered    |
| `server/src/agent-v2/deploy/tenant/src/prompts/system.ts`  | System prompt (~200 lines)               |
| `server/src/agent-v2/deploy/tenant/src/context-builder.ts` | Context fetching (NEEDS discovery facts) |
| `server/src/agent-v2/deploy/tenant/src/tools/index.ts`     | Tool exports                             |

### 8.2 Discovery Tools

| File                                                       | Purpose                                   |
| ---------------------------------------------------------- | ----------------------------------------- |
| `server/src/agent-v2/deploy/tenant/src/tools/discovery.ts` | `store_discovery_fact`, `get_known_facts` |
| `server/src/routes/internal-agent.routes.ts`               | Backend endpoints (lines 596-693)         |

### 8.3 Storefront Tools

| File                                                              | Purpose                                        |
| ----------------------------------------------------------------- | ---------------------------------------------- |
| `server/src/agent-v2/deploy/tenant/src/tools/storefront-read.ts`  | `get_page_structure`, `get_section_content`    |
| `server/src/agent-v2/deploy/tenant/src/tools/storefront-write.ts` | `update_section`, `add_section`, etc.          |
| `server/src/agent-v2/deploy/tenant/src/tools/navigate.ts`         | `scroll_to_website_section`, dashboard actions |

### 8.4 Frontend

| File                                              | Purpose                              |
| ------------------------------------------------- | ------------------------------------ |
| `apps/web/src/hooks/useConciergeChat.ts`          | Chat hook, receives dashboardActions |
| `apps/web/src/components/agent/AgentPanel.tsx`    | Panel component, processes actions   |
| `apps/web/src/components/agent/ConciergeChat.tsx` | Chat UI (has stale comments)         |

### 8.5 Backend Routes

| File                                                    | Purpose                      |
| ------------------------------------------------------- | ---------------------------- |
| `server/src/routes/tenant-admin-tenant-agent.routes.ts` | A2A proxy to Cloud Run       |
| `server/src/routes/internal-agent.routes.ts`            | Internal API for agent tools |

### 8.6 Related Todos

| ID   | Status   | Issue                                                        |
| ---- | -------- | ------------------------------------------------------------ |
| #800 | Deferred | Missing store_discovery_fact (NOW EXISTS - needs deployment) |
| #807 | Deferred | Weak repetition prevention (NEEDS context builder fix)       |
| #810 | Pending  | Marketing tools return instructions                          |

### 8.7 Related Documentation

| File                                                                  | Purpose                   |
| --------------------------------------------------------------------- | ------------------------- |
| `docs/issues/2026-01-31-tenant-agent-testing-issues.md`               | Testing results and fixes |
| `docs/issues/2026-01-31-tenant-agent-fix-handoff.md`                  | Fix handoff notes         |
| `server/src/agent-v2/deploy/SERVICE_REGISTRY.md`                      | Deployed services         |
| `docs/solutions/agent-issues/FACT_TO_STOREFRONT_BRIDGE_PREVENTION.md` | Pitfall #88               |

---

## Appendix A: Deferral Anti-Pattern Analysis

### A.1 Pattern Observed

Issues were deferred to "Phase 4: Memory Bank Integration" expecting a complex Vertex AI Agent Engine solution, when simpler fixes existed.

**Example:** Todo #807 (repetition) was deferred to Memory Bank. But the real fix is:

1. Fetch discovery facts in context builder (10 lines of code)
2. Include facts in system prompt
3. Agent knows what it knows without calling tools

### A.2 When Memory Bank IS Needed

- **Cross-session memory** - User returns next day, agent remembers
- **Semantic recall** - "What did we discuss about pricing?" across sessions
- **Long-term learning** - Agent improves recommendations over time

### A.3 When Memory Bank is NOT Needed

- **Within-session memory** - Just pass data in context
- **Preventing redundant questions** - Pre-fetch known facts
- **Tool result retention** - Agent's conversation history handles this

The current issues are all **within-session** problems that don't require Memory Bank.

---

## Appendix B: Testing Checklist

After implementing fixes, verify:

### B.1 Agent Repetition (P0)

- [ ] Start fresh session, say "I'm a life coach in Wisconsin"
- [ ] Agent stores fact and moves to next question
- [ ] Reload page, continue conversation
- [ ] Agent does NOT ask "What do you do?" again
- [ ] Agent references Wisconsin location in copy suggestions

### B.2 Dashboard Actions (P1)

- [ ] Update hero headline via chat
- [ ] Preview auto-scrolls to hero section
- [ ] Section is visually highlighted
- [ ] Update FAQ via chat
- [ ] Preview scrolls to FAQ section

### B.3 FAQ/CTA Updates (P2)

- [ ] Provide 3 FAQ items in natural language
- [ ] Agent parses and structures correctly
- [ ] FAQ section updates with all 3 items
- [ ] Provide CTA button text
- [ ] CTA section updates correctly

### B.4 End-to-End Onboarding

- [ ] Complete full onboarding flow (5 questions)
- [ ] All sections populated with real content
- [ ] No placeholder text visible (except intentional training text)
- [ ] Preview shows professional-looking storefront
- [ ] Publish works correctly

---

**Document Author:** Claude Code Investigation
**Last Updated:** 2026-01-31
**Next Review:** After P0 fix deployed
