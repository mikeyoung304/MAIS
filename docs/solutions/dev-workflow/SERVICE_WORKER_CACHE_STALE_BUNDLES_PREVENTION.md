# Service Worker PWA Cache Stale Bundles Prevention

**Date Created:** 2026-01-05
**Severity:** High (misleads debugging, masks real errors)
**Impact:** Development velocity, component troubleshooting
**Category:** Development Environment / PWA Service Worker Cache

---

## Executive Summary

Next.js PWA Service Workers cache JavaScript bundles aggressively. When you modify code, Turbopack recompiles correctly, server logs show success, but the browser still loads stale bundles from Service Worker cache. This creates misleading errors like:

- "Element type is invalid: undefined"
- "Cannot read property of undefined"
- "Module factory not available"
- Components that should work refuse to render

**Key Challenge:** The errors appear genuine (they ARE genuine for the stale code), but your actual code is fine. Server compiled correctly. Network shows 304 Not Modified. But Service Worker cached the old bundle.

**Symptoms That Point to SW Caching (NOT Real Code Errors):**

- Module level `console.log()` shows correct imports
- Server logs show clean compilation with no errors
- `.next` directory has correct build output
- Browser DevTools Network tab shows 304 (cached)
- Hard refresh (Cmd+Shift+R) fixes it temporarily
- Issue reoccurs after next code edit (not same error, different stale bundle)

**Quick Fix:**

```bash
# Unregister Service Worker in DevTools
DevTools → Application → Service Workers → Unregister

# Then reload
Cmd+R (or F5)
```

**Prevention Cost:** 10 seconds per check
**Prevention Benefit:** Avoids 10-20 minute debugging sessions
**ROI:** Positive if prevents 1 incident per week

---

## Part 1: Understanding the Problem

### How Service Workers Cache Bundles

Service Workers are designed to work **offline** by caching network responses. The cache strategy:

```
First Request  → SW intercepts → Fetch from network → Cache response
Subsequent     → SW intercepts → Return from cache → Don't hit network
Requests       → (with stale-while-revalidate strategy)
```

**For JS bundles, Next.js uses cache-first strategy:**

```
Browser requests: /app-abc123.js
  ↓
Service Worker checks cache
  ├─ Cache HIT → Return cached bundle (fast, but STALE)
  └─ Cache MISS → Fetch from network, cache it
```

### Why This Breaks Development

**Scenario: You refactor a component**

```typescript
// Original code
import { Button } from './Button';

function Header() {
  return <Button />;
}
```

You fix Button:

```typescript
// New code - Button is now a client component
'use client';

import { useState } from 'react';

export function Button() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

**What happens:**

1. You save the file
2. Turbopack recompiles: ✓ Success
3. New bundle created: `_next/static/chunks/app-xyz789.js` ✓
4. Browser requests updated page
5. **Service Worker intercepts:** "I have `app-abc123.js` in cache" (the OLD one)
6. Returns stale `app-abc123.js` which still has old Button code
7. Browser tries to render → Error: "Component type is invalid" (stale code doesn't have the fix)

**Server is correct. Browser is wrong.**

### Browser Cache vs Service Worker Cache

Two different caching layers:

| Layer          | Location             | Lifespan                         | How to Clear                                              |
| -------------- | -------------------- | -------------------------------- | --------------------------------------------------------- |
| HTTP Cache     | Browser cache folder | Until expires (may never in dev) | Hard refresh (Cmd+Shift+R) or Network tab "Disable cache" |
| Service Worker | Registered in SW     | Until unregistered               | DevTools → Application → Service Workers → Unregister     |

**Service Worker cache is MORE persistent** because it survives browser cache clear.

---

## Part 2: Recognition Patterns - How to Identify SW Caching Issues

### Pattern 1: "But my code is fine!" - Module Level Verification

**You did this check:**

```typescript
// Header.tsx
console.log('Button import:', Button); // ✓ Logs correctly
console.log('Button type:', typeof Button); // ✓ "function"

