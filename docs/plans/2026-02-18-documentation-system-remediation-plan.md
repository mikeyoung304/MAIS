# Documentation System Remediation Plan — Verified & Refined

**Date:** 2026-02-18
**Owner:** Documentation maintenance sprint
**Status:** VERIFIED — 5-agent swarm confirmed/refuted original audit findings
**Branch:** `fix/docs-remediation`
**Philosophy:** Compound Engineering — each change must make future AI agent work easier, not just satisfy a checklist.

---

## 1. Audit Verification Summary

An external agent scanned 898 markdown files and reported 487 broken links. We launched 5 parallel verification agents to check every claim against the actual filesystem. Results:

### Confirmed Findings

- [x] README.md has 7 broken links to archived files (audit said 8)
- [x] docs/INDEX.md has 2 broken links
- [x] docs/operations/README.md has 2 broken links
- [x] CONTRIBUTING.md has stale `client/` directory refs (lines 171, 195) — but NO broken links
- [x] TESTING.md has stale `VITE_API_URL`/`VITE_APP_MODE` refs (lines 76-77)
- [x] PRODUCTION_DEPLOYMENT_GUIDE.md has stale `client/dist` output dir ref
- [x] DUAL_DEPLOYMENT_PREVENTION_STRATEGIES.md is 100% obsolete (5 deleted agents, 26 broken links)
- [x] docs/solutions/README.md has 32 broken links (42% of all links)
- [x] DOCUMENTATION_STANDARDS.md references nonexistent `docs/sprints/` and `docs/phases/`
- [x] ADR location: doc says `docs/architecture/`, reality is `docs/adrs/` (20 ADRs)
- [x] validate-docs.sh approved dirs include nonexistent directories, zero link checking

### Refuted / Corrected

- [ ] ~~docs/README.md: 8 broken links~~ → **0 broken links** (false positive)
- [ ] ~~CONTRIBUTING.md: broken links~~ → **0 broken links** (stale content, not links)
- [ ] ~~DOCUMENTATION_QUICK_REFERENCE.md: broken link~~ → **0 broken links** (false positive)
- [ ] ~~Sprint 10 remap target: `2025-11-21_SPRINT_10_COMPLETION_REPORT.md`~~ → Actual filename: `2025-11-24_SPRINT_10_FINAL_SUMMARY.md`
- [ ] ~~deploy-agents.yml needs updates~~ → **Already correct** with 3-agent set
- [ ] ~~NEXTJS_MIGRATION_CLAUDE_MD_UPDATES.md is legacy~~ → **Current and actionable** (Jan 8, 2026)
- [ ] ~~AGENT_PREVENTION_INDEX.md needs legacy banner~~ → **Already has one** (added Jan 26, 2026)
- [ ] ~~EXTRACTION_SUMMARY_20260102.md needs legacy banner~~ → **Already has one** (added Jan 26, 2026)

### New Finding: Compound Engineering Constraint (audit missed)

- `docs/solutions/` is the **hardcoded discovery path** for `learnings-researcher` agent
- Discovery is via **Grep on YAML frontmatter** — NOT via README navigation or link following
- `PREVENTION-QUICK-REFERENCE.md` is actively indexed
- **Any restructuring that changes the `docs/solutions/` path or YAML frontmatter fields breaks the learning loop**

---

## 2. Guiding Principles (Not the Original Audit's)

The original audit treated this as a documentation governance project — fix all links, harden validators, enforce structure standards. That's backwards for our system.

**Our docs serve AI agents, not human librarians.** Prioritize:

1. **Agent-readable root docs** — README.md, DEVELOPING.md, TESTING.md, CONTRIBUTING.md must reflect current reality because agents read them on-demand
2. **Compound knowledge preservation** — docs/solutions/ YAML frontmatter and category structure must stay intact (learnings-researcher depends on it)
3. **Ruthless deletion over link-fixing** — if a doc is 100% obsolete, delete it. Don't spend time fixing 26 broken links in a doc that references 5 deleted agents.
4. **No governance theater** — don't rewrite DOCUMENTATION_STANDARDS.md to match reality. Archive it. The real standard is CLAUDE.md.

---

## 3. Phase Plan (2 PRs, Not 3)

### Phase 1: Truth Alignment (PR-A)

**Goal:** Every doc an agent might read on-demand tells the truth about the current system.

#### 1.1 Fix README.md broken links (7 remaps)

