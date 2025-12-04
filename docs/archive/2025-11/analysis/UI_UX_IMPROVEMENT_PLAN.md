# MAIS UI/UX Comprehensive Improvement Plan

**Date**: November 17, 2025
**Current UI Maturity**: 6.5/10
**Target UI Maturity**: 9/10
**Timeline**: 8-12 weeks

---

## Executive Summary

This plan transforms MAIS's UI from a functional but inconsistent interface into a polished, professional wedding booking platform. Inspired by analysis of the July25 Restaurant OS reference application and comprehensive audit of MAIS's current codebase.

### Key Problems Identified

1. **Inconsistent theme usage** - Light/dark themes randomly applied
2. **Weak booking flow** - DatePicker not branded, basic add-on selection
3. **Minimal micro-interactions** - Static forms, no animations
4. **Basic admin interfaces** - Generic tabs, forms lack polish
5. **Missing feedback systems** - No toasts, confirmations, loading states

### Solution Approach

5-phase implementation plan with 20+ specific improvements prioritized by user impact.

---

## Reference Application Analysis

### July25 Restaurant OS - Key Design Patterns

**Visual Excellence:**

- Large, colorful workspace cards (400px wide)
- Vibrant color palette per function:
  - Navy (#2C3E50) - Server
  - Orange (#FF6B35) - Kitchen
  - Turquoise (#4ECDC4) - Kiosk
  - Purple (#8B5CF6) - Online Order
  - Sage Green (#81A684) - Admin
  - Peach (#FFB380) - Expo

**Modal/Dialog Design:**

- Professional authentication modal with backdrop blur
- Clean form hierarchy: label above input
- Blue info banner for demo mode
- Password toggle icon
- Primary CTA with icon
- Alternative login options
- Proper close button

**Typography & Spacing:**

- Clear visual hierarchy
- Generous padding (p-12 on cards)
- Large icons (64px)
- Rounded corners (16-20px)
- Subtle shadows for depth

---

## Current MAIS Assessment

### Strengths (Keep & Enhance)

**1. Design Token System (8/10)**

- 249 tokens defined in `design-tokens.css`
- Macon brand colors (Navy #1a365d, Orange #fb923c, Teal #38b2ac)
- Comprehensive documentation
- File: `client/src/styles/design-tokens.css`

**2. Button Component (8.5/10)**

- 7 variants with rich interactions
- Scale transforms, shadow elevation
- Spring easing animations
- Touch-friendly sizing (44px min)
- File: `client/src/components/ui/button.tsx`

**3. Home Page (8/10)**

- Professional marketing landing
- Playfair Display typography
- Feature sections with icons
- Responsive grids
- File: `client/src/pages/Home.tsx`

**4. Card Component (7.5/10)**

- Hover effects, elevation system
- Subtle gradient overlays
- Smooth transitions
- File: `client/src/components/ui/card.tsx`

### Weaknesses (Priority Fixes)

**1. Inconsistent Theme Usage (4/10)**

- **Problem**: Home uses light, admin uses dark, packages mixed
- **Files Affected**: Multiple pages across `client/src/pages/`
- **Impact**: Jarring user experience, unprofessional feel

**2. Weak Booking Flow (5/10)**

- **Problems**:
  - DatePicker uses default react-day-picker styles (not branded)
  - Add-on selection is basic checkbox list
  - No visual progress indicator
  - TotalBox is plain text
- **Files**:
  - `client/src/features/booking/DatePicker.tsx`
  - `client/src/features/booking/AddOnList.tsx`
  - `client/src/features/booking/TotalBox.tsx`

**3. Basic Admin Interfaces (5.5/10)**

- **Problems**:
  - Plain text tabs without polish
  - Generic forms
  - Missing loading states
- **Files**:
  - `client/src/features/admin/Dashboard.tsx`
  - `client/src/features/tenant-admin/TenantDashboard.tsx`

**4. Minimal Modal/Dialog (3/10)**

- **Problem**: No polished modal component
- **Impact**: Login feels basic, no professional auth flow

**5. Missing Micro-interactions (4/10)**

- No toast notifications
- No confirmation dialogs
- No loading skeletons
- Static form feedback

---

## Implementation Plan

### Phase 1: Foundation & Design System (1-2 weeks)

**Priority**: 🔥 Critical

#### 1.1 Establish Clear Theme Strategy

**Create**: `client/src/styles/theme-zones.md`

**Define Zones:**

```
Customer-Facing (Light Theme):
✓ Home page (already good)
□ Package catalog (needs conversion)
□ Package details (needs conversion)
□ Booking flow (needs consistency)
□ Success page

Admin-Facing (Dark Theme):
✓ Platform admin dashboard (already dark)
✓ Tenant admin dashboard (already dark)
□ Login pages (keep light for accessibility)
```

**Action Items:**

- [ ] Update `PackagePage.tsx` from dark navy-800 to light theme
- [ ] Update `CatalogGrid.tsx` to light theme with white cards
- [ ] Ensure booking flow uses consistent light theme
- [ ] Document theme decision rationale

#### 1.2 Enhanced Modal/Dialog Component

**Inspired by**: July25 authentication modal

**Create/Upgrade**: `client/src/components/ui/dialog.tsx`

**Features:**

- Backdrop blur effect (`backdrop-blur-md`)
- Smooth slide-in animation
- Close button (X in corner)
- Proper composition (Header, Body, Footer)
- Max width variants (sm, md, lg, xl)

**Code Structure:**

```tsx
// dialog.tsx
<Dialog>
  <DialogTrigger />
  <DialogContent className="backdrop-blur-md">
    <DialogHeader>
      <DialogTitle />
      <DialogDescription />
      <DialogClose /> {/* X button */}
    </DialogHeader>
    <DialogBody />
    <DialogFooter />
  </DialogContent>
</Dialog>
```

**Usage Examples:**

- Login modal
- Package delete confirmation
- Add-on editor
- Photo upload dialog

#### 1.3 Color-Coded Card System

**Add to**: `client/src/components/ui/card.tsx`

**New Variants:**

```tsx
variants: {
  colorScheme: {
    default: 'bg-white border-neutral-200',
    navy: 'bg-gradient-navy text-white',
    orange: 'bg-gradient-orange text-white',
    teal: 'bg-gradient-teal text-white',
    purple: 'bg-gradient-to-br from-purple-500 to-purple-600 text-white',
    sage: 'bg-gradient-to-br from-green-400 to-green-500 text-white',
  }
}
```

**Use Cases:**

- Workspace selection cards (like July25)
- Package tier differentiation
- Dashboard metric cards
- Admin section cards

---

### Phase 2: Critical UI Components (2-3 weeks)

**Priority**: 🔥 Critical

#### 2.1 Workspace/Dashboard Selection Page

**Inspired by**: July25 home screen

**Create**: `client/src/pages/admin/SelectWorkspace.tsx`

**Design:**

```tsx
// 3-column grid of large colorful cards
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 p-8">
  <Card colorScheme="navy" className="cursor-pointer hover:scale-102 transition-transform p-12">
    <Users className="w-16 h-16 mx-auto mb-4" />
    <h3 className="text-2xl font-bold text-center">Platform Admin</h3>
    <p className="text-white/80 text-center mt-2">Manage all tenants</p>
  </Card>

  <Card colorScheme="orange">
    <Settings className="w-16 h-16 mx-auto mb-4" />
    <h3>Tenant Admin</h3>
    <p>Manage your business</p>
  </Card>

  <Card colorScheme="teal">
    <Palette className="w-16 h-16 mx-auto mb-4" />
    <h3>Branding</h3>
    <p>Customize your look</p>
  </Card>
</div>
```

**Features:**

- Large icons (Lucide, 64px)
- Generous padding (p-12)
- Rounded corners (rounded-2xl)
- Hover: Scale(1.02), shadow increase
- Active: Scale(0.98)

#### 2.2 Enhanced Input Components

**Upgrade**: `client/src/components/ui/input.tsx`

**New Features:**

- Floating label animation
- Icon support (left/right slots)
- Dark variant for dark backgrounds
- Validation states (success, error, warning)
- Character counter
- Clear button (X icon)

**Code Structure:**

```tsx
<Input
  label="Email address"
  icon={<Mail />}
  variant="default" // or "dark"
  validation="success" // "error", "warning"
  helperText="We'll never share your email"
  clearable
  showCharCount
  maxLength={100}
/>
```

**Create**: `client/src/components/ui/textarea.tsx`

- Auto-resize as you type
- Character counter with limit
- Markdown preview toggle

#### 2.3 Custom DatePicker Styling

**Upgrade**: `client/src/features/booking/DatePicker.tsx`

**Current Problem**: Uses default react-day-picker styles (not Macon branded)

**Solution**: Add custom CSS module

**Create**: `client/src/features/booking/DatePicker.module.css`

**Features:**

- Macon Navy for selected dates
- Macon Orange for today indicator
- Teal for hover states
- Red strike-through for booked dates
- Green dot for available dates
- Loading skeleton during availability check

**CSS Classes:**

```css
.maconDatePicker {
  --rdp-accent-color: #1a365d; /* Macon Navy */
  --rdp-background-color: #fb923c; /* Macon Orange */
}

.maconDatePicker .rdp-day_selected {
  background: var(--rdp-accent-color);
  color: white;
}

.maconDatePicker .rdp-day_today {
  border: 2px solid var(--rdp-background-color);
}

.maconDatePicker .rdp-day:hover:not(.rdp-day_selected) {
  background: #38b2ac20; /* Macon Teal */
}
```

#### 2.4 Add-On Selection with Animations

**Upgrade**: `client/src/features/booking/AddOnList.tsx`

**Transform from**: Checkbox list
**Transform to**: Card-based selection with animations

**Design:**

```tsx
<AddOnCard
  selected={selected}
  onClick={() => toggleAddOn(id)}
  className={cn(
    'cursor-pointer transition-all duration-300 border-2 rounded-lg p-4',
    selected && 'border-macon-orange bg-macon-orange/5 scale-[1.02]'
  )}
>
  <div className="flex items-start gap-4">
    {/* Animated checkbox */}
    <div
      className={cn(
        'w-6 h-6 border-2 rounded-md flex items-center justify-center transition-all',
        selected ? 'bg-macon-orange border-macon-orange' : 'border-gray-300'
      )}
    >
      {selected && <Check className="w-4 h-4 text-white animate-in zoom-in duration-200" />}
    </div>

    {/* Content */}
    <div className="flex-1">
      <h4 className="font-semibold">{name}</h4>
      <p className="text-sm text-gray-600">{description}</p>
    </div>

    {/* Price badge with animation */}
    <Badge variant="secondary" className="animate-in fade-in slide-in-from-right duration-300">
      {formatCurrency(price)}
    </Badge>
  </div>
</AddOnCard>
```

**Features:**

- Border + background change on selection
- Checkmark animation (zoom-in)
- Price badge slide-in
- Scale transform (1.02) on hover
- Smooth 300ms transitions

#### 2.5 Visual Progress Indicator

**Create**: `client/src/components/ui/progress-steps.tsx`

**For**: Booking flow

**Steps:**

1. Select Package
2. Choose Date
3. Add Extras
4. Checkout

**Design:**

```tsx
<ProgressSteps
  steps={[
    { label: 'Package', icon: <Package /> },
    { label: 'Date', icon: <Calendar /> },
    { label: 'Extras', icon: <Plus /> },
    { label: 'Checkout', icon: <CreditCard /> },
  ]}
  currentStep={2}
  className="mb-8"
/>
```

**Visual Design:**

- Completed steps: Green checkmark, solid line
- Current step: Orange dot with pulse animation
- Future steps: Gray circle, dashed line
- Responsive: Horizontal on desktop, vertical on mobile

#### 2.6 Toast Notifications

**Install**: `sonner` (recommended) or Shadcn Toast

```bash
npm install sonner
```

**Setup**: `client/src/components/ui/toaster.tsx`

**Usage:**

```tsx
import { toast } from 'sonner';

// Success
toast.success('Package created successfully!');

// Error
toast.error('Failed to save changes');

// Loading
toast.loading('Uploading photo...');

// Promise
toast.promise(createPackage(), {
  loading: 'Creating package...',
  success: 'Package created!',
  error: 'Failed to create package',
});
```

**Add to**: Every form submission, delete action, API call

---

### Phase 3: Admin Interface Polish (2-3 weeks)

**Priority**: 🎯 High

#### 3.1 Professional Tab Navigation

**Upgrade**: All admin dashboard tabs

**Files:**

- `client/src/features/admin/Dashboard.tsx`
- `client/src/features/tenant-admin/TenantDashboard.tsx`

**Use**: Shadcn Tabs with custom styling

```tsx
<Tabs defaultValue="overview" className="w-full">
  <TabsList className="bg-navy-900/50 p-1 rounded-lg">
    <TabsTrigger
      value="overview"
      className={cn(
        'data-[state=active]:bg-macon-orange',
        'data-[state=active]:text-white',
        'transition-all duration-200'
      )}
    >
      <LayoutDashboard className="w-4 h-4 mr-2" />
      Overview
    </TabsTrigger>
    {/* More tabs... */}
  </TabsList>

  <TabsContent value="overview" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
    {/* Content */}
  </TabsContent>
</Tabs>
```

**Features:**

- Active tab: Orange background
- Icons for each tab
- Content fade-in when switching
- Keyboard navigation (← →)
- Proper ARIA labels

#### 3.2 Loading Skeleton States

**Create**: `client/src/components/ui/skeleton.tsx`

**Components:**

```tsx
// Generic skeleton
<Skeleton className="h-4 w-[250px]" />

// Specific skeletons
<PackageCardSkeleton />
<TableSkeleton rows={5} columns={7} />
<MetricCardSkeleton />
<FormSkeleton fields={4} />
```

**Features:**

- Shimmer animation (pulse + gradient)
- Matches real component dimensions
- Accessible (aria-busy, aria-live)

**Usage**: Show while loading data in admin tables, package grids, dashboards

#### 3.3 Empty States

**Create**: `client/src/components/ui/empty-state.tsx`

**Design:**

```tsx
<EmptyState
  icon={<Package className="w-16 h-16 text-gray-400" />}
  title="No packages yet"
  description="Create your first wedding package to get started"
  action={
    <Button onClick={onCreatePackage}>
      <Plus className="w-4 h-4 mr-2" />
      Create Package
    </Button>
  }
/>
```

**Use in:**

- Package list (no packages)
- Booking list (no bookings)
- Blackout dates (none set)
- Tenant list (platform admin)

#### 3.4 Confirmation Dialogs

**Create**: Alert Dialog for destructive actions

**Use**: Shadcn Alert Dialog

```tsx
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="destructive">
      <Trash2 className="w-4 h-4 mr-2" />
      Delete Package
    </Button>
  </AlertDialogTrigger>

  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
      <AlertDialogDescription>
        This action cannot be undone. This will permanently delete the package "{packageName}" and
        remove it from your catalog.
      </AlertDialogDescription>
    </AlertDialogHeader>

    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={onDelete} className="bg-red-600 hover:bg-red-700">
        <Trash2 className="w-4 h-4 mr-2" />
        Delete
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**Add to:**

- Delete package
- Delete add-on
- Delete tenant
- Delete blackout date
- Remove photo

#### 3.5 Success Celebrations

**Upgrade**: `client/src/pages/success/Success.tsx`

**Add Animations:**

```tsx
import confetti from 'canvas-confetti';

// On mount
useEffect(() => {
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
  });
}, []);

// UI
<div className="text-center">
  <div className="relative inline-block">
    <CheckCircle className={cn('w-24 h-24 text-green-500', 'animate-in zoom-in duration-700')} />
  </div>

  <h1
    className={cn(
      'text-4xl font-bold mt-6',
      'animate-in fade-in slide-in-from-bottom-4',
      'delay-200'
    )}
  >
    Booking Confirmed!
  </h1>

  <p className={cn('text-lg text-gray-600 mt-2', 'animate-in fade-in delay-300')}>
    We've sent a confirmation to {email}
  </p>
</div>;
```

**Alternative**: Use `react-confetti` or CSS-only animations

---

### Phase 4: Micro-interactions & Tooltips (1-2 weeks)

**Priority**: ⭐ Medium

#### 4.1 Hover Tooltips

**Install**: Shadcn Tooltip

**Create**: `client/src/components/ui/tooltip.tsx`

**Usage:**

```tsx
<Tooltip>
  <TooltipTrigger>
    <Info className="w-4 h-4 text-gray-400" />
  </TooltipTrigger>
  <TooltipContent>
    <p>Commission is calculated on total booking amount</p>
  </TooltipContent>
</Tooltip>
```

**Add to:**

- Commission percentage fields
- Complex form fields
- Icon-only buttons
- Status badges
- Disabled inputs (explain why)

#### 4.2 Form Validation Feedback

**Upgrade**: All form inputs with react-hook-form

**Pattern:**

```tsx
<Input
  {...register('email', {
    required: 'Email is required',
    pattern: {
      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
      message: 'Invalid email address',
    },
  })}
  validation={errors.email ? 'error' : touched.email ? 'success' : undefined}
  helperText={errors.email?.message}
  icon={errors.email ? <AlertCircle className="text-red-500" /> : <Mail />}
/>
```

**Features:**

- Real-time validation
- Visual feedback (red border for error, green for success)
- Icon changes based on state
- Helper text appears smoothly

#### 4.3 Button Loading States

**Upgrade**: `client/src/components/ui/button.tsx`

**Add Loading Variant:**

```tsx
// button.tsx
{
  isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />;
}

// Usage
<Button isLoading={isSubmitting} disabled={isSubmitting}>
  {isSubmitting ? 'Creating...' : 'Create Package'}
</Button>;
```

**Apply to:**

- All form submit buttons
- Delete buttons
- API action buttons

#### 4.4 Smooth Page Transitions

**Add**: Page transition animations

**Create**: `client/src/components/ui/page-transition.tsx`

```tsx
<PageTransition>
  <Routes>{/* All routes */}</Routes>
</PageTransition>
```

**Effect**: Smooth fade-in/slide-in when navigating between pages

---

### Phase 5: Advanced Features (Optional, 2-3 weeks)

**Priority**: 💎 Nice to Have

#### 5.1 Dashboard Charts

**Install**: `recharts` or `chart.js`

```bash
npm install recharts
```

**Create**: `client/src/components/charts/`

**Components:**

- `LineChart.tsx` - Booking trends over time
- `BarChart.tsx` - Revenue by package
- `PieChart.tsx` - Booking status distribution

**Add to**: Platform Admin Dashboard, Tenant Admin Dashboard

#### 5.2 Photo Gallery Component

**Upgrade**: `client/src/features/photos/PhotoUploader.tsx`

**Features:**

- Drag-and-drop reordering (use `dnd-kit`)
- Lightbox view on click (use `yet-another-react-lightbox`)
- Upload progress bars
- Image optimization tips
- Batch delete

#### 5.3 Command Palette

**Install**: `cmdk`

**Create**: `client/src/components/ui/command-palette.tsx`

**Features:**

- Cmd+K / Ctrl+K to open
- Search packages, bookings, customers
- Quick navigation
- Actions (create, edit, delete)

**Usage**: Admin dashboards only

#### 5.4 Advanced Table Filters

**Upgrade**: All admin tables

**Add:**

- Column sorting
- Column filtering
- Search across all columns
- Export to CSV
- Pagination

**Use**: `@tanstack/react-table`

---

## Design Principles

Based on July25 reference app analysis:

1. **Generous White Space** - Don't crowd elements (min 16px between sections)
2. **Vibrant, Purposeful Colors** - Use color to indicate function/status
3. **Large Interactive Elements** - Minimum 44px touch targets (WCAG AAA)
4. **Smooth Animations** - 300ms transitions with ease curves
5. **Clear Visual Hierarchy** - Size, weight, color guide the eye
6. **Professional Modals** - Backdrop blur, proper spacing, clear actions
7. **Consistent Patterns** - Same hover/focus/active states everywhere
8. **Loading States** - Never show empty/broken UI during data fetch
9. **Feedback** - Confirm every action (toast, animation, or both)
10. **Accessibility** - WCAG AA minimum, keyboard navigation, ARIA labels

---

## File Organization

### New Files to Create

```
client/src/
├── components/ui/
│   ├── dialog.tsx (upgrade)
│   ├── skeleton.tsx (new)
│   ├── empty-state.tsx (new)
│   ├── progress-steps.tsx (new)
│   ├── toaster.tsx (new)
│   ├── tooltip.tsx (install Shadcn)
│   ├── command-palette.tsx (optional)
│   └── page-transition.tsx (new)
│
├── components/charts/ (optional)
│   ├── LineChart.tsx
│   ├── BarChart.tsx
│   └── PieChart.tsx
│
├── pages/admin/
│   └── SelectWorkspace.tsx (new)
│
├── styles/
│   ├── theme-zones.md (new - documentation)
│   └── animations.css (new - reusable animations)
│
└── features/booking/
    └── DatePicker.module.css (new)
```

### Files to Upgrade

```
client/src/
├── components/ui/
│   ├── button.tsx (add isLoading)
│   ├── input.tsx (add floating label, dark variant, validation)
│   ├── card.tsx (add colorScheme variants)
│   └── textarea.tsx (create if missing)
│
├── pages/
│   ├── Home.tsx (already good, minimal changes)
│   └── success/Success.tsx (add animations)
│
├── features/
│   ├── booking/
│   │   ├── DatePicker.tsx (custom styling)
│   │   ├── AddOnList.tsx (card-based selection)
│   │   └── TotalBox.tsx (enhance visual design)
│   │
│   ├── catalog/
│   │   ├── CatalogGrid.tsx (light theme)
│   │   └── PackagePage.tsx (light theme)
│   │
│   ├── admin/
│   │   └── Dashboard.tsx (professional tabs)
│   │
│   └── tenant-admin/
│       └── TenantDashboard.tsx (professional tabs)
```

---

## Success Metrics

### Before → After

| Component               | Before | After  | Improvement |
| ----------------------- | ------ | ------ | ----------- |
| **Overall UI Maturity** | 6.5/10 | 9/10   | +2.5        |
| Modal/Dialog            | 3/10   | 9/10   | +6          |
| Booking Flow            | 5/10   | 9/10   | +4          |
| Admin Interfaces        | 5.5/10 | 8.5/10 | +3          |
| Form Components         | 6/10   | 9/10   | +3          |
| Micro-interactions      | 4/10   | 8.5/10 | +4.5        |
| Theme Consistency       | 4/10   | 9/10   | +5          |
| Loading States          | 2/10   | 9/10   | +7          |

### User Experience Improvements

**Customer (Wedding Couple):**

- Clear progress through booking flow (+40% completion rate expected)
- Professional, trustworthy interface (+30% conversion)
- Smooth animations make experience delightful

**Tenant Admin:**

- Faster task completion with better visual hierarchy (-30% time on task)
- Reduced errors with better form validation (-50% form errors)
- Professional interface increases confidence in platform

**Platform Admin:**

- Quicker navigation with color-coded sections (-25% time to find)
- Better data visibility with charts and filters
- Professional appearance for demos/sales

---

## Implementation Timeline

### Sprint 1 (Week 1-2): Foundation

- [ ] Define theme zones (light vs dark)
- [ ] Create/upgrade Dialog component
- [ ] Add color-coded card variants
- [ ] Set up toast notification system

**Deliverable**: Theme consistency established, professional modals

### Sprint 2 (Week 3-4): Booking Flow

- [ ] Custom DatePicker styling
- [ ] Card-based add-on selection
- [ ] Progress indicator component
- [ ] Enhanced TotalBox

**Deliverable**: Professional, branded booking flow

### Sprint 3 (Week 5-6): Admin Polish

- [ ] Professional tab navigation
- [ ] Loading skeleton components
- [ ] Empty state components
- [ ] Confirmation dialogs

**Deliverable**: Polished admin interfaces

### Sprint 4 (Week 7-8): Micro-interactions

- [ ] Hover tooltips
- [ ] Form validation feedback
- [ ] Button loading states
- [ ] Success animations

**Deliverable**: Delightful micro-interactions throughout

### Sprint 5 (Week 9-12): Advanced (Optional)

- [ ] Dashboard charts
- [ ] Photo gallery enhancements
- [ ] Command palette
- [ ] Advanced table filters

**Deliverable**: Pro-level features for power users

---

## Dependencies to Install

```bash
# Phase 1-2 (Critical)
npm install sonner                    # Toast notifications
npm install @radix-ui/react-dialog    # Modal system
npm install @radix-ui/react-tabs      # Tab navigation
npm install @radix-ui/react-tooltip   # Tooltips

# Phase 3-4 (High Priority)
npm install @radix-ui/react-alert-dialog  # Confirmations
npm install canvas-confetti           # Success celebrations (optional)

# Phase 5 (Optional)
npm install recharts                  # Charts
npm install @dnd-kit/core @dnd-kit/sortable  # Drag-drop
npm install yet-another-react-lightbox  # Photo lightbox
npm install cmdk                      # Command palette
npm install @tanstack/react-table    # Advanced tables
```

---

## Testing Checklist

After each phase, verify:

### Visual Testing

- [ ] All breakpoints (mobile, tablet, desktop)
- [ ] Light and dark themes
- [ ] Hover states
- [ ] Focus states (keyboard navigation)
- [ ] Loading states
- [ ] Empty states
- [ ] Error states

### Interaction Testing

- [ ] Animations are smooth (60fps)
- [ ] Transitions are not jarring
- [ ] Buttons provide feedback
- [ ] Forms validate properly
- [ ] Toasts appear/disappear correctly
- [ ] Modals open/close smoothly

### Accessibility Testing

- [ ] Keyboard navigation works
- [ ] Screen reader support (ARIA labels)
- [ ] Color contrast meets WCAG AA
- [ ] Focus indicators visible
- [ ] Touch targets ≥44px

### Performance Testing

- [ ] Page load times <2s
- [ ] Smooth scrolling
- [ ] No layout shifts (CLS)
- [ ] Animations don't block main thread

---

## Notes & Considerations

### Browser Support

- Chrome/Edge (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Mobile Safari (iOS 15+)
- Mobile Chrome (Android 11+)

### Performance Budget

- First Contentful Paint (FCP): <1.8s
- Largest Contentful Paint (LCP): <2.5s
- Cumulative Layout Shift (CLS): <0.1
- First Input Delay (FID): <100ms

### Accessibility Goals

- WCAG 2.1 Level AA compliance
- Keyboard navigation for all interactions
- Screen reader compatibility
- High contrast mode support
- Reduced motion support (prefers-reduced-motion)

---

## Conclusion

This comprehensive plan transforms MAIS from a functional platform (6.5/10) to a polished, professional wedding booking experience (9/10). The phased approach allows for incremental improvements while maintaining a stable application.

**Key Success Factors:**

1. Consistent theme strategy (light for customers, dark for admin)
2. Professional component library (modals, inputs, cards)
3. Rich micro-interactions (animations, feedback, loading states)
4. Clear visual hierarchy (color, size, spacing)
5. Delightful user experience (smooth, responsive, accessible)

**Total Effort**: 8-12 weeks with focused development
**Expected Impact**: 40% increase in booking conversions, 30% reduction in support tickets, professional appearance suitable for sales/demos

---

**Plan Created**: November 17, 2025
**Next Review**: After Phase 1 completion
**Status**: Ready for implementation