function Header() {
  return <Button />; // ✗ Error: "Element type is invalid"
}
```

**What you see in console:**

- `console.log()` calls execute correctly (Button is defined, has expected type)
- But React rendering fails with "Element type is invalid"

**Red flag: This is Service Worker cache issue**

When SW serves stale bundle:

- The `console.log()` happens in stale code (maybe it was there in older version, or wasn't)
- Stale Button export is wrong type for current React version
- React validation fails even though console.log passed

### Pattern 2: Server Compiled Successfully But Browser Shows Error

**In terminal:**

```bash
✓ GET /app-xyz789.js 200  (clean compile)
✓ GET /header-abc123.js 200
```

**In browser console:**

```
Error: Element type is invalid: expected a string (for built-in components)
or a class/function (for composite components) but got: object.
```

**Server thinks everything is fine. Browser is lying.**

**Red flag: Service Worker served stale bundle**

### Pattern 3: Hard Refresh Fixes It (Temporarily)

**You do this:**

```bash
Cmd+Shift+R          # Hard refresh
# Page loads and works correctly!
# Then you edit a file...
npm run dev          # Recompiles fine
# Page still shows same error (different now)
```

**Pattern: Works after hard refresh, breaks after next edit**

This is textbook SW cache staleness because:

1. Hard refresh clears both HTTP cache AND SW cache (temporarily)
2. Page loads fresh bundle (correct)
3. You edit a file
4. New bundle created
5. Old bundle still in SW cache (SW cache wasn't fully cleared)
6. SW returns old bundle

### Pattern 4: Network Tab Shows 304 Not Modified

**In DevTools → Network tab:**

```
GET /app-xyz789.js  304 (Not Modified)
                    Size: (from service worker)
                    Time: 0ms
```

**The 304 indicates:**

- Browser asked "do you have a newer version?"
- Server said "nope, you have the latest" (because cache key is same)
- Browser used cached version (from SW)

**But you just rebuilt!** The cache key shouldn't be the same.

**Red flag: Service Worker is returning cached bundle without checking**

### Pattern 5: Error Changes After Different Code Edit

**First error:**

```
Error: Button is not a function
```

You search for where Button is used... looks fine.

You edit an unrelated file (like styling).

**New error (different from before):**

```
Error: Card is not a function
```

**Pattern: Different error after different edit = SW cache staleness**

Real code errors are consistent. SW stale cache manifests differently depending on which bundle was cached and how the server cache keys were generated.

### Pattern 6: Errors Don't Match Your Recent Changes

**You just did:**

```typescript
// Added this import
import { useCallback } from 'react';
```

**But error says:**

```
ReferenceError: formatDate is not defined
```

formatDate is from a different file you didn't touch.

**Red flag: Error is from old cached bundle**

### Pattern 7: Console Shows Correct Values But React Errors

```typescript
import { Button } from './Button';

function Header() {
  console.log(Button);        // ✓ Logs: [Function: Button]
  console.log(Button.name);   // ✓ Logs: "Button"

  return (
    <>
      {Button && <Button />}  // ✓ Button is truthy
      {<Button />}            // ✗ Error: "Element type is invalid"
    </>
  );
}
```

**The difference:** In stale bundle, `Button` might be an object wrapper instead of the actual function (from old transpilation or module federation).

### Quick Diagnosis Checklist

```
Is this a Service Worker cache issue?

□ Hard refresh (Cmd+Shift+R) fixed it?
  YES → Likely SW cache (or HTTP cache, but SW is more persistent)

□ Server log shows clean compilation?
  YES + Error in browser → SW cache issue

□ console.log shows correct values but React errors?
  YES → SW cache issue (stale module type)

□ Error changed after unrelated edit?
  YES → SW cache issue (different stale bundle)

□ Network tab shows 304 Not Modified?
  YES + You just rebuilt → SW cache serving stale

□ Unregistering SW fixes it?
  YES → Confirmed SW cache issue
```

---

## Part 3: Prevention Strategies

### Strategy 1: Disable Service Worker During Development (RECOMMENDED)

**In `next.config.js`:**

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // ... other config ...

  // Disable Service Worker in development
  // Only enable for production builds and testing PWA features
  ...(process.env.NODE_ENV === 'development' && {
    experimental: {
      swcPlugins: [],
      // Disable next-pwa or similar if installed
    },
  }),
};

module.exports = nextConfig;
```

**Or in your PWA plugin (if using `next-pwa`):**

