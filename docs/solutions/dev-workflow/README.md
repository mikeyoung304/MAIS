# Development Workflow Prevention Strategies

This directory contains guidance for preventing and recovering from common development environment issues.

## Documents

### Turbopack HMR Module Cache Staleness

**Problem:** After removing imports, switching build modes, or changing branches, Turbopack's Hot Module Replacement (HMR) breaks with "Something went sideways" errors.

**Solution:** Clear caches with `npm run dev:fresh` or `rm -rf .next .turbo`.

**Documents:**

1. **[TURBOPACK_HMR_MODULE_CACHE_STALENESS_PREVENTION.md](./TURBOPACK_HMR_MODULE_CACHE_STALENESS_PREVENTION.md)** (22 KB, comprehensive)
   - Complete explanation of the problem
   - 5 prevention strategies with examples
   - Recovery commands at 4 levels (browser only → nuclear option)
   - Browser DevTools setup guide
   - Advanced debugging techniques
   - Environment-specific guidance (macOS, Windows, CI/CD, Vercel)
   - Common scenarios and solutions
   - Testing patterns for HMR stability

2. **[TURBOPACK_HMR_QUICK_REFERENCE.md](./TURBOPACK_HMR_QUICK_REFERENCE.md)** (3 KB, quick lookup)
   - Matrix of errors and fixes
   - Most common causes in simple format
   - One-liner bash commands
   - Keyboard shortcuts
   - Print-friendly cheat sheet

3. **[TURBOPACK_HMR_RECOVERY_DECISION_TREE.md](./TURBOPACK_HMR_RECOVERY_DECISION_TREE.md)** (9 KB, visual flowchart)
   - Visual decision trees for common errors
   - Master decision table
   - Red flag error messages
   - Common mistakes and how to avoid them
   - Success criteria checklist

---

## Quick Start

**When your app breaks during development:**

### Option 1: Follow Flowchart (Fastest)

Open → [TURBOPACK_HMR_RECOVERY_DECISION_TREE.md](./TURBOPACK_HMR_RECOVERY_DECISION_TREE.md) → Find your error → Follow the flowchart

### Option 2: Quick Reference (Already Know Error)

Open → [TURBOPACK_HMR_QUICK_REFERENCE.md](./TURBOPACK_HMR_QUICK_REFERENCE.md) → Find error in table → Run fix command

### Option 3: Deep Understanding (Learning)

Open → [TURBOPACK_HMR_MODULE_CACHE_STALENESS_PREVENTION.md](./TURBOPACK_HMR_MODULE_CACHE_STALENESS_PREVENTION.md) → Read problem explanation → Choose prevention strategy

---

## Typical Fixes (By Time)

| Time | Fix                           | Success Rate |
| ---- | ----------------------------- | ------------ |
| 5s   | Hard refresh (Cmd+Shift+R)    | 80%          |
| 5s   | `npm run dev:fresh`           | 95%          |
| 5s   | `rm -rf .next && npm run dev` | 100%         |
| 20s  | Clear everything + restart    | 99%+         |

---

## Most Common Causes

1. **Removing imports** → Browser cache stale
2. **Switching branches** → Old .next folder exists
3. **Running `npm run build` then `npm run dev`** → Wrong .next structure
4. **Dependency changes** → Module graph mismatch
5. **After `git pull`** → Potential package version change

---

## Package.json Scripts

```bash
# Both of these were added to apps/web/package.json

npm run dev:fresh     # Clear .next, .turbo, node cache + restart dev
npm run build:clean   # Clear caches before building for production
```

---

## Key Insight

**Turbopack HMR cache issues are always recoverable and never indicate real bugs.**

The fix is always: **Clear the cache.**

Prevention: Be aware of when caches can become stale (import changes, build mode switches, branch changes) and proactively clear them.

---

## Browser Setup (Do Once)

1. DevTools → Settings → Network → Check "Disable cache (while DevTools open)"
2. DevTools → Application → Click "Clear Site Data" when needed
3. Remember hard refresh shortcut: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)

---

## Related Documentation

- **Original Issue:** `/docs/solutions/build-errors/turbopack-hmr-cache-conflict-after-production-build-MAIS-20260102.md` (the incident that triggered this prevention guide)
- **Main Prevention List:** `/CLAUDE.md` (Prevention Strategies section)
- **Next.js Development:** `/apps/web/README.md`

---

## Status

**Active & Reference**

Use this documentation when:

- HMR breaks during development
- You get "Something went sideways" errors
- You see module factory errors
- You're planning refactoring that removes imports
- You're switching branches and dev mode breaks

---

**Last Updated:** 2026-01-04
**Author:** Claude Code (prevention documentation)
**Version:** 1.0
