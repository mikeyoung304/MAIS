---
title: PR #12 Prevention Strategies - React Hooks & Accessibility Issues
category: prevention
tags: [react-hooks, accessibility, wcag, performance, event-handling, pr-12]
priority: P1
---

# PR #12 Prevention Strategies - React Hooks & Accessibility Issues

**Issues Found in PR #12:**

1. Missing `useCallback` for callbacks passed to memoized components
2. Missing `useEffect` dependencies
3. Missing keyboard focus indicators (WCAG 2.4.7)
4. Missing visual indicators for interactive states (WCAG 1.3.1)
5. Event propagation issues in nested interactive elements

---

## 1. Missing useCallback for Memoized Component Callbacks

### Problem

When passing function callbacks to memoized components (or components wrapped in `React.memo`), those functions must be wrapped in `useCallback`. Otherwise, the function gets a new reference on every render, defeating the memoization and causing unnecessary re-renders.

**Impact:**

- Performance degradation (child components re-render unnecessarily)
- Memoization becomes ineffective
- May cause infinite render loops with dependency arrays

### Pattern Recognition

```typescript
// ❌ ANTI-PATTERN: Unwrapped callback in memoized component context
function TenantPackagesManager({ onPackagesChange }: Props) {
  const handleEdit = async (pkg: PackageDto) => {
    packageForm.loadPackage(pkg);
    await packageManager.handleEdit(pkg);
  };

  return <PackageList onEdit={handleEdit} />;  // New reference every render!
}

// ✅ CORRECT: Wrapped in useCallback
function TenantPackagesManager({ onPackagesChange }: Props) {
  const handleEdit = useCallback(async (pkg: PackageDto) => {
    packageForm.loadPackage(pkg);
    await packageManager.handleEdit(pkg);
  }, [packageForm.loadPackage, packageManager.handleEdit]);

  return <PackageList onEdit={handleEdit} />;
}
```

### Detection Rules

**ESLint Rule to Enable:**

```json
{
  "rules": {
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "error"
  }
}
```

**Grep Command for Self-Review:**

```bash
# Find function declarations inside component that should be memoized
rg 'const \w+ = (async )?\(.+\) => \{' client/src/features --type ts -A 3 | \
  rg -v 'useCallback' | \
  head -20
```

### Code Review Checklist

- [ ] All callbacks passed to child components are wrapped in `useCallback`
- [ ] `useCallback` has complete dependency array
- [ ] No dependencies missing from `useCallback` array
- [ ] Child component doesn't break memoization with inline objects/arrays

### Pre-commit Checklist

Before committing changes to components:

```bash
# 1. Check for missing useCallback
npm run lint -- --fix

# 2. Manually review any callbacks in memoized contexts
rg 'const handle\w+ = ' client/src/features --type ts | head -20

# 3. Verify dependencies are complete
npm test -- client
```

### Quick Fix Pattern

```typescript
import { useCallback } from 'react';

// BEFORE: Callback defined without useCallback
function MyComponent({ onSubmit }) {
  const handleSubmit = async (data) => {
    await api.save(data);
    onSubmit();
  };
  return <Form onSubmit={handleSubmit} />;
}

// AFTER: Wrapped in useCallback
function MyComponent({ onSubmit }) {
  const handleSubmit = useCallback(async (data) => {
    await api.save(data);
    onSubmit();
  }, [onSubmit]);
  return <Form onSubmit={handleSubmit} />;
}
```

### Real Examples from PR #12

**File:** `client/src/features/tenant-admin/TenantPackagesManager.tsx`

```typescript
// Lines 60-63: handleEdit wrapped in useCallback
const handleEdit = useCallback(
  async (pkg: PackageDto) => {
    packageForm.loadPackage(pkg);
    await packageManager.handleEdit(pkg);
  },
  [packageForm.loadPackage, packageManager.handleEdit]
);

// Lines 66-69: handleSubmit wrapped in useCallback
const handleSubmit = useCallback(
  async (e: React.FormEvent) => {
    e.preventDefault();
    await packageForm.submitForm(packageManager.editingPackageId);
  },
  [packageForm.submitForm, packageManager.editingPackageId]
);
```

