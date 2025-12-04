# Phase 3: Responsive & Accessible

**Duration:** Weeks 7-9 (15 business days)
**Team:** 1 Senior Frontend Developer, 0.25 Accessibility Specialist (consulting), 0.25 QA Engineer
**Goal:** Inclusive, mobile-first experience with WCAG 2.1 AA compliance

---

## Phase Overview

Phase 3 focuses on **responsive design** and **accessibility compliance**. We'll ensure all pages work beautifully on mobile devices, meet WCAG 2.1 AA standards, and provide excellent keyboard navigation and screen reader support.

### Success Criteria

- ✅ All admin pages are fully functional on mobile (320px+)
- ✅ 95%+ WCAG 2.1 AA compliance (from ~60%)
- ✅ All interactive elements are keyboard navigable
- ✅ Screen reader users can complete all tasks
- ✅ Lighthouse accessibility score >95
- ✅ Light/dark theme toggle functional

---

## Task Breakdown

### Week 7: Responsive Overhaul

#### Task 7.1: Mobile Metric Cards (1 day)

**Priority:** High
**Assigned To:** Frontend Developer
**Estimated Effort:** 8 hours

**Description:**
Make metric card grids stack properly on mobile and tablet.

**Implementation Details:**

**Current Problem:**

```tsx
// 5-column grid breaks on mobile
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
```

**Solution:**

```tsx
// Responsive grid: 1 col mobile, 2 col tablet, 4 col desktop
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
  <MetricCard {...} />
  <MetricCard {...} />
  <MetricCard {...} />
  <MetricCard {...} />
</div>

// Or for 5 metrics, use responsive wrapper
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
```

**Acceptance Criteria:**

- [ ] Mobile (320px-640px): 1 column
- [ ] Tablet (641px-1024px): 2 columns
- [ ] Desktop (1025px+): 3-5 columns (depending on count)
- [ ] Cards never too narrow (<200px width)
- [ ] Gap spacing consistent at all breakpoints

**Testing Checklist:**

- [ ] Responsive test: 320px, 375px, 768px, 1024px, 1440px, 1920px
- [ ] Visual test: no card overflow or cramping
- [ ] Mobile device test: iPhone SE, iPhone 14, iPad

**Risk Level:** Low
**Rollback Plan:** Revert to original grid classes

---

#### Task 7.2: Responsive Navigation (Mobile Hamburger Menu) (1.5 days)

**Priority:** Critical
**Assigned To:** Frontend Developer
**Estimated Effort:** 12 hours

**Description:**
Implement mobile hamburger menu for admin navigation.

**Implementation Details:**

**File:** `/Users/mikeyoung/CODING/MAIS/client/src/components/navigation/AdminNav.tsx`

```tsx
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

export function AdminNav({ role }: AdminNavProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="bg-macon-navy-900 border-b border-macon-navy-700 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-4">
            <img src="/logo-light.svg" alt="Macon AI" className="h-8 w-auto" />
            <Badge className={`${roleBadgeColor} text-white text-xs font-semibold hidden sm:block`}>
              {roleLabel}
            </Badge>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {links.map((link) => (
              <NavLink key={link.to} to={link.to} {...}>
                <link.icon className="w-4 h-4" />
                {link.label}
              </NavLink>
            ))}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="text-white">
                  <Menu className="h-6 w-6" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="bg-macon-navy-900 border-macon-navy-700 w-[280px]">
                <div className="flex flex-col gap-4 mt-8">
                  {/* Role Badge */}
                  <Badge className={`${roleBadgeColor} text-white text-xs font-semibold w-fit`}>
                    {roleLabel}
                  </Badge>

                  {/* Navigation Links */}
                  <nav className="flex flex-col gap-2">
                    {links.map((link) => (
                      <NavLink
                        key={link.to}
                        to={link.to}
                        onClick={() => setMobileMenuOpen(false)}
                        className={({ isActive }) =>
                          `flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-all ${
                            isActive
                              ? 'bg-macon-orange text-white'
                              : 'text-macon-navy-200 hover:bg-macon-navy-800 hover:text-white'
                          }`
                        }
                      >
                        <link.icon className="w-5 h-5" />
                        {link.label}
                      </NavLink>
                    ))}
                  </nav>

                  {/* User Info & Logout */}
                  <div className="mt-auto pt-4 border-t border-macon-navy-700">
                    <div className="px-4 py-2 mb-2">
                      <p className="text-sm text-macon-navy-300">{user?.email}</p>
                    </div>
                    <Button
                      variant="ghost"
                      onClick={logout}
                      className="w-full justify-start text-macon-navy-200 hover:text-white"
                    >
                      <LogOut className="w-4 h-4 mr-3" />
                      Logout
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* Desktop User Menu */}
          <div className="hidden md:flex items-center gap-3">
            {/* ... existing desktop user menu ... */}
          </div>
        </div>
      </div>
    </nav>
  );
}
```

