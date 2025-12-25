---
title: PR #12 Prevention - Quick Reference Cheat Sheet
category: prevention
tags: [quick-reference, react-hooks, accessibility, wcag]
priority: P0
---

# PR #12 Prevention - Quick Reference

**Print and pin to your wall!** 📌

---

## The 5 Issues (At a Glance)

| Issue                    | Pattern                                | Fix                                              | Time   |
| ------------------------ | -------------------------------------- | ------------------------------------------------ | ------ |
| Missing `useCallback`    | Callbacks passed to children unwrapped | Wrap in `useCallback`                            | 5 min  |
| Missing `useEffect` deps | Functions called but not in array      | Add to dependency array                          | 5 min  |
| No focus indicators      | Tab through → nothing visible          | Add `focus-visible:ring-*`                       | 5 min  |
| No state indicators      | Accordion looks same when open/closed  | Add rotating `ChevronRight` icon                 | 10 min |
| Event propagation        | Button click toggles accordion         | Wrap in `div onClick={e => e.stopPropagation()}` | 5 min  |

---

## 1. useCallback Pattern

```typescript
// ❌ WRONG
const handleEdit = async (pkg) => {
  packageForm.loadPackage(pkg);
};
return <PackageList onEdit={handleEdit} />;  // New reference every render!

// ✅ RIGHT
const handleEdit = useCallback(async (pkg) => {
  packageForm.loadPackage(pkg);
}, [packageForm.loadPackage]);
```

**Key Rule:** If you pass a callback to a child component, wrap it in `useCallback`.

**ESLint:** Will error if dependencies are missing.

---

## 2. useEffect Dependencies Pattern

```typescript
// ❌ WRONG
useEffect(() => {
  loadData(); // Function reference changes!
}, []); // ESLint will complain

// ✅ RIGHT
useEffect(() => {
  loadData();
}, [loadData]); // Include all functions used
```

**Key Rule:** Every function called in `useEffect` must be in the dependency array.

**How to fix:**

