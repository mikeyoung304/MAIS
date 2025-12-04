# Phase 2: Brand Unification & Design System

**Duration:** Weeks 4-6 (15 business days)
**Team:** 1 Senior Frontend Developer, 0.5 UI/UX Designer, 0.25 QA Engineer
**Goal:** Consistent brand experience across all touchpoints, design system enforcement

---

## Phase Overview

Phase 2 focuses on **brand unification** and **design system consistency**. We'll bring the vibrant Macon brand colors (orange, teal, navy) into the admin interfaces, refactor components to use the variant system, and create reusable abstractions to reduce code duplication.

### Success Criteria

- ✅ Admin interfaces feel like the same product as marketing pages
- ✅ Orange CTAs appear consistently throughout admin dashboards
- ✅ All components use variant system (no custom className overrides)
- ✅ Typography scale is consistent and semantic
- ✅ Metric cards are abstracted into reusable component
- ✅ Brand logo appears in all admin headers

---

## Task Breakdown

### Week 4: Color Palette Unification

#### Task 4.1: Define Semantic Color Tokens (1 day)

**Priority:** Critical
**Assigned To:** Frontend Developer + Designer
**Estimated Effort:** 8 hours

**Description:**
Create semantic color tokens that map to brand colors and enable theme switching.

**Implementation Details:**

**File:** `/Users/mikeyoung/CODING/MAIS/client/src/styles/tokens.css`

```css
@layer base {
  :root {
    /* Surface colors */
    --color-surface: 255 255 255; /* White */
    --color-surface-variant: 243 244 246; /* Neutral 100 */
    --color-surface-elevated: 255 255 255; /* White */

    /* Brand colors */
    --color-primary: 26 54 93; /* Macon Navy */
    --color-primary-foreground: 255 255 255;
    --color-secondary: 251 146 60; /* Macon Orange */
    --color-secondary-foreground: 255 255 255;
    --color-accent: 56 178 172; /* Macon Teal */
    --color-accent-foreground: 255 255 255;

    /* Text colors */
    --color-on-surface: 17 24 39; /* Neutral 900 */
    --color-on-surface-variant: 107 114 128; /* Neutral 500 */
    --color-on-surface-subtle: 209 213 219; /* Neutral 300 */

    /* Border and outline */
    --color-outline: 229 231 235; /* Neutral 200 */
    --color-outline-variant: 243 244 246; /* Neutral 100 */

    /* Status colors */
    --color-success: 34 197 94;
    --color-success-foreground: 255 255 255;
    --color-danger: 239 68 68;
    --color-danger-foreground: 255 255 255;
    --color-warning: 245 158 11;
    --color-warning-foreground: 255 255 255;
  }

  /* Dark theme for admin dashboards */
  [data-theme='dark'] {
    /* Surface colors */
    --color-surface: 36 38 63; /* Navy 900 */
    --color-surface-variant: 48 51 77; /* Navy 800 */
    --color-surface-elevated: 58 60 138; /* Navy 700 */

    /* Text colors (inverted) */
    --color-on-surface: 241 242 246; /* Navy 50 */
    --color-on-surface-variant: 163 168 190; /* Navy 300 */
    --color-on-surface-subtle: 122 132 160; /* Navy 400 */

    /* Border and outline */
    --color-outline: 74 78 105; /* Navy 600 */
    --color-outline-variant: 61 64 91; /* Navy 700 */
  }
}
```

**Update Tailwind Config:**

**File:** `/Users/mikeyoung/CODING/MAIS/client/tailwind.config.js`

```js
// Add to theme.extend.colors
colors: {
  // ... existing colors ...

  // Semantic tokens
  surface: {
    DEFAULT: 'rgb(var(--color-surface) / <alpha-value>)',
    variant: 'rgb(var(--color-surface-variant) / <alpha-value>)',
    elevated: 'rgb(var(--color-surface-elevated) / <alpha-value>)',
  },
  'on-surface': {
    DEFAULT: 'rgb(var(--color-on-surface) / <alpha-value>)',
    variant: 'rgb(var(--color-on-surface-variant) / <alpha-value>)',
    subtle: 'rgb(var(--color-on-surface-subtle) / <alpha-value>)',
  },
  outline: {
    DEFAULT: 'rgb(var(--color-outline) / <alpha-value>)',
    variant: 'rgb(var(--color-outline-variant) / <alpha-value>)',
  },
}
```