**Acceptance Criteria:**

- [ ] Hamburger menu icon visible on mobile (<768px)
- [ ] Menu slides in from right side
- [ ] Menu closes on navigation
- [ ] Menu closes on backdrop click
- [ ] Menu is keyboard accessible (Escape to close)
- [ ] Focus trapped in menu when open
- [ ] Desktop navigation hidden on mobile, mobile hidden on desktop

**Testing Checklist:**

- [ ] Mobile test: menu opens and closes
- [ ] Keyboard test: Tab, Escape, Enter work
- [ ] Accessibility test: screen reader announces menu state
- [ ] Touch test: menu responsive to touch on mobile devices

**Risk Level:** Medium
**Rollback Plan:** Show simplified mobile nav (no hamburger)

---

#### Task 7.3: Responsive Tables (Card View) (Already in Phase 1) (0.5 days)

**Priority:** High
**Assigned To:** Frontend Developer
**Estimated Effort:** 4 hours (enhancements)

**Description:**
Enhance the ResponsiveTable component created in Phase 1.

**Implementation Details:**

**Enhancements:**

1. Add swipe gestures for card navigation
2. Improve card layout density
3. Add "Show more" expansion for long content

**File:** `/Users/mikeyoung/CODING/MAIS/client/src/components/ui/responsive-table.tsx`

```tsx
// Add to card view
<Card key={keyExtractor(item)} className="bg-surface-variant">
  <CardContent className="p-4">
    {/* Primary info (always visible) */}
    <div className="mb-3">
      <h3 className="text-heading-4 text-on-surface mb-1">{columns[0].accessor(item)}</h3>
      <p className="text-body-small text-on-surface-variant">{columns[1].accessor(item)}</p>
    </div>

    {/* Collapsible details */}
    <Collapsible>
      <CollapsibleTrigger className="text-sm text-secondary font-medium">
        Show details
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3 space-y-2">
        {columns
          .slice(2)
          .filter((col) => !col.mobileHidden)
          .map((col, idx) => (
            <div key={idx} className="flex justify-between py-1">
              <span className="text-sm text-on-surface-variant">{col.header}</span>
              <span className="text-sm text-on-surface">{col.accessor(item)}</span>
            </div>
          ))}
      </CollapsibleContent>
    </Collapsible>

    {/* Actions */}
    {actions && <div className="mt-3 pt-3 border-t border-outline flex gap-2">{actions(item)}</div>}
  </CardContent>
</Card>
```

**Acceptance Criteria:**

- [ ] Card view shows primary info prominently
- [ ] "Show details" expands to reveal all fields
- [ ] Actions (edit, delete) easily accessible
- [ ] Card spacing optimized for mobile (not too cramped)

**Testing Checklist:**

- [ ] Mobile test: card view is easy to read and interact with
- [ ] Touch test: buttons are >44px touch targets

**Risk Level:** Low
**Rollback Plan:** Use simple card view from Phase 1

---

#### Task 7.4: Responsive Forms (1 day)

**Priority:** Medium
**Assigned To:** Frontend Developer
**Estimated Effort:** 8 hours

**Description:**
Ensure all forms are usable on mobile with proper input sizes and spacing.

**Implementation Details:**

**Form Layout Pattern:**

**Before:**

```tsx
<form className="grid grid-cols-2 gap-4">
  <Input label="First Name" />
  <Input label="Last Name" />
</form>
```

**After:**

```tsx
<form className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <InputEnhanced label="First Name" />
  <InputEnhanced label="Last Name" />
</form>
```

**Mobile Form Best Practices:**

1. Single column on mobile (320px-640px)
2. Input height: min-h-14 (56px - easy to tap)
3. Label spacing: mb-2 (8px)
4. Button width: full width on mobile, auto on desktop
5. Form spacing: space-y-6 (24px between fields)

**Files to Update:**

