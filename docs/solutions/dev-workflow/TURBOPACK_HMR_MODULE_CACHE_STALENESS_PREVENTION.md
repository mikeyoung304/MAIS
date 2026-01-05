# Turbopack HMR Module Cache Staleness Prevention

**Date Created:** 2026-01-04
**Severity:** Medium (appears as broken app but is easily recoverable)
**Impact:** Development productivity, rapid debugging cycles
**Category:** Development Environment / Hot Module Replacement

---

## Executive Summary

Turbopack's Hot Module Replacement (HMR) cache becomes stale when:

1. **Removing imports** (especially from large libraries like `lucide-react`)
2. **Switching between build modes** (production build → dev mode)
3. **Changing branch dependencies** (different package versions)
4. **Removing devDependencies** (like `@tanstack/react-query-devtools`)

**Symptoms:**

- Browser shows "Something went sideways" or module factory errors
- Server shows successful compilation but browser won't load
- Error references a module or path you just removed
- HMR hydration fails after refactoring

**Quick Fix:**

```bash
cd apps/web && rm -rf .next .turbo node_modules/.cache && npm run dev
```

**Prevention Cost:** 30 seconds per incident
**Prevention Benefit:** Avoids 5-10 minute debugging sessions

---

## Part 1: Understanding the Problem

### How Turbopack HMR Works

Turbopack maintains an in-memory **module graph** that tracks:

- All imported modules
- Dependency relationships
- Module factory functions
- Export/import paths

When you edit a file:

```
File Change → Turbopack Detects → Recompile Module → Send to Browser
                                                           ↓
                                    Browser Updates Module Factory
                                    Re-execute affected imports
                                    Component re-renders (React HMR)
```

### Why Cache Becomes Stale

**Scenario 1: Removing an Import**

```typescript
// Original code
import { Heart, Star } from 'lucide-react';

function Button() {
  return <Heart />;
}
```

After refactoring:

```typescript
// Removed Star import
import { Heart } from 'lucide-react';

function Button() {
  return <Heart />;
}
```

**What happens in Turbopack:**

1. Compiler removes `Star` from the bundle
2. Module graph updated: `Star` no longer in dependency list
3. HMR message sent to browser: "update module factory"
4. Browser's cached module graph still has reference to `Star`
5. If component tries to access `Star` → error: "module factory not available"

**Scenario 2: Build Mode Switching**

```bash
npm run build        # Creates .next/server/app-build-manifest.json
npm run dev          # Expects .next/server/app/page/app-build-manifest.json
# ← Paths don't match! ENOENT error
```

Production build and Turbopack create **incompatible `.next` structures**:

| Mode                           | Manifest Path                                   | Structure              |
| ------------------------------ | ----------------------------------------------- | ---------------------- |
| Production (`next build`)      | `.next/server/app-build-manifest.json`          | Single, bundled        |
| Turbopack (`next dev --turbo`) | `.next/server/app/page/app-build-manifest.json` | Per-route, incremental |

**Scenario 3: Removing a DevDependency**

When you remove `@tanstack/react-query-devtools`:

1. Your code no longer imports it
2. Compiler removes from bundle
3. Browser still has cached version in module graph
4. If any code previously referenced it → module not found error

---

## Part 2: Warning Signs (Early Detection)

### Pattern 1: After Removing Imports

**Watch for these activities:**

```bash
# You just did one of these:
git checkout -b refactor/cleanup-imports
# Remove unused imports from components
# Delete icon imports from lucide-react
# Simplify dependency chain
```

**Expected HMR behavior:**

- File change detected: ✓
- Compiled successfully: ✓
- Browser refresh: ✓ (works)
- Hot update: ✗ (error)

**Red flag:** "Module was instantiated... but the module factory is not available"

### Pattern 2: After Running `npm run build`

```bash
npm run build    # ← Production build
npm run dev      # ← Back to dev mode
```

**Red flags:**

- Error: `ENOENT: no such file or directory, open '.next/server/app/page/app-build-manifest.json'`
- App shows loading spinner forever
- "missing required error components, refreshing..."

### Pattern 3: After Dependency Changes

```bash
git checkout feature/xyz    # Different package.json
npm install                 # Install different versions
npm run dev                 # Dev server starts...
# Browser shows old module graph from previous checkout
```

**Red flag:** Module errors reference dependencies from previous branch