**Acceptance Criteria:**

- [ ] CSS variables defined for all semantic colors
- [ ] Light theme (default) uses white surface, dark text
- [ ] Dark theme uses navy surface, light text
- [ ] Tailwind config exposes semantic tokens as utilities
- [ ] Documentation created explaining token usage

**Testing Checklist:**

- [ ] Visual test: light theme renders correctly
- [ ] Visual test: dark theme renders correctly
- [ ] Unit test: CSS variables are defined

**Risk Level:** Medium (affects many components)
**Rollback Plan:** Revert to direct color usage

---

#### Task 4.2: Refactor Admin Dashboards to Use Semantic Tokens (2 days)

**Priority:** High
**Assigned To:** Frontend Developer
**Estimated Effort:** 16 hours

**Description:**
Replace all hardcoded color classes with semantic token classes.

**Implementation Details:**

**Before:**

```tsx
<Card className="bg-macon-navy-800 border-macon-navy-600">
  <CardContent className="p-6">
    <h3 className="text-macon-navy-50">Total Tenants</h3>
    <p className="text-4xl font-bold text-macon-navy-300">12</p>
  </CardContent>
</Card>
```

**After:**

```tsx
<Card className="bg-surface-variant border-outline">
  <CardContent className="p-6">
    <h3 className="text-on-surface">Total Tenants</h3>
    <p className="text-4xl font-bold text-on-surface">12</p>
  </CardContent>
</Card>
```

**Files to Update:**

- `/Users/mikeyoung/CODING/MAIS/client/src/pages/admin/PlatformAdminDashboard.tsx`
- `/Users/mikeyoung/CODING/MAIS/client/src/pages/tenant/TenantAdminDashboard.tsx`
- `/Users/mikeyoung/CODING/MAIS/client/src/features/admin/dashboard/components/DashboardMetrics.tsx`

**Acceptance Criteria:**

- [ ] All admin pages use semantic tokens
- [ ] No hardcoded macon-navy-XXX classes in components
- [ ] Theme switching works (light/dark toggle in Phase 3)
- [ ] Visual appearance unchanged

**Testing Checklist:**

- [ ] Visual regression test: no visual changes
- [ ] Theme test: dark theme still renders correctly
- [ ] Unit test: components render with correct classes

**Risk Level:** Medium
**Rollback Plan:** Git revert, restore hardcoded colors

---

#### Task 4.3: Add Orange CTAs Throughout Admin (1 day)

**Priority:** High
**Assigned To:** Frontend Developer
**Estimated Effort:** 8 hours

**Description:**
Replace navy primary buttons with orange secondary variant for all CTAs.

**Implementation Details:**

**Before:**

```tsx
<Button className="bg-macon-navy hover:bg-macon-navy-dark">Add Tenant</Button>
```

**After:**

```tsx
<Button variant="secondary">Add Tenant</Button>
```

**Update Button Component:**

**File:** `/Users/mikeyoung/CODING/MAIS/client/src/components/ui/button.tsx`

Ensure `variant="secondary"` uses Macon Orange:

```tsx
const buttonVariants = cva('...', {
  variants: {
    variant: {
      default: 'bg-primary text-primary-foreground hover:bg-primary/90',
      secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/90 shadow-elevation-2',
      // ... other variants
    },
  },
});
```

**Files to Update:**

- All "Add X" buttons in admin dashboards
- All "Create X" buttons
- All primary action buttons
- Navigation active state (already orange in Phase 1)

**Acceptance Criteria:**

- [ ] Primary CTAs are orange (secondary variant)
- [ ] Destructive actions remain red (danger variant)
- [ ] Neutral actions remain navy (default variant)
- [ ] Hover states work correctly
- [ ] Focus rings visible and accessible