- `/Users/mikeyoung/CODING/MAIS/client/src/features/admin/tenants/TenantForm.tsx`
- `/Users/mikeyoung/CODING/MAIS/client/src/features/admin/packages/PackageForm.tsx`
- `/Users/mikeyoung/CODING/MAIS/client/src/pages/Login.tsx`

**Acceptance Criteria:**

- [ ] All forms single column on mobile
- [ ] Input fields easy to tap (min 44px height)
- [ ] Labels clearly associated with inputs
- [ ] Submit buttons full width on mobile
- [ ] Form fits viewport without horizontal scroll

**Testing Checklist:**

- [ ] Mobile test: forms usable on iPhone SE (320px)
- [ ] Touch test: inputs easy to focus
- [ ] Keyboard test: virtual keyboard doesn't obscure inputs

**Risk Level:** Low
**Rollback Plan:** Keep desktop layout on mobile (suboptimal but functional)

---

### Week 8: Accessibility Improvements

#### Task 8.1: Color Contrast Audit & Fixes (1.5 days)

**Priority:** Critical
**Assigned To:** Frontend Developer + Accessibility Specialist
**Estimated Effort:** 12 hours

**Description:**
Audit all text/background color combinations and fix WCAG AA failures.

**Implementation Details:**

**Audit Process:**

1. Use automated tool (axe DevTools, Lighthouse)
2. Manually check all color combinations
3. Test with contrast checker (WebAIM Contrast Checker)
4. Document failures and fixes

**Common Failures & Fixes:**

| Element            | Current                                      | Contrast | Fix                            | New Contrast |
| ------------------ | -------------------------------------------- | -------- | ------------------------------ | ------------ |
| Metric labels      | `text-macon-navy-300` on `bg-macon-navy-800` | 2.8:1 ❌ | `text-macon-navy-200`          | 4.6:1 ✅     |
| Table text         | `text-macon-navy-200` on `bg-macon-navy-900` | 3.1:1 ❌ | `text-macon-navy-100`          | 5.2:1 ✅     |
| Orange button text | `text-white` on `bg-macon-orange`            | 3.2:1 ⚠️ | Darken orange or use navy text | 4.5:1 ✅     |

**Semantic Token Updates:**

**File:** `/Users/mikeyoung/CODING/MAIS/client/src/styles/tokens.css`

```css
[data-theme='dark'] {
  /* Increase contrast for text */
  --color-on-surface: 241 242 246; /* Navy 50 - lighter */
  --color-on-surface-variant: 199 202 215; /* Navy 200 - lighter */
  --color-on-surface-subtle: 163 168 190; /* Navy 300 - lighter */
}
```

**Acceptance Criteria:**

- [ ] All text has ≥4.5:1 contrast (normal text)
- [ ] All large text (≥18px or ≥14px bold) has ≥3:1 contrast
- [ ] UI components (buttons, borders) have ≥3:1 contrast
- [ ] No automated accessibility tool failures for contrast
- [ ] Manual review confirms readability

**Testing Checklist:**

- [ ] Automated: axe DevTools shows 0 contrast errors
- [ ] Automated: Lighthouse accessibility score >95
- [ ] Manual: WebAIM Contrast Checker for all combinations
- [ ] User test: test with low-vision user or simulator

**Risk Level:** Medium (visual changes)
**Rollback Plan:** Revert color token changes

---

#### Task 8.2: Keyboard Navigation Enhancements (1.5 days)

**Priority:** High
**Assigned To:** Frontend Developer
**Estimated Effort:** 12 hours

**Description:**
Ensure all interactive elements are keyboard accessible and focus is visible.

**Implementation Details:**

**1. Focus Ring System:**

**File:** `/Users/mikeyoung/CODING/MAIS/client/src/styles/focus.css`

```css
@layer utilities {
  /* Custom focus ring (more visible than default) */
  .focus-ring {
    @apply focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-surface;
  }

  .focus-ring-inset {
    @apply focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-secondary;
  }
}
```

**2. Skip to Content Link:**

**File:** `/Users/mikeyoung/CODING/MAIS/client/src/components/layout/SkipToContent.tsx`

```tsx
export function SkipToContent() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-secondary focus:text-white focus:rounded-lg focus:shadow-lg focus-ring"
    >
      Skip to main content
    </a>
  );
}
```

**3. Focus Trapping in Modals:**

**File:** `/Users/mikeyoung/CODING/MAIS/client/src/hooks/useFocusTrap.ts`

