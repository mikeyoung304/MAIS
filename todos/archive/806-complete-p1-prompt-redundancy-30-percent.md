---
status: pending
priority: p1
issue_id: 806
tags: [code-review, agent, prompt-engineering, simplicity]
dependencies: []
elevated_reason: 'Quality is the only metric - attention dilution hurts quality'
---

# Prompt Redundancy: ~30% Can Be Removed

## Problem Statement

The system prompt is ~7,250 tokens (725 lines) with significant redundancy. This causes:

- Attention dilution in later sections
- Contradictory interpretations when rules conflict
- Higher token costs per conversation

The Code-Simplicity-Reviewer estimates ~2,200 tokens (30%) can be removed.

## Findings

**From Code-Simplicity-Reviewer agent:**

| Finding                               | Token Savings |
| ------------------------------------- | ------------- |
| Redundant forbidden words (3x)        | ~400          |
| Duplicate section mapping             | ~300          |
| Redundant tool calling (3 sections)   | ~500          |
| Over-specified interview questions    | ~400          |
| Duplicate copy generation explanation | ~300          |
| Duplicate placeholder detection       | ~150          |
| Verbose decision flow                 | ~100          |
| Dead "Phase 3" references             | ~20           |

**Specific redundancies:**

1. Forbidden words appear in 3 places (lines 46-66, 156-166, 647-651)
2. Section mapping appears twice (lines 103-116, 330-347)
3. Tool calling explained 3 times (lines 277-308, 438-512, 514-538)

## Proposed Solutions

### Option A: Consolidate Redundant Sections (Recommended)

**Pros:** Reduces tokens, eliminates contradictions, improves focus
**Cons:** Requires careful editing
**Effort:** Medium (1-2 hours)
**Risk:** Low

1. Keep ONE forbidden words table (lines 54-64), delete others
2. Merge section mapping into single reference table
3. Keep Decision Flow (most comprehensive), remove "MANDATORY TOOL CALLING" section
4. Move auto-scroll into Decision Flow as one-liner

### Option B: Extract Reference Material

**Pros:** Core prompt stays focused
**Cons:** Requires separate context injection
**Effort:** Medium (2 hours)
**Risk:** Medium

Move section types, capabilities list, section mapping to separate reference document.

## Recommended Action

**Triage Decision (2026-01-31):** Option A - Consolidate Redundant Sections

**Priority Elevated:** P2 → P1 (Quality is the only metric; attention dilution hurts quality)

**Implementation:** Phase 1 of Enterprise Tenant Agent Architecture Plan

- Consolidate forbidden words to single table
- Merge section mapping into single reference
- Keep Decision Flow, remove redundant tool calling sections
- Target: ~5,000 tokens (from 7,250)

## Technical Details

**Affected files:**

- `server/src/agent-v2/deploy/tenant/src/prompts/system.ts`

**Current:** ~7,250 tokens
**Target:** ~5,000 tokens

## Acceptance Criteria

- [ ] Prompt reduced by 25-30% without losing functionality
- [ ] No redundant sections remain
- [ ] All rules stated exactly once
- [ ] Agent behavior unchanged after consolidation

## Work Log

| Date       | Action                        | Learnings                       |
| ---------- | ----------------------------- | ------------------------------- |
| 2026-01-31 | Identified during code review | 30% redundancy in system prompt |

## Resources

- Code-Simplicity-Reviewer detailed findings
- [CLAUDE.md Pitfall #71](CLAUDE.md) - Over-engineering detection
