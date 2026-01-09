# Uncommitted Changes Not Reflected - Quick Reference

**Print and pin this on your monitor!**

---

## The Problem in One Sentence

Your code exists in your editor but hasn't been **committed to git**, so the running app and other tools don't see it.

---

## Five Second Diagnosis

```bash
git status

# If shows "working tree clean" → code IS committed ✓
# If shows changes list → code NOT committed ✗
```

---

## Three Minute Fix

```bash
# 1. See what changed
git diff

# 2. Commit it
git add .
git commit -m "Describe your changes"

# 3. Restart dev server
Ctrl+C
npm run dev

# 4. Hard refresh browser
Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
```

---

## Before You Debug, Do This

```bash
git status              # Is code committed?
git log -1 --oneline    # Is YOUR commit here?
git diff                # Any uncommitted changes?
ps aux | grep "next"    # Dev server running?
```

If all OK, it's a different issue. Otherwise, **commit first**.

---

## The Core Rule

```
You make changes in editor
        ↓
You MUST commit (git add + git commit)
        ↓
THEN dev server, tests, and others see it
```

---

## Quick Commands

| Command               | What it does                    |
| --------------------- | ------------------------------- |
| `git status`          | Show all uncommitted changes    |
| `git diff`            | Show exact lines you changed    |
| `git add .`           | Stage all changes               |
| `git commit -m "msg"` | Save to git history             |
| `git log -5`          | See last 5 commits              |
| `git push`            | Send commits to remote (GitHub) |

---

## Symptom → Fix Mapping

| You See                                     | Run This                              |
| ------------------------------------------- | ------------------------------------- |
| "Feature not working"                       | `git status` then `git add && commit` |
| "Console log not appearing"                 | `git status` then `git add && commit` |
| "Component changes invisible"               | `git status` then `git add && commit` |
| "Team member doesn't see my changes"        | `git push`                            |
| "Tests pass locally, fail in CI"            | `git status` then `git add && commit` |
| "Works in dev, broken after npm run build"  | `git status` then `git add && commit` |
| "Changed .env.local, old values still used" | `Ctrl+C && npm run dev`               |

---

## Terminal Prompt Pro Tip

Add git status to your terminal prompt so you NEVER forget:

**macOS (oh-my-zsh):**

```bash
# Edit ~/.zshrc
ZSH_THEME="robbyrussell"  # Already shows git status
```

Your prompt shows:

```
~/MAIS (main ✓) $     # ✓ = clean
~/MAIS (main ✗) $     # ✗ = uncommitted changes
```

---

## VSCode Git Integration

1. Install **GitLens** extension
2. Open **Source Control** (Ctrl+Shift+G)
3. See all changes with red "M" indicators
4. Right-click file → Commit (stays in UI, no terminal needed)

---

## The Ritual

**Do this EVERY time you finish a feature:**

```bash
git status           # Check status
git add .            # Stage all
git commit -m "msg"  # Commit
git push             # Send to remote
```

Takes 20 seconds. Prevents hours of debugging.

---

## When You're Stuck

**Before asking for help, run:**

```bash
git status
git log -1
npm run typecheck
git diff origin/main
```

Send output to whoever's helping. They'll immediately see what's committed vs uncommitted.

---

## One More Thing

**Commit with meaningful messages:**

```bash
# BAD
git commit -m "fix"

# GOOD
git commit -m "Fix double-booking race condition in booking service"
```

Why? You'll thank yourself when reading `git log` later.

---

## Monorepo Note

```bash
# After changing packages/contracts or server/src:
npm run typecheck    # Catch issues
npm run build        # Rebuild
npm run dev:all      # Restart everything
```

---

## Last Resort

If absolutely nothing works:

```bash
git status                          # Check state
git add . && git commit -m "work"   # Commit everything
Ctrl+C                              # Kill dev server
rm -rf .next .turbo node_modules/.cache
npm run dev                         # Clean restart
Cmd+Shift+R                         # Browser hard refresh
```

---

**Remember:**

- ✓ Git status = source of truth
- ✓ Commit before testing/deploying
- ✓ Restart dev server if nothing changes
- ✓ Hard refresh browser
- ✓ Check `git log` to verify commit exists
