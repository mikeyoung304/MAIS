# WCAG Navigation ARIA - Accessibility Prevention

**Status:** Complete Prevention Pattern
**Severity:** P2 (Code Quality - A11y)
**Last Updated:** 2026-01-05
**Related:** P2 Fix #641, WCAG 2.1 AA

## Problem Statement

Navigation components lacking ARIA attributes fail WCAG 2.1 AA compliance:

```tsx
// ❌ WRONG - No accessibility attributes
<nav className="flex flex-wrap gap-2">
  {items.map((item) => (
    <Link href={item.href}>
      {item.label}
    </Link>
  ))}
</nav>

// ✓ CORRECT - Proper ARIA attributes
<nav aria-label="Scheduling sections">
  {items.map((item) => (
    <Link
      href={item.href}
      aria-current={isActive(item.href) ? 'page' : undefined}
    >
      {item.label}
    </Link>
  ))}
</nav>
```

**Accessibility gaps:**

- Screen readers cannot identify the purpose of the navigation
- No indication of current page for keyboard/screen reader users
- WCAG 2.1 Level A violation (ARIA usage)
- Fails automated accessibility audits

## Prevention Strategies

### 1. Navigation Pattern Checklist

**For every `<nav>` element:**

```markdown
Navigation Component Checklist
├─ [ ] <nav> element (not <div> with nav styling)
├─ [ ] aria-label with descriptive text
│ └─ Examples: "Main navigation", "Scheduling sections", "Product categories"
│ └─ Avoid: "Navigation", "Menu" (too generic)
│
├─ [ ] aria-labelledby if using heading
│ └─ Alternative to aria-label if navigation has <h2> heading
│
├─ [ ] Links have href attributes (not onClick divs)
│ └─ Use <Link> or <a>, never <div onClick>
│
├─ [ ] Current page indicator
│ └─ aria-current="page" on active link
│ └─ Visual indicator (background color, bold, etc.)
│
└─ [ ] Skip navigation link (for long nav bars)
└─ <a href="#main" className="sr-only">Skip to main content</a>
```

### 2. Standard Navigation Pattern

**Template for subnavigation menus:**

```tsx
// components/SubNavigation.tsx

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

interface NavItem {
  href: string;
  label: string;
  icon?: ReactNode;
}

interface SubNavigationProps {
  items: NavItem[];
  ariaLabel: string;
}

export function SubNavigation({ items, ariaLabel }: SubNavigationProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    // Exact match for root routes
    if (href === '/tenant/scheduling') {
      return pathname === href;
    }
    // Prefix match for sub-routes
    return pathname.startsWith(href);
  };

  return (
    <nav className="flex flex-wrap gap-2 border-b border-neutral-200 pb-4" aria-label={ariaLabel}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isActive(item.href) ? 'page' : undefined}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${
            isActive(item.href)
              ? 'bg-sage text-white shadow-md'
              : 'text-text-muted hover:bg-surface-alt hover:text-text-primary'
          }`}
        >
          {item.icon}
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
```

**Usage:**

```tsx
// apps/web/src/app/(protected)/tenant/scheduling/layout.tsx

import { SubNavigation } from '@/components/SubNavigation';
import { Calendar, CalendarClock, Clock, CalendarX } from 'lucide-react';

const schedulingSubNav = [
  { href: '/tenant/scheduling', label: 'Overview', icon: <Calendar className="h-4 w-4" /> },
  {
    href: '/tenant/scheduling/appointment-types',
    label: 'Appointment Types',
    icon: <CalendarClock className="h-4 w-4" />,
  },
  {
    href: '/tenant/scheduling/availability',
    label: 'Availability',
    icon: <Clock className="h-4 w-4" />,
  },
  {
    href: '/tenant/scheduling/appointments',
    label: 'Appointments',
    icon: <Calendar className="h-4 w-4" />,
  },
  {
    href: '/tenant/scheduling/blackouts',
    label: 'Blackouts',
    icon: <CalendarX className="h-4 w-4" />,
  },
];

