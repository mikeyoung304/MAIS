# Phase 4: Polish & Scale

**Duration:** Weeks 10-12 (15 business days)
**Team:** 1 Senior Frontend Developer, 0.25 UI/UX Designer, 0.25 QA Engineer
**Goal:** Advanced features, data visualization, user education, delightful experience

---

## Phase Overview

Phase 4 focuses on **polish** and **advanced features** that elevate the MAIS platform from good to exceptional. We'll add data visualization, advanced table features, user onboarding, contextual help, and subtle micro-interactions that delight users.

### Success Criteria

- ✅ Admin dashboards show visual trends (charts, graphs)
- ✅ Tables support pagination, filtering, sorting
- ✅ New users complete onboarding flow
- ✅ Contextual help available throughout app
- ✅ Analytics tracking user behavior
- ✅ Micro-interactions enhance perceived quality

---

## Task Breakdown

### Week 10: Data Visualization

#### Task 10.1: Add Charting Library (0.5 days)

**Priority:** Medium
**Assigned To:** Frontend Developer
**Estimated Effort:** 4 hours

**Description:**
Install and configure Recharts for data visualization.

**Implementation Details:**

```bash
npm install recharts
```

**File:** `/Users/mikeyoung/CODING/MAIS/client/src/components/ui/chart.tsx`

```tsx
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

// Custom theme colors
const chartColors = {
  primary: '#1a365d', // Macon Navy
  secondary: '#fb923c', // Macon Orange
  accent: '#38b2ac', // Macon Teal
  success: '#22c55e',
  danger: '#ef4444',
  grid: '#e5e7eb',
};

// Themed tooltip
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload) return null;

  return (
    <div className="bg-surface border border-outline rounded-lg shadow-elevation-2 p-3">
      <p className="text-sm font-medium text-on-surface mb-1">{label}</p>
      {payload.map((entry: any, index: number) => (
        <p key={index} className="text-sm text-on-surface-variant">
          <span className="font-semibold" style={{ color: entry.color }}>
            {entry.name}:
          </span>{' '}
          {entry.value}
        </p>
      ))}
    </div>
  );
}

export {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CustomTooltip,
  chartColors,
};
```

**Acceptance Criteria:**

- [ ] Recharts installed and configured
- [ ] Custom theme colors defined
- [ ] Custom tooltip component created
- [ ] Responsive container wrapper ready

**Testing Checklist:**

- [ ] Unit test: chart renders with sample data
- [ ] Visual test: chart uses brand colors

**Risk Level:** Low
**Rollback Plan:** Remove charting library

---

#### Task 10.2: Create Dashboard Charts (2 days)

**Priority:** Medium
**Assigned To:** Frontend Developer
**Estimated Effort:** 16 hours

**Description:**
Add trend charts to Platform Admin and Tenant Admin dashboards.

**Implementation Details:**

**1. Platform Admin: Revenue Over Time**

**File:** `/Users/mikeyoung/CODING/MAIS/client/src/features/admin/dashboard/components/RevenueChart.tsx`

```tsx
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  CustomTooltip,
  chartColors,
} from '@/components/ui/chart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface RevenueChartProps {
  data: Array<{ month: string; revenue: number; commission: number }>;
}

export function RevenueChart({ data }: RevenueChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-heading-3">Revenue & Commission Trends</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={chartColors.secondary} stopOpacity={0.8} />
                <stop offset="95%" stopColor={chartColors.secondary} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorCommission" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={chartColors.accent} stopOpacity={0.8} />
                <stop offset="95%" stopColor={chartColors.accent} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
            <XAxis dataKey="month" stroke="currentColor" className="text-on-surface-variant" />
            <YAxis stroke="currentColor" className="text-on-surface-variant" />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke={chartColors.secondary}
              fillOpacity={1}
              fill="url(#colorRevenue)"
              name="Revenue"
            />
            <Area
              type="monotone"
              dataKey="commission"
              stroke={chartColors.accent}
              fillOpacity={1}
              fill="url(#colorCommission)"
              name="Commission"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

**2. Tenant Admin: Bookings Over Time**

**File:** `/Users/mikeyoung/CODING/MAIS/client/src/features/tenant-admin/dashboard/components/BookingsChart.tsx`

```tsx
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  CustomTooltip,
  chartColors,
} from '@/components/ui/chart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface BookingsChartProps {
  data: Array<{ week: string; bookings: number; completed: number; cancelled: number }>;
}

