---
status: wont_fix
priority: p2
issue_id: 906
tags: [docs-audit, docs-bloat, solutions, multi-agent-review]
dependencies: []
resolution_note: 'Per workflow rules, docs/solutions/ files should NOT be deleted - they should be marked superseded. Phase 1 (duplicates/broken links) and Phase 2 (deprecation headers) could be done opportunistically.'
---

# docs/solutions/ Bloat: 534 Files, 234K Lines — Major Consolidation Needed

## Problem Statement

The `docs/solutions/` directory has grown to **534 markdown files** totaling **234,151 lines**. This includes 64 QUICK_REFERENCE files, 113 PREVENTION files, and 35 INDEX files. Many describe patterns for systems that no longer exist. The sheer volume means AI agents cannot efficiently search for relevant solutions.

**Why it matters:**

- AI agents waste tokens reading through obsolete solution docs
- 108 files reference old `server/src/agent/` path (vs 52 for current `agent-v2/`)
- 44 files reference the old executor-registry pattern (deleted)
- 3 pairs of exact duplicate files exist
- 9 broken links in index files
- Connection Pool topic alone has 8 files

## Findings

**From Docs Bloat Agent:**

### By the Numbers

- **534** total markdown files in docs/solutions/
- **234,151** total lines
- **64** QUICK_REFERENCE files
- **113** PREVENTION files
- **35** INDEX files
- **108** files reference old `server/src/agent/` path
- **52** files reference current `server/src/agent-v2/` path
- **44** files reference old executor-registry pattern
- **39** files reference landingPageConfig without legacy marker
- **25** stale root-level report files from 2025-12 batch

### Exact Duplicate File Pairs (3)

1. visual-editor-e2e-testing (identical content in 2 files)
2. PREVENTION_STRATEGIES_INDEX (identical content in 2 files)
3. AGENT_DESIGN_QUICK_REFERENCE (identical content in 2 files)

### 9 Broken Links in Index Files

Index files reference solution docs that don't exist or were renamed.

### Obsolete File Clusters

- **Wrapper Format**: 9 files entirely about `landingPageConfig` wrapper pattern — DELETED
- **Dual Draft System**: 4 files about dual draft pattern — DELETED
- **Executor Registry**: 44 files reference pattern that no longer exists
- **Connection Pool**: 8 files for one topic — consolidate to 1

## Recommended Fix

### Phase 1: Delete duplicates and broken links

1. Delete 3 duplicate file pairs (keep one of each)
2. Fix 9 broken links in index files

### Phase 2: Add deprecation headers

3. Add "SUPERSEDED" headers to the 9 wrapper format files
4. Add "SUPERSEDED" headers to the 4 dual draft files

### Phase 3: Consolidation (larger effort)

5. Consolidate Connection Pool topic from 8 → 1-2 files
6. Archive root-level reports from 2025-12 batch (25 files)
7. Consider consolidating agent-related solutions (108 files reference old paths)

**Note:** Per workflow rules, docs/solutions/ files should NOT be deleted — they should be archived or marked superseded.

## Sources

- Docs Bloat Agent: Comprehensive quantitative audit
- Git History Agent: 39 landingPageConfig references in solutions
- Accretion Debt Agent: Documentation layer analysis