export default function SchedulingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <SubNavigation items={schedulingSubNav} ariaLabel="Scheduling sections" />
      {children}
    </div>
  );
}
```

### 3. ARIA Attribute Reference

**`aria-label` (for nav without visible label):**

```tsx
// ✓ CORRECT - Describes navigation purpose
<nav aria-label="Main navigation">
<nav aria-label="Scheduling sections">
<nav aria-label="Product categories">
<nav aria-label="Account settings">

// ❌ WRONG - Too generic
<nav aria-label="Menu">
<nav aria-label="Nav">
<nav aria-label="Links">
```

**`aria-labelledby` (for nav with visible heading):**

```tsx
// ✓ CORRECT - Uses visible <h2> as label
<nav aria-labelledby="nav-heading">
  <h2 id="nav-heading">Products</h2>
  <ul>
    <li><a href="/products/a">Product A</a></li>
    <li><a href="/products/b">Product B</a></li>
  </ul>
</nav>

// ❌ WRONG - Redundant if heading already describes nav
<nav aria-label="Products">
  <h2>Products</h2>  <!-- Heading already serves as label -->
  ...
</nav>
```

**`aria-current="page"` (for active link):**

```tsx
// ✓ CORRECT - Only on current page
<nav>
  <a href="/scheduling">Overview</a>
  <a href="/scheduling/appointments" aria-current="page">Appointments</a>  <!-- Current -->
  <a href="/scheduling/availability">Availability</a>
</nav>

// ✓ CORRECT - Other aria-current values
aria-current="page"      // Current page in navigation
aria-current="step"      // Current step in progress indicator
aria-current="location"  // Current location in breadcrumbs
aria-current="date"      // Current date in calendar
aria-current="time"      // Current time in schedule

// ❌ WRONG - Using on inactive links
<a href="/other">Other Page</a> <!-- Do NOT add aria-current="page" -->
```

### 4. Code Review Checklist

**When reviewing navigation components:**

```markdown
Navigation HTML
├─ [ ] Uses <nav> element (not <div> with nav styling)
├─ [ ] <nav> has aria-label="..." or aria-labelledby="..."
├─ [ ] Links use href attributes (not onClick)
├─ [ ] Active link has aria-current="page"
├─ [ ] aria-current only on ONE link per navigation
├─ [ ] Links are semantic (<a> or Next.js <Link>)
├─ [ ] Text labels are clear and descriptive
│ └─ "Scheduling sections" ✓, "Menu" ✗
├─ [ ] For long navs: skip navigation link present
└─ [ ] Keyboard navigation works (Tab through links)

Visual Design
├─ [ ] Active link has visual indicator (color, font-weight, etc.)
├─ [ ] Hover states visible (not just color - use underline, background, etc.)
├─ [ ] Touch target at least 44x44px (mobile)
└─ [ ] Sufficient color contrast (4.5:1 for text)
```

### 5. Testing Accessibility

**Manual testing:**

```bash
1. Tab navigation
   ├─ Tab through links (should be keyboard accessible)
   └─ Shift+Tab goes backwards

2. Screen reader (macOS: VoiceOver)
   ├─ VO+U opens web rotor
   ├─ Navigate to "Navigation" section
   ├─ Should see all nav menus with their labels
   └─ Verify aria-current="page" is announced

3. Screen reader (Windows: NVDA)
   ├─ Use navigation quick key (Press D)
   ├─ Should jump to <nav> elements
   └─ Verify aria-label is read
```

**Automated testing (axe-core):**

```typescript
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { SubNavigation } from '@/components/SubNavigation';

expect.extend(toHaveNoViolations);

test('navigation has no accessibility violations', async () => {
  const { container } = render(
    <SubNavigation
      items={[
        { href: '/item1', label: 'Item 1' },
        { href: '/item2', label: 'Item 2' },
      ]}
      ariaLabel="Test navigation"
    />
  );

  const results = await axe(container);
  expect(results).toHaveNoViolations();
});