export function BookingsChart({ data }: BookingsChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-heading-3">Bookings Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
            <XAxis dataKey="week" stroke="currentColor" className="text-on-surface-variant" />
            <YAxis stroke="currentColor" className="text-on-surface-variant" />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="bookings" fill={chartColors.secondary} name="Total Bookings" />
            <Bar dataKey="completed" fill={chartColors.success} name="Completed" />
            <Bar dataKey="cancelled" fill={chartColors.danger} name="Cancelled" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

**3. Integration:**

```tsx
// In PlatformAdminDashboard.tsx
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
  <RevenueChart data={revenueData} />
  <TenantGrowthChart data={tenantData} />
</div>
```

**Acceptance Criteria:**

- [ ] Revenue chart shows area chart with gradients
- [ ] Bookings chart shows stacked bar chart
- [ ] Charts are responsive (mobile, tablet, desktop)
- [ ] Tooltips show on hover
- [ ] Charts use brand colors
- [ ] Loading state shows skeleton

**Testing Checklist:**

- [ ] Visual test: charts render correctly
- [ ] Responsive test: charts adapt to viewport
- [ ] Interaction test: tooltips show on hover
- [ ] Data test: charts handle empty data gracefully

**Risk Level:** Low
**Rollback Plan:** Hide charts, show metrics only

---

### Week 11: Advanced Table Features

#### Task 11.1: Add Pagination Component (1 day)

**Priority:** High
**Assigned To:** Frontend Developer
**Estimated Effort:** 8 hours

**Description:**
Create pagination component for tables with large datasets.

**Implementation Details:**

**File:** `/Users/mikeyoung/CODING/MAIS/client/src/components/ui/pagination.tsx`

```tsx
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  totalItems: number;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  pageSize,
  onPageSizeChange,
  totalItems,
}: PaginationProps) {
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex items-center justify-between px-2 py-4">
      {/* Results info */}
      <div className="flex items-center gap-2 text-sm text-on-surface-variant">
        <span>
          Showing {startItem}-{endItem} of {totalItems}
        </span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="ml-2 border border-outline rounded px-2 py-1 bg-surface text-on-surface"
        >
          <option value={25}>25 per page</option>
          <option value={50}>50 per page</option>
          <option value={100}>100 per page</option>
        </select>
      </div>

      {/* Pagination controls */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          aria-label="First page"
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* Page numbers */}
        <div className="flex items-center gap-1">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const pageNum = getPageNumber(i, currentPage, totalPages);
            return (
              <Button
                key={pageNum}
                variant={pageNum === currentPage ? 'default' : 'outline'}
                size="sm"
                onClick={() => onPageChange(pageNum)}
                className="w-10"
              >
                {pageNum}
              </Button>
            );
          })}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          aria-label="Last page"
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function getPageNumber(index: number, currentPage: number, totalPages: number): number {
  if (totalPages <= 5) return index + 1;
  if (currentPage <= 3) return index + 1;
  if (currentPage >= totalPages - 2) return totalPages - 4 + index;
  return currentPage - 2 + index;
}
```

**Usage:**

```tsx
const [currentPage, setCurrentPage] = useState(1);
const [pageSize, setPageSize] = useState(25);

const paginatedData = data.slice((currentPage - 1) * pageSize, currentPage * pageSize);

<Table data={paginatedData} />
<Pagination
  currentPage={currentPage}
  totalPages={Math.ceil(data.length / pageSize)}
  onPageChange={setCurrentPage}
  pageSize={pageSize}
  onPageSizeChange={setPageSize}
  totalItems={data.length}
/>
```

**Acceptance Criteria:**

- [ ] Shows current page range (e.g., "Showing 1-25 of 100")
- [ ] Page size selector (25, 50, 100)
- [ ] First/Previous/Next/Last buttons
- [ ] Page number buttons (max 5 visible)
- [ ] Disabled state for unavailable actions
- [ ] Accessible (aria-labels, keyboard navigation)

**Testing Checklist:**

- [ ] Unit test: pagination calculates correctly
- [ ] Interaction test: page changes work
- [ ] Accessibility test: keyboard navigation works

**Risk Level:** Low
**Rollback Plan:** Show all data without pagination

---

#### Task 11.2: Add Sorting & Filtering (1.5 days)

**Priority:** Medium
**Assigned To:** Frontend Developer
**Estimated Effort:** 12 hours

**Description:**
Add column sorting and filter dropdowns to tables.

**Implementation Details:**

**1. Sortable Table Headers:**

**File:** `/Users/mikeyoung/CODING/MAIS/client/src/components/ui/sortable-table.tsx`

```tsx
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

interface SortableTableHeadProps {
  label: string;
  sortKey: string;
  currentSort: SortConfig | null;
  onSort: (key: string) => void;
}

export function SortableTableHead({ label, sortKey, currentSort, onSort }: SortableTableHeadProps) {
  const isActive = currentSort?.key === sortKey;
  const Icon = !isActive ? ArrowUpDown : currentSort.direction === 'asc' ? ArrowUp : ArrowDown;

  return (
    <TableHead>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onSort(sortKey)}
        className="flex items-center gap-2 hover:bg-transparent"
      >
        {label}
        <Icon className={`h-4 w-4 ${isActive ? 'text-secondary' : 'text-on-surface-subtle'}`} />
      </Button>
    </TableHead>
  );
}
```

**2. Filter Dropdown:**

**File:** `/Users/mikeyoung/CODING/MAIS/client/src/components/ui/filter-dropdown.tsx`

```tsx
import { Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface FilterDropdownProps {
  label: string;
  options: Array<{ value: string; label: string }>;
  selectedValues: string[];
  onSelectionChange: (values: string[]) => void;
}

export function FilterDropdown({
  label,
  options,
  selectedValues,
  onSelectionChange,
}: FilterDropdownProps) {
  const handleToggle = (value: string) => {
    if (selectedValues.includes(value)) {
      onSelectionChange(selectedValues.filter((v) => v !== value));
    } else {
      onSelectionChange([...selectedValues, value]);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Filter className="h-4 w-4 mr-2" />
          {label}
          {selectedValues.length > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-secondary text-white text-xs rounded-full">
              {selectedValues.length}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.value}
            checked={selectedValues.includes(option.value)}
            onCheckedChange={() => handleToggle(option.value)}
          >
            {option.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

**3. Usage:**

```tsx
const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
const [statusFilter, setStatusFilter] = useState<string[]>([]);

const handleSort = (key: string) => {
  setSortConfig((prev) => ({
    key,
    direction: prev?.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
  }));
};

const filteredAndSortedData = useMemo(() => {
  let result = data;

  // Filter
  if (statusFilter.length > 0) {
    result = result.filter((item) => statusFilter.includes(item.status));
  }

  // Sort
  if (sortConfig) {
    result = [...result].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      return sortConfig.direction === 'asc' ? (aValue > bValue ? 1 : -1) : aValue < bValue ? 1 : -1;
    });
  }

  return result;
}, [data, statusFilter, sortConfig]);

