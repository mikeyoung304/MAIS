# docs: Sync Pillar Documentation for Prisma 7, Render, and Agent Eval

**Status:** Ready for Implementation
**Priority:** P0 (Documentation drift blocking accuracy)
**Estimated Effort:** 75 minutes
**Created:** 2026-01-03

---

## Overview

Update all pillar documentation (CLAUDE.md, ARCHITECTURE.md, README.md, DEVELOPING.md, DECISIONS.md) to reflect recent infrastructure changes:

1. **Prisma 6 → 7 upgrade** (breaking changes, DIRECT_URL requirement)
2. **Render deployment** (replaces Vercel/Railway references)
3. **Agent evaluation system** (new feature, completely undocumented)
4. **Missing ADR index entries** (ADR-015, ADR-016 exist but not indexed)

---

## Problem Statement

The pillar documentation has drifted significantly from the actual codebase state:

| Document        | Issue                        | Impact                            |
| --------------- | ---------------------------- | --------------------------------- |
| CLAUDE.md       | Says "Prisma 6" (line 11)    | Developers get wrong version info |
| CLAUDE.md       | Missing ANTHROPIC_API_KEY    | Agent features fail silently      |
| CLAUDE.md       | No agent-eval section        | Major feature undocumented        |
| ARCHITECTURE.md | Says "Vercel/Railway"        | Incorrect deployment guidance     |
| ARCHITECTURE.md | No agent-eval pipeline       | Architectural gap                 |
| README.md       | Says "Prisma 6"              | Wrong version in overview         |
| README.md       | Missing `apps/web/`          | Project structure incomplete      |
| DEVELOPING.md   | Missing DIRECT_URL           | Builds fail on Render             |
| DECISIONS.md    | ADR-015, ADR-016 not indexed | ADRs exist but undiscoverable     |

---

## Proposed Solution

Execute a phased documentation sync following the project's Diátaxis framework and naming conventions.

### Phase 1: Index Updates (5 min)

Update DECISIONS.md to index existing but unlisted ADRs.

### Phase 2: Core Pillar Updates (45 min)

Update each pillar doc with accurate information, in parallel.

### Phase 3: Verification (10 min)

Cross-reference check and grep for stale references.

---

## Technical Approach

### Phase 1: DECISIONS.md Index Update

**File:** `/Users/mikeyoung/CODING/MAIS/DECISIONS.md`

**Add to index:**

```markdown
| ADR-015 | API Proxy Pattern | Accepted | P1 | Architecture |
| ADR-016 | Field Naming Conventions | Accepted | P2 | Architecture |
```

**Add to "Frontend & Multi-Tenant" section:**

```markdown
- [ADR-015: API Proxy Pattern](docs/adrs/ADR-015-api-proxy-pattern.md)
- [ADR-016: Field Naming Conventions](docs/adrs/ADR-016-field-naming-conventions.md)
```

---

### Phase 2a: CLAUDE.md Updates

**File:** `/Users/mikeyoung/CODING/MAIS/CLAUDE.md`

#### Edit 1: Fix Prisma Version (Line 11)

```markdown
# BEFORE

- Backend: Express 4, TypeScript 5.9.3 (strict), Prisma 6, PostgreSQL

# AFTER

- Backend: Express 4, TypeScript 5.9.3 (strict), Prisma 7, PostgreSQL
```

#### Edit 2: Add Agent Eval to Current Status (After line 26)

```markdown
- Agent evaluation system: COMPLETE (batch evaluator, Render cron, Claude Haiku 4.5)
```

#### Edit 3: Add ANTHROPIC_API_KEY to Environment Setup (Line ~640)

```markdown
AI/Agent (required for agent features):

- `ANTHROPIC_API_KEY` - Required for agent chat and evaluations
```

#### Edit 4: Add Agent Evaluation System Section (After Business Advisor section, ~line 490)

````markdown
### Agent Evaluation System

Automated quality assessment for AI agent conversations. Evaluates traces for safety, accuracy, and goal completion.

**Architecture:** Cron Job (Render) → `run-eval-batch.ts` → EvalPipeline → Evaluator (Claude Haiku 4.5)

**Key Files:**

- `server/src/agent/evals/pipeline.ts` - Batch processing pipeline
- `server/src/agent/evals/evaluator.ts` - LLM-based evaluator
- `server/src/agent/evals/rubrics/` - Evaluation rubrics
- `server/scripts/run-eval-batch.ts` - CLI batch runner
- `render.yaml` - Cron job configuration (every 15 min)

