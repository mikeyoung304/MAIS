---
status: complete
priority: p1
issue_id: '004'
tags: [documentation, cleanup, github]
dependencies: ['003']
---

# Delete Duplicate .github/workflows/README.md

## Problem Statement

The `.github/workflows/` directory contains two README files:

1. `README.md` - References "Elope" project (WRONG)
2. `WORKFLOWS_README.md` - References "MAIS" platform (CORRECT)

The duplicate README.md references the wrong project and should be deleted.

## Findings

**File comparison:**

```
workflows/README.md - Line 12:
  "![CI/CD Pipeline](https://github.com/YOUR_USERNAME/Elope/actions/workflows/ci.yml/badge.svg)"
  ^^^ References "Elope" project (INCORRECT)

workflows/WORKFLOWS_README.md - Line 1:
  "# GitHub Actions CI/CD Workflows - MAIS Platform"
  ^^^ References "MAIS" platform (CORRECT)
```

**Impact:**

- Confusion about which README is authoritative
- Wrong project name in badge URLs
- Duplicate content maintenance burden

## Proposed Solutions

### Solution 1: Delete README.md, Keep WORKFLOWS_README.md (Recommended)

- Remove `.github/workflows/README.md`
- Keep `.github/workflows/WORKFLOWS_README.md` as authoritative
- Effort: Trivial (5 min)
- Risk: None
- Pros: Clean, correct
- Cons: None

### Solution 2: Merge and Keep README.md Name

- Merge content into README.md
- Delete WORKFLOWS_README.md
- Update all "Elope" → "MAIS"
- Effort: Small (15 min)
- Risk: Low
- Pros: Standard naming convention
- Cons: More work

## Recommended Action

Solution 1 - Delete the incorrect README.md file.

## Technical Details

**File to delete:**

- `.github/workflows/README.md`

**File to keep:**

- `.github/workflows/WORKFLOWS_README.md`

**Command:**

```bash
git rm .github/workflows/README.md
```

## Acceptance Criteria

- [ ] `.github/workflows/README.md` deleted
- [ ] Only `WORKFLOWS_README.md` remains in workflows/
- [ ] No broken internal links

## Work Log

| Date       | Action  | Notes                                  |
| ---------- | ------- | -------------------------------------- |
| 2025-11-24 | Created | Duplicate file with wrong project name |

## Resources

- Location: `/Users/mikeyoung/CODING/MAIS/.github/workflows/`
