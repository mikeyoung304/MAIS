# feat: Rethink Tenant Dashboard - Segment-Package Hierarchy UI

> **Plan Status:** Revised based on 3-agent review (DHH, Frontend Architect, Code Simplicity)
> **Scope:** Standard (1-2 days) - Proper accordion with Radix + UX polish
> **Last Updated:** 2025-12-01

## Overview

The current tenant dashboard treats **packages** and **segments** as separate, equal offerings through distinct tabs. However, the data model reveals that **segments are containers for packages** (one-to-many relationship). This architectural mismatch creates confusion and doesn't properly represent the business hierarchy.

**Current Problem:**

- Packages tab and Segments tab displayed side-by-side as if they're peers
- No visual indication that packages _belong to_ segments
- Segments tab always visible even when tenant has no segments
- Users can create packages without assigning them to segments (orphans)
- No hierarchical view showing which packages are in which segment

**Goal:** Rethink the tenant dashboard to properly reflect that segments contain packages, using progressive disclosure to show segments only when relevant.

---

## Key Decisions (Post-Review)

| Decision               | Choice                      | Rationale                                                    |
| ---------------------- | --------------------------- | ------------------------------------------------------------ |
| **Scope**              | Standard (1-2 days)         | Balance UX polish with simplicity                            |
| **Backend Endpoint**   | No new endpoint             | Client-side composition from existing APIs                   |
| **Component Strategy** | Start inline, extract later | Only extract when file exceeds 300 lines                     |
| **Accordion**          | Native `<details>` element  | Zero dependencies, accessible by default, browser animations |
| **Orphan Handling**    | Require segment selection   | Prevent orphans at creation time                             |
| **1-Segment Behavior** | Treated like 0 segments     | Customers skip straight to 3-tier packages                   |

---

## Problem Statement / Motivation

### Why This Matters

1. **Cognitive Confusion:** Tenants see "Packages" and "Segments" as separate tabs, implying they're different kinds of things. In reality, segments are _categories_ that contain packages.

2. **Orphaned Packages:** The current flow allows creating packages without assigning them to a segment, leading to "orphaned" packages that don't appear in any storefront segment landing page.

3. **Wasted Tab Space:** Tenants without segments see an empty "Segments" tab. This is noise in their dashboard.

4. **Lost Context:** When editing a package in the packages tab, the user loses sight of which segment it belongs to.

5. **No Visual Grouping:** A tenant with 12 packages across 3 segments sees a flat list of 12 packages, not 3 groups of 4.

### Current Schema Relationship

```prisma
model Segment {
  id        String    @id @default(cuid())
  tenantId  String
  name      String
  packages  Package[]  // One-to-Many: Segment HAS MANY Packages
}

model Package {
  id        String    @id @default(cuid())
  tenantId  String
  segmentId String?   // Nullable FK - Package BELONGS TO Segment (optional)
  segment   Segment?  @relation(fields: [segmentId], references: [id], onDelete: SetNull)
}
```

---

## Proposed Solution

### High-Level Approach

**Merge the "Packages" and "Segments" tabs into a unified "Packages" tab** that displays packages grouped by segment when segments exist (2+).

**Key Principles:**

1. **Segment-First Display:** When 2+ segments exist, show them as collapsible groups containing their packages
2. **Progressive Disclosure:** Hide segment functionality until tenant creates their second segment
3. **No Orphans:** Require segment selection when creating packages (if 2+ segments exist)
4. **1-Segment = 0-Segment:** Treat tenants with exactly 1 segment the same as those with none (flat list, customers go straight to 3-tier packages)
5. **Backward Compatible:** Support tenants with packages but no segments (legacy/simple use case)

### Segment Count Behavior

| Segments | Admin Dashboard                  | Customer Storefront                       |
| -------- | -------------------------------- | ----------------------------------------- |
| **0**    | Flat package list                | Go straight to `/tiers` (3-tier packages) |
| **1**    | Flat package list (treat like 0) | Skip segment selection, go to `/tiers`    |
| **2+**   | Grouped by segment (accordion)   | Show segment selection first              |

### Proposed UI Structure (2+ Segments)