**Commands:**

```bash
npm run eval-batch                    # Run evaluation batch manually
npm run eval-batch -- --dry-run       # Preview without executing
npm run eval-batch -- --tenant-id=X   # Single tenant
```
````

**Environment Variables:**

- `ANTHROPIC_API_KEY` - Required for evaluator LLM calls

**Deployment:**

- Render cron job runs every 15 minutes
- See `docs/solutions/deployment-issues/agent-eval-cron-job-render-setup-MAIS-20260102.md`

````

#### Edit 5: Add render.yaml to Key Documentation (Line ~660)
```markdown
- **render.yaml** - Render deployment blueprint (API + agent-eval cron)
````

---

### Phase 2b: ARCHITECTURE.md Updates

**File:** `/Users/mikeyoung/CODING/MAIS/ARCHITECTURE.md`

#### Edit 1: Fix Deployment Platform (Line ~641)

```markdown
# BEFORE

**Infrastructure:** Supabase (PostgreSQL), Upstash (Redis), Vercel/Railway (hosting)

# AFTER

**Infrastructure:** Supabase (PostgreSQL), Upstash (Redis), Render (API + cron jobs), Vercel (Next.js storefronts)
```

#### Edit 2: Update DIRECT_URL Explanation (Line ~650)

```markdown
# BEFORE

DIRECT_URL=postgresql://... # Direct connection for migrations

# AFTER

DIRECT_URL=postgresql://... # Direct connection for Prisma generate and migrations (Supabase Transaction Pooler, port 6543)
```

#### Edit 3: Add ANTHROPIC_API_KEY (After line ~666)

```markdown
# AI/Agent (Required for evaluation pipeline)

ANTHROPIC_API_KEY=... # Claude API for agent evaluation
```

#### Edit 4: Add Prisma Version Note (Line ~627)

```markdown
# BEFORE

- **Database:** Supabase PostgreSQL with Prisma ORM

# AFTER

- **Database:** Supabase PostgreSQL with Prisma 7.x ORM
```

#### Edit 5: Add Agent Evaluation System Section (After Service Map, ~line 264)

```markdown
## Agent Evaluation System

The platform includes an automated evaluation pipeline for AI agent conversations:

### Architecture
```

Conversation → Trace Storage → Cron Job (15 min) → Evaluator → Flagging
↓ ↓
ConversationTrace Claude Haiku 4.5

````

### Key Components

- **Tracing:** All agent conversations recorded with PII redaction
- **Evaluation:** Periodic batch evaluation using Claude Haiku 4.5
- **Flagging:** Problematic conversations flagged for human review

### Render Cron Job

```yaml
# render.yaml
- type: cron
  name: mais-eval-batch
  schedule: "*/15 * * * *"
  startCommand: cd server && npx tsx scripts/run-eval-batch.ts
````

````

---

### Phase 2c: README.md Updates

**File:** `/Users/mikeyoung/CODING/MAIS/README.md`

#### Edit 1: Fix Prisma Version (Line ~262)
```markdown
# BEFORE
Prisma 6

# AFTER
Prisma 7
````

#### Edit 2: Add apps/web/ to Project Structure (Line ~292)

```markdown
apps/
└── web/ # Next.js 14 App Router (port 3000)
└── src/
├── app/ # App Router pages
├── components/ # React components
└── lib/ # Utilities
```

#### Edit 3: Add Next.js to Tech Stack

```markdown
- Frontend (Storefronts): Next.js 14, NextAuth v5
```

---

### Phase 2d: DEVELOPING.md Updates

**File:** `/Users/mikeyoung/CODING/MAIS/DEVELOPING.md`

#### Edit 1: Add DIRECT_URL to Environment Variables Section

```markdown
# Database (Prisma 7)

DATABASE_URL=postgresql://... # Session Pooler (port 5432, for queries)
DIRECT_URL=postgresql://... # Transaction Pooler (port 6543, for Prisma generate/migrations)
```

#### Edit 2: Add prisma.config.ts Note

```markdown
### Prisma 7 Configuration

In Prisma 7, database URLs moved from `schema.prisma` to `server/prisma.config.ts`.
The schema file only defines the data model; connection configuration is in the config file.
```

#### Edit 3: Update Prisma Generate Command

```markdown
# Generate Prisma Client (includes postgenerate script for barrel file)

