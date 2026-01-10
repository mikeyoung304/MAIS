---
status: pending
priority: p2
issue_id: '705'
tags: [code-review, ai-tools, system-prompt, user-trust]
dependencies: ['699']
---

# Add Draft/Live Communication Rules to System Prompts

## Problem Statement

The system prompt documents tools and trust tiers but has no explicit guidance on how to communicate draft vs live state to users. Related to #699 but focuses on system prompt rather than tool descriptions.

## Findings

### Missing Guidance

Current system prompt (`onboarding-system-prompt.ts`) mentions draft/publish workflow:

```
Draft/Publish:
- All changes go to draft first (safe to experiment)
- Use `publish_draft` when they're happy (requires T3 approval)
```

But doesn't provide communication patterns for AI responses.

## Proposed Solution

Add section to system prompts:

```markdown
### Draft vs Live Communication (CRITICAL)

When reading storefront content, ALWAYS check the source and communicate clearly:

**Draft Content (source: 'draft' or hasDraft: true):**

- "In your draft, the headline says..."
- "Your unpublished draft shows..."
- "Once published, this will say..."
- NEVER say: "Your storefront shows...", "Your live site says...", "Visitors see..."

**Live Content (source: 'live' or hasDraft: false):**

- "On your live storefront, visitors see..."
- "Your published site shows..."

**Common Mistake:** Saying "The current hero headline in your live configuration is exactly: 'X'"
when X is draft content. This breaks user trust when they visit their actual site.
```

## Acceptance Criteria

- [ ] System prompt includes draft/live communication rules
- [ ] Rules are near the tools documentation section
- [ ] Both onboarding and admin prompts have the guidance
- [ ] AI consistently uses correct language in test scenarios

## Resources

- AI accuracy review: agent ad01142
- Related: #699 (tool description updates)
- Affected files: onboarding-system-prompt.ts, admin-system-prompt.ts
