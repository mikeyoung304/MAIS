# Service Worker Cache Issue - Decision Tree

Use this flowchart to quickly diagnose and resolve Service Worker cache issues during development.

---

## Master Decision Tree

```
START: Browser shows component error
│
├─ Question 1: Does hard refresh (Cmd+Shift+R) fix it?
│  │
│  ├─ YES (works after hard refresh)
│  │  └─ Go to Decision: A (Cache Issue)
│  │
│  └─ NO (still broken after hard refresh)
│     └─ Go to Decision: B (Real Code Error)
│
```

---

## Decision A: Cache Issue Detected

**You have: Hard refresh fixes the error**

```
START: Hard refresh fixed it
│
├─ Question 2: Check server logs - Any compilation errors?
│  │
│  ├─ YES (server shows error)
│  │  └─ It's a REAL ERROR masked by old cache
│  │     → Fix the server error first
│  │     → Hard refresh will confirm
│  │
│  └─ NO (server compiled cleanly)
│     └─ Browser has stale code
│        └─ Go to Question 3
│
├─ Question 3: Unregister SW and reload - Does it help?
│  │
│  ├─ YES (fixes the error)
│  │  └─ It's a SERVICE WORKER CACHE issue
│  │     → Use Recovery Strategy A1
│  │
│  └─ NO (still broken)
│     └─ It's HTTP CACHE or deeper issue
│        → Use Recovery Strategy A2
│
```

### Recovery Strategy A1: Service Worker Cache

```
IMMEDIATE FIX (pick one):
├─ Option 1 (Fastest - 10 seconds)
│  └─ DevTools → Application → Service Workers → Unregister
│     → Reload page (Cmd+R)
│
├─ Option 2 (Console - 5 seconds)
│  └─ Paste in DevTools console:
│     navigator.serviceWorker.getRegistrations()
│       .then(r => Promise.all(r.map(x => x.unregister())))
│       .then(() => location.reload());
│
├─ Option 3 (Dev script - 20 seconds)
│  └─ Ctrl+C (stop dev server)
│     npm run dev:fresh
│
└─ PERMANENT PREVENTION
   └─ Add to next.config.js:
      ...(process.env.NODE_ENV === 'development' && {
        pwa: { disabled: true },
      })

      Result: Zero SW cache issues in dev
```

### Recovery Strategy A2: HTTP Cache or Other Cache Layer

```
IMMEDIATE FIX (pick one):
├─ Option 1 (Fastest - 5 seconds)
│  └─ Cmd+Option+I (Mac) or F12 (Windows)
│     → Network tab
│     → ☑ Check "Disable cache"
│     → Reload (Cmd+R)
│
├─ Option 2 (DevTools - 15 seconds)
│  └─ DevTools → Application → Clear Site Data
│     → Wait for completion
│     → Reload (Cmd+R)
│
├─ Option 3 (Nuclear - 20 seconds)
│  └─ Ctrl+C (stop dev)
│     npm run dev:fresh
│     Open in INCOGNITO window (Cmd+Shift+N)
│
└─ PERMANENT PREVENTION
   └─ Keep "Disable Cache" checked in DevTools Network tab
      during development work
```

---

## Decision B: Real Code Error

**You have: Hard refresh does NOT fix the error**

```
START: Hard refresh didn't help
│
├─ Question 4: Check server logs for error messages
│  │
│  ├─ YES (server has error)
│  │  └─ REAL ERROR on server side
│  │     → Read server error message
│  │     → Fix the code that's causing it
│  │
│  └─ NO (server logs clean)
│     └─ Go to Question 5
│
├─ Question 5: Is this error in console.log or React render?
│  │
│  ├─ ERROR IN console.log
│  │  └─ Module isn't being imported correctly
│  │     → Check import path
│  │     → Verify file exists
│  │     → Check TypeScript errors (npm run typecheck)
│  │
│  └─ ERROR IN React render
│     └─ Go to Question 6
│
├─ Question 6: Does the error reference a component you modified?
│  │
│  ├─ YES (error in your recent changes)
│  │  └─ REAL CODE ERROR
│  │     Action Plan:
│  │     1. npm run typecheck (find type errors)
│  │     2. Check component imports
│  │     3. Verify exports exist
│  │     4. Check for circular dependencies:
│  │        npx madge --circular apps/web/src
│  │
│  └─ NO (error in other code)
│     └─ Go to Question 7
│
├─ Question 7: Have you changed dependencies recently?
│  │
│  ├─ YES (npm install, package.json changes)
│  │  └─ DEPENDENCY MISMATCH
│  │     Action Plan:
│  │     1. npm run typecheck
│  │     2. Look for type mismatches in console
│  │     3. May need: rm -rf node_modules && npm install
│  │
│  └─ NO
│     └─ UNKNOWN ERROR
│        → Escalate: Provide server logs + console output
│        → Check CLAUDE.md for debugging patterns
│
```

---

## Quick Diagnostic Checklist

Use this to quickly categorize the issue:

```
┌─────────────────────────────────────────────────────┐
│ SYMPTOM DIAGNOSIS CHECKLIST                         │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Hard refresh fixes it?                             │
│ □ Yes → Cache Issue (Decision A)                  │
│ □ No  → Real Error (Decision B)                   │
│                                                     │
│ If Cache Issue:                                    │
│ □ Unregister SW helps?                            │
│   → Yes: SW Cache (Use A1)                         │
│   → No: HTTP Cache (Use A2)                        │
│                                                     │
│ If Real Error:                                     │
│ □ Server has error?                               │
│   → Yes: Fix server error                          │
│   → No: Check imports/types                        │
│                                                     │
│ □ Error in console.log or render?                 │
│   → console.log: Import path issue                 │
│   → render: Type mismatch or missing export        │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Path by Symptom

### Symptom: "Element type is invalid"

```
This error usually means:
├─ React trying to render something that's not a component
│  → Could be object instead of function
│  → Could be undefined or null
│  → Could be wrong export type

