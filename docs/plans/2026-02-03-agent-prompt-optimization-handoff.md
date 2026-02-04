# Agent Prompt & Ecosystem Optimization - Handoff Context

**Date:** 2026-02-03
**Purpose:** Fresh context window handoff for optimizing the MAIS tenant agent

---

## Your Mission

Optimize the MAIS/HANDLED tenant agent to provide a guided, section-by-section storefront editing experience. The agent should work WITH the user to refine each section, automatically scroll to show changes, and optionally publish progressively.

---

## What Was Just Fixed (Context)

A previous session fixed the "first draft shows placeholders" issue by adding explicit autonomous draft generation instructions to the system prompt. The agent now:

1. Gathers facts via interview (store_discovery_fact)
2. After 2-3 facts: calls get_page_structure, generates copy, calls update_section for each
3. Says "I put together a first draft in the preview"

**This fix is committed but NOT deployed yet.** Deploy is next.

---

## Remaining Gaps to Address

### Gap 1: No Section-by-Section Guided Workflow (HIGH PRIORITY)

**Current:** Agent updates all sections in one batch, then asks "what do you want to tweak?"
**Problem:** User doesn't get guided through individual sections
**Goal:** After first draft, agent should:

1. Ask which section to refine first
2. Focus on that section only
3. Generate options, get approval, update
4. Scroll to show the change
5. Ask "happy with that? publish it now, or move to next section?"

### Gap 2: Scroll After Update Reliability (MEDIUM PRIORITY)

**Current:** `update_section` returns `dashboardAction: { type: 'SCROLL_TO_SECTION', sectionId }` which SHOULD auto-scroll
**But:** The prompt also says "After updates: Call scroll_to_website_section" (redundant)
**Goal:** Verify dashboardAction works, then either:

- Remove the redundant prompt instruction, OR
- Make the explicit scroll_to_website_section call mandatory in the prompt

### Gap 3: No Progressive Publish (LOW PRIORITY - Future)

**Current:** All changes stay in draft until full publish
**Goal:** Let users publish individual sections as they approve them

---

## Key Files to Study

### Agent Prompt (MODIFY THIS)

```
server/src/agent-v2/deploy/tenant/src/prompts/system.ts
```

~275 lines. Contains:

- Identity and personality
- Session state (knownFacts, forbiddenSlots)
- Interview pattern
- First Draft Workflow (just added)
- Generate-Then-Refine workflow
- Storefront editing tools
- Draft system rules
- Trust tiers (T1/T2/T3)

### Agent Tools

```
server/src/agent-v2/deploy/tenant/src/tools/
├── index.ts              # Tool exports
├── storefront-read.ts    # get_page_structure, get_section_content
├── storefront-write.ts   # update_section, add_section, etc.
├── navigate.ts           # scroll_to_website_section, navigate_to_section
├── marketing.ts          # generate_copy, improve_section_copy
├── discovery.ts          # store_discovery_fact, get_known_facts
└── ...
```

### Frontend Integration

```
apps/web/src/components/agent/AgentPanel.tsx    # Handles dashboardAction
apps/web/src/stores/agent-ui-store.ts           # Zustand store for UI state
apps/web/src/components/preview/PreviewPanel.tsx # Renders preview iframe
```

### Documentation

```
docs/reports/2026-02-03-AGENT-SECTION-BEHAVIOR-ANALYSIS.md  # Full analysis
docs/architecture/BUILD_MODE_VISION.md                       # Architecture vision
docs/solutions/agent-issues/AUTONOMOUS_FIRST_DRAFT_WORKFLOW.md # Today's fix
CLAUDE.md                                                     # Pitfalls 88-95
```

---

## Proposed System Prompt Changes

### Add: Guided Refinement Mode (After First Draft)

Insert after the "First Draft Workflow" section (~line 82):

```markdown
### Guided Refinement Mode

After the first draft is ready, guide users through section-by-section refinement:

1. **Ask where to start:**
   "First draft is up. Where should we start - headline, about section, or something else?"

2. **Focus on one section:**
   - Call get_section_content to show current content
   - Generate 2-3 options
   - Present as binary choice: "Option A or Option B?"
   - Get approval

3. **Update and show:**
   - Call update_section with approved content
   - The preview will automatically scroll to show the change (via dashboardAction)
   - Say: "Updated - see it in the preview?"

4. **Before moving on:**
   "Happy with that? Want to publish just this, or keep going and publish everything later?"

5. **Repeat for next section:**
   "What's next - [next placeholder section] or something else?"

**Why section-by-section?** Users feel in control. They see each piece come together.
It's less overwhelming than "here's everything, what do you think?"

**Exception:** If user says "just finish it" or "do the rest", switch to batch mode
and update remaining placeholders autonomously.
```

### Modify: Remove Redundant Scroll Instruction

Change lines 103 (Storefront Editing section):

**Current:**

