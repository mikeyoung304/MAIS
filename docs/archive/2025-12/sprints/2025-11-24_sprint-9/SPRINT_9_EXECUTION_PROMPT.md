# Sprint 9 Execution Prompt: Package Catalog & Discovery

**Created:** November 20, 2025
**Sprint:** Sprint 9 (Final P0 Critical Feature)
**Estimated Effort:** 30 hours (2 weeks with 1 agent)
**Priority:** P0 (Critical - Blocks primary user journey)

---

## Quick Start Command

Use this prompt to launch Sprint 9 with a single agent:

```
You are executing Sprint 9 (Package Catalog & Discovery - WS-6) for the MAIS platform.

Context:
- Sprint 7: WCAG compliance, logo, mobile nav ✅
- Sprint 8: Touch targets, responsive design, form validation ✅
- Sprint 9: Build package catalog (FINAL P0 blocker)

Your mission: Enable package discovery by building /packages catalog page with search, filtering, and sorting.

Working Directory: /Users/mikeyoung/CODING/MAIS
Branch: main
Current Status: 99.6% test pass rate, 9.2/10 design maturity

Read SPRINT_9_EXECUTION_PROMPT.md for full details and execute all tasks.
```

---

## Executive Summary

### The Problem
**CRITICAL:** Users cannot browse packages. They must know direct URLs (`/package/:slug`) to view offerings. This blocks the entire discovery flow and makes the platform unusable for new users.

**Impact:**
- Booking completion rate stuck at 30%
- Users bounce from homepage (no clear path forward)
- Primary user journey is 0% complete
- Platform appears incomplete/broken

### The Solution
Build a comprehensive package catalog page with:
- Grid view of all active packages
- Search by name/description
- Filter by category and price range
- Sort by price and popularity
- Mobile-responsive layouts (320px - 1920px)
- Linked from homepage CTAs and main navigation

### Expected Outcomes
- Booking completion rate: 30% → 50%+ (+67% improvement)
- Primary user journey: 0% → 100% complete
- Platform design maturity: 9.2/10 → 9.5/10
- User discovery enabled: Package catalog functional

---

## Sprint 9 Objectives & Success Criteria

### Must-Have Features (P0)
- [ ] `/packages` route exists and renders
- [ ] Package grid displays all active packages
- [ ] Packages load from existing API (`apiClient.getPackages()`)
- [ ] Each package card shows: photo, name, description, price
- [ ] Package cards link to detail page (`/package/:slug`)
- [ ] Mobile responsive (1 col → 2 col → 3-4 col)
- [ ] Navigation link added to AppShell header
- [ ] Homepage CTAs link to catalog

### Should-Have Features (P1)
- [ ] Search by package name/description
- [ ] Filter by category (if categories exist)
- [ ] Filter by price range (min/max)
- [ ] Sort by price (ascending/descending)
- [ ] Empty state (no packages found)
- [ ] Loading state (skeleton loaders)
- [ ] Error state (API failure with retry)

### Nice-to-Have Features (P2)
- [ ] Filters persist in URL query params
- [ ] Sort by popularity (booking count)
- [ ] Featured/promoted packages at top
- [ ] Package availability indicators
- [ ] Infinite scroll or pagination (if many packages)

---

## Task Breakdown (30 hours total)

### Task 1: Create PackageCatalog Page Component (6 hours)

**File to create:** `client/src/pages/PackageCatalog.tsx`

**Requirements:**
1. Use existing API contract: `apiClient.packages.getPackages()`
2. Display packages in responsive grid
3. Handle loading state (skeleton loaders)
4. Handle error state (toast + retry button)
5. Handle empty state (no packages exist)
6. Mobile-first responsive design

