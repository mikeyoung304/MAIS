# /workflows:docs — System Documentation Sync Workflow

**Version:** 1.0
**Date:** 2025-12-29
**Author:** Claude + Mike
**Status:** Draft

---

## Overview

Create a new workflow command `/workflows:docs` that keeps system documentation (README.md, CLAUDE.md, apps/web/README.md) synchronized with actual codebase state.

**Philosophy:** Compound engineering captures _horizontal knowledge_ (solutions to specific problems). This workflow captures _vertical knowledge_ (what the system is and does).

```
/workflows:compound  →  docs/solutions/[category]/  →  "How we fixed X"
/workflows:docs      →  README.md, CLAUDE.md        →  "What exists and how it works"
```

---

## Problem Statement

### The Gap We Experienced

After extensive work on the customer chatbot feature:

| What Compound Captured          | What Slipped Through        |
| ------------------------------- | --------------------------- |
| TypeScript build error patterns | "Customer chatbot exists"   |
| Interface method naming fixes   | "Agent system architecture" |
| Prisma type inference solutions | "Test count is now 1196"    |
| Prevention strategies           | "New routes were added"     |

**Root cause:** No automated way to detect when system docs drift from reality.

### Symptoms of Documentation Drift

1. **README test count**: Says 752, actual is 1196+
2. **Project structure**: Missing `server/src/agent/` directory
3. **Feature coverage**: Customer chatbot not mentioned
4. **Timeline accuracy**: Says "January 2025", it's December 2025
5. **Sprint status**: Outdated milestone descriptions

---

## Proposed Solution

### Design Principles (Respecting Compound Engineering)

1. **Complement, don't compete** — This is a sibling workflow, not a replacement
2. **Detect, don't auto-fix** — System docs need human review before changes
3. **Parallel subagents** — Follow compound's efficient pattern
4. **YAML-driven** — Use frontmatter for freshness tracking
5. **Blocking validation** — Verify changes before writing

### Workflow Position in the Loop

```
Plan → Work → Review → Compound → Docs → Repeat
                          ↓         ↓
                    docs/solutions/  README.md
                    (problems)       (system state)
```

**When to invoke:**

- After `/workflows:compound` flags freshness issues (Option C from brainstorm)
- Before releases
- Periodic maintenance (weekly/monthly)
- Manual invocation when major features ship

---

## Technical Specification

### Command Definition

**Location:** `~/.claude/commands/workflows/docs.md` (or MAIS-specific skill)

**Invocation:**

```bash
/workflows:docs                    # Full sync check
/workflows:docs --check            # Dry run (report only, no changes)
/workflows:docs --focus readme     # Target specific file
/workflows:docs --focus claude     # Target CLAUDE.md
/workflows:docs --focus web        # Target apps/web/README.md
```

### Subagent Architecture (6 Parallel Agents)

```
┌─────────────────────────────────────────────────────────────────┐
│                    /workflows:docs                               │
├─────────────────────────────────────────────────────────────────┤
│  Parallel Execution Phase (all run simultaneously):              │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐ │
│  │ 1. Structure     │  │ 2. Feature       │  │ 3. Metrics     │ │
│  │    Scanner       │  │    Detector      │  │    Collector   │ │
│  │                  │  │                  │  │                │ │
│  │ • New dirs       │  │ • New routes     │  │ • Test counts  │ │
│  │ • Removed dirs   │  │ • New services   │  │ • Coverage %   │ │
│  │ • Renamed files  │  │ • New components │  │ • File counts  │ │
│  └──────────────────┘  └──────────────────┘  └────────────────┘ │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐ │
│  │ 4. Timeline      │  │ 5. Reference     │  │ 6. Diff        │ │
│  │    Validator     │  │    Checker       │  │    Generator   │ │
│  │                  │  │                  │  │                │ │
│  │ • Date accuracy  │  │ • Broken links   │  │ • README diff  │ │
│  │ • Sprint status  │  │ • Missing refs   │  │ • CLAUDE diff  │ │
│  │ • Version claims │  │ • Stale paths    │  │ • web/README   │ │
│  └──────────────────┘  └──────────────────┘  └────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  Sequential Phase (after parallel completion):                   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 7. Change Proposer                                        │   │
│  │    • Synthesizes findings from all 6 agents               │   │
│  │    • Groups changes by file                               │   │
│  │    • Generates human-readable diff preview                │   │
│  │    • Waits for user approval before any writes            │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Subagent Specifications

#### 1. Structure Scanner

**Purpose:** Detect directory structure changes not reflected in docs
**Inputs:** Current `tree` output, README project structure section
**Outputs:**

```yaml
structure_changes:
  new_directories:
    - path: 'server/src/agent/'
      contains: ['customer/', 'tools/', 'proposals/']
      significance: 'Major feature - AI agent system'
  removed_directories: []
  renamed_directories: []