cd server && npm run prisma:generate
```

---

### Phase 3: Verification

Run these commands to verify no stale references remain:

```bash
# Check for Prisma 6 references
grep -r "Prisma 6" --include="*.md" . | grep -v "archive/" | grep -v "node_modules/"

# Check for Vercel/Railway as primary hosting
grep -rE "(Vercel|Railway).*hosting" --include="*.md" docs/

# Verify ADR files exist
ls docs/adrs/ADR-015* docs/adrs/ADR-016*

# Check all ADR links resolve
grep -oh 'docs/adrs/ADR-[0-9]*[^)]*' CLAUDE.md DECISIONS.md | sort -u | while read f; do
  [ -f "$f" ] || echo "Missing: $f"
done
```

---

## Acceptance Criteria

### Functional Requirements

- [ ] CLAUDE.md shows "Prisma 7" (not "Prisma 6")
- [ ] CLAUDE.md has Agent Evaluation System section
- [ ] CLAUDE.md lists ANTHROPIC_API_KEY in environment variables
- [ ] ARCHITECTURE.md references Render (not Vercel/Railway for API)
- [ ] ARCHITECTURE.md has agent evaluation pipeline documentation
- [ ] README.md shows "Prisma 7"
- [ ] README.md includes `apps/web/` in project structure
- [ ] DEVELOPING.md includes DIRECT_URL with explanation
- [ ] DECISIONS.md indexes ADR-015 and ADR-016

### Consistency Requirements

- [ ] `grep -r "Prisma 6" docs/` returns no results (except archives)
- [ ] All ADR links in CLAUDE.md resolve to existing files
- [ ] Version numbers match `server/package.json`

### Quality Requirements

- [ ] All changes follow DOCUMENTATION_STANDARDS.md conventions
- [ ] No orphaned TODO/FIXME comments introduced
- [ ] Consistent formatting across all updated files

---

## Files to Modify

| File              | Changes                                                          | Priority |
| ----------------- | ---------------------------------------------------------------- | -------- |
| `DECISIONS.md`    | Add ADR-015, ADR-016 to index                                    | P0       |
| `CLAUDE.md`       | Prisma 7, agent-eval section, ANTHROPIC_API_KEY, render.yaml ref | P0       |
| `ARCHITECTURE.md` | Render deployment, agent-eval pipeline, DIRECT_URL               | P0       |
| `README.md`       | Prisma 7, apps/web/ structure, Next.js stack                     | P1       |
| `DEVELOPING.md`   | DIRECT_URL, prisma.config.ts note                                | P0       |

---

## Dependencies & Risks

### Dependencies

- Research complete (Prisma 7 docs, Render config, agent-eval implementation)
- ADR-015, ADR-016 files exist in `docs/adrs/`

### Risks

| Risk                           | Mitigation                       |
| ------------------------------ | -------------------------------- |
| Stale references in other docs | Grep verification in Phase 3     |
| Inconsistent version numbers   | Pull from package.json directly  |
| Missing agent-eval details     | Reference existing solution docs |

---

## References

### Internal References

- `server/package.json:83` - Prisma version (`"prisma": "^7.2.0"`)
- `server/prisma.config.ts` - Prisma 7 configuration
- `render.yaml` - Render deployment blueprint
- `docs/adrs/ADR-015-api-proxy-pattern.md` - Existing but unindexed
- `docs/adrs/ADR-016-field-naming-conventions.md` - Existing but unindexed
- `docs/solutions/deployment-issues/agent-eval-cron-job-render-setup-MAIS-20260102.md`
- `docs/solutions/database-issues/prisma-7-json-type-breaking-changes-MAIS-20260102.md`

### External References

- [Prisma 7 Upgrade Guide](https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-7)
- [Render Cron Jobs](https://render.com/docs/cron-jobs)

---

## Implementation Notes

### Parallel Execution

Phase 2 tasks (2a, 2b, 2c, 2d) can be executed in parallel since they modify different files.

### Commit Strategy

Single commit with message:

```
docs: sync pillar docs for Prisma 7, Render, and agent-eval

- Update Prisma version 6→7 across all pillar docs
- Add Render as deployment platform (replaces Vercel/Railway)
- Add agent evaluation system documentation
- Add DIRECT_URL to environment setup
- Index ADR-015 and ADR-016 in DECISIONS.md
- Add apps/web/ to README project structure

🤖 Generated with Claude Code
```