```tsx
import { useEffect, useRef } from 'react';

export function useFocusTrap(isOpen: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const container = containerRef.current;
    if (!container) return;

    const focusableElements = container.querySelectorAll(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    firstElement?.focus();

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    container.addEventListener('keydown', handleTab);
    return () => container.removeEventListener('keydown', handleTab);
  }, [isOpen]);

  return containerRef;
}
```

**4. Keyboard Shortcuts:**

**File:** `/Users/mikeyoung/CODING/MAIS/client/src/hooks/useKeyboardShortcuts.ts`

```tsx
import { useEffect } from 'react';

export function useKeyboardShortcuts() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // "/" focuses search
      if (e.key === '/' && !isInputFocused()) {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
      }

      // "?" shows keyboard shortcut overlay
      if (e.key === '?' && !isInputFocused()) {
        e.preventDefault();
        // Show keyboard shortcuts modal (Phase 4)
      }

      // "Escape" closes modals/overlays
      if (e.key === 'Escape') {
        // Close any open modals
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}

function isInputFocused() {
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName || '');
}
```

**Acceptance Criteria:**

- [ ] All interactive elements reachable via Tab
- [ ] Focus ring visible on all focusable elements
- [ ] Skip to content link appears on first Tab
- [ ] Modals trap focus (Tab cycles within modal)
- [ ] Escape closes modals
- [ ] "/" focuses search bar
- [ ] Logical tab order (top-to-bottom, left-to-right)

**Testing Checklist:**

- [ ] Keyboard test: navigate entire app without mouse
- [ ] Tab order test: follows visual hierarchy
- [ ] Focus test: focus ring visible at all times
- [ ] Screen reader test: focus announcements correct

**Risk Level:** Medium
**Rollback Plan:** Revert focus ring changes

---

#### Task 8.3: ARIA Attributes & Screen Reader Support (1.5 days)

**Priority:** High
**Assigned To:** Frontend Developer + Accessibility Specialist
**Estimated Effort:** 12 hours

**Description:**
Add comprehensive ARIA attributes for screen reader users.

**Implementation Details:**

**1. Landmarks:**

```tsx
<header role="banner">
  <AdminNav />
</header>

<main id="main-content" role="main">
  {/* Page content */}
</main>

<footer role="contentinfo">
  {/* Footer */}
</footer>
```

**2. Live Regions:**

```tsx
// Toast notifications
<div
  role="status"
  aria-live="polite"
  aria-atomic="true"
>
  {toastMessage}
</div>

// Loading states
<div
  role="status"
  aria-live="polite"
  aria-busy={isLoading}
>
  {isLoading ? 'Loading...' : content}
</div>
```

**3. Form Labels:**

```tsx
// Ensure all inputs have labels
<label htmlFor="email" className="text-label">
  Email Address
</label>
<Input
  id="email"
  type="email"
  aria-required="true"
  aria-invalid={!!errors.email}
  aria-describedby={errors.email ? 'email-error' : undefined}
/>
{errors.email && (
  <p id="email-error" className="text-danger-600 text-sm" role="alert">
    {errors.email}
  </p>
)}
```

**4. Button Labels:**

```tsx
// Icon-only buttons need aria-label
<Button variant="ghost" size="icon" aria-label="Help">
  <HelpCircle className="w-5 h-5" />
</Button>

<Button variant="ghost" size="icon" aria-label="Close">
  <X className="w-5 h-5" />
</Button>
```

**5. Table Semantics:**

```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead scope="col">Tenant</TableHead>
      <TableHead scope="col">Email</TableHead>
      <TableHead scope="col">Status</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>{tenant.name}</TableCell>
      <TableCell>{tenant.email}</TableCell>
      <TableCell>
        <span role="status" aria-label={`Status: ${tenant.status}`}>
          {tenant.status}
        </span>
      </TableCell>
    </TableRow>
  </TableBody>
</Table>
```

**6. Dialog/Modal Accessibility:**

```tsx
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent aria-labelledby="dialog-title" aria-describedby="dialog-description">
    <DialogHeader>
      <DialogTitle id="dialog-title">Confirm Deletion</DialogTitle>
      <DialogDescription id="dialog-description">
        This action cannot be undone. Are you sure?
      </DialogDescription>
    </DialogHeader>
    {/* ... */}
  </DialogContent>
</Dialog>
```

**Acceptance Criteria:**