```javascript
// next.config.js
const withPWA = require('next-pwa');

const nextConfig = withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development', // ← Disable in dev
  register: process.env.NODE_ENV === 'production', // ← Enable in prod
});

module.exports = nextConfig;
```

**Benefit:** Eliminates SW cache issues entirely during development
**Cost:** None (SW only needed for production offline support)

### Strategy 2: Manual Service Worker Unregistration (Quick Fix)

**When you suspect SW cache issue:**

```bash
# Open DevTools
# Cmd+Option+I (Mac) or F12 (Windows)
# Navigate to: Application tab

# Under "Service Workers" section:
# Click "Unregister" next to the active service worker

# Then reload the page
Cmd+R (or F5)
```

**Or programmatically in DevTools console:**

```javascript
// Unregister all service workers
navigator.serviceWorker
  .getRegistrations()
  .then((registrations) => {
    registrations.forEach((reg) => reg.unregister());
  })
  .then(() => location.reload());
```

**Benefit:** Immediate fix without restarting dev server
**Cost:** 10 seconds per incident

### Strategy 3: Add Development-Only Service Worker Clear Script

**Create `apps/web/scripts/clear-sw-cache.js`:**

```javascript
// Clear service worker cache during development

async function clearServiceWorkerCache() {
  try {
    // Unregister all service workers
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((reg) => reg.unregister()));
    console.log('✓ Service workers unregistered');

    // Clear cache storage
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((name) => caches.delete(name)));
    console.log('✓ Cache storage cleared');

    console.log('Service Worker cache fully cleared. Reload page.');
    return true;
  } catch (error) {
    console.error('Failed to clear SW cache:', error);
    return false;
  }
}

// Make available in DevTools console
window.clearSWCache = clearServiceWorkerCache;
```

**Add to `apps/web/src/middleware.ts` or layout:**

```typescript
// Only in development
if (process.env.NODE_ENV === 'development') {
  if (typeof window !== 'undefined') {
    // Make available in console
    (window as any).clearSWCache = async () => {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((reg) => reg.unregister()));
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
      console.log('✓ Service Worker cache cleared. Reload page.');
    };
  }
}
```

**Usage in DevTools console:**

```javascript
await window.clearSWCache();
location.reload();
```

**Benefit:** One-liner to clear SW cache without touching DevTools UI
**Cost:** 5 seconds per incident

### Strategy 4: Network Tab DevTools Configuration

**During development, disable caching in DevTools:**

```
Chrome/Edge DevTools → Network tab → ☑ "Disable Cache"
```

This forces browser to revalidate every request (bypasses both HTTP and SW cache):

```
Browser requests /app-xyz.js
  ↓
Service Worker intercepts → checks cache
  ↓
SW → "But DevTools says disable cache"
  ↓
SW → Fetch fresh from network
  ↓
Update cache with latest
```

**Benefit:** Prevents stale caches from being served
**Cost:** Slightly slower page loads (but still fast in dev)
**When to use:** During refactoring or debugging SW-related issues

### Strategy 5: Git Awareness Script (Proactive Clearing)

**When checking out branches with different dependencies:**

```bash
#!/bin/bash
# apps/web/scripts/dev-safe-checkout.sh

# Switch branch
git checkout "$1"

# Install dependencies
npm install

# Clear SW and Turbo caches
cd apps/web
rm -rf .next .turbo node_modules/.cache

# Clear browser caches by touching public/sw.js to force cache refresh
touch public/sw.js

# Restart dev server
npm run dev
```

**Usage:**

```bash
chmod +x apps/web/scripts/dev-safe-checkout.sh
./apps/web/scripts/dev-safe-checkout.sh feature/new-feature
```

**Benefit:** Prevents cascade of SW cache issues after branch switches
**Cost:** 5 extra seconds per branch switch

### Strategy 6: Update npm Scripts

**Add to `apps/web/package.json`:**

```json
{
  "scripts": {
    "dev": "next dev --turbo --port 3000",
    "dev:fresh": "rm -rf .next .turbo node_modules/.cache && npm run dev",
    "dev:no-sw": "DISABLE_SW=true npm run dev",
    "build": "next build",
    "build:clean": "rm -rf .next .turbo && npm run build"
  }
}
```

**Usage:**

```bash
# Normal dev with SW enabled
npm run dev

# Dev with all caches cleared
npm run dev:fresh

# Dev with Service Worker disabled (fastest, no cache issues)
npm run dev:no-sw
```