---

## 2. Missing useEffect Dependencies

### Problem

When `useEffect` calls functions that change reference on every render (are not wrapped in `useCallback`), those functions should be in the dependency array. If the dependency array is incomplete, ESLint's `exhaustive-deps` rule will fail, and you risk stale closures.

**Impact:**

- ESLint `exhaustive-deps` warnings/errors
- Stale closures (effect uses old state/props)
- Potential infinite loops
- Race conditions from outdated dependencies

### Pattern Recognition

```typescript
// ❌ ANTI-PATTERN: Missing functions in dependency array
useEffect(() => {
  if (activeTab === 'packages') {
    loadPackagesAndSegments(); // New reference every render!
  }
}, [activeTab]); // Missing dependency!

// ✅ CORRECT: All dependencies included
useEffect(() => {
  if (activeTab === 'packages') {
    loadPackagesAndSegments();
  }
}, [activeTab, loadPackagesAndSegments]); // Complete array
```

### Detection Rules

**ESLint Configuration:**

```json
{
  "plugins": ["react-hooks"],
  "rules": {
    "react-hooks/exhaustive-deps": "error"
  }
}
```

**Grep Command for Self-Review:**

```bash
# Find useEffect calls
rg 'useEffect\(' client/src --type ts -A 10 | \
  rg -B 5 'MISSING|TODO'

# Check for incomplete dependency arrays
rg 'useEffect.*\[\]' client/src --type ts | head -20
```

### Code Review Checklist

- [ ] All functions called in `useEffect` are in dependency array
- [ ] All state variables used in `useEffect` are in dependency array
- [ ] No missing dependencies listed in ESLint comment
- [ ] Functions in dependency array are wrapped in `useCallback`
- [ ] No unnecessary dependencies (causes extra re-runs)

### Pre-commit Checklist

```bash
# 1. Run TypeScript and ESLint
npm run typecheck
npm run lint

# 2. Look for exhaustive-deps warnings
npm run lint 2>&1 | grep "exhaustive-deps"

# 3. Run tests to ensure no race conditions
npm test -- client
```

### Quick Fix Pattern

```typescript
import { useEffect, useCallback } from 'react';

// BEFORE: Missing dependency
useEffect(() => {
  loadData(); // Function reference changes every render
}, []); // ESLint warning!

// AFTER: Fix with useCallback
const loadData = useCallback(async () => {
  // Load implementation
}, []);

useEffect(() => {
  loadData();
}, [loadData]); // Now ESLint is satisfied
```

### Real Examples from PR #12

**File:** `client/src/features/tenant-admin/TenantDashboard/useDashboardData.ts`

```typescript
// Lines 46-66: All load functions wrapped in useCallback
const loadPackagesAndSegments = useCallback(async () => { ... }, []);
const loadBlackouts = useCallback(async () => { ... }, []);
const loadBookings = useCallback(async () => { ... }, []);
const loadBranding = useCallback(async () => { ... }, []);

// Lines 110-120: All dependencies in array
useEffect(() => {
  if (activeTab === "packages") {
    loadPackagesAndSegments();
  } else if (activeTab === "blackouts") {
    loadBlackouts();
  } else if (activeTab === "bookings") {
    loadBookings();
  } else if (activeTab === "branding") {
    loadBranding();
  }
}, [activeTab, loadPackagesAndSegments, loadBlackouts, loadBookings, loadBranding]);
```

---

## 3. Missing Keyboard Focus Indicators (WCAG 2.4.7)

### Problem

Interactive elements must have a visible focus indicator for keyboard navigation. Without it, users relying on keyboard navigation (Tab key) cannot see which element is currently focused. This violates WCAG 2.1 Success Criterion 2.4.7 (Focus Visible - Level AA).

**Impact:**

- WCAG AA compliance violation
- Excludes ~15-20% of users (keyboard-only, screen reader users)
- Difficult to use for power users
- May affect enterprise customer contracts
- Legal liability in some jurisdictions

