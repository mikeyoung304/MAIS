# Diátaxis Implementation Guide

**MAIS Documentation Framework Adoption**
**Version:** 1.0
**Date:** November 12, 2025
**Status:** Proposed

---

## Executive Summary

This guide establishes Diátaxis as the foundational framework for MAIS's documentation system. With 248+ markdown files showing drift just 5 days after reorganization, we need a systematic approach grounded in user needs rather than arbitrary categories.

**Key Problem:** Current organization (setup, api, operations, security, etc.) mixes different documentation types within each category, making it unclear where new docs belong and hard for users to find what they need.

**Solution:** Adopt Diátaxis's 4-quadrant framework that organizes documentation by **user intent**, not by domain.

---

## What is Diátaxis?

Diátaxis is a systematic approach to technical documentation created by Daniele Procida and adopted by hundreds of projects globally, including Django, Gatsby, and Python's official documentation.

The framework recognizes that documentation users have four distinct needs, each requiring a different form of documentation:

1. **Learning** - Users need guided lessons to build foundational skills
2. **Problem-solving** - Users need recipes to accomplish specific goals
3. **Information-seeking** - Users need factual reference data
4. **Understanding** - Users need conceptual explanations of how things work

Diátaxis addresses what to write (content), how to write it (style), and how to organize it (architecture). It's lightweight and doesn't impose rigid implementation constraints, making it adaptable to any project's needs.

**Why it works:** Documentation fails when we conflate these four needs. A tutorial that tries to be a reference becomes neither. Diátaxis gives us clear boundaries and decision rules.

---

## The Four Quadrants

### 1. Tutorials (Learning-Oriented)

**Purpose:** Take a beginner by the hand and guide them through their first successful experience.

**Characteristics:**
- Step-by-step lessons with guaranteed outcomes
- Designed for complete beginners
- Focus on building confidence through early success
- Include concrete examples with sample data
- Avoid explanations (those belong in Explanation docs)
- Should be completable in 15-30 minutes

**Style:**
- Imperative mood: "Run this command", "Click this button"
- Present tense, active voice
- Minimal branching or conditionals
- Include expected output at each step

**When to write a tutorial:**
- New users need onboarding
- New feature requires hands-on introduction
- Complex workflow needs guided walkthrough

**MAIS Examples (proposed):**
- "Your First MAIS Tenant" (setup → first booking)
- "Widget Integration in 10 Minutes"
- "Creating Your First Custom Package"

---

### 2. How-To Guides (Goal-Oriented)

**Purpose:** Show experienced users how to solve a specific real-world problem.

**Characteristics:**
- Recipes for accomplishing specific tasks
- Assume user knows the basics
- Focus on practical solutions, not comprehensive coverage
- Address common real-world scenarios
- Can skip foundational explanations
- Usually 5-15 minutes to complete

**Style:**
- Imperative mood: "To rotate secrets, do X"
- Focus on the goal, not the journey
- Include variations and edge cases
- Provide troubleshooting tips

**When to write a how-to:**
- Users repeatedly ask "How do I...?"
- Specific problem needs documented solution
- Common workflow needs optimization guidance

**MAIS Examples (existing, to migrate):**
- `operations/DEPLOYMENT_GUIDE.md` → "How to Deploy to Production"
- `security/SECRET_ROTATION_GUIDE.md` → "How to Rotate Secrets"
- `setup/LOCAL_TESTING_GUIDE.md` → "How to Test Locally"

---

### 3. Reference (Information-Oriented)

**Purpose:** Provide complete, accurate, structured information that users consult while working.

**Characteristics:**
- Comprehensive coverage of APIs, configurations, commands
- Factual, precise, technical descriptions
- Organized for lookup, not reading cover-to-cover
- No opinions or recommendations (those belong in Explanation)
- Machine-parseable structure when possible
- Usually generated from code where applicable

**Style:**
- Declarative, factual tone
- Consistent structure across entries
- Clear parameter types, defaults, examples
- Cross-references to related items

**When to write reference:**
- API endpoints need documentation
- Configuration options need specification
- Commands/CLI need parameter reference
- Data models need field definitions

**MAIS Examples (existing, to migrate):**
- `api/` directory → Reference section
- `setup/ENVIRONMENT.md` → "Environment Variables Reference"
- `packages/contracts/` schemas → "API Contracts Reference"
- Zod schemas → Auto-generated API reference

