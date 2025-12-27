---
status: ready
priority: p3
issue_id: "450"
tags: [code-review, security]
dependencies: []
---

# Unicode Normalization in sanitizeForContext Too

## Problem Statement

Unicode normalization (NFKC) was added to `proposal.service.ts` but `sanitizeForContext` in `types.ts` doesn't normalize, potentially allowing lookalike character bypasses.

**Why it matters:**
- Defense in depth
- Consistent sanitization
- Prevent Unicode-based injection

## Findings

- **Location:** `server/src/agent/tools/types.ts:129-135` (sanitizeForContext)
- Function filters patterns but doesn't normalize first
- proposal.service.ts does normalize (line 210)
- Should be consistent

## Proposed Solutions

### Option A: Add Normalization

**Approach:** Add `.normalize('NFKC')` to sanitizeForContext.

**Pros:**
- Consistent defense
- Simple change

**Cons:**
- None

**Effort:** Small (15 minutes)

**Risk:** Low

## Recommended Action

<!-- Filled during triage -->

## Acceptance Criteria

- [ ] sanitizeForContext normalizes Unicode
- [ ] Tests pass

## Work Log

### 2025-12-26 - Initial Discovery

**By:** security-sentinel agent