### Pattern Recognition

```typescript
// ❌ ANTI-PATTERN: No focus indicator
<summary className="px-6 py-4 cursor-pointer hover:bg-sage-light/5 transition-colors">
  {/* Missing focus-visible ring */}
</summary>

// ✅ CORRECT: Focus indicator included
<summary className="px-6 py-4 cursor-pointer hover:bg-sage-light/5 focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 transition-colors">
  {/* Clear focus ring */}
</summary>
```

### Tailwind Classes for Focus Indicators

```typescript
// Basic focus ring (most common)
focus:outline-none
focus-visible:ring-2
focus-visible:ring-{color}
focus-visible:ring-offset-2

// Example with design system colors
focus:outline-none
focus-visible:ring-2
focus-visible:ring-sage
focus-visible:ring-offset-2

// For form inputs (alternate approach)
focus:ring-2
focus:ring-sage
focus:border-sage
focus:outline-none

// For buttons
focus:outline-none
focus:ring-2
focus:ring-offset-2
focus:ring-blue-500
```

### Detection Rules

**ESLint Plugin (to install):**

```bash
npm install --save-dev eslint-plugin-jsx-a11y
```

**ESLint Configuration:**

```json
{
  "plugins": ["jsx-a11y"],
  "rules": {
    "jsx-a11y/interactive-supports-focus": "warn",
    "jsx-a11y/click-events-have-key-events": "warn",
    "jsx-a11y/no-static-element-interactions": "warn"
  }
}
```

**Grep Command for Self-Review:**

```bash
# Find interactive elements without focus indicators
rg '<(button|a|summary|input|select)' client/src/features --type tsx | \
  rg -v 'focus'

# Find elements with click handlers but no keyboard support
rg 'onClick=' client/src/features --type tsx | \
  rg -v 'onKeyDown|onKeyUp'
```

### Code Review Checklist

- [ ] All interactive elements have visible focus indicators
- [ ] Focus ring uses design system colors
- [ ] Focus ring contrast meets WCAG AA standards
- [ ] Tab order is logical (test with Tab key)
- [ ] Skip links present if needed
- [ ] Screen reader tested (if time permits)

### Pre-commit Checklist

```bash
# 1. Run ESLint with a11y plugin
npm run lint

# 2. Manually test focus indicators
#    a. Open component in browser
#    b. Press Tab key repeatedly
#    c. Verify focus is visible everywhere
#    d. Check focus order is logical

# 3. Test keyboard accessibility
#    a. Open component
#    b. Navigate only with keyboard (Tab, Enter, Space)
#    c. All functionality must be accessible

# 4. Check contrast
#    Use online WCAG contrast checker for focus ring color
```

### Quick Fix Pattern

```typescript
// For summary/details elements
<summary className="px-4 py-2 cursor-pointer hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 transition-colors">

// For buttons
<Button className="focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">

// For input fields
<input className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none" />
```

### Real Examples from PR #12

**File:** `client/src/features/tenant-admin/TenantPackagesManager.tsx` (Line 206)

```typescript
<summary className="px-6 py-4 cursor-pointer font-serif text-lg font-bold flex items-center justify-between hover:bg-sage-light/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 transition-colors list-none [&::-webkit-details-marker]:hidden">
```

Key additions:

- `focus:outline-none` - Remove default browser outline
- `focus-visible:ring-2` - Add 2px ring
- `focus-visible:ring-sage` - Use sage color from design system
- `focus-visible:ring-offset-2` - Add offset for visibility

### WCAG Success Criterion 2.4.7: Focus Visible

**Level:** AA

**Requirement:** Any keyboard operable user interface component must have a mode of operation where the keyboard focus indicator is visible.

**Tests:**

1. Tab to each interactive element
2. Verify visual focus indicator is visible
3. Check focus indicator meets 3:1 contrast ratio with adjacent colors

---

## 4. Missing Visual Indicators for Interactive States (WCAG 1.3.1)

### Problem

