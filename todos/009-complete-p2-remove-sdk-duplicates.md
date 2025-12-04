---
status: complete
priority: p2
issue_id: '009'
tags: [documentation, cleanup, client]
dependencies: []
---

# Remove Duplicate SDK Documentation in client/

## Problem Statement

Both `/client/dist/` and `/client/public/` contain identical SDK documentation files. The dist/ folder is build output and should not contain documentation committed to git. This creates maintenance burden and potential for divergence.

## Findings

**Duplicate files:**

1. `SDK_README.md` - In both dist/ and public/
2. `QUICK_START.md` - In both dist/ and public/
3. `SDK_ARCHITECTURE.md` - In both dist/ and public/
4. `USAGE_SNIPPETS.md` - In both dist/ and public/

**Verification:**

```bash
diff client/dist/SDK_README.md client/public/SDK_README.md
# (no output = identical files)
```

**Root cause:**

- dist/ should be in .gitignore (build output)
- Documentation should be source of truth in public/
- Build process copies public/ to dist/

## Proposed Solutions

### Solution 1: Add dist/\*.md to .gitignore (Recommended)

- Remove dist/ markdown files from git tracking
- Keep source in public/
- Effort: Small (15 min)
- Risk: Low
- Pros: Proper build artifact handling

### Solution 2: Remove from dist/, Keep in public/

- Manually delete dist/ markdown files
- Keep public/ as source
- Effort: Trivial (5 min)
- Risk: Low
- Cons: May reappear on next build

## Recommended Action

Solution 1 - Add to .gitignore and remove from tracking.

## Technical Details

**Files to remove from git:**

- `client/dist/SDK_README.md`
- `client/dist/QUICK_START.md`
- `client/dist/SDK_ARCHITECTURE.md`
- `client/dist/USAGE_SNIPPETS.md`

**Commands:**

```bash
# Add to .gitignore
echo "client/dist/*.md" >> .gitignore

# Remove from git tracking (keeps files locally)
git rm --cached client/dist/SDK_README.md
git rm --cached client/dist/QUICK_START.md
git rm --cached client/dist/SDK_ARCHITECTURE.md
git rm --cached client/dist/USAGE_SNIPPETS.md
```

**Alternative - Check if dist/ should be entirely ignored:**

```bash
# Check current .gitignore
grep "dist" .gitignore

# If dist/ not ignored, consider:
echo "client/dist/" >> .gitignore
git rm -r --cached client/dist/
```

## Acceptance Criteria

- [ ] dist/\*.md files removed from git tracking
- [ ] public/\*.md files remain as source of truth
- [ ] .gitignore updated to prevent future commits
- [ ] Build process still works correctly

## Work Log

| Date       | Action  | Notes                        |
| ---------- | ------- | ---------------------------- |
| 2025-11-24 | Created | 4 duplicate files identified |

## Resources

- client/dist/: Build output directory
- client/public/: Static assets source
