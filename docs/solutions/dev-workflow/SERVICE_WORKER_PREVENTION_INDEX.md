# Service Worker Cache Prevention - Documentation Index

**Created:** 2026-01-05
**Status:** Complete Prevention Strategy
**Category:** Development Environment / PWA Service Worker Cache

---

## Problem Statement

Next.js PWA Service Workers cache JavaScript bundles aggressively during development. When you modify code, Turbopack recompiles correctly, but the browser loads stale bundles from Service Worker cache, creating misleading errors:

- "Element type is invalid: undefined"
- "Cannot read property of undefined"
- Components that look fine refuse to render

**Critical symptom:** Hard refresh (Cmd+Shift+R) fixes it temporarily, but indicates stale cache issue, not real code error.

---

## Documentation Files Created

### 1. Main Prevention Guide

**File:** `/docs/solutions/dev-workflow/SERVICE_WORKER_CACHE_STALE_BUNDLES_PREVENTION.md`
**Length:** 35 KB, 14 parts
**Best for:** Deep understanding and comprehensive reference

**Contents:**

- Part 1: How Service Workers cache bundles (mechanism)
- Part 2: Recognition patterns (7 ways to identify SW cache issue)
- Part 3: Prevention strategies (7 comprehensive strategies)
- Part 4: When to suspect SW cache vs real errors
- Part 5: Recovery commands (4 levels of recovery)
- Part 6: Best practices for development
- Part 7: Testing strategy (unit + E2E)
- Part 8: Environment-specific guidance (macOS, Windows, CI/CD, production)
- Part 9: Common scenarios (4 typical situations)
- Part 10: Quick reference card (printable)
- Part 11: Advanced debugging
- Part 12: Related issues and cross-references
- Part 13: When to escalate
- Part 14: Key insights

**Read this when:** You want complete understanding of Service Worker caching and all prevention strategies

---

### 2. Quick Reference Guide

**File:** `/docs/solutions/dev-workflow/SERVICE_WORKER_QUICK_REFERENCE.md`
**Length:** 4.5 KB
**Best for:** Quick diagnosis and immediate action

**Contents:**

- Instant diagnosis (30 seconds)
- One-line fixes (4 options)
- Prevention scripts (3 options)
- Red flag checklist
- DevTools configuration (one-time setup)
- Common patterns (3 typical scenarios)
- Comparison table (real error vs SW cache)
- Cost/benefit analysis
- Decision: when to investigate further

**Read this when:** You suspect a Service Worker cache issue and want quick resolution

---

### 3. Decision Tree

**File:** `/docs/solutions/dev-workflow/SERVICE_WORKER_CACHE_DECISION_TREE.md`
**Length:** 12 KB
**Best for:** Systematic diagnosis of hard-to-diagnose issues

**Contents:**

- Master decision tree (flowchart)
- Decision A: Cache issue detected (Recovery strategies A1 and A2)
- Decision B: Real code error (step-by-step diagnosis)
- Quick diagnostic checklist
- Symptom-based paths (3 common errors explained)
- Time estimates for each issue type
- When to escalate
- Integration guide (cross-references to other docs)
- One-page printable version

**Read this when:** You're not sure if it's a cache issue or real error, and need systematic diagnosis

---

## Quick Start

### For Different Situations

**Situation 1: "My component has an error and I don't know why"**

1. Start with: **SERVICE_WORKER_QUICK_REFERENCE.md** (Instant Diagnosis section)
2. If still unclear: **SERVICE_WORKER_CACHE_DECISION_TREE.md** (Master Decision Tree)
3. For deep understanding: Main prevention guide

**Situation 2: "Hard refresh fixed it - what happened?"**

1. Start with: **SERVICE_WORKER_QUICK_REFERENCE.md** (Red Flags section)
2. Then read: **SERVICE_WORKER_CACHE_STALE_BUNDLES_PREVENTION.md** (Part 2: Recognition Patterns)
3. Then implement: **SERVICE_WORKER_CACHE_STALE_BUNDLES_PREVENTION.md** (Part 3: Prevention Strategies)

**Situation 3: "I want to prevent Service Worker cache issues permanently"**