test('aria-current="page" is set on active link', () => {
  const { getByRole } = render(
    <SubNavigation
      items={[
        { href: '/item1', label: 'Item 1' },
      ]}
      ariaLabel="Test"
    />
  );

  const activeLink = getByRole('link', { current: 'page' });
  expect(activeLink).toHaveAttribute('aria-current', 'page');
});
```

### 6. Common Patterns

**Pattern 1: Main navigation with sections**

```tsx
<nav aria-label="Main navigation">
  <Link href="/" aria-current={isActive('/') ? 'page' : undefined}>
    Home
  </Link>
  <Link href="/about" aria-current={isActive('/about') ? 'page' : undefined}>
    About
  </Link>
</nav>
```

**Pattern 2: Subnav (like scheduling)**

```tsx
<nav aria-label="Scheduling sections">
  {schedulingSubNav.map((item) => (
    <Link key={item.href} href={item.href} aria-current={isActive(item.href) ? 'page' : undefined}>
      {item.label}
    </Link>
  ))}
</nav>
```

**Pattern 3: Breadcrumbs**

```tsx
<nav aria-label="Breadcrumbs">
  <ol>
    <li>
      <Link href="/">Home</Link>
    </li>
    <li>
      <Link href="/scheduling">Scheduling</Link>
    </li>
    <li>
      <span aria-current="page">Appointments</span>
    </li>
  </ol>
</nav>
```

**Pattern 4: Skip navigation**

```tsx
<div className="fixed top-0 left-0 z-50">
  <a
    href="#main-content"
    className="sr-only focus:not-sr-only focus:absolute focus:bg-white focus:px-4 focus:py-2"
  >
    Skip to main content
  </a>
</div>

<main id="main-content">
  {/* Main content */}
</main>
```

### 7. Built-in Utilities

**Tailwind hidden class for screen readers:**

```tsx
// Hide from visual display, keep for screen readers
<span className="sr-only">Current page:</span>

// Or use custom utility
<style>{`
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }
`}</style>
```

## Related Files

**Source implementations:**

- `/Users/mikeyoung/CODING/MAIS/apps/web/src/app/(protected)/tenant/scheduling/layout.tsx` - Shows correct ARIA pattern
- `/Users/mikeyoung/CODING/MAIS/apps/web/src/components/build-mode/` - Other well-structured navigation examples

**Documentation:**

- `docs/solutions/patterns/auth-form-accessibility-checklist-MAIS-20251230.md` - Form ARIA patterns
- WCAG 2.1 AA: https://www.w3.org/WAI/WCAG21/quickref/

**Tools:**

- axe DevTools: https://www.deque.com/axe/devtools/
- WAVE Browser Extension: https://wave.webaim.org/extension/
- Lighthouse (Chrome DevTools)

## Key Takeaways

1. **Every `<nav>` needs aria-label or aria-labelledby** - Required for WCAG compliance
2. **aria-current="page" on active link only** - Never multiple current pages
3. **Use semantic HTML** - `<nav>`, `<Link>`, `<a>` (not `<div>`)
4. **Visual + ARIA** - Both visual indicator AND aria-current needed
5. **Test with screen readers** - Automated checks miss context issues

## FAQ

**Q: Can I use aria-label="Navigation"?**
A: No, too generic. Use descriptive text: "Main navigation", "Scheduling sections", "Product categories"

**Q: What if nav has no visible label?**
A: Use aria-label. If there's a heading, use aria-labelledby instead.

**Q: Should subnavigation links have aria-current?**
A: Yes, subnavigation children should have aria-current="page" too (only one per nav).

**Q: Do I need skip navigation on every page?**
A: Recommended for sites with long navigation. Essential on pages with multiple nav sections.

**Q: Works without aria-label, why add it?**
A: Screen readers need context. Keyboard users benefit from clear navigation purpose. WCAG compliance requires it.
