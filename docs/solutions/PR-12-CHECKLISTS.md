---
title: PR #12 Prevention - Code Review & Pre-commit Checklists
category: prevention
tags: [checklists, code-review, pre-commit, react-hooks, accessibility]
priority: P0
---

# PR #12 Prevention - Checklists

Ready-to-use checklists for preventing PR #12 issues.

---

## Pre-commit Checklist (Developer)

Use this before pushing your code to catch issues locally.

```markdown
## React Hooks & Accessibility Pre-commit Checklist

### 1. React Hooks Quality
- [ ] All callbacks passed to child components wrapped in `useCallback`
  - Search: `rg 'const handle\w+ = ' --type tsx`
  - Verify: All have `useCallback` wrapper

- [ ] All `useCallback` have complete dependency array
  - No missing dependencies warnings in ESLint
  - Run: `npm run lint 2>&1 | grep exhaustive-deps`

- [ ] All functions called in `useEffect` are in dependency array
  - Check: Every `loadData()` call has `loadData` in dependencies
  - Run: `npm run lint --fix`

- [ ] No ESLint `react-hooks` errors
  - Run: `npm run lint client`
  - Fix: `npm run lint -- --fix` if available

### 2. Keyboard Accessibility (WCAG 2.4.7)
- [ ] Tab through component with keyboard only
  - Every interactive element shows focus ring
  - Focus order is logical
  - No focus traps

- [ ] All interactive elements have `focus-visible:ring-*` classes
  - Search: `rg '<(button|input|a|summary|select)' client/src/features --type tsx`
  - Verify: All include `focus-visible:` classes
  - Required classes:
    - `focus:outline-none`
    - `focus-visible:ring-2`
    - `focus-visible:ring-{color}`
    - `focus-visible:ring-offset-2`

- [ ] Focus ring color meets contrast requirements
  - Use: https://webaim.org/resources/contrastchecker/
  - Minimum: 3:1 contrast ratio

### 3. Visual State Indicators (WCAG 1.3.1)
- [ ] All collapsible sections have state indicator icons
  - Search: `rg '<details' client/src --type tsx -A 3`
  - Verify: Contains `ChevronRight`, `ChevronDown`, or similar icon

- [ ] Icons rotate/animate on state change
  - Verify: Icon has `group-open:` or `details[open]` styling
  - Check: `transition-transform duration-200` present
  - Visual test: Open/close accordion, icon rotates smoothly

- [ ] Icon color uses design system
  - Not hardcoded hex/rgb values
  - Uses Tailwind utility: `text-sage`, `text-blue-500`, etc.

- [ ] Icon size is appropriate
  - Standard: `w-5 h-5` (20px)
  - Mobile-friendly on smaller screens

### 4. Event Handling
- [ ] Button clicks inside nested interactive elements work correctly
  - Test: Click button inside accordion → button action only
  - Test: Click accordion header → accordion toggles
  - Never both actions at once

- [ ] All buttons in `<summary>` wrapped with `onClick={e => e.stopPropagation()}`
  - Search: `rg '<summary' client/src --type tsx -A 10 | rg '<Button'`
  - Verify: Button container has `onClick={e => e.stopPropagation()}`

- [ ] No unintended event bubbling
  - Search: `rg 'onClick=' client/src --type tsx | rg -v 'stopPropagation'`
  - Review any matches in nested interactive contexts

### 5. Testing
- [ ] Component renders without errors
  - Run: `npm run dev:client` and load page
  - Check: Console has no errors (red text)

- [ ] All functionality works without mouse
  - Test: Navigate with Tab key only
  - Test: Use Space/Enter to activate buttons
  - Test: Arrow keys work for select/radio elements

- [ ] No console warnings
  - Check: Browser DevTools console is clean
  - React warnings about missing dependencies indicate hooks issues

- [ ] Responsive design works on mobile
  - Test: iPhone 12 Pro (390x844)
  - Test: iPad (1024x1366)
  - Verify: Layout doesn't break, focus ring visible, icon size appropriate

### 6. Code Quality
- [ ] TypeScript passes
  - Run: `npm run typecheck`
  - No type errors allowed

- [ ] ESLint passes
  - Run: `npm run lint client`
  - No errors (only warnings allowed if documented)

- [ ] Code is formatted
  - Run: `npm run format:check`
  - Fix: `npm run format`

- [ ] No performance regressions
  - Check: React DevTools Profiler
  - Watch: No unnecessary re-renders of child components

### 7. Final Checks
- [ ] Commit message mentions PR #12 issues if applicable
- [ ] Changes are minimal and focused
- [ ] No debug code or commented-out console.logs
- [ ] No hard-coded test data

**Status:** Ready to commit if all boxes checked ✅
```