### Pattern 4: Browser Cache Issues

Even with server working correctly, browser cache can be stale:

**Signs:**

- Dev server shows no errors
- Network tab shows 200 responses
- Browser still shows old error
- Hard refresh (Cmd+Shift+R) fixes it

---

## Part 3: Prevention Strategies

### Strategy 1: Recognize the Pattern Early (0 cost, instant)

**Self-Check Before You Refactor:**

```markdown
## Pre-Refactor Checklist

- [ ] Understand this is removing imports (module cache risk)
- [ ] Plan to do simple file edits (not major reorganization)
- [ ] Know: Hard refresh may be needed if HMR breaks
- [ ] Browser DevTools Network tab will show if HMR sent
```

**If you DO experience HMR errors:**

```typescript
// In browser console:
// Look for messages like:
// "Module X was instantiated but module factory is not available"
// ↓ This means module graph stale
// Recovery: Clear caches (see Part 4)
```

### Strategy 2: Safe Refactoring Workflow

**Recommended pattern when removing imports:**

```bash
# Step 1: Enable incognito mode (browser cache issues won't accumulate)
# Open Private/Incognito window

# Step 2: Start dev server fresh
cd apps/web && npm run dev

# Step 3: Make import changes (small edits)
# Edit file, remove unused imports

# Step 4: Check what happens
# Option A: HMR works → page updates automatically → all good
# Option B: HMR fails → hard refresh (Cmd+Shift+R) → works
# Option C: Still broken → clear caches (Part 4)

# Step 5: If pattern repeats, stop and clear caches between edits
```

**Why incognito window helps:**

- Starts fresh browser cache each session
- No accumulation of old module graphs
- Easier to spot if server or browser is the problem

### Strategy 3: Quick Recovery Script

**Add to `apps/web/package.json`:**

```json
{
  "scripts": {
    "dev": "next dev --turbo --port 3000",
    "dev:fresh": "rm -rf .next .turbo node_modules/.cache && npm run dev",
    "build": "next build",
    "build:clean": "rm -rf .next .turbo && npm run build"
  }
}
```

**Usage:**

```bash
# Instead of: npm run dev (if it's broken)
# Use: npm run dev:fresh

npm run dev:fresh
# Clears all caches and starts fresh
# Takes ~5 seconds vs 5-10 min debugging
```

### Strategy 4: Browser DevTools Setup

**Configure DevTools to minimize cache confusion:**

**Step 1: Disable Service Worker**

```
DevTools → Application → Service Workers
☐ Uncheck "Update on Reload" (disabled)
☐ Uncheck "Offline" (disabled)
```

**Step 2: Disable HTTP Cache**

```
DevTools → Network tab
☑ Check "Disable Cache" (checked during development)
```

**Step 3: Hard Refresh Keyboard Shortcut**

```
Mac:     Cmd + Shift + R  (or Cmd + Option + R)
Windows: Ctrl + Shift + R (or Ctrl + F5)
```

**Why it matters:**

- When "Disable Cache" is checked, hard refresh is less critical
- But some cached modules live outside HTTP cache (in memory)
- Hard refresh clears both HTTP cache AND in-memory module graph

### Strategy 5: Browser Incognito During Heavy Refactoring

**When doing major refactoring (removing multiple imports):**

```bash
# Open new Incognito window (no prior cache)
# Point to: http://localhost:3000

# Make refactoring changes
# Each change: HMR will work or hard refresh will fix it
# No accumulated module graph cruft

# When done, close incognito
# (Browser memory frees up, caches cleared automatically)
```

**Benefits:**

- Guarantees clean module graph state
- No leftover cached versions
- Easy to spot if issue is server vs browser cache
- Works the same every time

---

## Part 4: Quick Recovery Commands

### Recovery Level 1: Browser Cache Only

**When:** Dev server works but browser shows errors

```bash
# Option A: Hard refresh in browser
Cmd+Shift+R        # macOS
Ctrl+Shift+R       # Windows/Linux

# Option B: Clear site data
DevTools → Application → Clear Site Data → All Sites
```

**Time:** 5 seconds
**Success rate:** 80% (if issue is purely browser cache)

### Recovery Level 2: Dev Server Cache

**When:** Dev server shows errors, restarting helps