- [ ] All landmarks present (header, main, footer, nav)
- [ ] All forms have proper labels and error associations
- [ ] All icon buttons have aria-label
- [ ] All live regions have aria-live
- [ ] All modals have aria-labelledby and aria-describedby
- [ ] All status updates announced by screen reader

**Testing Checklist:**

- [ ] Screen reader test (VoiceOver, NVDA): all content announced
- [ ] Automated: axe DevTools shows 0 ARIA errors
- [ ] Automated: Lighthouse accessibility score >95

**Risk Level:** Low
**Rollback Plan:** Remove ARIA attributes (graceful degradation)

---

### Week 9: Theme Toggle & Performance

#### Task 9.1: Implement Light/Dark Theme Toggle (2 days)

**Priority:** Medium
**Assigned To:** Frontend Developer
**Estimated Effort:** 16 hours

**Description:**
Add theme toggle functionality for users to switch between light and dark themes.

**Implementation Details:**

**1. Theme Provider:**

**File:** `/Users/mikeyoung/CODING/MAIS/client/src/providers/ThemeProvider.tsx`

```tsx
import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('theme') as Theme) || 'system';
  });

  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const root = document.documentElement;

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
      setResolvedTheme(systemTheme);
      root.setAttribute('data-theme', systemTheme);
    } else {
      setResolvedTheme(theme);
      root.setAttribute('data-theme', theme);
    }

    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') {
        const systemTheme = mediaQuery.matches ? 'dark' : 'light';
        setResolvedTheme(systemTheme);
        document.documentElement.setAttribute('data-theme', systemTheme);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
```

**2. Theme Toggle Component:**

**File:** `/Users/mikeyoung/CODING/MAIS/client/src/components/ui/theme-toggle.tsx`

```tsx
import { Moon, Sun, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTheme } from '@/providers/ThemeProvider';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Toggle theme">
          <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:rotate-90 dark:scale-0" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme('light')}>
          <Sun className="mr-2 h-4 w-4" />
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')}>
          <Moon className="mr-2 h-4 w-4" />
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')}>
          <Monitor className="mr-2 h-4 w-4" />
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

**3. Integration:**

```tsx
// In AdminNav.tsx
<div className="flex items-center gap-3">
  <ThemeToggle />
  <Button variant="ghost" size="icon" aria-label="Help">
    <HelpCircle className="w-5 h-5" />
  </Button>
  {/* ... */}
</div>
```

**Acceptance Criteria:**

- [ ] Theme toggle visible in admin navigation
- [ ] Light theme uses white backgrounds, dark text
- [ ] Dark theme uses navy backgrounds, light text
- [ ] System theme follows OS preference
- [ ] Theme persists in localStorage
- [ ] Theme changes instantly (no flicker)
- [ ] All components adapt to theme

**Testing Checklist:**

- [ ] Functional test: toggle between light/dark/system
- [ ] Persistence test: theme persists on refresh
- [ ] System test: follows OS dark mode setting
- [ ] Visual test: all components readable in both themes

**Risk Level:** Medium
**Rollback Plan:** Remove theme toggle, default to dark theme

---

#### Task 9.2: Performance Optimization (1.5 days)

**Priority:** Medium
**Assigned To:** Frontend Developer
**Estimated Effort:** 12 hours

**Description:**
Optimize bundle size, implement code splitting, and lazy load components.

**Implementation Details:**

**1. Route-Based Code Splitting:**

**File:** `/Users/mikeyoung/CODING/MAIS/client/src/router.tsx`

```tsx
import { lazy, Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { Loading } from '@/components/ui/loading';

// Lazy load route components
const Home = lazy(() => import('@/pages/Home'));
const Login = lazy(() => import('@/pages/Login'));
const PlatformAdminDashboard = lazy(() => import('@/pages/admin/PlatformAdminDashboard'));
const TenantAdminDashboard = lazy(() => import('@/pages/tenant/TenantAdminDashboard'));

export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <Suspense fallback={<Loading />}>
        <Home />
      </Suspense>
    ),
  },
  {
    path: '/login',
    element: (
      <Suspense fallback={<Loading />}>
        <Login />
      </Suspense>
    ),
  },
  {
    path: '/admin/dashboard',
    element: (
      <Suspense fallback={<Loading fullScreen />}>
        <PlatformAdminDashboard />
      </Suspense>
    ),
  },
  // ... more routes
]);
```

**2. Component Lazy Loading:**

```tsx
// Lazy load heavy components (charts, etc.)
const DataVisualization = lazy(() => import('@/features/analytics/DataVisualization'));