| Broken Link                                    | Remap Target                                                           |
| ---------------------------------------------- | ---------------------------------------------------------------------- |
| `./docs/sprints/SPRINT_10_FINAL_SUMMARY.md`    | `./docs/archive/2025-12/sprints/2025-11-24_SPRINT_10_FINAL_SUMMARY.md` |
| `./docs/phases/PHASE_5_IMPLEMENTATION_SPEC.md` | `./docs/archive/2025-11/phases/PHASE_5_IMPLEMENTATION_SPEC.md`         |
| `./docs/phases/PHASE_1_COMPLETION_REPORT.md`   | `./docs/archive/2025-11/phases/PHASE_1_COMPLETION_REPORT.md`           |
| `./docs/phases/PHASE_2B_COMPLETION_REPORT.md`  | `./docs/archive/2025-11/phases/PHASE_2B_COMPLETION_REPORT.md`          |
| `./SESSION_SUMMARY.md`                         | `./docs/archive/2025-11/analysis/SESSION_SUMMARY.md`                   |
| `./FORWARD_PLAN.md`                            | `./docs/archive/2025-11/analysis/FORWARD_PLAN.md`                      |
| `./FINAL_COMPLETION_REPORT.md`                 | `./docs/archive/2025-11/analysis/FINAL_COMPLETION_REPORT.md`           |

#### 1.2 Fix docs/INDEX.md broken links (2 remaps)

| Broken Link                                        | Remap Target                                                   |
| -------------------------------------------------- | -------------------------------------------------------------- |
| `./operations/DEPLOYMENT_GUIDE.md`                 | `./operations/PRODUCTION_DEPLOYMENT_GUIDE.md`                  |
| `./multi-tenant/MULTI_TENANCY_READINESS_REPORT.md` | `./archive/2025-11/planning/MULTI_TENANCY_READINESS_REPORT.md` |

#### 1.3 Fix docs/operations/README.md broken links (2 remaps)

| Broken Link                                | Remap Target                                                     |
| ------------------------------------------ | ---------------------------------------------------------------- |
| `./DEPLOY_NOW.md`                          | `../archive/2025-11/operations/DEPLOY_NOW.md`                    |
| `../../SERVER_IMPLEMENTATION_CHECKLIST.md` | `../archive/2025-11/planning/SERVER_IMPLEMENTATION_CHECKLIST.md` |

#### 1.4 Update CONTRIBUTING.md — Vite → Next.js

- Line 171: Replace `├── client/` → `├── apps/web/` in project structure diagram
- Line 195: Replace `client/src/features/` → `apps/web/src/` path references
- Replace any `dev:client` → `dev:web`

#### 1.5 Update TESTING.md — Vite env vars

- Lines 76-77: Replace `VITE_API_URL`/`VITE_APP_MODE` with current env var names or note they're legacy naming in Playwright config

#### 1.6 Update PRODUCTION_DEPLOYMENT_GUIDE.md — build output

- Line 40: Replace `client/dist` → `apps/web/.next`
- Remove any Vite-specific build guidance

#### 1.7 Update RUNBOOK.md — dev commands

- Replace any `dev:client` → `dev:web`

**Acceptance:** All root-level and operations docs reflect current architecture. Zero broken links in README.md, docs/INDEX.md, docs/operations/README.md.

---

### Phase 2: Delete Rot + Rebuild Solutions Index (PR-B)

**Goal:** Remove 100%-obsolete docs. Rebuild solutions/README.md from actual filesystem.

#### 2.1 DELETE docs/solutions/DUAL_DEPLOYMENT_PREVENTION_STRATEGIES.md

This doc is 100% obsolete:

- References 5 deleted agents (concierge, marketing, storefront, booking, project-hub)
- 26 of 30 internal links are broken (86%)
- Every code example, checklist, and diagram is wrong
- The actual deploy-agents.yml workflow is already correct and self-documenting

**Per "No Debt" principle:** Delete, don't fix. The `deploy-agents.yml` workflow + `SERVICE_REGISTRY.md` are the source of truth.

#### 2.2 Regenerate docs/solutions/README.md

Rewrite from scratch based on the actual 558 files across 31 subdirectories. Structure:

```markdown
# Solutions Index

Institutional knowledge captured via `/workflows:compound`.
Searched automatically by `learnings-researcher` via YAML frontmatter.

## Active Categories

[List of 31 subdirectories with file counts and 1-line descriptions]

## Key Reference Docs

- PREVENTION-QUICK-REFERENCE.md — daily patterns cheat sheet
- ADK_A2A_PREVENTION_INDEX.md — current agent patterns
- ADK_AGENT_DEVELOPMENT_QUICK_REFERENCE.md — agent dev guide

## Legacy Docs (top-level)

[Brief list of top-level files with status notes]
```

Remove all 32 broken links by regenerating rather than fixing individually.

#### 2.3 Archive governance docs that describe a system that was never built