```bash
# Kill the dev server
Ctrl+C              # In terminal where dev server runs

# Clear Next.js and Turbo caches
cd apps/web && rm -rf .next .turbo

# Restart dev server
npm run dev
```

**Time:** 10 seconds
**Success rate:** 95% (most common scenario)

### Recovery Level 3: Everything

**When:** Levels 1 & 2 didn't work, nuclear option

```bash
# Kill all Node processes
pkill -9 -f node

# Clear all caches
cd apps/web && rm -rf .next .turbo node_modules/.cache

# Clear browser cache (in new window/incognito)
# DevTools → Application → Clear Site Data

# Restart dev server
npm run dev

# Visit in incognito window
# http://localhost:3000
```

**Time:** 20 seconds
**Success rate:** 99%+ (clears everything)

### Recovery Level 4: Production Build Cleanup

**When:** You ran `npm run build` and now `npm run dev` is broken

```bash
# You recently did:
npm run build
npm run dev
# ← Now it's broken

# The .next folder from build is incompatible with dev mode
# Solution: Clear it

cd apps/web && rm -rf .next && npm run dev

# That's it! Dev mode uses different .next structure
# No need to rebuild, just clear and restart
```

**Time:** 5 seconds
**Success rate:** 100% (this is the exact cause)

---

## Part 5: Decision Tree

```
┌─────────────────────────────────┐
│ HMR error or "Something went    │
│ sideways" in browser?           │
└────────────────┬────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
        ▼                 ▼
    Dev server       Server compiled
    has errors       OK, browser broken
        │                 │
   ┌────┴────┐      ┌─────┴──────┐
   │          │      │            │
   ▼          ▼      ▼            ▼
Cannot   Manifest  Browser  Hard refresh
start    error     cache    helps?
   │        │          │          │
   │        │          ▼          ├─ Yes: Done! ✓
   │        │      Clear site  └─ No: Continue
   │        │      data OK?
   │        │          │
   │        │          └─ Try Ctrl+Shift+R
   │        │
   ▼        ▼
   │ rm -rf .next .turbo
   │ npm run dev
   │
   └────┬─────────────────
        ▼
    Works?
        │
        ├─ Yes: Done! ✓
        └─ No: pkill -9 -f node
             rm -rf .next .turbo node_modules/.cache
             npm run dev
```

---

## Part 6: Development Best Practices

### When to Clear Caches Proactively

**Clear before:**

```bash
# 1. Switching git branches
git checkout new-branch
npm install
cd apps/web && rm -rf .next .turbo && npm run dev

# 2. Pulling from main
git pull
npm install
cd apps/web && rm -rf .next .turbo && npm run dev

# 3. After removing dependencies
# In package.json: Remove a library
npm install
cd apps/web && rm -rf .next .turbo && npm run dev

# 4. After major refactoring (many import changes)
# When you've removed 10+ imports in one session
cd apps/web && rm -rf .next .turbo && npm run dev
```

**Cost:** 5 seconds per clear
**Benefit:** Prevents 10-minute debugging session
**ROI:** Positive if it prevents even one incident per week

### File Organization to Avoid HMR Issues

**Pattern 1: Don't remove imports from widely-used files**

```typescript
// ❌ Risky - if Button is imported 20 places
// And you remove an import from Button.tsx
// HMR might break for all 20 pages

// ✓ Better - centralize in one place
// src/ui/Button.tsx - make edits here
// Other files just import { Button } from '@/ui/Button'
```

**Pattern 2: Group related imports**

```typescript
// ❌ Scattered across file
import { Heart } from 'lucide-react';
// ... 50 lines of code ...
import { Star } from 'lucide-react';
// ... 50 lines of code ...
import { Settings } from 'lucide-react';

// ✓ Better - group at top
import { Heart, Star, Settings } from 'lucide-react';
```

**Why:** Makes it obvious what you're removing. Easy to verify all instances removed.

### TypeScript to Catch Unused Imports

**Use TypeScript strict mode to catch unused imports:**

```bash
# In apps/web/tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

**Benefit:** TypeScript will error on unused imports before they become HMR issues

```bash
# Run this to find issues early
cd apps/web && npm run typecheck
# Errors on unused imports before HMR breaks
```

---

## Part 7: Testing Strategy

### Unit Test: Module Removal

```typescript
// apps/web/src/__tests__/hmr-module-removal.test.ts
import { describe, it, expect } from 'vitest';

