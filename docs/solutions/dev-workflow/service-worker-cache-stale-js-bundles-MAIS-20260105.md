# Service Worker Cache Serving Stale JavaScript Bundles

**Date:** 2026-01-05
**Severity:** P1 (appears as "component undefined" but is recoverable)
**Category:** Development Environment / Build Mode

## Problem

React "Element type is invalid: undefined" error in Build Mode, caused by Service Worker serving stale cached JavaScript bundles.

Even after:

- Clearing `.next` directory with `rm -rf .next`
- Restarting dev server with `npm run dev`
- Browser refresh (F5 or Cmd+R)
- Hard refresh (Cmd+Shift+R or Ctrl+Shift+R)

The Service Worker continues to serve old cached code, making it appear that components are undefined when they actually exist in the latest code.

```
Error: Element type is invalid: undefined. You likely forgot to export your component.

at renderWithHooks (.../react-dom/cjs/react-dom.development.js:...)
```

## Root Cause

Next.js PWA Service Workers aggressively cache JavaScript bundles at install time. The Service Worker:

1. Intercepts all network requests
2. Returns cached JS bundles before checking if they're stale
3. Lives independently of the dev server state
4. Is **NOT** cleared when you delete `.next` or restart the server

When you change code and restart the dev server:

- New bundles are generated with updated component exports
- Service Worker still serves the old cached versions
- Browser receives old code that references deleted/renamed components
- React can't find the component definition → "undefined" error

The Service Worker treats cache as source-of-truth, not the dev server.

## Solution

### Quick Fix (Local Development)

**Unregister all Service Workers + clear all browser caches:**

1. Open browser DevTools (F12)
2. Paste this in the console:

```javascript
async function clearAllCaches() {
  // Unregister all Service Workers
  const regs = await navigator.serviceWorker.getRegistrations();
  for (const r of regs) await r.unregister();

  // Clear Cache API
  const names = await caches.keys();
  for (const n of names) await caches.delete(n);

  // Clear browser storage
  localStorage.clear();
  sessionStorage.clear();

  // Force full refresh
  location.reload(true);
}
clearAllCaches();
```

3. Wait for console to finish (should see "undefined" or completed message)
4. Page will reload automatically
5. If still broken, close the browser tab completely and reopen

### Full Recovery (If Quick Fix Doesn't Work)

```bash
# Kill dev server
pkill -f "next dev" 2>/dev/null

# Delete all Next.js caches
cd apps/web && rm -rf .next .turbo node_modules/.cache

# Restart dev server
npm run dev

# Then run console script above in browser
```

### Complete Nuclear Option

```bash
# Kill all node processes
pkill -9 -f node

# Delete everything
cd apps/web && rm -rf .next .turbo node_modules/.cache

# Clear system DNS cache (Mac)
dscacheutil -flushcache

# Restart
npm run dev
```

Then run the Service Worker unregistration script in browser console.

## Prevention

### Disable PWA in Development (Recommended)

Check `apps/web/next.config.js` and ensure PWA is disabled during `npm run dev`:

```javascript
// next.config.js
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development', // PWA off during dev
  // ... other config
});
```

If PWA is enabled in development, consider disabling it:

```javascript
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: true, // Disable until you need PWA testing
});
```

### Manual Service Worker Management

Add this to your dev workflow script:

```bash
#!/bin/bash
# scripts/dev-fresh.sh
# Clear caches and start dev server with PWA workarounds

cd apps/web
rm -rf .next .turbo node_modules/.cache
npm run dev &
echo "Dev server starting. Once ready, run this in browser console:"
echo ""
echo "async function clearSWs() {"
echo "  const regs = await navigator.serviceWorker.getRegistrations();"
echo "  for (const r of regs) await r.unregister();"
echo "  location.reload(true);"
echo "}"
echo "clearSWs();"
```

Then add to `apps/web/package.json`:

```json
{
  "scripts": {
    "dev:fresh": "bash ../../scripts/dev-fresh.sh",
    "dev": "next dev --turbo"
  }
}
```

Usage: `npm run dev:fresh` instead of `npm run dev`

## Detection

Signs this is the Service Worker cache issue:

- Component worked before, suddenly "Element type is invalid: undefined"
- You recently made UI changes or added/removed components
- Hard refresh (Cmd+Shift+R) doesn't fix it
- Dev server shows no errors in terminal
- Network tab shows old bundle dates (check `bundle.js` Last-Modified header)
- Chrome DevTools → Application → Service Workers shows active SWs

## Why This Is Tricky to Diagnose

1. **Invisible to the dev server:** The server has the correct code, but SW blocks all requests
2. **Survives dev restarts:** Deleting `.next` doesn't touch Service Workers
3. **Survives browser refresh:** SW intercepts refresh requests too
4. **Looks like a code error:** "Element type is invalid" looks like a React problem, not a caching problem
5. **Intermittent across tabs:** One tab might have old cache, another might work fine
6. **Cross-tab persistence:** SWs persist across all tabs of the same domain

The real issue (SW serving old code) is completely hidden from view.

## Related Issues

**Turbopack HMR Cache Conflicts:** Different from this issue, but similar symptoms:

- See `turbopack-hmr-cache-conflict-after-production-build-MAIS-20260102.md`
- Turbopack cache is file-based and cleared with `rm -rf .next`
- Service Worker cache is browser-based and requires unregistration

**Browser Storage Issues:** If CSS/layout looks wrong:

- localStorage/sessionStorage may contain stale config
- Clear with `localStorage.clear()` and `sessionStorage.clear()`
- Already included in the `clearAllCaches()` script above

## Key Insight

Service Workers are **isolated from the dev server state**. Restarting the dev server, clearing `.next`, or refreshing the browser does not unregister Service Workers or clear their caches. You must explicitly unregister SWs and clear the Cache API through the browser console.

**Rule:** If a Build Mode change doesn't appear after restarting, suspect the Service Worker before blaming your code.

## References

- MDN Service Worker API: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
- next-pwa configuration: https://github.com/shadowwalker/next-pwa
- Chrome DevTools Service Workers: https://developer.chrome.com/docs/devtools/service-workers/
- Commit that revealed this issue: `0f2f01ab` (Build Mode storefront editor)