Interactive elements (especially accordions) must have visual indicators showing their state (open/closed, expanded/collapsed). Without state indicators, users cannot distinguish between expanded and collapsed sections, violating WCAG 1.3.1 (Info and Relationships).

**Impact:**

- WCAG A compliance violation
- Confusing UX when multiple accordions exist
- Users don't know if section is expanded/collapsed
- Standard pattern violation (users expect chevron/arrow icon)

### Pattern Recognition

```typescript
// ❌ ANTI-PATTERN: No state indicator
<details open>
  <summary className="list-none [&::-webkit-details-marker]:hidden">
    Segment Name
  </summary>
  {/* Content */}
</details>

// ✅ CORRECT: Chevron icon that rotates on open
<details open className="group">
  <summary className="list-none [&::-webkit-details-marker]:hidden">
    <ChevronRight className="w-5 h-5 transition-transform group-open:rotate-90" />
    Segment Name
  </summary>
  {/* Content */}
</details>
```

### Tailwind Group Open Pattern

```typescript
// Use Tailwind's group-open variant (requires Tailwind 3.0+)
<details className="group">
  <summary>
    <Icon className="group-open:rotate-90 transition-transform" />
  </summary>
</details>

// Styles applied to child when details is open:
// - group-open:rotate-90 - Rotate icon 90 degrees
// - transition-transform - Smooth animation
// - duration-200 - 200ms animation duration
```

### Icon Selection

**Recommended Icons (from lucide-react):**

- `ChevronRight` - Standard, clear indicator (RECOMMENDED)
- `ChevronDown` - Alternative, points to expanded state
- `Plus` - For add/expand sections
- `Minus` - For remove/collapse sections

```typescript
import { ChevronRight } from 'lucide-react';

<ChevronRight className="w-5 h-5 text-sage transition-transform duration-200 group-open:rotate-90" />
```

### Detection Rules

**ESLint Plugin Configuration:**

```json
{
  "plugins": ["jsx-a11y"],
  "rules": {
    "jsx-a11y/no-interactive-element-to-static-element": "warn"
  }
}
```

**Grep Command for Self-Review:**

```bash
# Find <details> elements without visual indicators
rg '<details' client/src/features --type tsx -A 3 | \
  rg -v 'Chevron|ChevronRight|ChevronDown|Plus|Minus|Arrow'

# Find summaries that might be missing icons
rg '<summary' client/src/features --type tsx -A 1 | \
  rg -v 'icon|Icon|Chevron|Arrow'
```

### Code Review Checklist

- [ ] All collapsible sections have visual state indicators
- [ ] Indicator rotates or animates on state change
- [ ] Icon color matches design system
- [ ] Animation uses `transition-transform` and `duration-200`
- [ ] Icon is accessible (has aria-label if needed)
- [ ] Icon doesn't interfere with click targets

### Pre-commit Checklist

```bash
# 1. Run component in browser
# 2. Test accordion expand/collapse
#    - Icon should rotate/animate
#    - State should be immediately clear
# 3. Check responsive design
#    - Icon size appropriate on mobile
# 4. Verify animation smoothness
#    - No janky transitions
#    - Duration is 200-300ms
```

### Quick Fix Pattern

```typescript
import { ChevronRight } from 'lucide-react';

// BEFORE: No indicator
<details open>
  <summary>Segment Name</summary>
  <div>{/* content */}</div>
</details>

// AFTER: With rotating chevron
<details open className="group">
  <summary className="flex items-center gap-2">
    <ChevronRight className="w-5 h-5 text-sage transition-transform duration-200 group-open:rotate-90" />
    Segment Name
  </summary>
  <div>{/* content */}</div>
</details>
```

### Real Examples from PR #12

**File:** `client/src/features/tenant-admin/TenantPackagesManager.tsx` (Lines 207-208)

```typescript
<span className="flex items-center gap-2">
  <ChevronRight className="w-5 h-5 text-sage transition-transform duration-200 group-open:rotate-90" />
  <span className="text-text-primary">
    {segment.name} <span className="font-normal text-text-muted">({segment.packages.length})</span>
  </span>
</span>
```

Key elements:

- `ChevronRight` icon imported from lucide-react
- `w-5 h-5` - Standard icon size (20px)
- `text-sage` - Uses design system color
- `transition-transform duration-200` - Smooth 200ms animation
- `group-open:rotate-90` - Rotate 90° when details is open
- `flex items-center gap-2` - Proper spacing with text

### WCAG Success Criterion 1.3.1: Info and Relationships

**Level:** A

**Requirement:** Information, structure, and relationships conveyed through presentation must also be available in text.

**Tests:**

1. Expand accordion - verify visual indicator shows open state
2. Collapse accordion - verify visual indicator shows closed state
3. Test with screen reader - state should be conveyed by both icon and HTML structure

---

## 5. Event Propagation Issues in Nested Interactive Elements

### Problem

When interactive elements (buttons, links) are placed inside other interactive elements (like `<summary>`), clicks on inner elements propagate to outer elements, causing unexpected behavior. For example, clicking a button inside an accordion summary both triggers the button AND toggles the accordion.

**Impact:**

- Confusing UX (unexpected accordion toggle)
- User frustration (tried to add item, accordion collapsed)
- Standard UX violation
- May prevent completing intended actions

### Pattern Recognition

```typescript
// ❌ ANTI-PATTERN: Buttons in summary without stopPropagation
<summary>
  <span>Segment Name</span>
  <div>
    <Button onClick={handleEdit}>Edit</Button>
    <Button onClick={handleDelete}>Delete</Button>
    {/* Clicking these ALSO toggles the accordion! */}
  </div>
</summary>

// ✅ CORRECT: stopPropagation on button container
<summary>
  <span>Segment Name</span>
  <div onClick={e => e.stopPropagation()}>
    <Button onClick={handleEdit}>Edit</Button>
    <Button onClick={handleDelete}>Delete</Button>
    {/* Clicking these only triggers button action */}
  </div>
</summary>
```

### Two Approaches

**Approach 1: stopPropagation on Container (Recommended)**

```typescript
// Stop propagation on the container that holds buttons
<div className="flex gap-2" onClick={e => e.stopPropagation()}>
  <Button onClick={handleEdit}>Edit</Button>
  <Button onClick={handleDelete}>Delete</Button>
</div>
```

**Pros:**

- Single location to manage
- Clear intent
- Easy to maintain

**Cons:**

- Affects all children

---

**Approach 2: stopPropagation on Each Button**

```typescript
// Stop propagation on each button individually
<Button onClick={(e) => {
  e.stopPropagation();
  handleEdit();
}}>
  Edit
</Button>
```

**Pros:**

- Explicit per-button
- More control

**Cons:**

- Repetitive
- Easy to forget on new buttons

### Detection Rules

**ESLint Plugin Configuration:**

```json
{
  "plugins": ["jsx-a11y"],
  "rules": {
    "jsx-a11y/click-events-have-key-events": "warn",
    "jsx-a11y/no-static-element-interactions": "warn"
  }
}
```

**Grep Command for Self-Review:**

```bash
# Find <summary> or <details> with nested buttons
rg '<summary' client/src/features --type tsx -A 10 | \
  rg '<Button' | \
  rg -v 'stopPropagation'

# Find onClick handlers without stopPropagation
rg 'onClick=' client/src/features --type tsx | \
  rg -v 'stopPropagation' | head -20
```

### Code Review Checklist

- [ ] All buttons/interactive elements inside `<summary>` use `stopPropagation`
- [ ] All click handlers on non-interactive elements use `stopPropagation`
- [ ] Test: Clicking button doesn't toggle accordion
- [ ] Test: Clicking accordion header text DOES toggle accordion
- [ ] No unintended event bubbling

### Pre-commit Checklist

```bash
# 1. Open component in browser
# 2. Test button clicks inside accordion summary
#    - Buttons should trigger their action
#    - Accordion should NOT toggle
# 3. Test accordion header text
#    - Should toggle accordion
#    - Buttons should not trigger
# 4. Test keyboard interaction
#    - Space/Enter on button should trigger button
#    - Space/Enter on summary should toggle accordion
```

