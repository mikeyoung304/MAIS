# Turbopack HMR Recovery Decision Tree

**Use this when your app breaks during development**

---

## START HERE: What Do You See?

```
┌─────────────────────────────────────────────────────────┐
│  Error in Browser or Dev Server?                        │
└─────────────────────────────────────────────────────────┘
                       │
         ┌─────────────┼─────────────┐
         │             │             │
    ┌────▼─────┐  ┌────▼────┐  ┌────▼────┐
    │ Browser  │  │ Dev      │  │ Unsure? │
    │ Error    │  │ Server   │  │         │
    │ (page    │  │ Error    │  │ See all │
    │ won't    │  │ (console)│  │ options │
    │ load)    │  │          │  │         │
    └────┬─────┘  └────┬─────┘  └────┬────┘
         │             │             │
    ┌────┘─────────────┴──────────────┘
    │
    ▼
┌─────────────────────────────────────────────┐
│ Use flowchart below for your situation      │
└─────────────────────────────────────────────┘
```

---

## FLOWCHART 1: Browser Error

**You see: Error in browser console or page won't load**

```
START: Browser Error
  │
  ├─ "Something went sideways"
  │  or generic error message?
  │  │
  │  ├─ YES → Try hard refresh
  │  │        ├─ Works? ✓ Done
  │  │        └─ No? Continue below
  │  │
  │  └─ NO → See error mentions module/import?
  │          ├─ YES → Removed imports recently?
  │          │        └─ YES → npm run dev:fresh
  │          │        └─ NO  → Check next section
  │          └─ NO  → See app-build-manifest error?
  │                   ├─ YES → Just ran build?
  │                   │        ├─ YES → rm -rf .next && npm run dev
  │                   │        └─ NO  → npm run dev:fresh
  │                   └─ NO  → Escalate
```

**Quick Decision:**

| Error                               | Fix                         | Time |
| ----------------------------------- | --------------------------- | ---- |
| Generic / "Something went sideways" | Hard refresh (Cmd+Shift+R)  | 5s   |
| Module factory not available        | npm run dev:fresh           | 5s   |
| app-build-manifest.json ENOENT      | rm -rf .next && npm run dev | 5s   |

---

## FLOWCHART 2: Dev Server Error

**You see: Error in terminal where dev server runs**

```
START: Dev Server Error
  │
  ├─ Compilation errors?
  │  (RED text in terminal)
  │  │
  │  ├─ YES → Read error message!
  │  │        (This is a real bug, not cache)
  │  │        └─ Fix the code
  │  │
  │  └─ NO  → Continue
  │
  ├─ ENOENT / "not found" errors?
  │  │
  │  ├─ YES → app-build-manifest.json?
  │  │        └─ YES → rm -rf .next && npm run dev
  │  │        └─ NO  → Unclear, try npm run dev:fresh
  │  │
  │  └─ NO  → Continue
  │
  ├─ Module or cache related?
  │  │
  │  ├─ YES → npm run dev:fresh
  │  │
  │  └─ NO  → Need more info
```

**Quick Decision:**

| Terminal Error                       | Fix                   | Time   |
| ------------------------------------ | --------------------- | ------ |
| Actual TypeScript/compilation errors | Fix code, npm run dev | varies |
| "cannot find module" / ENOENT        | npm run dev:fresh     | 5s     |
| Turbopack/cache related              | npm run dev:fresh     | 5s     |

---

## FLOWCHART 3: Did You Just Do One of These?

**Use this to find the problem before errors happen**

```
Did you just...
  │
  ├─ Remove imports from a file?
  │  ├─ YES → Check browser for module errors
  │  │        └─ Error? → hard refresh or npm run dev:fresh
  │  │        └─ OK?    → Done! Continue working
  │  │
  │  └─ NO  → Continue
  │
  ├─ Switch git branches?
  │  ├─ YES → npm run dev:fresh
  │  │
  │  └─ NO  → Continue
  │
  ├─ Run npm install?
  │  ├─ YES → npm run dev:fresh
  │  │
  │  └─ NO  → Continue
  │
  ├─ Remove a devDependency?
  │  ├─ YES → npm run dev:fresh
  │  │
  │  └─ NO  → Continue
  │
  ├─ Run npm run build?
  │  ├─ YES → rm -rf .next && npm run dev
  │  │
  │  └─ NO  → Continue
  │
  ├─ Pulled from main?
  │  ├─ YES → npm install && npm run dev:fresh
  │  │
  │  └─ NO  → Continue
  │
  └─ Did none of above?
     └─ Unclear what happened
        └─ See FLOWCHART 4: Nuclear Option
```