Move to `docs/archive/`:

- `docs/DOCUMENTATION_STANDARDS.md` — prescribes nonexistent `docs/sprints/`, `docs/phases/`, wrong ADR path. Never followed. CLAUDE.md is the real standard.
- `docs/EXECUTION_ORDER.md` — one-time migration doc, historical only

#### 2.4 Fix validate-docs.sh approved dirs (minimal)

Update the `APPROVED_DIRS` array to remove nonexistent directories (`docs/sprints`, `docs/phases`). Do NOT add link checking or machine-readable output — that's over-engineering for this project.

**Acceptance:** No 100%-obsolete docs in active directories. solutions/README.md has zero broken links and reflects actual filesystem. Governance docs archived.

---

## 4. What We're NOT Doing (And Why)

| Original Audit Recommendation                   | Our Decision       | Rationale                                                                                   |
| ----------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------- |
| Fix 26 broken links in DUAL_DEPLOYMENT doc      | **Delete the doc** | 100% obsolete. Fixing links in a doc about 5 deleted agents is waste.                       |
| Add legacy banners to 3 solutions docs          | **Skip**           | 2 of 3 already have banners. The third (NEXTJS_MIGRATION) is actually current.              |
| Rewrite DOCUMENTATION_STANDARDS.md              | **Archive it**     | It describes a system that was never built. CLAUDE.md is the real standard.                 |
| Build link-checking script (check-doc-links.py) | **Skip**           | Over-engineering. Agents discover docs via Grep on frontmatter, not links.                  |
| Harden validate-docs.sh with link validation    | **Minimal fix**    | Just fix the approved dirs list. Full link validation adds maintenance burden with low ROI. |
| 3 PRs                                           | **2 PRs**          | Less overhead. Phase 1 is link fixes + content truth. Phase 2 is deletions + rebuild.       |

---

## 5. Compound Engineering Safeguards

These MUST be preserved during all changes:

1. **`docs/solutions/` path** — hardcoded in learnings-researcher agent
2. **YAML frontmatter** in all `docs/solutions/**/*.md` files — Grep discovery mechanism
3. **Category subdirectories** — `build-errors/`, `runtime-errors/`, `database-issues/`, etc.
4. **`PREVENTION-QUICK-REFERENCE.md`** — actively indexed, referenced in CLAUDE.md
5. **`docs/plans/*.md`** — tracked by workflows:work (live checkboxes)
6. **`docs/brainstorms/*.md`** — detected by workflows:plan

---

## 6. Verification (Run After Each PR)

```bash
# 1) Typecheck (ensure no code breaks)
npm run --workspace=server typecheck && npm run --workspace=apps/web typecheck

# 2) Targeted broken-link check for core docs
python3 - <<'PY'
from pathlib import Path
import re
root = Path('/Users/mikeyoung/CODING/MAIS')
files = [
    'README.md', 'CONTRIBUTING.md',
    'docs/INDEX.md', 'docs/operations/README.md',
    'docs/solutions/README.md'
]
link_re = re.compile(r'\[[^\]]*\]\(([^)]+)\)')
skip = ('http://', 'https://', 'mailto:', 'javascript:', '#')
failed = []
for f in files:
    p = root / f
    if not p.exists():
        continue
    txt = p.read_text(encoding='utf-8', errors='ignore')
    for m in link_re.finditer(txt):
        raw = m.group(1).strip()
        if not raw or raw.startswith(skip):
            continue
        t = re.sub(r'\s+".*$', '', raw).strip().split('#', 1)[0].split('?', 1)[0].strip()
        if not t:
            continue
        r = Path(t) if Path(t).is_absolute() else (p.parent / t)
        if not r.exists():
            failed.append((f, t))
if failed:
    print(f'BROKEN: {len(failed)} links')
    for f, t in failed:
        print(f'  {f} → {t}')
    raise SystemExit(1)
print('OK: core docs have zero broken links')
PY
```

---

## 7. Definition of Done

- [ ] README.md, docs/INDEX.md, docs/operations/README.md: zero broken links
- [ ] CONTRIBUTING.md, TESTING.md, PRODUCTION_DEPLOYMENT_GUIDE.md: no Vite/client references
- [ ] DUAL_DEPLOYMENT_PREVENTION_STRATEGIES.md: deleted
- [ ] docs/solutions/README.md: regenerated from actual filesystem, zero broken links
- [ ] DOCUMENTATION_STANDARDS.md + EXECUTION_ORDER.md: archived
- [ ] validate-docs.sh: approved dirs list matches reality
- [ ] Compound Engineering safeguards verified: learnings-researcher can still discover docs/solutions/