---

## Code Review Checklist (Reviewer)

Use this when reviewing PRs to catch issues before merge.

```markdown
## React Hooks & Accessibility Code Review Checklist

### Phase 1: Quick Scan (5 minutes)

- [ ] Search for `useCallback` in changed files
  - Run: `git diff HEAD~ | grep 'useCallback'`
  - Count how many callbacks were added
  - Count how many child components receive callbacks
  - Should have similar numbers

- [ ] Search for `useEffect` in changed files
  - Run: `git diff HEAD~ | grep 'useEffect'`
  - For each one, verify dependency array is present
  - No `useEffect(() => { ... }, )`  without array

- [ ] Search for focus indicators
  - Run: `git diff HEAD~ | grep 'focus'`
  - For new interactive elements, should see focus classes
  - If new `<button>`, `<input>`, `<summary>` → should have focus classes

- [ ] Look for state indicators in accordions
  - Run: `git diff HEAD~ | grep 'Chevron'`
  - For new `<details>` elements, should see rotating icons

### Phase 2: Detailed Review (15 minutes)

**Check #1: useCallback Completeness**

```typescript
// Review each component that accepts callback props
- Does it receive callbacks from parent? (onEdit, onClick, etc.)
- Are those callbacks wrapped in useCallback in parent?
- Are useCallback dependencies complete?

// Red flags:
❌ const handleEdit = () => { ... };  // No useCallback!
❌ useCallback(async () => { ... }, []);  // Maybe missing deps?
❌ useCallback(..., [oneFunc]);  // But uses two functions?
```

**Check #2: useEffect Dependencies**

```typescript
// For each useEffect in diff:
- List all functions called inside
- Check if all are in dependency array
- Check if all are wrapped in useCallback

// Red flags:
❌ useEffect(() => { loadData(); }, [])
❌ useEffect(() => { if(x) loadData(); }, [x])  // loadData missing!
❌ useEffect(() => { doTask(); }, [someUnrelatedVar])
```

**Check #3: Keyboard Accessibility**

```typescript
// For each interactive element:
<button>     → has focus-visible:ring-* ?
<input>      → has focus:ring-* ?
<a>          → has focus-visible:ring-* ?
<summary>    → has focus-visible:ring-* ?
<select>     → has focus:ring-* ?

// Red flags:
❌ <button className="hover:bg-blue" />  // No focus ring!
❌ <summary>  <!-- hover only, keyboard users can't see focus -->
❌ <div onClick={...}>  <!-- Keyboard inaccessible -->
```

**Check #4: State Indicators**

```typescript
// For each <details> element:
- Has class="group"?
- Has child with rotating icon?
- Icon has group-open:rotate-90 or similar?
- Icon has transition-transform?

// Red flags:
❌ <details>  <!-- No group class, no icon -->
❌ <details className="group">
     <summary>Title</summary>  <!-- No icon! -->
❌ <ChevronRight />  <!-- Icon but no rotation -->
```

**Check #5: Event Handling**

```typescript
// For each <Button> or <button> inside <summary>:
- Is it inside a container with onClick={e => e.stopPropagation()}?
- Or does the button itself call stopPropagation()?

// Red flags:
❌ <summary>
     <Button onClick={handleDelete}>Delete</Button>
     <!-- Clicking deletes AND toggles accordion! -->

✅ <summary>
     <div onClick={e => e.stopPropagation()}>
       <Button onClick={handleDelete}>Delete</Button>
     </div>
```

### Phase 3: Testing Review (10 minutes)

**Automated Tests:**
- [ ] All tests pass: `npm test`
- [ ] No new ESLint errors: `npm run lint`
- [ ] TypeScript checks: `npm run typecheck`

**Manual Testing (Have them provide evidence):**
- [ ] Keyboard navigation test results
  - Can navigate entire component with Tab key
  - Focus is always visible
  - No focus traps

- [ ] Accessibility test results
  - Screen reader test (optional but appreciated)
  - Lighthouse accessibility score >= 90
  - WAVE browser extension shows no errors

**Functional Testing:**
- [ ] All buttons/forms work correctly
- [ ] Accordion open/close works
- [ ] State persists correctly
- [ ] No console errors or warnings

### Phase 4: Checklist & Approval

```markdown
## Final Assessment

