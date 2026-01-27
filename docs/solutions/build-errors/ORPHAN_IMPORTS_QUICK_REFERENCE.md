---
module: MAIS
date: 2026-01-27
problem_type: quick_reference
component: typescript
tags: [quick-reference, deletion, build, cheat-sheet]
---

# Orphan Imports - Quick Reference Card

**Print this and pin it next to your monitor when doing large refactors!**

---

## Before Deleting ANY Export

```bash
# 1. Find all usages
rg "import.*{.*FunctionName" --type ts
rg "from.*'./path/to/file'" --type ts

# 2. Update ALL importers FIRST
# 3. THEN delete the source
```

---

## Before Committing Deletions

```bash
# Clean build - ALWAYS run this!
rm -rf server/dist packages/*/dist apps/web/.next
npm run typecheck
```

---

## Why This Happens

```
Local: Incremental build skips unchanged files
       └── File B imports deleted File A
       └── B not recompiled (unchanged)
       └── Build passes locally

CI:    Clean build recompiles everything
       └── B now compiled
       └── "Cannot find module A"
       └── BUILD FAILS
```

---

## Quick Fixes When CI Fails

```bash
# Find orphan imports from error message
rg "from.*deleted-module" --type ts

# Fix the imports, then verify:
rm -rf server/dist && npm run typecheck
```

---

## Recommended package.json Scripts

```json
"verify-deletion": "rm -rf server/dist packages/*/dist && npm run typecheck",
"build:clean": "rm -rf server/dist packages/*/dist apps/web/.next && npm run typecheck && npm run build --workspaces --if-present"
```

---

## Decision Tree

```
Deleting exported code?
├── YES
│   ├── Find all usages first (rg)
│   ├── Update importers
│   ├── Delete source
│   ├── Clean typecheck
│   └── Commit
└── NO
    └── Normal workflow
```

---

**Full details:** `ORPHAN_IMPORTS_LARGE_DELETION_PREVENTION.md`

**Last Updated:** 2026-01-27