function Dashboard() {
  return (
    <div>
      <DashboardMetrics />
      <Suspense fallback={<Skeleton className="h-64" />}>
        <DataVisualization />
      </Suspense>
    </div>
  );
}
```

**3. Image Optimization:**

```tsx
// Use responsive images
<img
  src="/logo.svg"
  alt="Macon AI"
  loading="lazy"
  className="h-8 w-auto"
/>

// For raster images, use srcset
<img
  src="/hero-image-800.webp"
  srcSet="/hero-image-400.webp 400w, /hero-image-800.webp 800w, /hero-image-1200.webp 1200w"
  sizes="(max-width: 640px) 400px, (max-width: 1024px) 800px, 1200px"
  alt="Hero image"
  loading="lazy"
/>
```

**4. Bundle Analysis:**

```bash
# Add to package.json scripts
"analyze": "vite-bundle-analyzer"

# Run analysis
npm run analyze
```

**Acceptance Criteria:**

- [ ] Initial bundle size <500KB (gzipped)
- [ ] Route chunks <200KB each
- [ ] Time to Interactive <3s on 3G
- [ ] Lighthouse Performance score >90
- [ ] No layout shift (CLS <0.1)
- [ ] Images lazy loaded below fold

**Testing Checklist:**

- [ ] Performance test: Lighthouse audit
- [ ] Bundle test: bundle size analysis
- [ ] Network test: 3G throttling test
- [ ] User test: perceived performance improvement

**Risk Level:** Low
**Rollback Plan:** Remove lazy loading, revert to eager loading

---

## Phase 3 Deliverables Checklist

- [ ] **Responsive Design**
  - [ ] Metric cards stack properly on mobile
  - [ ] Mobile hamburger menu functional
  - [ ] Tables show card view on mobile
  - [ ] Forms single column on mobile
  - [ ] All pages tested at 320px, 768px, 1024px, 1920px

- [ ] **Accessibility**
  - [ ] Color contrast ≥4.5:1 for all text
  - [ ] All interactive elements keyboard accessible
  - [ ] Focus ring visible on all elements
  - [ ] Skip to content link functional
  - [ ] ARIA attributes comprehensive
  - [ ] Screen reader tested (VoiceOver, NVDA)
  - [ ] Lighthouse accessibility score >95

- [ ] **Theme Toggle**
  - [ ] Light/dark theme toggle functional
  - [ ] Theme persists in localStorage
  - [ ] System theme follows OS preference
  - [ ] All components theme-aware

- [ ] **Performance**
  - [ ] Route-based code splitting implemented
  - [ ] Heavy components lazy loaded
  - [ ] Images optimized and lazy loaded
  - [ ] Lighthouse Performance score >90

---

## Testing Strategy for Phase 3

### Accessibility Testing

- Automated: axe DevTools, Lighthouse
- Manual: keyboard navigation test
- Screen reader: VoiceOver (macOS/iOS), NVDA (Windows)
- User testing: test with users with disabilities

### Responsive Testing

- Device lab: iPhone SE, iPhone 14, iPad, Android phones/tablets
- Browser DevTools: responsive mode at key breakpoints
- Real devices: borrow or rent devices for testing

### Performance Testing

- Lighthouse CI: automated performance audits
- WebPageTest: 3G throttling tests
- Bundle analysis: monitor bundle size over time

---

## Success Metrics (Phase 3)

| Metric                         | Before Phase 3 | After Phase 3 | Target |
| ------------------------------ | -------------- | ------------- | ------ |
| WCAG AA Compliance             | ~60%           | 95%+          | 95%+   |
| Lighthouse Accessibility Score | 75             | 98            | 95+    |
| Mobile Admin Usability         | 20%            | 90%           | 90%    |
| Keyboard Navigation            | 40%            | 100%          | 100%   |
| Lighthouse Performance Score   | 75             | 92            | 90+    |
| Mobile Users (Admin)           | 5%             | 40%           | 30%+   |

---

## Next Steps

After completing Phase 3:

1. ✅ Deploy all Phase 3 changes to production
2. 📊 Measure success metrics (1 week monitoring)
3. 🐛 Bug fixing period (2-3 days)
4. 📋 Review Phase 4 plan: `04_PHASE_4_POLISH_SCALE.md`
5. 🎯 Phase 4 kickoff meeting