**Hooks Quality:**
- [ ] All callbacks wrapped in useCallback
- [ ] All dependencies complete (no ESLint warnings)
- [ ] No missing useEffect dependencies

**Accessibility (WCAG):**
- [ ] Focus indicators on all interactive elements
- [ ] Focus indicators meet contrast requirements
- [ ] State indicators on collapsibles
- [ ] No event propagation issues

**Testing:**
- [ ] Unit/integration tests added
- [ ] Keyboard navigation tested
- [ ] No console errors
- [ ] No performance regressions

**Code Quality:**
- [ ] TypeScript passes
- [ ] ESLint passes
- [ ] Code formatted
- [ ] Comments where needed

**Decision:**
- [ ] Approve & merge
- [ ] Request changes (specify below)
- [ ] Request review from accessibility specialist

**If requesting changes:**
- [ ] Issue #1: [specific feedback]
- [ ] Issue #2: [specific feedback]
```

---

## Common Review Comments

Copy-paste these when you find issues:

### Issue: Missing useCallback
```markdown
**Issue:** Callback not wrapped in useCallback

**Problem:** The `handleEdit` callback is passed to a child component but
isn't wrapped in useCallback. This creates a new function reference on every
render, defeating memoization.

**Fix:**
```typescript
// BEFORE
const handleEdit = async (pkg) => { ... };

// AFTER
const handleEdit = useCallback(async (pkg) => { ... }, [deps]);
```

**ESLint should catch this.** Run: `npm run lint`
```

### Issue: Missing useEffect Dependency
```markdown
**Issue:** useEffect missing dependency

**Problem:** `loadData()` is called in useEffect but not in the dependency array.
This causes ESLint errors and risks stale closures.

**Fix:**
1. First, wrap `loadData` in useCallback
2. Then add to useEffect dependency array: `[loadData]`

**Related:** #120 in PR #12
```

### Issue: No Focus Indicator
```markdown
**Issue:** No keyboard focus indicator

**Problem:** This interactive element has no visible focus ring when using Tab key.
This violates WCAG 2.4.7 (Focus Visible) and excludes keyboard users.

**Fix:** Add focus classes to element:
```typescript
// ADD these classes:
focus:outline-none
focus-visible:ring-2
focus-visible:ring-sage
focus-visible:ring-offset-2
```

**Test:** Tab to this element, you should see a colored ring.

**Related:** #122 in PR #12
```

### Issue: No State Indicator
```markdown
**Issue:** No visual indicator for accordion state

**Problem:** Users can't tell if accordion is open or closed. Adding a
rotating icon shows state and improves UX significantly.

**Fix:**
1. Add `className="group"` to `<details>` element
2. Add rotating `ChevronRight` icon to `<summary>`

```typescript
import { ChevronRight } from 'lucide-react';

<details className="group">
  <summary>
    <ChevronRight className="w-5 h-5 transition-transform duration-200 group-open:rotate-90" />
    Section Title
  </summary>
</details>
```

**Related:** #123 in PR #12
```

### Issue: Event Propagation Problem
```markdown
**Issue:** Button click toggles accordion

**Problem:** Buttons inside accordion summary propagate clicks, causing both
the button action AND accordion toggle to occur. Expected: button action only.

**Fix:** Wrap button container with `onClick={e => e.stopPropagation()}`:

```typescript
<summary>
  <span>Section Title</span>
  <div onClick={e => e.stopPropagation()}>
    <Button onClick={handleDelete}>Delete</Button>
  </div>
</summary>
```

**Test:** Click button → should trigger button action only, not toggle accordion.

