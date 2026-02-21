---
status: pending
priority: p2
issue_id: '11078'
tags: [code-review, security, agent-ai]
pr: 68
---

# F-014: Discovery Facts Injected into LLM Prompt Without Sanitization

## Problem Statement

User-provided discovery facts from the onboarding intake are injected directly into the LLM prompt used for storefront section generation without any sanitization. This creates a prompt injection vector where a user could manipulate the LLM's behavior.

## Findings

- **Agents:** 1 agent flagged
- **Location:** `server/src/services/background-build.service.ts:391-394`
- **Impact:** A malicious user could craft discovery responses that inject instructions into the LLM prompt, potentially causing the LLM to generate inappropriate content, leak system prompt details, or behave in unintended ways during storefront generation.

## Proposed Solution

1. Sanitize discovery facts before injection: strip control characters, limit length per fact (e.g., 500 chars).
2. Wrap user-provided content in clear delimiter tags (e.g., `<user_input>...</user_input>`) so the LLM can distinguish user data from system instructions.
3. Add a total length cap for all injected facts combined.

## Effort

Small

## Acceptance Criteria

- [ ] Discovery facts are sanitized (control characters stripped, length capped per fact)
- [ ] User content is wrapped in delimiter tags in the prompt template
- [ ] Total injected content has a reasonable length cap
- [ ] Tests verify sanitization strips dangerous patterns
- [ ] Existing build tests continue to pass