**Component Structure:**
```tsx
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { PackageCard } from '@/features/catalog/PackageCard';
import { CatalogFilters } from '@/features/catalog/CatalogFilters';
import { Skeleton } from '@/components/ui/skeleton';

export function PackageCatalog() {
  // Fetch packages
  const { data: packages, isLoading, error } = useQuery({
    queryKey: ['packages'],
    queryFn: () => apiClient.packages.getPackages(),
  });

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState({ min: 0, max: Infinity });
  const [sortBy, setSortBy] = useState<'price-asc' | 'price-desc' | 'popular'>('price-asc');

  // Apply filters
  const filteredPackages = packages
    ?.filter(pkg => {
      // Search filter
      if (searchQuery && !pkg.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !pkg.description.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      // Category filter
      if (categoryFilter.length > 0 && !categoryFilter.includes(pkg.category)) {
        return false;
      }
      // Price filter
      if (pkg.price < priceRange.min || pkg.price > priceRange.max) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      // Sort logic
      if (sortBy === 'price-asc') return a.price - b.price;
      if (sortBy === 'price-desc') return b.price - a.price;
      return 0;
    });

  // Loading state
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-h1 mb-8">Browse Packages</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-96" />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-h1 mb-4">Browse Packages</h1>
        <div className="bg-danger-50 border border-danger-200 rounded p-4">
          <p className="text-danger-700">Failed to load packages. Please try again.</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }

  // Empty state
  if (!packages || packages.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-h1 mb-4">Browse Packages</h1>
        <div className="text-center py-12">
          <p className="text-macon-navy-600 text-body-lg">No packages available yet.</p>
          <p className="text-macon-navy-400 text-body-sm">Check back soon!</p>
        </div>
      </div>
    );
  }

  // No results after filtering
  if (filteredPackages.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-h1 mb-8">Browse Packages</h1>
        <CatalogFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          categoryFilter={categoryFilter}
          onCategoryChange={setCategoryFilter}
          priceRange={priceRange}
          onPriceRangeChange={setPriceRange}
          sortBy={sortBy}
          onSortChange={setSortBy}
        />
        <div className="text-center py-12">
          <p className="text-macon-navy-600">No packages match your filters.</p>
          <button onClick={() => {
            setSearchQuery('');
            setCategoryFilter([]);
            setPriceRange({ min: 0, max: Infinity });
          }}>Clear Filters</button>
        </div>
      </div>
    );
  }

  // Main catalog view
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-h1 mb-2">Browse Packages</h1>
      <p className="text-body-lg text-macon-navy-600 mb-8">
        Find the perfect package for your business needs
      </p>

      <CatalogFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        categoryFilter={categoryFilter}
        onCategoryChange={setCategoryFilter}
        priceRange={priceRange}
        onPriceRangeChange={setPriceRange}
        sortBy={sortBy}
        onSortChange={setSortBy}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-8">
        {filteredPackages.map(pkg => (
          <PackageCard key={pkg.id} package={pkg} />
        ))}
      </div>
    </div>
  );
}
```

**Responsive Grid Classes:**
```
Mobile (320px-639px):   grid-cols-1 (single column)
Tablet (640px-1023px):  sm:grid-cols-2 (two columns)
Desktop (1024px-1279px): lg:grid-cols-3 (three columns)
Large (1280px+):        xl:grid-cols-4 (four columns)
```

---

### Task 2: Create PackageCard Component (4 hours)

**File to create:** `client/src/features/catalog/PackageCard.tsx`

**Requirements:**
1. Display package photo (with lazy loading)
2. Show package name (H3 heading)
3. Show truncated description (120 chars)
4. Show price (formatted as currency)
5. "View Details" button linking to `/package/:slug`
6. Hover effect (subtle shadow lift)
7. Accessible (ARIA labels, keyboard navigation)