```

#### 2. Feature Detector

**Purpose:** Identify new features not documented
**Inputs:** Git diff since last docs update, route files, service files
**Outputs:**

```yaml
undocumented_features:
  - name: 'Customer Chatbot'
    evidence:
      - 'server/src/agent/customer/customer-tools.ts'
      - 'server/src/routes/public-customer-chat.routes.ts'
      - 'apps/web/src/components/chat/CustomerChatWidget.tsx'
    suggested_description: 'AI-powered booking assistant for tenant storefronts'
```

#### 3. Metrics Collector

**Purpose:** Gather accurate test/coverage/file counts
**Inputs:** `npm test` output, coverage reports, `find` commands
**Outputs:**

```yaml
metrics:
  tests:
    total: 1200
    passing: 1196
    failing: 2
    skipped: 2
    readme_claims: 752 # What README says
    drift: +448 # Difference
  files:
    total_typescript: 487
    total_markdown: 870
```

#### 4. Timeline Validator

**Purpose:** Check date claims and milestone accuracy
**Inputs:** README content, git log, current date
**Outputs:**

```yaml
timeline_issues:
  - location: 'README.md:67'
    claim: 'Production deployment in progress (January 2025)'
    reality: "It's December 2025"
    suggested_fix: 'Update to current status'
  - location: 'README.md:819'
    claim: 'Sprint 10 Phase 2 Complete (Nov 24, 2025)'
    reality: 'Multiple sprints have occurred since'
```

#### 5. Reference Checker

**Purpose:** Validate internal links and code references
**Inputs:** All markdown files, codebase
**Outputs:**

```yaml
broken_references:
  - file: 'README.md'
    line: 483
    link: './docs/setup/SUPABASE.md'
    status: 'valid'
  - file: 'CLAUDE.md'
    line: 156
    reference: 'server/src/routes/index.ts'
    status: 'valid'
stale_references:
  - file: 'README.md'
    claims: 'Test Infrastructure: Retry helpers (225 lines)'
    actual_lines: 312
```

#### 6. Diff Generator

**Purpose:** Create human-readable change proposals
**Inputs:** All findings from agents 1-5
**Outputs:**

````markdown
## Proposed Changes to README.md

### Section: Test Suite Documentation (line 807-829)

```diff
- **Current Status**: 752/752 tests passing (100%) - Production Ready ✅
+ **Current Status**: 1196/1200 tests passing (99.7%) - Production Ready ✅

- **Achievements**:
- - ✅ 100% test pass rate achieved (752 passing, 3 skipped, 12 todo)
+ **Achievements**:
+ - ✅ 99.7% test pass rate (1196 passing, 2 skipped, 2 failing)
```
````

### Section: Project Structure (line 291-323)

```diff
  server/               # Backend API application
  │   ├── src/
  │   │   ├── routes/      # HTTP route handlers
  │   │   ├── services/    # Business logic
  │   │   ├── adapters/    # External integrations
+ │   │   ├── agent/       # AI agent system
+ │   │   │   ├── customer/    # Customer chatbot
+ │   │   │   ├── tools/       # Tool framework
+ │   │   │   └── proposals/   # T3 confirmation system
```

````

#### 7. Change Proposer (Sequential)
**Purpose:** Present changes for human approval
**Behavior:**
1. Synthesize all findings
2. Group by target file (README.md, CLAUDE.md, apps/web/README.md)
3. Show diff preview for each file
4. **BLOCKING:** Wait for user approval before writing
5. Apply approved changes
6. Update freshness metadata

---

## Freshness Tracking System

### Add Metadata to System Docs

```markdown
<!-- In README.md, add near top -->
<!--
docs_freshness:
  last_synced: 2025-12-29
  test_count_verified: 1196
  structure_verified: 2025-12-29
  auto_sync_enabled: false
-->
````

### CLAUDE.md Freshness Section

Add to CLAUDE.md:

```markdown
## Documentation Freshness

| Document           | Last Synced | Test Count | Structure |
| ------------------ | ----------- | ---------- | --------- |
| README.md          | 2025-12-29  | 1196       | Verified  |
| apps/web/README.md | 2025-12-29  | N/A        | Verified  |
| This file          | 2025-12-29  | N/A        | Verified  |

Run `/workflows:docs --check` to verify freshness.
```

