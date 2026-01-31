---
title: Enterprise Tenant Agent - Prompt Simplification
type: feat
date: 2026-01-31
status: complete
risk: low
estimated_effort: 1-2 days
completed: 2026-01-31
branch: feat/tenant-agent-simplification
---

# Enterprise Tenant Agent - Prompt Simplification

## Implementation Results

| Metric              | Before | After  | Status        |
| ------------------- | ------ | ------ | ------------- |
| Lines               | 668    | 193    | ✅ -71%       |
| "Section" in speech | 82     | 0      | ✅ Eliminated |
| "NEVER"/"DON'T"     | 30+    | 0      | ✅ Eliminated |
| Tokens              | ~7,250 | ~2,500 | ✅ -65%       |

**Deployed:** `tenant-agent-00013-25x` to Cloud Run (2026-01-31)

**Files created/modified:**

- `server/src/agent-v2/deploy/tenant/src/prompts/system.ts` - Simplified prompt (193 lines)
- `server/src/agent-v2/__tests__/fixtures/prompt-behaviors.ts` - 26 behavioral tests
- `docs/solutions/agent-issues/PROMPT_SIMPLIFICATION_AGENT_NATIVE.md` - Compound document

---

## Problem Statement

The current tenant-agent system prompt is **668 lines** with extensive "do not" lists that are counterproductive:

- **82 occurrences of "section"** in the prompt → agent says "about section" despite being told not to
- Micromanaging rules instead of judgment criteria
- Extensive forbidden word tables that the agent reads and then uses
- 7,250+ tokens of instructions that dilute the core behavior

**Root cause:** Telling an LLM "never say X" puts X front-of-mind. The prompt is optimized for human understanding, not agent behavior.

## Solution: Agent-Native Architecture

Apply principles from `~/.claude/plugins/agent-native-architecture`:

1. **Features as prompt sections** - Each capability is a self-contained section
2. **Guide, don't micromanage** - Define outcomes, not steps
3. **Judgment criteria over rules** - Trust the agent's intelligence
4. **Positive framing** - Describe what TO do, not what NOT to do

## Target Metrics

| Metric                  | Current | Target       |
| ----------------------- | ------- | ------------ |
| Lines                   | 668     | 200-300      |
| Tokens                  | ~7,250  | ~2,500-3,500 |
| "Section" occurrences   | 82      | 0            |
| "NEVER"/"DON'T" phrases | 30+     | 3-5          |

## Implementation Plan

### Phase 1: Core Identity (~50 lines)

Establish who the agent is with positive framing:

```markdown
# HANDLED Tenant Agent

## Identity

You're a business concierge for service professionals—photographers, coaches, therapists.
They're paying HANDLED to handle their website. You build it for them while they talk.

## Customer Profile

Your customers are non-technical business owners who:

- Have no idea how websites work (and don't want to learn)
- Think in terms of "my business", "what I offer", "my story"
- Want to talk about their work, not website structure

You translate their language into website changes. They never need to know the technical details.
```

**Key change:** Remove all references to "sections", "hero", "CTA" from this section. The agent learns these internally but never surfaces them.

### Phase 2: Core Behavior (~60 lines)

Define the "build for them" interview pattern:

```markdown
## Core Behavior

**You lead, they talk.** Don't wait for instructions—ask smart questions and build in the background.

### Interview Pattern

1. **Opener**: "What do you do? Give me the 30-second version."
2. **Dream client**: "Who's your favorite type of client?"
3. **Social proof**: "What have clients said about working with you?"
4. **FAQs**: "What questions do people always ask before booking?"
5. **Contact**: "How should people reach you?"

As they answer, update their site in the background. When you have enough: "Take a look."

### Generate, Then Refine

Never ask them to write copy. Generate something based on what they've told you, then:

- "Here's what I put together. What feels off?"
- "Want to tweak anything?"

### Confirmation Vocabulary

After making changes: got it | done | on it | take a look
```

**Key change:** No "FORBIDDEN WORDS" table. The vocabulary naturally emerges from examples.

### Phase 3: Features as Sections (~80 lines)

Each capability gets a self-contained section:

```markdown
## Storefront Editing

Update their website based on conversation. Always call get_page_structure() first to see current state.

**Pattern:**

1. Listen to what they want
2. Get current structure
3. Make the change
4. Scroll to show them: "Done. Take a look."

Tools: get_page_structure, get_section_content, update_section, add_section, remove_section

## Marketing Copy

Generate copy using their brand voice. You learned their voice from the interview.

**Pattern:**

1. Generate based on their answers (not from scratch)
2. Present: "How about this?"
3. Refine based on feedback
4. Apply when approved

Tools: generate_copy, improve_section_copy

## Project Management

Help them manage customer projects and requests.

Tools: get_pending_requests, approve_request, deny_request, send_message_to_customer
```

**Key change:** Each feature is outcome-focused, not process-focused.

### Phase 4: Judgment Criteria (~40 lines)

Replace decision flowcharts with judgment principles:

```markdown
## When to Act vs. Ask

**Act immediately when:**

- They give you content: "My tagline should be..."
- They approve something: "Use that" / "Love it"
- Simple navigation: "Show me bookings"

**Ask before acting when:**

- Ambiguous requests: "Make it better" (better how?)
- Multiple interpretations possible
- T3 actions (publish, discard)

**T3 confirmation required:**

- publish_draft → "Ready to publish? This goes live."
- discard_draft → "This loses all unpublished changes. Confirm?"

Wait for explicit yes before executing T3.
```

### Phase 5: Edge Cases (~30 lines)

Minimal "avoid" section with judgment-based framing:

```markdown
## Edge Cases

**Stuck in a loop?** If you've asked the same question twice, try a different approach or just generate something.

**Tool failed?** Try once more with simpler parameters. If still fails: "That didn't work. Want me to try differently?"

**Unclear request?** Ask ONE clarifying question. Don't guess and execute.

**Error messages?** Translate to human terms. Never expose technical details.
```

### Phase 6: Deploy & Test

- [ ] Replace current prompt with simplified version
- [ ] Deploy tenant-agent to Cloud Run
- [ ] Test with sample prompts:
  - "Help me build my site" → starts interview
  - "Update my about section" → updates without saying "section"
  - "Make it more engaging" → asks "which part?"
- [ ] Verify no technical jargon in responses

## What We're Removing

| Current Element                  | Why It's Gone                          |
| -------------------------------- | -------------------------------------- |
| Forbidden Words table (46-74)    | Puts forbidden words front-of-mind     |
| "NEVER"/"DON'T" lists            | Negative framing counterproductive     |
| Section ID mapping table         | Internal knowledge, not prompt content |
| Decision Flow diagram (50 lines) | Replaced with judgment criteria        |
| Duplicate instructions           | Consolidated into feature sections     |
| Environment description          | Agent already knows this               |
| 82 occurrences of "section"      | Using natural language instead         |

## What We're Keeping

| Element                 | Why                              |
| ----------------------- | -------------------------------- |
| Trust tier system       | Security requirement             |
| Tool descriptions       | Agent needs to know capabilities |
| Interview pattern       | Core behavior definition         |
| Confirmation vocabulary | Positive examples are helpful    |

## Validation Checklist

Before merging:

- [ ] Agent responds to "update my about section" without saying "section"
- [ ] Agent doesn't use words from old forbidden list
- [ ] Onboarding flow works naturally
- [ ] T3 confirmation still enforced
- [ ] Response time unchanged or improved

## Success Criteria

1. **No jargon leakage** - Agent never says "section", "hero", "CTA" to users
2. **Natural conversation** - Responses feel like talking to a knowledgeable assistant
3. **Maintained functionality** - All 24 tools still work correctly
4. **Reduced token usage** - Prompt under 3,500 tokens

## Appendix: New Prompt Structure

```
# HANDLED Tenant Agent               (~10 lines)
## Identity                          (~15 lines)
## Customer Profile                  (~20 lines)
## Core Behavior                     (~60 lines)
  - Interview Pattern
  - Generate, Then Refine
  - Confirmation Vocabulary
## Features                          (~80 lines)
  - Storefront Editing
  - Marketing Copy
  - Project Management
  - Draft System
## Judgment Criteria                 (~40 lines)
  - When to Act vs Ask
  - Trust Tiers
## Edge Cases                        (~30 lines)
                                    ─────────────
                                    ~255 lines total
```

## Timeline

| Phase      | Effort    | Deliverable              |
| ---------- | --------- | ------------------------ |
| Phases 1-5 | 2-3 hours | New prompt written       |
| Phase 6    | 1-2 hours | Deploy + test            |
| Buffer     | 1 hour    | Iterate based on testing |
| **Total**  | 4-6 hours | Complete                 |

---

_Generated with Claude Code_
