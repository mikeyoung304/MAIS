# Agent-Native Prompt Simplification

## Problem

The tenant-agent system prompt was 668 lines with extensive "do not" lists that were counterproductive:

- **82 occurrences of "section"** leaked into agent speech despite being "forbidden"
- Telling an LLM "never say X" puts X front-of-mind (attention priming)
- 30+ "NEVER"/"DON'T" rules created cognitive overload
- 50-line decision flowcharts that the agent couldn't reliably execute

## Root Cause

LLMs don't process "don't say X" the way humans expect. The prompt was optimized for human understanding, not agent behavior. Every time we wrote "never say section", we reinforced "section" in the model's attention.

## Solution: Agent-Native Architecture

Applied principles from prompt engineering best practices:

### 1. Positive Framing Only

**Before:**

```
### 🚫 Forbidden Words (The Complete List)
**Technical Jargon (NEVER use):**
section, hero, CTA, draft, published, preview...
```

**After:**

```
**Confirmation vocabulary:** got it | done | on it | heard | bet | take a look
```

The new prompt describes what TO do, not what NOT to do.

### 2. Features as Self-Contained Sections

Each capability (storefront editing, marketing copy, project management) is a self-contained section with:

- Purpose
- Pattern
- Tools

This makes the prompt modular and easier to test/iterate.

### 3. Judgment Criteria Over Rules

**Before:** 50-line decision flowchart with if/else branching

**After:**

```
### When to Act Immediately (T1-T2)
- Reading content or structure
- Making content changes (they go to draft, safe to experiment)

### When to Ask First (T3)
| Action | Confirmation words |
| publish_draft | "publish", "ship it", "go live" |
```

### 4. Trust the Agent

Instead of micromanaging every decision, provide judgment criteria and let the LLM apply intelligence.

## Results

| Metric              | Before | After  | Change     |
| ------------------- | ------ | ------ | ---------- |
| Lines               | 668    | 193    | -71%       |
| "Section" in speech | 82     | 0      | Eliminated |
| "NEVER"/"DON'T"     | 30+    | 0      | Eliminated |
| Tokens              | ~7,250 | ~2,500 | -65%       |

## Key Files

- **New prompt:** `server/src/agent-v2/deploy/tenant/src/prompts/system.ts`
- **Behavioral fixtures:** `server/src/agent-v2/__tests__/fixtures/prompt-behaviors.ts`
- **Plan:** `docs/plans/2026-01-31-feat-enterprise-tenant-agent-architecture-plan.md`

## Behavioral Test Coverage

Created 26 test cases across 8 categories:

1. fact-storefront-bridge (Pitfall #88)
2. t3-confirmation
3. onboarding-detection
4. jargon-prevention
5. generate-then-refine
6. voice-tone
7. tool-failure-recovery
8. decision-flow

## Prevention Checklist

When writing agent prompts:

- [ ] Zero negative framing ("never", "don't", "forbidden")
- [ ] Vocabulary defined by examples of what TO say
- [ ] Features as self-contained sections
- [ ] Judgment criteria instead of decision trees
- [ ] Under 200 lines (hard cap)
- [ ] Behavioral test fixtures before deployment
- [ ] Count occurrences of terms you want avoided (should be 0)

## Related

- CLAUDE.md pitfalls #88 (fact-to-storefront bridge)
- CLAUDE.md pitfalls #37 (LLM pattern-matching prompts)
- `docs/design/VOICE_QUICK_REFERENCE.md`

---

_Compounded: 2026-01-31_
_Generated with Claude Code_