**Component Structure:**
```tsx
import { Link } from 'react-router-dom';
import { Card, CardContent, CardMedia } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Package } from '@macon/contracts';

interface PackageCardProps {
  package: Package;
}

export function PackageCard({ package: pkg }: PackageCardProps) {
  const truncate = (text: string, length: number) => {
    if (text.length <= length) return text;
    return text.slice(0, length) + '...';
  };

  return (
    <Card className="hover:shadow-lg transition-shadow duration-200">
      <Link to={`/package/${pkg.slug}`} className="block">
        {pkg.photoUrl ? (
          <CardMedia>
            <img
              src={pkg.photoUrl}
              alt={pkg.name}
              loading="lazy"
              className="w-full h-48 object-cover"
            />
          </CardMedia>
        ) : (
          <div className="w-full h-48 bg-macon-navy-100 flex items-center justify-center">
            <span className="text-macon-navy-400">No image</span>
          </div>
        )}

        <CardContent className="p-6">
          <h3 className="text-h3 text-macon-navy-900 mb-2">{pkg.name}</h3>

          <p className="text-body-sm text-macon-navy-600 mb-4 min-h-[3rem]">
            {truncate(pkg.description, 120)}
          </p>

          <div className="flex justify-between items-center">
            <span className="text-h4 text-macon-orange font-semibold">
              ${pkg.price.toLocaleString()}
            </span>
            <Button variant="outline" size="sm">
              View Details
            </Button>
          </div>
        </CardContent>
      </Link>
    </Card>
  );
}
```

**Design Specifications:**
- Card height: Auto (min-h-[400px] to keep consistent)
- Image height: 192px (h-48)
- Padding: 24px (p-6)
- Border radius: 8px (rounded-lg)
- Shadow on hover: shadow-lg
- Transition: 200ms ease

---

### Task 3: Create CatalogFilters Component (8 hours)

**File to create:** `client/src/features/catalog/CatalogFilters.tsx`

**Requirements:**
1. Search input with debounce (300ms)
2. Category multi-select filter
3. Price range filter (min/max inputs)
4. Sort dropdown (price asc/desc)
5. Clear filters button
6. Mobile responsive (stacked on small screens)

**Component Structure:**
```tsx
import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';

interface CatalogFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  categoryFilter: string[];
  onCategoryChange: (categories: string[]) => void;
  priceRange: { min: number; max: number };
  onPriceRangeChange: (range: { min: number; max: number }) => void;
  sortBy: 'price-asc' | 'price-desc' | 'popular';
  onSortChange: (sort: 'price-asc' | 'price-desc' | 'popular') => void;
}

export function CatalogFilters({
  searchQuery,
  onSearchChange,
  categoryFilter,
  onCategoryChange,
  priceRange,
  onPriceRangeChange,
  sortBy,
  onSortChange,
}: CatalogFiltersProps) {
  const [localSearch, setLocalSearch] = useState(searchQuery);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange(localSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearch, onSearchChange]);

  const hasActiveFilters = searchQuery || categoryFilter.length > 0 ||
                          priceRange.min > 0 || priceRange.max < Infinity;

  const clearFilters = () => {
    setLocalSearch('');
    onSearchChange('');
    onCategoryChange([]);
    onPriceRangeChange({ min: 0, max: Infinity });
  };

  return (
    <div className="bg-white rounded-lg border border-macon-navy-200 p-4 mb-6">
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Search */}
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-macon-navy-400 w-5 h-5" />
            <Input
              type="text"
              placeholder="Search packages..."
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Sort */}
        <div className="w-full lg:w-48">
          <Select value={sortBy} onValueChange={onSortChange}>
            <SelectTrigger>
              <SelectValue placeholder="Sort by..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="price-asc">Price: Low to High</SelectItem>
              <SelectItem value="price-desc">Price: High to Low</SelectItem>
              <SelectItem value="popular">Most Popular</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button
            variant="outline"
            onClick={clearFilters}
            className="w-full lg:w-auto"
          >
            <X className="w-4 h-4 mr-2" />
            Clear Filters
          </Button>
        )}
      </div>

      {/* Advanced Filters (can be expanded) */}
      <div className="mt-4 pt-4 border-t border-macon-navy-200">
        <details>
          <summary className="cursor-pointer text-macon-navy-700 font-medium">
            Advanced Filters
          </summary>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Price Range */}
            <div>
              <label className="block text-sm font-medium mb-2">Price Range</label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Min"
                  value={priceRange.min || ''}
                  onChange={(e) => onPriceRangeChange({ ...priceRange, min: Number(e.target.value) })}
                />
                <Input
                  type="number"
                  placeholder="Max"
                  value={priceRange.max === Infinity ? '' : priceRange.max}
                  onChange={(e) => onPriceRangeChange({ ...priceRange, max: Number(e.target.value) || Infinity })}
                />
              </div>
            </div>

            {/* Category Filter (if categories exist) */}
            {/* TODO: Implement category multi-select */}
          </div>
        </details>
      </div>
    </div>
  );
}
```