Diagnostics:
├─ Hard refresh helps? YES → Cache Issue (Decision A)
├─ console.log shows correct type? YES → SW cache (A1)
└─ Both say it's wrong? → Real code error (Decision B)

Real code error causes:
├─ Import: { Button } but export: default Button
├─ Import: { Button } but export: export const Button
├─ Circular dependency causing undefined on first load
└─ Wrong file imported (typo in import path)

Fix:
├─ npm run typecheck (shows type mismatches)
├─ Check import/export statements match
└─ Search for the component definition
```

### Symptom: "Cannot read property X of undefined"

```
This error usually means:
├─ Trying to access property of undefined object
│  → Component not imported correctly
│  → Object returned from hook is undefined
│  → Prop not passed correctly

Diagnostics:
├─ Hard refresh helps? YES → Cache Issue (Decision A)
├─ Server compiled OK? YES → Check prop types
└─ Error consistent? YES → Real code error

Real code error causes:
├─ Missing optional chaining (?.)
├─ Hook called outside component or wrong order
├─ Prop not passed to component
└─ Conditional rendering logic wrong

Fix:
├─ Add optional chaining: obj?.property
├─ Move hook to top level of component
├─ Pass required props
└─ Add null checks before accessing properties
```

### Symptom: "Module not found"

```
This error usually means:
├─ File doesn't exist at import path
│  → Wrong filename
│  → Wrong directory
│  → File was deleted
│  → Wrong relative path

Diagnostics:
├─ Hard refresh helps? NO → Not cache (Decision B)
├─ Server compiled OK? NO → This is the issue
└─ Server error matches? YES → Real code error

Real code error causes:
├─ Typo in import path
├─ Changed directory structure
├─ Deleted file but forgot to update imports
└─ Case sensitivity (Linux vs Mac)

Fix:
├─ Verify file exists: ls apps/web/src/path/to/file.tsx
├─ Check path is correct relative to importing file
├─ Verify TypeScript imports resolve: npm run typecheck
└─ Look for typos in filename or path
```

---

## Time Estimates

```
Issue Type         | Detection    | Diagnosis    | Fix      | Total
───────────────────|──────────────|──────────────|──────────|────────
SW Cache           | 5 seconds    | 10 seconds   | 5 sec    | 20 sec
HTTP Cache         | 5 seconds    | 10 seconds   | 10 sec   | 25 sec
Real Code Error    | 5 seconds    | 30 seconds   | 5+ min   | 5+ min
Unknown            | 5 seconds    | 2+ minutes   | 10+ min  | 10+ min
```

---

## When to Escalate

**STOP and escalate if:**

```
Hard refresh + unregister SW = Still broken
AND
Server logs = Clean (no errors)
AND
TypeScript check = Clean (no type errors)
AND
Other pages = Work fine
AND
You haven't changed dependencies recently
```

Then it's likely a deeper issue. Provide:

- Error message from browser console
- Server logs
- Recent changes (git diff)
- Which files were modified

---

## Integration: Use with Other Docs

```
Service Worker Cache Issue
  ↓
Hard refresh fixes it? → YES
  ↓
Refer to: SERVICE_WORKER_CACHE_STALE_BUNDLES_PREVENTION.md
  ↓
Part 5: Quick Recovery Commands

Hard refresh fixes it? → NO
  ↓
Real Code Error
  ↓
Refer to: CLAUDE.md Error Handling Pattern
  ↓
Or: TURBOPACK_HMR_MODULE_CACHE_STALENESS_PREVENTION.md
  (if import removal involved)
```

---

## Quick Navigation Map

```
START HERE: I have an error in development

├─ Does hard refresh fix it?
│  ├─ YES → SERVICE_WORKER_CACHE_STALE_BUNDLES_PREVENTION.md
│  │       (Part 5: Quick Recovery)
│  │
│  └─ NO  → Is server compiling OK?
│     ├─ NO  → Fix server error (check server logs)
│     │
│     └─ YES → Is this a component type error?
│        ├─ YES → npm run typecheck
│        │       Then check imports/exports
│        │
│        └─ NO  → Check specific symptom path above
```

---

## One-Page Printable Version

```
═══════════════════════════════════════════════════════════
SERVICE WORKER CACHE DECISION TREE - QUICK VERSION
═══════════════════════════════════════════════════════════

ERROR IN DEVELOPMENT?
│
Hard refresh (Cmd+Shift+R) fixes it?
├─ YES → CACHE ISSUE
│       Action: Unregister SW (10 sec)
│       → DevTools → Application → Service Workers → Unregister
│       → Reload page
│       Done? YES → Move on
│       Done? NO  → Try npm run dev:fresh
│
└─ NO → REAL CODE ERROR
        Check server logs (terminal where dev runs)
        Any errors? YES → Fix that error
        Any errors? NO  → npm run typecheck

        Find issue? YES → Fix code
        Find issue? NO  → Ask for help with:
                         - Error message
                         - Server logs
                         - git diff output

═══════════════════════════════════════════════════════════
```

---

## Related Decisions

This decision tree works alongside:

- **Turbopack HMR cache**: Similar symptoms, different layer (in-memory module graph vs SW cache)
- **Real code errors**: When decision tree points here, refer to CLAUDE.md error patterns
- **Build failures**: If `npm run build` fails, check different document
- **Type errors**: If TypeScript shows issues, use type checking guides

---

**Version:** 1.0
**Last Updated:** 2026-01-05
**Status:** Ready to use in troubleshooting