// In table
<TableHeader>
  <TableRow>
    <SortableTableHead label="Name" sortKey="name" currentSort={sortConfig} onSort={handleSort} />
    <SortableTableHead label="Email" sortKey="email" currentSort={sortConfig} onSort={handleSort} />
    <TableHead>
      Status
      <FilterDropdown
        label="Status"
        options={[
          { value: 'active', label: 'Active' },
          { value: 'pending', label: 'Pending' },
          { value: 'inactive', label: 'Inactive' },
        ]}
        selectedValues={statusFilter}
        onSelectionChange={setStatusFilter}
      />
    </TableHead>
  </TableRow>
</TableHeader>;
```

**Acceptance Criteria:**

- [ ] Column headers are sortable (click to toggle asc/desc)
- [ ] Sort indicator shows current sort direction
- [ ] Filter dropdowns show selected count
- [ ] Multiple filters can be applied simultaneously
- [ ] Filters and sorting work together
- [ ] URL params preserve filter/sort state (optional)

**Testing Checklist:**

- [ ] Unit test: sorting logic correct
- [ ] Unit test: filtering logic correct
- [ ] Integration test: sorting + filtering together
- [ ] Accessibility test: keyboard accessible

**Risk Level:** Low
**Rollback Plan:** Remove sorting/filtering, show raw data

---

### Week 12: User Education & Analytics

#### Task 12.1: Create Onboarding Flow (1.5 days)

**Priority:** Medium
**Assigned To:** Frontend Developer
**Estimated Effort:** 12 hours

**Description:**
Add onboarding tour for first-time users using react-joyride.

**Implementation Details:**

```bash
npm install react-joyride
```

**File:** `/Users/mikeyoung/CODING/MAIS/client/src/components/onboarding/OnboardingTour.tsx`

```tsx
import Joyride, { Step, CallBackProps, STATUS } from 'react-joyride';
import { useState, useEffect } from 'react';