### Strategy 7: DevTools Bookmark (Fastest Clear)

**Create a bookmark that clears SW cache in browser:**

```javascript
javascript: (async () => {
  const regs = await navigator.serviceWorker.getRegistrations();
  regs.forEach((r) => r.unregister());
  const caches_list = await caches.keys();
  caches_list.forEach((c) => caches.delete(c));
  alert('SW Cache Cleared');
  location.reload();
})();
```

**Steps:**

1. Create new bookmark in browser
2. Paste above JavaScript into URL field
3. Click bookmark when SW cache suspected

**Benefit:** One-click SW cache clear without DevTools
**Cost:** 3 seconds per incident

---

## Part 4: When to Suspect Service Worker Cache vs Real Errors

### Decision Tree

```
┌─────────────────────────────────────┐
│ Component error in React?            │
│ (Element type invalid, etc.)         │
└────────────┬────────────────────────┘
             │
      ┌──────┴──────┐
      │             │
      ▼             ▼
  Hard       Server compiled
  refresh    cleanly?
  fixes?        │
      │         ├─ Yes: Likely SW cache
      │         │       (server is fine, browser stale)
      │         └─ No: Real code error
      │             (server compilation failed)
      │
      ├─ Yes, fixes: Likely cache issue
      │              (SW or HTTP cache)
      │
      └─ No: Real error
           (either code or type mismatch)

  ┌──────────────────────────────────┐
  │ Immediate diagnosis if fixed:    │
  │ Unregister SW → Fixed?           │
  └──┬─────────────────────────────┬─┘
     │                             │
   YES → SW cache             NO → HTTP cache
         (use Strategy 2-4)        (use hard refresh)
```

### Real Error vs SW Cache Error Checklist

| Indicator                          | Real Error | SW Cache | Check How                                      |
| ---------------------------------- | ---------- | -------- | ---------------------------------------------- |
| Server logs show error             | ✓          | ✗        | Terminal where dev server runs                 |
| Hard refresh fixes it              | ✗          | ✓        | Cmd+Shift+R then reload                        |
| `console.log` shows correct values | ✗          | ✓        | Browser console at module level                |
| Error consistent across reloads    | ✓          | ✗        | Reload page 3 times, same error?               |
| Unregistering SW fixes it          | ✗          | ✓        | DevTools → Application → Unregister → Reload   |
| Error references code you edited   | ✓          | ✗        | Does error location match your recent changes? |
| Network shows 304 (cached)         | ✗          | ✓        | DevTools → Network tab, check response status  |

### Common Misconceptions

**Misconception 1:** "If I clear my browser cache, it's gone"

Reality: Service Worker cache is separate. Browser cache clear doesn't touch SW.

**Misconception 2:** "Restarting the dev server clears SW cache"

Reality: SW cache lives in browser, not dev server. Server restart doesn't help.

**Misconception 3:** "This is a real error because the component exists in node_modules"

Reality: SW might have old version cached, or different transpilation. Verify with unregister.

**Misconception 4:** "The error message tells me exactly what's wrong"

Reality: Error from stale bundle often points to wrong location (because it's old code).

---

## Part 5: Quick Recovery Commands

### Recovery Level 1: Browser Cache Clear (5 seconds)

```bash
# Hard refresh
Cmd+Shift+R (Mac)
Ctrl+Shift+R (Windows)
```

**Clears:** HTTP browser cache
**Doesn't clear:** Service Worker cache
**Success rate:** 60% (if issue is HTTP cache)

### Recovery Level 2: Service Worker Unregister (10 seconds)

```bash
# In DevTools:
# 1. Press Cmd+Option+I (Mac) or F12 (Windows)
# 2. Go to Application tab
# 3. Left sidebar → Service Workers
# 4. Click "Unregister"
# 5. Reload page (Cmd+R)
```

**Clears:** Service Worker cache
**Also clears:** All cached bundles
**Success rate:** 95% (most common SW cache issue)

### Recovery Level 3: Console Script (5 seconds)

```bash
# In browser DevTools console, paste:
navigator.serviceWorker.getRegistrations()
  .then(regs => Promise.all(regs.map(r => r.unregister())))
  .then(() => { caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k)))) })
  .then(() => location.reload());
```

**Or if you added the helper:**

```javascript
await window.clearSWCache();
location.reload();
```

**Clears:** Everything (SW + cache storage)
**Success rate:** 99%

### Recovery Level 4: Dev Server + Browser Clear (20 seconds)

```bash
# Terminal: Kill dev server
Ctrl+C

# Clear all caches
cd apps/web && npm run dev:fresh

# Browser: Open in incognito window
# (or DevTools → Application → Clear Site Data)
```

**Clears:** Everything (server caches + SW + HTTP)
**Success rate:** 99.9%

---

## Part 6: Best Practices for Development with Service Workers

### Practice 1: Separate PWA Build Configuration

**In `next.config.js`:**

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // ... base config ...
};