```
┌─────────────────────────────────────────────────────────────────┐
│ Dashboard Tabs: [Packages ▼] [Bookings] [Branding] [Payments]   │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ [+ Create Package]  [+ Create Segment]                      │ │
│ │                                                             │ │
│ │ ▼ Wellness Retreats (3 packages)                            │ │
│ │ ┌─────────────────────────────────────────────────────────┐ │ │
│ │ │ Weekend Reset • $1,200 • Active         [Edit] [Delete] │ │ │
│ │ │ Deep Dive Retreat • $2,400 • Active     [Edit] [Delete] │ │ │
│ │ │ Couples Wellness • $3,000 • Active      [Edit] [Delete] │ │ │
│ │ └─────────────────────────────────────────────────────────┘ │ │
│ │                                                             │ │
│ │ ▶ Micro-Weddings (2 packages) [collapsed]                   │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Proposed UI Structure (0-1 Segments)

```
┌─────────────────────────────────────────────────────────────────┐
│ Dashboard Tabs: [Packages ▼] [Bookings] [Branding] [Payments]   │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Your Packages                      [+ Create Segment]       │ │
│ │                                    [+ Create Package]       │ │
│ │                                                             │ │
│ │ ┌─────────────────────────────────────────────────────────┐ │ │
│ │ │ Weekend Reset • $1,200 • Active         [Edit] [Delete] │ │ │
│ │ │ Deep Dive Retreat • $2,400 • Active     [Edit] [Delete] │ │ │
│ │ │ Couples Wellness • $3,000 • Active      [Edit] [Delete] │ │ │
│ │ └─────────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technical Approach

### Architecture (Simplified per Review)

**Key Change:** No new backend endpoint. Use existing APIs with client-side composition.

#### Files to Modify (Minimal Surface Area)

```
client/src/features/tenant-admin/
├── TenantDashboard/
│   ├── index.tsx                    # MODIFY: Use new PackagesTab
│   ├── TabNavigation.tsx            # MODIFY: Remove segments tab
│   └── useDashboardData.ts          # MODIFY: Client-side grouping
├── TenantPackagesManager.tsx        # RENAME/REWRITE → PackagesTab.tsx
└── packages/
    └── PackageForm.tsx              # MODIFY: Require segment when 2+
```

**No new components until file exceeds 300 lines** - inline everything first.

#### Data Flow (Client-Side Composition)

**Current:**

```
TenantDashboard
  ├── Packages Tab → api.tenantAdminGetPackages()
  └── Segments Tab → api.tenantAdminGetSegments()
```

**Proposed (No New Endpoint):**

```
TenantDashboard
  └── Packages Tab → Parallel fetch existing APIs
                     ├── api.tenantAdminGetPackages()
                     └── api.tenantAdminGetSegments()

                     Client-side grouping:
                     const grouped = segments.map(s => ({
                       ...s,
                       packages: packages.filter(p => p.segmentId === s.id)
                     }));
```

### Implementation (Single Phase)

**One PR, ship it, iterate based on feedback.**

#### Tasks

**Frontend (~4-6 hours):**

- [ ] Remove "Segments" tab from `TabNavigation.tsx`
- [ ] Modify `useDashboardData.ts` to fetch both segments + packages
- [ ] Add client-side grouping logic (10 lines)
- [ ] Rewrite `TenantPackagesManager.tsx` with conditional rendering:
  - 0-1 segments: flat list (current behavior)
  - 2+ segments: native `<details>` accordions
- [ ] Add segment header inline (not separate component)
- [ ] Modify `PackageForm.tsx` to require segment when 2+ segments exist
- [ ] Update metrics to show "X segments, Y packages" when 2+ segments

**Testing (~2 hours):**

- [ ] Manual testing of all segment count scenarios (0, 1, 2+)
- [ ] 1 E2E test: create segment → create package → see grouped

**No backend changes. No new dependencies. No new components.**

#### Native `<details>` Pattern

Using native HTML instead of Radix Accordion (per reviewer recommendation):

```typescript
// Zero dependencies, accessible by default
{segments.map(segment => (
  <details
    key={segment.id}
    open
    className="border border-sage-light/20 rounded-2xl overflow-hidden"
  >
    <summary className="px-6 py-4 cursor-pointer font-serif text-lg font-bold flex items-center justify-between hover:bg-sage-light/5 transition-colors">
      <span>{segment.name} ({segment.packages.length})</span>
      <div className="flex gap-2" onClick={e => e.stopPropagation()}>
        <Button size="sm" variant="ghost" onClick={() => editSegment(segment)}>
          <Pencil className="w-4 h-4" />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => deleteSegment(segment.id)}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </summary>
    <div className="px-6 pb-6">
      <PackageList packages={segment.packages} onEdit={...} onDelete={...} />
    </div>
  </details>
))}
```

