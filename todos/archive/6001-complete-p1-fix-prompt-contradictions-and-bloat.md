# Fix Prompt Contradictions and Trim Bloat

**Priority:** P1
**Files:** `server/src/agent-v2/deploy/tenant/src/prompts/system.ts`, tool description strings in tool files
**Blocked by:** Nothing
**Plan:** `docs/plans/2026-02-11-refactor-agent-debt-cleanup-plan.md`

## Problem

The 520-line system prompt has 4 contradictory instructions and ~700-900 tokens of pure repetition (~15% of prompt budget wasted). The agent receives conflicting signals and wastes context window.

## Contradictions to Fix

### C1: When to call `delegate_to_research` (3 conflicting signals)

- Line ~199: "you do NOT need to trigger it" (automatic)
- Line ~208: "Call delegate_to_research at Q8-Q9"
- Tool description says: "WHEN TO CALL: As soon as you have businessType + location"

**Fix:** Research runs automatically in the backend. The agent should call `delegate_to_research` to CONSUME pre-computed results when building (not to trigger research). And `build_first_draft` now includes research data automatically. Simplify to: "Research runs in the background. When you need pricing data, it's included in `build_first_draft` results. If building without `build_first_draft`, call `delegate_to_research` to check for results."

### C2: System prompt describes confirmationToken protocol (lines ~444-454) but tools use simple boolean

- Prompt says: "First call returns confirmationToken, second call passes token back"
- `publish_section` and `discard_section` tools use `confirmationReceived: boolean` (no token)
- `publish_draft` and `discard_draft` DO use tokens

**Fix:** Update prompt to describe BOTH patterns accurately:

- `publish_draft`/`discard_draft`: Two-phase with token (describe correctly)
- `publish_section`/`discard_section`/`manage_packages` delete: Simple boolean confirmation

### C3: "Draft vs Live" messaging in prompt vs tool descriptions

- Prompt (lines ~286-293): "Check the left side — ready to go live?"
- Tool descriptions: "Say 'updated in draft' NOT 'done, take a look'"

**Fix:** Remove the messaging table from the prompt. Let tool descriptions be the single source of truth for post-update messaging. The prompt should only say: "All changes go to draft. The tool response tells you what to say."

### C4: Phantom `dashboardCapabilities` in context-builder.ts

- `context-builder.ts` (lines ~250-276) lists capabilities like `add_segment`, `update_segment`, `update_tier`, `preview_website`, `publish_website`
- These tools DO NOT EXIST. Agent has `publish_draft`, `update_section`, etc.

**Fix:** Update `dashboardCapabilities` list to match actual tool names registered in `agent.ts`.

**File:** `server/src/agent-v2/deploy/tenant/src/context-builder.ts`

## Repetition to Remove

### R1: Features Reference section (lines ~402-437)

~35 lines listing every tool with one-line descriptions. These duplicate tool descriptions.
**Action:** Delete entire section. Tool descriptions already provide this.

### R2: "Build with Narrative" stated 3 times

- Lines ~230-243: Full section
- build_first_draft tool description
- Lines ~274-278

**Action:** Keep the full section (lines ~230-243). Remove the repetition from the tool description (just say "Build with narrative — see system instructions"). Remove lines ~274-278 redundancy.

### R3: "Draft vs Live" repeated in prompt + 6 tool descriptions

**Action:** Keep in tool descriptions (closer to point of use). Remove from prompt (handled by C3 fix above).

### R4: Tool failure handling stated twice (lines ~378-388 and ~504-506)

**Action:** Keep the detailed version (lines ~378-388). Remove the Edge Cases duplicate.

## Target

- System prompt reduced from ~520 lines to ~360-380 lines
- ~1,700 fewer tokens per LLM call
- Zero contradictory instructions
- Every instruction appears exactly once

## Verification

```bash
# Prompt compiles
npm run --workspace=server typecheck
# Manually review prompt reads coherently end-to-end
```