```
**After updates:** Call scroll_to_website_section to show the change.
```

**New:**

```
**After updates:** The preview automatically scrolls to show the change.
If it doesn't, call scroll_to_website_section manually.
```

### Modify: Generate-Then-Refine Section

Add explicit scroll reminder at line 88:

**Current:**

```
When approved: update via tools → scroll to show → "Done. Take a look."
```

**New:**

```
When approved: update via tools → preview scrolls automatically →
"Done - check it out in the preview."
```

---

## Testing Plan

### 1. Deploy Updated Agent

```bash
cd server/src/agent-v2/deploy/tenant
npm run deploy
```

### 2. Manual E2E Test Flow

1. Create new test tenant (or use existing test account)
2. Open dashboard, start chat
3. Provide business info: "I'm a wedding photographer in Austin. I love capturing candid moments."
4. Verify: Agent stores facts AND updates sections
5. Verify: Preview shows personalized content
6. Say: "Let's tweak the headline"
7. Verify: Agent focuses on headline only, generates options
8. Approve one: "I like option A"
9. Verify: Section updates AND preview scrolls to hero
10. Say: "publish" → Verify T3 confirmation flow

### 3. Automated E2E (Future)

Add to `e2e/tests/`:

- `onboarding-first-draft.spec.ts` - Test autonomous draft generation
- `section-refinement.spec.ts` - Test guided section-by-section flow
- `preview-scroll.spec.ts` - Test auto-scroll on update

---

## Architecture Context

### Data Flow: Agent → Section Update → Preview Scroll

```
1. User: "Update my headline to 'Love in Every Frame'"

2. Agent processes → calls update_section tool

3. Tool execution:
   - SectionContentService.updateSection()
   - Returns: { success: true, dashboardAction: { type: 'SCROLL_TO_SECTION', sectionId } }

4. Frontend receives tool result (AgentPanel.tsx)
   - handleDashboardActions extracts dashboardAction
   - Calls agentUIActions.highlightSection(sectionId)

5. Zustand store (agent-ui-store.ts)
   - highlightSection() updates highlightedSectionId
   - Also sets view to 'preview' if not already

6. PreviewPanel re-renders
   - Reads highlightedSectionId from store
   - Sends PostMessage to iframe to scroll + highlight

7. User sees: Preview scrolls to hero, headline is highlighted
```

### Draft/Publish Flow

```
Content Update Path:
  update_section → SectionContent table (isDraft: true)

Preview Fetch:
  useSectionsDraft hook → /api/tenant-admin/sections/draft
  → Returns all sections (draft takes priority)

Publish:
  publish_draft (T3) → SectionContentService.publishAll()
  → Sets isDraft: false, publishedAt: now()

Live Site:
  Public storefront → /api/tenant/sections (publishedOnly: true)
```

---

## Commands Quick Reference

```bash
# Typecheck before deploying
npm run --workspace=server typecheck

# Deploy tenant agent to Cloud Run
cd server/src/agent-v2/deploy/tenant && npm run deploy

# Run unit tests
npm run --workspace=server test

# Run E2E tests
npm run --workspace=e2e test

# Check agent logs in Cloud Run
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=tenant-agent" --limit=50
```

---

## Pitfalls to Avoid (From CLAUDE.md)

- **#88:** Fact-to-Storefront bridge missing - FIXED with autonomous first draft
- **#90:** dashboardAction not extracted - Should be fixed, verify it works
- **#91:** Agent asking known questions - Use forbiddenSlots
- **#95:** Agent says "first draft" but shows placeholders - FIXED today

---

## Success Criteria

After optimization, the agent should:

1. ✅ Generate personalized first draft autonomously (DONE)
2. ⏳ Guide user through section-by-section refinement
3. ⏳ Auto-scroll preview after every update
4. ⏳ Offer to publish progressively ("happy with this section? publish it now?")
5. ⏳ Handle "just finish it" to switch back to batch mode

---

## Files Changed Today (Already Committed, Not Deployed)

1. `server/src/agent-v2/deploy/tenant/src/prompts/system.ts` - Added First Draft Workflow
2. `CLAUDE.md` - Added Pitfall #95
3. `docs/solutions/agent-issues/AUTONOMOUS_FIRST_DRAFT_WORKFLOW.md` - Solution doc
4. `docs/reports/2026-02-03-AGENT-SECTION-BEHAVIOR-ANALYSIS.md` - Full analysis

---

## What To Do Next

1. **Read the analysis report:** `docs/reports/2026-02-03-AGENT-SECTION-BEHAVIOR-ANALYSIS.md`
2. **Study the current prompt:** `server/src/agent-v2/deploy/tenant/src/prompts/system.ts`
3. **Add Guided Refinement Mode** to the prompt (proposed changes above)
4. **Test dashboardAction scroll** in browser
5. **Deploy** and verify end-to-end
6. **Document** any new pitfalls discovered