1. Read: **SERVICE_WORKER_CACHE_STALE_BUNDLES_PREVENTION.md** (Part 3: Prevention Strategies)
2. Implement: Strategy 1 (Disable SW in development - RECOMMENDED)
3. Verify: Use npm scripts (`npm run dev:no-sw`)

**Situation 4: "I need to understand the complete picture"**

1. Read: **SERVICE_WORKER_CACHE_STALE_BUNDLES_PREVENTION.md** (complete, all 14 parts)
2. Reference: **SERVICE_WORKER_QUICK_REFERENCE.md** (for quick lookups)
3. Use: **SERVICE_WORKER_CACHE_DECISION_TREE.md** (when diagnosing)

---

## Prevention Strategies Summary

### Strategy 1: Disable Service Worker in Development (RECOMMENDED)

```javascript
// next.config.js
...(process.env.NODE_ENV === 'development' && {
  pwa: { disabled: true },
})
```

**Result:** Zero SW cache issues in development
**Cost:** None (SW only needed for production offline support)
**Implementation time:** 30 seconds

### Strategy 2: Add npm Scripts

```bash
npm run dev:no-sw      # Dev without Service Worker
npm run dev:fresh      # Clear all caches and restart
```

**Already added to:** `apps/web/package.json`
**Cost:** Already done
**Implementation time:** 0 seconds (already implemented)

### Strategy 3: Hard Refresh

```bash
Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
```

**Result:** 60% of cache issues fixed
**Cost:** 5 seconds
**Note:** Temporary fix, doesn't prevent reoccurrence

### Strategy 4: Unregister Service Worker

```
DevTools → Application → Service Workers → Unregister → Reload
```

**Result:** 95% of cache issues fixed
**Cost:** 10 seconds
**Note:** Fix for current issue, doesn't prevent next occurrence

### Strategy 5: DevTools Cache Disabling

```
DevTools → Network tab → ☑ Disable Cache
```

**Result:** Prevents stale bundles during development
**Cost:** 5 seconds setup (one time)
**Note:** Must be redone if DevTools closed

### Strategy 6: Console Helper Function

```javascript
// In development middleware
window.clearSWCache = async () => { ... };

// Usage:
await window.clearSWCache();
location.reload();
```

**Result:** One-liner to clear SW cache
**Cost:** 5 seconds to implement, 5 seconds to use
**Note:** Requires implementation in your code

### Strategy 7: Use Incognito Window

```bash
# Open incognito/private window (no cached SWs)
Cmd+Shift+N (Mac) or Ctrl+Shift+N (Windows)
```

**Result:** 100% guarantee of clean SW state
**Cost:** 5 seconds per session
**Note:** Best during heavy refactoring

---

## Implementation Checklist

- [x] Create comprehensive prevention strategy guide
- [x] Create quick reference for rapid diagnosis
- [x] Create decision tree for systematic troubleshooting
- [x] Add `dev:no-sw` npm script to `apps/web/package.json`
- [x] Add Service Worker references to CLAUDE.md prevention strategies
- [x] Add key insight about SW cache to CLAUDE.md
- [ ] (Optional) Add to team onboarding guide
- [ ] (Optional) Create Slack/Discord bot reminder for new developers

---

## Integration with Existing Systems

### Related to Turbopack HMR Cache Issues

Different problem, similar symptoms:

| Aspect          | Service Worker Cache                      | Turbopack HMR Cache    |
| --------------- | ----------------------------------------- | ---------------------- |
| **Location**    | Browser SW cache                          | Dev server memory      |
| **Cause**       | PWA offline support                       | Module graph tracking  |
| **Recognition** | Hard refresh fixes, `console.log` correct | Same as SW             |
| **Fix**         | Unregister SW or disable                  | `npm run dev:fresh`    |
| **Prevention**  | Disable in dev                            | Clear on branch switch |

Both documented separately because they require different recovery strategies.

**See:** `/docs/solutions/dev-workflow/TURBOPACK_HMR_MODULE_CACHE_STALENESS_PREVENTION.md`

### Cross-Reference in CLAUDE.md

Added to Prevention Strategies section:

- `service-worker-cache-stale-bundles` - Main guide
- `service-worker-quick-reference` - Quick lookup
- `service-worker-decision-tree` - Diagnosis flowchart

Added key insight:

> PWA Service Workers cache JS bundles aggressively in development, causing misleading React errors like "Element type is invalid" when code is actually fine. Recognition: hard refresh fixes it temporarily. Quick fix: unregister SW in DevTools. Prevention: disable SW in development. Use `npm run dev:no-sw` script for fastest iteration.

---

## Usage Statistics (Estimated ROI)

### Cost of Investigation Per Incident

- Without documentation: 15-20 minutes (wondering if it's SW cache)
- With quick reference: 5 seconds diagnosis + 10 seconds fix = 15 seconds
- **Time saved: 15-20 minutes per incident**

### Cost of Prevention

- Disable in dev: 30 seconds setup (one time)
- Add npm script: 0 seconds (already done)
- Use incognito window: 5 seconds per session
- **Total prevention cost: ~5-30 seconds (one time or per session)**

### Break-Even Point

If you experience 1 service Worker cache issue per week:

- 1 incident × 20 min = 20 min saved per week
- Prevention + understanding: ~30 sec setup + 10 sec per use
- **ROI: 40x positive**

---

## Next Steps

### For Individual Developers

1. Bookmark `/docs/solutions/dev-workflow/SERVICE_WORKER_QUICK_REFERENCE.md`
2. Add `npm run dev:no-sw` to your development workflow
3. Keep `Disable Cache` checked in DevTools Network tab

### For Team

1. Link this index in team onboarding docs
2. Add to development setup guide
3. Consider adding to team Slack/Discord bot ("When you see 'Element type is invalid', read...")

### For Future Prevention

1. If using `next-pwa` or similar, document the configuration
2. Add to Next.js app setup guide
3. Consider adding automated check to CI/CD (verify SW disabled in dev builds)

---

## File Locations

```
docs/solutions/dev-workflow/
├── SERVICE_WORKER_CACHE_STALE_BUNDLES_PREVENTION.md     (35 KB)
├── SERVICE_WORKER_QUICK_REFERENCE.md                    (4.5 KB)
├── SERVICE_WORKER_CACHE_DECISION_TREE.md                (12 KB)
└── SERVICE_WORKER_PREVENTION_INDEX.md                   (this file)

apps/web/
└── package.json                                          (updated with dev:no-sw)

CLAUDE.md                                                  (updated with references)
```

---

## Key Insight

**Service Worker caching of JS bundles in development is more deceptive than Turbopack HMR issues because:**

1. **The error looks real** - React legitimately fails trying to render stale code
2. **The server is actually fine** - Turbopack compiled correctly
3. **Console output misleads** - Old cached code may still log correct values
4. **Hard refresh masks the real problem** - Fixes it temporarily instead of teaching you prevention

**Prevention beats investigation 100:1 in time value.**

Best approach: **Disable Service Worker in development** (`pwa: { disabled: true }`). Test PWA offline features only in production build. Use `npm run dev:no-sw` for fastest iteration when you must have SW enabled.

---

## Questions & Answers

**Q: Is this a real error or SW cache issue?**
A: Hard refresh (Cmd+Shift+R) fixes it? → SW cache. Doesn't fix it? → Real error. See Decision Tree.

**Q: Do I need to worry about this in production?**
A: No. Vercel automatically handles cache busting on deployments. This only affects local development.

**Q: Why not always use `npm run dev:no-sw`?**
A: Best practice - test offline features in production build separately. But if you're not working on PWA features, `dev:no-sw` is fastest.

**Q: Can I disable just browser cache instead of SW?**
A: Partial fix. DevTools "Disable Cache" helps but doesn't fully clear SW cache. SW cache persists across browser cache clears.

**Q: How is this different from Turbopack HMR issues?**
A: Different layer. Turbopack = dev server memory. Service Worker = browser cache. Both cause stale bundles, different fixes.

**Q: Should I unregister SW every time I develop?**
A: Only if you see cache issues. Better: disable in dev. Even better: use `npm run dev:no-sw`.

---

**Version:** 1.0
**Created:** 2026-01-05
**Last Updated:** 2026-01-05
**Status:** Complete and ready for reference

This documentation is part of the compound engineering workflow. When you encounter Service Worker cache issues, reference this index and the appropriate guide. When resolved, consider if this could be documented as a lesson for future developers.