**Benefits of native `<details>`:**

- Zero bundle size impact (no Radix Accordion)
- Accessible by default (keyboard, screen reader)
- Browser handles animations
- Works on all browsers

---

## Acceptance Criteria

### Functional Requirements

- [ ] 0-1 segments: Packages tab shows flat list (unchanged UX)
- [ ] 2+ segments: Packages tab groups packages by segment using `<details>` accordions
- [ ] Segments are collapsible/expandable
- [ ] Users can create/edit/delete segments from the packages tab
- [ ] Package form **requires** segment selection when 2+ segments exist
- [ ] Dashboard shows "X segments, Y packages" in metrics when 2+ segments
- [ ] Segments tab removed from navigation

### Edge Cases

- [ ] Existing orphaned packages: Show in "Ungrouped" section with prompt to assign
- [ ] Deleting last segment (going from 2→1): Revert to flat list view
- [ ] Creating second segment: Trigger grouped view

### Quality Gates

- [ ] TypeScript strict mode compliance
- [ ] 1 E2E test: create segment → create package → see grouped
- [ ] Manual test on mobile

---

## Dependencies

**Zero new dependencies.** Uses:

- Existing `api.tenantAdminGetPackages()` endpoint
- Existing `api.tenantAdminGetSegments()` endpoint
- Native HTML `<details>` element
- Existing design tokens

---

## References

### Files to Modify

- `client/src/features/tenant-admin/TenantDashboard/index.tsx`
- `client/src/features/tenant-admin/TenantDashboard/TabNavigation.tsx`
- `client/src/features/tenant-admin/TenantDashboard/useDashboardData.ts`
- `client/src/features/tenant-admin/TenantPackagesManager.tsx`
- `client/src/features/tenant-admin/packages/PackageForm.tsx`

### Schema Reference

- Segment model: `server/prisma/schema.prisma:144-181`
- Package model: `server/prisma/schema.prisma:183-220`

### Design Tokens

- `client/src/styles/DESIGN_TOKENS_GUIDE.md`
- `.claude/PATTERNS.md`

---

## Implementation Code

### useDashboardData.ts (Client-Side Grouping)

```typescript
// client/src/features/tenant-admin/TenantDashboard/useDashboardData.ts
import { useMemo } from 'react';

export function useDashboardData(activeTab: DashboardTab) {
  // Fetch both in parallel (existing pattern)
  const [packages, setPackages] = useState<PackageDto[]>([]);
  const [segments, setSegments] = useState<SegmentDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadPackagesAndSegments = async () => {
    setIsLoading(true);
    try {
      const [packagesResult, segmentsResult] = await Promise.all([
        api.tenantAdminGetPackages(),
        api.tenantAdminGetSegments(),
      ]);
      if (packagesResult.status === 200) setPackages(packagesResult.body);
      if (segmentsResult.status === 200) setSegments(segmentsResult.body);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'packages') {
      loadPackagesAndSegments();
    }
  }, [activeTab]);

  // Client-side grouping (10 lines, computed in UI)
  const grouped = useMemo(() => {
    return segments.map((seg) => ({
      ...seg,
      packages: packages.filter((p) => p.segmentId === seg.id),
    }));
  }, [segments, packages]);

  const orphanedPackages = useMemo(() => {
    return packages.filter((p) => !p.segmentId);
  }, [packages]);

  const showGroupedView = segments.length >= 2;

  return {
    segments,
    packages,
    grouped,
    orphanedPackages,
    showGroupedView,
    isLoading,
    refresh: loadPackagesAndSegments,
  };
}
```

### PackagesTab (Inline, ~100 lines)