---

### 4. Explanation (Understanding-Oriented)

**Purpose:** Clarify and illuminate concepts, design decisions, and "why" questions.

**Characteristics:**
- Discusses alternatives and tradeoffs
- Explains why things are designed the way they are
- Provides context and background
- Connects disparate concepts
- Can include opinions and recommendations
- No step-by-step instructions (those belong in Tutorials/How-To)

**Style:**
- Conversational, educational tone
- Present alternatives and reasoning
- Use diagrams to illustrate concepts
- Tell the story behind decisions

**When to write explanation:**
- Architecture needs conceptual overview
- Design decisions need justification (ADRs)
- Complex system interactions need clarification
- Users need mental models to work effectively

**MAIS Examples (existing, to migrate):**
- `ARCHITECTURE.md` → "System Architecture Explained"
- `DECISIONS.md` → "Architecture Decision Records"
- `multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md` → "Understanding Multi-Tenancy"
- Current "phases/" → Historical context, could be archived

---

## Proposed Directory Structure

```
docs/
├── INDEX.md                          # Main documentation hub
├── DIATAXIS_IMPLEMENTATION_GUIDE.md  # This file
│
├── tutorials/                        # LEARNING-ORIENTED
│   ├── README.md                     # Tutorials overview
│   ├── getting-started/
│   │   ├── 01-setup-first-tenant.md
│   │   ├── 02-configure-branding.md
│   │   └── 03-first-booking.md
│   ├── widget/
│   │   └── widget-integration-quickstart.md
│   └── api/
│       └── api-getting-started.md
│
├── how-to/                           # GOAL-ORIENTED
│   ├── README.md                     # How-to guides overview
│   ├── deployment/
│   │   ├── deploy-to-production.md
│   │   ├── rollback-deployment.md
│   │   └── configure-cdn.md
│   ├── operations/
│   │   ├── debug-failed-webhooks.md
│   │   ├── investigate-double-booking.md
│   │   └── handle-production-incident.md
│   ├── security/
│   │   ├── rotate-secrets.md
│   │   ├── audit-access-logs.md
│   │   └── configure-stripe-connect.md
│   ├── development/
│   │   ├── setup-local-environment.md
│   │   ├── run-tests-locally.md
│   │   └── add-new-endpoint.md
│   └── multi-tenant/
│       ├── create-new-tenant.md
│       ├── customize-tenant-branding.md
│       └── configure-package-catalog.md
│
├── reference/                        # INFORMATION-ORIENTED
│   ├── README.md                     # Reference docs overview
│   ├── api/
│   │   ├── overview.md               # API conventions
│   │   ├── endpoints/                # Generated from contracts
│   │   │   ├── packages.md
│   │   │   ├── bookings.md
│   │   │   ├── availability.md
│   │   │   └── webhooks.md
│   │   └── errors.md                 # Error codes reference
│   ├── configuration/
│   │   ├── environment-variables.md
│   │   ├── database-schema.md
│   │   └── feature-flags.md
│   ├── cli/
│   │   └── commands.md               # CLI reference
│   └── contracts/
│       └── zod-schemas.md            # Link to generated docs
│
├── explanation/                      # UNDERSTANDING-ORIENTED
│   ├── README.md                     # Explanation docs overview
│   ├── architecture/
│   │   ├── overview.md               # System architecture
│   │   ├── config-driven-platform.md # 2025 transformation
│   │   ├── multi-tenant-design.md
│   │   ├── concurrency-control.md
│   │   └── diagrams/
│   ├── decisions/
│   │   ├── README.md                 # ADR index
│   │   ├── 001-modular-monolith.md
│   │   ├── 002-supabase-choice.md
│   │   └── 003-ts-rest-contracts.md
│   ├── concepts/
│   │   ├── double-booking-prevention.md
│   │   ├── webhook-idempotency.md
│   │   └── tenant-isolation.md
│   └── context/
│       ├── project-history.md
│       └── sprint-evolution.md       # Why we built things this way
│
├── contributing/                     # Special category (meta-docs)
│   ├── README.md
│   ├── development-workflow.md       # Was DEVELOPING.md
│   ├── testing-strategy.md           # Was TESTING.md
│   ├── coding-guidelines.md          # Was CODING_GUIDELINES.md
│   └── documentation-guide.md        # How to write docs
│
└── archive/                          # Historical documents
    ├── README.md                     # Archive index
    ├── phases/                       # Phase completion reports
    ├── sprints/                      # Sprint documentation
    ├── planning/                     # Historical planning
    └── migration-logs/
```