// Only enable PWA features in production
if (process.env.NODE_ENV === 'production') {
  // Add PWA plugin only for production
  const withPWA = require('next-pwa')({
    dest: 'public',
    disable: false,
    register: true,
  });

  return withPWA(nextConfig);
}

module.exports = nextConfig;
```

**Benefit:** No SW cache issues in development
**Cost:** None (SW only needed for production offline support)

### Practice 2: Test SW Cache Issues Intentionally

**Only test PWA offline support in production build:**

```bash
# Build for production
npm run build

# Test production server with SW enabled
npm run start

# Test in incognito window (fresh cache)
# Disable network to verify offline works

# When done, return to dev:
npm run dev
```

**Benefit:** Verify SW caching works when needed, but doesn't interfere with dev
**Cost:** 30 seconds per test

### Practice 3: Browser DevTools Configuration

**During development, enforce cache bypass:**

```
DevTools → Network tab
☑ "Disable cache" (checked)
```

And

```
DevTools → Application → Service Workers
☐ "Update on Reload" (unchecked)
☐ "Offline" (unchecked)
```

**Benefit:** Reduces false positives from stale caches
**Cost:** Slightly slower dev server responses (imperceptible)

### Practice 4: Use Incognito Window for Heavy Refactoring

**When removing multiple imports or doing major refactoring:**

```bash
# Open new incognito window
# Point to http://localhost:3000

# Refactor with confidence (no cache cruft)
# Each edit will have clean SW state

# Close incognito when done
# (All caches freed)
```

**Benefit:** Guarantees clean slate during complex work
**Cost:** 5 seconds to open/close incognito

### Practice 5: Group Imports at Top of Files

```typescript
// ❌ Scattered imports (risky for SW cache)
import { useState } from 'react';
// ... 50 lines ...
import { Button } from './Button';
// ... 50 lines ...
import { useCallback } from 'react';

// ✓ Better - group at top
import { useState, useCallback } from 'react';
import { Button } from './Button';
```

**Benefit:** Makes it clear what bundles are affected by changes
**Cost:** None (better code organization anyway)

---

## Part 7: Testing Strategy

### Unit Test: Service Worker Registration

```typescript
// apps/web/src/__tests__/service-worker.test.ts
import { describe, it, expect, beforeEach } from 'vitest';

describe('Service Worker (Development)', () => {
  beforeEach(() => {
    // Reset navigator mock before each test
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        getRegistrations: vi.fn().mockResolvedValue([]),
      },
      writable: true,
    });
  });

  it('should not register in development mode', async () => {
    // In dev mode, SW should be disabled
    const isDev = process.env.NODE_ENV === 'development';

    if (isDev) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      expect(registrations).toEqual([]);
    }
  });

  it('should provide clear cache function in development', () => {
    // If development, window.clearSWCache should exist
    if (process.env.NODE_ENV === 'development') {
      expect(typeof (window as any).clearSWCache).toBe('function');
    }
  });
});
```

### E2E Test: SW Cache Issues Don't Occur

```typescript
// e2e/tests/sw-cache-stability.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Service Worker Cache Stability', () => {
  test('should not have stale bundle errors after page reload', async ({ page }) => {
    // Navigate to page
    await page.goto('http://localhost:3000');

    // Check for SW cache stale errors
    let staleErrors = false;
    page.on('console', (msg) => {
      if (msg.text().includes('module factory') || msg.text().includes('Element type is invalid')) {
        staleErrors = true;
      }
    });

    // Reload page (should have fresh bundles)
    await page.reload();

    // Wait for hydration
    await page.waitForLoadState('networkidle');

    // No stale bundle errors should occur
    expect(staleErrors).toBe(false);
  });

  test('hard refresh should not show different errors', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Note first error (if any)
    let firstError: string | null = null;
    page.once('console', (msg) => {
      if (msg.type() === 'error') {
        firstError = msg.text();
      }
    });

    // Hard refresh
    await page.keyboard.press('Control+Shift+R');
    await page.waitForLoadState('networkidle');

    // After hard refresh, error should be gone or consistent
    // (not a different stale bundle error)
    let secondError: string | null = null;
    page.once('console', (msg) => {
      if (msg.type() === 'error') {
        secondError = msg.text();
      }
    });

    // If there was an error before, hard refresh should fix it
    // If error persists, it's a real code error (not SW cache)
    if (firstError && secondError === firstError) {
      throw new Error('Hard refresh did not clear error - likely real code issue');
    }
  });
});
```

---

## Part 8: Common Scenarios and Solutions

### Scenario 1: "Everything Broke After I Added Client Component"

**You did:**

```typescript
// components/Button.tsx
'use client';