1. Wrap function in `useCallback` (see #1)
2. Add function to `useEffect` dependency array

---

## 3. Focus Indicators Pattern (WCAG 2.4.7)

```typescript
// ❌ WRONG - Tab through, nothing visible
<summary className="hover:bg-gray-100">Section</summary>

// ✅ RIGHT - Focus ring visible when tabbing
<summary className="hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2">
  Section
</summary>
```

**Key Classes:**

- `focus:outline-none` - Remove default browser outline
- `focus-visible:ring-2` - 2px focus ring
- `focus-visible:ring-sage` - Use design system color
- `focus-visible:ring-offset-2` - Add gap around ring

**Test:** Press Tab repeatedly, verify focus is always visible.

---

## 4. State Indicator Pattern (WCAG 1.3.1)

```typescript
// ❌ WRONG - User can't tell if open or closed
<details>
  <summary>Segment Name</summary>
  <div>Content</div>
</details>

// ✅ RIGHT - Icon shows state
<details className="group">
  <summary>
    <ChevronRight className="w-5 h-5 transition-transform duration-200 group-open:rotate-90" />
    Segment Name
  </summary>
  <div>Content</div>
</details>
```

**Key Elements:**

- `ChevronRight` icon from lucide-react
- `group` class on `<details>` (enables `group-open:`)
- `group-open:rotate-90` - Rotates 90° when open
- `transition-transform duration-200` - Smooth animation

**Test:** Open/close accordion, icon should rotate smoothly.

---

## 5. Event Propagation Pattern

```typescript
// ❌ WRONG - Button click toggles accordion too!
<summary>
  Segment Name
  <Button onClick={handleEdit}>Edit</Button>
</summary>

// ✅ RIGHT - stopPropagation prevents toggle
<summary>
  Segment Name
  <div onClick={e => e.stopPropagation()}>
    <Button onClick={handleEdit}>Edit</Button>
  </div>
</summary>
```

**Key Element:**

- `onClick={e => e.stopPropagation()}` on container

**Test:**

- Click button → button action only
- Click accordion header → accordion toggles
- Never both together

---

## Pre-commit Checklist (Copy-Paste)

```markdown
## Hooks & Accessibility

- [ ] All callbacks wrapped in `useCallback`
- [ ] All `useEffect` dependencies complete
- [ ] ESLint passes: `npm run lint`
- [ ] Tab through component, focus visible everywhere
- [ ] Accordion icons rotate on open/close
- [ ] Button clicks don't toggle accordion
- [ ] No console errors or warnings
```

---

## Quick Fixes

### Fix 1: Wrap Callback

```typescript
// Add useCallback import
import { useCallback } from 'react';

// Wrap existing callback
const handleEdit = useCallback(
  async (pkg) => {
    // ... existing code
  },
  [
    /* dependencies */
  ]
);
```

### Fix 2: Add Dependencies

```typescript
// Find useEffect
useEffect(() => {
  loadData();
}, []);  // ← Missing!

// Add the function
}, [loadData]);  // ← Add it
```

### Fix 3: Add Focus Ring

```typescript
// Find interactive element
<button className="hover:bg-gray-100">

// Add focus classes
<button className="hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
```

### Fix 4: Add Chevron Icon

```typescript
// Import icon
import { ChevronRight } from 'lucide-react';

// Add to summary
<ChevronRight className="w-5 h-5 transition-transform duration-200 group-open:rotate-90" />
```

### Fix 5: Stop Propagation

```typescript
// Wrap button container
<div onClick={e => e.stopPropagation()}>
  <Button onClick={handleDelete}>Delete</Button>
</div>
```

---

## ESLint Rules

**Install:**

```bash
npm install --save-dev eslint-plugin-react-hooks eslint-plugin-jsx-a11y
```

**Add to `.eslintrc.cjs`:**

```json
{
  "extends": ["plugin:react-hooks/recommended", "plugin:jsx-a11y/recommended"],
  "rules": {
    "react-hooks/exhaustive-deps": "error",
    "jsx-a11y/interactive-supports-focus": "warn"
  }
}
```

---

## Testing Checklist

### Keyboard Navigation

- [ ] Tab through component
- [ ] Every interactive element has visible focus ring
- [ ] Tab order is logical
- [ ] Can use Space/Enter on buttons without mouse

### Accordion Interaction

- [ ] Click header text → accordion toggles
- [ ] Click button in summary → button action only, NO toggle
- [ ] Icon rotates smoothly when toggling
- [ ] State is always visually clear

### Browser Compatibility

- [ ] Works in Chrome
- [ ] Works in Firefox
- [ ] Works in Safari
- [ ] Works on mobile browsers

---

## Common Mistakes

```typescript
// ❌ Missing useCallback
const handler = () => doSomething();
return <Child onHandle={handler} />;

// ✅ With useCallback
const handler = useCallback(() => doSomething(), []);
return <Child onHandle={handler} />;
```

```typescript
// ❌ Missing dependencies
useEffect(() => loadData(), []);

// ✅ With all dependencies
useEffect(() => loadData(), [loadData]);
```

```typescript
// ❌ No focus indicator
<button className="hover:bg-blue" />

// ✅ With focus indicator
<button className="hover:bg-blue focus-visible:ring-2" />
```

```typescript
// ❌ No state indicator
<details><summary>Title</summary></details>

// ✅ With chevron
<details className="group">
  <summary><ChevronRight className="group-open:rotate-90" />Title</summary>
</details>
```

```typescript
// ❌ Event propagation issue
<summary><Button onClick={...}>Delete</Button></summary>

// ✅ With stopPropagation
<summary>
  <div onClick={e => e.stopPropagation()}>
    <Button onClick={...}>Delete</Button>
  </div>
</summary>
```

---

## Grep Commands (Self-Review)

Run these before committing:

```bash
# Check for useCallback usage
rg 'const \w+ = (async )?\(.+\) => \{' client/src/features --type ts | \
  rg -v 'useCallback' | head -10

# Check for useEffect without all deps
rg 'useEffect\(' client/src --type ts -A 5 | \
  rg '\],' | head -10

# Check for missing focus-visible
rg '<(button|input|a|summary)' client/src --type tsx | \
  rg -v 'focus'

# Check for buttons without stopPropagation
rg '<Button' client/src/features --type tsx | \
  rg 'summary|details' -B 5 | rg -v 'stopPropagation'
```

---

## Real Example (From PR #12)

**File:** `TenantPackagesManager.tsx`

```typescript
// ✅ useCallback with proper dependencies
const handleEdit = useCallback(async (pkg: PackageDto) => {
  packageForm.loadPackage(pkg);
  await packageManager.handleEdit(pkg);
}, [packageForm.loadPackage, packageManager.handleEdit]);

// ✅ useEffect with complete dependencies
useEffect(() => {
  if (activeTab === "packages") {
    loadPackagesAndSegments();
  }
}, [activeTab, loadPackagesAndSegments]);

// ✅ Focus indicator on summary
<summary className="... focus:outline-none focus-visible:ring-2 focus-visible:ring-sage">

// ✅ Rotating chevron icon
<ChevronRight className="w-5 h-5 transition-transform duration-200 group-open:rotate-90" />

// ✅ Event propagation prevention
<div className="flex gap-2" onClick={e => e.stopPropagation()}>
  <Button onClick={() => segmentManager.handleEditSegment(segment)}>
    <Pencil className="w-4 h-4" />
  </Button>
</div>
```

---

## When to Apply

### Write new code that passes callbacks to children

→ Use `useCallback` immediately (5 seconds extra)

### Write new `useEffect` hooks

→ Include all dependencies in array (5 seconds extra)

### Create interactive elements

→ Add focus indicators (30 seconds)

### Create accordion/collapsible

→ Add state indicator icon (30 seconds)

### Put interactive elements inside other interactive elements

→ Add `stopPropagation` (30 seconds)

---

## Time Investment

**Average cost per issue:** 5-10 minutes
**Payoff:** Prevents accessibility violations, performance bugs, ESLint errors

**Better to fix now than in PR review!** ⏱️

---

## Training Links

- React Hooks: https://react.dev/reference/react
- WCAG 2.4.7 (Focus): https://www.w3.org/WAI/WCAG21/Understanding/focus-visible.html
- WCAG 1.3.1 (Relationships): https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships.html
- Tailwind Focus: https://tailwindcss.com/docs/hover-focus-and-other-states

---

**Last Updated:** 2025-12-01

**Related:** [Full PR #12 Prevention Guide](./PR-12-REACT-HOOKS-ACCESSIBILITY-PREVENTION.md)