---

## FLOWCHART 4: Still Not Working?

```
START: All quick fixes failed
  │
  ├─ Step 1: Kill dev server
  │  └─ Ctrl+C in terminal
  │
  ├─ Step 2: Clear everything
  │  └─ pkill -9 -f node
  │  └─ rm -rf apps/web/.next apps/web/.turbo apps/web/node_modules/.cache
  │
  ├─ Step 3: Restart
  │  └─ npm run dev
  │
  ├─ Step 4: Works now?
  │  ├─ YES ✓ → Done! Problem was caches
  │  │
  │  └─ NO  → Continue to Step 5
  │
  ├─ Step 5: Open Incognito window
  │  └─ Point to http://localhost:3000
  │  └─ Works in incognito?
  │
  │  ├─ YES ✓ → Browser cache issue
  │  │           └─ DevTools → Application → Clear Site Data
  │  │
  │  └─ NO  → Continue to Step 6
  │
  ├─ Step 6: Check terminal output
  │  └─ Any red compilation errors?
  │
  │  ├─ YES → Fix the real bug (this is a code error)
  │  │
  │  └─ NO  → Continue to Step 7
  │
  ├─ Step 7: Last resort
  │  └─ Close all terminals
  │  └─ rm -rf apps/web/node_modules
  │  └─ npm install
  │  └─ npm run dev
  │
  └─ Step 8: If STILL broken
     └─ This is likely a real code error
     └─ Read terminal output carefully
     └─ Run: npm run typecheck
```

---

## FLOWCHART 5: Prevention Checklist

**Do this BEFORE you get errors**

```
About to do refactoring?
  │
  ├─ YES → Prevention Checklist
  │        ├─ [ ] Open incognito window
  │        ├─ [ ] Start fresh dev server
  │        ├─ [ ] Plan to remove imports
  │        ├─ [ ] Have Cmd+Shift+R shortcut ready
  │        ├─ [ ] Know npm run dev:fresh exists
  │        └─ [ ] Start coding
  │
  └─ NO  → Do you need to:
           ├─ Switch branches?
           │  └─ Always: npm run dev:fresh after
           ├─ Run npm install?
           │  └─ Always: npm run dev:fresh after
           ├─ Run npm run build?
           │  └─ Always: rm -rf .next afterward
           └─ Other?
              └─ You're probably fine, continue
```

---

## MASTER DECISION TABLE

**Pin this to your monitor!**

| Situation               | First Try                   | Second Try           | Last Resort         |
| ----------------------- | --------------------------- | -------------------- | ------------------- |
| Generic browser error   | Hard refresh                | npm run dev:fresh    | Browser cache clear |
| Module not found        | npm run dev:fresh           | kill + clear         | Incognito window    |
| After build mode switch | rm -rf .next && npm run dev | npm run dev:fresh    | pkill + nuclear     |
| After branch switch     | npm run dev:fresh           | npm install && retry | pkill + nuclear     |
| After import removal    | Hard refresh                | npm run dev:fresh    | pkill + nuclear     |
| Terminal ENOENT         | rm -rf .next && npm run dev | npm run dev:fresh    | pkill + nuclear     |
| Slow HMR                | npm run dev:fresh           | Check console        | pkill + nuclear     |
| Still broken            | Read terminal               | npm run typecheck    | Real bug?           |

---

## KEYBOARD SHORTCUTS (Bookmark These)

