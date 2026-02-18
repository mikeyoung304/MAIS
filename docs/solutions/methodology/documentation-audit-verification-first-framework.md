---
title: Documentation Audit False Positive Pattern — Verification-First Framework
date: 2026-02-18
category: methodology
severity: medium
component: documentation system, agent audit tooling
tags:
  - documentation-audit
  - false-positives
  - verification-first
  - regenerate-vs-patch
  - learnings-researcher
  - archive-structure
status: resolved
related_issues:
  - docs/solutions/ discovery path hardcoded in learnings-researcher
  - archive-vs-current distinction missing in audit agents
  - stale-content vs broken-links conflation
key_metrics:
  false_positive_rate: "96% (487 claimed, ~18 real)"
  lines_deleted: 2579
  real_broken_links_fixed: 11
---

# Documentation Audit False Positive Pattern

## Problem

An automated agent scan of 898 markdown files reported 487 broken links. Five verification agents checked every claim against the actual filesystem and found only ~18 were real — a **96% false positive rate**.

Executing the raw audit findings would have wasted hours fixing "broken" links that weren't broken, adding banners to files that already had them, and rewriting docs that were actually current.

## Root Cause

Automated documentation auditing agents exhibit systematic biases:

1. **Relative link resolution from wrong base directory** — Agent resolves `./archive/planning/` from project root instead of from the source file's directory, flagging valid links as broken
2. **Archive structure blindness** — No awareness that `docs/sprints/` moved to `docs/archive/2025-12/sprints/`; reports moved files as "missing"
3. **Content staleness conflated with broken links** — Old Vite env var names flagged as "broken links" even though they're content accuracy issues, not link targets
4. **No filesystem verification step** — Reports link validity without `fs.existsSync()` check
5. **Semantic blindness to existing banners** — Flags files that already have legacy banners as needing them

## Solution

### Verification-First Approach

Before executing any audit findings, launch parallel verification agents to spot-check claims against the actual filesystem. If >20% of spot-checks are false positives, **stop and investigate the audit tool**, not the docs.

### Two-Phase Remediation

**Phase 1 — Truth Alignment (targeted fixes for real broken links):**
- Remap genuine broken links to correct archive paths
- Update stale technical references (Vite → Next.js)
- Use targeted Edit operations per file, not bulk find-and-replace

**Phase 2 — Delete Rot + Rebuild (regenerate from filesystem truth):**
- Delete 100%-obsolete docs (don't fix 26 broken links in a doc about 5 deleted agents)
- Regenerate aggregate index docs from actual filesystem state
- Archive governance docs that describe never-built systems
- Fix validation scripts to match current directory structure

### Regenerate vs. Patch Decision Framework

| Broken link ratio | Action |
|---|---|
| <10% of links broken | Patch individually |
| 10-30% broken | Investigate — likely systematic issue |
| >30% broken | Regenerate from filesystem truth |
| 100% broken | Delete the doc |

## Compound Engineering Constraint

**Critical:** `docs/solutions/` is the hardcoded discovery path for the `learnings-researcher` agent. Discovery uses **Grep on YAML frontmatter** — not link navigation or README indexing.

Preserve during any docs remediation:
- `docs/solutions/` path (hardcoded in agent)
- YAML frontmatter fields in all `docs/solutions/**/*.md` files
- Category subdirectory structure
- `PREVENTION-QUICK-REFERENCE.md` (actively indexed, referenced in CLAUDE.md)

## Checklist: Future Doc Audits

### Pre-Audit
- [ ] Verify audit tool resolves relative links from source file's directory
- [ ] Confirm archive directories are included in resolution paths
- [ ] Separate "broken link" (target missing) from "stale content" (target exists, content old)

### Verification Gate
- [ ] Spot-check 10 reported broken links with `ls` / filesystem check
- [ ] If >20% are false positives → fix audit config, not docs
- [ ] Track false positive rate — should be <5% with proper config

### Execution
- [ ] Use regenerate-vs-patch decision framework (>30% broken → regenerate)
- [ ] Delete 100%-obsolete docs — don't maintain dead documentation
- [ ] Run link-checker script against core docs post-fix to confirm zero broken links
- [ ] Verify compound engineering safeguards are intact

## Verification

Python link-checker script run against 5 core docs (README.md, CONTRIBUTING.md, docs/INDEX.md, docs/operations/README.md, docs/solutions/README.md) confirmed zero broken links post-fix.

## Related

- [compound-engineering-documentation-migration-MAIS-20251227.md](../workflow/compound-engineering-documentation-migration-MAIS-20251227.md) — Compound engineering documentation system and learnings-researcher discovery
- [TECHNICAL_DEBT_AUDIT_2026-02-13.md](../architecture/TECHNICAL_DEBT_AUDIT_2026-02-13.md) — Codebase audit methodology with evidence chains and revision tracking
- [TODO-450-FALSE-POSITIVE-ARCHITECTURE-ANALYSIS.md](../agent-design/TODO-450-FALSE-POSITIVE-ARCHITECTURE-ANALYSIS.md) — Distinguishing genuine bugs from false positives in agent analysis
- [vercel-auto-deploy-false-positive-brain-dump.md](../deployment-issues/vercel-auto-deploy-false-positive-brain-dump.md) — Production verification vs false positive triage
