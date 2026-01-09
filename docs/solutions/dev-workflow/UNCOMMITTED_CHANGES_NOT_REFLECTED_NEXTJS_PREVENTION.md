# Uncommitted Changes Not Reflected in Running Next.js App - Prevention Strategies

**Date Created:** 2026-01-09
**Severity:** Medium (appears as feature not working but is easily preventable)
**Impact:** Development productivity, debugging confusion
**Category:** Development Workflow / Version Control

---

## Executive Summary

When changes to your Next.js codebase don't appear in the running app, the most common cause is that changes exist in the working directory but haven't been **committed to git**. The development server may be watching the working directory, but tools, processes, or deployments may reference the git index or commit history.

**Symptoms:**

- Code changes visible in editor, not in running app
- Feature implemented, but app shows old behavior
- Console logs added, not appearing in terminal output
- Component changes not visible in browser
- Environment variables appear to revert
- Other developers can't see your changes

**Quick Fix:**

```bash
# Verify what's actually committed
git status
git add .
git commit -m "Your changes"

# Then restart dev server if needed
Ctrl+C
npm run dev
```

**Prevention Cost:** 30 seconds per session (git status habit)
**Prevention Benefit:** Avoids 10-15 minute debugging confusion
**Root Cause:** Assuming working directory = git state (they're independent)

---

## Part 1: Understanding the Problem

### How Git and Your Working Directory Interact

Your codebase exists in **two separate worlds** that need to stay in sync:

```
Git Repository                 Your Hard Drive (Working Directory)
(committed history)            (actual files you're editing)
        │                              │
        └──────────────┬───────────────┘
                       │
           Are they the same? → NO
           (This is your problem!)
```

**Critical distinction:**

| Aspect               | Git Repository (Index)      | Working Directory                              |
| -------------------- | --------------------------- | ---------------------------------------------- |
| **Location**         | `.git/` folder (compressed) | `/Users/.../MAIS/apps/web/src/` (actual files) |
| **What it contains** | Commits, branches, history  | Files you're editing NOW                       |
| **Visibility**       | Only committed changes      | All changes (committed + uncommitted)          |
| **Dev server uses**  | Can use git refs OR files   | File system watcher                            |

**Key insight:** The dev server watches your filesystem. But deployment, CI/CD, and `git` commands see only what's in the `.git` folder.

### Three Scenarios Where This Breaks

#### Scenario 1: Dev Server Restarts Between Edits

```bash
# You make changes
vim src/app/page.tsx
# Changes saved to disk, dev server picks them up, browser shows them ✓

# But then you restart the server
Ctrl+C          # Kill dev server
npm run dev     # Restart dev server

# Dev server now reads from... where?
# → If it reads git HEAD: Old changes
# → If it reads filesystem: Your changes (if not staged/committed)
```

**What Next.js does:** Next.js dev server reads from filesystem, but imports may be resolved from git history in some cases.

#### Scenario 2: Running Tests or Builds

```bash
npm test        # Runs tests
npm run build   # Builds project
```

These commands may use git history (or configured paths) instead of your working directory, so your uncommitted changes aren't included.

#### Scenario 3: Environment Variables and Cache

```bash
# You edit .env.local
DATABASE_URL=postgres://new-url

# But dev server was started BEFORE the change
# It cached the old environment variables
# Your new URL isn't loaded

# Even if you save, the server might use cache instead of re-reading
```

#### Scenario 4: Monorepo Workspace Issues

```bash
# In monorepo, you edit:
apps/web/src/components/Button.tsx

# Workspace caches or builds might reference:
server/dist/Button.ts  (old compiled version, not updated)

# Because your source change isn't in the compiled output yet
```

---

## Part 2: Warning Signs (Early Detection)

### Pattern 1: "I Made Changes But They Don't Show Up"

**Checklist:**

- [ ] File is saved (disk shows checkmark, no dot in editor title)
- [ ] Dev server is running (terminal shows "compiled successfully")
- [ ] Browser is showing the app (not 404 or blank page)
- [ ] You refreshed browser (Cmd+R or F5)

If all ✓, but still broken → Check git status

### Pattern 2: "Changes Work in Editor But Not in Running App"

```
Editor (VSCode):          Browser:
const msg = "Hello"       (still shows "Goodbye")
```

**Immediate diagnosis:**

```bash
# Are changes committed?
git status
# Shows: M src/app/page.tsx

# Are changes staged?
git diff
# Shows your changes

# Then: Uncommitted changes exist, maybe server needs restart
```

### Pattern 3: "Works Locally, But Tests Fail"

```bash
npm run dev     # Your changes show in browser ✓

npm test        # Tests fail, say old code is running
# ← Tests run against git refs, not working directory
```

### Pattern 4: "Team Member Pulled, Can't See My Changes"

```bash
# You made changes but didn't commit
git status

# Team member pulls
git pull

# They don't see your work because you never committed it
# They have their own working directory with different files
```

---

## Part 3: Prevention Strategies

### Strategy 1: Git Status Habit (Zero Cost)

**The simplest prevention: check git status before debugging**

```bash
# Every time something seems "off", run:
git status

# Expected output:
# On branch main
# nothing to commit, working tree clean

# Unexpected output:
# On branch main
# Changes not staged for commit:
# M src/app/page.tsx
# ?? new-file.tsx
# ↓ You have uncommitted changes!

# What to do:
git add .                        # Stage all changes
git commit -m "Describe changes" # Commit them
```

**Why this works:** Git status is the source of truth. If `git status` shows `clean`, your code is committed. If it shows changes, nothing uses your changes yet.

**Implementation:**

```bash
# Make it a ritual:
# 1. Before deploying:     git status
# 2. Before running tests: git status
# 3. Before asking for help: git status
# 4. Before "It doesn't work": git status
```

### Strategy 2: Verification Checklist (1 minute)

**Use this checklist when features don't work:**

```markdown
## Is My Change Actually Committed?

- [ ] File saved in editor (no dot in title bar)
- [ ] Ran: git add .
- [ ] Ran: git commit -m "message"
- [ ] Ran: git log (shows my commit at top)
- [ ] Dev server running: npm run dev
- [ ] Browser shows updated code: Check <page>

If all ✓ and still broken → It's a different issue

If any ✗ → Commit first, then retry
```

**Usage pattern:**

```bash
# Before saying "it doesn't work", verify:

# 1. Is it committed?
git log -1 --oneline
# Should show YOUR most recent commit

# 2. Is dev server running?
ps aux | grep "next dev"
# Should show active process

# 3. Does browser show newest code?
# Open DevTools → Sources → Check file content

# 4. When was this file last changed?
git log -1 --format="%ai" src/app/page.tsx
# Should show recent date, not days old
```

### Strategy 3: Commit Verification Commands

**Quick diagnostic commands to verify state:**

```bash
# Command 1: What's in git vs working directory?
git diff
# Shows: Lines with + (your additions) and - (deletions)
# Empty output = Everything committed

# Command 2: What's staged but not committed?
git diff --staged
# Empty output = Nothing waiting to commit

# Command 3: Untracked files?
git status --short
# Example: ?? new-file.tsx (new file, needs git add)

# Command 4: What's the state of a specific file?
git diff src/app/page.tsx
# Shows uncommitted changes to this file

# Command 5: Last N commits
git log -5 --oneline
# Verify your commit is here
```

### Strategy 4: Pre-Deployment Checklist

**Before asking others to test or deploying:**

```bash
# Step 1: Check everything is committed
git status
# ✓ Must show: "working tree clean"

# Step 2: See what you're about to push
git log main..HEAD
# Shows commits you'll push (or use HEAD if on main)

# Step 3: Verify remote will get your changes
git push --dry-run
# Shows what WOULD be pushed, without pushing

# Step 4: Restart dev server
Ctrl+C
npm run dev

# Step 5: Verify in browser
# Navigate to your feature → Confirm it works

# Step 6: Actually push
git push
```

**Why each step matters:**

| Step | Prevents                                            |
| ---- | --------------------------------------------------- |
| 1    | Pushing work you thought you pushed (but didn't)    |
| 2    | Pushing wrong commits (old work instead of new)     |
| 3    | Silent push failures (thinks it pushed, but didn't) |
| 4    | Server crashes or stale cache                       |
| 5    | Deploying broken code (verifies it works locally)   |
| 6    | Remote doesn't have your changes                    |

### Strategy 5: IDE Integration

**Set up your editor to show git state constantly:**

#### VSCode

**Step 1: Install GitLens extension**

```
Extensions → Search "GitLens" → Install
```

**Step 2: Configure source control**

```
VSCode Settings (Cmd+,):
- Source Control: Always Show Repositories ✓
- Source Control: Count Badge: On
- GitLens: Show Status Bar Blame ✓
```

**Result:** VSCode shows:

- Number of changes at bottom (red icon with count)
- File change status (M = modified, ? = untracked)
- Last commit date for current file
- Blame information (who last edited each line)

**Step 3: Use the Source Control sidebar**

```
View → Source Control (Ctrl+Shift+G)
Shows:
- All changed files (red M indicators)
- Staged files (green + indicators)
- Option to commit directly from UI
```

#### Other IDEs

**WebStorm/IntelliJ:**

```
Preferences → Version Control → Git
- Highlight directories with unstaged changes ✓
- Line number color shows changes ✓
```

**Sublime Text:**

```
Package Control → Install "GitGutter"
Shows:
- Gutter icons for changed lines
- Status bar shows file change count
```

### Strategy 6: Shell Prompt Enhancement

**Show git state in your terminal prompt**

#### Using oh-my-zsh (macOS with zsh)

```bash
# If using oh-my-zsh (check ~/.zshrc)
# Already includes git status in prompt by default

# Your prompt shows:
~/CODING/MAIS (main ✓) $  # ✓ = clean working tree
~/CODING/MAIS (main ✗) $  # ✗ = uncommitted changes
```

#### Using bash-git-prompt

```bash
# Install
cd ~
git clone https://github.com/magicmonty/bash-git-prompt.git .bash-git-prompt

# Add to ~/.bashrc
if [ -f ~/.bash-git-prompt/gitprompt.sh ]; then
  source ~/.bash-git-prompt/gitprompt.sh
fi

# Result in terminal:
$ cd apps/web
(main *>)  $
# *> = uncommitted changes, untracked files
```

**Why this works:** You see git state every time you open a terminal. Impossible to forget what branch or state you're in.

### Strategy 7: Pre-Commit Hook

**Automatically verify state before committing**

```bash
# Create .git/hooks/pre-commit
# (This prevents commits with certain mistakes)

cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash

echo "Checking for uncommitted changes..."

# Verify all files are staged
UNSTAGED=$(git diff --name-only)
if [ ! -z "$UNSTAGED" ]; then
  echo "ERROR: Unstaged changes found:"
  echo "$UNSTAGED"
  echo "Run: git add . && git commit"
  exit 1
fi

# Verify TypeScript compiles
npm run typecheck || exit 1

# Verify no console.log left
if git diff --cached | grep -E "console\.(log|warn|error)"; then
  echo "ERROR: console.log found in staged changes"
  echo "Remove debug logs before committing"
  exit 1
fi

echo "✓ Pre-commit checks passed"
exit 0
EOF

chmod +x .git/hooks/pre-commit
```

### Strategy 8: Visual Diff Before Committing

**Always review what you're committing**

```bash
# See exactly what you're about to commit
git diff --cached
# Shows green (+) and red (-) lines

# See all uncommitted changes
git diff
# Shows everything you changed (staged + unstaged)

# Interactive staging (commit piece by piece)
git add -p
# Prompts for each change: commit this hunk? (y/n)

# Why it matters:
# ← Prevents committing debug code
# ← Prevents committing incomplete work
# ← Prevents committing wrong files
```

### Strategy 9: Monorepo-Specific (npm workspace)

**When using npm workspaces, extra caution needed:**

```bash
# Changes in one workspace might not rebuild others

# After making changes, rebuild affected workspaces:
npm run build -w @macon/contracts    # If you changed contracts
npm run typecheck                     # Check entire monorepo

# Restart dev server to pick up new build
Ctrl+C
npm run dev:api
npm run dev:web

# Verify in both API and web layers
```

**Why:** Workspaces have separate build caches. Uncommitted changes in one workspace might not propagate to others until you rebuild.

---

## Part 4: Decision Tree

```
┌──────────────────────────────┐
│ "My changes aren't showing"  │
└───────────┬──────────────────┘
            │
    ┌───────┴────────┐
    │                │
    ▼                ▼
  Run:          Changes
  git status    in editor
    │              │
    ├─ Clean ✓     └─ Yes: Unstaged
    │              │
    │          ┌───┴───┐
    │          │       │
    │          ▼       ▼
    │         Staged  Not Staged
    │          │          │
    │      Commit     git add .
    │      first?      │
    │          │       └─ Commit
    │          ▼
    │    (changes not
    │     in working
    │     directory
    │     at all!)
    │
    └──ᐯ Restart dev server
        git pull (others' commits)
        npm install (if package changed)
        Check browser
```

---

## Part 5: Related Gotchas (Similar Issues)

### Gotcha 1: Stale .git Cache

**Problem:** You committed changes, but dev server uses cached version.

**Solution:**

```bash
# Restart dev server
Ctrl+C
npm run dev
```

**Why:** Node.js caches require() statements. Restarting clears them.

### Gotcha 2: Environment Variables Changed But Not Reloaded

**Problem:** You edit `.env.local`, but old values still used.

```bash
DATABASE_URL=postgres://old-url    # Old, running in memory
# Edit to:
DATABASE_URL=postgres://new-url    # New, on disk

# But dev server still uses old value
```

**Solution:**

```bash
# Restart dev server
Ctrl+C
npm run dev
```

**Prevention:** After editing `.env`, always restart dev server.

### Gotcha 3: Compiled Output Doesn't Match Source

**Problem:** You changed `server/src/`, but `server/dist/` is old.

**Solution:**

```bash
# Rebuild
npm run build

# Or for watch mode in monorepo
npm run dev    # Should auto-rebuild
```

### Gotcha 4: Multiple Git Worktrees

**Problem:** Same repo, two working directories with different commits.

```bash
# Main checkout
~/CODING/MAIS (main)

# Worktree checkout (separate)
~/CODING/MAIS-feature (feature branch)

# You edited in main, forgot to commit
# Checked out worktree to test feature
# Worktree doesn't see your changes
```

**Solution:**

```bash
# In main:
git status  # Shows changes
git add .
git commit -m "Your work"

# Then in worktree:
git pull    # Gets your commit
```

### Gotcha 5: Submodules and Monorepo Dependencies

**Problem:** You changed contract types, but API server didn't rebuild.

```typescript
// packages/contracts/src/booking.ts
export interface Booking {
  date: string; // You changed this to Date
}

// server/src/service.ts still expects string
// Because server didn't rebuild against new types
```

**Solution:**

```bash
npm run typecheck   # Catches type mismatches
npm run build       # Rebuilds all packages
npm run dev:api     # Restart with new types
```

### Gotcha 6: NextJS Automatic Compilation vs Git State

**Problem:** Next.js auto-recompiles `.tsx` files, but uses git state for other types.

**Example:**

```bash
# You change a JSON file used at build time
prisma/seed.json  # Edited, but not committed

# Next.js dev server reads filesystem ✓ (picks up changes)
# But npm run build uses git history ✗ (old version)
```

**Solution:**

```bash
# Always commit before building
git add .
git commit -m "Update seed data"
npm run build
```

### Gotcha 7: Cache Layer Between Git and Filesystem

**Problem:** Webpack/Turbo/Next cache is stale.

```bash
npm run dev      # Uses cache
# Your committed changes don't appear
```

**Solution:**

```bash
rm -rf .next .turbo
npm run dev
```

See: `docs/solutions/dev-workflow/TURBOPACK_HMR_MODULE_CACHE_STALENESS_PREVENTION.md`

---

## Part 6: Quick Reference Card

Print and pin this!

```
UNCOMMITTED CHANGES NOT REFLECTED - QUICK REFERENCE

SYMPTOMS:
✗ Code in editor not in running app
✗ Feature implemented but app shows old behavior
✗ Console logs added but not appearing
✗ Component changes not visible in browser

DIAGNOSIS (do these first):
$ git status              # Shows uncommitted changes?
$ git log -1 --oneline   # Is your commit at top?
$ ps aux | grep "next"   # Dev server running?

QUICK FIXES (in order):
1. git add . && git commit -m "message"    # Commit changes
2. Ctrl+C && npm run dev                   # Restart server
3. Cmd+Shift+R                             # Hard refresh browser
4. rm -rf .next .turbo && npm run dev      # Nuclear (if above fail)

PREVENTION (30 seconds/session):
✓ Before deploying: git status
✓ Before testing: git status
✓ Before asking help: git status
✓ Set terminal prompt to show git state
✓ Install GitLens in VSCode
✓ Always commit before npm run build

MONOREPO SPECIFIC:
npm run typecheck           # Catch type mismatches
npm run build               # Rebuild all packages
npm run dev:all             # Restart all servers

WHEN YOU CHANGED:            RESTART WITH:
────────────────────────────────────────────────
src/*.tsx                    npm run dev (auto-picks up)
.env.local                   Ctrl+C && npm run dev
packages/contracts/          npm run dev:all
prisma/schema.prisma         npm exec prisma generate
server/src/                  npm run dev:api

COMMANDS TO VERIFY STATE:
git diff                      # Uncommitted changes
git diff --staged             # What will be committed
git status --short            # Quick overview
git log -5 --oneline          # Recent commits
git diff src/app/page.tsx     # Changes to one file
```

---

## Part 7: Development Workflow Best Practices

### The Commit-First Mindset

**Wrong workflow:**

```bash
# Edit code
vim src/app/page.tsx

# Test in dev server
# "It works!"

# ... later, forget to commit ...

# Tell team: "I fixed the bug"
# They pull, don't see the fix (you never committed!)
```

**Right workflow:**

```bash
# Edit code
vim src/app/page.tsx

# Commit immediately (before testing)
git add .
git commit -m "Fix bug in page.tsx"

# Test in dev server
# (Server reads committed code from git)

# Tell team: "I fixed the bug" (commits are pushed)
# They pull, see the fix ✓
```

**Why:** Committing first ensures:

1. Your work is safe (in git history)
2. Other developers can see it
3. Tests/CI see your changes
4. Deploys include your changes

### The Git Status Loop

**Recommended ritual:**

```bash
# Before starting work
git status           # Verify clean state

# After finishing feature
git diff             # Review changes
git add .            # Stage everything
git commit -m "msg"  # Commit with message
git log -1           # Verify commit was created
git push             # Push to remote

# Before moving to next task
git status           # Back to clean state
```

**Time investment:** 20 seconds per feature
**Safety improvement:** Prevents lost work, ensures team visibility

### Meaningful Commit Messages

**Bad messages (don't do this):**

```
git commit -m "fix"
git commit -m "changes"
git commit -m "update"
git commit -m "wip"
```

**Good messages:**

```
git commit -m "Fix double-booking race condition with advisory locks"
git commit -m "Add missing @macon/contracts import in booking service"
git commit -m "Update landing page config schema to support section IDs"
git commit -m "Prevent TOCTOU in JSON field updates with transactions"
```

**Why messages matter:**

- `git log` becomes readable (you can see WHAT changed and WHY)
- `git blame` is useful (understand context of changes)
- `git bisect` works (find commit that broke tests)
- Code review is easier (commit message explains the why)

---

## Part 8: Troubleshooting Specific Scenarios

### Scenario 1: "I Committed But Others Don't See It"

**Diagnosis:**

```bash
# You committed locally
git log -1
# Shows your commit

# But others pulled and don't see it
# Why? You forgot to PUSH!

# Check what's on remote
git log origin/main     # Remote commits
git log main            # Local commits

# If different, you need to push
git push
```

**Fix:**

```bash
git push
# Now remote has your commit
# Now team members can see it (after they pull)
```

### Scenario 2: "Changes Work in Dev Server, Not in Tests"

**Diagnosis:**

```bash
# Dev server picks up changes from filesystem ✓
npm run dev

# But tests run against git history ✗
npm test

# Why?
# Test runner might be configured to use git refs
# Or it's using built code that wasn't rebuilt
```

**Fix:**

```bash
# Option 1: Commit first
git add .
git commit -m "Your changes"

# Option 2: Rebuild
npm run build

# Then run tests
npm test
```

### Scenario 3: "Works Locally, Broken in CI"

**Diagnosis:**

```bash
# You have uncommitted changes locally
git status
# M src/app/page.tsx

# Your local dev works because Next.js reads filesystem
npm run dev        # Shows your changes

# But CI/CD pulls and builds
# CI doesn't have your uncommitted changes!
# CI fails because code is old
```

**Fix:**

```bash
# Commit changes
git add .
git commit -m "Fix for CI"

# Verify push
git push

# CI will now pull committed code and pass
```

### Scenario 4: "Same Code, Different Behavior in Build vs Dev"

**Diagnosis:**

```bash
npm run dev          # Works ✓
npm run build && npm run start    # Broken ✗

# Why?
# Build uses git history (committed code)
# Dev uses filesystem (all code, committed + uncommitted)

# If you changed something after last commit:
git status
# Shows uncommitted changes

# Build doesn't see them
```

**Fix:**

```bash
# Commit changes first
git add .
git commit -m "Changes for build"

# Now build will use committed code
npm run build
npm run start    # Should work now
```

---

## Part 9: Monorepo-Specific Prevention

### npm Workspace Complications

**Problem:** You changed `packages/contracts`, but `server` doesn't rebuild.

```bash
# You edited
packages/contracts/src/booking.schema.ts

# And committed
git add . && git commit -m "Update booking schema"

# But server still uses old types
# Because server/src/ references contracts via import paths
# But dist/ wasn't rebuilt
```

**Solution:**

```bash
# After changing any package, rebuild all
npm run build

# Or run dev in watch mode
npm run dev:api   # Auto-rebuilds on changes

# Verify typecheck works
npm run typecheck
```

### Checking What's Built

```bash
# See what's actually in dist/ (compiled output)
ls -la server/dist/

# Compare to source
ls -la server/src/

# If dist is old, files won't match
# Solution: npm run build
```

---

## Part 10: Environment-Specific Guidance

### Local Development (macOS)

```bash
# Setup
git status               # Verify clean state
npm run dev             # Start dev server
# Edit code in VSCode

# Workflow
git add . && git commit -m "message"
Ctrl+C && npm run dev   # Restart if needed
Cmd+R                   # Browser refresh

# Terminal commands
git log -5 --oneline    # See commits
git diff                # See changes
```

### Local Development (Windows)

```bash
# Setup
git status              # Verify clean state
npm run dev            # Start dev server
# Edit code in VSCode

# Workflow
git add . && git commit -m "message"
Ctrl+C && npm run dev   # Restart if needed
F5                      # Browser refresh

# Terminal commands
git log -5 --oneline    # See commits
git diff                # See changes
```

### Vercel Deployment

**Good news:** Vercel only deploys committed code.

```bash
# What Vercel sees:
# 1. You push commit: git push
# 2. GitHub webhook notifies Vercel
# 3. Vercel clones your repo (only committed code)
# 4. Vercel builds and deploys

# If you forgot to commit:
# 1. You push empty (no new commits)
# 2. Vercel sees no changes
# 3. Vercel deploys old version
# 4. Feature doesn't appear in production
```

**Prevention:** Always verify before pushing:

```bash
git log HEAD..origin/main  # What will be pushed?
git push --dry-run        # Preview without pushing
git push                  # Now actually push
```

### GitHub Actions CI/CD

**CI runs tests on committed code:**

```yaml
# .github/workflows/test.yml
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3 # Clones repo
      - run: npm test # Runs tests


      # Tests see only committed code!
      # If you forgot to commit:
      # Tests run against old code
      # Tests fail or don't test your feature
```

**Prevention:** Commit before pushing:

```bash
git status              # Verify clean
git push               # Now CI will test your changes
```

---

## Part 11: Quick Diagnosis Script

Save this as `check-git-state.sh`:

```bash
#!/bin/bash

echo "╔════════════════════════════════════════════════════════════╗"
echo "║        Git + Working Directory State Checker               ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check 1: Uncommitted changes
echo "1. UNCOMMITTED CHANGES:"
if [ -z "$(git status --porcelain)" ]; then
    echo "   ✓ Working tree clean (nothing to commit)"
else
    echo "   ✗ Uncommitted changes found:"
    git status --short
    echo ""
    echo "   FIX: git add . && git commit -m 'Your message'"
fi
echo ""

# Check 2: Unpushed commits
echo "2. UNPUSHED COMMITS:"
UNPUSHED=$(git log origin/main..HEAD --oneline 2>/dev/null | wc -l)
if [ "$UNPUSHED" -eq 0 ]; then
    echo "   ✓ All commits pushed to remote"
else
    echo "   ✗ $UNPUSHED unpushed commits:"
    git log origin/main..HEAD --oneline 2>/dev/null
    echo ""
    echo "   FIX: git push"
fi
echo ""

# Check 3: Recent commits
echo "3. RECENT COMMITS:"
git log -3 --oneline
echo ""

# Check 4: Dev server status
echo "4. DEV SERVER STATUS:"
if pgrep -f "next dev" > /dev/null; then
    echo "   ✓ Next.js dev server running"
else
    echo "   ✗ Next.js dev server NOT running"
    echo "   FIX: npm run dev"
fi
echo ""

# Check 5: Environment
echo "5. ENVIRONMENT CHECK:"
if [ -f ".env.local" ]; then
    echo "   ✓ .env.local exists"
    echo "   Contents: $(wc -l < .env.local) lines"
else
    echo "   ⚠ .env.local not found (might be needed)"
fi
echo ""

echo "╔════════════════════════════════════════════════════════════╗"
echo "║ If everything shows ✓, your code is properly committed.   ║"
echo "║ If you see ✗, follow the FIX steps above.                 ║"
echo "╚════════════════════════════════════════════════════════════╝"
```

**Usage:**

```bash
# Save to project root
chmod +x check-git-state.sh

# Run anytime
./check-git-state.sh

# Example output:
# ✓ Working tree clean
# ✗ 2 unpushed commits
# FIX: git push
```

---

## Part 12: Comprehensive Verification Checklist

**Use this BEFORE debugging, BEFORE deploying, BEFORE asking for help:**

```markdown
## Full State Verification Checklist

### Git State

- [ ] `git status` shows "working tree clean"
- [ ] `git log -1 --oneline` shows YOUR commit at top
- [ ] `git diff` is empty (nothing uncommitted)
- [ ] `git log origin/main..HEAD` is empty (nothing unpushed)

### Development Server

- [ ] `npm run dev` is running (terminal shows "compiled successfully")
- [ ] Dev server started AFTER your changes (not running from before edit)
- [ ] No errors in terminal output

### Browser

- [ ] Browser is pointing to localhost:3000 (not old production URL)
- [ ] DevTools disabled cache (Network tab: "Disable cache" is checked)
- [ ] Hard refresh done (Cmd+Shift+R or Ctrl+Shift+R)
- [ ] No console errors (DevTools → Console)

### Code Changes

- [ ] File saved in editor (no dot/asterisk in tab title)
- [ ] Code matches what you intended to change
- [ ] Imports are correct (no "module not found" errors)
- [ ] TypeScript compiles: `npm run typecheck`

### Environment

- [ ] `.env.local` has correct values
- [ ] `.env.local` matches what dev server is using
- [ ] No NODE_ENV set to "production"

### If ALL checked but still broken:

- [ ] Check: `git diff origin/main` (compare to main)
- [ ] Check: `npm run build` (verify build is clean)
- [ ] Check: `npm run test` (verify tests pass)
- [ ] Check: Browser DevTools Sources tab (inspect actual file)
```

---

## Related Documentation

- **Turbopack HMR Cache Issues:** `/docs/solutions/dev-workflow/TURBOPACK_HMR_MODULE_CACHE_STALENESS_PREVENTION.md`
- **Git Workflows:** `https://git-scm.com/book/en/v2/Git-Basics-Recording-Changes-to-the-Repository`
- **NextAuth Sessions:** `/apps/web/README.md`
- **Monorepo Structure:** `/CLAUDE.md` (Monorepo Structure section)

---

## Summary Table

| Problem                     | Check                  | Fix                            |
| --------------------------- | ---------------------- | ------------------------------ |
| Changes not in running app  | `git status`           | `git add . && git commit`      |
| Team can't see my changes   | `git push --dry-run`   | `git push`                     |
| Tests fail but dev works    | `git status`           | `git add . && git commit`      |
| Environment variables old   | Dev server terminal    | `Ctrl+C && npm run dev`        |
| Deployed version is old     | `git log origin/main`  | `git push` first, then merge   |
| After branch switch, broken | `npm run typecheck`    | `npm install && npm run build` |
| Build fails but dev works   | `git diff origin/main` | `git add . && git commit`      |
| Monorepo type errors        | `npm run typecheck`    | `npm run build`                |

---

## Key Insight

**The working directory and git repository are completely separate.**

- Working directory = files on your hard drive RIGHT NOW
- Git repository = committed history in `.git/` folder

**They only sync when you:**

1. `git add` (stage changes)
2. `git commit` (save to history)
3. `git push` (send to remote)

**Until you commit, your changes exist ONLY in your editor**, not in git history. Tools, tests, and other developers can't see uncommitted changes.

**Prevention:** Check `git status` before debugging anything.

---

**Version:** 1.0
**Last Updated:** 2026-01-09
**Status:** Active (reference this document when features don't appear in running app)
