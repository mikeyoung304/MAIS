---
status: complete
priority: p2
issue_id: 804
tags: [code-review, agent, prompt-engineering]
dependencies: []
---

# Prompt Contradictions: Draft System vs Forbidden Words

## Problem Statement

The system prompt contains contradictory instructions about using the word "draft":

- Lines 46-51 forbid using "draft" in responses
- Lines 360-363 instruct agent to say "In your unpublished draft..."

This creates unpredictable behavior where the agent may violate its own rules.

## Findings

**From Code-Philosopher agent:**

> | Line | Says | Contradicts |
> | 50 | "check your draft" is forbidden | Line 303 says "Updated in your draft" |
> | 362-363 | "Say 'In your unpublished draft...'" | Line 50 forbids "draft" |

**From Code-Simplicity-Reviewer:**

> Lines 349-363 (Draft System Rules) directly contradict Forbidden Words. Either remove draft-state communication entirely or provide non-technical alternatives.

**Contradictory sections:**

**Forbidden (line 47-50):**

```
### Forbidden Words (NEVER use in responses)
- section, hero, CTA, draft, published
```

**Required (lines 360-363):**

```
Based on `hasDraft` returned by tools:
- If **hasDraft=true**: Say "In your unpublished draft..."
- If **hasDraft=false**: Say "On your live storefront..."
```

## Proposed Solutions

### Option A: Change Draft State Communication (Recommended) - IMPLEMENTED

**Pros:** Keeps forbidden words rule intact, maintains non-technical voice
**Cons:** Requires finding good alternatives
**Effort:** Small (15 minutes)
**Risk:** Low

Replace draft terminology with natural language:

- "In your unpublished draft..." → "In your changes..."
- "Your draft shows..." → "Your updates show..."
- "On your live storefront..." → "What visitors see..." or "Live on your site..."

### Option B: Remove hasDraft Communication

**Pros:** Simpler, no contradiction
**Cons:** Loses draft state awareness in responses
**Effort:** Small (10 minutes)
**Risk:** Low

Just say "Done. Take a look." without mentioning draft state.

### Option C: Allow "draft" with Qualifier

**Pros:** Keeps useful distinction
**Cons:** Weakens forbidden words rule
**Effort:** Small (5 minutes)
**Risk:** Medium

Remove "draft" from forbidden list but keep other terms.

## Recommended Action

Option A implemented - changed "Draft System" to "Preview vs Live" and updated all agent communication patterns.

## Technical Details

**Affected files:**

- `server/src/agent-v2/deploy/tenant/src/prompts/system.ts`
- Lines 46-51 (forbidden words)
- Lines 349-363 (draft system rules)

## Acceptance Criteria

- [x] No contradictions between forbidden words and required phrases
- [x] Agent consistently uses approved vocabulary
- [x] Draft state is communicated (if needed) using natural language

## Work Log

| Date       | Action                                      | Learnings                                                                                                    |
| ---------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 2026-01-31 | Identified during multi-agent code review   | Prompt contains self-contradicting rules                                                                     |
| 2026-02-04 | Implemented Option A - natural language fix | Use "preview" instead of "draft" for user-facing communication; "first draft" is acceptable natural language |

## Resolution Summary

Updated `server/src/agent-v2/deploy/tenant/src/prompts/system.ts`:

1. Renamed section header: "Draft System (CRITICAL for Trust)" → "Preview vs Live (CRITICAL for Trust)"
2. Updated all agent response patterns:
   - "Updated in draft" → "Updated. Check the preview"
   - "Saved in draft" → "Saved to preview"
   - "Ready to publish?" → "Ready to go live?"
3. Updated internal documentation comments:
   - "goes to draft" → "goes to preview"
   - "draft visibility" → "preview only"
4. Kept "first draft" terminology as it's natural language (like an author's first draft)
5. Kept Forbidden Words Reference table which maps `draft mode` → `preview / unpublished changes`

The API still returns `visibility: 'draft'` but the agent now speaks in natural language to users.

## Resources

- Code-Philosopher and Code-Simplicity-Reviewer findings
- [VOICE_QUICK_REFERENCE.md](docs/design/VOICE_QUICK_REFERENCE.md)
