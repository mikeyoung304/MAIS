# Service Worker Cache Stale Bundles - Quick Reference

**TL;DR:** If hard refresh (Cmd+Shift+R) fixes an error in development, it's Service Worker cache staleness. Unregister the SW and reload.

---

## Instant Diagnosis (30 seconds)

```
Error in React component? YES
      ↓
Server log clean?       YES  →  Browser has stale code
      ↓
Hard refresh helps?     YES  →  It's a cache issue
      ↓
DevTools → Unregister SW  →  Fixed? Then SW cache confirmed
```

---

## One-Line Fixes

### Option 1: Hard Refresh (5 seconds)

```bash
Cmd+Shift+R  (Mac)
Ctrl+Shift+R (Windows)
```

### Option 2: Unregister Service Worker (10 seconds)

```
DevTools → Application → Service Workers → Unregister → Reload
```

### Option 3: Console Script (5 seconds)

```javascript
// Paste in DevTools console:
navigator.serviceWorker
  .getRegistrations()
  .then((r) => Promise.all(r.map((x) => x.unregister())))
  .then(() => caches.keys())
  .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
  .then(() => location.reload());
```

### Option 4: Kill & Restart (20 seconds)

```bash
Ctrl+C                                  # Stop dev server
cd apps/web && rm -rf .next .turbo      # Clear caches
npm run dev                             # Restart
```

---

## Prevention Scripts

### Option A: Disable SW in Development (BEST)

Add to `next.config.js`:

```javascript
...(process.env.NODE_ENV === 'development' && {
  pwa: { disabled: true },  // No SW cache issues in dev
})
```

### Option B: Add npm scripts

```json
{
  "scripts": {
    "dev": "next dev --turbo --port 3000",
    "dev:fresh": "rm -rf .next .turbo node_modules/.cache && npm run dev",
    "dev:no-sw": "DISABLE_SW=true npm run dev"
  }
}
```

Then use:

```bash
npm run dev:no-sw  # Fastest dev iteration
```

### Option C: Add Console Helper

In your dev middleware, add:

```typescript
if (process.env.NODE_ENV === 'development') {
  if (typeof window !== 'undefined') {
    (window as any).clearSWCache = async () => {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
      const caches_list = await caches.keys();
      await Promise.all(caches_list.map((c) => caches.delete(c)));
      console.log('✓ SW cache cleared');
    };
  }
}
```

Then use:

```javascript
// In DevTools console:
await window.clearSWCache();
location.reload();
```

---

## Red Flags

Combination that points to **SW cache staleness:**

- ✗ Error: "Element type is invalid" or "Cannot read property"
- ✓ Server compiled successfully
- ✓ Hard refresh fixes it (temporarily)
- ✓ `console.log()` shows correct values
- ✓ Network shows 304 (cached) or 200
- ✓ Error goes away after unregistering SW

---

## DevTools Configuration (One Time Setup)

```
Network tab:
  ☑ "Disable Cache" (checked)

Application tab:
  Service Workers
  ☐ "Update on Reload" (unchecked)
  ☐ "Offline" (unchecked)

Console:
  Clear site data after major refactoring
```

---

## Common Patterns

### Pattern A: After Removing Imports

```bash
# You removed an import
# Server recompiled: ✓
# Browser still has old bundle with that import
# Solution: Hard refresh or unregister SW
```

### Pattern B: After Branch Switch

```bash
git checkout feature/new
npm install
cd apps/web && rm -rf .next .turbo && npm run dev
```

### Pattern C: After `npm run build`

```bash
npm run build          # Production build
npm run dev            # Back to dev
# Solution: rm -rf apps/web/.next && npm run dev
```

---

## Comparison: Real Error vs SW Cache

| Indicator             | Real Error | SW Cache |
| --------------------- | ---------- | -------- |
| Server logs error     | ✓          | ✗        |
| Hard refresh helps    | ✗          | ✓        |
| `console.log` correct | ✗          | ✓        |
| Unregister SW helps   | ✗          | ✓        |
| Same error always     | ✓          | ✗        |

---

## Cost/Benefit

| Action          | Time      | Benefit         |
| --------------- | --------- | --------------- |
| Hard refresh    | 5s        | 60% success     |
| Unregister SW   | 10s       | 95% success     |
| Clear + restart | 20s       | 99% success     |
| Disable in dev  | 30s setup | 100% prevention |

---

## Decision: When to Investigate Further

**Stop here and investigate real code issue if:**

```
Hard refresh + unregister SW = Still broken
AND
Server logs show errors
AND
Other pages work fine
```

Then: Real code error, not SW cache. Check your React component imports and types.

---

## Links

- **Full guide:** `/docs/solutions/dev-workflow/SERVICE_WORKER_CACHE_STALE_BUNDLES_PREVENTION.md`
- **Turbopack cache issues:** `/docs/solutions/dev-workflow/TURBOPACK_HMR_MODULE_CACHE_STALENESS_PREVENTION.md`
- **Next.js setup:** `/apps/web/README.md`