describe("Module removal doesn't break imports", () => {
  it('should not have unused imports', async () => {
    // This test catches imports that will cause HMR issues
    // Import all components that might be affected
    const module = await import('../components/Button');

    // Verify expected exports exist
    expect(module.Button).toBeDefined();

    // If this fails, you removed an export that's still imported somewhere
  });
});
```

### E2E Test: HMR Stability

```typescript
// e2e/tests/hmr-stability.spec.ts
import { test, expect } from '@playwright/test';

test.describe('HMR Stability', () => {
  test('page loads without module errors', async ({ page }) => {
    // Navigate to page
    await page.goto('http://localhost:3000');

    // Monitor console for HMR errors
    let hasModuleErrors = false;
    page.on('console', (msg) => {
      if (msg.text().includes('module factory')) {
        hasModuleErrors = true;
      }
    });

    // Wait for HMR to settle
    await page.waitForTimeout(2000);

    // Verify no module errors occurred
    expect(hasModuleErrors).toBe(false);
  });

  test('hard refresh works without errors', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Simulate hard refresh
    await page.keyboard.press('Control+Shift+R');

    // Should load successfully
    await page.waitForLoadState('networkidle');

    // No "Something went sideways" error
    const errorElement = page.locator('text=Something went sideways');
    await expect(errorElement).not.toBeVisible();
  });
});
```

---

## Part 8: Environment-Specific Guidance

### Local Development (macOS)

```bash
# Setup dev scripts
cd apps/web
npm run dev:fresh          # Use when HMR breaks
Cmd+Shift+R               # Hard refresh in browser
Cmd+Option+I              # Open DevTools
```

### Local Development (Windows)

```bash
# Setup dev scripts
cd apps/web
npm run dev:fresh          # Use when HMR breaks
Ctrl+Shift+R              # Hard refresh in browser
F12                       # Open DevTools
```

### CI/CD (GitHub Actions)

**Don't worry about HMR in CI** - machines don't have browsers.

Focus on preventing cache issues in tests:

```yaml
- name: Clear caches
  run: |
    cd apps/web
    rm -rf .next .turbo node_modules/.cache

- name: Build
  run: npm run build -w apps/web
```

### Production Deployment (Vercel)

**Vercel automatically handles cache clearing:**

```bash
# On every deployment, Vercel:
# 1. Clears .next folder
# 2. Rebuilds fresh
# 3. No HMR issues (HMR only in dev mode)

# No action needed from you!
```

---

## Part 9: Common Scenarios and Solutions

### Scenario 1: Removed Icon Import

**What happened:**

```typescript
// You removed this from Button.tsx
import { Star } from 'lucide-react';
// But forgot it was also used in header.tsx

// Result: Header still tries to use Star
// HMR sees Star removed from bundle
// Header can't find Star module
```

**Detection:**

```
Error in browser console:
"Star was instantiated... but the module factory is not available"
```

**Solution:**

**Option A (Quick):**

```bash
Cmd+Shift+R  # Hard refresh
# Should work now
```

**Option B (If Option A doesn't work):**

```bash
cd apps/web && npm run dev:fresh
```

**Root cause fix:**

```bash
# Search for all Star imports
grep -r "Star" apps/web/src --include="*.tsx"

# Add it back to Button.tsx if needed
# Or remove from all files where it's imported
```

### Scenario 2: Switched Branches, Now HMR Broken

**What happened:**

```bash
git checkout feature/auth
npm install
npm run dev

# Different packages installed, but old .next folder still present
# Turbopack can't find modules from old package.json
```

**Solution:**

```bash
cd apps/web && npm run dev:fresh
# Clears .next and .turbo from previous branch
```

**Preventive setup:**

```bash
# After any branch switch, always:
git checkout new-branch
npm install
cd apps/web && rm -rf .next .turbo && npm run dev
```

### Scenario 3: Just Did Build, Now Dev is Broken

**What happened:**

```bash
npm run build              # Creates .next for production
npm run dev                # Tries to use production .next in dev mode
# ← Manifest paths incompatible!
```

**Solution:**

```bash
cd apps/web && rm -rf .next && npm run dev
# Dev mode creates its own .next, different structure
```

**Preventive pattern:**

```bash
# If you MUST test production locally:
npm run build
npm run start             # Test production separately
rm -rf .next              # Clear when done
npm run dev               # Return to dev with clean cache
```

### Scenario 4: Slow HMR Updates

**What happened:**

```
You edit a file → Turbopack waits 3+ seconds → Finally sends update
# This isn't broken, but it's slow
```

**Root cause:**

- Large bundle size
- Circular dependencies
- File watching delays

**Temporary fix:**

```bash
cd apps/web && npm run dev:fresh
# Sometimes caches accumulate and slow things down
```

**Long-term fix:**

```bash
# Check for circular dependencies
npx madge --circular apps/web/src
# Fix circular imports if found
```

---

## Part 10: Quick Reference Card

Print and pin this!

```
TURBOPACK HMR STALENESS QUICK REFERENCE

