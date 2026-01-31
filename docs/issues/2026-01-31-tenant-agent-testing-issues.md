# Tenant Agent Testing Issues - January 31, 2026

## Status: ✅ RESOLVED

**Resolution Date:** 2026-01-31
**Resolution:** Redesigned marketing tools to be agent-native, eliminating backend dependency.

## Summary

Playwright testing of the tenant-agent in production revealed several issues. The agent's core functionality (storefront editing) works well, but content generation features were broken and UX improvements were needed.

**Root Cause:** Marketing tools called backend routes that didn't exist. The old architecture had Agent → Backend → Vertex AI, but the tenant-agent IS on Vertex AI with direct Gemini access.

**Fix Applied:** Rewrote tools to return generation instructions, letting the agent generate copy natively. This is faster, simpler, and eliminated the need for backend routes.

---

## Critical Issues

### 1. Marketing Tools Return 404 - Backend Routes Missing

**Severity:** HIGH - Feature completely broken

**Symptoms:**

- "Write me a tagline" → "That didn't work. Want me to try a different approach?"
- "Make my headline more engaging" → Same error

**Root Cause:**
The tenant-agent's marketing tools call backend API routes that don't exist:

```
POST /v1/internal/agent/marketing/generate-copy → 404 NOT_FOUND
POST /v1/internal/agent/marketing/improve-section → 404 NOT_FOUND
```

**Cloud Run Logs:**

```json
{"error":"Route POST /v1/internal/agent/marketing/generate-copy not found","status":404}
{"error":"Route POST /v1/internal/agent/marketing/improve-section not found","status":404}
```

**Fix Required:**

1. Implement `/v1/internal/agent/marketing/generate-copy` route in `server/src/routes/internal/agent.routes.ts`
2. Implement `/v1/internal/agent/marketing/improve-section` route
3. Create `MarketingCopyService` or integrate with existing LLM infrastructure
4. Redeploy Render backend

**Files to Check:**

- `server/src/routes/internal/agent.routes.ts` - Add missing routes
- `server/src/agent-v2/deploy/tenant/src/tools/marketing.ts` - See expected API contract
- `packages/contracts/src/internal/agent.ts` - Add contract definitions

---

## UX Improvements Needed

### 2. Agent Should Auto-Scroll After Section Updates

**Severity:** MEDIUM - UX improvement

**Current Behavior:**
After updating a section (e.g., FAQ headline), the agent says "Done! Updated in your draft." but the preview doesn't scroll to show the updated section.

**Expected Behavior:**
Agent should automatically call `scroll_to_website_section` after any `update_section` call to show the user what changed.

**Fix Options:**

**Option A: Prompt Update**
Add to `TENANT_AGENT_SYSTEM_PROMPT`:

```
After updating any section with update_section, ALWAYS call scroll_to_website_section
to scroll the preview to the updated section so the user can see their changes.
```

**Option B: Tool Chaining**
Modify `update_section` tool to automatically return a `dashboardAction` with scroll behavior.

**Recommendation:** Option A is simpler and follows the existing pattern.

---

## Test Results Summary

| Test                         | Status     | Notes                                              |
| ---------------------------- | ---------- | -------------------------------------------------- |
| Greeting response            | ✅ PASS    | "Living the dream. What's up?" - terse, cheeky     |
| Content update (exact text)  | ✅ PASS    | Used exact text, updated draft, terse confirmation |
| Content generation           | ❌ FAIL    | Backend routes missing (404)                       |
| Content improvement          | ❌ FAIL    | Backend routes missing (404)                       |
| T3 publish confirmation      | ✅ PASS    | "Ready to publish? This goes live immediately."    |
| T3 decline handling          | ✅ PASS    | "Heard." - appropriate confirmation                |
| Scroll to section (explicit) | ✅ PASS    | "FAQ section in view."                             |
| Auto-scroll after update     | ⚠️ MISSING | Agent doesn't scroll after updates                 |
| Voice compliance             | ✅ PASS    | No forbidden phrases observed                      |
| Draft state awareness        | ✅ PASS    | Says "in your draft" appropriately                 |

---

## Prompt Compliance Analysis

### What's Working Well