**Testing Checklist:**

- [ ] Visual test: orange buttons throughout admin
- [ ] Interaction test: hover, active, focus states
- [ ] Accessibility test: color contrast passes WCAG AA

**Risk Level:** Low
**Rollback Plan:** Revert button variant changes

---

### Week 5: Typography & Component Refactoring

#### Task 5.1: Create Typography System (1 day)

**Priority:** Medium
**Assigned To:** Frontend Developer
**Estimated Effort:** 8 hours

**Description:**
Create semantic typography classes based on the defined scale.

**Implementation Details:**

**File:** `/Users/mikeyoung/CODING/MAIS/client/src/styles/typography.css`

```css
@layer components {
  /* Display typography */
  .text-display-1 {
    @apply text-[72px] leading-[1.15] font-bold tracking-tight;
  }
  .text-display-2 {
    @apply text-[60px] leading-[1.2] font-bold tracking-tight;
  }
  .text-display-3 {
    @apply text-[48px] leading-[1.25] font-bold tracking-tight;
  }

  /* Heading typography */
  .text-heading-1 {
    @apply text-4xl font-bold leading-tight;
  }
  .text-heading-2 {
    @apply text-3xl font-bold leading-tight;
  }
  .text-heading-3 {
    @apply text-2xl font-semibold leading-snug;
  }
  .text-heading-4 {
    @apply text-xl font-semibold leading-snug;
  }

  /* Body typography */
  .text-body-large {
    @apply text-lg leading-relaxed;
  }
  .text-body {
    @apply text-base leading-relaxed;
  }
  .text-body-small {
    @apply text-sm leading-relaxed;
  }

  /* Label typography */
  .text-label-large {
    @apply text-sm font-medium leading-tight;
  }
  .text-label {
    @apply text-xs font-medium leading-tight uppercase tracking-wide;
  }

  /* Responsive display */
  .text-display-responsive {
    @apply text-5xl leading-[1.15] font-bold tracking-tight;
    @apply sm:text-6xl md:text-7xl lg:text-8xl;
  }
}
```

**Refactor Components:**

**Before:**

```tsx
<h1 className="text-4xl font-bold text-macon-navy-50">Platform Admin Dashboard</h1>
<p className="text-lg text-macon-navy-300">Manage all tenants and system settings</p>
```

**After:**

```tsx
<h1 className="text-heading-1 text-on-surface">Platform Admin Dashboard</h1>
<p className="text-body-large text-on-surface-variant">Manage all tenants and system settings</p>
```

**Acceptance Criteria:**

- [ ] Typography classes defined for all levels
- [ ] Responsive classes for marketing pages
- [ ] Line height and font weight consistent
- [ ] All headings use semantic classes
- [ ] Documentation created

**Testing Checklist:**

- [ ] Visual test: typography scales correctly
- [ ] Responsive test: responsive classes work at all breakpoints
- [ ] Consistency check: same semantic level = same appearance

**Risk Level:** Low
**Rollback Plan:** Revert to utility classes

---

#### Task 5.2: Refactor Card Component Usage (1.5 days)

**Priority:** Medium
**Assigned To:** Frontend Developer
**Estimated Effort:** 12 hours

**Description:**
Ensure all Card components use colorScheme prop instead of custom classes.

**Implementation Details:**

**Update Card Component:**

**File:** `/Users/mikeyoung/CODING/MAIS/client/src/components/ui/card.tsx`

Ensure colorScheme variants are well-defined:

```tsx
const cardVariants = cva('rounded-xl border transition-all duration-300', {
  variants: {
    colorScheme: {
      default: 'bg-surface border-outline',
      navy: 'bg-surface-variant border-outline',
      orange: 'bg-secondary/10 border-secondary/20',
      teal: 'bg-accent/10 border-accent/20',
      elevated: 'bg-surface-elevated border-outline shadow-elevation-2',
    },
  },
  defaultVariants: {
    colorScheme: 'default',
  },
});
```

**Refactor Usage:**