import { useState } from 'react';

export function Button() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

**Error:**

```
Error: Element type is invalid: expected a string...
```

**Diagnosis:**

```typescript
// In console at module level:
import { Button } from './Button';
console.log(Button); // Logs what?
// If old SW cache: logs wrong type
// If code correct: logs [Function: Button]
```

**Solution:**

**Option A (Quick):**

```bash
# Unregister SW
DevTools → Application → Service Workers → Unregister
# Reload
Cmd+R
```

**Option B (If A doesn't work):**

```bash
npm run dev:fresh
```

### Scenario 2: "Hard Refresh Fixes It But Breaks After Next Edit"

**Pattern:**

1. Hard refresh (works)
2. Edit a file
3. Turbopack recompiles (✓ success)
4. Same error returns (different bundle cached)

**Root cause:** Hard refresh clears HTTP cache but SW cache can re-cache new bundles

**Solution:**

**Option 1 - Disable SW in dev (BEST):**

```javascript
// next.config.js
...(process.env.NODE_ENV === 'development' && {
  // Disable Service Worker in dev
  pwa: { disabled: true },
})
```

**Option 2 - Use dev:no-sw script:**

```bash
npm run dev:no-sw
```

**Option 3 - Keep clearing on each issue:**

```bash
# After each edit that causes error:
# DevTools console → await window.clearSWCache();
# Then reload
```

### Scenario 3: "Works in Incognito, Broken in Regular Window"

**Pattern:**

- Incognito window: page loads, works fine
- Regular window: same page, error

**Root cause:** Regular window has accumulated SW cache, incognito starts fresh

**Solution:**

Unregister SW and clear caches in regular window:

```bash
# DevTools → Application → Service Workers → Unregister
# Then: DevTools → Application → Clear Site Data
# Reload: Cmd+R
```

### Scenario 4: "Error Went Away on Server Restart"

**What happened:**

```bash
npm run dev             # Broken
Ctrl+C                  # Kill server
npm run dev             # Now works!
```

**This doesn't make sense because:**

- Server restart doesn't affect browser SW cache
- SW cache is in browser, not server

**Real explanation:**

- During Ctrl+C and npm run dev, browser times out requests
- During that brief timeout, browser can't use SW cache (network unavailable)
- When server comes back, browser fetches fresh bundles
- Fresh bundles work correctly
- But SW still has old cached versions for next request

**Real solution:**

```bash
# It's not the server restart, it's the network timeout
# To prevent: Disable SW in dev
npm run dev:no-sw
```

---

## Part 9: Troubleshooting Decision Tree

```
┌──────────────────────────────────┐
│ Component error after refactor?  │
└────────┬─────────────────────────┘
         │
         ▼
  ┌──────────────────┐
  │ Server log clean?│
  └──┬─────────────┬─┘
     │             │
     ▼             ▼
    YES           NO
     │             │
     │         Real error
     │         Fix code
     │
     ▼
┌──────────────────────────┐
│ Hard refresh help?       │
└──┬────────────────────┬──┘
   │                    │
  YES                  NO
   │                    │
   ▼                    ▼
Browser      Real error
cache        (not SW related)
issue        Fix code/types
│
▼
┌──────────────────────────────┐
│ Unregister SW help?          │
└──┬────────────────────────┬──┘
   │                        │
  YES                      NO
   │                        │
   ▼                        ▼
SW cache             HTTP cache or
issue                type mismatch
│                    │
├─ Use               Try:
│  dev:no-sw         • Hard refresh again
├─ Or Unregister     • npm run dev:fresh
└─ Or clear          • Check TypeScript errors
                     • npm run typecheck
```

---

## Part 10: Quick Reference Card

**Print and pin this!**

```
SERVICE WORKER CACHE STALE BUNDLES QUICK REFERENCE

SYMPTOMS:
✗ "Element type is invalid"
✗ Hard refresh fixes it temporarily
✗ Server log clean but browser errors
✗ Error changes after unrelated edits
✗ console.log correct but React fails
✗ Network shows 304 (from service worker)

DIAGNOSIS CHECKLIST:
□ Hard refresh (Cmd+Shift+R) fixes it?           YES → cache issue
□ Server compiled without errors?                 YES → browser stale
□ console.log shows correct values?               YES → SW cache
□ Unregistering SW fixes it?                      YES → confirmed SW

QUICK FIXES (in order):
1. Hard refresh:       Cmd+Shift+R (Mac)
2. Unregister SW:      DevTools → Application → Service Workers → Unregister
3. Clear both:         await window.clearSWCache() in console
4. Dev mode:           npm run dev:fresh
5. Disable SW in dev:  npm run dev:no-sw (if script added)

BEST PREVENTION:
★ Disable SW in development (next.config.js)
  Only enable for production testing
★ Use dev:no-sw script for fastest iteration
★ DevTools Network tab: ☑ Disable Cache
★ Incognito window for heavy refactoring

COMMANDS:
npm run dev:fresh             # Clear caches, restart
npm run dev:no-sw             # Dev without Service Worker
DevTools → Clear Site Data    # Nuclear option
await window.clearSWCache()   # Console one-liner

TIME COST:
Hard refresh: 5 seconds
Unregister: 10 seconds
Clear + restart: 20 seconds
Disable in dev: 30 seconds setup, zero incidents

VS

DEBUGGING TIME:
"Is this Service Worker cache?" 10-20 minutes
```

---

## Part 11: Environment-Specific Guidance

### Local Development (macOS)

```bash
# Use dev:no-sw for fastest iteration
npm run dev:no-sw

# Or if you must use SW:
npm run dev
# Then in DevTools:
# Network tab → ☑ Disable Cache
# Application → ☐ Update on Reload

# If broken:
# Cmd+Shift+R (hard refresh)
# Or: DevTools → Service Workers → Unregister
```

### Local Development (Windows)

```bash
# Use dev:no-sw for fastest iteration
npm run dev:no-sw

# Or if you must use SW:
npm run dev
# Then in DevTools:
# Network tab → ☑ Disable Cache
# Application → ☐ Update on Reload

# If broken:
# Ctrl+Shift+R (hard refresh)
# Or: F12 → Application → Service Workers → Unregister
```

### Testing PWA Offline Support (Production Build)

```bash
# Only test SW caching in production build
npm run build
npm run start

# Test in incognito window
# Disable network to verify offline works

# When done:
npm run dev:no-sw  # Back to normal dev
```

### CI/CD (GitHub Actions)

```yaml
# Don't test PWA features in CI
# Focus on code quality

- name: Typecheck
  run: npm run typecheck

- name: Build (without SW cache issues)
  run: npm run build -w apps/web
```

### Production Deployment (Vercel)

```
Vercel automatically:
1. Disables SW in preview deployments
2. Enables SW in production
3. Handles cache busting on deployments
4. No manual SW cache management needed
```

---

## Part 12: Related Issues and Cross-References

### Similar Issues

- **Turbopack HMR Cache Staleness** (`/docs/solutions/dev-workflow/TURBOPACK_HMR_MODULE_CACHE_STALENESS_PREVENTION.md`)
  - When: Removing imports, switching branches
  - Cause: In-memory module graph in Turbopack
  - Fix: `npm run dev:fresh`

- **HTTP Browser Cache**
  - When: Hard refresh sometimes helps
  - Cause: Browser HTTP cache
  - Fix: `Cmd+Shift+R` or DevTools "Disable Cache"

### Relationship to Other Systems

| System           | Cause                            | Fix                          |
| ---------------- | -------------------------------- | ---------------------------- |
| Service Worker   | Aggressive bundle caching        | Unregister or disable in dev |
| Turbopack HMR    | Stale module graph               | `npm run dev:fresh`          |
| HTTP Cache       | Browser HTTP cache               | Hard refresh                 |
| React StrictMode | Intentional double-renders (dev) | Normal (not an issue)        |
| Next.js ISR      | Revalidation delays              | Expected (production only)   |

---

## Part 13: When to Escalate

**You've tried everything and it's still broken?**

```bash
# Step 1: Verify it's not a real code error
npm run typecheck

# Step 2: Check for circular dependencies
npx madge --circular apps/web/src

# Step 3: Verify module exports are correct
grep -r "export.*Button" apps/web/src

# Step 4: Check git diff for accidental changes
git diff apps/web/src

# If all clear: escalate as real bug
# (not SW cache issue)
```

---

## Part 14: Key Insight

**Service Worker cache issues are:**

- Easy to diagnose (hard refresh fixes)
- Easy to prevent (disable in dev)
- Easy to fix (unregister SW)
- Very deceptive (errors look real)

**The cost/benefit:**

- Prevention cost: 30 seconds setup (disable SW in dev)
- Prevention benefit: Zero SW cache incidents
- Debugging cost: 15-20 minutes per incident
- ROI: 100x positive if prevents even 1 incident

**Best practice:** Disable Service Worker in development, enable only for production offline testing.

---

## Summary Table

| Aspect          | Quick Fix             | Best Practice              | Prevention                  |
| --------------- | --------------------- | -------------------------- | --------------------------- |
| **Recognition** | Hard refresh fixes it | Check server log + console | Unregister SW               |
| **Quick Fix**   | Cmd+Shift+R           | DevTools Unregister        | npm run dev:no-sw           |
| **Setup**       | None                  | 10 seconds                 | 30 seconds (next.config.js) |
| **Time to Fix** | 5 seconds             | 10 seconds                 | 0 (never occurs)            |
| **Confidence**  | 80%                   | 95%                        | 100%                        |

---

## Related Documentation

- **Turbopack HMR Issues:** `/docs/solutions/dev-workflow/TURBOPACK_HMR_MODULE_CACHE_STALENESS_PREVENTION.md`
- **Next.js Development:** `/apps/web/README.md`
- **Browser DevTools:** Chrome DevTools Application tab docs
- **Service Workers:** MDN Web Docs Service Worker API

---

## Key Differences: Service Worker vs Turbopack Cache

| Aspect             | Service Worker Cache                  | Turbopack HMR Cache            |
| ------------------ | ------------------------------------- | ------------------------------ |
| **Location**       | Browser (registered SW)               | Development server (in-memory) |
| **Cause**          | PWA offline support                   | Module graph tracking          |
| **Triggered by**   | Removing imports, build mode switches | Same as Turbopack              |
| **Fix: Level 1**   | Hard refresh                          | Hard refresh                   |
| **Fix: Level 2**   | Unregister SW                         | Dev cache clear                |
| **Prevention**     | Disable in dev                        | Clear on branch switch         |
| **Persistence**    | Survives browser cache clear          | Clears on dev restart          |
| **Error symptoms** | "Element type invalid"                | "Module factory not available" |

---

**Version:** 1.0
**Last Updated:** 2026-01-05
**Status:** Active (reference this document when SW cache issues occur)

---

## Implementation Checklist

Use this when implementing the prevention strategies:

- [ ] Review existing `next.config.js` for PWA configuration
- [ ] Add `DISABLE_SW=true` configuration for development mode
- [ ] Update `apps/web/package.json` scripts with `dev:no-sw`
- [ ] Add `clearSWCache()` helper to development middleware
- [ ] Test hard refresh behavior (should clear both caches)
- [ ] Test SW unregister via DevTools
- [ ] Verify TypeScript errors are caught (run `npm run typecheck`)
- [ ] Document in team onboarding: "disable SW in dev"
- [ ] Add this document link to dev setup guide
- [ ] Test production build separately (with SW enabled)