---

### Task 4: Add Route to App.tsx (1 hour)

**File to modify:** `client/src/App.tsx`

**Changes:**
```tsx
import { PackageCatalog } from '@/pages/PackageCatalog';

// Add route in router configuration
<Route path="/packages" element={<PackageCatalog />} />
```

**Location:** Add after `/package/:slug` route, before admin routes.

---

### Task 5: Add Navigation Links (2 hours)

**Files to modify:**

1. **client/src/components/AppShell.tsx**
```tsx
// Add to navigation links array
<Link to="/packages" className="text-macon-navy-700 hover:text-macon-orange">
  Browse Packages
</Link>
```

2. **client/src/pages/Homepage.tsx**
```tsx
// Update hero CTA
<Button asChild size="lg">
  <Link to="/packages">Get Started</Link>
</Button>

// Update feature section CTAs
<Button asChild variant="outline">
  <Link to="/packages">Browse Packages</Link>
</Button>
```

**Mobile Menu:** Already implemented in Sprint 7. Ensure "Browse Packages" link is included.

---

### Task 6: Implement Search Logic (3 hours)

**Location:** Inside PackageCatalog.tsx (already scaffolded in Task 1)

**Requirements:**
- Case-insensitive search
- Search package name AND description
- Debounced (300ms after user stops typing)
- Highlight matching text (optional)

**Implementation:**
```typescript
const filteredPackages = packages?.filter(pkg => {
  if (!searchQuery) return true;

  const query = searchQuery.toLowerCase();
  const nameMatch = pkg.name.toLowerCase().includes(query);
  const descMatch = pkg.description.toLowerCase().includes(query);

  return nameMatch || descMatch;
});
```

---

### Task 7: Implement Filter Logic (3 hours)

**Location:** Inside PackageCatalog.tsx (already scaffolded in Task 1)

**Requirements:**
- Filter by category (multi-select)
- Filter by price range (min/max)
- Filters work in combination (AND logic)
- URL query params preserve filter state

**Implementation:**
```typescript
// Category filter
const categoryMatch = categoryFilter.length === 0 ||
                      categoryFilter.includes(pkg.category);

// Price filter
const priceMatch = pkg.price >= priceRange.min &&
                   pkg.price <= priceRange.max;

return categoryMatch && priceMatch;
```

**URL State (optional):**
```typescript
import { useSearchParams } from 'react-router-dom';

const [searchParams, setSearchParams] = useSearchParams();

// Read from URL on mount
useEffect(() => {
  const query = searchParams.get('q');
  const minPrice = searchParams.get('minPrice');
  const maxPrice = searchParams.get('maxPrice');

  if (query) setSearchQuery(query);
  if (minPrice) setPriceRange(prev => ({ ...prev, min: Number(minPrice) }));
  if (maxPrice) setPriceRange(prev => ({ ...prev, max: Number(maxPrice) }));
}, []);

// Update URL when filters change
useEffect(() => {
  const params = new URLSearchParams();
  if (searchQuery) params.set('q', searchQuery);
  if (priceRange.min > 0) params.set('minPrice', String(priceRange.min));
  if (priceRange.max < Infinity) params.set('maxPrice', String(priceRange.max));

  setSearchParams(params);
}, [searchQuery, priceRange]);
```

---

### Task 8: Implement Sort Logic (2 hours)

**Location:** Inside PackageCatalog.tsx (already scaffolded in Task 1)

**Requirements:**
- Sort by price ascending
- Sort by price descending
- Sort by popularity (booking count) - if available

**Implementation:**
```typescript
const sortedPackages = filteredPackages?.sort((a, b) => {
  switch (sortBy) {
    case 'price-asc':
      return a.price - b.price;
    case 'price-desc':
      return b.price - a.price;
    case 'popular':
      // TODO: Sort by booking count (requires backend field)
      return 0;
    default:
      return 0;
  }
});
```

---

### Task 9: Testing & QA (3 hours)

**Manual Testing Checklist:**