```
BROWSER:
├─ Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
├─ Clear cache: DevTools → Application → "Clear Site Data"
└─ Incognito: Cmd+Shift+N (Mac) or Ctrl+Shift+N (Windows)

TERMINAL:
├─ Kill dev server: Ctrl+C
├─ Kill all node: pkill -9 -f node
└─ Clear + restart: npm run dev:fresh

VSCODE:
├─ TypeScript errors: npm run typecheck
├─ Kill terminal: Ctrl+Shift+P → "Terminal: Kill Terminal"
└─ Restart TS server: Cmd+Shift+P → "TypeScript: Restart TS Server"
```

---

## PATTERN RECOGNITION

**You can often tell what went wrong without flowchart:**

| You Just Did This     | What Probably Happened                 |
| --------------------- | -------------------------------------- |
| Removed imports       | Module graph stale in HMR              |
| Switched branches     | Old .next folder incompatible          |
| Ran npm install       | Packages changed, old cache invalid    |
| Ran npm run build     | Production .next incompatible with dev |
| Git pull              | Dependencies might have changed        |
| Ran npm run typecheck | TypeScript cache might be stale        |

**Quick pattern response:**

- Import removal → `npm run dev:fresh` or hard refresh
- Branch/package change → `npm run dev:fresh`
- Build mode switch → `rm -rf .next && npm run dev`
- Multiple issues → `pkill -9 -f node && npm run dev:fresh`

---

## TIME ESTIMATES

**What takes how long:**

| Action                        | Time          |
| ----------------------------- | ------------- |
| Hard refresh                  | 5 seconds     |
| npm run dev:fresh             | 5 seconds     |
| rm -rf .next && restart       | 10 seconds    |
| pkill + full clear + restart  | 20 seconds    |
| Actual debugging (wrong path) | 15-20 minutes |

**Key insight:** Prevention (5s) + recovery (20s) is way faster than debugging.

---

## Red Flags (Acts as Error Message Translator)

| Error Message                     | Probably Means                          |
| --------------------------------- | --------------------------------------- |
| "Something went sideways"         | Cache issue, try refresh                |
| "module factory is not available" | Removed import cache stale              |
| "ENOENT: app-build-manifest"      | Wrong .next structure (build vs dev)    |
| "Cannot find module X"            | Old cache references removed module     |
| "Hydration mismatch"              | Browser/server module graph out of sync |
| "DevTools not connected"          | Service worker cache interference       |

---

## Common Mistakes (And How to Avoid Them)

```
❌ Running npm run dev after npm run build
   ✓ Always clear: rm -rf .next

❌ Not clearing .next after branch switch
   ✓ Always: npm run dev:fresh after checkout

❌ Debugging HMR error for 15 minutes
   ✓ Quick fix first (refresh/clear), debug later

❌ Forgetting hard refresh keyboard shortcut
   ✓ Write it on a sticky note on monitor

❌ Assuming code is broken, when it's just cache
   ✓ Always clear cache before debugging code
```

---

## When to Stop and Think

**You should escalate if:**

1. `npm run typecheck` shows errors
2. Terminal shows actual compilation errors (red text)
3. Problem persists after `pkill -9 -f node && npm run dev:fresh`
4. Error messages mention actual code issues, not module/cache
5. Problem happens in production deploy

**These are real bugs, not cache issues.**

---

## Success Criteria

**You're done when:**

- [ ] App loads in browser
- [ ] No "Something went sideways" message
- [ ] No errors in browser console (except maybe third-party)
- [ ] No red errors in terminal
- [ ] Hot refresh (Cmd+S in editor) updates page in browser
- [ ] Page stays loaded during navigation

If all above are true, **you're good!**

---

## Copy-Paste Quick Commands

```bash
# Hard refresh (run in browser)
Cmd+Shift+R

# Clear dev cache and restart
cd apps/web && npm run dev:fresh

# If that doesn't work
pkill -9 -f node
rm -rf apps/web/.next apps/web/.turbo apps/web/node_modules/.cache
npm run dev

# Check for real errors
npm run typecheck

# If switching branches
git checkout new-branch
npm install
npm run dev:fresh
```

---

**Print this. Pin it above your monitor. Reference it when HMR breaks.**

_Most problems resolve in 5-20 seconds with the right decision._