1. **Terse responses** - Agent uses minimal words ("Done!", "Heard.", "Living the dream.")
2. **Allowed confirmations** - Uses "done", "heard", "got it" vocabulary
3. **No forbidden phrases** - No "Great!", "Perfect!", "I'd be happy to"
4. **T3 confirmation flow** - Properly asks before publishing
5. **Tool-first behavior** - Calls tools before responding with text
6. **Draft awareness** - Correctly references draft state

### Areas for Improvement

1. **Auto-scroll missing** - Should scroll to updated sections
2. **Marketing features broken** - Backend routes need implementation
3. **No research integration** - Earlier test showed research also failed

---

## Next Steps for AI Agent

### Priority 1: Implement Missing Backend Routes

1. Read `server/src/agent-v2/deploy/tenant/src/tools/marketing.ts` to understand expected API
2. Add routes to `server/src/routes/internal/agent.routes.ts`:
   - `POST /v1/internal/agent/marketing/generate-copy`
   - `POST /v1/internal/agent/marketing/improve-section`
3. Implement service layer (likely needs Vertex AI integration for copy generation)
4. Add to contracts in `packages/contracts/src/internal/agent.ts`
5. Test locally with `npm run dev:api`
6. Push to main to trigger Render deploy

### Priority 2: Add Auto-Scroll to Prompt

1. Edit `server/src/agent-v2/deploy/tenant/src/prompts/system.ts`
2. Add instruction to scroll after section updates
3. Redeploy tenant-agent to Cloud Run:
   ```bash
   cd server/src/agent-v2/deploy/tenant && npm run deploy
   ```

### Priority 3: Verify Research Agent Integration

The earlier "research Austin weddings" request also failed - verify research-agent is properly configured and reachable.

---

## Tool Architecture Analysis

### Current Design (Outdated)

The marketing tools use a **backend proxy pattern** inherited from the multi-agent era:

```
User Request → Tenant Agent → callMaisApi('/marketing/generate-copy') → Render Backend → Vertex AI → Response
```

**Problem:** The tenant-agent IS running on Vertex AI with Gemini 2.0 Flash. It's calling out to a backend that would need to call BACK to Vertex AI. This is:

