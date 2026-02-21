---
status: pending
priority: p1
issue_id: '11068'
tags: [code-review, security, agent-ai, typescript]
pr: 68
---

# LLM Response Parsed Without Schema Validation (F-004)

## Problem Statement

LLM response in BackgroundBuildService is extracted via regex, parsed with JSON.parse(), and cast with `as Record<string, unknown>`. No Zod validation. Risks: prototype pollution via **proto**/constructor keys, unbounded string sizes, unexpected fields corrupt section content.

## Findings

- **Agents:** security-sentinel, kieran-typescript, agent-native-reviewer (3 agents)
- **Location:** `server/src/services/background-build.service.ts:319-325`
- **Impact:** Corrupted storefront content, prototype pollution, arbitrary LLM hallucinations stored
- **Known Pattern:** Pitfall #12 (type assertion without validation)

## Proposed Solution

1. Add runtime type guard (typeof, Array.isArray, null check)
2. Validate with per-section Zod schemas (HeroSchema, AboutSchema, ServicesSchema) with .strip() and max-length constraints

## Effort

Medium (1-3 hours)

## Acceptance Criteria

- [ ] LLM output validated against per-section Zod schema
- [ ] Unknown keys stripped via .strip()
- [ ] **proto**/constructor keys rejected
- [ ] String length limits enforced
- [ ] Fallback to template on validation failure
- [ ] Test: malformed LLM output triggers fallback
