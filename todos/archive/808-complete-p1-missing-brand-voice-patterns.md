---
status: pending
priority: p1
issue_id: 808
tags: [code-review, agent, voice, ux]
dependencies: []
elevated_reason: 'Quality is the only metric - consistent voice is critical for enterprise UX'
---

# Missing Brand Voice Patterns from VOICE_QUICK_REFERENCE

## Problem Statement

The system prompt is missing several brand voice patterns documented in VOICE_QUICK_REFERENCE.md:

- Binary choice pattern ("Brain dump or I ask questions?")
- Snarky pushback voice ("ok fine, what do I know")
- "Punching down" protection (forbidden pain words)
- Extended confirmation vocabulary

## Findings

**From UX-Voice-Specialist agent:**

**Missing patterns:**

1. **Binary Choice Pattern:**
   - VOICE_QUICK_REFERENCE has: `"About section. Brain dump or I ask questions?"`
   - System prompt has verbose alternatives

2. **Snarky Pushback:**
   - BRAND_VOICE_GUIDE has: `"ok fine, what do I know. we can always circle back."`
   - System prompt only says "Cheeky" without examples

3. **Punching Down Protection:**
   - VOICE_QUICK_REFERENCE forbids: `overwhelmed, struggling, stressed, drowning, chaos, frantic, desperate`
   - System prompt has no equivalent

4. **Confirmation Vocabulary Mismatch:**
   - System prompt: `got it | done | on it | heard | updated | saved | take a look`
   - BRAND_VOICE_GUIDE: `bet | done | got it | on it | heard | say less`
   - Missing: `bet`, `say less`, `cool`, `next`, `queued`

5. **No AI Sermons Rule:**
   - VOICE_QUICK_REFERENCE: "Never explain how AI works"
   - System prompt: Missing entirely

## Proposed Solutions

### Option A: Add Missing Patterns (Recommended)

**Pros:** Complete voice consistency
**Cons:** Adds to prompt length (offset by #806 consolidation)
**Effort:** Small (30 minutes)
**Risk:** Low

Add:

1. Binary choice examples to Interview Techniques
2. Snarky pushback examples to Personality
3. "Punching down" words to Forbidden Words
4. Extended confirmation vocabulary
5. "No AI sermons" to Never Do list

### Option B: Reference External Voice Guide

**Pros:** Single source of truth
**Cons:** Agent can't read external files
**Effort:** N/A
**Risk:** High (doesn't work)

## Recommended Action

**Triage Decision (2026-01-31):** Option A - Add Missing Patterns

**Priority Elevated:** P2 → P1 (Quality is the only metric; consistent voice is critical for enterprise UX)

**Implementation:** Phase 1 of Enterprise Tenant Agent Architecture Plan

- Add binary choice pattern examples
- Add snarky pushback voice examples
- Add "punching down" words to forbidden list
- Add extended confirmation vocabulary (bet, say less, cool, next, queued)
- Add "No AI sermons" rule

**Note:** Token savings from #806 consolidation offset the additions here.

## Technical Details

**Affected files:**

- `server/src/agent-v2/deploy/tenant/src/prompts/system.ts`

**Reference documents:**

- `docs/design/VOICE_QUICK_REFERENCE.md`
- `docs/design/BRAND_VOICE_GUIDE.md`

## Acceptance Criteria

- [ ] All patterns from VOICE_QUICK_REFERENCE are in system prompt
- [ ] Binary choice pattern is demonstrated
- [ ] Snarky pushback voice is enabled
- [ ] "Punching down" words are forbidden
- [ ] Confirmation vocabulary is complete

## Work Log

| Date       | Action                      | Learnings                                     |
| ---------- | --------------------------- | --------------------------------------------- |
| 2026-01-31 | Identified during UX review | Voice guides not fully integrated into prompt |

## Resources

- [VOICE_QUICK_REFERENCE.md](docs/design/VOICE_QUICK_REFERENCE.md)
- [BRAND_VOICE_GUIDE.md](docs/design/BRAND_VOICE_GUIDE.md)