### Quick Fix Pattern

```typescript
// BEFORE: Button click toggles accordion
<summary>
  <span>Section Title</span>
  <Button onClick={handleDelete}>Delete</Button>
</summary>

// AFTER: Container prevents propagation
<summary>
  <span>Section Title</span>
  <div onClick={e => e.stopPropagation()}>
    <Button onClick={handleDelete}>Delete</Button>
  </div>
</summary>
```

### Real Examples from PR #12

**File:** `client/src/features/tenant-admin/TenantPackagesManager.tsx` (Line 213)

```typescript
<div className="flex gap-2" onClick={e => e.stopPropagation()}>
  <Button
    size="sm"
    variant="ghost"
    onClick={() => segmentManager.handleEditSegment(segment)}
    className="text-text-muted hover:text-sage hover:bg-sage/10"
    aria-label={`Edit segment: ${segment.name}`}
  >
    <Pencil className="w-4 h-4" />
  </Button>
  <Button
    size="sm"
    variant="ghost"
    onClick={() => segmentManager.handleDeleteSegment(segment.id)}
    className="text-text-muted hover:text-danger-600 hover:bg-danger-50"
    aria-label={`Delete segment: ${segment.name}`}
  >
    <Trash2 className="w-4 h-4" />
  </Button>
</div>
```

Key element:

- `onClick={e => e.stopPropagation()}` on container div
- All buttons inside are unaffected by summary's click behavior
- Buttons have proper `aria-label` for accessibility

---

## Prevention Workflow

### Pre-commit Checklist (Copy-Paste Ready)

```markdown
## React Hooks & Accessibility Checklist

### Hooks

- [ ] All callbacks passed to children wrapped in `useCallback`
- [ ] All `useCallback` have complete dependency array
- [ ] All functions called in `useEffect` are in dependency array
- [ ] No ESLint `exhaustive-deps` warnings
- [ ] `npm run lint` passes

### Accessibility (WCAG)

- [ ] All interactive elements have focus indicators (WCAG 2.4.7)
  - Test with Tab key
  - Focus ring is visible
- [ ] All collapsible sections have state indicators (WCAG 1.3.1)
  - Icons rotate/animate on state change
  - Icon uses design system colors
- [ ] No event propagation issues
  - Test: Button clicks don't toggle accordion
  - Test: Accordion header text toggles accordion
  - All buttons have `stopPropagation`

### Testing

- [ ] Component renders without errors
- [ ] All functionality works with keyboard only
- [ ] Tab key navigates through all interactive elements
- [ ] No console errors or warnings
- [ ] Responsive design works on mobile/tablet
```

### Code Review Checklist (For Reviewers)

1. **React Hooks**
   - Look for callbacks passed to children → must be in `useCallback`
   - Check `useEffect` dependencies → should include all functions/state used
   - Run `npm run lint` on changed files → no exhaustive-deps errors

2. **Accessibility (WCAG)**
   - Tab through interactive elements → focus ring must be visible
   - Expand/collapse accordions → visual state indicator must change
   - Click buttons in nested interactive contexts → verify no unexpected toggling
   - Check for `focus-visible:ring` classes on interactive elements
   - Check for rotating icons/state indicators on collapsibles

3. **Testing**
   - Run keyboard-only test (no mouse)
   - Test on multiple browsers (Chrome, Firefox, Safari)
   - Screen reader test if applicable

### ESLint Rules to Enforce

Add to `.eslintrc.cjs` or `client/.eslintrc.json`:

```json
{
  "extends": ["plugin:react-hooks/recommended", "plugin:jsx-a11y/recommended"],
  "plugins": ["react-hooks", "jsx-a11y"],
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

---

## Quick Reference Patterns

### Pattern 1: Memoized Component with Callbacks

```typescript
import { useCallback } from 'react';

function MyComponent() {
  const handleSubmit = useCallback(async (data: FormData) => {
    await api.save(data);
  }, []);  // No dependencies

  const handleEdit = useCallback((id: string) => {
    setSelectedId(id);
  }, []);  // No dependencies on external state

  return (
    <Form onSubmit={handleSubmit} onEdit={handleEdit} />
  );
}
```

### Pattern 2: useEffect with useCallback Dependencies

```typescript
import { useEffect, useCallback, useState } from 'react';

