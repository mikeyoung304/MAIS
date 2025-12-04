# feat: Tenant Storefront Builder - Simplified

## Overview

Add tier/segment organization to the tenant package form so tenants can organize their offerings. This is a **minimal, focused implementation** based on reviewer feedback.

**Scope:** 3-5 days of work
**Deferred:** Add-ons management, storefront preview (can be added later if tenants request)

---

## Problem Statement

The backend supports package tiers (`grouping`, `groupingOrder`, `segmentId`) but the tenant dashboard doesn't expose these fields. Tenants cannot organize their packages into tiers like "Solo", "Couple", "Group".

**Current State:**

- Backend: Complete (schema has all fields)
- Frontend: PackageForm only has title, description, price, active toggle
- Gap: 3 fields missing from form + storefront doesn't group by tier

---

## Proposed Solution

### Phase 1: Package Form Enhancement (Days 1-2)

Add tier/segment fields to the existing `PackageForm` as a single new section.

**Files to Modify:**

| File                                                                                 | Changes                                                                  |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| `packages/contracts/src/dto.ts`                                                      | Add `segmentId`, `grouping`, `groupingOrder` to `UpdatePackageDtoSchema` |
| `client/src/features/tenant-admin/packages/hooks/usePackageForm.ts`                  | Extend form state with new fields                                        |
| `client/src/features/tenant-admin/packages/PackageForm/index.tsx`                    | Add new section                                                          |
| NEW: `client/src/features/tenant-admin/packages/PackageForm/OrganizationSection.tsx` | Single section with all 3 fields                                         |

**New Section Component:**

```tsx
// OrganizationSection.tsx - ~80 lines
interface OrganizationSectionProps {
  form: PackageFormData;
  setForm: (form: PackageFormData) => void;
  segments: SegmentDto[];
  isLoadingSegments: boolean;
  isSaving: boolean;
}

export function OrganizationSection({
  form,
  setForm,
  segments,
  isLoadingSegments,
  isSaving,
}: OrganizationSectionProps) {
  return (
    <>
      {/* Segment Dropdown */}
      <div className="space-y-2">
        <Label htmlFor="segmentId">Business Category</Label>
        <Select
          value={form.segmentId}
          onValueChange={(value) => setForm({ ...form, segmentId: value })}
          disabled={isSaving || isLoadingSegments}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a category (optional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">None</SelectItem>
            {segments.map((seg) => (
              <SelectItem key={seg.id} value={seg.id}>
                {seg.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tier/Grouping Text Input */}
      <div className="space-y-2">
        <Label htmlFor="grouping">Tier/Grouping</Label>
        <Input
          id="grouping"
          value={form.grouping}
          onChange={(e) => setForm({ ...form, grouping: e.target.value })}
          placeholder="e.g., Solo, Couple, Group, Budget, Premium"
          disabled={isSaving}
        />
        <p className="text-sm text-white/70">
          Packages with the same grouping appear together on your storefront
        </p>
      </div>

      {/* Grouping Order Number */}
      <div className="space-y-2">
        <Label htmlFor="groupingOrder">Display Order</Label>
        <Input
          id="groupingOrder"
          type="number"
          value={form.groupingOrder}
          onChange={(e) => setForm({ ...form, groupingOrder: e.target.value })}
          placeholder="1"
          min="0"
          disabled={isSaving}
        />
        <p className="text-sm text-white/70">Lower numbers appear first within the tier</p>
      </div>
    </>
  );
}
```

**Updated Form Data Interface:**

```typescript
// hooks/usePackageForm.ts
export interface PackageFormData {
  // Existing
  title: string;
  description: string;
  priceCents: string;
  minLeadDays: string;
  isActive: boolean;

  // NEW (3 fields)
  segmentId: string; // Empty string = no segment
  grouping: string; // Free-form tier label
  groupingOrder: string; // Number as string for input
}
```

### Phase 2: Storefront Tier Display (Day 3)

Update the public storefront to group packages by tier.

**Files to Modify:**

| File                                  | Changes                        |
| ------------------------------------- | ------------------------------ |
| `client/src/pages/PackageCatalog.tsx` | Add grouping logic (~15 lines) |

**Grouping Logic:**

```typescript
// PackageCatalog.tsx - add inside component
const packagesByTier = useMemo(() => {
  const grouped = packages.reduce((acc, pkg) => {
    const tier = pkg.grouping || 'Featured';
    if (!acc[tier]) acc[tier] = [];
    acc[tier].push(pkg);
    return acc;
  }, {} as Record<string, PackageDto[]>);

  // Sort within each tier by groupingOrder, then by title
  Object.values(grouped).forEach(tierPackages => {
    tierPackages.sort((a, b) => {
      const orderDiff = (a.groupingOrder ?? Infinity) - (b.groupingOrder ?? Infinity);
      if (orderDiff !== 0) return orderDiff;
      return a.title.localeCompare(b.title);
    });
  });

  return grouped;
}, [packages]);

// Render with section headers
return (
  <div className="space-y-8">
    {Object.entries(packagesByTier).map(([tier, tierPackages]) => (
      <section key={tier}>
        <h2 className="text-2xl font-bold mb-4">{tier}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tierPackages.map(pkg => <PackageCard key={pkg.id} package={pkg} />)}
        </div>
      </section>
    ))}
  </div>
);
```