- Slower (extra network hop)
- More complex (two services to maintain)
- More expensive (double API calls)
- Currently broken (routes don't exist)

### Tool Categories

| Tool Type              | Needs Backend? | Reason                           |
| ---------------------- | -------------- | -------------------------------- |
| `get_page_structure`   | ✅ Yes         | Database read                    |
| `update_section`       | ✅ Yes         | Database write                   |
| `publish_draft`        | ✅ Yes         | Database write                   |
| `generate_copy`        | ❌ No          | Pure LLM generation              |
| `improve_section_copy` | ⚠️ Partial     | Needs DB read, LLM gen, DB write |

### Recommended Redesign

#### Option A: Agent-Native Copy Generation (RECOMMENDED)

Remove the backend call entirely. The agent already has LLM access:

```typescript
// NEW marketing.ts - agent-side generation
export const generateCopyTool = new FunctionTool({
  name: 'generate_copy',
  description: `Generate marketing copy directly. Returns structured prompt guidance.`,
  parameters: GenerateCopyParams,
  execute: async (params, context) => {
    // Validate params
    const parseResult = GenerateCopyParams.safeParse(params);
    if (!parseResult.success) return { success: false, error: 'Invalid parameters' };

    // Return generation context - the LLM will generate copy in its next response
    return {
      success: true,
      action: 'GENERATE_COPY',
      copyType: parseResult.data.copyType,
      tone: parseResult.data.tone,
      context: parseResult.data.context,
      instructions: buildCopyPrompt(parseResult.data), // Returns generation guidelines
    };
  },
});

function buildCopyPrompt(params: GenerateCopyInput): string {
  const templates = {
    headline: `Generate a ${params.tone} headline for: ${params.context}. Keep under 10 words.`,
    tagline: `Create a ${params.tone} tagline for: ${params.context}. Keep under 7 words.`,
    description: `Write a ${params.tone} service description for: ${params.context}. 50-150 words.`,
    about: `Write an ${params.tone} about section for: ${params.context}. 100-300 words.`,
  };
  return templates[params.copyType];
}
```

**Benefits:**

- No backend routes to implement
- Faster responses (no network hop)
- Simpler architecture
- Works immediately after deploy

#### Option B: Hybrid for improve_section_copy

Since `improve_section_copy` needs the current content, use a two-step flow:

```typescript
export const improveSectionCopyTool = new FunctionTool({
  name: 'improve_section_copy',
  execute: async (params, context) => {
    // Step 1: Get current content from backend
    const currentContent = await callMaisApi('/storefront/section', tenantId, {
      sectionId: params.sectionId,
    });

    // Step 2: Return context for agent to generate improvement
    return {
      success: true,
      action: 'IMPROVE_COPY',
      currentContent: currentContent.data,
      feedback: params.feedback,
      instructions: `Improve this content based on feedback: "${params.feedback}". Current: "${currentContent.data.headline}"`,
      // Agent generates improvement, then calls update_section
    };
  },
});
```

### Implementation Steps

1. **Rewrite `generate_copy`** to return generation context instead of calling backend
2. **Rewrite `improve_section_copy`** to:
   - Call existing `/storefront/section` endpoint for current content
   - Return improvement context for agent to generate
   - (Agent then calls `update_section` with generated copy)
3. **Update system prompt** to handle the new tool response format
4. **Delete the unimplemented backend routes** from the issues list

### Expected Prompt Update

Add to `TENANT_AGENT_SYSTEM_PROMPT`:

```
## Copy Generation Flow

When generate_copy or improve_section_copy returns successfully:
1. The tool returns generation instructions
2. YOU generate the actual copy based on those instructions
3. Present the generated copy to the user
4. When user approves, call update_section to apply it

Example:
User: "Write me a tagline"
→ Tool returns: { action: 'GENERATE_COPY', copyType: 'tagline', context: '...' }
→ YOU generate: "Capturing moments that last forever."
→ Present to user: "How about: 'Capturing moments that last forever.'?"
→ User: "Perfect, use it"
→ Call update_section with the tagline
```

---

## Related Files

- Agent source: `server/src/agent-v2/deploy/tenant/`
- System prompt: `server/src/agent-v2/deploy/tenant/src/prompts/system.ts`
- Marketing tools: `server/src/agent-v2/deploy/tenant/src/tools/marketing.ts`
- Backend routes: `server/src/routes/internal/agent.routes.ts`
- Service registry: `server/src/agent-v2/deploy/SERVICE_REGISTRY.md`

---

## Test Environment

- Production URL: https://www.gethandled.ai/tenant/dashboard
- Tenant: production-test-jan31-1769871632692
- Agent: tenant-agent on Cloud Run
- Backend: Render (mais-5bwx.onrender.com)
- Date: 2026-01-31

---

## Resolution Details (2026-01-31)

### Changes Made

1. **Rewrote `marketing.ts`** - Agent-native copy generation
   - `generate_copy`: Returns generation instructions instead of calling backend
   - `improve_section_copy`: Reads current content via `/storefront/section`, returns improvement instructions
   - Agent generates copy using its native Gemini 2.0 Flash capabilities

2. **Updated `system.ts` prompt**
   - Added explicit auto-scroll instruction after `update_section`
   - Added "Agent-Native Copy Generation" section explaining the new workflow
   - Updated decision flow to clarify tool-returns-instructions pattern

3. **Deployed to Cloud Run**
   - Service: tenant-agent-00006-75v
   - URL: https://tenant-agent-506923455711.us-central1.run.app

### Test Results (Post-Fix)

| Test                     | Status  | Notes                                                           |
| ------------------------ | ------- | --------------------------------------------------------------- |
| Generate tagline         | ✅ PASS | "How about: 'Authentic Moments, Forever Captured'?"             |
| Improve subheadline      | ✅ PASS | Updated to "Turning fleeting moments into timeless memories..." |
| Auto-scroll after update | ✅ PASS | Preview scrolls to show changes                                 |
| Tool indicators          | ✅ PASS | Marketing ✓, Storefront ✓ shown correctly                       |

### Architecture Comparison

**Before (Broken):**

```
User → Agent → callMaisApi('/marketing/generate-copy') → 404 NOT_FOUND
```

**After (Working):**

```
User → Agent → generate_copy() → { instructions: "..." }
              → Agent generates copy natively (Gemini 2.0 Flash)
              → Presents to user
              → update_section() → Applied to draft
              → scroll_to_website_section() → Shows change
```

### Files Modified

- `server/src/agent-v2/deploy/tenant/src/tools/marketing.ts` (complete rewrite)
- `server/src/agent-v2/deploy/tenant/src/prompts/system.ts` (added sections)