**Basic Functionality:**
- [ ] Navigate to `/packages` - page loads
- [ ] Package grid displays all active packages
- [ ] Package cards show photo, name, description, price
- [ ] Click package card - navigates to detail page
- [ ] Click "Browse Packages" in nav - opens catalog
- [ ] Click homepage CTA - opens catalog

**Search:**
- [ ] Search by package name - filters correctly
- [ ] Search by description keyword - filters correctly
- [ ] Search with no results - shows empty state
- [ ] Clear search - shows all packages

**Filters:**
- [ ] Filter by price min - excludes cheaper packages
- [ ] Filter by price max - excludes expensive packages
- [ ] Filter by category - shows only selected categories
- [ ] Combine multiple filters - works correctly
- [ ] Clear filters - resets to all packages

**Sort:**
- [ ] Sort by price low to high - correct order
- [ ] Sort by price high to low - correct order
- [ ] Sort persists after filtering

**Responsive:**
- [ ] Mobile (320px) - 1 column grid, stacked filters
- [ ] Tablet (768px) - 2 column grid, filters visible
- [ ] Desktop (1024px) - 3 column grid
- [ ] Large desktop (1440px+) - 4 column grid

**Edge Cases:**
- [ ] Zero packages (tenant has no packages) - empty state
- [ ] One package - single card displays
- [ ] 50+ packages - grid scales properly
- [ ] Very long package name - truncates/wraps correctly
- [ ] Very long description - truncates to 120 chars
- [ ] Missing package photo - placeholder shows
- [ ] API error - error state with retry

**Performance:**
- [ ] Images lazy load
- [ ] Search debounces (300ms)
- [ ] Filter updates are instant (no lag)
- [ ] No console errors
- [ ] No TypeScript errors

**Automated Testing:**
```bash
# Add E2E test
touch client/e2e/tests/package-catalog.spec.ts
```

```typescript
// e2e/tests/package-catalog.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Package Catalog', () => {
  test('should display packages in grid', async ({ page }) => {
    await page.goto('/packages');
    await expect(page.locator('h1')).toHaveText('Browse Packages');
    await expect(page.locator('[data-testid="package-card"]')).toHaveCount(3); // Assuming 3 packages
  });

  test('should search packages by name', async ({ page }) => {
    await page.goto('/packages');
    await page.fill('input[placeholder*="Search"]', 'consulting');
    await page.waitForTimeout(500); // Wait for debounce
    await expect(page.locator('[data-testid="package-card"]')).toHaveCount(1);
  });

  test('should filter by price range', async ({ page }) => {
    await page.goto('/packages');
    await page.click('summary:has-text("Advanced Filters")');
    await page.fill('input[placeholder="Min"]', '1000');
    await expect(page.locator('[data-testid="package-card"]')).toHaveCount(2);
  });

  test('should navigate to package detail on card click', async ({ page }) => {
    await page.goto('/packages');
    await page.click('[data-testid="package-card"]:first-child');
    await expect(page).toHaveURL(/\/package\/.+/);
  });
});
```

---

### Task 10: Documentation (2 hours)

**Create Sprint 9 Completion Report:**

Template: Follow `SPRINT_8_COMPLETION_REPORT.md` structure

**Sections:**
1. Executive Summary
2. WS-6 Results (catalog implementation)
3. Files Created/Modified
4. Success Criteria Validation
5. Testing Evidence
6. Metrics Impact
7. Next Steps

**Update DESIGN_AUDIT_MASTER_REPORT.md:**
- Mark P0-3 (No package catalog) as ✅ RESOLVED
- Update metrics (booking completion rate)
- Update platform maturity score

**Create CHANGELOG_SPRINT_9.md:**
- List all new components
- Document API usage
- Note responsive patterns

---

## Important Constraints

### Must Follow These Rules

1. **Use Existing API Contracts**
   - DO NOT create new backend endpoints
   - Use `apiClient.packages.getPackages()` (already exists)
   - Package type from `@macon/contracts`

2. **Maintain Sprint 8 Standards**
   - All touch targets ≥44px
   - Responsive breakpoints (sm:, md:, lg:, xl:)
   - WCAG AA compliance (4.5:1 contrast)
   - Inter font throughout