**Before:**

```tsx
<Card className="bg-macon-navy-800 border-macon-navy-600 hover:border-macon-orange/50">
```

**After:**

```tsx
<Card colorScheme="navy" className="hover:border-secondary/50">
```

**Files to Update:**

- All metric cards in dashboards
- All feature cards on marketing page
- All content cards throughout app

**Acceptance Criteria:**

- [ ] All cards use colorScheme prop
- [ ] No bg-macon-navy-XXX classes on cards
- [ ] Hover effects preserved
- [ ] Shadow elevation consistent

**Testing Checklist:**

- [ ] Visual test: cards render correctly
- [ ] Interaction test: hover effects work
- [ ] Theme test: cards adapt to theme

**Risk Level:** Low
**Rollback Plan:** Revert to custom classes

---

#### Task 5.3: Create MetricCard Component (1 day)

**Priority:** Medium
**Assigned To:** Frontend Developer
**Estimated Effort:** 8 hours

**Description:**
Abstract repeated metric card structure into reusable component.

**Implementation Details:**

**File:** `/Users/mikeyoung/CODING/MAIS/client/src/components/ui/metric-card.tsx`

```tsx
import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  icon?: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  colorScheme?: 'default' | 'navy' | 'orange' | 'teal';
  onClick?: () => void;
}

export function MetricCard({
  label,
  value,
  sublabel,
  icon: Icon,
  trend,
  trendValue,
  colorScheme = 'navy',
  onClick,
}: MetricCardProps) {
  const trendColors = {
    up: 'text-green-500',
    down: 'text-red-500',
    neutral: 'text-on-surface-variant',
  };

  const trendIcons = {
    up: '↗',
    down: '↘',
    neutral: '→',
  };

  return (
    <Card
      colorScheme={colorScheme}
      className={`hover:shadow-elevation-3 transition-all ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-label text-on-surface-variant">{label}</h3>
          {Icon && <Icon className="w-5 h-5 text-on-surface-subtle" />}
        </div>

        <div className="mb-2">
          <p className="text-4xl font-bold text-on-surface">{value}</p>
        </div>

        {(sublabel || trend) && (
          <div className="flex items-center gap-2">
            {trend && (
              <span className={`text-sm font-medium ${trendColors[trend]}`}>
                {trendIcons[trend]} {trendValue}
              </span>
            )}
            {sublabel && <span className="text-sm text-on-surface-variant">{sublabel}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

**Usage:**

**Before:**

```tsx
<Card className="bg-macon-navy-800 border-macon-navy-600">
  <CardContent className="p-6">
    <h3 className="text-lg font-medium text-macon-navy-300 mb-3">Total Tenants</h3>
    <p className="text-4xl font-bold text-macon-navy-50 mb-2">12</p>
    <p className="text-sm text-macon-navy-400">5 active, 7 pending</p>
  </CardContent>
</Card>
```

**After:**

```tsx
<MetricCard
  label="Total Tenants"
  value={12}
  sublabel="5 active, 7 pending"
  icon={Building2}
  trend="up"
  trendValue="+3 this month"
  onClick={() => navigate('/admin/tenants')}
/>
```

**Acceptance Criteria:**

- [ ] Component renders all variants correctly
- [ ] Icons optional, positioned correctly
- [ ] Trend indicators show up/down/neutral
- [ ] Click handler optional (makes card clickable)
- [ ] Color scheme variants work
- [ ] Used in all dashboard metric sections

**Testing Checklist:**

- [ ] Unit test: all props render correctly
- [ ] Unit test: click handler fires
- [ ] Visual test: matches original design
- [ ] Accessibility test: clickable cards have role="button"

**Risk Level:** Low
**Rollback Plan:** Revert to inline metric cards

---

### Week 6: Brand Elements & Logo Integration

#### Task 6.1: Add Macon Logo to Admin Headers (0.5 days)

**Priority:** High
**Assigned To:** Designer + Frontend Developer
**Estimated Effort:** 4 hours

**Description:**
Create logo asset and integrate into all admin navigation bars.

**Implementation Details:**

**Designer Task:**

- Export logo as SVG (transparent background)
- Create light version (for dark backgrounds)
- Create dark version (for light backgrounds)
- Optimize SVG file size

**File:** `/Users/mikeyoung/CODING/MAIS/client/public/logo-light.svg`

**Integration (already done in Phase 1 AdminNav):**

```tsx
<div className="flex items-center gap-4">
  <img src="/logo-light.svg" alt="Macon AI" className="h-8 w-auto" />
  <Badge className={`${roleBadgeColor} text-white text-xs font-semibold`}>{roleLabel}</Badge>
</div>
```

**Acceptance Criteria:**

- [ ] Logo appears in admin navigation
- [ ] Logo links to dashboard home
- [ ] Logo is properly sized (h-8 / 32px)
- [ ] Logo alt text is descriptive
- [ ] Logo loads quickly (optimized SVG)

**Testing Checklist:**

- [ ] Visual test: logo visible and crisp
- [ ] Responsive test: logo scales on mobile
- [ ] Accessibility test: alt text present

**Risk Level:** Very Low
**Rollback Plan:** Remove logo, keep badge only

---

#### Task 6.2: Create Branded Empty State Illustrations (1 day)

**Priority:** Low
**Assigned To:** Designer
**Estimated Effort:** 8 hours

**Description:**
Design custom illustrations for empty states (no tenants, no packages, etc.).

**Implementation Details:**

**Designer Task:**

- Create 4-5 simple, flat illustrations
- Use Macon brand colors (navy, orange, teal)
- Export as SVG (optimized)
- Style: Modern, minimal, friendly

**Illustrations Needed:**

1. No tenants (building/office icon)
2. No packages (box/gift icon)
3. No bookings (calendar icon)
4. No data/analytics (chart icon)
5. Error state (alert triangle)

**Integration:**

**File:** `/Users/mikeyoung/CODING/MAIS/client/src/components/illustrations/`

```tsx
// NoTenantsIllustration.tsx
export function NoTenantsIllustration() {
  return (
    <svg width="200" height="200" viewBox="0 0 200 200" fill="none">
      {/* SVG paths */}
    </svg>
  );
}
```

**Usage:**

```tsx
<EmptyState icon={<NoTenantsIllustration />} title="No tenants yet" description="..." />
```

**Acceptance Criteria:**

- [ ] Illustrations match brand style
- [ ] Illustrations are colorful but not overwhelming
- [ ] SVGs are optimized (<10KB each)
- [ ] Illustrations work on light and dark backgrounds

**Testing Checklist:**

- [ ] Visual test: illustrations render correctly
- [ ] Performance test: SVGs load quickly

**Risk Level:** Very Low
**Rollback Plan:** Use icon-only empty states

---

#### Task 6.3: Refactor Button Usage Throughout App (1.5 days)

**Priority:** Medium
**Assigned To:** Frontend Developer
**Estimated Effort:** 12 hours

**Description:**
Remove all custom className overrides on Button components, use variant system exclusively.

**Implementation Details:**

**Audit Script:**

```bash
# Find all Button components with custom className
grep -r "Button.*className.*bg-" client/src/
```

**Refactor Pattern:**

**Before:**

```tsx
<Button className="bg-macon-orange hover:bg-macon-orange-dark text-white font-bold text-xl px-12 py-7 shadow-2xl hover:shadow-[0_0_40px_rgba(255,107,53,0.6)] min-w-[300px] min-h-[64px]">
  Apply to Join
</Button>
```

**After:**

```tsx
<Button variant="secondary" size="xl" className="min-w-[300px]">
  Apply to Join
</Button>
```

**Add New Button Size Variant:**

**File:** `/Users/mikeyoung/CODING/MAIS/client/src/components/ui/button.tsx`

```tsx
const buttonVariants = cva('...', {
  variants: {
    variant: {
      /* existing variants */
    },
    size: {
      default: 'h-12 px-6 py-2',
      sm: 'h-9 px-4 text-sm',
      lg: 'h-14 px-8 text-lg',
      xl: 'h-16 px-12 text-xl', // NEW for hero CTAs
      icon: 'h-10 w-10',
    },
  },
});
```

**Files to Update:**

- Marketing home page
- Admin dashboards
- Login page
- All forms

**Acceptance Criteria:**

- [ ] No Button components have bg-\* classes in className
- [ ] All buttons use variant prop
- [ ] All buttons use size prop
- [ ] Custom styling limited to spacing/width only
- [ ] Visual appearance unchanged

**Testing Checklist:**

- [ ] Visual regression test: buttons look the same
- [ ] Interaction test: hover, active, focus states work
- [ ] Unit test: all variants render correctly

**Risk Level:** Medium (many files affected)
**Rollback Plan:** Git revert, restore custom classes

---

## Phase 2 Deliverables Checklist

- [ ] **Color System**
  - [ ] Semantic color tokens defined
  - [ ] CSS variables created
  - [ ] Tailwind config updated
  - [ ] All components use semantic tokens
  - [ ] Theme switching foundation ready

- [ ] **Brand Unification**
  - [ ] Orange CTAs in all admin interfaces
  - [ ] Logo in admin navigation
  - [ ] Branded illustrations for empty states
  - [ ] Consistent color usage (no hardcoded colors)

- [ ] **Typography System**
  - [ ] Semantic typography classes created
  - [ ] All headings use semantic classes
  - [ ] Responsive typography on marketing pages
  - [ ] Documentation created

- [ ] **Component Refactoring**
  - [ ] Card components use colorScheme prop
  - [ ] Button components use variant system
  - [ ] MetricCard component created and used
  - [ ] No custom className overrides for core components

---

## Testing Strategy for Phase 2

### Visual Regression Testing

- Screenshot all pages before refactoring
- Compare after each task
- Ensure no unintended visual changes

### Theme Testing

- Test light theme (default)
- Test dark theme (admin dashboards)
- Test theme switching (Phase 3 will enable toggle)

### Accessibility Testing

- Color contrast audit with new semantic tokens
- Ensure WCAG AA compliance maintained
- Test with automated tools (axe, Lighthouse)

---

## Deployment Strategy

### Week 4 Deployment (End of Week 4)

**Deploy:** Semantic color tokens, admin dashboard refactoring, orange CTAs
**Feature Flag:** `enable_semantic_tokens` (default: true)
**Rollback:** Revert feature flag, restore hardcoded colors

### Week 5 Deployment (End of Week 5)

**Deploy:** Typography system, Card refactoring, MetricCard component
**Feature Flag:** Not needed (low risk, visual-only changes)
**Rollback:** Git revert if visual issues

### Week 6 Deployment (End of Week 6)

**Deploy:** Logo integration, illustrations, Button refactoring
**Feature Flag:** Not needed
**Rollback:** Git revert

---

## Success Metrics (Phase 2)

| Metric                        | Before Phase 2 | After Phase 2 | Target |
| ----------------------------- | -------------- | ------------- | ------ |
| Brand consistency score       | 6/10           | 9/10          | 9/10   |
| Design system adherence       | 40%            | 85%           | 85%    |
| Custom className overrides    | ~200           | <20           | <20    |
| Theme switching ready         | No             | Yes           | Yes    |
| Admin CTAs using brand orange | 0%             | 100%          | 100%   |

---

## Phase 2 Retrospective Template

**Date:** End of Week 6
**Attendees:** Dev, Designer, QA, PM

### What Went Well?

-

### What Could Be Improved?

-

### Blockers Encountered?

-

### Lessons Learned?

-

### Adjustments for Phase 3?

- ***

## Next Steps

After completing Phase 2:

1. ✅ Deploy all Phase 2 changes to production
2. 📊 Measure success metrics (1 week monitoring)
3. 🐛 Bug fixing period (2-3 days)
4. 📋 Review Phase 3 plan: `03_PHASE_3_RESPONSIVE_ACCESSIBLE.md`
5. 🎯 Phase 3 kickoff meeting
