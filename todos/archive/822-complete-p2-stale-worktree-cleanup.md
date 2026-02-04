---
status: complete
priority: p2
issue_id: 822
tags: [code-review, tech-debt, cleanup, git]
dependencies: []
---

# Tech Debt: Stale Git Worktree Cleanup

## Problem Statement

A stale git worktree `.worktrees/pr-28-review/` exists from a code review branch dated January 23, 2026 (13 days ago). It consumes 66MB disk space and contains old code that differs from main.

**Why it matters:**

- 66MB of unnecessary disk usage
- Contains code that doesn't match main (confusing for searches)
- Old XState onboarding code only exists in this worktree (not main)

## Findings

**From tech-debt-validator agent:**

```bash
$ git worktree list
/Users/mikeyoung/CODING/MAIS                          766dc21e [main]
/Users/mikeyoung/CODING/MAIS/.worktrees/pr-28-review  76aa3906 [pr-28-rebased]

$ du -sh .worktrees/pr-28-review
66M

$ git show --no-patch pr-28-rebased
commit 76aa3906
Date: Thu Jan 23 13:13:01 2026 -0500
fix(agent): address P1 code review findings
```

**Worktree contents (not in main):**

- `server/src/agent/onboarding/` - Old XState onboarding code (~60 files)
- `REFACTOR_REPORT.md` - Code review report (Dec 26, 2025)
- `ORPHAN_REGISTER.md` - Orphan code tracking

The handoff summary mentioned "archived agents at server/src/agent-v2/archive/" - this does NOT exist in main, only in this stale worktree.

## Proposed Solutions

### Option A: Remove Worktree and Branch (Recommended)

**Pros:** Clean disk space, remove confusion
**Cons:** Loses worktree state (but git history preserved)
**Effort:** Trivial (1 minute)
**Risk:** Low

```bash
git worktree remove pr-28-review
git branch -d pr-28-rebased  # If merged
# OR
git branch -D pr-28-rebased  # If not merged (verify first)
```

### Option B: Keep as Archive Reference

**Pros:** Quick access to old code
**Cons:** Disk usage, confusion risk
**Effort:** None
**Risk:** None

Keep worktree but add `.gitignore` entry and document purpose.

## Recommended Action

Implement Option A. Git history preserves all code; worktree adds no value.

## Technical Details

**Worktree path:** `.worktrees/pr-28-review/`
**Branch:** `pr-28-rebased`
**Last commit:** Jan 23, 2026
**Size:** 66MB

**Verify branch status:**

```bash
git branch -r --contains pr-28-rebased
# If shows origin/main, branch was merged
```

## Acceptance Criteria

- [ ] Verify pr-28 changes are merged to main
- [ ] Remove worktree with `git worktree remove`
- [ ] Delete branch if merged
- [ ] Verify 66MB disk space recovered

## Work Log

| Date       | Action                    | Learnings                                  |
| ---------- | ------------------------- | ------------------------------------------ |
| 2026-02-04 | Identified stale worktree | Worktree from Jan 23 review, 13 days stale |

## Resources

- Git worktree documentation
- `.worktrees/pr-28-review/REFACTOR_REPORT.md` (in worktree)