### Phase 3: Testing & Polish (Days 4-5)

- Test form on mobile (375px+)
- Test with real tenant data
- Fix any edge cases
- Ship to production

---

## Prerequisite: Contract Update (CRITICAL)

The `UpdatePackageDtoSchema` is **missing** the tier fields. This must be fixed first:

```typescript
// packages/contracts/src/dto.ts - line 198+
export const UpdatePackageDtoSchema = z.object({
  slug: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  priceCents: z.number().int().min(0).optional(),
  photoUrl: z.string().url().optional(),
  // ADD THESE:
  segmentId: z.string().nullable().optional(),
  grouping: z.string().nullable().optional(),
  groupingOrder: z.number().int().nullable().optional(),
});
```

Also update `CreatePackageDtoSchema` with the same fields.

---

## Acceptance Criteria

### Functional

- [ ] Package form shows segment dropdown (populated from `tenantAdminGetSegments`)
- [ ] Package form shows grouping text field with helpful placeholder
- [ ] Package form shows grouping order number input
- [ ] Saving package persists segment/tier data to database
- [ ] Public storefront groups packages by tier label
- [ ] Packages within tier sorted by groupingOrder, then title
- [ ] Packages without grouping appear in "Featured" section

### Technical

- [ ] `UpdatePackageDtoSchema` includes new fields
- [ ] `CreatePackageDtoSchema` includes new fields
- [ ] Form validates gracefully (tier fields are optional)
- [ ] No TypeScript errors (`npm run typecheck`)
- [ ] Mobile-responsive (tested at 375px width)

### Testing

- [ ] Unit test: Form state includes new fields
- [ ] Unit test: Grouping logic handles null values
- [ ] Integration test: Package update with tier fields
- [ ] Manual test: Full flow from form to storefront

---

## What's NOT Included (Deferred)

Per reviewer feedback, these are explicitly **deferred** to future work:

1. **Add-ons Management Tab** - Wait for tenant to request this feature
2. **Storefront Preview Page** - Existing "View Storefront" button is sufficient
3. **Photo Reordering** - Current upload/delete flow is adequate
4. **Drag-and-drop Tier Builder** - Overkill for current needs

If tenants request these features, they can be added in future sprints.

---

## Files Summary

**Modified (4 files):**

- `packages/contracts/src/dto.ts` - Add tier fields to DTOs
- `client/src/features/tenant-admin/packages/hooks/usePackageForm.ts` - Extend form state
- `client/src/features/tenant-admin/packages/PackageForm/index.tsx` - Add OrganizationSection
- `client/src/pages/PackageCatalog.tsx` - Add tier grouping display

**Created (1 file):**

- `client/src/features/tenant-admin/packages/PackageForm/OrganizationSection.tsx` - New section component

**Total: 5 files, ~150 lines of new code**

---

## Implementation Checklist

### Day 1: Contract + Hook

- [ ] Update `UpdatePackageDtoSchema` with tier fields
- [ ] Update `CreatePackageDtoSchema` with tier fields
- [ ] Run `npm run typecheck` in contracts package
- [ ] Extend `PackageFormData` interface in `usePackageForm.ts`
- [ ] Update `loadPackage()` to populate tier fields from API response
- [ ] Update `submitForm()` to send tier fields in API request

### Day 2: Form UI

- [ ] Create `OrganizationSection.tsx` component
- [ ] Fetch segments using `api.tenantAdminGetSegments()` in parent
- [ ] Add OrganizationSection to PackageForm between Pricing and Actions
- [ ] Test form locally - create package with tier data
- [ ] Test form locally - edit existing package and add tier data

### Day 3: Storefront Display

- [ ] Add `useMemo` grouping logic to `PackageCatalog.tsx`
- [ ] Add tier section headers to storefront rendering
- [ ] Handle "Featured" fallback for packages without grouping
- [ ] Test with multiple packages in different tiers

### Days 4-5: Polish & Ship

- [ ] Test on mobile viewport (375px)
- [ ] Test with edge cases (empty tiers, single package, many packages)
- [ ] Run full test suite
- [ ] Deploy to staging
- [ ] Get tenant feedback
- [ ] Deploy to production

---

## References

### Internal Files

- Form hook: `client/src/features/tenant-admin/packages/hooks/usePackageForm.ts`
- Form component: `client/src/features/tenant-admin/packages/PackageForm/index.tsx`
- Existing sections: `BasicInfoSection.tsx`, `PricingSection.tsx`
- Package schema: `server/prisma/schema.prisma:180-217`
- Contracts: `packages/contracts/src/dto.ts`
- Storefront: `client/src/pages/PackageCatalog.tsx`

### Existing Patterns to Follow

- Section component pattern: `BasicInfoSection.tsx` (102 lines)
- Select dropdown: `BrandingForm/FontSelector.tsx`
- API fetching in forms: `useAddOnManager.ts` (for segment fetching pattern)
