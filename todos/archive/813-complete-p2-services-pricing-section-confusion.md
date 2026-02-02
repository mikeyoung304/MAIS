---
status: pending
priority: p2
issue_id: 813
tags: [code-review, agent, architecture, documentation, ux]
dependencies: [811]
---

# Services Section vs Pricing Section Confusion in Agent Prompts

## Problem Statement

The storefront has two overlapping concepts that confuse both the agent and users:

| Concept             | Source                        | Agent Can Edit? | Displays                       |
| ------------------- | ----------------------------- | --------------- | ------------------------------ |
| **Services**        | `Package` table in database   | NO (until #811) | Actual bookable packages       |
| **Pricing Section** | `landingPageConfigDraft` JSON | YES             | Text content only (no booking) |

When users say "services" or "packages," they mean bookable offerings. When the agent calls `add_section(type="pricing")`, it creates cosmetic text - a semantic mismatch.

**Why it matters:**

- User asks about packages → agent edits wrong thing
- Even if agent "succeeds," user doesn't see expected change
- Creates confusion about what the agent can actually do

## Findings

**From Architecture Agent:**

> This is documented technical debt (see CLAUDE.md pitfall #53, lines 56-57). The system evolved organically:
>
> - Phase 1: Visual Editor created `landingPageConfig` for content sections
> - Phase 2: AI agents needed fast-write access, added `landingPageConfigDraft`
> - Phase 3: Packages were always in their own table for booking flow integrity

**From UX Agent:**

> A photographer doesn't think in terms of "landingPageConfig JSON" vs "Package database table." They think: **"Where do people see what I offer and book me?"** Answer: The Services section.

**Dual System Architecture:**

```
User says "packages"
       ↓
Agent interprets as → "pricing section" (text)
       ↓
Calls update_section()
       ↓
Updates landingPageConfigDraft JSON
       ↓
Services section (from Package table) unchanged!
```

## Proposed Solutions

### Option A: Update Agent System Prompt with Explicit Distinction (Recommended)

**Pros:**

- Quick to implement
- No code changes needed
- Clarifies agent's decision-making

**Cons:**

- Prompt-based, may still occasionally confuse
- Doesn't fix the underlying architecture

**Effort:** Small (30 minutes)
**Risk:** Low

Add to system prompt:

```markdown
## IMPORTANT: Packages vs Pricing Section

- **"Packages" / "Services" / "What I offer"** = Bookable items in the Package database
  → Use `manage_packages` tool (create, update, delete, list)
  → These appear in the Services section with "Book" buttons

- **"Pricing section"** = Text content on the landing page
  → Use `update_section` with type="pricing"
  → This is cosmetic only, no booking functionality

When users mention packages, services, or pricing, ALWAYS clarify which they mean if ambiguous.
```

### Option B: Add Pre-Check Validation in Agent

**Pros:**

- Catches mismatches before they happen
- Asks clarifying question automatically

**Cons:**

- May slow down simple requests
- Requires code changes

**Effort:** Medium (1-2 hours)
**Risk:** Low

### Option C: Rename "Pricing Section" to "Pricing Display" or "Pricing Text"

**Pros:**

- Reduces semantic collision
- Makes it clearer this is cosmetic

**Cons:**

- Requires UI/UX review
- May confuse existing users

**Effort:** Medium (1-2 hours)
**Risk:** Medium

## Recommended Action

Implement Option A now (system prompt clarification).

After #811 is complete (package management tools), the agent will have proper tools for packages, making the distinction actionable.

## Technical Details

**Affected files:**

- `server/src/agent-v2/deploy/tenant/src/prompts/system.ts`
- Documentation in `CLAUDE.md` (already mentions this at lines 56-57)

**Testing approach:**

1. Ask agent "Update my services to show my packages"
2. Agent should ask: "Do you mean bookable packages (I'll use manage_packages) or the pricing text section?"
3. OR: Agent correctly uses `manage_packages` without clarification if context is clear

## Acceptance Criteria

- [ ] System prompt explicitly distinguishes packages vs pricing section
- [ ] Agent asks clarifying question when user intent is ambiguous
- [ ] Documentation updated to explain the two systems
- [ ] No false positives: agent doesn't ask clarification for clearly cosmetic requests

## Work Log

| Date       | Action                                 | Learnings                                      |
| ---------- | -------------------------------------- | ---------------------------------------------- |
| 2026-02-01 | E2E testing revealed confusion         | Semantic mismatch between user and agent terms |
| 2026-02-01 | Architecture agent traced data sources | Two separate systems evolved organically       |

## Resources

- [Failure Report](docs/reports/2026-02-01-agent-testing-failure-report.md) - Failure #3
- [CLAUDE.md](CLAUDE.md) - Lines 56-57 (Landing Page Config Terminology)
- [LandingPageService](server/src/services/landing-page.service.ts)
