# Turbopack HMR Quick Reference

**Print this and keep it handy during refactoring!**

---

## Quick Fix Matrix

| You See This                            | Do This                                 | Works? |
| --------------------------------------- | --------------------------------------- | ------ |
| "Something went sideways" in browser    | `Cmd+Shift+R` (hard refresh)            | 80%    |
| Browser won't load after import removal | `cd apps/web && npm run dev:fresh`      | 95%    |
| ENOENT: app-build-manifest.json         | `rm -rf .next && npm run dev`           | 100%   |
| Errors after branch switch              | `cd apps/web && npm run dev:fresh`      | 99%    |
| HMR updates but nothing changes         | Try hard refresh, then cache clear      | 95%    |
| Still broken                            | `pkill -9 -f node && npm run dev:fresh` | 99%+   |

---

## Most Common Causes

```
After removing imports?
  → Hard refresh

After npm run build?
  → rm -rf .next && npm run dev

After branch switch?
  → npm run dev:fresh

After git pull?
  → npm run dev:fresh

Still broken?
  → Clear everything: pkill -9 -f node
```

---

## One-Liner Fixes

```bash
# Browser cache issue
Cmd+Shift+R

# Dev server cache issue
cd apps/web && npm run dev:fresh

# Clear everything
pkill -9 -f node && rm -rf apps/web/.next apps/web/.turbo && npm run dev
```

---

## Prevention Checklist

Before refactoring:

- [ ] Know you're removing imports (cache risk)
- [ ] Use incognito browser window
- [ ] Have hard refresh shortcut ready (Cmd+Shift+R)
- [ ] Know npm run dev:fresh exists

After branch switch:

- [ ] Run `npm install`
- [ ] Run `npm run dev:fresh`
- [ ] Don't just `npm run dev` (old cache may exist)

---

## Prevention is Faster Than Recovery

| Action                            | Time  | Benefit              |
| --------------------------------- | ----- | -------------------- |
| Proactive clear after git switch  | 5s    | Prevents 10min debug |
| Proactive clear after npm install | 5s    | Prevents 10min debug |
| Hard refresh when error appears   | 5s    | Fixes 80% of issues  |
| React to error, debug, then clear | 15min | WAY slower           |

**Key:** Clear caches when you know they might be stale, not after the error.

---

## Keyboard Shortcuts

**macOS:**

```
Cmd+Shift+R   - Hard refresh
Cmd+Option+I  - Open DevTools
```

**Windows/Linux:**

```
Ctrl+Shift+R  - Hard refresh
F12           - Open DevTools
```

---

## Browser DevTools Setup (Do Once)

1. Open DevTools (F12 or Cmd+Option+I)
2. Settings (⚙️ icon, usually top right)
3. Network → Check "Disable cache (while DevTools open)"
4. Application → Clear Site Data button
5. Leave DevTools open during development

**Why:** Prevents browser from serving stale modules

---

## One Page Mental Model

```
My app broke, why?
  │
  ├─ Dev server has errors?
  │  └─ Read terminal output
  │
  └─ Dev server is fine, browser broken?
     │
     ├─ Just removed imports?
     │  └─ npm run dev:fresh
     │
     ├─ Just switched branches?
     │  └─ npm run dev:fresh
     │
     └─ Just ran npm run build?
        └─ rm -rf .next && npm run dev
```

---

## Emergency Eject Button

If you have no idea what happened:

```bash
# 1. Kill everything
pkill -9 -f node

# 2. Clear everything
cd apps/web && rm -rf .next .turbo node_modules/.cache

# 3. Start fresh
npm run dev

# 4. If still broken, start in incognito window
```

Time: 20 seconds
Success rate: 99%+

---

**Hang this above your monitor during development!**

See full guide: `docs/solutions/dev-workflow/TURBOPACK_HMR_MODULE_CACHE_STALENESS_PREVENTION.md`