---

## Integration with Compound

### Option C Implementation: Freshness Check in Compound Output

Add to `/workflows:compound` output:

```markdown
✓ Parallel documentation generation complete

Primary Subagent Results:
✓ Context Analyzer: Identified build_error in server/src/agent
✓ Solution Extractor: Extracted 5 code fixes
...

📋 System Documentation Freshness Check:
⚠️ New directory detected: server/src/agent/customer/
Not mentioned in: README.md project structure
⚠️ Test count drift: README says 752, actual 1196
⚠️ New routes: public-customer-chat.routes.ts
Not mentioned in: CLAUDE.md

Run `/workflows:docs` to update system docs, or dismiss.
```

### Trigger Detection Logic

```typescript
// Pseudo-code for freshness detection
const FRESHNESS_CHECKS = [
  {
    name: 'new_directories',
    detect: () => {
      const readmeStructure = parseProjectStructure(README);
      const actualStructure = runTreeCommand();
      return findMissing(actualStructure, readmeStructure);
    },
    threshold: 1, // Flag if any new major directories
  },
  {
    name: 'test_count_drift',
    detect: () => {
      const readmeClaim = parseTestCount(README);
      const actual = runTestsAndCount();
      return Math.abs(actual - readmeClaim);
    },
    threshold: 50, // Flag if >50 test difference
  },
  {
    name: 'undocumented_routes',
    detect: () => {
      const documentedRoutes = parseRoutesFromDocs();
      const actualRoutes = findRouteFiles();
      return findMissing(actualRoutes, documentedRoutes);
    },
    threshold: 1, // Flag if any new route files
  },
];
```

---

## User Experience

### Invocation Flow

```
User: /workflows:docs

Claude: 🔍 Starting system documentation sync...

Launching 6 parallel analysis agents:
  ├─ Structure Scanner...
  ├─ Feature Detector...
  ├─ Metrics Collector...
  ├─ Timeline Validator...
  ├─ Reference Checker...
  └─ Diff Generator...

[2-3 seconds later]

📊 Analysis Complete

Found 4 documentation drift issues:

┌─────────────────────────────────────────────────────────────┐
│ README.md                                                    │
├─────────────────────────────────────────────────────────────┤
│ 1. Test count: 752 → 1196 (+448 tests)                      │
│ 2. Project structure: Missing server/src/agent/              │
│ 3. Timeline: "January 2025" → "December 2025"               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ CLAUDE.md                                                    │
├─────────────────────────────────────────────────────────────┤
│ 4. Missing: Customer chatbot feature documentation          │
└─────────────────────────────────────────────────────────────┘

What would you like to do?
1. Preview all changes (recommended)
2. Apply all changes
3. Select specific changes to apply
4. Dismiss (no changes)
```

### Preview Mode

````
User: 1 (Preview all changes)

Claude:

## README.md Changes (3 updates)

### Change 1: Test Count (line 807)
```diff
- **Current Status**: 752/752 tests passing (100%)
+ **Current Status**: 1196/1200 tests passing (99.7%)
````

### Change 2: Project Structure (line 291)

```diff
  server/src/
+   ├── agent/           # AI agent system
+   │   ├── customer/    # Customer chatbot tools
+   │   ├── tools/       # Tool framework
+   │   └── proposals/   # T3 confirmation system
```

### Change 3: Timeline (line 67)

```diff
- **🚀 Status: Deploying for Demo Users (January 2025)**
+ **🚀 Status: Production (December 2025)**
```

---

## CLAUDE.md Changes (1 addition)

### Change 4: New Section (after line 450)

```markdown
### Customer Chatbot (Agent System)

The platform includes an AI-powered customer chatbot for tenant storefronts:

**Key Files:**

- `server/src/agent/customer/customer-tools.ts` - 4 customer tools
- `server/src/agent/customer/customer-orchestrator.ts` - Chat orchestration
- `server/src/routes/public-customer-chat.routes.ts` - Public API
- `apps/web/src/components/chat/CustomerChatWidget.tsx` - React widget

**Tools Available:**

