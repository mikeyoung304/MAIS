---
title: "Next.js Redirect Changes Not Reflected Despite Code Edits"
category: "dev-workflow"
tags:
  - nextjs
  - redirect
  - git
  - caching
  - build
  - turbopack
  - uncommitted-changes
severity: "P2"
component: "apps/web (Next.js frontend, signup flow, ProtectedRoute)"
date_discovered: "2026-01-09"
commit_fix: "b87da8bb"
---

# Next.js Redirect Changes Not Reflected Despite Code Edits

## Problem Statement

After modifying auth redirects from `/tenant/dashboard` to `/tenant/build` in three files, the changes appeared in the working directory but the application continued redirecting to the old path.

**Symptoms:**
- Files modified and saved correctly
- Code changes visible in `git diff`
- No build errors or warnings
- Dev server running without issues
- But redirect still goes to old path (`/tenant/dashboard`)

## Root Cause

**The changes were in the working directory but NEVER COMMITTED.**

Next.js compiled code from the **HEAD version** (last commit), not the working directory changes.

```bash
# Working directory (what we edited):
git diff apps/web/src/app/signup/page.tsx
# Shows: /tenant/dashboard → /tenant/build

# Committed version (what Next.js used):
git show HEAD:apps/web/src/app/signup/page.tsx | grep "tenant/dashboard"
# Output: router.push('/tenant/dashboard')  ← Still old value!
```

**Why this happens:**
1. Next.js dev server caches compiled modules in memory (Turbopack/SWC)
2. HMR watches for file saves but may not fully invalidate on complex changes
3. When the committed HEAD differs from working directory, the compiler can use stale references
4. Auth redirects span multiple files, making partial cache invalidation more likely

## Solution

### 1. Commit the Changes

```bash
git add apps/web/src/app/signup/page.tsx \
        apps/web/src/app/login/page.tsx \
        apps/web/src/components/auth/ProtectedRoute.tsx

git commit -m "fix(web): redirect to Build Mode after signup"
```

### 2. Clear Next.js Cache

```bash
rm -rf apps/web/.next apps/web/.turbo
```

### 3. Restart Dev Server

```bash
cd apps/web && npm run dev
```

**One-liner (add to package.json):**
```json
"dev:fresh": "rm -rf .next .turbo && npm run dev"
```

## Files Changed

| File | Line | Before | After |
|------|------|--------|-------|
| `apps/web/src/app/signup/page.tsx` | 111 | `router.push('/tenant/dashboard')` | `router.push('/tenant/build')` |
| `apps/web/src/app/signup/page.tsx` | 196 | `router.push('/tenant/dashboard')` | `window.location.href = '/tenant/build'` |
| `apps/web/src/app/login/page.tsx` | 43 | `'/tenant/dashboard'` | `'/tenant/build'` |
| `apps/web/src/components/auth/ProtectedRoute.tsx` | 46 | `router.push('/tenant/dashboard')` | `router.push('/tenant/build')` |

## Diagnosis Commands

### Quick Check: Are Changes Committed?

```bash
# See uncommitted changes
git status --short apps/web/src/

# Compare working directory vs committed
git diff apps/web/src/app/signup/page.tsx

# See what's actually in HEAD
git show HEAD:apps/web/src/app/signup/page.tsx | grep "tenant/"
```

### Verification Checklist

1. [ ] `git status` shows no uncommitted changes to relevant files
2. [ ] `git show HEAD:path/to/file` matches expected code
3. [ ] `.next/` directory cleared after commit
4. [ ] Dev server restarted after cache clear
5. [ ] Browser hard refresh (Cmd+Shift+R / Ctrl+Shift+R)

## Prevention Strategies

### 1. Commit Before Testing Auth Flows

Auth flows span multiple files. Always commit before testing:

```bash
# Before testing
git add -A && git commit -m "WIP: testing auth redirect"

# After verifying
git commit --amend -m "fix(web): proper commit message"
```

### 2. Use dev:fresh Script

Add to `apps/web/package.json`:

```json
{
  "scripts": {
    "dev:fresh": "rm -rf .next .turbo && npm run dev"
  }
}
```

### 3. Git Status Ritual

Before debugging "code not working":

```bash
git status && git diff --stat
```

If output shows uncommitted changes → commit first, then debug.

### 4. Shell Prompt Enhancement

Add git branch/status to terminal prompt to always see state:

```bash
# .zshrc or .bashrc
parse_git_dirty() {
  [[ $(git status --porcelain 2> /dev/null) ]] && echo "*"
}
export PS1='%~ $(git branch 2>/dev/null | grep "*" | cut -d" " -f2)$(parse_git_dirty) $ '
```

## Related Documentation

- [Turbopack HMR Cache Staleness Prevention](./TURBOPACK_HMR_MODULE_CACHE_STALENESS_PREVENTION.md)
- [Turbopack HMR Quick Reference](./TURBOPACK_HMR_QUICK_REFERENCE.md)
- [Service Worker Cache Prevention](./SERVICE_WORKER_CACHE_STALE_BUNDLES_PREVENTION.md)

## Key Insight

> **When code changes don't take effect in Next.js:**
> 1. Check `git status` - are changes committed?
> 2. Clear `.next` and `.turbo` directories
> 3. Restart dev server
> 4. Verify with `git show HEAD:path/to/file`

The pattern is always: **Commit → Clear Cache → Restart**

## Commit Reference

- **Commit:** b87da8bb
- **Message:** `fix(web): redirect to Build Mode after signup`
- **Branch:** main
- **Date:** 2026-01-09