function DataComponent({ activeTab }: Props) {
  const [data, setData] = useState(null);

  // Step 1: Wrap data loader in useCallback
  const loadData = useCallback(async () => {
    const result = await api.fetch(activeTab);
    setData(result);
  }, [activeTab]);

  // Step 2: Include callback in useEffect dependencies
  useEffect(() => {
    loadData();
  }, [loadData]);

  return <div>{data}</div>;
}
```

### Pattern 3: Accessible Accordion

```typescript
import { ChevronRight } from 'lucide-react';

function Accordion({ title, children }: Props) {
  return (
    <details className="group border rounded-lg">
      <summary className="px-4 py-3 cursor-pointer flex items-center gap-2 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
        <ChevronRight className="w-5 h-5 transition-transform duration-200 group-open:rotate-90" />
        <span>{title}</span>
      </summary>
      <div className="px-4 py-3 border-t">{children}</div>
    </details>
  );
}
```

### Pattern 4: Buttons in Accordion Summary

```typescript
function AccordionWithActions({ onEdit, onDelete }: Props) {
  return (
    <details className="group">
      <summary className="flex items-center justify-between px-4 py-3">
        <span>Section Title</span>
        {/* Container prevents button clicks from toggling accordion */}
        <div className="flex gap-2" onClick={e => e.stopPropagation()}>
          <button onClick={onEdit}>Edit</button>
          <button onClick={onDelete}>Delete</button>
        </div>
      </summary>
      <div>{/* content */}</div>
    </details>
  );
}
```

---

## Testing Strategies

### Unit Test: useCallback Dependencies

```typescript
import { render, screen } from '@testing-library/react';
import { MyComponent } from './MyComponent';

it('should memoize callbacks correctly', () => {
  const { rerender } = render(<MyComponent />);
  const button1 = screen.getByRole('button');

  rerender(<MyComponent />);
  const button2 = screen.getByRole('button');

  // If callbacks are properly memoized, children won't re-render
  expect(button1).toBe(button2);
});
```

### Integration Test: Accordion Interaction

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Accordion } from './Accordion';

it('should toggle accordion on header click', async () => {
  const user = userEvent.setup();
  render(<Accordion title="Test">Content</Accordion>);

  const summary = screen.getByText('Test');
  await user.click(summary);

  expect(screen.getByText('Content')).toBeVisible();
});

it('should not toggle accordion on button click inside', async () => {
  const user = userEvent.setup();
  const onDelete = vi.fn();

  render(
    <Accordion title="Test" onDelete={onDelete}>
      Content
    </Accordion>
  );

  const deleteBtn = screen.getByRole('button', { name: /delete/i });
  await user.click(deleteBtn);

  // Button callback should be called, accordion should stay open
  expect(onDelete).toHaveBeenCalled();
});
```

### E2E Test: Keyboard Navigation

```typescript
import { test, expect } from '@playwright/test';

test('should navigate with keyboard and show focus', async ({ page }) => {
  await page.goto('/dashboard');

  // Tab to accordion header
  await page.keyboard.press('Tab');

  // Focus ring should be visible
  const summary = page.locator('summary');
  await expect(summary).toBeFocused();
  const styles = await summary.evaluate((el) => window.getComputedStyle(el));
  expect(styles.outline).not.toBe('none');

  // Space should toggle accordion
  await page.keyboard.press('Space');
  const content = page.locator('details > div');
  await expect(content).toBeVisible();
});
```

---

## Common Mistakes

### ❌ Mistake 1: useCallback Without Dependencies

```typescript
// WRONG: Function will be recreated every render
const handleClick = useCallback(() => {
  doSomething();
}); // Missing dependency array!
```

**Fix:**

```typescript
// CORRECT: Proper dependency array
const handleClick = useCallback(() => {
  doSomething();
}, []); // Empty if no dependencies
```