```typescript
// Simplified - all inline, no separate components
export function PackagesTab() {
  const { grouped, orphanedPackages, showGroupedView, packages, segments, refresh } = useDashboardData("packages");

  // 0-1 segments: flat list
  if (!showGroupedView) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-2xl text-text-primary">Your Packages</h2>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCreateSegment}>Create Segment</Button>
            <Button onClick={handleCreatePackage}>Create Package</Button>
          </div>
        </div>
        <PackageList packages={packages} onEdit={handleEdit} onDelete={handleDelete} />
      </div>
    );
  }

  // 2+ segments: grouped view with native <details>
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-2xl text-text-primary">
          {segments.length} Segments, {packages.length} Packages
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleCreateSegment}>New Segment</Button>
          <Button onClick={handleCreatePackage}>New Package</Button>
        </div>
      </div>

      {/* Grouped by segment */}
      <div className="space-y-4">
        {grouped.map(segment => (
          <details
            key={segment.id}
            open
            className="border border-sage-light/20 rounded-2xl overflow-hidden"
          >
            <summary className="px-6 py-4 cursor-pointer font-serif text-lg font-bold flex items-center justify-between hover:bg-sage-light/5 transition-colors">
              <span>{segment.name} ({segment.packages.length})</span>
              <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                <Button size="sm" variant="ghost" onClick={() => handleEditSegment(segment)}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleDeleteSegment(segment.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </summary>
            <div className="px-6 pb-6">
              {segment.packages.length === 0 ? (
                <p className="text-text-muted">No packages in this segment yet.</p>
              ) : (
                <PackageList packages={segment.packages} onEdit={handleEdit} onDelete={handleDelete} />
              )}
            </div>
          </details>
        ))}
      </div>

      {/* Orphaned packages (legacy) */}
      {orphanedPackages.length > 0 && (
        <div className="border border-yellow-200 rounded-2xl p-6 bg-yellow-50">
          <h3 className="font-semibold text-yellow-800 mb-4">
            Ungrouped Packages ({orphanedPackages.length})
          </h3>
          <p className="text-sm text-yellow-700 mb-4">
            These packages need to be assigned to a segment.
          </p>
          <PackageList packages={orphanedPackages} onEdit={handleEdit} onDelete={handleDelete} />
        </div>
      )}
    </div>
  );
}
```

### PackageForm.tsx (Require Segment)

```typescript
// Add to PackageForm.tsx
const { segments } = useDashboardData("packages");
const requireSegment = segments.length >= 2;

// In form validation
const schema = z.object({
  // ... existing fields
  segmentId: requireSegment
    ? z.string().min(1, "Please select a segment")
    : z.string().optional(),
});

// In JSX
{requireSegment && (
  <FormField
    name="segmentId"
    label="Segment"
    required
    error={errors.segmentId?.message}
  >
    <Select {...register("segmentId")}>
      <option value="">Select a segment...</option>
      {segments.map(s => (
        <option key={s.id} value={s.id}>{s.name}</option>
      ))}
    </Select>
  </FormField>
)}
```

---

## E2E Test

```typescript
// e2e/tests/tenant-packages-hierarchy.spec.ts
test.describe('Tenant Packages Hierarchy', () => {
  test('groups packages by segment when 2+ segments exist', async ({ page }) => {
    // Login as tenant admin
    await loginAsTenant(page, 'test-tenant');
    await page.goto('/tenant/dashboard');

    // Create first segment
    await page.click('button:has-text("Create Segment")');
    await page.fill('input[name="name"]', 'Wellness');
    await page.click('button:has-text("Save")');

    // Still flat view (only 1 segment)
    await expect(page.locator('details')).toHaveCount(0);

    // Create second segment
    await page.click('button:has-text("New Segment")');
    await page.fill('input[name="name"]', 'Weddings');
    await page.click('button:has-text("Save")');

    // Now grouped view (2+ segments)
    await expect(page.locator('details')).toHaveCount(2);
    await expect(page.locator('summary:has-text("Wellness")')).toBeVisible();
    await expect(page.locator('summary:has-text("Weddings")')).toBeVisible();
  });
});
```

---

## Review Feedback Incorporated

This plan was revised based on feedback from 3 specialized reviewers:

| Reviewer          | Key Feedback                   | Action Taken                                |
| ----------------- | ------------------------------ | ------------------------------------------- |
| **DHH**           | "5 phases is over-planned"     | Collapsed to single phase                   |
| **DHH**           | "Too many components"          | Start inline, extract when >300 lines       |
| **DHH**           | "Delete success metrics"       | Removed analytics section                   |
| **DHH**           | "Backend computing UI logic"   | Client-side composition instead             |
| **Frontend Arch** | "AccordionTrigger nesting"     | Use native `<details>` with stopPropagation |
| **Frontend Arch** | "Missing Radix dependency"     | Use native HTML instead                     |
| **Simplicity**    | "20x more complex than needed" | Reduced to ~100 lines inline                |
| **Simplicity**    | "No new endpoint needed"       | Parallel fetch + client-side join           |

---

**Estimated Effort:** 1-2 days (4-6 hours frontend + 2 hours testing)

**Priority:** P2 - Admin UX improvement

---

_Generated with [Claude Code](https://claude.com/claude-code)_
