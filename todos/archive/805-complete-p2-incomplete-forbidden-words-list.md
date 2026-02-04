---
status: complete
priority: p2
issue_id: 805
tags: [code-review, agent, voice, ux]
dependencies: []
---

# Incomplete Forbidden Words List

## Problem Statement

The forbidden words list (lines 46-64) is missing common web development terms that non-technical users would not understand. The agent may still use technical jargon not covered by the list.

## Findings

**From Code-Philosopher agent:**

> Missing from the forbidden list:
>
> - "block" / "BlockType" (used in tool responses)
> - "sectionId" (returned by tools)
> - "pageName" (tool parameter)
> - "scroll" (tool name)
> - "tool" / "function call" (meta-jargon)

**From UX-Voice-Specialist agent:**

> Missing common web dev terms that non-technical photographers would ask "what's that?":
>
> - viewport, responsive, mobile-first
> - SEO, metadata, slug
> - landing page, integration, template
> - widget, embed, header/footer
> - navigation/nav, backend, API, JSON

## Proposed Solutions

### Option A: Expand Forbidden Words Table (Recommended)

**Pros:** Comprehensive coverage, clear substitutions
**Cons:** Makes prompt longer
**Effort:** Small (20 minutes)
**Risk:** Low

Add missing terms with substitutions:

| Technical       | Natural                         |
| --------------- | ------------------------------- |
| block/BlockType | (don't mention)                 |
| sectionId       | (don't mention)                 |
| viewport        | screen size                     |
| responsive      | works on phones                 |
| SEO             | helps people find you on Google |
| landing page    | your page / your site           |
| header/footer   | top/bottom of your page         |
| navigation/nav  | menu                            |

### Option B: Add "The Rule" as Primary Filter

**Pros:** Principle-based, covers edge cases
**Cons:** Relies on LLM judgment
**Effort:** Small (5 minutes)
**Risk:** Medium

Emphasize existing rule: "If a non-technical wedding photographer would ask 'what's that?', don't say it."

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected files:**

- `server/src/agent-v2/deploy/tenant/src/prompts/system.ts`
- Lines 46-64 (Forbidden Words section)

## Acceptance Criteria

- [x] All technical tool/response terminology is covered
- [x] Common web dev jargon has natural substitutions
- [ ] Agent tested with prompts that might trigger jargon

## Work Log

| Date       | Action                                                | Learnings                                                                                              |
| ---------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 2026-01-31 | Identified during multi-agent code review             | List incomplete for tool terminology and common web dev terms                                          |
| 2026-02-04 | Implemented Option A - expanded forbidden words table | Added 24 terms covering tool/response terminology and common web dev jargon with natural substitutions |

## Resources

- [VOICE_QUICK_REFERENCE.md](docs/design/VOICE_QUICK_REFERENCE.md)
- UX-Voice-Specialist and Code-Philosopher findings