### ❌ Mistake 2: useEffect with Incomplete Dependencies

```typescript
// WRONG: loadData is not in dependencies
useEffect(() => {
  loadData(); // Function that changes reference
}, [activeTab]); // Missing loadData!
```

**Fix:**

```typescript
// CORRECT: All dependencies included
useEffect(() => {
  loadData();
}, [activeTab, loadData]);
```

### ❌ Mistake 3: Focus Ring Only on Hover

```typescript
// WRONG: Focus ring only on hover, not keyboard
<button className="hover:ring-2" />
```

**Fix:**

```typescript
// CORRECT: Focus ring on keyboard focus
<button className="hover:ring-2 focus-visible:ring-2" />
```

### ❌ Mistake 4: No State Indicator on Accordion

```typescript
// WRONG: No way to tell if open or closed
<details>
  <summary>Section</summary>
</details>
```

**Fix:**

```typescript
// CORRECT: Icon shows state
<details className="group">
  <summary>
    <ChevronRight className="group-open:rotate-90" />
    Section
  </summary>
</details>
```

### ❌ Mistake 5: Button Click Toggles Accordion

```typescript
// WRONG: Click button, accordion toggles too
<summary>
  <button onClick={handleDelete}>Delete</button>
</summary>
```

**Fix:**

```typescript
// CORRECT: stopPropagation prevents toggle
<summary>
  <div onClick={e => e.stopPropagation()}>
    <button onClick={handleDelete}>Delete</button>
  </div>
</summary>
```

---

## Resources

### Documentation

- [React Hooks Documentation](https://react.dev/reference/react)
- [React useCallback Hook](https://react.dev/reference/react/useCallback)
- [React useEffect Hook](https://react.dev/reference/react/useEffect)
- [WCAG 2.4.7 Focus Visible](https://www.w3.org/WAI/WCAG21/Understanding/focus-visible.html)
- [WCAG 1.3.1 Info and Relationships](https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships.html)

### Tools

- [WCAG Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [Accessibility Inspector (Firefox DevTools)](https://firefox-source-docs.mozilla.org/devtools-user/accessibility_inspector/index.html)
- [WAVE Browser Extension](https://wave.webaim.org/extension/)
- [Screen Reader (NVDA, JAWS, VoiceOver)](https://www.nvaccess.org/)

### Related Prevention Docs

- [Component Duplication Prevention](./COMPONENT-DUPLICATION-PREVENTION.md)
- [Comprehensive Prevention Strategies](./COMPREHENSIVE-PREVENTION-STRATEGIES.md)
- [Prevention Quick Reference](./PREVENTION-QUICK-REFERENCE.md)

---

## Maintenance

**Last Updated:** 2025-12-01

**Maintainer:** Frontend Architecture Team

**Next Review:** 2025-12-15

**Status:** Active, derived from PR #12 issues

---

## Summary Table

| Issue                  | Detection                | Prevention               | Effort |
| ---------------------- | ------------------------ | ------------------------ | ------ |
| Missing useCallback    | ESLint `react-hooks`     | Wrap in useCallback      | 5 min  |
| Missing useEffect deps | ESLint `exhaustive-deps` | Add to dependency array  | 5 min  |
| No focus indicator     | Manual keyboard test     | Add `focus-visible:ring` | 5 min  |
| No state indicator     | Visual inspection        | Add rotating icon        | 10 min |
| Event propagation      | Functional test          | Add `stopPropagation`    | 5 min  |

---

## Recommended Action Items

1. **Immediate (This Sprint)**
   - [ ] Enable ESLint rules in CI/CD
   - [ ] Add jsx-a11y plugin to ESLint config
   - [ ] Update PR template with accessibility checklist

2. **Short-term (1-2 Weeks)**
   - [ ] Audit existing components for these issues
   - [ ] Add tests for keyboard navigation
   - [ ] Update component documentation

3. **Long-term (1 Month)**
   - [ ] Implement automated accessibility testing (axe-core)
   - [ ] Schedule accessibility training for team
   - [ ] Create reusable accessible components library