interface OnboardingTourProps {
  tourId: 'platform-admin' | 'tenant-admin';
}

const platformAdminSteps: Step[] = [
  {
    target: '.metric-cards',
    content: 'Monitor your system metrics at a glance. Click any metric to see detailed trends.',
    disableBeacon: true,
  },
  {
    target: '.add-tenant-button',
    content: 'Add new tenants here. Each tenant gets their own isolated environment.',
  },
  {
    target: '.tenants-table',
    content: 'Manage all your tenants. Click any row to view details and configure settings.',
  },
  {
    target: '.theme-toggle',
    content: 'Switch between light and dark themes based on your preference.',
  },
];

const tenantAdminSteps: Step[] = [
  {
    target: '.dashboard-tabs',
    content: 'Navigate between Packages, Bookings, and Branding to manage your business.',
    disableBeacon: true,
  },
  {
    target: '.create-package-button',
    content: 'Create your first package to start accepting bookings.',
  },
  {
    target: '.branding-tab',
    content: 'Customize your booking page colors and branding to match your business.',
  },
];

export function OnboardingTour({ tourId }: OnboardingTourProps) {
  const [run, setRun] = useState(false);

  useEffect(() => {
    const hasSeenTour = localStorage.getItem(`onboarding-${tourId}`);
    if (!hasSeenTour) {
      setRun(true);
    }
  }, [tourId]);

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status } = data;

    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status as any)) {
      localStorage.setItem(`onboarding-${tourId}`, 'true');
      setRun(false);
    }
  };

  const steps = tourId === 'platform-admin' ? platformAdminSteps : tenantAdminSteps;

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      showSkipButton
      callback={handleJoyrideCallback}
      styles={{
        options: {
          primaryColor: '#fb923c', // Macon Orange
          zIndex: 10000,
        },
        tooltip: {
          borderRadius: '12px',
        },
      }}
    />
  );
}
```

**Usage:**

```tsx
// In PlatformAdminDashboard.tsx
<OnboardingTour tourId="platform-admin" />
```

**Acceptance Criteria:**

- [ ] Tour launches automatically for first-time users
- [ ] Tour highlights key features
- [ ] Tour can be skipped
- [ ] Tour completion saved to localStorage
- [ ] Tour can be restarted from help menu

**Testing Checklist:**

- [ ] E2E test: tour launches on first visit
- [ ] E2E test: tour doesn't launch on subsequent visits
- [ ] Interaction test: skip button works

**Risk Level:** Low
**Rollback Plan:** Remove onboarding tour

---

#### Task 12.2: Add Contextual Help (1 day)

**Priority:** Low
**Assigned To:** Frontend Developer
**Estimated Effort:** 8 hours

**Description:**
Add tooltips and help text throughout the app.

**Implementation Details:**

**1. Enhanced Tooltip Component:**

**File:** `/Users/mikeyoung/CODING/MAIS/client/src/components/ui/tooltip.tsx` (enhance existing)

```tsx
import { HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@radix-ui/react-tooltip';

export function HelpTooltip({ content }: { content: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button className="inline-flex items-center justify-center w-4 h-4 text-on-surface-subtle hover:text-secondary transition-colors">
            <HelpCircle className="w-4 h-4" />
            <span className="sr-only">Help</span>
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs bg-surface border border-outline rounded-lg shadow-elevation-2 p-3 text-sm">
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
```

**2. Usage:**

```tsx
<label className="flex items-center gap-2 text-label">
  Revenue Share Percentage
  <HelpTooltip content="The percentage of revenue you'll share with Macon AI. This is automatically calculated from your bookings." />
</label>
```

**Acceptance Criteria:**

- [ ] Tooltips appear on hover
- [ ] Tooltips are keyboard accessible (focus)
- [ ] Tooltips have clear, helpful content
- [ ] Tooltips used for complex features

**Testing Checklist:**

- [ ] Interaction test: tooltips show on hover and focus
- [ ] Accessibility test: screen reader announces tooltip

**Risk Level:** Very Low
**Rollback Plan:** Remove tooltips

---

#### Task 12.3: Add Analytics Tracking (1 day)

**Priority:** Medium
**Assigned To:** Frontend Developer
**Estimated Effort:** 8 hours

**Description:**
Integrate analytics to track user behavior.

**Implementation Details:**

```bash
npm install @vercel/analytics # or use Google Analytics, Mixpanel, etc.
```

**File:** `/Users/mikeyoung/CODING/MAIS/client/src/lib/analytics.ts`

```tsx
// Event tracking wrapper
export function trackEvent(eventName: string, properties?: Record<string, any>) {
  if (typeof window === 'undefined') return;

  // Vercel Analytics
  if (window.va) {
    window.va('event', eventName, properties);
  }

  // Optional: Google Analytics
  if (window.gtag) {
    window.gtag('event', eventName, properties);
  }

  console.log('[Analytics]', eventName, properties);
}

// Page view tracking
export function trackPageView(path: string) {
  trackEvent('page_view', { path });
}

// Common events
export const analyticsEvents = {
  // Authentication
  login: (role: string) => trackEvent('login', { role }),
  logout: () => trackEvent('logout'),

  // Tenant management
  tenantCreated: (tenantId: string) => trackEvent('tenant_created', { tenantId }),
  tenantViewed: (tenantId: string) => trackEvent('tenant_viewed', { tenantId }),

  // Package management
  packageCreated: (packageId: string) => trackEvent('package_created', { packageId }),
  packageEdited: (packageId: string) => trackEvent('package_edited', { packageId }),

  // Bookings
  bookingCreated: (bookingId: string) => trackEvent('booking_created', { bookingId }),

  // UI interactions
  themeToggled: (theme: string) => trackEvent('theme_toggled', { theme }),
  onboardingCompleted: (tourId: string) => trackEvent('onboarding_completed', { tourId }),
  helpViewed: (topic: string) => trackEvent('help_viewed', { topic }),
};
```

**Usage:**

```tsx
import { analyticsEvents } from '@/lib/analytics';

function handleCreateTenant() {
  const tenant = await createTenant(data);
  analyticsEvents.tenantCreated(tenant.id);
}
```

**Acceptance Criteria:**

- [ ] Analytics library integrated
- [ ] Key events tracked (login, create, edit, delete)
- [ ] Page views tracked
- [ ] No PII collected (emails hashed or excluded)
- [ ] Respects user consent (if required)

**Testing Checklist:**

- [ ] Unit test: analytics events fire correctly
- [ ] Manual test: verify events in analytics dashboard

**Risk Level:** Low
**Rollback Plan:** Remove analytics tracking

---

#### Task 12.4: Add Micro-Interactions (1 day)

**Priority:** Low
**Assigned To:** Frontend Developer
**Estimated Effort:** 8 hours

**Description:**
Add subtle animations and micro-interactions for delight.

**Implementation Details:**

**1. Success Animation:**

**File:** `/Users/mikeyoung/CODING/MAIS/client/src/components/ui/success-animation.tsx`

```tsx
import { CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export function SuccessAnimation({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{ duration: 0.3, ease: 'backOut' }}
      className="flex flex-col items-center gap-3"
    >
      <motion.div
        initial={{ rotate: -90 }}
        animate={{ rotate: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <CheckCircle className="w-16 h-16 text-success" />
      </motion.div>
      <p className="text-lg font-medium text-on-surface">{message}</p>
    </motion.div>
  );
}
```

**2. Loading Button State:**

```tsx
// In Button component, enhance loading state
{
  isLoading && (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
    >
      <Loader2 className="w-4 h-4" />
    </motion.div>
  );
}
```

**3. Card Hover Effects:**

```tsx
// Enhanced Card hover (already implemented in Phase 2, just verify)
<Card className="hover:shadow-elevation-3 hover:-translate-y-1 transition-all duration-300">
```

**4. Metric Value Animation:**

```tsx
// In MetricCard, animate value changes
import { motion } from 'framer-motion';

<motion.p
  key={value}
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  className="text-4xl font-bold text-on-surface"
>
  {value}
</motion.p>;
```

**Acceptance Criteria:**

- [ ] Success animations show after form submission
- [ ] Buttons have subtle hover scale effect
- [ ] Cards lift on hover
- [ ] Metric values animate when they change
- [ ] Animations respect `prefers-reduced-motion`

**Testing Checklist:**

- [ ] Visual test: animations are smooth
- [ ] Accessibility test: animations can be disabled
- [ ] Performance test: animations don't cause jank

**Risk Level:** Very Low
**Rollback Plan:** Remove animations, keep static states

---

## Phase 4 Deliverables Checklist

- [ ] **Data Visualization**
  - [ ] Recharts library integrated
  - [ ] Revenue chart in Platform Admin dashboard
  - [ ] Bookings chart in Tenant Admin dashboard
  - [ ] Charts responsive and accessible

- [ ] **Advanced Table Features**
  - [ ] Pagination component created and integrated
  - [ ] Sortable table headers
  - [ ] Filter dropdowns for key columns
  - [ ] Pagination + sorting + filtering work together

- [ ] **User Education**
  - [ ] Onboarding tour for Platform Admin
  - [ ] Onboarding tour for Tenant Admin
  - [ ] Contextual help tooltips throughout app
  - [ ] Help center link in navigation

- [ ] **Analytics**
  - [ ] Analytics library integrated
  - [ ] Key events tracked
  - [ ] Page views tracked
  - [ ] Privacy compliance verified

- [ ] **Micro-Interactions**
  - [ ] Success animations
  - [ ] Enhanced loading states
  - [ ] Card hover effects
  - [ ] Metric value animations

---

## Testing Strategy for Phase 4

### Integration Testing

- Test charts with real data from API
- Test pagination with large datasets (100+ items)
- Test sorting and filtering together
- Test onboarding tour flow end-to-end

### User Acceptance Testing

- Get feedback from real Platform Admins
- Get feedback from real Tenant Admins
- Test onboarding with new users
- Measure task completion time

### Performance Testing

- Test chart rendering performance (large datasets)
- Test table performance with 1000+ rows
- Ensure animations don't cause jank (60fps)

---

## Success Metrics (Phase 4)

| Metric                              | Before Phase 4 | After Phase 4 | Target     |
| ----------------------------------- | -------------- | ------------- | ---------- |
| Time to first action (new user)     | 5 min          | 1 min         | <2 min     |
| Onboarding completion rate          | 0%             | 70%           | 70%        |
| Data insights clarity               | 3/10           | 9/10          | 8/10       |
| User delight score (NPS)            | Baseline TBD   | +20 points    | +15 points |
| Support tickets (feature discovery) | 15/month       | 3/month       | <5/month   |

---

## Post-Phase 4 Activities

### Week 13: Stabilization

- Bug fixing period
- Performance optimization
- User feedback incorporation
- Documentation finalization

### Week 14: Final Review

- Comprehensive testing
- Stakeholder demo
- Launch planning
- Success metrics review

---

## Next Steps

After completing Phase 4:

1. ✅ Deploy all Phase 4 changes to production
2. 📊 Comprehensive metrics review (all phases)
3. 🎉 Team celebration
4. 📋 Post-implementation retrospective
5. 🚀 Plan ongoing maintenance and iteration
