# Phase 3 UI Components - Implementation Guide

This guide shows how to use the new Phase 3 components that were just created.

## Components Added

### 1. EmptyState Component
**Location**: `client/src/components/ui/empty-state.tsx`

**Purpose**: Display when lists/tables have no data

**Usage Example**:
```tsx
import { EmptyState } from "@/components/ui/empty-state";
import { Package } from "lucide-react";

// In your component
{packages.length === 0 && (
  <EmptyState
    icon={Package}
    title="No packages yet"
    description="Get started by creating your first wedding package"
    action={{
      label: "Create Package",
      onClick: () => setShowCreateDialog(true)
    }}
  />
)}
```

**Integration Points**:
- `client/src/features/admin/PackagesList.tsx` - When no packages exist
- `client/src/features/admin/BookingList.tsx` - When no bookings exist
- `client/src/features/tenant-admin/PackageList.tsx` - When no packages
- `client/src/features/tenant-admin/TenantBookingList.tsx` - When no bookings

---

### 2. Skeleton Components
**Location**: `client/src/components/ui/skeleton.tsx`

**Purpose**: Show loading states instead of spinners for better UX

**Components Provided**:
- `Skeleton` - Generic skeleton with pulse animation
- `SkeletonShimmer` - Skeleton with shimmer gradient effect
- `PackageCardSkeleton` - Matches PackageCard dimensions
- `TableSkeleton` - Table loading state with configurable rows
- `MetricCardSkeleton` - Matches DashboardMetrics cards
- `FormSkeleton` - Generic form loading state

**Usage Example**:
```tsx
import { PackageCardSkeleton, TableSkeleton } from "@/components/ui/skeleton";

// Loading packages
{isLoading ? (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    <PackageCardSkeleton />
    <PackageCardSkeleton />
    <PackageCardSkeleton />
  </div>
) : (
  <PackageGrid packages={packages} />
)}

// Loading table
{isLoading ? (
  <TableSkeleton rows={5} />
) : (
  <BookingsTable bookings={bookings} />
)}
```

**Integration Points**:
- `client/src/features/admin/PackagesList.tsx` - Replace Loader2 with PackageCardSkeleton
- `client/src/features/admin/BookingList.tsx` - Use TableSkeleton
- `client/src/features/admin/Dashboard.tsx` - Use MetricCardSkeleton for metrics
- `client/src/features/tenant-admin/TenantDashboard.tsx` - Use MetricCardSkeleton
- `client/src/features/tenant-admin/PackageList.tsx` - Use PackageCardSkeleton

---

### 3. AlertDialog Component
**Location**: `client/src/components/ui/alert-dialog.tsx`

**Purpose**: Confirmation dialogs for destructive operations

**Usage Example**:
```tsx
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

// Delete package confirmation
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="destructive" size="sm">
      <Trash2 className="h-4 w-4 mr-2" />
      Delete
    </Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Delete "{packageName}"?</AlertDialogTitle>
      <AlertDialogDescription>
        This action cannot be undone. This will permanently delete the package
        and remove all associated data.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction
        onClick={() => handleDelete(packageId)}
        className="bg-red-600 hover:bg-red-700"
      >
        Delete Package
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**Integration Points**:
- `client/src/features/admin/PackagesList.tsx` - Confirm package deletion
- `client/src/features/admin/AddOnManager.tsx` - Confirm add-on deletion
- `client/src/features/admin/tenants/TenantForm.tsx` - Confirm tenant deletion
- `client/src/features/tenant-admin/PackageList.tsx` - Confirm package deletion
- `client/src/features/photos/PhotoDeleteDialog.tsx` - Already has delete dialog, can enhance
- `client/src/features/tenant-admin/BlackoutsManager.tsx` - Confirm blackout deletion

---

## Integration Priority

### High Priority (Quick Wins - 30 min each)
1. **EmptyState in PackagesList** - Replace "No packages" text
2. **EmptyState in BookingList** - Replace "No bookings yet" text
3. **AlertDialog in PhotoDeleteDialog** - Enhance existing dialog

### Medium Priority (1-2 hours each)
4. **Skeletons in admin pages** - Replace all Loader2 spinners
5. **AlertDialog in all delete operations** - Add confirmations throughout

### Optional (Polish)
6. **FormSkeleton in forms** - Show loading state while saving

---

## Example: Complete Integration in PackagesList.tsx

```tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Package, Plus, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PackageCardSkeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function PackagesList() {
  const queryClient = useQueryClient();
  const { data: packages, isLoading } = useQuery({
    queryKey: ["packages"],
    queryFn: fetchPackages,
  });

  const deleteMutation = useMutation({
    mutationFn: deletePackage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["packages"] });
    },
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <PackageCardSkeleton />
        <PackageCardSkeleton />
        <PackageCardSkeleton />
      </div>
    );
  }

  // Empty state
  if (!packages || packages.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="No wedding packages yet"
        description="Create your first package to start accepting bookings"
        action={{
          label: "Create Package",
          onClick: () => setShowCreateDialog(true),
        }}
      />
    );
  }

  // Data state with delete confirmation
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {packages.map((pkg) => (
        <div key={pkg.id} className="relative">
          <PackageCard package={pkg} />

          {/* Delete with confirmation */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                className="absolute top-2 right-2"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Delete "{pkg.name}"?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete this package and all associated
                  data. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteMutation.mutate(pkg.id)}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Delete Package
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ))}
    </div>
  );
}
```

---

## Benefits

### EmptyState
- ✅ Better UX than plain text
- ✅ Clear call-to-action for users
- ✅ Consistent empty state design across app

### Skeleton Components
- ✅ Reduces perceived loading time (research shows 20-30% improvement)
- ✅ Maintains layout stability (no layout shift)
- ✅ More professional than spinners
- ✅ Shimmer effect feels premium

### AlertDialog
- ✅ Prevents accidental deletions
- ✅ Clear, accessible confirmation flow
- ✅ Consistent confirmation pattern
- ✅ Keyboard accessible

---

## Testing

After integration, test:

1. **EmptyState**:
   - Delete all packages, verify EmptyState shows
   - Click CTA, verify create dialog opens
   - Check responsive layout

2. **Skeletons**:
   - Refresh page, verify skeleton shows during load
   - Check skeleton matches final layout dimensions
   - Verify shimmer animation is smooth

3. **AlertDialog**:
   - Click delete, verify dialog opens
   - Press Escape, verify dialog closes (no delete)
   - Click Cancel, verify dialog closes (no delete)
   - Click Delete, verify deletion occurs

---

## Phase 3 Completion Checklist

- [x] Create EmptyState component
- [x] Create Skeleton components (6 variants)
- [x] Create AlertDialog component
- [ ] Integrate EmptyState in PackagesList
- [ ] Integrate EmptyState in BookingList
- [ ] Replace Loader2 with Skeletons in admin pages
- [ ] Add AlertDialog to all delete operations
- [ ] Test all integrations
- [ ] TypeScript compile check
- [ ] Commit Phase 3 completion

---

**Created**: November 18, 2025
**Phase**: 3 of 5-phase UI/UX transformation
**Status**: Components ready for integration