**Related:** #124 in PR #12
```

---

## ESLint Rule Configuration

Add to `.eslintrc.cjs` or `client/.eslintrc.json`:

```json
{
  "extends": [
    "eslint:recommended",
    "plugin:react-hooks/recommended",
    "plugin:jsx-a11y/recommended"
  ],
  "plugins": [
    "react-hooks",
    "jsx-a11y"
  ],
  "rules": {
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "error",
    "jsx-a11y/interactive-supports-focus": "warn",
    "jsx-a11y/click-events-have-key-events": "warn",
    "jsx-a11y/no-static-element-interactions": "warn",
    "jsx-a11y/no-interactive-element-to-static-element": "warn"
  }
}
```

Then run:
```bash
npm run lint -- --fix
```

---

## Review Workflow

### For Busy Reviewers (Quick Path - 5 mins)

1. **Run the check script:**
   ```bash
   npm run lint
   npm run typecheck
   ```

2. **Manually review specific files changed in PR**

3. **Ask developer:**
   - Did you test keyboard navigation?
   - Can you Tab through and see focus?
   - Do accordions show state changes visually?

4. **If yes to all → approve**

---

### For Thorough Reviewers (Full Path - 20 mins)

1. **Use Phase 1 Quick Scan** (5 min) - grep search results
2. **Use Phase 2 Detailed Review** (15 min) - code inspection
3. **Use Common Review Comments** - paste appropriate issues
4. **Request changes or approve** based on findings

---

### For Accessibility Specialists (Deep Dive - 30+ mins)

1. **Run all checks above**
2. **Keyboard test:** Navigate component with Tab only
3. **Screen reader test:** Use NVDA/JAWS/VoiceOver
4. **Automated testing:** Run axe or Pa11y
5. **Visual test:** Verify focus ring and icons on all browsers
6. **Document findings** in review

---

## CI/CD Integration

### GitHub Actions Configuration

Add to `.github/workflows/ci.yml`:

```yaml
- name: Check React Hooks
  run: npm run lint 2>&1 | grep -c 'react-hooks' || true

- name: Check Accessibility
  run: npm run lint 2>&1 | grep -c 'jsx-a11y' || true

- name: Require Accessibility Checklist
  run: |
    if ! grep -q "Accessibility" PR_TEMPLATE.md; then
      echo "Error: PR template missing accessibility section"
      exit 1
    fi
```

### Pull Request Template Update

Add to `.github/pull_request_template.md`:

```markdown
## React Hooks & Accessibility

### Code Quality
- [ ] All callbacks wrapped in `useCallback`
- [ ] All `useEffect` dependencies complete
- [ ] ESLint passes: `npm run lint`
- [ ] TypeScript passes: `npm run typecheck`

### WCAG Accessibility (Level AA)
- [ ] Focus indicators visible on all interactive elements
- [ ] State indicators on collapsible sections
- [ ] No event propagation issues
- [ ] Tested with keyboard navigation (Tab key)
- [ ] Tested in multiple browsers

### Testing
- [ ] Unit/integration tests added
- [ ] Manual keyboard navigation test completed
- [ ] No console errors
```

---

## Quick Reference Table

| Issue | Check | Fix | ESLint |
|-------|-------|-----|--------|
| Missing useCallback | `rg 'const \w+ = ' \| rg -v useCallback` | Wrap in `useCallback()` | react-hooks/rules |
| Missing useEffect dep | `grep 'useEffect' -A 5` | Add to dependency array | react-hooks/exhaustive-deps |
| No focus indicator | Tab through component | Add `focus-visible:ring-*` | jsx-a11y/focus |
| No state indicator | Visual inspection | Add rotating icon | Manual + testing |
| Event propagation | Click buttons in accordion | Add `stopPropagation()` | jsx-a11y/click-events |

---

## Resources for Reviewers

### Documentation
- [React Hooks: useCallback](https://react.dev/reference/react/useCallback)
- [React Hooks: useEffect](https://react.dev/reference/react/useEffect)
- [WCAG 2.4.7: Focus Visible](https://www.w3.org/WAI/WCAG21/Understanding/focus-visible.html)
- [WCAG 1.3.1: Info and Relationships](https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships.html)

### Tools
- [Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [WAVE Browser Extension](https://wave.webaim.org/extension/)
- [Lighthouse (Chrome DevTools)](https://developers.google.com/web/tools/lighthouse)
- [axe DevTools](https://www.deque.com/axe/devtools/)

### Testing
- [Screen Reader Testing](https://www.nvaccess.org/) (NVDA - free)
- [Keyboard Navigation Testing](https://www.w3.org/WAI/test-evaluate/test-eval.php)

---

## Approval Criteria

**Minimum to Approve:**
- ✅ ESLint passes
- ✅ TypeScript passes
- ✅ All tests pass
- ✅ Developer confirms keyboard testing completed

**Ideal to Approve:**
- ✅ All above plus:
- ✅ Code follows all patterns from PR #12 fixes
- ✅ Accessibility specialist has reviewed
- ✅ Browser testing completed (Chrome, Firefox, Safari)

**Block Merge:**
- ❌ ESLint errors
- ❌ TypeScript errors
- ❌ Test failures
- ❌ Major accessibility violations (WCAG A level)
- ❌ Unreviewed critical changes

---

**Last Updated:** 2025-12-01

**Related:**
- [Full Prevention Guide](./PR-12-REACT-HOOKS-ACCESSIBILITY-PREVENTION.md)
- [Quick Reference](./PR-12-QUICK-REFERENCE.md)