3. **No Backend Changes**
   - This is frontend-only work
   - Do not modify `server/` code
   - Do not change API contracts
   - Do not touch Prisma schema

4. **Reuse Existing Components**
   - Button (from Sprint 8)
   - Card (existing)
   - Input (existing)
   - Select (existing)
   - Skeleton (for loading states)

5. **Test Stability**
   - Maintain 99.6% test pass rate
   - Add E2E tests for catalog
   - Run `npm run typecheck` (must pass)

---

## API Contract Reference

### Existing Package API

```typescript
// From @macon/contracts
import { apiClient } from '@/lib/api-client';

// GET /api/v1/packages
const packages = await apiClient.packages.getPackages();

// Returns:
type Package = {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description: string;
  price: number; // In cents
  photoUrl: string | null;
  active: boolean;
  minLeadDays: number;
  createdAt: Date;
  updatedAt: Date;
};
```

**Note:** Multi-tenant isolation is handled by middleware. API automatically returns only packages for current tenant based on `X-Tenant-Key` header.

---

## Design System Reference

### Color Palette
```
Primary: macon-orange (#d97706)
Secondary: macon-teal (#0d9488)
Navy: macon-navy-900 to macon-navy-50
Backgrounds: white, macon-navy-50
Borders: macon-navy-200
```

### Typography Scale
```
Heading 1: text-h1 (60px, bold)
Heading 2: text-h2 (48px, bold)
Heading 3: text-h3 (32px, bold)
Body Large: text-body-lg (18px, normal)
Body: text-body (16px, normal)
Body Small: text-body-sm (14px, normal)
```

### Spacing Scale
```
Gap between cards: gap-6 (24px)
Card padding: p-6 (24px)
Section padding: py-8 (32px)
Container padding: px-4 (16px)
```

### Responsive Breakpoints
```
sm: 640px
md: 768px
lg: 1024px
xl: 1280px
```

---

## Common Pitfalls to Avoid

### ❌ Don't Do This

1. **Don't create new API endpoints**
   - Use existing `getPackages()` contract
   - Backend is already complete

2. **Don't skip responsive breakpoints**
   - Add sm:, md:, lg:, xl: variants
   - Sprint 8 added these everywhere

3. **Don't use hardcoded categories**
   - If categories don't exist in API, defer filter
   - Or use dynamic category extraction from packages

4. **Don't forget accessibility**
   - All interactive elements need ARIA labels
   - Keyboard navigation must work
   - WCAG AA contrast maintained

5. **Don't skip loading/error states**
   - Always handle loading (skeleton)
   - Always handle errors (toast + retry)
   - Always handle empty (no packages)

6. **Don't break existing tests**
   - Run `npm test` before committing
   - Maintain 99.6% pass rate
   - Add new E2E tests for catalog

---

## Success Metrics

### Before Sprint 9
```
Package Discovery Available: NO
Catalog Linked from Homepage: NO
Search Functional: NO
Filter Functional: NO
Booking Completion Rate: 30%
Primary Journey Complete: 0%
```

### After Sprint 9 (Target)
```
Package Discovery Available: YES ✅
Catalog Linked from Homepage: YES ✅
Search Functional: YES ✅
Filter Functional: YES ✅
Booking Completion Rate: 50%+ ✅ (+67%)
Primary Journey Complete: 100% ✅
Platform Maturity: 9.5/10 ✅ (+0.3)
```

---

## Execution Checklist

Use this checklist to track progress:

### Development
- [ ] PackageCatalog.tsx created
- [ ] PackageCard.tsx created
- [ ] CatalogFilters.tsx created
- [ ] Route added to App.tsx (`/packages`)
- [ ] Navigation link added to AppShell
- [ ] Homepage CTAs updated to link to catalog
- [ ] Search implemented (debounced)
- [ ] Filter implemented (price range)
- [ ] Sort implemented (price asc/desc)
- [ ] Loading state (skeleton loaders)
- [ ] Error state (retry button)
- [ ] Empty state (no packages)
- [ ] No results state (after filtering)
- [ ] Responsive grid (1/2/3/4 columns)
- [ ] Mobile filters (stacked layout)
- [ ] Lazy loading images
- [ ] All touch targets ≥44px