---

## Decision Rules: "Where Does X Go?"

Use this flowchart to determine the correct location for any documentation:

### Step 1: What is the user's intent?

```
User wants to...                          → Quadrant

Learn the basics / Get started            → TUTORIAL
Accomplish a specific task                → HOW-TO
Look up technical details                 → REFERENCE
Understand concepts / decisions           → EXPLANATION
```

### Step 2: Apply the "Main Verb" Test

**Tutorials use:** "Build", "Create", "Make" (constructive verbs)
- ✓ "Build Your First Widget Integration"
- ✗ "Widget Integration Reference" (that's Reference)

**How-To Guides use:** "How to...", "Solve", "Fix", "Deploy"
- ✓ "How to Debug Failed Webhooks"
- ✗ "Webhook System Architecture" (that's Explanation)

**Reference uses:** "Reference", "Specification", "API"
- ✓ "Environment Variables Reference"
- ✗ "How to Configure Environment Variables" (that's How-To)

**Explanation uses:** "Understanding", "Architecture", "Concept"
- ✓ "Understanding Multi-Tenant Isolation"
- ✗ "Multi-Tenant Setup Tutorial" (that's Tutorial)

### Step 3: Apply Domain Context

After determining the quadrant, use domain-specific subdirectories:

**Primary domains:**
- `deployment/` - Deployment, releases, rollbacks
- `operations/` - Monitoring, incidents, troubleshooting
- `security/` - Auth, secrets, auditing
- `development/` - Local setup, testing, debugging
- `multi-tenant/` - Tenant management, configuration
- `widget/` - Widget integration, embedding
- `api/` - API usage, contracts, clients

**Example: "Secret Rotation"**
1. User intent: Accomplish specific task → **How-To**
2. Main verb: "How to rotate secrets" → Confirms How-To
3. Domain: Security → `how-to/security/`
4. Final path: `docs/how-to/security/rotate-secrets.md`

### Step 4: Edge Cases

**"Where does README.md go?"**
- Root `README.md` → Stays at project root (onboarding entry point)
- `docs/INDEX.md` → Documentation hub (stays in docs/)
- Quadrant READMEs → Overview of that section

**"Where do phase/sprint reports go?"**
- Current sprints → `docs/sprints/sprint-N/` (temporary, for active work)
- Completed phases → `docs/archive/phases/` (historical record)
- Lessons learned → Extract to `explanation/context/`

**"Where does TESTING.md go?"**
- Strategy and philosophy → `explanation/testing-strategy.md`
- "How to run tests" → `how-to/development/run-tests-locally.md`
- Test API reference → `reference/testing/api.md`

**"Where do operational runbooks go?"**
- Incident response → `how-to/operations/handle-production-incident.md`
- Monitoring setup → `how-to/operations/setup-monitoring.md`
- Why we monitor X → `explanation/operations/monitoring-philosophy.md`

---

## Mapping Current Categories to Diátaxis

Here's how MAIS's existing 9-category structure maps to Diátaxis:

### Current `setup/` → Split Across Quadrants

- `ENVIRONMENT.md` → **Reference** (`reference/configuration/environment-variables.md`)
- `SUPABASE.md` → **How-To** (`how-to/development/setup-database.md`)
- `LOCAL_TESTING_GUIDE.md` → **How-To** (`how-to/development/test-locally.md`)

**Reasoning:** "Setup" mixes reference info (environment vars) with procedural guides (how to set up database).

### Current `operations/` → Mostly How-To

- `DEPLOYMENT_GUIDE.md` → **How-To** (`how-to/deployment/deploy-to-production.md`)
- `INCIDENT_RESPONSE.md` → **How-To** (`how-to/operations/handle-production-incident.md`)
- `RUNBOOK.md` → **How-To** (`how-to/operations/troubleshoot-common-issues.md`)

**Reasoning:** Operational procedures are goal-oriented ("fix this incident").

### Current `security/` → Split Across Quadrants

- `SECURITY.md` → **Explanation** (`explanation/security/security-model.md`)
- `SECRET_ROTATION_GUIDE.md` → **How-To** (`how-to/security/rotate-secrets.md`)
- `SECRETS.md` → **Reference** (`reference/security/secret-types.md`)

**Reasoning:** Security has conceptual docs (model), procedures (rotation), and reference (what secrets exist).

### Current `api/` → Mostly Reference

- `API_DOCS_QUICKSTART.md` → **Tutorial** (`tutorials/api/getting-started.md`)
- `ERRORS.md` → **Reference** (`reference/api/errors.md`)
- `packages/contracts/` → **Reference** (`reference/api/contracts/`)

**Reasoning:** API docs are primarily reference, but quickstart is a tutorial.

### Current `roadmaps/` → Split Across Quadrants

- `ROADMAP.md` → **Explanation** (`explanation/context/product-roadmap.md`)
- `WIDGET_INTEGRATION_GUIDE.md` → **Tutorial** (`tutorials/widget/integration-quickstart.md`)
- `EMBEDDABLE_MULTI_TENANT_IMPLEMENTATION_PLAN.md` → **Archive** (historical planning doc)

**Reasoning:** Roadmaps explain future direction; implementation guides are tutorials or how-tos.

### Current `phases/` → Archive

- All phase completion reports → **Archive** (`archive/phases/`)
- Extract lessons learned → **Explanation** (`explanation/context/sprint-evolution.md`)

**Reasoning:** Phase reports are historical records, not living documentation.

### Current `multi-tenant/` → Split Across Quadrants

- `MULTI_TENANT_IMPLEMENTATION_GUIDE.md` → **Explanation** (`explanation/architecture/multi-tenant-design.md`)
- `TENANT_ADMIN_USER_GUIDE.md` → **How-To** (`how-to/multi-tenant/configure-tenant.md`)
- `MULTI_TENANT_ROADMAP.md` → **Explanation** (`explanation/context/multi-tenant-roadmap.md`)

**Reasoning:** Implementation guide explains concepts; user guide shows how to do tasks.

### Root-Level Files

- `README.md` → **Stays at root** (project entry point)
- `ARCHITECTURE.md` → **Explanation** (`explanation/architecture/overview.md`)
- `DEVELOPING.md` → **Contributing** (`contributing/development-workflow.md`)
- `TESTING.md` → **Contributing** (`contributing/testing-strategy.md`)
- `CODING_GUIDELINES.md` → **Contributing** (`contributing/coding-guidelines.md`)
- `DECISIONS.md` → **Explanation** (`explanation/decisions/README.md`)

---

## Migration Strategy

### Phase 1: Establish Structure (Week 1)

**Goals:**
- Create new directory structure
- Write quadrant README.md files
- Update INDEX.md with new navigation

**Tasks:**
1. Create four quadrant directories with READMEs
2. Create `contributing/` directory
3. Document decision rules in each quadrant README
4. Update `docs/INDEX.md` to point to new structure

**Deliverable:** Empty structure with clear guidance

### Phase 2: Migrate High-Value Docs (Week 2)

**Goals:**
- Move most-accessed documents first
- Establish migration patterns
- Validate structure works

**Priority documents (by usage):**
1. `README.md` → Update to reference new structure
2. `DEVELOPING.md` → `contributing/development-workflow.md`
3. `ARCHITECTURE.md` → `explanation/architecture/overview.md`
4. `operations/DEPLOYMENT_GUIDE.md` → `how-to/deployment/deploy-to-production.md`
5. `security/SECRET_ROTATION_GUIDE.md` → `how-to/security/rotate-secrets.md`
6. `setup/ENVIRONMENT.md` → `reference/configuration/environment-variables.md`
7. `api/` directory → `reference/api/` + `tutorials/api/`

**Process:**
1. Copy file to new location (don't delete yet)
2. Add redirect note in old location
3. Update all internal links
4. Update INDEX.md
5. Verify no broken links

### Phase 3: Bulk Migration (Week 3)

**Goals:**
- Migrate remaining documents
- Maintain old locations with redirects
- Update all cross-references

**Strategy:**
- Use `find` and `grep` to identify all `.md` files
- Create migration spreadsheet: Old Path → New Path → Quadrant
- Write script to update internal links
- Migrate in batches by domain

**Redirect Template:**

```markdown
# [Document Title]

**This document has moved!**

New location: [docs/how-to/security/rotate-secrets.md](../how-to/security/rotate-secrets.md)

This redirect will be removed on: [Date + 1 month]

---

[Keep old content here for 1 month]
```

### Phase 4: Cleanup & Optimization (Week 4)

**Goals:**
- Remove redirects
- Delete old files
- Consolidate duplicates
- Write missing docs

**Tasks:**
1. Remove redirect notes (old files deleted)
2. Identify gaps in documentation coverage
3. Write missing quadrant READMEs
4. Create "Getting Started" landing page
5. Generate API reference from contracts
6. Final link validation

**Validation:**
```bash
# Check for broken links
npm run docs:lint

# Verify all docs classified
find docs/ -name "*.md" | wc -l  # Should match known count
```

### Phase 5: Continuous Improvement (Ongoing)

**Goals:**
- Maintain framework discipline
- Prevent drift
- Gather user feedback

**Practices:**
1. **PR Template:** Checklist for doc classification
2. **Monthly Audit:** Review new docs for correct placement
3. **User Feedback:** Add feedback links to each doc
4. **Metrics:** Track most-viewed docs per quadrant
5. **Quarterly Review:** Assess if structure meets needs

---

## Examples: Classifying Real MAIS Docs

### Example 1: "SECRET_ROTATION_GUIDE.md"

**Current location:** `docs/security/SECRET_ROTATION_GUIDE.md`

**Analysis:**
- User intent: Accomplish specific task (rotate secrets)
- Main verb: "How to rotate secrets" → How-To
- Domain: Security
- Content: Step-by-step procedures with commands

**New location:** `docs/how-to/security/rotate-secrets.md`

**Frontmatter to add:**
```yaml
---
title: How to Rotate Secrets
quadrant: how-to
domain: security
audience: operators, devops
estimated_time: 15 minutes
last_updated: 2025-11-12
---
```

---

### Example 2: "ARCHITECTURE.md"

**Current location:** Root `/ARCHITECTURE.md`

**Analysis:**
- User intent: Understand system design
- Main verb: "Understanding architecture" → Explanation
- Domain: Architecture
- Content: Conceptual overview, design decisions, diagrams

**New location:** `docs/explanation/architecture/overview.md`

**Recommendation:** Split into multiple docs:
- `explanation/architecture/overview.md` - High-level concepts
- `explanation/architecture/config-driven-platform.md` - 2025 transformation
- `explanation/architecture/multi-tenant-design.md` - Multi-tenant specifics
- `explanation/architecture/diagrams/` - Visual diagrams

**Frontmatter:**
```yaml
---
title: System Architecture Overview
quadrant: explanation
domain: architecture
audience: developers, architects
related:
  - explanation/decisions/001-modular-monolith.md
  - reference/api/overview.md
last_updated: 2025-11-12
---
```

---

### Example 3: "LOCAL_TESTING_GUIDE.md"

**Current location:** `docs/setup/LOCAL_TESTING_GUIDE.md`

**Analysis:**
- User intent: Accomplish specific task (test locally)
- Main verb: "How to test locally" → How-To
- Domain: Development
- Content: Procedures, test scenarios, commands

**New location:** `docs/how-to/development/test-locally.md`

**Related docs to create:**
- `tutorials/getting-started/01-setup-first-tenant.md` (for beginners)
- `reference/testing/test-api.md` (for test utilities)
- `explanation/testing-strategy.md` (for philosophy)

**Frontmatter:**
```yaml
---
title: How to Test MAIS Locally
quadrant: how-to
domain: development
audience: developers
prerequisites:
  - how-to/development/setup-local-environment.md
estimated_time: 10 minutes
last_updated: 2025-11-12
---
```

---

### Example 4: "WIDGET_INTEGRATION_GUIDE.md"

**Current location:** `docs/roadmaps/WIDGET_INTEGRATION_GUIDE.md`

**Analysis:**
- User intent: **Split - both learning AND reference**
- Content: Mixes step-by-step tutorial with API reference
- Domain: Widget

**Recommendation:** Split into two docs:

**Part 1: Tutorial**
- **New location:** `docs/tutorials/widget/integration-quickstart.md`
- **Content:** "Build your first widget integration in 10 minutes"
- **Audience:** First-time integrators
- **Style:** Step-by-step with sample code

**Part 2: Reference**
- **New location:** `docs/reference/widget/embed-api.md`
- **Content:** Complete API reference for widget embedding
- **Audience:** Experienced developers needing details
- **Style:** Comprehensive parameter listing

**Frontmatter (Tutorial):**
```yaml
---
title: Widget Integration Quickstart
quadrant: tutorial
domain: widget
audience: developers (first-time)
estimated_time: 10 minutes
prerequisite_knowledge: Basic HTML/JavaScript
last_updated: 2025-11-12
---
```

**Frontmatter (Reference):**
```yaml
---
title: Widget Embed API Reference
quadrant: reference
domain: widget
audience: developers (experienced)
related:
  - tutorials/widget/integration-quickstart.md
  - explanation/architecture/widget-architecture.md
last_updated: 2025-11-12
---
```

---

## Writing Guidelines by Quadrant

### Tutorials: Style Guide

**DO:**
- Start with "In this tutorial, you will..."
- Number every step clearly (1, 2, 3...)
- Include exact commands/code to copy-paste
- Show expected output after each step
- Use concrete examples (not abstract variables)
- End with "What's Next?" section

**DON'T:**
- Explain why things work (save for Explanation)
- Offer multiple paths (one golden path only)
- Assume prior knowledge
- Skip error handling
- Use production examples (always use safe test data)

**Template:**
```markdown
# [Tutorial Title]

## What You'll Build
[One sentence: what will exist at the end]

## Prerequisites
- [ ] Node.js 18+ installed
- [ ] Git installed
- [ ] 15 minutes of time

## Steps

### Step 1: [Action Verb]
[Instruction]

Run this command:
```bash
[exact command]
```

You should see:
```
[expected output]
```

### Step 2: [Next Action]
[Continue...]

## What You Learned
- [Key takeaway 1]
- [Key takeaway 2]

## What's Next
- [Link to related how-to]
- [Link to reference docs]
```

---

### How-To Guides: Style Guide

**DO:**
- Start with the goal: "To do X, follow these steps"
- Focus on one specific problem
- Assume reader knows basics
- Include troubleshooting section
- Provide context when needed
- Link to related how-tos

**DON'T:**
- Re-teach fundamentals
- Explain system architecture (save for Explanation)
- Try to be comprehensive (focus on the goal)
- Avoid edge cases (mention them!)

**Template:**
```markdown
# How to [Accomplish Goal]

## Overview
[One paragraph: what problem this solves]

## Prerequisites
- [Assumed knowledge]
- [Required access/tools]

## Steps

### 1. [First major step]
[Instructions]

### 2. [Second major step]
[Instructions]

## Verification
[How to confirm it worked]

## Troubleshooting

**Problem:** [Common issue]
**Solution:** [Fix]

## Related Guides
- [Link to related how-to]
- [Link to reference docs]
```

---

### Reference: Style Guide

**DO:**
- Organize alphabetically or by hierarchy
- Use consistent formatting for all entries
- Include type information, defaults, examples
- Cross-reference related items
- Mark deprecated items clearly
- Provide search-friendly headings

**DON'T:**
- Include opinions or recommendations
- Write in imperative mood
- Tell stories or provide context
- Mix reference with how-to instructions

**Template:**
```markdown
# [API/Configuration Name] Reference

## Overview
[One sentence: what this reference covers]

## [Entry 1 Name]

**Type:** `string`
**Default:** `"value"`
**Required:** Yes
**Description:** [Factual description]

**Example:**
```typescript
[code example]
```

**See also:** [Related entry]

---

## [Entry 2 Name]
[Repeat structure]
```

---

### Explanation: Style Guide

**DO:**
- Discuss alternatives and tradeoffs
- Explain "why" decisions were made
- Use diagrams liberally
- Connect concepts across domains
- Provide historical context when relevant
- Express opinions (with reasoning)

**DON'T:**
- Give step-by-step instructions
- List all possible parameters
- Focus on one specific task
- Assume no prior knowledge (not a tutorial)

**Template:**
```markdown
# Understanding [Concept]

## Overview
[2-3 paragraphs: what this concept is and why it matters]

## Background
[Historical context, why we needed this]

## How It Works
[Conceptual explanation with diagrams]

## Design Decisions

### Why We Chose [Approach A]
[Reasoning]

**Alternatives Considered:**
- [Approach B]: Rejected because...
- [Approach C]: Rejected because...

## Tradeoffs
[What we gained, what we sacrificed]

## Implications
[How this affects other parts of the system]

## Related Concepts
- [Link to related explanation]
- [Link to ADR]
```

---

## Maintenance & Governance

### Documentation Ownership

**Quadrant Owners:**
- **Tutorials:** Developer Relations / Onboarding Team
- **How-To Guides:** Engineering + Operations (domain experts)
- **Reference:** Engineering (auto-generated where possible)
- **Explanation:** Architecture Team

**Review Process:**
1. Author drafts in correct quadrant
2. Quadrant owner reviews for style/placement
3. Domain expert reviews for accuracy
4. Merge with automated link checking

### Quality Metrics

**Per Quadrant:**
- **Tutorials:** Completion rate, user feedback scores
- **How-To:** Task success rate, time to completion
- **Reference:** Search effectiveness, API call success
- **Explanation:** User comprehension surveys

**Overall:**
- Documentation coverage (% of features documented)
- Link health (% of internal links valid)
- Freshness (% updated in last 6 months)
- Findability (time to find answer in docs)

### Preventing Drift

**Rules to Enforce:**
1. **No orphan docs:** Every `.md` must be linked from INDEX.md or quadrant README
2. **Frontmatter required:** All docs must have quadrant classification
3. **Annual audit:** Review all docs for correct placement
4. **PR checklist:** Doc classification required for new docs
5. **Automated linting:** CI checks for broken links, missing frontmatter

**CI Integration:**
```yaml
# .github/workflows/docs-lint.yml
name: Documentation Lint
on: [pull_request]
jobs:
  lint-docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Check doc frontmatter
        run: npm run docs:validate-frontmatter
      - name: Check broken links
        run: npm run docs:check-links
      - name: Verify INDEX.md completeness
        run: npm run docs:verify-index
```

---

## Success Criteria

We'll know Diátaxis implementation succeeded when:

1. **New docs are self-classifying** - Authors know where to put docs without asking
2. **Users find answers faster** - Reduced "where is X documented?" questions
3. **No drift after 30 days** - Structure remains stable through daily use
4. **Reduced duplication** - No more 3 docs explaining the same thing differently
5. **Higher doc quality** - Each quadrant has clear style, authors follow it
6. **Increased contribution** - External contributors can add docs confidently

**Measure:**
- Time to find documentation (user surveys)
- Number of doc clarification questions in Slack
- PR velocity for documentation changes
- User satisfaction scores (CSAT for docs)

---

## FAQ

**Q: What if a document fits multiple quadrants?**
**A:** Split it! A document that tries to be tutorial + reference serves neither audience well. Example: Widget guide → tutorial for quickstart + reference for API.

**Q: Where do sprint/phase reports go?**
**A:** Active sprints in `docs/sprints/sprint-N/`, completed phases in `archive/`. Extract lessons learned into `explanation/context/`.

**Q: Can I create new subdirectories within quadrants?**
**A:** Yes! Use domain-specific subdirs (security/, deployment/, etc.) within each quadrant.

**Q: What about generated documentation (API docs)?**
**A:** Generated docs belong in `reference/`. Commit generated files or link to hosted version.

**Q: Should I delete old docs after migrating?**
**A:** Keep redirects for 1 month, then delete. Update all links first!

**Q: What if I'm still not sure where a doc goes?**
**A:** Ask: "What is the user trying to accomplish?" Then apply the decision flowchart. When in doubt, post in #documentation channel.

---

## Resources

**Official Diátaxis:**
- Website: https://diataxis.fr/
- GitHub: https://github.com/evildmp/diataxis-documentation-framework

**MAIS-Specific:**
- This guide: `docs/DIATAXIS_IMPLEMENTATION_GUIDE.md`
- Documentation index: `docs/INDEX.md`
- Contributing guide: `contributing/documentation-guide.md` (to be created)

**Examples in the Wild:**
- Django: https://docs.djangoproject.com/
- Gatsby: https://www.gatsbyjs.com/docs/
- Python: https://docs.python.org/ (adopting Diátaxis)

---

## Next Steps

1. **Review this guide** with team for feedback
2. **Create Phase 1 structure** (empty directories + READMEs)
3. **Update INDEX.md** to reference new structure
4. **Migrate 5 high-value docs** as proof of concept
5. **Gather feedback** from team on usability
6. **Proceed to Phase 2** bulk migration

**Timeline:** 4 weeks from approval to full migration

---

**Last Updated:** November 12, 2025
**Author:** Documentation Team
**Reviewers:** [To be assigned]
**Status:** Awaiting approval