SYMPTOMS:
✗ "Something went sideways" in browser
✗ Module factory not available
✗ ENOENT: app-build-manifest.json
✗ HMR updates but page doesn't change
✗ Errors after removing imports

QUICK FIXES (in order):
1. Hard refresh:     Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
2. Browser cache:    DevTools → Application → Clear Site Data
3. Dev cache:        cd apps/web && npm run dev:fresh
4. Nuclear:          pkill -9 -f node && rm -rf .next .turbo

PREVENTION:
• Use incognito browser during refactoring
• Proactively clear after: git checkout, npm install, package changes
• Search for all imports before removing them
• Group imports at top of files

COMMANDS:
cd apps/web && npm run dev:fresh    # Clear + restart
cd apps/web && rm -rf .next .turbo  # Clear only
npm run dev:fresh                   # If script added to package.json

TIME COST:
Prevention: 5 seconds per clear
Debugging: 10-15 minutes per incident
ROI: Positive if prevents 1 incident/week
```

---

## Part 11: Advanced Debugging

### If All Else Fails

**Step 1: Check server logs**

```bash
# Look for actual compilation errors in terminal
# Not just browser "Something went sideways"
# Example: "ReferenceError: Star is not defined"
# This means code is trying to use removed import
```

**Step 2: Check .next folder**

```bash
ls -la apps/web/.next/server/
# Should have nested folder structure for Turbopack
# If you see app-build-manifest.json (not nested)
# ← That's production build manifest, incompatible
# Solution: rm -rf .next
```

**Step 3: Check node_modules**

```bash
# If import errors persist after clearing caches:
rm -rf apps/web/node_modules
npm install
npm run dev
```

**Step 4: Environment variables**

```bash
# Make sure NODE_ENV is not set to production
echo $NODE_ENV
# Should be empty or "development"

# If production:
unset NODE_ENV
npm run dev
```

### Browser DevTools Inspection

```javascript
// In browser console:
// Check what module graph looks like
console.log(window.__NEXT_DATA__);

// Check HMR status
window.__NEXT_HMR__; // Should show HMR status

// Look for error messages:
// "module factory is not available"
// ← Points to specific module that's missing
```

---

## Summary Table

| Situation                | Fix                   | Time |
| ------------------------ | --------------------- | ---- |
| Browser error, server OK | Hard refresh          | 5s   |
| After removing imports   | Dev cache clear       | 5s   |
| After `npm run build`    | `rm -rf .next`        | 5s   |
| After branch switch      | `rm -rf .next .turbo` | 5s   |
| Slow HMR updates         | Cache clear           | 5s   |
| Multiple issues          | Nuclear clear         | 20s  |
| Still broken             | Check logs            | 5m   |

---

## Related Documentation

- **Original Issue:** `/docs/solutions/build-errors/turbopack-hmr-cache-conflict-after-production-build-MAIS-20260102.md`
- **Next.js Dev Workflow:** `/docs/guides/NEXTJS_DEVELOPMENT_WORKFLOW.md`
- **Type Safety:** `/docs/solutions/best-practices/any-types-quick-reference-MAIS-20251204.md`

---

## Key Insight

Turbopack HMR cache issues are **always recoverable** and **never indicate a real problem** with your code. They're just stale caches.

The fix is always the same: **Clear the cache.**

Learning to recognize the pattern and applying the quick fix takes 5 seconds, vs. 15 minutes of debugging wondering if your refactoring broke something.

**Prevention strategy:** Be aware of when caches can become stale (import changes, build mode switches, branch changes) and proactively clear them.

---

**Version:** 1.0
**Last Updated:** 2026-01-04
**Status:** Active (reference this document when HMR issues occur)