### Testing
- [ ] TypeScript validation passes
- [ ] Manual QA on mobile (320px)
- [ ] Manual QA on tablet (768px)
- [ ] Manual QA on desktop (1440px)
- [ ] Search tested with various queries
- [ ] Filters tested in combination
- [ ] Sort tested (all options)
- [ ] Edge cases tested (0 packages, 1 package, 50+ packages)
- [ ] E2E tests added (`package-catalog.spec.ts`)
- [ ] Test pass rate ≥99.6%

### Documentation
- [ ] Sprint 9 completion report created
- [ ] DESIGN_AUDIT_MASTER_REPORT.md updated
- [ ] CHANGELOG_SPRINT_9.md created
- [ ] Git commit with detailed message
- [ ] All changes pushed to main branch

---

## Agent Instructions

When executing this sprint:

1. **Read these files first:**
   - SPRINT_7_COMPLETION_REPORT.md (understand foundation)
   - SPRINT_8_COMPLETION_REPORT.md (understand current state)
   - DESIGN_AUDIT_MASTER_REPORT.md (understand requirements)

2. **Use these tools:**
   - `Read` - Examine existing components before creating new ones
   - `Write` - Create new component files
   - `Edit` - Modify existing files (App.tsx, AppShell.tsx, Homepage.tsx)
   - `Glob` - Find existing components to reuse
   - `Bash` - Run tests and typecheck

3. **Work incrementally:**
   - Create PackageCatalog first (Task 1)
   - Test it works before moving to PackageCard (Task 2)
   - Test both before moving to CatalogFilters (Task 3)
   - Add navigation links only after catalog works

4. **Test continuously:**
   - Run `npm run typecheck` after each file
   - Test in browser after each component
   - Fix TypeScript errors immediately
   - Don't batch all changes before testing

5. **If you get stuck:**
   - Read existing catalog components (CatalogGrid.tsx)
   - Check existing API usage patterns
   - Review Sprint 8 responsive patterns
   - Ask clarifying questions

---

## Open Questions & Answers

### Q1: Should catalog paginate after X packages?
**A:** No pagination for Sprint 9. If tenant has 50+ packages, show all in grid. Consider pagination in Sprint 10+ if performance issues arise.

### Q2: Where do categories come from?
**A:** Categories are NOT in the current Package schema. For Sprint 9, defer category filtering. If needed, can add "category" field to packages in future sprint.

### Q3: Should some packages be featured at top?
**A:** No for Sprint 9. Show all packages in sorted order. "Featured" can be added in Sprint 10+ with a `featured: boolean` field.

### Q4: Show "Fully booked" badge if no availability?
**A:** No for Sprint 9. Availability is checked on package detail page and during booking. Catalog shows all active packages regardless of availability.

### Q5: Show "Starting at $X" for packages with add-ons?
**A:** No for Sprint 9. Show base price only. Add-ons are shown on package detail page.

---

## Estimated Timeline

**Week 1: Core Catalog (18 hours)**
- Day 1-2: PackageCatalog page (6h)
- Day 2-3: PackageCard component (4h)
- Day 3-4: CatalogFilters component (8h)

**Week 2: Integration & Polish (12 hours)**
- Day 1: Add routes and navigation links (3h)
- Day 2: Implement search/filter/sort logic (6h)
- Day 3: Testing & QA (3h)

**Total:** 30 hours over 2 weeks

---

## Final Notes

This is the **FINAL P0 critical feature**. After Sprint 9:

✅ Sprint 7: Foundation (WCAG, logo, mobile nav)
✅ Sprint 8: UX Excellence (touch targets, forms, responsive)
✅ Sprint 9: Discovery (package catalog)

**Result:** 100% of P0 issues resolved! Platform is fully functional for primary user journey.

**Next:** Sprint 10+ will focus on P1/P2 enhancements (onboarding, help system, advanced features).

---

**Good luck with Sprint 9! Let's complete the platform! 🚀**