- `get_services` - Browse available packages
- `check_availability` - Check available dates
- `book_service` - Create booking with T3 confirmation
- `get_business_info` - Hours, policies, FAQ
```

---

Apply these changes?

1. Apply all
2. Apply README.md only
3. Apply CLAUDE.md only
4. Cancel

````

---

## Implementation Plan

### Phase 1: Core Command (MVP)
**Effort:** 2-3 hours
**Deliverables:**
- [ ] Create `~/.claude/commands/workflows/docs.md` or MAIS skill
- [ ] Implement Structure Scanner agent
- [ ] Implement Metrics Collector agent
- [ ] Basic diff generation
- [ ] User approval flow

### Phase 2: Full Agent Suite
**Effort:** 2-3 hours
**Deliverables:**
- [ ] Feature Detector agent
- [ ] Timeline Validator agent
- [ ] Reference Checker agent
- [ ] Change Proposer improvements

### Phase 3: Compound Integration
**Effort:** 1-2 hours
**Deliverables:**
- [ ] Add freshness check to compound output
- [ ] Trigger detection logic
- [ ] Seamless handoff from compound to docs

### Phase 4: Automation (Optional)
**Effort:** 1-2 hours
**Deliverables:**
- [ ] GitHub Action for drift detection
- [ ] Pre-commit hook option
- [ ] Scheduled weekly check

---

## Success Criteria

1. **Drift Detection:** Can identify when README/CLAUDE.md are out of sync
2. **Human-in-the-Loop:** Never auto-writes without approval
3. **Parallel Efficiency:** Analysis completes in <5 seconds
4. **Compound Harmony:** Works alongside compound, not against it
5. **Actionable Output:** Clear diffs that can be applied or dismissed

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Over-automation | Require explicit user approval for all changes |
| False positives | Allow dismissal with "not relevant" option |
| Scope creep | Keep focused on README/CLAUDE.md, not all docs |
| Performance | Parallel agents, cached results |

---

## Alternatives Considered

### Alternative A: Auto-Update on Every Commit
**Rejected:** Too aggressive, would create noisy diffs

### Alternative B: Modify Compound Directly
**Rejected:** Respects compound's focused purpose

### Alternative C: CI/CD Only
**Rejected:** Loses interactive review capability

### Chosen: Companion Workflow
**Rationale:**
- Respects compound engineering philosophy
- Maintains human oversight
- Can be invoked when needed
- Integrates via freshness check output

---

## References

- [Compound Engineering Plugin](https://github.com/EveryInc/compound-engineering-plugin)
- [Diataxis Framework](https://diataxis.fr/)
- [Living Documentation](https://testomat.io/features/living-documentation/)
- [MAIS docs/solutions/PREVENTION-STRATEGIES-INDEX.md](../docs/solutions/PREVENTION-STRATEGIES-INDEX.md)

---

## Appendix: Example Skill File

```markdown
# /workflows:docs

Synchronize system documentation (README.md, CLAUDE.md) with actual codebase state.

## Purpose

Detects documentation drift and proposes updates while maintaining human oversight.
Complements `/workflows:compound` which captures problem→solution knowledge.

## Usage

\`\`\`bash
/workflows:docs                    # Full sync check
/workflows:docs --check            # Dry run (report only)
/workflows:docs --focus readme     # Target specific file
\`\`\`

## What It Analyzes

- **Structure:** New/removed directories vs project structure in docs
- **Features:** Undocumented routes, services, components
- **Metrics:** Test counts, coverage, file counts
- **Timeline:** Date claims, sprint status accuracy
- **References:** Broken links, stale paths

## What It Updates

- `README.md` - Project overview, structure, metrics
- `CLAUDE.md` - Development instructions, patterns
- `apps/web/README.md` - Frontend-specific documentation

## Execution Pattern

1. Launch 6 parallel analysis agents
2. Synthesize findings into change proposals
3. Present diff preview to user
4. **WAIT** for user approval (BLOCKING)
5. Apply approved changes
6. Update freshness metadata

## Integration with Compound

After `/workflows:compound` completes, a freshness check runs automatically:

\`\`\`
📋 System Documentation Freshness Check:
   ⚠️  New directory detected: server/src/agent/customer/
   ⚠️  Test count drift: README says 752, actual 1196

   Run \`/workflows:docs\` to update system docs.
\`\`\`

## Preconditions

<preconditions enforcement="advisory">
  <check condition="codebase_stable">
    No pending changes that would affect analysis
  </check>
  <check condition="tests_passing">
    Tests should pass for accurate metrics
  </check>
</preconditions>

## Success Output

\`\`\`
✓ System documentation sync complete

Applied Changes:
  README.md:
    ✓ Updated test count (752 → 1196)
    ✓ Added server/src/agent/ to project structure
    ✓ Updated timeline to December 2025

  CLAUDE.md:
    ✓ Added Customer Chatbot section

Freshness metadata updated. Next suggested sync: 2026-01-29
\`\`\`
````
